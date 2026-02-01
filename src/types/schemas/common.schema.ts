/**
 * Common QuickBooks Online Schemas
 *
 * Shared schemas used across multiple entity types:
 * - Reference types (AccountRef, VendorRef, etc.)
 * - Address schemas (Physical, Email, Phone, Web)
 * - Enums (PaymentType, AccountType, etc.)
 * - Search/filter schemas
 */

import { z } from 'zod';

// =============================================================================
// Common Reference Types
// =============================================================================

/**
 * Reference type used throughout QBO API for linking entities
 * Examples: AccountRef, VendorRef, CustomerRef, ItemRef, etc.
 */
export const ReferenceSchema = z.object({
  /** The ID of the referenced entity (required) */
  value: z.string().describe('The ID of the referenced entity'),
  /** Display name of the entity (optional, for readability) */
  name: z.string().optional().describe('Display name of the referenced entity'),
});

export type Reference = z.infer<typeof ReferenceSchema>;

/**
 * Currency reference for multi-currency transactions
 */
export const CurrencyRefSchema = z.object({
  value: z.string().describe("ISO 4217 currency code (e.g., 'USD', 'CAD', 'EUR')"),
  name: z.string().optional().describe('Currency name'),
});

// =============================================================================
// Address Schemas
// =============================================================================

export const PhysicalAddressSchema = z.object({
  Line1: z.string().optional().describe('Street address line 1'),
  Line2: z.string().optional().describe('Street address line 2'),
  Line3: z.string().optional().describe('Street address line 3'),
  Line4: z.string().optional().describe('Street address line 4'),
  Line5: z.string().optional().describe('Street address line 5'),
  City: z.string().optional().describe('City name'),
  Country: z.string().optional().describe('Country name or code'),
  CountrySubDivisionCode: z.string().optional().describe("State/Province code (e.g., 'CA', 'ON')"),
  PostalCode: z.string().optional().describe('Postal/ZIP code'),
  Lat: z.string().optional().describe('Latitude coordinate'),
  Long: z.string().optional().describe('Longitude coordinate'),
});

export const EmailAddressSchema = z.object({
  Address: z.string().email().optional().describe('Email address'),
});

export const PhoneNumberSchema = z.object({
  FreeFormNumber: z.string().optional().describe('Phone number in free-form format'),
});

export const WebAddressSchema = z.object({
  URI: z.string().url().optional().describe('Website URL'),
});

// =============================================================================
// Enums
// =============================================================================

/** Payment type for Purchase transactions */
export const PaymentTypeEnum = z
  .enum(['Cash', 'Check', 'CreditCard'])
  .describe('Payment method type: Cash (not supported in QBW), Check, or CreditCard');

/** Global tax calculation mode */
export const GlobalTaxCalculationEnum = z
  .enum([
    'TaxExcluded', // Line amounts are before tax (tax added on top)
    'TaxInclusive', // Line amounts already include tax (tax extracted)
    'NotApplicable', // No tax calculation
  ])
  .describe(
    'How tax applies to line amounts: TaxExcluded (amounts before tax), TaxInclusive (amounts include tax), NotApplicable (no tax)'
  );

/** Line detail types for transaction lines */
export const LineDetailTypeEnum = z
  .enum([
    'AccountBasedExpenseLineDetail',
    'ItemBasedExpenseLineDetail',
    'SalesItemLineDetail',
    'GroupLineDetail',
    'DescriptionOnly',
    'DiscountLineDetail',
    'SubTotalLineDetail',
    'TaxLineDetail',
    'JournalEntryLineDetail',
    'PaymentLineDetail',
    'DepositLineDetail',
  ])
  .describe('Type of line detail');

/** Account types */
export const AccountTypeEnum = z.enum([
  'Bank',
  'Other Current Asset',
  'Fixed Asset',
  'Other Asset',
  'Accounts Receivable',
  'Equity',
  'Expense',
  'Other Expense',
  'Cost of Goods Sold',
  'Accounts Payable',
  'Credit Card',
  'Long Term Liability',
  'Other Current Liability',
  'Income',
  'Other Income',
]);

/** Search comparison operators */
export const SearchOperatorEnum = z
  .enum([
    '=', // Equals
    '<', // Less than
    '>', // Greater than
    '<=', // Less than or equal
    '>=', // Greater than or equal
    'LIKE', // Pattern matching (use % for wildcard)
    'IN', // In a list of values
  ])
  .describe('Comparison operator for search queries');

// =============================================================================
// Line Detail Schemas (shared across transactions)
// =============================================================================

/**
 * Account-based expense line detail
 * Used when categorizing expenses by account (expense category)
 */
export const AccountBasedExpenseLineDetailSchema = z.object({
  /** Reference to the expense account/category */
  AccountRef: ReferenceSchema.describe('Reference to the expense account (required)'),
  /** Reference to a customer for billable expenses */
  CustomerRef: ReferenceSchema.optional().describe('Customer to bill this expense to'),
  /** Reference to a class for tracking */
  ClassRef: ReferenceSchema.optional().describe('Class for departmental tracking'),
  /** Reference to a tax code */
  TaxCodeRef: ReferenceSchema.optional().describe('Tax code for this line'),
  /** Amount including tax (for tax-inclusive mode) */
  TaxInclusiveAmt: z.number().optional().describe('Amount including tax'),
  /** Whether this line is billable to a customer */
  BillableStatus: z
    .enum(['Billable', 'NotBillable', 'HasBeenBilled'])
    .optional()
    .describe('Billable status of this expense line'),
  /** Markup percentage for billable expenses */
  MarkupInfo: z
    .object({
      Percent: z.number().optional(),
      MarkUpIncomeAccountRef: ReferenceSchema.optional(),
    })
    .optional()
    .describe('Markup information for billable items'),
});

/**
 * Item-based expense line detail
 * Used when purchasing specific items/products
 */
export const ItemBasedExpenseLineDetailSchema = z.object({
  /** Reference to the item being purchased */
  ItemRef: ReferenceSchema.describe('Reference to the item (required)'),
  /** Reference to a customer for billable expenses */
  CustomerRef: ReferenceSchema.optional().describe('Customer to bill this expense to'),
  /** Reference to a class for tracking */
  ClassRef: ReferenceSchema.optional().describe('Class for departmental tracking'),
  /** Reference to a tax code */
  TaxCodeRef: ReferenceSchema.optional().describe('Tax code for this line'),
  /** Quantity of items */
  Qty: z.number().positive().optional().describe('Quantity of items'),
  /** Unit price per item */
  UnitPrice: z.number().optional().describe('Unit price per item'),
  /** Whether this line is billable */
  BillableStatus: z
    .enum(['Billable', 'NotBillable', 'HasBeenBilled'])
    .optional()
    .describe('Billable status'),
});

/**
 * Tax detail for transactions
 */
export const TxnTaxDetailSchema = z.object({
  /** Total tax amount */
  TotalTax: z.number().optional().describe('Total tax amount'),
  /** Reference to a tax code */
  TxnTaxCodeRef: ReferenceSchema.optional().describe('Transaction-level tax code'),
  /** Individual tax lines */
  TaxLine: z
    .array(
      z.object({
        Amount: z.number().optional(),
        DetailType: z.literal('TaxLineDetail').optional(),
        TaxLineDetail: z
          .object({
            TaxRateRef: ReferenceSchema.optional(),
            PercentBased: z.boolean().optional(),
            TaxPercent: z.number().optional(),
            NetAmountTaxable: z.number().optional(),
          })
          .optional(),
      })
    )
    .optional()
    .describe('Tax line breakdown'),
});

// =============================================================================
// Search Schemas
// =============================================================================

/**
 * Search filter criteria
 */
export const SearchFilterSchema = z.object({
  /** Field name to filter on */
  field: z.string().describe('Field name to filter on'),
  /** Value to match */
  value: z.union([z.string(), z.number(), z.boolean()]).describe('Value to match'),
  /** Comparison operator */
  operator: SearchOperatorEnum.optional().default('=').describe('Comparison operator (default: =)'),
});

// =============================================================================
// Generic Schemas
// =============================================================================

/**
 * Generic search schema (for entities without specific filters)
 */
export const GenericSearchInputSchema = z.object({
  /** Filter criteria */
  criteria: z
    .array(SearchFilterSchema)
    .optional()
    .describe('Query filters [{field, value, operator?}]'),
  /** Sort ascending by field */
  asc: z.string().optional().describe('Field to sort ascending'),
  /** Sort descending by field */
  desc: z.string().optional().describe('Field to sort descending'),
  /** Max results */
  limit: z.number().int().min(1).max(1000).optional().default(100),
  /** Skip results */
  offset: z.number().int().min(0).optional().default(0),
  /** Count only */
  count: z.boolean().optional().describe('Return count only'),
  /** Fetch all */
  fetchAll: z.boolean().optional().describe('Fetch all results (may be slow)'),
});

export type GenericSearchInput = z.infer<typeof GenericSearchInputSchema>;

// =============================================================================
// Delete/Get Schemas (simple ID-based operations)
// =============================================================================

export const GetByIdInputSchema = z.object({
  /** Entity ID */
  id: z.string().min(1).describe('Entity ID'),
});

export const DeleteInputSchema = z.object({
  /** Entity ID */
  Id: z.string().min(1).describe('Entity ID'),
  /** Sync token */
  SyncToken: z.string().describe('Entity sync token'),
});

// For entities that use the idOrEntity pattern
export const DeleteByIdOrEntitySchema = z.union([
  z.string().describe('Entity ID to delete'),
  z
    .object({
      Id: z.string(),
      SyncToken: z.string(),
    })
    .describe('Entity object with Id and SyncToken'),
]);

// =============================================================================
// Attachment Schemas
// =============================================================================

/** Supported entity types for attachments */
export const AttachableEntityTypeEnum = z
  .enum([
    'Purchase',
    'Invoice',
    'Bill',
    'Estimate',
    'Vendor',
    'Customer',
    'JournalEntry',
    'Payment',
    'SalesReceipt',
    'CreditMemo',
  ])
  .describe('QuickBooks entity type that can have attachments');

export const UploadAttachmentInputSchema = z.object({
  /** Path to the file to upload */
  filePath: z
    .string()
    .min(1)
    .describe('Path to the file to upload (supports ~ for home directory)'),
  /** Entity type to attach to */
  entityType: AttachableEntityTypeEnum.describe('Type of entity to attach to'),
  /** Entity ID to attach to */
  entityId: z.string().min(1).describe('ID of the entity to attach to'),
  /** Optional note for the attachment */
  note: z.string().max(2000).optional().describe('Note for this attachment'),
});

export type UploadAttachmentInput = z.infer<typeof UploadAttachmentInputSchema>;

export const GetAttachmentsInputSchema = z.object({
  /** Entity type */
  entityType: AttachableEntityTypeEnum.describe('Type of entity'),
  /** Entity ID */
  entityId: z.string().min(1).describe('ID of the entity'),
});

export const DownloadAttachmentInputSchema = z.object({
  /** Attachment ID */
  attachmentId: z.string().min(1).describe('ID of the attachment to download'),
  /** Destination path */
  destinationPath: z
    .string()
    .min(1)
    .describe('Local path to save the attachment (supports ~ for home directory)'),
});

// =============================================================================
// Tax Code Schemas
// =============================================================================

export const SearchTaxCodesInputSchema = z.object({
  /** Search by name */
  search: z.string().optional().describe('Search tax codes by name'),
  /** Filter by active status */
  active: z.boolean().optional().default(true).describe('Filter by active status'),
  /** Filter by taxable */
  taxable: z.boolean().optional().describe('Filter by taxable status'),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});
