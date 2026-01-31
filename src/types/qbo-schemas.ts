/**
 * QuickBooks Online Entity Schemas
 * 
 * Comprehensive Zod schemas for QBO API entities based on official Intuit documentation.
 * These schemas provide type-safe validation for all MCP tool inputs.
 * 
 * @see https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities
 */

import { z } from "zod";

// =============================================================================
// Common Reference Types
// =============================================================================

/**
 * Reference type used throughout QBO API for linking entities
 * Examples: AccountRef, VendorRef, CustomerRef, ItemRef, etc.
 */
export const ReferenceSchema = z.object({
  /** The ID of the referenced entity (required) */
  value: z.string().describe("The ID of the referenced entity"),
  /** Display name of the entity (optional, for readability) */
  name: z.string().optional().describe("Display name of the referenced entity"),
});

export type Reference = z.infer<typeof ReferenceSchema>;

/**
 * Currency reference for multi-currency transactions
 */
export const CurrencyRefSchema = z.object({
  value: z.string().describe("ISO 4217 currency code (e.g., 'USD', 'CAD', 'EUR')"),
  name: z.string().optional().describe("Currency name"),
});

// =============================================================================
// Address Schemas
// =============================================================================

export const PhysicalAddressSchema = z.object({
  Line1: z.string().optional().describe("Street address line 1"),
  Line2: z.string().optional().describe("Street address line 2"),
  Line3: z.string().optional().describe("Street address line 3"),
  Line4: z.string().optional().describe("Street address line 4"),
  Line5: z.string().optional().describe("Street address line 5"),
  City: z.string().optional().describe("City name"),
  Country: z.string().optional().describe("Country name or code"),
  CountrySubDivisionCode: z.string().optional().describe("State/Province code (e.g., 'CA', 'ON')"),
  PostalCode: z.string().optional().describe("Postal/ZIP code"),
  Lat: z.string().optional().describe("Latitude coordinate"),
  Long: z.string().optional().describe("Longitude coordinate"),
});

export const EmailAddressSchema = z.object({
  Address: z.string().email().optional().describe("Email address"),
});

export const PhoneNumberSchema = z.object({
  FreeFormNumber: z.string().optional().describe("Phone number in free-form format"),
});

export const WebAddressSchema = z.object({
  URI: z.string().url().optional().describe("Website URL"),
});

// =============================================================================
// Enums
// =============================================================================

/** Payment type for Purchase transactions */
export const PaymentTypeEnum = z.enum(["Cash", "Check", "CreditCard"]).describe(
  "Payment method type: Cash (not supported in QBW), Check, or CreditCard"
);

/** Global tax calculation mode */
export const GlobalTaxCalculationEnum = z.enum([
  "TaxExcluded",   // Line amounts are before tax (tax added on top)
  "TaxInclusive",  // Line amounts already include tax (tax extracted)
  "NotApplicable", // No tax calculation
]).describe(
  "How tax applies to line amounts: TaxExcluded (amounts before tax), TaxInclusive (amounts include tax), NotApplicable (no tax)"
);

/** Line detail types for transaction lines */
export const LineDetailTypeEnum = z.enum([
  "AccountBasedExpenseLineDetail",
  "ItemBasedExpenseLineDetail",
  "SalesItemLineDetail",
  "GroupLineDetail",
  "DescriptionOnly",
  "DiscountLineDetail",
  "SubTotalLineDetail",
  "TaxLineDetail",
  "JournalEntryLineDetail",
  "PaymentLineDetail",
  "DepositLineDetail",
]).describe("Type of line detail");

/** Account types */
export const AccountTypeEnum = z.enum([
  "Bank",
  "Other Current Asset",
  "Fixed Asset",
  "Other Asset",
  "Accounts Receivable",
  "Equity",
  "Expense",
  "Other Expense",
  "Cost of Goods Sold",
  "Accounts Payable",
  "Credit Card",
  "Long Term Liability",
  "Other Current Liability",
  "Income",
  "Other Income",
]);

/** Search comparison operators */
export const SearchOperatorEnum = z.enum([
  "=",      // Equals
  "<",      // Less than
  ">",      // Greater than
  "<=",     // Less than or equal
  ">=",     // Greater than or equal
  "LIKE",   // Pattern matching (use % for wildcard)
  "IN",     // In a list of values
]).describe("Comparison operator for search queries");

// =============================================================================
// Line Item Schemas
// =============================================================================

/**
 * Account-based expense line detail
 * Used when categorizing expenses by account (expense category)
 */
export const AccountBasedExpenseLineDetailSchema = z.object({
  /** Reference to the expense account/category */
  AccountRef: ReferenceSchema.describe("Reference to the expense account (required)"),
  /** Reference to a customer for billable expenses */
  CustomerRef: ReferenceSchema.optional().describe("Customer to bill this expense to"),
  /** Reference to a class for tracking */
  ClassRef: ReferenceSchema.optional().describe("Class for departmental tracking"),
  /** Reference to a tax code */
  TaxCodeRef: ReferenceSchema.optional().describe("Tax code for this line"),
  /** Amount including tax (for tax-inclusive mode) */
  TaxInclusiveAmt: z.number().optional().describe("Amount including tax"),
  /** Whether this line is billable to a customer */
  BillableStatus: z.enum(["Billable", "NotBillable", "HasBeenBilled"]).optional()
    .describe("Billable status of this expense line"),
  /** Markup percentage for billable expenses */
  MarkupInfo: z.object({
    Percent: z.number().optional(),
    MarkUpIncomeAccountRef: ReferenceSchema.optional(),
  }).optional().describe("Markup information for billable items"),
});

/**
 * Item-based expense line detail
 * Used when purchasing specific items/products
 */
export const ItemBasedExpenseLineDetailSchema = z.object({
  /** Reference to the item being purchased */
  ItemRef: ReferenceSchema.describe("Reference to the item (required)"),
  /** Reference to a customer for billable expenses */
  CustomerRef: ReferenceSchema.optional().describe("Customer to bill this expense to"),
  /** Reference to a class for tracking */
  ClassRef: ReferenceSchema.optional().describe("Class for departmental tracking"),
  /** Reference to a tax code */
  TaxCodeRef: ReferenceSchema.optional().describe("Tax code for this line"),
  /** Quantity of items */
  Qty: z.number().positive().optional().describe("Quantity of items"),
  /** Unit price per item */
  UnitPrice: z.number().optional().describe("Unit price per item"),
  /** Whether this line is billable */
  BillableStatus: z.enum(["Billable", "NotBillable", "HasBeenBilled"]).optional()
    .describe("Billable status"),
});

/**
 * Generic line item for Purchase/Expense transactions
 */
export const PurchaseLineSchema = z.object({
  /** Unique identifier for this line (for updates) */
  Id: z.string().optional().describe("Line ID (required for updates)"),
  /** Line number for ordering */
  LineNum: z.number().int().positive().optional().describe("Line number"),
  /** Line amount (positive value) */
  Amount: z.number().describe("Line amount (positive number)"),
  /** Description of the line item */
  Description: z.string().max(4000).optional().describe("Line description (max 4000 chars)"),
  /** Type of line detail - determines which detail object to use */
  DetailType: z.enum(["AccountBasedExpenseLineDetail", "ItemBasedExpenseLineDetail"])
    .describe("Type of line: AccountBasedExpenseLineDetail or ItemBasedExpenseLineDetail"),
  /** Account-based expense details (when DetailType is AccountBasedExpenseLineDetail) */
  AccountBasedExpenseLineDetail: AccountBasedExpenseLineDetailSchema.optional(),
  /** Item-based expense details (when DetailType is ItemBasedExpenseLineDetail) */
  ItemBasedExpenseLineDetail: ItemBasedExpenseLineDetailSchema.optional(),
});

/**
 * Simplified line schema for creating expenses (user-friendly)
 * This is the preferred input format - will be transformed to QBO format
 */
export const SimplifiedExpenseLineSchema = z.object({
  /** Line amount (required, positive) */
  amount: z.number().positive().describe("Line amount (positive number, required)"),
  /** Expense account/category ID */
  expenseAccountId: z.string().describe("ID of the expense account/category (required)"),
  /** Expense account name (optional, for reference) */
  expenseAccountName: z.string().optional().describe("Name of the expense account (optional)"),
  /** Line description */
  description: z.string().max(4000).optional().describe("Line description"),
  /** Tax code ID */
  taxCodeId: z.string().optional().describe("Tax code ID for this line"),
  /** Customer ID for billable expenses */
  customerId: z.string().optional().describe("Customer ID to make this billable"),
  /** Class ID for tracking */
  classId: z.string().optional().describe("Class ID for departmental tracking"),
  /** Billable status */
  billable: z.boolean().optional().describe("Whether this expense is billable to a customer"),
});

// =============================================================================
// Transaction Schemas
// =============================================================================

/**
 * Tax detail for transactions
 */
export const TxnTaxDetailSchema = z.object({
  /** Total tax amount */
  TotalTax: z.number().optional().describe("Total tax amount"),
  /** Reference to a tax code */
  TxnTaxCodeRef: ReferenceSchema.optional().describe("Transaction-level tax code"),
  /** Individual tax lines */
  TaxLine: z.array(z.object({
    Amount: z.number().optional(),
    DetailType: z.literal("TaxLineDetail").optional(),
    TaxLineDetail: z.object({
      TaxRateRef: ReferenceSchema.optional(),
      PercentBased: z.boolean().optional(),
      TaxPercent: z.number().optional(),
      NetAmountTaxable: z.number().optional(),
    }).optional(),
  })).optional().describe("Tax line breakdown"),
});

/**
 * Full Purchase (Expense) entity schema
 * Used for creating expenses/purchases in QBO
 */
export const PurchaseSchema = z.object({
  // Identity (for updates)
  /** Purchase ID (required for updates) */
  Id: z.string().optional().describe("Purchase ID (required for update/delete)"),
  /** Sync token for optimistic locking (required for updates) */
  SyncToken: z.string().optional().describe("Sync token (required for updates)"),
  
  // Required fields
  /** Payment type (required) */
  PaymentType: PaymentTypeEnum.describe("Payment method type (required)"),
  /** Reference to payment account - Bank or CreditCard (required) */
  AccountRef: ReferenceSchema.describe("Payment account reference - Bank or CreditCard account (required)"),
  /** Line items (at least one required) */
  Line: z.array(PurchaseLineSchema).min(1).describe("Expense line items (at least one required)"),
  
  // Optional fields
  /** Transaction date (YYYY-MM-DD format) */
  TxnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Transaction date in YYYY-MM-DD format"),
  /** Vendor/payee reference */
  EntityRef: ReferenceSchema.optional().describe("Vendor/payee reference"),
  /** Currency reference (for multi-currency) */
  CurrencyRef: CurrencyRefSchema.optional().describe("Currency for this transaction"),
  /** Document/reference number */
  DocNumber: z.string().max(21).optional().describe("Reference/document number (max 21 chars)"),
  /** Memo printed on check/expense */
  Memo: z.string().max(4000).optional().describe("Printed memo (max 4000 chars)"),
  /** Private internal note */
  PrivateNote: z.string().max(4000).optional().describe("Internal note (max 4000 chars)"),
  /** Global tax calculation mode */
  GlobalTaxCalculation: GlobalTaxCalculationEnum.optional()
    .describe("How tax applies to line amounts"),
  /** Tax detail */
  TxnTaxDetail: TxnTaxDetailSchema.optional().describe("Transaction tax details"),
  /** Exchange rate for multi-currency */
  ExchangeRate: z.number().positive().optional().describe("Currency exchange rate"),
  /** Department/location reference */
  DepartmentRef: ReferenceSchema.optional().describe("Department/location for tracking"),
  /** Is this a credit/refund? (CreditCard only) */
  Credit: z.boolean().optional().describe("True if this is a refund (CreditCard only)"),
  /** Payment method reference */
  PaymentMethodRef: ReferenceSchema.optional().describe("Payment method reference"),
  /** Check/payment reference number */
  PaymentRefNum: z.string().optional().describe("Check number or payment reference"),
});

export type Purchase = z.infer<typeof PurchaseSchema>;

/**
 * Simplified Purchase creation schema (user-friendly)
 * Transforms to full PurchaseSchema format
 */
export const CreatePurchaseInputSchema = z.object({
  /** Transaction date (YYYY-MM-DD) */
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Transaction date in YYYY-MM-DD format (required)"),
  /** Payment type */
  paymentType: PaymentTypeEnum.describe("Payment method: Cash, Check, or CreditCard (required)"),
  /** Payment account ID (Bank or CreditCard account) */
  paymentAccountId: z.string().describe("ID of the Bank or CreditCard account used for payment (required)"),
  /** Payment account name (optional, for reference) */
  paymentAccountName: z.string().optional().describe("Name of the payment account (optional)"),
  /** Expense line items */
  lines: z.array(SimplifiedExpenseLineSchema).min(1)
    .describe("Expense line items (at least one required)"),
  /** Vendor ID */
  vendorId: z.string().optional().describe("Vendor/payee ID"),
  /** Vendor name (alternative to ID - will attempt to resolve) */
  vendorName: z.string().optional().describe("Vendor name (will resolve to ID if possible)"),
  /** Currency code */
  currency: z.string().length(3).optional().describe("ISO 4217 currency code (e.g., 'USD')"),
  /** Printed memo */
  memo: z.string().max(4000).optional().describe("Memo to print on expense"),
  /** Internal note */
  privateNote: z.string().max(4000).optional().describe("Internal private note"),
  /** Reference/document number */
  referenceNumber: z.string().max(21).optional().describe("Reference or document number"),
  /** Tax calculation mode */
  globalTaxCalculation: GlobalTaxCalculationEnum.optional()
    .describe("Tax calculation mode for line amounts"),
  /** Expected total (for validation) */
  totalAmt: z.number().positive().optional()
    .describe("Expected total amount (validated against sum of lines)"),
  /** Is this a refund? */
  isCredit: z.boolean().optional().describe("True for credit card refund"),
  /** Idempotency key to prevent duplicate creation */
  idempotencyKey: z.string().optional()
    .describe("Unique key to prevent duplicate creation on retry"),
});

export type CreatePurchaseInput = z.infer<typeof CreatePurchaseInputSchema>;

/**
 * Purchase update schema
 */
export const UpdatePurchaseInputSchema = z.object({
  /** Purchase ID to update (required) */
  purchaseId: z.string().describe("ID of the purchase to update (required)"),
  /** Fields to update (all optional) */
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("New transaction date"),
  paymentType: PaymentTypeEnum.optional().describe("New payment type"),
  paymentAccountId: z.string().optional().describe("New payment account ID"),
  vendorId: z.string().optional().describe("New vendor ID"),
  vendorName: z.string().optional().describe("New vendor name"),
  memo: z.string().max(4000).optional().describe("New memo"),
  privateNote: z.string().max(4000).optional().describe("New private note"),
  referenceNumber: z.string().max(21).optional().describe("New reference number"),
  globalTaxCalculation: GlobalTaxCalculationEnum.optional().describe("New tax mode"),
  /** Replacement lines (replaces all existing lines) */
  lines: z.array(SimplifiedExpenseLineSchema).min(1).optional()
    .describe("Replacement line items (replaces all existing lines)"),
  totalAmt: z.number().positive().optional()
    .describe("Expected total (validated when lines provided)"),
});

export type UpdatePurchaseInput = z.infer<typeof UpdatePurchaseInputSchema>;

// =============================================================================
// Search Schemas
// =============================================================================

/**
 * Search filter criteria
 */
export const SearchFilterSchema = z.object({
  /** Field name to filter on */
  field: z.string().describe("Field name to filter on"),
  /** Value to match */
  value: z.union([z.string(), z.number(), z.boolean()]).describe("Value to match"),
  /** Comparison operator */
  operator: SearchOperatorEnum.optional().default("=").describe("Comparison operator (default: =)"),
});

/**
 * Advanced search options for purchases
 */
export const SearchPurchasesInputSchema = z.object({
  // Date filters
  /** Start date (inclusive) */
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by start date (YYYY-MM-DD, inclusive)"),
  /** End date (inclusive) */
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by end date (YYYY-MM-DD, inclusive)"),
  
  // Amount filters
  /** Minimum amount */
  minAmount: z.number().optional().describe("Filter by minimum total amount"),
  /** Maximum amount */
  maxAmount: z.number().optional().describe("Filter by maximum total amount"),
  
  // Entity filters
  /** Vendor/Entity ID */
  vendorId: z.string().optional().describe("Filter by vendor ID"),
  /** Payment account ID */
  paymentAccountId: z.string().optional().describe("Filter by payment account ID"),
  /** Payment type */
  paymentType: PaymentTypeEnum.optional().describe("Filter by payment type"),
  
  // Text search
  /** Search in memo/DocNumber */
  text: z.string().optional().describe("Search text in memo or reference number"),
  
  // Raw criteria (for advanced users)
  /** Raw filter criteria (advanced) */
  criteria: z.array(SearchFilterSchema).optional()
    .describe("Additional raw filter criteria"),
  
  // Sorting
  /** Sort ascending by field */
  asc: z.string().optional().describe("Sort ascending by this field"),
  /** Sort descending by field */
  desc: z.string().optional().describe("Sort descending by this field"),
  
  // Pagination
  /** Maximum results to return */
  limit: z.number().int().min(1).max(1000).optional().default(100)
    .describe("Maximum results (1-1000, default 100)"),
  /** Offset for pagination */
  offset: z.number().int().min(0).optional().default(0)
    .describe("Pagination offset (default 0)"),
  
  // Options
  /** Only return count */
  count: z.boolean().optional().describe("Only return count of matching records"),
  /** Fetch all matching records */
  fetchAll: z.boolean().optional().describe("Fetch all matching records (may be slow)"),
});

export type SearchPurchasesInput = z.infer<typeof SearchPurchasesInputSchema>;

// =============================================================================
// Vendor Schemas
// =============================================================================

export const CreateVendorInputSchema = z.object({
  /** Display name (required, must be unique) */
  DisplayName: z.string().min(1).max(500)
    .describe("Unique display name for the vendor (required)"),
  /** Company name */
  CompanyName: z.string().max(500).optional().describe("Company/business name"),
  /** Given/first name */
  GivenName: z.string().max(100).optional().describe("First name"),
  /** Family/last name */
  FamilyName: z.string().max(100).optional().describe("Last name"),
  /** Primary email */
  PrimaryEmailAddr: EmailAddressSchema.optional().describe("Primary email address"),
  /** Primary phone */
  PrimaryPhone: PhoneNumberSchema.optional().describe("Primary phone number"),
  /** Billing address */
  BillAddr: PhysicalAddressSchema.optional().describe("Billing address"),
  /** Website */
  WebAddr: WebAddressSchema.optional().describe("Website URL"),
  /** Account number with vendor */
  AcctNum: z.string().max(100).optional().describe("Account number with this vendor"),
  /** Is 1099 vendor */
  Vendor1099: z.boolean().optional().describe("Is this a 1099 vendor?"),
  /** Active status */
  Active: z.boolean().optional().default(true).describe("Is vendor active?"),
  /** Notes */
  Notes: z.string().max(2000).optional().describe("Internal notes about vendor"),
});

export type CreateVendorInput = z.infer<typeof CreateVendorInputSchema>;

export const UpdateVendorInputSchema = CreateVendorInputSchema.extend({
  /** Vendor ID (required for update) */
  Id: z.string().describe("Vendor ID (required)"),
  /** Sync token (required for update) */
  SyncToken: z.string().describe("Sync token (required)"),
}).partial().required({ Id: true, SyncToken: true, DisplayName: true });

export const SearchVendorsInputSchema = z.object({
  /** Search by display name (partial match) */
  search: z.string().optional().describe("Search vendors by name (partial match)"),
  /** Filter by active status */
  active: z.boolean().optional().describe("Filter by active status"),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional().describe("Raw filter criteria"),
  /** Sort ascending */
  asc: z.string().optional().describe("Sort ascending by field"),
  /** Sort descending */
  desc: z.string().optional().describe("Sort descending by field"),
  /** Limit results */
  limit: z.number().int().min(1).max(1000).optional().default(100),
  /** Offset for pagination */
  offset: z.number().int().min(0).optional().default(0),
  /** Fetch all */
  fetchAll: z.boolean().optional(),
});

// =============================================================================
// Customer Schemas
// =============================================================================

export const CreateCustomerInputSchema = z.object({
  /** Display name (required, must be unique) */
  DisplayName: z.string().min(1).max(500)
    .describe("Unique display name for the customer (required)"),
  /** Company name */
  CompanyName: z.string().max(500).optional().describe("Company/business name"),
  /** Given/first name */
  GivenName: z.string().max(100).optional().describe("First name"),
  /** Family/last name */
  FamilyName: z.string().max(100).optional().describe("Last name"),
  /** Primary email */
  PrimaryEmailAddr: EmailAddressSchema.optional().describe("Primary email address"),
  /** Primary phone */
  PrimaryPhone: PhoneNumberSchema.optional().describe("Primary phone number"),
  /** Billing address */
  BillAddr: PhysicalAddressSchema.optional().describe("Billing address"),
  /** Shipping address */
  ShipAddr: PhysicalAddressSchema.optional().describe("Shipping address"),
  /** Active status */
  Active: z.boolean().optional().default(true).describe("Is customer active?"),
  /** Notes */
  Notes: z.string().max(2000).optional().describe("Internal notes about customer"),
  /** Is this customer taxable? */
  Taxable: z.boolean().optional().describe("Is customer taxable?"),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;

export const UpdateCustomerInputSchema = CreateCustomerInputSchema.extend({
  /** Customer ID (required for update) */
  Id: z.string().describe("Customer ID (required)"),
  /** Sync token (required for update) */
  SyncToken: z.string().describe("Sync token (required)"),
}).partial().required({ Id: true, SyncToken: true });

export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInputSchema>;

export const SearchCustomersInputSchema = z.object({
  /** Search by display name */
  search: z.string().optional().describe("Search customers by name (partial match)"),
  /** Filter by active status */
  active: z.boolean().optional().describe("Filter by active status"),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
  fetchAll: z.boolean().optional(),
});

// =============================================================================
// Account Schemas
// =============================================================================

export const SearchAccountsInputSchema = z.object({
  /** Filter by account type */
  accountType: AccountTypeEnum.optional().describe("Filter by account type"),
  /** Filter by account subtype */
  accountSubType: z.string().optional().describe("Filter by account subtype"),
  /** Search by name */
  search: z.string().optional().describe("Search accounts by name"),
  /** Filter by active status */
  active: z.boolean().optional().describe("Filter by active status"),
  /** Filter by kind (helper for expense/payment accounts) */
  kind: z.enum(["expense_categories", "payment_accounts", "all"]).optional()
    .describe("Filter by account kind: expense_categories, payment_accounts, or all"),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

// =============================================================================
// Tax Code Schemas
// =============================================================================

export const SearchTaxCodesInputSchema = z.object({
  /** Search by name */
  search: z.string().optional().describe("Search tax codes by name"),
  /** Filter by active status */
  active: z.boolean().optional().default(true).describe("Filter by active status"),
  /** Filter by taxable */
  taxable: z.boolean().optional().describe("Filter by taxable status"),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

// =============================================================================
// Attachment Schemas
// =============================================================================

/** Supported entity types for attachments */
export const AttachableEntityTypeEnum = z.enum([
  "Purchase",
  "Invoice", 
  "Bill",
  "Estimate",
  "Vendor",
  "Customer",
  "JournalEntry",
  "Payment",
  "SalesReceipt",
  "CreditMemo",
]).describe("QuickBooks entity type that can have attachments");

export const UploadAttachmentInputSchema = z.object({
  /** Path to the file to upload */
  filePath: z.string().min(1).describe("Path to the file to upload (supports ~ for home directory)"),
  /** Entity type to attach to */
  entityType: AttachableEntityTypeEnum.describe("Type of entity to attach to"),
  /** Entity ID to attach to */
  entityId: z.string().min(1).describe("ID of the entity to attach to"),
  /** Optional note for the attachment */
  note: z.string().max(2000).optional().describe("Note for this attachment"),
});

export type UploadAttachmentInput = z.infer<typeof UploadAttachmentInputSchema>;

export const GetAttachmentsInputSchema = z.object({
  /** Entity type */
  entityType: AttachableEntityTypeEnum.describe("Type of entity"),
  /** Entity ID */
  entityId: z.string().min(1).describe("ID of the entity"),
});

export const DownloadAttachmentInputSchema = z.object({
  /** Attachment ID */
  attachmentId: z.string().min(1).describe("ID of the attachment to download"),
  /** Destination path */
  destinationPath: z.string().min(1)
    .describe("Local path to save the attachment (supports ~ for home directory)"),
});

// =============================================================================
// Invoice Schemas
// =============================================================================

export const InvoiceLineSchema = z.object({
  /** Line amount */
  Amount: z.number().describe("Line amount"),
  /** Line description */
  Description: z.string().max(4000).optional().describe("Line description"),
  /** Detail type */
  DetailType: z.literal("SalesItemLineDetail").default("SalesItemLineDetail"),
  /** Sales item line detail */
  SalesItemLineDetail: z.object({
    /** Item reference */
    ItemRef: ReferenceSchema.describe("Reference to the item"),
    /** Quantity */
    Qty: z.number().positive().optional().describe("Quantity"),
    /** Unit price */
    UnitPrice: z.number().optional().describe("Unit price"),
    /** Tax code */
    TaxCodeRef: ReferenceSchema.optional().describe("Tax code reference"),
  }),
});

export const CreateInvoiceInputSchema = z.object({
  /** Customer reference (required) */
  CustomerRef: ReferenceSchema.describe("Customer reference (required)"),
  /** Line items */
  Line: z.array(InvoiceLineSchema).min(1).describe("Invoice line items"),
  /** Invoice date */
  TxnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Invoice date (YYYY-MM-DD)"),
  /** Due date */
  DueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Payment due date (YYYY-MM-DD)"),
  /** Invoice number */
  DocNumber: z.string().max(21).optional().describe("Invoice number"),
  /** Customer memo */
  CustomerMemo: z.object({
    value: z.string().max(1000),
  }).optional().describe("Memo visible to customer"),
  /** Private note */
  PrivateNote: z.string().max(4000).optional().describe("Internal note"),
  /** Billing email */
  BillEmail: EmailAddressSchema.optional().describe("Email for sending invoice"),
  /** Billing address */
  BillAddr: PhysicalAddressSchema.optional().describe("Billing address"),
  /** Shipping address */
  ShipAddr: PhysicalAddressSchema.optional().describe("Shipping address"),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

/**
 * Schema for updating an existing invoice
 * Extends create schema with required Id and SyncToken, all other fields optional
 */
export const UpdateInvoiceInputSchema = CreateInvoiceInputSchema.extend({
  /** Invoice ID (required for update) */
  Id: z.string().min(1).describe("Invoice ID (required)"),
  /** Sync token (required for update) */
  SyncToken: z.string().describe("Sync token (required)"),
}).partial().required({ Id: true, SyncToken: true });

export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceInputSchema>;

/**
 * Advanced search options for invoices
 */
export const SearchInvoicesInputSchema = z.object({
  // Date filters (TxnDate)
  /** Start date (inclusive) for invoice date */
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by invoice date start (YYYY-MM-DD, inclusive)"),
  /** End date (inclusive) for invoice date */
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by invoice date end (YYYY-MM-DD, inclusive)"),
  
  // Due date filters
  /** Start date (inclusive) for due date */
  dueFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by due date start (YYYY-MM-DD, inclusive)"),
  /** End date (inclusive) for due date */
  dueTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by due date end (YYYY-MM-DD, inclusive)"),
  
  // Amount filters
  /** Minimum total amount */
  amountMin: z.number().optional().describe("Filter by minimum total amount"),
  /** Maximum total amount */
  amountMax: z.number().optional().describe("Filter by maximum total amount"),
  
  // Balance filters (unpaid amounts)
  /** Minimum balance amount */
  balanceMin: z.number().optional().describe("Filter by minimum balance (unpaid) amount"),
  /** Maximum balance amount */
  balanceMax: z.number().optional().describe("Filter by maximum balance (unpaid) amount"),
  
  // Entity filters
  /** Customer ID */
  customerId: z.string().optional().describe("Filter by customer ID"),
  
  // Text search
  /** Search in DocNumber */
  docNumber: z.string().optional().describe("Filter by invoice number"),
  
  // Raw criteria (for advanced users)
  /** Raw filter criteria (advanced) */
  criteria: z.array(SearchFilterSchema).optional()
    .describe("Additional raw filter criteria"),
  
  // Sorting
  /** Sort ascending by field */
  asc: z.string().optional().describe("Sort ascending by this field"),
  /** Sort descending by field */
  desc: z.string().optional().describe("Sort descending by this field"),
  
  // Pagination
  /** Maximum results to return */
  limit: z.number().int().min(1).max(1000).optional()
    .describe("Maximum results (1-1000, default 100)"),
  /** Offset for pagination */
  offset: z.number().int().min(0).optional()
    .describe("Pagination offset (default 0)"),
  
  // Options
  /** Only return count */
  count: z.boolean().optional().describe("Only return count of matching records"),
  /** Fetch all matching records */
  fetchAll: z.boolean().optional().describe("Fetch all matching records (may be slow)"),
});

export type SearchInvoicesInput = z.infer<typeof SearchInvoicesInputSchema>;

// =============================================================================
// Bill Schemas
// =============================================================================

export const BillLineSchema = z.object({
  /** Line amount */
  Amount: z.number().describe("Line amount"),
  /** Detail type */
  DetailType: z.enum(["AccountBasedExpenseLineDetail", "ItemBasedExpenseLineDetail"])
    .describe("Type of line detail"),
  /** Description */
  Description: z.string().max(4000).optional().describe("Line description"),
  /** Account-based detail */
  AccountBasedExpenseLineDetail: AccountBasedExpenseLineDetailSchema.optional(),
  /** Item-based detail */
  ItemBasedExpenseLineDetail: ItemBasedExpenseLineDetailSchema.optional(),
});

export const CreateBillInputSchema = z.object({
  /** Vendor reference (required) */
  VendorRef: ReferenceSchema.describe("Vendor reference (required)"),
  /** Line items (required) */
  Line: z.array(BillLineSchema).min(1).describe("Bill line items"),
  /** Bill date */
  TxnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Bill date (YYYY-MM-DD)"),
  /** Due date */
  DueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Payment due date (YYYY-MM-DD)"),
  /** Reference number */
  DocNumber: z.string().max(21).optional().describe("Bill reference number"),
  /** Memo */
  Memo: z.string().max(4000).optional().describe("Memo"),
  /** Private note */
  PrivateNote: z.string().max(4000).optional().describe("Internal note"),
  /** AP account */
  APAccountRef: ReferenceSchema.optional().describe("Accounts Payable account"),
  /** Global tax calculation */
  GlobalTaxCalculation: GlobalTaxCalculationEnum.optional(),
});

export type CreateBillInput = z.infer<typeof CreateBillInputSchema>;

/**
 * Advanced search options for bills
 */
export const SearchBillsInputSchema = z.object({
  // Date filters
  /** Start date (inclusive) for bill date */
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by start date (YYYY-MM-DD, inclusive)"),
  /** End date (inclusive) for bill date */
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by end date (YYYY-MM-DD, inclusive)"),
  /** Start date (inclusive) for due date */
  dueDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by due date start (YYYY-MM-DD, inclusive)"),
  /** End date (inclusive) for due date */
  dueDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by due date end (YYYY-MM-DD, inclusive)"),
  
  // Amount filters
  /** Minimum total amount */
  amountMin: z.number().optional().describe("Filter by minimum total amount"),
  /** Maximum total amount */
  amountMax: z.number().optional().describe("Filter by maximum total amount"),
  /** Minimum balance amount */
  balanceMin: z.number().optional().describe("Filter by minimum balance amount"),
  /** Maximum balance amount */
  balanceMax: z.number().optional().describe("Filter by maximum balance amount"),
  
  // Entity filters
  /** Vendor ID */
  vendorId: z.string().optional().describe("Filter by vendor ID"),
  
  // Payment status filter (based on Balance)
  /** Payment status: 'Paid', 'Unpaid', or 'PartiallyPaid' */
  paymentStatus: z.enum(["Paid", "Unpaid", "PartiallyPaid"]).optional()
    .describe("Filter by payment status: Paid (Balance=0), Unpaid (Balance=TotalAmt), PartiallyPaid (0<Balance<TotalAmt)"),
  
  // Text search
  /** Search in DocNumber */
  docNumber: z.string().optional().describe("Filter by document/reference number"),
  
  // Raw criteria (for advanced users)
  /** Raw filter criteria (advanced) */
  criteria: z.array(SearchFilterSchema).optional()
    .describe("Additional raw filter criteria"),
  
  // Sorting
  /** Sort ascending by field */
  asc: z.string().optional().describe("Sort ascending by this field"),
  /** Sort descending by field */
  desc: z.string().optional().describe("Sort descending by this field"),
  
  // Pagination
  /** Maximum results to return */
  limit: z.number().int().min(1).max(1000).optional()
    .describe("Maximum results (1-1000, default 100)"),
  /** Offset for pagination */
  offset: z.number().int().min(0).optional()
    .describe("Pagination offset (default 0)"),
  
  // Options
  /** Only return count */
  count: z.boolean().optional().describe("Only return count of matching records"),
  /** Fetch all matching records */
  fetchAll: z.boolean().optional().describe("Fetch all matching records (may be slow)"),
});

export type SearchBillsInput = z.infer<typeof SearchBillsInputSchema>;

// =============================================================================
// Journal Entry Schemas
// =============================================================================

export const JournalEntryLineSchema = z.object({
  /** Line amount */
  Amount: z.number().describe("Line amount (positive number)"),
  /** Detail type */
  DetailType: z.literal("JournalEntryLineDetail").default("JournalEntryLineDetail"),
  /** Description */
  Description: z.string().max(4000).optional(),
  /** Journal entry line detail */
  JournalEntryLineDetail: z.object({
    /** Posting type (Debit or Credit) */
    PostingType: z.enum(["Debit", "Credit"]).describe("Debit or Credit"),
    /** Account reference */
    AccountRef: ReferenceSchema.describe("Account to post to"),
    /** Class reference */
    ClassRef: ReferenceSchema.optional(),
    /** Entity (customer/vendor) reference */
    Entity: z.object({
      EntityRef: ReferenceSchema,
      Type: z.enum(["Customer", "Vendor", "Employee"]).optional(),
    }).optional(),
  }),
});

export const CreateJournalEntryInputSchema = z.object({
  /** Line items (debits must equal credits) */
  Line: z.array(JournalEntryLineSchema).min(2)
    .describe("Journal entry lines (debits must equal credits)"),
  /** Transaction date */
  TxnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Document number */
  DocNumber: z.string().max(21).optional(),
  /** Private note */
  PrivateNote: z.string().max(4000).optional(),
  /** Adjustment flag */
  Adjustment: z.boolean().optional(),
});

export type CreateJournalEntryInput = z.infer<typeof CreateJournalEntryInputSchema>;

export const UpdateJournalEntryInputSchema = z.object({
  /** Journal Entry ID (required for update) */
  Id: z.string().min(1).describe("Journal entry ID (required)"),
  /** Sync token for optimistic locking (required for update) */
  SyncToken: z.string().describe("Sync token for optimistic locking (required)"),
  /** Line items (optional for update - replaces all lines if provided) */
  Line: z.array(JournalEntryLineSchema).min(2).optional()
    .describe("Journal entry lines (debits must equal credits) - replaces ALL existing lines if provided"),
  /** Transaction date */
  TxnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Transaction date in YYYY-MM-DD format"),
  /** Document number */
  DocNumber: z.string().max(21).optional()
    .describe("Reference/document number (max 21 chars)"),
  /** Private note */
  PrivateNote: z.string().max(4000).optional()
    .describe("Internal note (max 4000 chars)"),
  /** Adjustment flag */
  Adjustment: z.boolean().optional()
    .describe("Whether this is an adjusting journal entry"),
});

export type UpdateJournalEntryInput = z.infer<typeof UpdateJournalEntryInputSchema>;

// =============================================================================
// Item Schemas
// =============================================================================

export const CreateItemInputSchema = z.object({
  /** Item name (required) */
  Name: z.string().min(1).max(100).describe("Item name (required)"),
  /** Item type */
  Type: z.enum(["Inventory", "Service", "NonInventory"]).optional()
    .describe("Item type"),
  /** Income account (for sales) */
  IncomeAccountRef: ReferenceSchema.optional().describe("Income account for sales"),
  /** Expense account (for purchases) */
  ExpenseAccountRef: ReferenceSchema.optional().describe("Expense account for purchases"),
  /** Asset account (for inventory) */
  AssetAccountRef: ReferenceSchema.optional().describe("Asset account (inventory items)"),
  /** Description for sales */
  Description: z.string().max(4000).optional(),
  /** Unit price */
  UnitPrice: z.number().optional().describe("Sales price"),
  /** Purchase cost */
  PurchaseCost: z.number().optional().describe("Purchase cost"),
  /** Quantity on hand (inventory) */
  QtyOnHand: z.number().optional().describe("Quantity on hand"),
  /** Is active */
  Active: z.boolean().optional().default(true),
  /** Is taxable */
  Taxable: z.boolean().optional(),
  /** SKU */
  Sku: z.string().max(100).optional(),
});

export type CreateItemInput = z.infer<typeof CreateItemInputSchema>;

/**
 * Schema for updating an existing item
 * Extends create schema with required Id and SyncToken, all other fields optional
 */
export const UpdateItemInputSchema = CreateItemInputSchema.extend({
  /** Item ID (required for update) */
  Id: z.string().min(1).describe("Item ID (required)"),
  /** Sync token for optimistic locking (required for update) */
  SyncToken: z.string().describe("Sync token for optimistic locking (required)"),
}).partial().required({ Id: true, SyncToken: true });

export type UpdateItemInput = z.infer<typeof UpdateItemInputSchema>;

// =============================================================================
// Account Schemas - Create/Update
// =============================================================================

/**
 * Schema for creating a chart of accounts entry
 */
export const CreateAccountInputSchema = z.object({
  /** Account name (required, unique) */
  Name: z.string().min(1).max(100).describe("Account name (required, must be unique)"),
  /** Account type (required) */
  AccountType: AccountTypeEnum.describe("Account type (required)"),
  /** Account subtype */
  AccountSubType: z.string().optional().describe("Account subtype (e.g., 'Checking', 'Savings', 'Advertising')"),
  /** Description */
  Description: z.string().max(4000).optional().describe("Account description"),
  /** Classification */
  Classification: z.enum(["Asset", "Equity", "Expense", "Liability", "Revenue"]).optional()
    .describe("Account classification"),
  /** Is active */
  Active: z.boolean().optional().default(true).describe("Whether account is active"),
  /** Is sub-account */
  SubAccount: z.boolean().optional().describe("Is this a sub-account?"),
  /** Parent account reference (if sub-account) */
  ParentRef: ReferenceSchema.optional().describe("Parent account reference (for sub-accounts)"),
  /** Account number */
  AcctNum: z.string().max(7).optional().describe("User-defined account number"),
});

export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

/**
 * Schema for updating an existing account
 * Extends create schema with required Id and SyncToken, all other fields optional
 */
export const UpdateAccountInputSchema = CreateAccountInputSchema.extend({
  /** Account ID (required for update) */
  Id: z.string().min(1).describe("Account ID (required)"),
  /** Sync token for optimistic locking (required for update) */
  SyncToken: z.string().describe("Sync token for optimistic locking (required)"),
}).partial().required({ Id: true, SyncToken: true });

export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

// =============================================================================
// Employee Schemas
// =============================================================================

export const CreateEmployeeInputSchema = z.object({
  /** Given/first name (required) */
  GivenName: z.string().min(1).max(100).describe("First name (required)"),
  /** Family/last name (required) */
  FamilyName: z.string().min(1).max(100).describe("Last name (required)"),
  /** Display name (auto-generated if not provided) */
  DisplayName: z.string().max(500).optional().describe("Display name"),
  /** Primary email */
  PrimaryEmailAddr: EmailAddressSchema.optional().describe("Primary email"),
  /** Primary phone */
  PrimaryPhone: PhoneNumberSchema.optional().describe("Primary phone"),
  /** Mobile phone */
  Mobile: PhoneNumberSchema.optional().describe("Mobile phone"),
  /** Primary address */
  PrimaryAddr: PhysicalAddressSchema.optional().describe("Primary address"),
  /** SSN (last 4 digits only shown) */
  SSN: z.string().max(11).optional().describe("Social Security Number"),
  /** Employee number */
  EmployeeNumber: z.string().max(100).optional().describe("Employee number"),
  /** Hire date */
  HiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Hire date (YYYY-MM-DD)"),
  /** Release/termination date */
  ReleasedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Release date (YYYY-MM-DD)"),
  /** Active status */
  Active: z.boolean().optional().default(true).describe("Is employee active?"),
  /** Billable time flag */
  BillableTime: z.boolean().optional().describe("Track billable time?"),
  /** Hourly bill rate */
  BillRate: z.number().optional().describe("Hourly bill rate"),
  /** Birth date */
  BirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Birth date (YYYY-MM-DD)"),
  /** Gender */
  Gender: z.enum(["Male", "Female"]).optional().describe("Gender"),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeInputSchema>;

export const UpdateEmployeeInputSchema = CreateEmployeeInputSchema.extend({
  /** Employee ID (required for update) */
  Id: z.string().describe("Employee ID (required)"),
  /** Sync token (required for update) */
  SyncToken: z.string().describe("Sync token (required)"),
}).partial().required({ Id: true, SyncToken: true });

export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeInputSchema>;

export const SearchEmployeesInputSchema = z.object({
  /** Search by name */
  search: z.string().optional().describe("Search employees by name"),
  /** Filter by active status */
  active: z.boolean().optional().describe("Filter by active status"),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

// =============================================================================
// Estimate Schemas
// =============================================================================

export const EstimateLineSchema = z.object({
  /** Line amount */
  Amount: z.number().describe("Line amount"),
  /** Line description */
  Description: z.string().max(4000).optional().describe("Line description"),
  /** Detail type */
  DetailType: z.literal("SalesItemLineDetail").default("SalesItemLineDetail"),
  /** Sales item line detail */
  SalesItemLineDetail: z.object({
    /** Item reference */
    ItemRef: ReferenceSchema.describe("Reference to the item"),
    /** Quantity */
    Qty: z.number().positive().optional().describe("Quantity"),
    /** Unit price */
    UnitPrice: z.number().optional().describe("Unit price"),
    /** Tax code */
    TaxCodeRef: ReferenceSchema.optional().describe("Tax code reference"),
  }),
});

export const CreateEstimateInputSchema = z.object({
  /** Customer reference (required) */
  CustomerRef: ReferenceSchema.describe("Customer reference (required)"),
  /** Line items */
  Line: z.array(EstimateLineSchema).min(1).describe("Estimate line items"),
  /** Estimate date */
  TxnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Estimate date (YYYY-MM-DD)"),
  /** Expiration date */
  ExpirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Expiration date (YYYY-MM-DD)"),
  /** Estimate number */
  DocNumber: z.string().max(21).optional().describe("Estimate number"),
  /** Customer memo */
  CustomerMemo: z.object({
    value: z.string().max(1000),
  }).optional().describe("Memo visible to customer"),
  /** Private note */
  PrivateNote: z.string().max(4000).optional().describe("Internal note"),
  /** Billing email */
  BillEmail: EmailAddressSchema.optional().describe("Email for sending estimate"),
  /** Billing address */
  BillAddr: PhysicalAddressSchema.optional().describe("Billing address"),
  /** Shipping address */
  ShipAddr: PhysicalAddressSchema.optional().describe("Shipping address"),
  /** Estimate status */
  TxnStatus: z.enum(["Pending", "Accepted", "Closed", "Rejected"]).optional()
    .describe("Estimate status"),
  /** Global tax calculation */
  GlobalTaxCalculation: GlobalTaxCalculationEnum.optional(),
});

export type CreateEstimateInput = z.infer<typeof CreateEstimateInputSchema>;

export const UpdateEstimateInputSchema = CreateEstimateInputSchema.extend({
  /** Estimate ID (required for update) */
  Id: z.string().describe("Estimate ID (required)"),
  /** Sync token (required for update) */
  SyncToken: z.string().describe("Sync token (required)"),
}).partial().required({ Id: true, SyncToken: true });

export type UpdateEstimateInput = z.infer<typeof UpdateEstimateInputSchema>;

export const SearchEstimatesInputSchema = z.object({
  // Date filters (TxnDate)
  /** Transaction date range start (inclusive) */
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by transaction start date (YYYY-MM-DD, inclusive)"),
  /** Transaction date range end (inclusive) */
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by transaction end date (YYYY-MM-DD, inclusive)"),

  // Expiration date filters
  /** Expiration date range start (inclusive) */
  expirationFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by expiration start date (YYYY-MM-DD, inclusive)"),
  /** Expiration date range end (inclusive) */
  expirationTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Filter by expiration end date (YYYY-MM-DD, inclusive)"),

  // Amount filters
  /** Minimum total amount */
  amountMin: z.number().optional().describe("Filter by minimum total amount"),
  /** Maximum total amount */
  amountMax: z.number().optional().describe("Filter by maximum total amount"),

  // Entity filters
  /** Customer ID */
  customerId: z.string().optional().describe("Filter by customer ID"),

  // Status filter
  /** Estimate status */
  txnStatus: z.enum(["Pending", "Accepted", "Closed", "Rejected"]).optional()
    .describe("Filter by estimate status (Pending, Accepted, Closed, Rejected)"),

  // Text search (legacy)
  /** Search text in DocNumber or memo */
  search: z.string().optional().describe("Search in estimate number or memo (partial match)"),

  // Raw criteria (for advanced users)
  /** Raw filter criteria (advanced) */
  criteria: z.array(SearchFilterSchema).optional()
    .describe("Additional raw filter criteria"),

  // Sorting
  /** Sort ascending by field */
  asc: z.string().optional().describe("Sort ascending by this field (e.g., 'TxnDate', 'TotalAmt')"),
  /** Sort descending by field */
  desc: z.string().optional().describe("Sort descending by this field (e.g., 'TxnDate', 'TotalAmt')"),

  // Pagination
  /** Maximum results to return */
  limit: z.number().int().min(1).max(1000).optional()
    .describe("Maximum results (1-1000, default 100)"),
  /** Offset for pagination */
  offset: z.number().int().min(0).optional()
    .describe("Pagination offset (default 0)"),

  // Options
  /** Only return count */
  count: z.boolean().optional().describe("Only return count of matching records"),
  /** Fetch all matching records */
  fetchAll: z.boolean().optional().describe("Fetch all matching records (may be slow)"),
});

export type SearchEstimatesInput = z.infer<typeof SearchEstimatesInputSchema>;

// =============================================================================
// Bill Payment Schemas
// =============================================================================

export const BillPaymentLineSchema = z.object({
  /** Amount to pay */
  Amount: z.number().describe("Amount to pay"),
  /** Linked transaction (the bill) */
  LinkedTxn: z.array(z.object({
    /** Transaction ID (Bill ID) */
    TxnId: z.string().describe("Bill ID to pay"),
    /** Transaction type */
    TxnType: z.literal("Bill").default("Bill"),
  })).min(1).describe("Bills to pay"),
});

export const CreateBillPaymentInputSchema = z.object({
  /** Vendor reference (required) */
  VendorRef: ReferenceSchema.describe("Vendor reference (required)"),
  /** Payment lines (bills to pay) */
  Line: z.array(BillPaymentLineSchema).min(1).describe("Bills to pay"),
  /** Total payment amount */
  TotalAmt: z.number().positive().describe("Total payment amount"),
  /** Payment type */
  PayType: z.enum(["Check", "CreditCard"]).describe("Payment type"),
  /** Check payment details (when PayType is Check) */
  CheckPayment: z.object({
    /** Bank account reference */
    BankAccountRef: ReferenceSchema.describe("Bank account for check"),
    /** Check number */
    PrintStatus: z.enum(["NeedToPrint", "PrintComplete"]).optional(),
  }).optional().describe("Check payment details"),
  /** Credit card payment details (when PayType is CreditCard) */
  CreditCardPayment: z.object({
    /** Credit card account reference */
    CCAccountRef: ReferenceSchema.describe("Credit card account"),
  }).optional().describe("Credit card payment details"),
  /** Payment date */
  TxnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe("Payment date (YYYY-MM-DD)"),
  /** Reference number */
  DocNumber: z.string().max(21).optional().describe("Reference number"),
  /** Private note */
  PrivateNote: z.string().max(4000).optional().describe("Internal note"),
  /** AP account reference */
  APAccountRef: ReferenceSchema.optional().describe("AP account reference"),
});

export type CreateBillPaymentInput = z.infer<typeof CreateBillPaymentInputSchema>;

export const UpdateBillPaymentInputSchema = CreateBillPaymentInputSchema.extend({
  /** Bill payment ID (required for update) */
  Id: z.string().describe("Bill payment ID (required)"),
  /** Sync token (required for update) */
  SyncToken: z.string().describe("Sync token (required)"),
}).partial().required({ Id: true, SyncToken: true });

export type UpdateBillPaymentInput = z.infer<typeof UpdateBillPaymentInputSchema>;

// =============================================================================
// Delete/Get Schemas (simple ID-based operations)
// =============================================================================

export const GetByIdInputSchema = z.object({
  /** Entity ID */
  id: z.string().min(1).describe("Entity ID"),
});

export const DeleteInputSchema = z.object({
  /** Entity ID */
  Id: z.string().min(1).describe("Entity ID"),
  /** Sync token */
  SyncToken: z.string().describe("Entity sync token"),
});

// For entities that use the idOrEntity pattern
export const DeleteByIdOrEntitySchema = z.union([
  z.string().describe("Entity ID to delete"),
  z.object({
    Id: z.string(),
    SyncToken: z.string(),
  }).describe("Entity object with Id and SyncToken"),
]);

// =============================================================================
// Generic Search Schema (for entities without specific filters)
// =============================================================================

export const GenericSearchInputSchema = z.object({
  /** Filter criteria */
  criteria: z.array(SearchFilterSchema).optional()
    .describe("Query filters [{field, value, operator?}]"),
  /** Sort ascending by field */
  asc: z.string().optional().describe("Field to sort ascending"),
  /** Sort descending by field */
  desc: z.string().optional().describe("Field to sort descending"),
  /** Max results */
  limit: z.number().int().min(1).max(1000).optional().default(100),
  /** Skip results */
  offset: z.number().int().min(0).optional().default(0),
  /** Count only */
  count: z.boolean().optional().describe("Return count only"),
  /** Fetch all */
  fetchAll: z.boolean().optional().describe("Fetch all results (may be slow)"),
});

export type GenericSearchInput = z.infer<typeof GenericSearchInputSchema>;