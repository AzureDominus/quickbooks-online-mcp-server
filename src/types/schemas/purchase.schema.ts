/**
 * Purchase (Expense) Schemas
 *
 * Schemas for creating, updating, and searching purchases/expenses in QuickBooks Online.
 */

import { z } from 'zod';
import {
  ReferenceSchema,
  CurrencyRefSchema,
  PaymentTypeEnum,
  GlobalTaxCalculationEnum,
  AccountBasedExpenseLineDetailSchema,
  ItemBasedExpenseLineDetailSchema,
  TxnTaxDetailSchema,
  SearchFilterSchema,
  QboIdSchema,
} from './common.schema.js';

// =============================================================================
// Line Item Schemas
// =============================================================================

/**
 * Generic line item for Purchase/Expense transactions
 */
export const PurchaseLineSchema = z.object({
  /** Unique identifier for this line (for updates) */
  Id: QboIdSchema.optional().describe('Line ID (required for updates)'),
  /** Line number for ordering */
  LineNum: z.number().int().positive().optional().describe('Line number'),
  /** Line amount (positive value) */
  Amount: z.number().describe('Line amount (positive number)'),
  /** Description of the line item */
  Description: z.string().max(4000).optional().describe('Line description (max 4000 chars)'),
  /** Type of line detail - determines which detail object to use */
  DetailType: z
    .enum(['AccountBasedExpenseLineDetail', 'ItemBasedExpenseLineDetail'])
    .describe('Type of line: AccountBasedExpenseLineDetail or ItemBasedExpenseLineDetail'),
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
  amount: z.number().positive().describe('Line amount (positive number, required)'),
  /** Expense account/category ID */
  expenseAccountId: QboIdSchema.describe('ID of the expense account/category (required)'),
  /** Expense account name (optional, for reference) */
  expenseAccountName: z.string().optional().describe('Name of the expense account (optional)'),
  /** Line description */
  description: z.string().max(4000).optional().describe('Line description'),
  /** Tax code ID */
  taxCodeId: QboIdSchema.optional().describe('Tax code ID for this line'),
  /** Customer ID for billable expenses */
  customerId: QboIdSchema.optional().describe('Customer ID to make this billable'),
  /** Class ID for tracking */
  classId: QboIdSchema.optional().describe('Class ID for departmental tracking'),
  /** Billable status */
  billable: z.boolean().optional().describe('Whether this expense is billable to a customer'),
});

// =============================================================================
// Purchase Entity Schema
// =============================================================================

/**
 * Full Purchase (Expense) entity schema
 * Used for creating expenses/purchases in QBO
 */
export const PurchaseSchema = z.object({
  // Identity (for updates)
  /** Purchase ID (required for updates) */
  Id: QboIdSchema.optional().describe('Purchase ID (required for update/delete)'),
  /** Sync token for optimistic locking (required for updates) */
  SyncToken: z.string().optional().describe('Sync token (required for updates)'),

  // Required fields
  /** Payment type (required) */
  PaymentType: PaymentTypeEnum.describe('Payment method type (required)'),
  /** Reference to payment account - Bank or CreditCard (required) */
  AccountRef: ReferenceSchema.describe(
    'Payment account reference - Bank or CreditCard account (required)'
  ),
  /** Line items (at least one required) */
  Line: z.array(PurchaseLineSchema).min(1).describe('Expense line items (at least one required)'),

  // Optional fields
  /** Transaction date (YYYY-MM-DD format) */
  TxnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Transaction date in YYYY-MM-DD format'),
  /** Vendor/payee reference */
  EntityRef: ReferenceSchema.optional().describe('Vendor/payee reference'),
  /** Currency reference (for multi-currency) */
  CurrencyRef: CurrencyRefSchema.optional().describe('Currency for this transaction'),
  /** Document/reference number */
  DocNumber: z.string().max(21).optional().describe('Reference/document number (max 21 chars)'),
  /** Memo printed on check/expense */
  Memo: z.string().max(4000).optional().describe('Printed memo (max 4000 chars)'),
  /** Private internal note */
  PrivateNote: z.string().max(4000).optional().describe('Internal note (max 4000 chars)'),
  /** Global tax calculation mode */
  GlobalTaxCalculation: GlobalTaxCalculationEnum.optional().describe(
    'How tax applies to line amounts'
  ),
  /** Tax detail */
  TxnTaxDetail: TxnTaxDetailSchema.optional().describe('Transaction tax details'),
  /** Exchange rate for multi-currency */
  ExchangeRate: z.number().positive().optional().describe('Currency exchange rate'),
  /** Department/location reference */
  DepartmentRef: ReferenceSchema.optional().describe('Department/location for tracking'),
  /** Is this a credit/refund? (CreditCard only) */
  Credit: z.boolean().optional().describe('True if this is a refund (CreditCard only)'),
  /** Payment method reference */
  PaymentMethodRef: ReferenceSchema.optional().describe('Payment method reference'),
  /** Check/payment reference number */
  PaymentRefNum: z.string().optional().describe('Check number or payment reference'),
});

export type Purchase = z.infer<typeof PurchaseSchema>;

// =============================================================================
// Create/Update Schemas
// =============================================================================

/**
 * Simplified Purchase creation schema (user-friendly)
 * Transforms to full PurchaseSchema format
 */
export const CreatePurchaseInputSchema = z.object({
  /** Transaction date (YYYY-MM-DD) */
  txnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('Transaction date in YYYY-MM-DD format (required)'),
  /** Payment type */
  paymentType: PaymentTypeEnum.describe('Payment method: Cash, Check, or CreditCard (required)'),
  /** Payment account ID (Bank or CreditCard account) */
  paymentAccountId: z
    .string()
    .describe('ID of the Bank or CreditCard account used for payment (required)'),
  /** Payment account name (optional, for reference) */
  paymentAccountName: z.string().optional().describe('Name of the payment account (optional)'),
  /** Expense line items */
  lines: z
    .array(SimplifiedExpenseLineSchema)
    .min(1)
    .describe('Expense line items (at least one required)'),
  /** Vendor ID */
  vendorId: QboIdSchema.optional().describe('Vendor/payee ID'),
  /** Vendor name (alternative to ID - will attempt to resolve) */
  vendorName: z.string().optional().describe('Vendor name (will resolve to ID if possible)'),
  /** Currency code */
  currency: z.string().length(3).optional().describe("ISO 4217 currency code (e.g., 'USD')"),
  /** Printed memo */
  memo: z.string().max(4000).optional().describe('Memo to print on expense'),
  /** Internal note */
  privateNote: z.string().max(4000).optional().describe('Internal private note'),
  /** Reference/document number */
  referenceNumber: z.string().max(21).optional().describe('Reference or document number'),
  /** Tax calculation mode */
  globalTaxCalculation: GlobalTaxCalculationEnum.optional().describe(
    'Tax calculation mode for line amounts'
  ),
  /** Expected total (for validation) */
  totalAmt: z
    .number()
    .positive()
    .optional()
    .describe('Expected total amount (validated against sum of lines)'),
  /** Is this a refund? */
  isCredit: z.boolean().optional().describe('True for credit card refund'),
  /** Idempotency key to prevent duplicate creation */
  idempotencyKey: z
    .string()
    .optional()
    .describe('Unique key to prevent duplicate creation on retry'),
});

export type CreatePurchaseInput = z.infer<typeof CreatePurchaseInputSchema>;

/**
 * Purchase update schema
 */
export const UpdatePurchaseInputSchema = z.object({
  /** Purchase ID to update (required) */
  purchaseId: QboIdSchema.describe('ID of the purchase to update (required)'),
  /** Fields to update (all optional) */
  txnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('New transaction date'),
  paymentType: PaymentTypeEnum.optional().describe('New payment type'),
  paymentAccountId: QboIdSchema.optional().describe('New payment account ID'),
  vendorId: QboIdSchema.optional().describe('New vendor ID'),
  vendorName: z.string().optional().describe('New vendor name'),
  memo: z.string().max(4000).optional().describe('New memo'),
  privateNote: z.string().max(4000).optional().describe('New private note'),
  referenceNumber: z.string().max(21).optional().describe('New reference number'),
  globalTaxCalculation: GlobalTaxCalculationEnum.optional().describe('New tax mode'),
  /** Replacement lines (replaces all existing lines) */
  lines: z
    .array(SimplifiedExpenseLineSchema)
    .min(1)
    .optional()
    .describe('Replacement line items (replaces all existing lines)'),
  totalAmt: z
    .number()
    .positive()
    .optional()
    .describe('Expected total (validated when lines provided)'),
});

export type UpdatePurchaseInput = z.infer<typeof UpdatePurchaseInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

/**
 * Advanced search options for purchases
 */
export const SearchPurchasesInputSchema = z.object({
  // Date filters
  /** Start date (inclusive) */
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by start date (YYYY-MM-DD, inclusive)'),
  /** End date (inclusive) */
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by end date (YYYY-MM-DD, inclusive)'),

  // Amount filters
  /** Minimum amount */
  minAmount: z.number().optional().describe('Filter by minimum total amount'),
  /** Maximum amount */
  maxAmount: z.number().optional().describe('Filter by maximum total amount'),

  // Entity filters
  /** Vendor/Entity ID */
  vendorId: QboIdSchema.optional().describe('Filter by vendor ID'),
  /** Payment account ID */
  paymentAccountId: QboIdSchema.optional().describe('Filter by payment account ID'),
  /** Payment type */
  paymentType: PaymentTypeEnum.optional().describe('Filter by payment type'),

  // Text search
  /** Search in memo/DocNumber */
  text: z.string().optional().describe('Search text in memo or reference number'),

  // Raw criteria (for advanced users)
  /** Raw filter criteria (advanced) */
  criteria: z.array(SearchFilterSchema).optional().describe('Additional raw filter criteria'),

  // Sorting
  /** Sort ascending by field */
  asc: z.string().optional().describe('Sort ascending by this field'),
  /** Sort descending by field */
  desc: z.string().optional().describe('Sort descending by this field'),

  // Pagination
  /** Maximum results to return */
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .default(100)
    .describe('Maximum results (1-1000, default 100)'),
  /** Offset for pagination */
  offset: z.number().int().min(0).optional().default(0).describe('Pagination offset (default 0)'),

  // Options
  /** Only return count */
  count: z.boolean().optional().describe('Only return count of matching records'),
  /** Fetch all matching records */
  fetchAll: z.boolean().optional().describe('Fetch all matching records (may be slow)'),
});

export type SearchPurchasesInput = z.infer<typeof SearchPurchasesInputSchema>;
