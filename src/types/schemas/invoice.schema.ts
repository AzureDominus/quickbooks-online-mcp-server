/**
 * Invoice Schemas
 *
 * Schemas for creating, updating, and searching invoices in QuickBooks Online.
 */

import { z } from 'zod';
import {
  ReferenceSchema,
  EmailAddressSchema,
  PhysicalAddressSchema,
  SearchFilterSchema,
  QboIdSchema,
  QboIdRequiredSchema,
} from './common.schema.js';

// =============================================================================
// Line Item Schema
// =============================================================================

export const InvoiceLineSchema = z.object({
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

export const CreateInvoiceInputSchema = z.object({
  /** Customer reference (required) */
  CustomerRef: ReferenceSchema.describe('Customer reference (required)'),
  /** Line items */
  Line: z.array(InvoiceLineSchema).min(1).describe('Invoice line items'),
  /** Invoice date */
  TxnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Invoice date (YYYY-MM-DD)'),
  /** Due date */
  DueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Payment due date (YYYY-MM-DD)'),
  /** Invoice number */
  DocNumber: z.string().max(21).optional().describe('Invoice number'),
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
  BillEmail: EmailAddressSchema.optional().describe('Email for sending invoice'),
  /** Billing address */
  BillAddr: PhysicalAddressSchema.optional().describe('Billing address'),
  /** Shipping address */
  ShipAddr: PhysicalAddressSchema.optional().describe('Shipping address'),
});

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInputSchema>;

/**
 * Schema for updating an existing invoice
 * Extends create schema with required Id and SyncToken, all other fields optional
 */
export const UpdateInvoiceInputSchema = CreateInvoiceInputSchema.extend({
  /** Invoice ID (required for update) */
  Id: QboIdRequiredSchema.describe('Invoice ID (required)'),
  /** Sync token (required for update) */
  SyncToken: z.string().describe('Sync token (required)'),
})
  .partial()
  .required({ Id: true, SyncToken: true });

export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

/**
 * Advanced search options for invoices
 */
export const SearchInvoicesInputSchema = z.object({
  // Date filters (TxnDate)
  /** Start date (inclusive) for invoice date */
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by invoice date start (YYYY-MM-DD, inclusive)'),
  /** End date (inclusive) for invoice date */
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by invoice date end (YYYY-MM-DD, inclusive)'),

  // Due date filters
  /** Start date (inclusive) for due date */
  dueFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by due date start (YYYY-MM-DD, inclusive)'),
  /** End date (inclusive) for due date */
  dueTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by due date end (YYYY-MM-DD, inclusive)'),

  // Amount filters
  /** Minimum total amount */
  amountMin: z.number().optional().describe('Filter by minimum total amount'),
  /** Maximum total amount */
  amountMax: z.number().optional().describe('Filter by maximum total amount'),

  // Balance filters (unpaid amounts)
  /** Minimum balance amount */
  balanceMin: z.number().optional().describe('Filter by minimum balance (unpaid) amount'),
  /** Maximum balance amount */
  balanceMax: z.number().optional().describe('Filter by maximum balance (unpaid) amount'),

  // Entity filters
  /** Customer ID */
  customerId: QboIdSchema.optional().describe('Filter by customer ID'),

  // Text search
  /** Search in DocNumber */
  docNumber: z.string().optional().describe('Filter by invoice number'),

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

export type SearchInvoicesInput = z.infer<typeof SearchInvoicesInputSchema>;
