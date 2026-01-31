"""
QuickBooks Online API Client Wrapper

Handles OAuth token management, API calls, and provides
typed methods for QBO operations used by the MCP tools.

Supports multi-user authentication with per-user credentials.
"""
import os
import json
import logging
import hashlib
import requests
from pathlib import Path
from datetime import datetime, timedelta
from typing import Any, Callable
from dataclasses import dataclass

from intuitlib.client import AuthClient
from intuitlib.exceptions import AuthClientError
from quickbooks.client import QuickBooks
from quickbooks.objects.account import Account
from quickbooks.objects.vendor import Vendor
from quickbooks.objects.purchase import Purchase, AccountBasedExpenseLine
from quickbooks.objects.attachable import Attachable, AttachableRef
from quickbooks.objects.base import Ref
from quickbooks.exceptions import QuickbooksException

from .errors import (
    QBOError, AuthenticationError, QBOAPIError, ValidationError,
    AccountNotFoundError, VendorNotFoundError, AmbiguousVendorError,
    ExpenseNotFoundError, AttachmentError, DuplicateError, UnsupportedMimeTypeError
)


logger = logging.getLogger(__name__)

# Supported MIME types for attachments
SUPPORTED_MIME_TYPES = [
    "image/jpeg",
    "image/png", 
    "image/gif",
    "image/tiff",
    "application/pdf"
]

# Account types for filtering
EXPENSE_ACCOUNT_TYPES = ["Expense", "Cost of Goods Sold", "Other Expense"]
PAYMENT_ACCOUNT_TYPES = ["Bank", "Credit Card"]


class QBOClient:
    """
    QuickBooks Online API Client
    
    Wraps the python-quickbooks library with additional features:
    - Per-user credential management (multi-tenant)
    - Automatic token refresh with callback
    - Typed helper methods for MCP tools
    - User-scoped idempotency tracking
    
    In multi-user mode, credentials are passed at construction time.
    The on_token_refresh callback is called when tokens are refreshed
    to allow persistence to external storage (e.g., Redis).
    """
    
    def __init__(
        self,
        client_id: str | None = None,
        client_secret: str | None = None,
        realm_id: str | None = None,
        access_token: str | None = None,
        refresh_token: str | None = None,
        environment: str | None = None,
        idempotency_checker: Callable[[str], str | None] | None = None,
        idempotency_storer: Callable[[str, str], None] | None = None,
    ):
        """
        Initialize QBO Client.
        
        Args:
            client_id: QuickBooks OAuth App client ID
            client_secret: QuickBooks OAuth App client secret
            realm_id: QuickBooks company ID (realm ID)
            access_token: Current access token
            refresh_token: Refresh token (for reference, not auto-refresh)
            environment: 'sandbox' or 'production'
            idempotency_checker: Callback(key) -> expense_id or None
            idempotency_storer: Callback(key, expense_id) to store idempotency
        """
        # OAuth app credentials (shared across users)
        self.client_id = client_id or os.getenv("QBO_CLIENT_ID") or os.getenv("CLIENT_ID")
        self.client_secret = client_secret or os.getenv("QBO_CLIENT_SECRET") or os.getenv("CLIENT_SECRET")
        
        # Per-user credentials
        self.realm_id = realm_id
        self.refresh_token = refresh_token
        self._access_token = access_token
        
        # Configuration
        self.environment = environment or os.getenv("QBO_ENVIRONMENT") or os.getenv("ENVIRONMENT", "sandbox")
        
        # Idempotency callbacks
        self._idempotency_checker = idempotency_checker
        self._idempotency_storer = idempotency_storer
        
        # Internal clients
        self._auth_client: AuthClient | None = None
        self._qb_client: QuickBooks | None = None
        
        # Account cache for validation
        self._account_cache: dict[str, Account] | None = None
        self._account_cache_time: datetime | None = None
        
        self._validate_config()
    
    def _validate_config(self):
        """Validate required configuration"""
        missing = []
        if not self.client_id:
            missing.append("QBO_CLIENT_ID or CLIENT_ID")
        if not self.client_secret:
            missing.append("QBO_CLIENT_SECRET or CLIENT_SECRET")
        if not self.realm_id:
            missing.append("realm_id")
        if not self._access_token:
            missing.append("access_token")
        
        if missing:
            raise AuthenticationError(
                f"Missing required configuration: {', '.join(missing)}",
                {"missing_vars": missing}
            )
    
    def _get_auth_client(self) -> AuthClient:
        """Get or create auth client"""
        if self._auth_client is None:
            base_url = os.getenv("QBO_MCP_BASE_URL", "http://localhost:8000")
            self._auth_client = AuthClient(
                client_id=self.client_id,
                client_secret=self.client_secret,
                redirect_uri=f"{base_url}/auth/callback",
                environment=self.environment,
                access_token=self._access_token,
                refresh_token=self.refresh_token,
            )
        return self._auth_client
    
    def _refresh_access_token(self):
        """Refresh the OAuth access token.
        
        Note: In the new architecture, token refresh is handled by QBOTokenVerifier.
        This method is kept for backwards compatibility but may not be needed.
        """
        if not self.refresh_token:
            raise AuthenticationError(
                "No refresh token available. User needs to re-authenticate.",
                {"error": "missing_refresh_token"}
            )
        
        auth_client = self._get_auth_client()
        
        try:
            logger.info("Refreshing QBO access token...")
            auth_client.refresh(refresh_token=self.refresh_token)
            
            self._access_token = auth_client.access_token
            
            # Update refresh token if it changed (QuickBooks rotates refresh tokens)
            if auth_client.refresh_token != self.refresh_token:
                self.refresh_token = auth_client.refresh_token
                logger.info("Refresh token was rotated")
            
            logger.info("Access token refreshed successfully")
            
        except AuthClientError as e:
            logger.error(f"Failed to refresh token: {e}")
            raise AuthenticationError(
                "Failed to refresh OAuth token. User may need to re-authenticate.",
                {"error": str(e)}
            )
    
    def _ensure_valid_token(self):
        """Ensure we have a valid access token.
        
        In the new architecture, tokens are validated and refreshed by
        QBOTokenVerifier before reaching tools. This is a simple check.
        """
        if not self._access_token:
            raise AuthenticationError(
                "No access token available. User needs to authenticate.",
                {"error": "missing_access_token"}
            )
    
    def get_client(self) -> QuickBooks:
        """Get authenticated QuickBooks client"""
        self._ensure_valid_token()
        
        # Recreate client if token changed
        if self._qb_client is None:
            self._qb_client = QuickBooks(
                auth_client=self._get_auth_client(),
                refresh_token=self.refresh_token,
                company_id=self.realm_id,
            )
        
        return self._qb_client

    @staticmethod
    def _ref_value(ref: Any) -> str | None:
        """
        Extract the `.value` from a QBO Ref-like object.

        The python-quickbooks library uses `Ref` objects (with `.value`/`.name`),
        but some places may return dict-shaped refs; handle both.
        """
        if ref is None:
            return None

        if isinstance(ref, dict):
            value = ref.get("value") or ref.get("Value")
            return str(value) if value is not None else None

        value = getattr(ref, "value", None)
        if value is None:
            value = getattr(ref, "Value", None)
        return str(value) if value is not None else None
    
    # =========================================================================
    # Account Methods
    # =========================================================================
    
    def _refresh_account_cache(self, force: bool = False):
        """Refresh account cache if stale"""
        cache_age = timedelta(minutes=15)
        if (
            force or
            self._account_cache is None or
            self._account_cache_time is None or
            datetime.utcnow() - self._account_cache_time > cache_age
        ):
            client = self.get_client()
            accounts = Account.query("SELECT * FROM Account", qb=client)
            self._account_cache = {str(acc.Id): acc for acc in accounts}
            self._account_cache_time = datetime.utcnow()
            logger.info(f"Account cache refreshed: {len(self._account_cache)} accounts")
    
    def list_accounts(
        self,
        kind: str = "all",
        active_only: bool = True,
        search: str | None = None
    ) -> list[dict[str, Any]]:
        """
        List accounts with filtering.
        
        Args:
            kind: "expense_categories" | "payment_accounts" | "all"
            active_only: Only return active accounts
            search: Filter by name (case-insensitive contains)
        
        Returns:
            List of account dicts
        """
        self._refresh_account_cache()
        
        results = []
        for acc in self._account_cache.values():
            # Filter by active status
            if active_only and not acc.Active:
                continue
            
            # Filter by kind
            acc_type = acc.AccountType
            if kind == "expense_categories":
                if acc_type not in EXPENSE_ACCOUNT_TYPES:
                    continue
            elif kind == "payment_accounts":
                if acc_type not in PAYMENT_ACCOUNT_TYPES:
                    continue
            
            # Filter by search term
            if search:
                search_lower = search.lower()
                name_match = search_lower in (acc.Name or "").lower()
                fqn_match = search_lower in (acc.FullyQualifiedName or "").lower()
                if not (name_match or fqn_match):
                    continue
            
            results.append({
                "id": str(acc.Id),
                "name": acc.Name,
                "type": acc.AccountType,
                "subtype": getattr(acc, "AccountSubType", None),
                "classification": getattr(acc, "Classification", None),
                "fullyQualifiedName": acc.FullyQualifiedName,
                "active": acc.Active
            })
        
        # Sort by name
        results.sort(key=lambda x: x["name"].lower())
        return results
    
    def validate_payment_account(self, account_id: str) -> Account:
        """Validate that account_id is a valid payment account (Bank/CreditCard)"""
        self._refresh_account_cache()
        
        acc = self._account_cache.get(account_id)
        if not acc:
            raise AccountNotFoundError(account_id, "payment account")
        
        if acc.AccountType not in PAYMENT_ACCOUNT_TYPES:
            raise AccountNotFoundError(
                account_id,
                "payment account",
                {"actual_type": acc.AccountType, "expected_types": PAYMENT_ACCOUNT_TYPES}
            )
        
        return acc
    
    def validate_expense_account(self, account_id: str) -> Account:
        """Validate that account_id is a valid expense category account"""
        self._refresh_account_cache()
        
        acc = self._account_cache.get(account_id)
        if not acc:
            raise AccountNotFoundError(account_id, "expense category")
        
        if acc.AccountType not in EXPENSE_ACCOUNT_TYPES:
            raise AccountNotFoundError(
                account_id,
                "expense category", 
                {"actual_type": acc.AccountType, "expected_types": EXPENSE_ACCOUNT_TYPES}
            )
        
        return acc
    
    # =========================================================================
    # Tax Code Methods
    # =========================================================================
    
    def list_tax_codes(
        self,
        active_only: bool = True,
        search: str | None = None
    ) -> list[dict[str, Any]]:
        """
        List available tax codes.
        
        Args:
            active_only: Only return active tax codes
            search: Filter by name (case-insensitive contains)
        
        Returns:
            List of tax code dicts
        """
        client = self.get_client()
        
        # Build query
        conditions = []
        if active_only:
            conditions.append("Active = true")
        
        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM TaxCode{where}"
        
        try:
            from quickbooks.objects.taxcode import TaxCode
            tax_codes = TaxCode.query(query, qb=client)
        except QuickbooksException as e:
            logger.error(f"Tax code query failed: {e}")
            raise QBOAPIError(f"Failed to query tax codes: {e}")
        
        results = []
        for tc in tax_codes:
            # Filter by search term
            if search:
                search_lower = search.lower()
                if search_lower not in (tc.Name or "").lower():
                    continue
            
            results.append({
                "id": str(tc.Id),
                "name": tc.Name,
                "description": getattr(tc, "Description", None),
                "active": tc.Active,
                "taxable": getattr(tc, "Taxable", None),
                "taxGroup": getattr(tc, "TaxGroup", None)
            })
        
        # Sort by name
        results.sort(key=lambda x: x["name"].lower())
        return results
    
    # =========================================================================
    # Vendor Methods
    # =========================================================================
    
    def list_vendors(
        self,
        search: str | None = None,
        active_only: bool = True,
        limit: int = 50
    ) -> list[dict[str, Any]]:
        """
        List/search vendors.
        
        Args:
            search: Filter by display name (case-insensitive contains)
            active_only: Only return active vendors
            limit: Maximum results
        
        Returns:
            List of vendor dicts
        """
        client = self.get_client()
        
        # Build query
        conditions = []
        if active_only:
            conditions.append("Active = true")
        if search:
            # QBO uses LIKE for partial matches
            escaped = search.replace("'", "\\'")
            conditions.append(f"DisplayName LIKE '%{escaped}%'")
        
        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM Vendor{where} MAXRESULTS {limit}"
        
        try:
            vendors = Vendor.query(query, qb=client)
        except QuickbooksException as e:
            logger.error(f"Vendor query failed: {e}")
            raise QBOAPIError(f"Failed to query vendors: {e}")
        
        results = []
        for v in vendors:
            results.append({
                "id": str(v.Id),
                "displayName": v.DisplayName,
                "companyName": getattr(v, "CompanyName", None),
                "active": v.Active
            })
        
        return results
    
    def create_vendor(
        self,
        display_name: str,
        company_name: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        website: str | None = None,
        notes: str | None = None
    ) -> dict[str, Any]:
        """
        Create a new vendor in QBO.
        
        Args:
            display_name: Vendor display name (required, must be unique)
            company_name: Company/business name
            email: Primary email address
            phone: Primary phone number
            website: Website URL
            notes: Internal notes about vendor
        
        Returns:
            Created vendor dict with id and details
        """
        client = self.get_client()
        
        # Check for duplicate display name
        existing = self.list_vendors(search=display_name, active_only=False, limit=10)
        exact_match = [v for v in existing if v["displayName"].lower() == display_name.lower()]
        if exact_match:
            raise ValidationError(
                f"Vendor with display name '{display_name}' already exists",
                {"existingVendorId": exact_match[0]["id"]}
            )
        
        vendor = Vendor()
        vendor.DisplayName = display_name
        
        if company_name:
            vendor.CompanyName = company_name
        
        if email:
            from quickbooks.objects.vendor import VendorEmail
            vendor.PrimaryEmailAddr = VendorEmail()
            vendor.PrimaryEmailAddr.Address = email
        
        if phone:
            from quickbooks.objects.vendor import VendorPhone
            vendor.PrimaryPhone = VendorPhone()
            vendor.PrimaryPhone.FreeFormNumber = phone
        
        if website:
            from quickbooks.objects.vendor import VendorWebsite
            vendor.WebAddr = VendorWebsite()
            vendor.WebAddr.URI = website
        
        if notes:
            vendor.Notes = notes
        
        try:
            logger.info(f"Creating vendor: {display_name}")
            vendor.save(qb=client)
            logger.info(f"Vendor created: ID={vendor.Id}")
        except QuickbooksException as e:
            logger.error(f"Failed to create vendor: {e}")
            raise QBOAPIError(f"Failed to create vendor: {e}")
        
        return {
            "id": str(vendor.Id),
            "displayName": vendor.DisplayName,
            "companyName": getattr(vendor, "CompanyName", None),
            "active": vendor.Active
        }
    
    def resolve_vendor(
        self,
        vendor_id: str | None = None,
        vendor_name: str | None = None
    ) -> dict[str, Any] | None:
        """
        Resolve a vendor by ID or name.
        
        Args:
            vendor_id: Exact vendor ID
            vendor_name: Vendor name to search
        
        Returns:
            Vendor dict or None
            
        Raises:
            VendorNotFoundError: If vendor_id provided but not found
            AmbiguousVendorError: If vendor_name matches multiple vendors
        """
        if vendor_id:
            client = self.get_client()
            try:
                vendor = Vendor.get(vendor_id, qb=client)
                if vendor:
                    return {
                        "id": str(vendor.Id),
                        "displayName": vendor.DisplayName,
                        "companyName": getattr(vendor, "CompanyName", None),
                        "active": vendor.Active
                    }
            except QuickbooksException:
                pass
            raise VendorNotFoundError(vendor_id=vendor_id)
        
        if vendor_name:
            matches = self.list_vendors(search=vendor_name, active_only=True, limit=10)
            
            if not matches:
                return None  # No match - caller can decide what to do
            
            # Exact match?
            exact = [m for m in matches if m["displayName"].lower() == vendor_name.lower()]
            if len(exact) == 1:
                return exact[0]
            
            # Single fuzzy match
            if len(matches) == 1:
                return matches[0]
            
            # Ambiguous - return error with options
            raise AmbiguousVendorError(vendor_name, matches[:5])
        
        return None
    
    # =========================================================================
    # Expense Methods
    # =========================================================================
    
    def search_expenses(
        self,
        date_from: str | None = None,
        date_to: str | None = None,
        min_amount: float | None = None,
        max_amount: float | None = None,
        vendor_id: str | None = None,
        vendor_name: str | None = None,
        payment_account_id: str | None = None,
        expense_account_id: str | None = None,
        text: str | None = None,
        has_attachment: bool | None = None,
        limit: int = 20,
        cursor: int | None = None
    ) -> dict[str, Any]:
        """
        Search expense transactions (Purchase objects).
        
        Returns:
            {
                "expenses": [...],
                "total": int,
                "nextCursor": int | None
            }
        """
        client = self.get_client()
        
        # Build WHERE conditions
        conditions = []
        
        if date_from:
            conditions.append(f"TxnDate >= '{date_from}'")
        if date_to:
            conditions.append(f"TxnDate <= '{date_to}'")
        if min_amount is not None:
            conditions.append(f"TotalAmt >= {min_amount}")
        if max_amount is not None:
            conditions.append(f"TotalAmt <= {max_amount}")
        if payment_account_id:
            conditions.append(f"AccountRef = '{payment_account_id}'")
        
        # Vendor filter
        if vendor_id:
            conditions.append(f"EntityRef = '{vendor_id}'")
        elif vendor_name:
            # Try to resolve vendor first
            try:
                vendor = self.resolve_vendor(vendor_name=vendor_name)
                if vendor:
                    conditions.append(f"EntityRef = '{vendor['id']}'")
            except AmbiguousVendorError:
                pass  # Skip vendor filter if ambiguous
        
        # Text search (memo/private note) - QBO doesn't support LIKE on all fields
        # We'll filter these client-side
        
        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        
        # Pagination
        start_position = (cursor or 0) + 1
        query = f"SELECT * FROM Purchase{where} ORDERBY TxnDate DESC STARTPOSITION {start_position} MAXRESULTS {limit + 1}"
        
        logger.debug(f"Expense search query: {query}")
        
        try:
            purchases = Purchase.query(query, qb=client)
        except QuickbooksException as e:
            logger.error(f"Expense search failed: {e}")
            raise QBOAPIError(f"Failed to search expenses: {e}")
        
        # Check if there are more results
        has_more = len(purchases) > limit
        if has_more:
            purchases = purchases[:limit]
        
        # Filter and transform
        results = []
        for p in purchases:
            # Client-side text filter
            if text:
                text_lower = text.lower()
                memo = (getattr(p, "Memo", "") or "").lower()
                private_note = (getattr(p, "PrivateNote", "") or "").lower()
                doc_number = (getattr(p, "DocNumber", "") or "").lower()
                if text_lower not in memo and text_lower not in private_note and text_lower not in doc_number:
                    continue
            
            # Filter by expense account (need to check line items)
            if expense_account_id:
                has_account = False
                for line in (p.Line or []):
                    if hasattr(line, "AccountBasedExpenseLineDetail"):
                        detail = line.AccountBasedExpenseLineDetail
                        if detail and hasattr(detail, "AccountRef") and detail.AccountRef:
                            if str(detail.AccountRef.value) == expense_account_id:
                                has_account = True
                                break
                if not has_account:
                    continue
            
            # Get attachment count
            attachment_count = 0
            # QBO doesn't include attachments in Purchase query - would need separate call
            # For now, we'll skip has_attachment filter or make it optional
            
            # Build line summary
            lines_summary = []
            for line in (p.Line or []):
                if hasattr(line, "AccountBasedExpenseLineDetail") and line.AccountBasedExpenseLineDetail:
                    detail = line.AccountBasedExpenseLineDetail
                    acc_ref = detail.AccountRef if detail else None
                    lines_summary.append({
                        "amount": float(line.Amount or 0),
                        "account": acc_ref.name if acc_ref else None,
                        "description": getattr(line, "Description", None)
                    })
            
            # Get vendor name
            vendor_ref = getattr(p, "EntityRef", None)
            vendor_display = vendor_ref.name if vendor_ref else None
            
            # Get payment account name
            account_ref = getattr(p, "AccountRef", None)
            payment_account_name = account_ref.name if account_ref else None
            
            results.append({
                "id": str(p.Id),
                "txnDate": str(p.TxnDate) if p.TxnDate else None,
                "totalAmt": float(p.TotalAmt) if p.TotalAmt else 0,
                "currency": self._ref_value(getattr(p, "CurrencyRef", None)),
                "vendorName": vendor_display,
                "paymentAccountName": payment_account_name,
                "memo": getattr(p, "Memo", None) or getattr(p, "PrivateNote", None),
                "linesSummary": lines_summary,
                "attachmentCount": attachment_count,
                "paymentType": getattr(p, "PaymentType", None)
            })
        
        return {
            "expenses": results,
            "total": len(results),
            "nextCursor": (cursor or 0) + limit if has_more else None
        }
    
    def get_expense(self, expense_id: str) -> dict[str, Any]:
        """
        Get full expense details.
        
        Returns both raw QBO data and normalized summary.
        """
        client = self.get_client()
        
        try:
            purchase = Purchase.get(expense_id, qb=client)
        except QuickbooksException as e:
            logger.error(f"Failed to get expense {expense_id}: {e}")
            raise ExpenseNotFoundError(expense_id)
        
        if not purchase:
            raise ExpenseNotFoundError(expense_id)
        
        # Get attachments
        attachments = self._get_attachments_for_entity("Purchase", expense_id)
        
        # Build normalized summary
        lines = []
        for line in (purchase.Line or []):
            if hasattr(line, "AccountBasedExpenseLineDetail") and line.AccountBasedExpenseLineDetail:
                detail = line.AccountBasedExpenseLineDetail
                acc_ref = detail.AccountRef if detail else None
                tax_ref = getattr(detail, "TaxCodeRef", None) if detail else None
                class_ref = getattr(detail, "ClassRef", None) if detail else None
                
                lines.append({
                    "amount": float(line.Amount or 0),
                    "description": getattr(line, "Description", None),
                    "expenseAccountId": str(acc_ref.value) if acc_ref else None,
                    "expenseAccountName": acc_ref.name if acc_ref else None,
                    "billable": getattr(detail, "BillableStatus", None) == "Billable" if detail else False,
                    "taxCodeId": str(tax_ref.value) if tax_ref else None,
                    "classId": str(class_ref.value) if class_ref else None
                })
        
        vendor_ref = getattr(purchase, "EntityRef", None)
        account_ref = getattr(purchase, "AccountRef", None)
        
        normalized = {
            "id": str(purchase.Id),
            "txnDate": str(purchase.TxnDate) if purchase.TxnDate else None,
            "paymentType": getattr(purchase, "PaymentType", None),
            "paymentAccountId": str(account_ref.value) if account_ref else None,
            "paymentAccountName": account_ref.name if account_ref else None,
            "vendorId": str(vendor_ref.value) if vendor_ref else None,
            "vendorName": vendor_ref.name if vendor_ref else None,
            "currency": self._ref_value(getattr(purchase, "CurrencyRef", None)),
            "memo": getattr(purchase, "Memo", None) or getattr(purchase, "PrivateNote", None),
            "privateNote": getattr(purchase, "PrivateNote", None),
            "referenceNumber": getattr(purchase, "DocNumber", None),
            "totalAmt": float(purchase.TotalAmt) if purchase.TotalAmt else 0,
            "lines": lines,
            "attachments": attachments,
            "syncToken": purchase.SyncToken,
            "createTime": str(getattr(purchase, "MetaData", {}).get("CreateTime", "")) if hasattr(purchase, "MetaData") and purchase.MetaData else None
        }
        
        # Raw QBO representation
        raw = {
            "Id": purchase.Id,
            "SyncToken": purchase.SyncToken,
            "TxnDate": str(purchase.TxnDate) if purchase.TxnDate else None,
            "PaymentType": getattr(purchase, "PaymentType", None),
            "AccountRef": {"value": account_ref.value, "name": account_ref.name} if account_ref else None,
            "EntityRef": {"value": vendor_ref.value, "name": vendor_ref.name} if vendor_ref else None,
            "TotalAmt": float(purchase.TotalAmt) if purchase.TotalAmt else 0,
            "Line": [
                {
                    "Amount": float(l.Amount or 0),
                    "Description": getattr(l, "Description", None),
                    "DetailType": l.DetailType,
                    "AccountBasedExpenseLineDetail": {
                        "AccountRef": {"value": l.AccountBasedExpenseLineDetail.AccountRef.value, "name": l.AccountBasedExpenseLineDetail.AccountRef.name} if l.AccountBasedExpenseLineDetail and l.AccountBasedExpenseLineDetail.AccountRef else None
                    } if hasattr(l, "AccountBasedExpenseLineDetail") and l.AccountBasedExpenseLineDetail else None
                }
                for l in (purchase.Line or [])
            ]
        }
        
        return {
            "normalized": normalized,
            "raw": raw
        }
    
    def create_expense(
        self,
        txn_date: str,
        payment_type: str,
        payment_account_id: str,
        lines: list[dict[str, Any]],
        vendor_id: str | None = None,
        vendor_name: str | None = None,
        currency: str | None = None,
        memo: str | None = None,
        reference_number: str | None = None,
        global_tax_calculation: str | None = None,
        total_amt: float | None = None,
        receipt_files: list[dict[str, Any]] | None = None,
        idempotency_key: str | None = None
    ) -> dict[str, Any]:
        """
        Create an expense transaction in QBO.
        
        Returns:
            {
                "expenseId": str,
                "createdAt": str,
                "warnings": list[str],
                "attachedReceiptIds": list[str]
            }
        """
        warnings: list[str] = []
        
        # Check idempotency key using callback
        if idempotency_key and self._idempotency_checker:
            existing_id = self._idempotency_checker(idempotency_key)
            if existing_id:
                raise DuplicateError(idempotency_key, existing_id)
        
        # Validate payment type
        if payment_type not in ["Cash", "Check", "CreditCard"]:
            raise ValidationError(
                f"Invalid paymentType '{payment_type}'. Must be 'Cash', 'Check', or 'CreditCard'.",
                {"valid_values": ["Cash", "Check", "CreditCard"]}
            )
        
        # Validate payment account
        payment_account = self.validate_payment_account(payment_account_id)
        logger.info(f"Payment account validated: {payment_account.Name} ({payment_account.AccountType})")
        
        # Validate and build lines
        if not lines:
            raise ValidationError("At least one expense line is required")
        
        qbo_lines = []
        calculated_total = 0.0
        
        for i, line in enumerate(lines):
            line_amount = line.get("amount")
            if line_amount is None or line_amount <= 0:
                raise ValidationError(f"Line {i+1}: amount is required and must be positive")
            
            expense_account_id = line.get("expenseAccountId")
            if not expense_account_id:
                raise ValidationError(f"Line {i+1}: expenseAccountId is required")
            
            expense_account = self.validate_expense_account(expense_account_id)
            logger.info(f"Line {i+1} account validated: {expense_account.Name}")
            
            # Build QBO line using AccountBasedExpenseLine
            qbo_line = AccountBasedExpenseLine()
            qbo_line.Amount = line_amount
            qbo_line.Description = line.get("description", "")
            qbo_line.DetailType = "AccountBasedExpenseLineDetail"
            
            # The AccountBasedExpenseLineDetail is a nested object
            qbo_line.AccountBasedExpenseLineDetail = qbo_line.AccountBasedExpenseLineDetail or type('Detail', (), {})()
            qbo_line.AccountBasedExpenseLineDetail.AccountRef = Ref()
            qbo_line.AccountBasedExpenseLineDetail.AccountRef.value = expense_account_id
            qbo_line.AccountBasedExpenseLineDetail.AccountRef.name = expense_account.Name
            
            # Optional: billable status
            if line.get("billable"):
                qbo_line.AccountBasedExpenseLineDetail.BillableStatus = "Billable"
            
            # Optional: tax code
            if line.get("taxCodeId"):
                qbo_line.AccountBasedExpenseLineDetail.TaxCodeRef = Ref()
                qbo_line.AccountBasedExpenseLineDetail.TaxCodeRef.value = line["taxCodeId"]
            
            # Optional: class
            if line.get("classId"):
                qbo_line.AccountBasedExpenseLineDetail.ClassRef = Ref()
                qbo_line.AccountBasedExpenseLineDetail.ClassRef.value = line["classId"]
            
            qbo_lines.append(qbo_line)
            calculated_total += line_amount
        
        # Validate total
        if total_amt is not None:
            if abs(total_amt - calculated_total) > 0.01:
                raise ValidationError(
                    f"Total amount mismatch: provided {total_amt}, sum of lines {calculated_total}",
                    {"provided": total_amt, "calculated": calculated_total}
                )
        
        # Resolve vendor
        resolved_vendor = None
        if vendor_id:
            try:
                resolved_vendor = self.resolve_vendor(vendor_id=vendor_id)
            except VendorNotFoundError:
                raise
        elif vendor_name:
            try:
                resolved_vendor = self.resolve_vendor(vendor_name=vendor_name)
                if resolved_vendor:
                    logger.info(f"Vendor resolved: {vendor_name} -> {resolved_vendor['id']}")
                else:
                    warnings.append(f"Vendor '{vendor_name}' not found. Creating expense without vendor.")
            except AmbiguousVendorError as e:
                warnings.append(f"Multiple vendors match '{vendor_name}'. Creating expense without vendor. Options: {[m['displayName'] for m in e.details['matches']]}")
        
        # Build Purchase object
        client = self.get_client()
        purchase = Purchase()
        purchase.TxnDate = txn_date
        purchase.PaymentType = payment_type
        
        # Set payment account
        purchase.AccountRef = Ref()
        purchase.AccountRef.value = payment_account_id
        purchase.AccountRef.name = payment_account.Name
        
        # Set vendor if resolved
        if resolved_vendor:
            purchase.EntityRef = Ref()
            purchase.EntityRef.value = resolved_vendor["id"]
            purchase.EntityRef.name = resolved_vendor["displayName"]
        
        # Set memo
        if memo:
            purchase.PrivateNote = memo
        
        # Set reference number
        if reference_number:
            purchase.DocNumber = reference_number
        
        # Set global tax calculation mode
        if global_tax_calculation:
            if global_tax_calculation not in ["TaxExcluded", "TaxInclusive", "NotApplicable"]:
                raise ValidationError(
                    f"Invalid globalTaxCalculation '{global_tax_calculation}'. Must be 'TaxExcluded', 'TaxInclusive', or 'NotApplicable'.",
                    {"valid_values": ["TaxExcluded", "TaxInclusive", "NotApplicable"]}
                )
            purchase.GlobalTaxCalculation = global_tax_calculation
        
        # Set lines
        purchase.Line = qbo_lines
        
        # Create in QBO
        try:
            logger.info(f"Creating expense: date={txn_date}, total={calculated_total}")
            purchase.save(qb=client)
            logger.info(f"Expense created: ID={purchase.Id}")
        except QuickbooksException as e:
            logger.error(f"Failed to create expense: {e}")
            raise QBOAPIError(f"Failed to create expense: {e}")
        
        expense_id = str(purchase.Id)
        
        # Store idempotency key using callback
        if idempotency_key and self._idempotency_storer:
            self._idempotency_storer(idempotency_key, expense_id)
        
        # Handle receipt attachments
        attached_receipt_ids = []
        if receipt_files:
            try:
                result = self.attach_receipts(expense_id, receipt_files)
                attached_receipt_ids = result["attachedReceiptIds"]
            except (AttachmentError, UnsupportedMimeTypeError) as e:
                warnings.append(f"Failed to attach receipt(s): {e.message}")
        
        return {
            "expenseId": expense_id,
            "createdAt": str(getattr(purchase, "MetaData", {}).get("CreateTime", datetime.utcnow().isoformat())) if hasattr(purchase, "MetaData") and purchase.MetaData else datetime.utcnow().isoformat(),
            "warnings": warnings if warnings else None,
            "attachedReceiptIds": attached_receipt_ids if attached_receipt_ids else None
        }

    def update_expense(
        self,
        expense_id: str,
        txn_date: str | None = None,
        payment_type: str | None = None,
        payment_account_id: str | None = None,
        lines: list[dict[str, Any]] | None = None,
        vendor_id: str | None = None,
        vendor_name: str | None = None,
        memo: str | None = None,
        reference_number: str | None = None,
        global_tax_calculation: str | None = None,
        total_amt: float | None = None,
    ) -> dict[str, Any]:
        """
        Update an existing expense (Purchase) transaction in QBO.

        Notes:
        - If lines are provided, they replace existing lines.
        - Receipts are managed separately via attach_receipts.
        """
        warnings: list[str] = []

        client = self.get_client()
        try:
            purchase = Purchase.get(expense_id, qb=client)
        except QuickbooksException as e:
            logger.error(f"Failed to get expense {expense_id} for update: {e}")
            raise ExpenseNotFoundError(expense_id)

        if not purchase:
            raise ExpenseNotFoundError(expense_id)

        # Validate and set payment type
        if payment_type is not None:
            if payment_type not in ["Cash", "Check", "CreditCard"]:
                raise ValidationError(
                    f"Invalid paymentType '{payment_type}'. Must be 'Cash', 'Check', or 'CreditCard'.",
                    {"valid_values": ["Cash", "Check", "CreditCard"]},
                )
            purchase.PaymentType = payment_type

        # Validate and set payment account
        if payment_account_id is not None:
            payment_account = self.validate_payment_account(payment_account_id)
            purchase.AccountRef = Ref()
            purchase.AccountRef.value = payment_account_id
            purchase.AccountRef.name = payment_account.Name

        # Set transaction date
        if txn_date is not None:
            purchase.TxnDate = txn_date

        # Set memo/notes
        if memo is not None:
            purchase.PrivateNote = memo

        # Set reference number
        if reference_number is not None:
            purchase.DocNumber = reference_number

        # Set global tax calculation mode
        if global_tax_calculation is not None:
            if global_tax_calculation not in ["TaxExcluded", "TaxInclusive", "NotApplicable"]:
                raise ValidationError(
                    f"Invalid globalTaxCalculation '{global_tax_calculation}'. Must be 'TaxExcluded', 'TaxInclusive', or 'NotApplicable'.",
                    {"valid_values": ["TaxExcluded", "TaxInclusive", "NotApplicable"]},
                )
            purchase.GlobalTaxCalculation = global_tax_calculation

        # Validate and set lines (replace)
        if lines is not None:
            if not lines:
                raise ValidationError("At least one expense line is required when updating lines")

            qbo_lines = []
            calculated_total = 0.0

            for i, line in enumerate(lines):
                line_amount = line.get("amount")
                if line_amount is None or line_amount <= 0:
                    raise ValidationError(f"Line {i+1}: amount is required and must be positive")

                expense_account_id = line.get("expenseAccountId")
                if not expense_account_id:
                    raise ValidationError(f"Line {i+1}: expenseAccountId is required")

                expense_account = self.validate_expense_account(expense_account_id)
                logger.info(f"Update line {i+1} account validated: {expense_account.Name}")

                qbo_line = AccountBasedExpenseLine()
                qbo_line.Amount = line_amount
                qbo_line.Description = line.get("description", "")
                qbo_line.DetailType = "AccountBasedExpenseLineDetail"

                qbo_line.AccountBasedExpenseLineDetail = qbo_line.AccountBasedExpenseLineDetail or type("Detail", (), {})()
                qbo_line.AccountBasedExpenseLineDetail.AccountRef = Ref()
                qbo_line.AccountBasedExpenseLineDetail.AccountRef.value = expense_account_id
                qbo_line.AccountBasedExpenseLineDetail.AccountRef.name = expense_account.Name

                if line.get("billable"):
                    qbo_line.AccountBasedExpenseLineDetail.BillableStatus = "Billable"

                if line.get("taxCodeId"):
                    qbo_line.AccountBasedExpenseLineDetail.TaxCodeRef = Ref()
                    qbo_line.AccountBasedExpenseLineDetail.TaxCodeRef.value = line["taxCodeId"]

                if line.get("classId"):
                    qbo_line.AccountBasedExpenseLineDetail.ClassRef = Ref()
                    qbo_line.AccountBasedExpenseLineDetail.ClassRef.value = line["classId"]

                qbo_lines.append(qbo_line)
                calculated_total += line_amount

            if total_amt is not None and abs(total_amt - calculated_total) > 0.01:
                raise ValidationError(
                    f"Total amount mismatch: provided {total_amt}, sum of lines {calculated_total}",
                    {"provided": total_amt, "calculated": calculated_total},
                )

            purchase.Line = qbo_lines

        # Resolve and set vendor if requested
        resolved_vendor = None
        if vendor_id:
            resolved_vendor = self.resolve_vendor(vendor_id=vendor_id)
        elif vendor_name:
            try:
                resolved_vendor = self.resolve_vendor(vendor_name=vendor_name)
                if not resolved_vendor:
                    warnings.append(f"Vendor '{vendor_name}' not found. Leaving vendor unchanged.")
            except AmbiguousVendorError as e:
                warnings.append(
                    f"Multiple vendors match '{vendor_name}'. Leaving vendor unchanged. Options: {[m['displayName'] for m in e.details['matches']]}"
                )

        if resolved_vendor:
            purchase.EntityRef = Ref()
            purchase.EntityRef.value = resolved_vendor["id"]
            purchase.EntityRef.name = resolved_vendor["displayName"]

        try:
            purchase.save(qb=client)
        except QuickbooksException as e:
            logger.error(f"Failed to update expense {expense_id}: {e}")
            raise QBOAPIError(f"Failed to update expense: {e}")

        updated_at = None
        if hasattr(purchase, "MetaData") and purchase.MetaData:
            updated_at = str(getattr(purchase.MetaData, "LastUpdatedTime", None) or "")

        return {
            "expenseId": str(purchase.Id),
            "updatedAt": updated_at,
            "warnings": warnings if warnings else None,
        }
    
    # =========================================================================
    # Attachment Methods
    # =========================================================================
    
    def _get_attachments_for_entity(self, entity_type: str, entity_id: str) -> list[dict[str, Any]]:
        """Get attachments linked to an entity"""
        client = self.get_client()
        
        try:
            query = f"SELECT * FROM Attachable WHERE AttachableRef.EntityRef.Type = '{entity_type}' AND AttachableRef.EntityRef.value = '{entity_id}'"
            attachables = Attachable.query(query, qb=client)
        except QuickbooksException as e:
            logger.warning(f"Failed to query attachments: {e}")
            return []
        
        results = []
        for a in attachables:
            results.append({
                "id": str(a.Id),
                "fileName": getattr(a, "FileName", None),
                "fileSize": getattr(a, "Size", None),
                "contentType": getattr(a, "ContentType", None),
                "tempDownloadUri": getattr(a, "TempDownloadUri", None)
            })
        
        return results
    
    def attach_receipts(
        self,
        expense_id: str,
        files: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Attach receipt files to an expense.
        
        Args:
            expense_id: The expense transaction ID
            files: List of file dicts. Each must be:
                   - {filePath}: reads file from disk, auto-detects mime type
        
        Returns:
            {
                "attachedReceiptIds": list[str],
                "attachmentCount": int
            }
        """
        if not files:
            return {"attachedReceiptIds": [], "attachmentCount": 0}
        
        # Verify expense exists
        client = self.get_client()
        try:
            purchase = Purchase.get(expense_id, qb=client)
        except QuickbooksException:
            raise ExpenseNotFoundError(expense_id)
        
        if not purchase:
            raise ExpenseNotFoundError(expense_id)
        
        attached_ids = []
        
        for file_info in files:
            file_path = file_info.get("filePath")
            
            if not file_path:
                raise ValidationError("Each file must include 'filePath'")

            # Read file from disk
            path = Path(file_path).expanduser().resolve()

            if not path.exists():
                raise ValidationError(f"File not found: {file_path}")
            if not path.is_file():
                raise ValidationError(f"Not a file: {file_path}")

            filename = path.name

            # Auto-detect MIME type from extension
            ext_to_mime = {
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".png": "image/png",
                ".gif": "image/gif",
                ".tif": "image/tiff",
                ".tiff": "image/tiff",
                ".pdf": "application/pdf"
            }
            ext = path.suffix.lower()
            mime_type = ext_to_mime.get(ext)

            if not mime_type:
                raise UnsupportedMimeTypeError(
                    f"Unknown extension '{ext}'",
                    SUPPORTED_MIME_TYPES
                )

            # Read file bytes
            try:
                file_bytes = path.read_bytes()
            except Exception as e:
                raise ValidationError(f"Failed to read file '{file_path}': {e}")
            
            # Log file info (but NOT the content)
            logger.info(f"Uploading attachment: {filename} ({mime_type}, {len(file_bytes)} bytes)")
            
            # Upload using QBO multipart upload
            try:
                attachment_id = self._upload_attachment(
                    filename=filename,
                    mime_type=mime_type,
                    file_bytes=file_bytes,
                    entity_type="Purchase",
                    entity_id=expense_id
                )
                attached_ids.append(attachment_id)
                logger.info(f"Attachment uploaded: {attachment_id}")
            except Exception as e:
                logger.error(f"Failed to upload attachment {filename}: {e}")
                raise AttachmentError(f"Failed to upload '{filename}': {e}")
        
        return {
            "attachedReceiptIds": attached_ids,
            "attachmentCount": len(attached_ids)
        }
    
    def _upload_attachment(
        self,
        filename: str,
        mime_type: str,
        file_bytes: bytes,
        entity_type: str,
        entity_id: str
    ) -> str:
        """
        Upload an attachment to QBO and link it to an entity.
        
        Uses the QBO Upload API with multipart form data.
        """
        self._ensure_valid_token()
        
        # QBO Upload endpoint
        base_url = "https://sandbox-quickbooks.api.intuit.com" if self.environment == "sandbox" else "https://quickbooks.api.intuit.com"
        upload_url = f"{base_url}/v3/company/{self.realm_id}/upload"
        
        # Build multipart request
        # The metadata part should be JSON
        metadata = {
            "FileName": filename,
            "ContentType": mime_type,
            "AttachableRef": [
                {
                    "EntityRef": {
                        "type": entity_type,
                        "value": entity_id
                    }
                }
            ]
        }
        
        files = {
            'file_metadata_0': ('attachment.json', json.dumps(metadata), 'application/json'),
            'file_content_0': (filename, file_bytes, mime_type)
        }
        
        headers = {
            'Authorization': f'Bearer {self._access_token}',
            'Accept': 'application/json'
        }
        
        response = requests.post(upload_url, files=files, headers=headers)
        
        if response.status_code != 200:
            logger.error(f"Upload failed: {response.status_code} {response.text}")
            raise AttachmentError(
                f"Upload failed with status {response.status_code}",
                {"response": response.text[:500]}
            )
        
        result = response.json()
        
        # Extract attachment ID from response
        attachable_response = result.get("AttachableResponse", [])
        if attachable_response and len(attachable_response) > 0:
            attachable = attachable_response[0].get("Attachable", {})
            return str(attachable.get("Id", ""))
        
        raise AttachmentError("No attachment ID in response", {"response": result})


def create_qbo_client(
    realm_id: str,
    access_token: str,
    refresh_token: str | None = None,
    idempotency_checker: Callable[[str], str | None] | None = None,
    idempotency_storer: Callable[[str, str], None] | None = None,
    client_id: str | None = None,
    client_secret: str | None = None,
    environment: str | None = None,
) -> QBOClient:
    """
    Factory function to create a QBOClient.
    
    OAuth app credentials (client_id, client_secret) are read from
    environment variables if not provided.
    
    Args:
        realm_id: QuickBooks company ID
        access_token: Current access token
        refresh_token: Refresh token (optional, for reference)
        idempotency_checker: Callback to check for duplicate operations
        idempotency_storer: Callback to store idempotency keys
        client_id: OAuth app client ID (or from env)
        client_secret: OAuth app client secret (or from env)
        environment: 'sandbox' or 'production' (or from env)
        
    Returns:
        Configured QBOClient instance
    """
    return QBOClient(
        client_id=client_id,
        client_secret=client_secret,
        realm_id=realm_id,
        access_token=access_token,
        refresh_token=refresh_token,
        environment=environment,
        idempotency_checker=idempotency_checker,
        idempotency_storer=idempotency_storer,
    )
