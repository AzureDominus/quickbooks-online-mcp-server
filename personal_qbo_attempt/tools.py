"""
MCP Tools for QuickBooks Online (FastMCP)

Defines tool implementations using FastMCP's decorator pattern.
Tools are registered with the FastMCP server in server.py.

Authentication is handled by QuickBooksOAuthProxy - tools receive
the validated access token and realm_id through AccessToken.claims.
"""
import logging
from typing import Any, Literal

from fastmcp import FastMCP, Context
from fastmcp.server.dependencies import get_access_token
import redis.asyncio as aioredis

from .client import QBOClient, create_qbo_client
from .storage import IdempotencyStore
from .errors import ValidationError

logger = logging.getLogger(__name__)


# Type aliases for better schema generation
AccountKind = Literal["expense_categories", "payment_accounts", "all"]
PaymentType = Literal["Cash", "Check", "CreditCard"]
TaxCalculation = Literal["TaxExcluded", "TaxInclusive", "NotApplicable"]


def _get_qbo_client(idempotency_store: IdempotencyStore | None = None) -> QBOClient:
    """
    Get a QBOClient configured with the authenticated user's credentials.
    
    Retrieves access_token and realm_id from FastMCP's auth context
    (set by QBOTokenVerifier in AccessToken.claims).
    """
    # Get the validated access token from FastMCP auth
    token = get_access_token()
    
    if not token:
        raise ValidationError(
            "Not authenticated. Please authenticate with QuickBooks first.",
            {"error": "no_access_token"}
        )
    
    # Extract credentials from claims (set by QBOTokenVerifier)
    claims = token.claims or {}
    upstream_token = claims.get("upstream_access_token")
    realm_id = claims.get("realm_id")
    
    if not upstream_token:
        raise ValidationError(
            "No QuickBooks access token found. Please re-authenticate.",
            {"error": "missing_upstream_token"}
        )
    
    if not realm_id:
        raise ValidationError(
            "No QuickBooks company (realm_id) found. Please re-authenticate.",
            {"error": "missing_realm_id"}
        )
    
    # Create idempotency callbacks if store provided
    idempotency_checker = None
    idempotency_storer = None
    
    if idempotency_store:
        import asyncio
        
        def sync_check(key: str) -> str | None:
            # Run async check in sync context
            try:
                loop = asyncio.get_running_loop()
                return asyncio.run_coroutine_threadsafe(
                    idempotency_store.check(key), loop
                ).result(timeout=5)
            except Exception:
                return None
        
        def sync_store(key: str, expense_id: str) -> None:
            try:
                loop = asyncio.get_running_loop()
                asyncio.run_coroutine_threadsafe(
                    idempotency_store.store(key, expense_id), loop
                ).result(timeout=5)
            except Exception:
                pass
        
        idempotency_checker = sync_check
        idempotency_storer = sync_store
    
    return create_qbo_client(
        realm_id=realm_id,
        access_token=upstream_token,
        idempotency_checker=idempotency_checker,
        idempotency_storer=idempotency_storer,
    )


def register_tools(mcp: FastMCP, redis_client: aioredis.Redis):
    """
    Register all QBO tools with the FastMCP server.
    
    Args:
        mcp: The FastMCP server instance
        redis_client: Redis client for idempotency tracking
    """
    idempotency_store = IdempotencyStore(redis_client)
    
    @mcp.tool
    async def qbo_list_accounts(
        ctx: Context,
        kind: AccountKind = "all",
        activeOnly: bool = True,
        search: str | None = None,
    ) -> dict[str, Any]:
        """
        List QuickBooks Online accounts with filtering.
        
        Use this to find:
        - Expense category accounts (for categorizing what was purchased)
        - Payment accounts (bank/credit card accounts used to pay)
        
        Returns account details including id, name, type, subtype, and active status.
        
        Args:
            kind: Filter by account kind - 'expense_categories' for Expense/COGS accounts,
                  'payment_accounts' for Bank/CreditCard accounts, 'all' for everything
            activeOnly: Only return active accounts
            search: Filter accounts by name (case-insensitive contains match)
        """
        await ctx.info(f"Listing accounts (kind={kind}, activeOnly={activeOnly}, search={search})")
        client = _get_qbo_client(idempotency_store)
        
        accounts = client.list_accounts(kind=kind, active_only=activeOnly, search=search)
        
        return {
            "accounts": accounts,
            "count": len(accounts),
            "filters": {"kind": kind, "activeOnly": activeOnly, "search": search}
        }
    
    @mcp.tool
    async def qbo_list_vendors(
        ctx: Context,
        search: str | None = None,
        activeOnly: bool = True,
        limit: int = 50,
    ) -> dict[str, Any]:
        """
        List or search QuickBooks Online vendors/payees.
        
        Use this to find the correct vendor ID when creating an expense.
        Returns vendor id, display name, company name, and active status.
        
        Args:
            search: Search vendors by display name (case-insensitive partial match)
            activeOnly: Only return active vendors
            limit: Maximum number of results (1-1000)
        """
        await ctx.info(f"Listing vendors (search={search}, limit={limit})")
        client = _get_qbo_client(idempotency_store)
        
        limit = max(1, min(1000, limit))
        vendors = client.list_vendors(search=search, active_only=activeOnly, limit=limit)
        
        return {
            "vendors": vendors,
            "count": len(vendors),
            "filters": {"search": search, "activeOnly": activeOnly, "limit": limit}
        }
    
    @mcp.tool
    async def qbo_list_tax_codes(
        ctx: Context,
        search: str | None = None,
        activeOnly: bool = True,
    ) -> dict[str, Any]:
        """
        List available tax codes for expense lines.
        
        Use this to find the correct tax code ID when creating expenses.
        Returns tax code id, name, description, and whether it's taxable.
        
        Args:
            search: Search tax codes by name (case-insensitive partial match)
            activeOnly: Only return active tax codes
        """
        await ctx.info(f"Listing tax codes (search={search})")
        client = _get_qbo_client(idempotency_store)
        
        tax_codes = client.list_tax_codes(active_only=activeOnly, search=search)
        
        return {
            "taxCodes": tax_codes,
            "count": len(tax_codes),
            "filters": {"search": search, "activeOnly": activeOnly}
        }
    
    @mcp.tool
    async def qbo_create_vendor(
        ctx: Context,
        displayName: str,
        companyName: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        website: str | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a new vendor/payee in QuickBooks Online.
        
        Use this when a vendor doesn't exist and you need to create one before
        recording an expense. The display name must be unique across all vendors.
        
        Args:
            displayName: Vendor display name (required, must be unique)
            companyName: Company/business name
            email: Primary email address
            phone: Primary phone number
            website: Website URL
            notes: Internal notes about the vendor
        """
        await ctx.info(f"Creating vendor: {displayName}")
        client = _get_qbo_client(idempotency_store)
        
        return client.create_vendor(
            display_name=displayName,
            company_name=companyName,
            email=email,
            phone=phone,
            website=website,
            notes=notes
        )
    
    @mcp.tool
    async def qbo_search_expenses(
        ctx: Context,
        dateFrom: str | None = None,
        dateTo: str | None = None,
        minAmount: float | None = None,
        maxAmount: float | None = None,
        vendorId: str | None = None,
        vendorName: str | None = None,
        paymentAccountId: str | None = None,
        expenseAccountId: str | None = None,
        text: str | None = None,
        hasAttachment: bool | None = None,
        limit: int = 20,
        cursor: int | None = None,
    ) -> dict[str, Any]:
        """
        Search expense transactions in QuickBooks Online.
        
        Supports filtering by date range, amount range, vendor, payment account,
        expense category, text in memo/notes, and attachment status.
        Returns a compact list of matching expenses with key details.
        
        Args:
            dateFrom: Start date (YYYY-MM-DD)
            dateTo: End date (YYYY-MM-DD)
            minAmount: Minimum total amount
            maxAmount: Maximum total amount
            vendorId: Filter by exact vendor ID
            vendorName: Filter by vendor name (will resolve to ID)
            paymentAccountId: Filter by payment account (bank/credit card) ID
            expenseAccountId: Filter by expense category account ID
            text: Search text in memo, private note, or reference number
            hasAttachment: Filter by whether expense has attachments
            limit: Maximum results (1-100)
            cursor: Pagination cursor (offset) for fetching more results
        """
        await ctx.info(f"Searching expenses (dateFrom={dateFrom}, dateTo={dateTo})")
        client = _get_qbo_client(idempotency_store)
        
        return client.search_expenses(
            date_from=dateFrom,
            date_to=dateTo,
            min_amount=minAmount,
            max_amount=maxAmount,
            vendor_id=vendorId,
            vendor_name=vendorName,
            payment_account_id=paymentAccountId,
            expense_account_id=expenseAccountId,
            text=text,
            has_attachment=hasAttachment,
            limit=max(1, min(100, limit)),
            cursor=cursor
        )
    
    @mcp.tool
    async def qbo_get_expense(
        ctx: Context,
        expenseId: str,
    ) -> dict[str, Any]:
        """
        Get full details of a specific expense transaction.
        
        Returns both a normalized summary with clean field names and the raw
        QBO API response for advanced use. Includes line items, attachments,
        vendor info, and all metadata.
        
        Args:
            expenseId: The QBO expense transaction ID
        """
        await ctx.info(f"Getting expense: {expenseId}")
        client = _get_qbo_client(idempotency_store)
        
        return client.get_expense(expenseId)
    
    @mcp.tool
    async def qbo_create_expense(
        ctx: Context,
        txnDate: str,
        paymentType: PaymentType,
        paymentAccountId: str,
        lines: list[dict[str, Any]],
        vendorId: str | None = None,
        vendorName: str | None = None,
        currency: str | None = None,
        memo: str | None = None,
        referenceNumber: str | None = None,
        globalTaxCalculation: TaxCalculation | None = None,
        totalAmt: float | None = None,
        receipt: dict[str, Any] | None = None,
        idempotencyKey: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a new expense transaction in QuickBooks Online.
        
        Creates a Purchase transaction with required date, payment type, payment
        account, and at least one line item. Optionally attach receipts.
        
        TAX HANDLING:
        - globalTaxCalculation specifies how line amounts relate to tax:
          - 'TaxExcluded': Line amounts are before tax (tax added on top)
          - 'TaxInclusive': Line amounts already include tax (tax extracted)
          - 'NotApplicable': No tax calculation (default)
        - Use taxCodeId on each line to specify tax treatment
        
        Args:
            txnDate: Transaction date (YYYY-MM-DD)
            paymentType: Payment method - 'Cash', 'Check', or 'CreditCard'
            paymentAccountId: ID of the Bank or CreditCard account used for payment
            lines: Expense line items. Each line needs:
                   - amount (number): Line amount (positive)
                   - expenseAccountId (string): ID of expense category account
                   - description (string, optional): Line description
                   - billable (boolean, optional): Mark as billable
                   - taxCodeId (string, optional): Tax code ID
                   - classId (string, optional): Class ID for tracking
                   - locationId (string, optional): Location ID for tracking
            vendorId: Vendor/payee ID (preferred if known)
            vendorName: Vendor name (will resolve; if ambiguous, created without vendor)
            currency: Currency code (e.g., 'USD'). Uses company default if omitted
            memo: Memo or description for the expense
            referenceNumber: Reference/document number
            globalTaxCalculation: How tax applies to line amounts
            totalAmt: Expected total amount (validated against sum of lines)
            receipt: Receipt files to attach. Format: {"filePaths": ["path/to/file.pdf"]}
            idempotencyKey: Unique key to prevent duplicate creation on retry
        """
        await ctx.info(f"Creating expense: date={txnDate}, type={paymentType}")
        client = _get_qbo_client(idempotency_store)
        
        # Extract receipt files
        receipt_files = None
        if isinstance(receipt, dict):
            file_paths = receipt.get("filePaths")
            if file_paths:
                receipt_files = [{"filePath": fp} for fp in file_paths]
        
        return client.create_expense(
            txn_date=txnDate,
            payment_type=paymentType,
            payment_account_id=paymentAccountId,
            lines=lines,
            vendor_id=vendorId,
            vendor_name=vendorName,
            currency=currency,
            memo=memo,
            reference_number=referenceNumber,
            global_tax_calculation=globalTaxCalculation,
            total_amt=totalAmt,
            receipt_files=receipt_files,
            idempotency_key=idempotencyKey
        )
    
    @mcp.tool
    async def qbo_update_expense(
        ctx: Context,
        expenseId: str,
        txnDate: str | None = None,
        paymentType: PaymentType | None = None,
        paymentAccountId: str | None = None,
        vendorId: str | None = None,
        vendorName: str | None = None,
        memo: str | None = None,
        referenceNumber: str | None = None,
        globalTaxCalculation: TaxCalculation | None = None,
        lines: list[dict[str, Any]] | None = None,
        totalAmt: float | None = None,
    ) -> dict[str, Any]:
        """
        Update fields on an existing expense (Purchase) transaction.
        
        Use this to correct details after creation (e.g., memo/notes, vendor, or lines).
        At least one updatable field must be provided.
        Lines, if provided, replace the existing lines entirely.
        Receipts are managed via qbo_attach_receipt.
        
        Args:
            expenseId: The expense transaction ID to update
            txnDate: Transaction date (YYYY-MM-DD)
            paymentType: Payment method type
            paymentAccountId: ID of the Bank or CreditCard account
            vendorId: Vendor/payee ID
            vendorName: Vendor name (will resolve)
            memo: Memo/notes for the expense
            referenceNumber: Reference/document number
            globalTaxCalculation: How tax applies to line amounts
            lines: Replacement expense line items (same format as create)
            totalAmt: Expected total (validated when lines provided)
        """
        await ctx.info(f"Updating expense: {expenseId}")
        client = _get_qbo_client(idempotency_store)
        
        # Check at least one update field provided
        updatable = [txnDate, paymentType, paymentAccountId, vendorId, vendorName,
                     memo, referenceNumber, globalTaxCalculation, lines]
        if not any(v is not None for v in updatable):
            raise ValidationError("At least one field to update must be provided")
        
        if totalAmt is not None and lines is None:
            raise ValidationError("totalAmt can only be provided when updating lines")
        
        return client.update_expense(
            expense_id=expenseId,
            txn_date=txnDate,
            payment_type=paymentType,
            payment_account_id=paymentAccountId,
            lines=lines,
            vendor_id=vendorId,
            vendor_name=vendorName,
            memo=memo,
            reference_number=referenceNumber,
            global_tax_calculation=globalTaxCalculation,
            total_amt=totalAmt,
        )
    
    @mcp.tool
    async def qbo_attach_receipt(
        ctx: Context,
        expenseId: str,
        filePaths: list[str],
    ) -> dict[str, Any]:
        """
        Attach receipt files to an existing expense.
        
        Use this when creating an expense and attaching a receipt separately,
        or adding additional receipts to an existing expense.
        Supports JPEG, PNG, GIF, TIFF images and PDF files.
        
        Args:
            expenseId: The expense transaction ID to attach receipts to
            filePaths: Paths to receipt files (supports ~ for home directory)
        """
        await ctx.info(f"Attaching receipts to expense: {expenseId}")
        client = _get_qbo_client(idempotency_store)
        
        if not filePaths:
            raise ValidationError("filePaths is required and must have at least one path")
        
        # Convert to file dicts
        files = [{"filePath": fp} for fp in filePaths]
        
        return client.attach_receipts(expenseId, files)
    
    logger.info("Registered QBO tools with FastMCP server")
