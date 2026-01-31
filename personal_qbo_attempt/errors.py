"""
Structured error types for QBO MCP Server
"""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class QBOError(Exception):
    """Base error for QBO operations"""
    code: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details
        }

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"


class ValidationError(QBOError):
    """Validation errors for input data"""
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            details=details or {}
        )


class AccountNotFoundError(QBOError):
    """Account ID not found or invalid type"""
    def __init__(self, account_id: str, expected_type: str | None = None, details: dict[str, Any] | None = None):
        msg = f"Account '{account_id}' not found"
        if expected_type:
            msg += f" or not a valid {expected_type}"
        super().__init__(
            code="ACCOUNT_NOT_FOUND",
            message=msg,
            details=details or {"account_id": account_id, "expected_type": expected_type}
        )


class VendorNotFoundError(QBOError):
    """Vendor not found"""
    def __init__(self, vendor_id: str | None = None, vendor_name: str | None = None):
        super().__init__(
            code="VENDOR_NOT_FOUND",
            message=f"Vendor not found: {vendor_id or vendor_name}",
            details={"vendor_id": vendor_id, "vendor_name": vendor_name}
        )


class AmbiguousVendorError(QBOError):
    """Multiple vendors match the search"""
    def __init__(self, vendor_name: str, matches: list[dict[str, Any]]):
        super().__init__(
            code="AMBIGUOUS_VENDOR",
            message=f"Multiple vendors match '{vendor_name}'. Please specify vendor_id.",
            details={"vendor_name": vendor_name, "matches": matches}
        )


class ExpenseNotFoundError(QBOError):
    """Expense transaction not found"""
    def __init__(self, expense_id: str):
        super().__init__(
            code="EXPENSE_NOT_FOUND",
            message=f"Expense '{expense_id}' not found",
            details={"expense_id": expense_id}
        )


class AttachmentError(QBOError):
    """Error uploading or linking attachment"""
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            code="ATTACHMENT_ERROR",
            message=message,
            details=details or {}
        )


class QBOAPIError(QBOError):
    """Error from QBO API"""
    def __init__(self, message: str, qbo_error_code: str | None = None, details: dict[str, Any] | None = None):
        super().__init__(
            code="QBO_API_ERROR",
            message=message,
            details={"qbo_error_code": qbo_error_code, **(details or {})}
        )


class AuthenticationError(QBOError):
    """Authentication/OAuth error"""
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            code="AUTHENTICATION_ERROR",
            message=message,
            details=details or {}
        )


class DuplicateError(QBOError):
    """Duplicate transaction detected via idempotency key"""
    def __init__(self, idempotency_key: str, existing_id: str | None = None):
        super().__init__(
            code="DUPLICATE_TRANSACTION",
            message=f"Duplicate transaction detected for idempotency key '{idempotency_key}'",
            details={"idempotency_key": idempotency_key, "existing_id": existing_id}
        )


class UnsupportedMimeTypeError(QBOError):
    """Unsupported file type for attachment"""
    def __init__(self, mime_type: str, supported: list[str]):
        super().__init__(
            code="UNSUPPORTED_MIME_TYPE",
            message=f"Unsupported file type '{mime_type}'. Supported: {', '.join(supported)}",
            details={"mime_type": mime_type, "supported": supported}
        )
