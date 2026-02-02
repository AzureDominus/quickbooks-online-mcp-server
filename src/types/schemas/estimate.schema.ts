/**
 * Estimate Schemas
 *
 * Schemas for creating, updating, and searching estimates in QuickBooks Online.
 */

import { z } from 'zod';
import {
  ReferenceSchema,
  EmailAddressSchema,
  PhysicalAddressSchema,
  GlobalTaxCalculationEnum,
  SearchFilterSchema,
  QboIdSchema,
} from './common.schema.js';

// =============================================================================
// Line Item Schema
// =============================================================================

export const EstimateLineSchema = z.object({
  /** Line amount */
  Amount: z.number().describe('Line amount'),
  /** Line description */
  Description: z.string().max(4000).optional().describe('Line description'),
  /** Detail type */
  DetailType: z.literal('SalesItemLineDetail').default('SalesItemLineDetail'),
  /** Sales item line detail */
  SalesItemLineDetail: z.object({
    /** Item reference */
    ItemRef: ReferenceSchema.describe('Reference to the item'),
    /** Quantity */
    Qty: z.number().positive().optional().describe('Quantity'),
    /** Unit price */
    UnitPrice: z.number().optional().describe('Unit price'),
    /** Tax code */
    TaxCodeRef: ReferenceSchema.optional().describe('Tax code reference'),
  }),
});

// =============================================================================
// Create/Update Schemas
// =============================================================================

export const CreateEstimateInputSchema = z.object({
  /** Customer reference (required) */
  CustomerRef: ReferenceSchema.describe('Customer reference (required)'),
  /** Line items */
  Line: z.array(EstimateLineSchema).min(1).describe('Estimate line items'),
  /** Estimate date */
  TxnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Estimate date (YYYY-MM-DD)'),
  /** Expiration date */
  ExpirationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Expiration date (YYYY-MM-DD)'),
  /** Estimate number */
  DocNumber: z.string().max(21).optional().describe('Estimate number'),
  /** Customer memo */
  CustomerMemo: z
    .object({
      value: z.string().max(1000),
    })
    .optional()
    .describe('Memo visible to customer'),
  /** Private note */
  PrivateNote: z.string().max(4000).optional().describe('Internal note'),
  /** Billing email */
  BillEmail: EmailAddressSchema.optional().describe('Email for sending estimate'),
  /** Billing address */
  BillAddr: PhysicalAddressSchema.optional().describe('Billing address'),
  /** Shipping address */
  ShipAddr: PhysicalAddressSchema.optional().describe('Shipping address'),
  /** Estimate status */
  TxnStatus: z
    .enum(['Pending', 'Accepted', 'Closed', 'Rejected'])
    .optional()
    .describe('Estimate status'),
  /** Global tax calculation */
  GlobalTaxCalculation: GlobalTaxCalculationEnum.optional(),
});

export type CreateEstimateInput = z.infer<typeof CreateEstimateInputSchema>;

export const UpdateEstimateInputSchema = CreateEstimateInputSchema.extend({
  /** Estimate ID (required for update) */
  Id: QboIdSchema.describe('Estimate ID (required)'),
  /** Sync token (required for update) */
  SyncToken: z.string().describe('Sync token (required)'),
})
  .partial()
  .required({ Id: true, SyncToken: true });

export type UpdateEstimateInput = z.infer<typeof UpdateEstimateInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

export const SearchEstimatesInputSchema = z.object({
  // Date filters (TxnDate)
  /** Transaction date range start (inclusive) */
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by transaction start date (YYYY-MM-DD, inclusive)'),
  /** Transaction date range end (inclusive) */
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by transaction end date (YYYY-MM-DD, inclusive)'),

  // Expiration date filters
  /** Expiration date range start (inclusive) */
  expirationFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by expiration start date (YYYY-MM-DD, inclusive)'),
  /** Expiration date range end (inclusive) */
  expirationTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by expiration end date (YYYY-MM-DD, inclusive)'),

  // Amount filters
  /** Minimum total amount */
  amountMin: z.number().optional().describe('Filter by minimum total amount'),
  /** Maximum total amount */
  amountMax: z.number().optional().describe('Filter by maximum total amount'),

  // Entity filters
  /** Customer ID */
  customerId: QboIdSchema.optional().describe('Filter by customer ID'),

  // Status filter
  /** Estimate status */
  txnStatus: z
    .enum(['Pending', 'Accepted', 'Closed', 'Rejected'])
    .optional()
    .describe('Filter by estimate status (Pending, Accepted, Closed, Rejected)'),

  // Text search (legacy)
  /** Search text in DocNumber or memo */
  search: z.string().optional().describe('Search in estimate number or memo (partial match)'),

  // Raw criteria (for advanced users)
  /** Raw filter criteria (advanced) */
  criteria: z.array(SearchFilterSchema).optional().describe('Additional raw filter criteria'),

  // Sorting
  /** Sort ascending by field */
  asc: z.string().optional().describe("Sort ascending by this field (e.g., 'TxnDate', 'TotalAmt')"),
  /** Sort descending by field */
  desc: z
    .string()
    .optional()
    .describe("Sort descending by this field (e.g., 'TxnDate', 'TotalAmt')"),

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

export type SearchEstimatesInput = z.infer<typeof SearchEstimatesInputSchema>;
