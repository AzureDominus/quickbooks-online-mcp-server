/**
 * QuickBooks Online Entity Schemas
 *
 * Comprehensive Zod schemas for QBO API entities based on official Intuit documentation.
 * These schemas provide type-safe validation for all MCP tool inputs.
 *
 * @see https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities
 */

// =============================================================================
// Common Schemas (References, Addresses, Enums, etc.)
// =============================================================================
export {
  // Reference types
  ReferenceSchema,
  CurrencyRefSchema,
  type Reference,

  // Address schemas
  PhysicalAddressSchema,
  EmailAddressSchema,
  PhoneNumberSchema,
  WebAddressSchema,

  // Enums
  PaymentTypeEnum,
  GlobalTaxCalculationEnum,
  LineDetailTypeEnum,
  AccountTypeEnum,
  SearchOperatorEnum,

  // Line detail schemas
  AccountBasedExpenseLineDetailSchema,
  ItemBasedExpenseLineDetailSchema,
  TxnTaxDetailSchema,

  // Search/filter schemas
  SearchFilterSchema,
  GenericSearchInputSchema,
  type GenericSearchInput,

  // Generic ID-based schemas
  GetByIdInputSchema,
  DeleteInputSchema,
  DeleteByIdOrEntitySchema,

  // Attachment schemas
  AttachableEntityTypeEnum,
  UploadAttachmentInputSchema,
  type UploadAttachmentInput,
  GetAttachmentsInputSchema,
  DownloadAttachmentInputSchema,

  // Tax code schemas
  SearchTaxCodesInputSchema,
} from './common.schema.js';

// =============================================================================
// Purchase/Expense Schemas
// =============================================================================
export {
  PurchaseLineSchema,
  SimplifiedExpenseLineSchema,
  PurchaseSchema,
  type Purchase,
  CreatePurchaseInputSchema,
  type CreatePurchaseInput,
  UpdatePurchaseInputSchema,
  type UpdatePurchaseInput,
  SearchPurchasesInputSchema,
  type SearchPurchasesInput,
} from './purchase.schema.js';

// =============================================================================
// Invoice Schemas
// =============================================================================
export {
  InvoiceLineSchema,
  CreateInvoiceInputSchema,
  type CreateInvoiceInput,
  UpdateInvoiceInputSchema,
  type UpdateInvoiceInput,
  SearchInvoicesInputSchema,
  type SearchInvoicesInput,
} from './invoice.schema.js';

// =============================================================================
// Bill Schemas
// =============================================================================
export {
  BillLineSchema,
  CreateBillInputSchema,
  type CreateBillInput,
  UpdateBillInputSchema,
  type UpdateBillInput,
  SearchBillsInputSchema,
  type SearchBillsInput,
} from './bill.schema.js';

// =============================================================================
// Vendor Schemas
// =============================================================================
export {
  CreateVendorInputSchema,
  type CreateVendorInput,
  UpdateVendorInputSchema,
  type UpdateVendorInput,
  SearchVendorsInputSchema,
  type SearchVendorsInput,
} from './vendor.schema.js';

// =============================================================================
// Customer Schemas
// =============================================================================
export {
  CreateCustomerInputSchema,
  type CreateCustomerInput,
  UpdateCustomerInputSchema,
  type UpdateCustomerInput,
  SearchCustomersInputSchema,
  type SearchCustomersInput,
} from './customer.schema.js';

// =============================================================================
// Employee Schemas
// =============================================================================
export {
  CreateEmployeeInputSchema,
  type CreateEmployeeInput,
  UpdateEmployeeInputSchema,
  type UpdateEmployeeInput,
  SearchEmployeesInputSchema,
  type SearchEmployeesInput,
} from './employee.schema.js';

// =============================================================================
// Estimate Schemas
// =============================================================================
export {
  EstimateLineSchema,
  CreateEstimateInputSchema,
  type CreateEstimateInput,
  UpdateEstimateInputSchema,
  type UpdateEstimateInput,
  SearchEstimatesInputSchema,
  type SearchEstimatesInput,
} from './estimate.schema.js';

// =============================================================================
// Item Schemas
// =============================================================================
export {
  CreateItemInputSchema,
  type CreateItemInput,
  UpdateItemInputSchema,
  type UpdateItemInput,
  SearchItemsInputSchema,
  type SearchItemsInput,
} from './item.schema.js';

// =============================================================================
// Account Schemas
// =============================================================================
export {
  CreateAccountInputSchema,
  type CreateAccountInput,
  UpdateAccountInputSchema,
  type UpdateAccountInput,
  SearchAccountsInputSchema,
  type SearchAccountsInput,
} from './account.schema.js';

// =============================================================================
// Journal Entry Schemas
// =============================================================================
export {
  JournalEntryLineSchema,
  CreateJournalEntryInputSchema,
  type CreateJournalEntryInput,
  UpdateJournalEntryInputSchema,
  type UpdateJournalEntryInput,
  SearchJournalEntriesInputSchema,
  type SearchJournalEntriesInput,
} from './journal-entry.schema.js';

// =============================================================================
// Bill Payment Schemas
// =============================================================================
export {
  BillPaymentLineSchema,
  CreateBillPaymentInputSchema,
  type CreateBillPaymentInput,
  UpdateBillPaymentInputSchema,
  type UpdateBillPaymentInput,
  SearchBillPaymentsInputSchema,
  type SearchBillPaymentsInput,
} from './bill-payment.schema.js';
