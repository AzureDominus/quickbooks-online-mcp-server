/**
 * Bill Payment Schemas
 *
 * Schemas for creating, updating, and searching bill payments in QuickBooks Online.
 */

import { z } from 'zod';
import { ReferenceSchema, SearchFilterSchema, QboIdSchema } from './common.schema.js';

// =============================================================================
// Line Item Schema
// =============================================================================

export const BillPaymentLineSchema = z.object({
  /** Amount to pay */
  Amount: z.number().describe('Amount to pay'),
  /** Linked transaction (the bill) */
  LinkedTxn: z
    .array(
      z.object({
        /** Transaction ID (Bill ID) */
        TxnId: QboIdSchema.describe('Bill ID to pay'),
        /** Transaction type */
        TxnType: z.literal('Bill').default('Bill'),
      })
    )
    .min(1)
    .describe('Bills to pay'),
});

// =============================================================================
// Create/Update Schemas
// =============================================================================

export const CreateBillPaymentInputSchema = z.object({
  /** Vendor reference (required) */
  VendorRef: ReferenceSchema.describe('Vendor reference (required)'),
  /** Payment lines (bills to pay) */
  Line: z.array(BillPaymentLineSchema).min(1).describe('Bills to pay'),
  /** Total payment amount */
  TotalAmt: z.number().positive().describe('Total payment amount'),
  /** Payment type */
  PayType: z.enum(['Check', 'CreditCard']).describe('Payment type'),
  /** Check payment details (when PayType is Check) */
  CheckPayment: z
    .object({
      /** Bank account reference */
      BankAccountRef: ReferenceSchema.describe('Bank account for check'),
      /** Check number */
      PrintStatus: z.enum(['NeedToPrint', 'PrintComplete']).optional(),
    })
    .optional()
    .describe('Check payment details'),
  /** Credit card payment details (when PayType is CreditCard) */
  CreditCardPayment: z
    .object({
      /** Credit card account reference */
      CCAccountRef: ReferenceSchema.describe('Credit card account'),
    })
    .optional()
    .describe('Credit card payment details'),
  /** Payment date */
  TxnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Payment date (YYYY-MM-DD)'),
  /** Reference number */
  DocNumber: z.string().max(21).optional().describe('Reference number'),
  /** Private note */
  PrivateNote: z.string().max(4000).optional().describe('Internal note'),
  /** AP account reference */
  APAccountRef: ReferenceSchema.optional().describe('AP account reference'),
});

export type CreateBillPaymentInput = z.infer<typeof CreateBillPaymentInputSchema>;

export const UpdateBillPaymentInputSchema = CreateBillPaymentInputSchema.extend({
  /** Bill payment ID (required for update) */
  Id: QboIdSchema.describe('Bill payment ID (required)'),
  /** Sync token (required for update) */
  SyncToken: z.string().describe('Sync token (required)'),
})
  .partial()
  .required({ Id: true, SyncToken: true });

export type UpdateBillPaymentInput = z.infer<typeof UpdateBillPaymentInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

export const SearchBillPaymentsInputSchema = z.object({
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

  // Entity filters
  /** Vendor ID */
  vendorId: QboIdSchema.optional().describe('Filter by vendor ID'),

  // Amount filters
  /** Minimum amount */
  amountMin: z.number().optional().describe('Filter by minimum total amount'),
  /** Maximum amount */
  amountMax: z.number().optional().describe('Filter by maximum total amount'),

  // Payment type filter
  /** Payment type */
  payType: z.enum(['Check', 'CreditCard']).optional().describe('Filter by payment type'),

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

export type SearchBillPaymentsInput = z.infer<typeof SearchBillPaymentsInputSchema>;
