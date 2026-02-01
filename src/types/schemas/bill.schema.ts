/**
 * Bill Schemas
 *
 * Schemas for creating, updating, and searching bills in QuickBooks Online.
 */

import { z } from 'zod';
import {
  ReferenceSchema,
  GlobalTaxCalculationEnum,
  AccountBasedExpenseLineDetailSchema,
  ItemBasedExpenseLineDetailSchema,
  SearchFilterSchema,
  QboIdSchema,
  QboIdRequiredSchema,
} from './common.schema.js';

// =============================================================================
// Line Item Schema
// =============================================================================

export const BillLineSchema = z.object({
  /** Line amount */
  Amount: z.number().describe('Line amount'),
  /** Detail type */
  DetailType: z
    .enum(['AccountBasedExpenseLineDetail', 'ItemBasedExpenseLineDetail'])
    .describe('Type of line detail'),
  /** Description */
  Description: z.string().max(4000).optional().describe('Line description'),
  /** Account-based detail */
  AccountBasedExpenseLineDetail: AccountBasedExpenseLineDetailSchema.optional(),
  /** Item-based detail */
  ItemBasedExpenseLineDetail: ItemBasedExpenseLineDetailSchema.optional(),
});

// =============================================================================
// Create/Update Schemas
// =============================================================================

export const CreateBillInputSchema = z.object({
  /** Vendor reference (required) */
  VendorRef: ReferenceSchema.describe('Vendor reference (required)'),
  /** Line items (required) */
  Line: z.array(BillLineSchema).min(1).describe('Bill line items'),
  /** Bill date */
  TxnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Bill date (YYYY-MM-DD)'),
  /** Due date */
  DueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Payment due date (YYYY-MM-DD)'),
  /** Reference number */
  DocNumber: z.string().max(21).optional().describe('Bill reference number'),
  /** Memo */
  Memo: z.string().max(4000).optional().describe('Memo'),
  /** Private note */
  PrivateNote: z.string().max(4000).optional().describe('Internal note'),
  /** AP account */
  APAccountRef: ReferenceSchema.optional().describe('Accounts Payable account'),
  /** Global tax calculation */
  GlobalTaxCalculation: GlobalTaxCalculationEnum.optional(),
});

export type CreateBillInput = z.infer<typeof CreateBillInputSchema>;

/**
 * Schema for updating an existing bill
 * Extends create schema with required Id and SyncToken, all other fields optional
 */
export const UpdateBillInputSchema = CreateBillInputSchema.extend({
  /** Bill ID (required for update) */
  Id: QboIdRequiredSchema.describe('Bill ID (required)'),
  /** Sync token (required for update) */
  SyncToken: z.string().describe('Sync token (required)'),
})
  .partial()
  .required({ Id: true, SyncToken: true });

export type UpdateBillInput = z.infer<typeof UpdateBillInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

/**
 * Advanced search options for bills
 */
export const SearchBillsInputSchema = z.object({
  // Date filters
  /** Start date (inclusive) for bill date */
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by start date (YYYY-MM-DD, inclusive)'),
  /** End date (inclusive) for bill date */
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by end date (YYYY-MM-DD, inclusive)'),
  /** Start date (inclusive) for due date */
  dueDateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by due date start (YYYY-MM-DD, inclusive)'),
  /** End date (inclusive) for due date */
  dueDateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by due date end (YYYY-MM-DD, inclusive)'),

  // Amount filters
  /** Minimum total amount */
  amountMin: z.number().optional().describe('Filter by minimum total amount'),
  /** Maximum total amount */
  amountMax: z.number().optional().describe('Filter by maximum total amount'),
  /** Minimum balance amount */
  balanceMin: z.number().optional().describe('Filter by minimum balance amount'),
  /** Maximum balance amount */
  balanceMax: z.number().optional().describe('Filter by maximum balance amount'),

  // Entity filters
  /** Vendor ID */
  vendorId: QboIdSchema.optional().describe('Filter by vendor ID'),

  // Payment status filter (based on Balance)
  /** Payment status: 'Paid', 'Unpaid', or 'PartiallyPaid' */
  paymentStatus: z
    .enum(['Paid', 'Unpaid', 'PartiallyPaid'])
    .optional()
    .describe(
      'Filter by payment status: Paid (Balance=0), Unpaid (Balance=TotalAmt), PartiallyPaid (0<Balance<TotalAmt)'
    ),

  // Text search
  /** Search in DocNumber */
  docNumber: z.string().optional().describe('Filter by document/reference number'),

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
    .describe('Maximum results (1-1000, default 100)'),
  /** Offset for pagination */
  offset: z.number().int().min(0).optional().describe('Pagination offset (default 0)'),

  // Options
  /** Only return count */
  count: z.boolean().optional().describe('Only return count of matching records'),
  /** Fetch all matching records */
  fetchAll: z.boolean().optional().describe('Fetch all matching records (may be slow)'),
});

export type SearchBillsInput = z.infer<typeof SearchBillsInputSchema>;
