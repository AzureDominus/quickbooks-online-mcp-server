/**
 * Journal Entry Schemas
 *
 * Schemas for creating, updating, and searching journal entries in QuickBooks Online.
 */

import { z } from 'zod';
import { ReferenceSchema, SearchFilterSchema, QboIdRequiredSchema } from './common.schema.js';

// =============================================================================
// Line Item Schema
// =============================================================================

export const JournalEntryLineSchema = z.object({
  /** Line amount */
  Amount: z.number().describe('Line amount (positive number)'),
  /** Detail type */
  DetailType: z.literal('JournalEntryLineDetail').default('JournalEntryLineDetail'),
  /** Description */
  Description: z.string().max(4000).optional(),
  /** Journal entry line detail */
  JournalEntryLineDetail: z.object({
    /** Posting type (Debit or Credit) */
    PostingType: z.enum(['Debit', 'Credit']).describe('Debit or Credit'),
    /** Account reference */
    AccountRef: ReferenceSchema.describe('Account to post to'),
    /** Class reference */
    ClassRef: ReferenceSchema.optional(),
    /** Entity (customer/vendor) reference */
    Entity: z
      .object({
        EntityRef: ReferenceSchema,
        Type: z.enum(['Customer', 'Vendor', 'Employee']).optional(),
      })
      .optional(),
  }),
});

// =============================================================================
// Create/Update Schemas
// =============================================================================

export const CreateJournalEntryInputSchema = z.object({
  /** Line items (debits must equal credits) */
  Line: z
    .array(JournalEntryLineSchema)
    .min(2)
    .describe('Journal entry lines (debits must equal credits)'),
  /** Transaction date */
  TxnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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
  Id: QboIdRequiredSchema.describe('Journal entry ID (required)'),
  /** Sync token for optimistic locking (required for update) */
  SyncToken: z.string().describe('Sync token for optimistic locking (required)'),
  /** Line items (optional for update - replaces all lines if provided) */
  Line: z
    .array(JournalEntryLineSchema)
    .min(2)
    .optional()
    .describe(
      'Journal entry lines (debits must equal credits) - replaces ALL existing lines if provided'
    ),
  /** Transaction date */
  TxnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Transaction date in YYYY-MM-DD format'),
  /** Document number */
  DocNumber: z.string().max(21).optional().describe('Reference/document number (max 21 chars)'),
  /** Private note */
  PrivateNote: z.string().max(4000).optional().describe('Internal note (max 4000 chars)'),
  /** Adjustment flag */
  Adjustment: z.boolean().optional().describe('Whether this is an adjusting journal entry'),
});

export type UpdateJournalEntryInput = z.infer<typeof UpdateJournalEntryInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

export const SearchJournalEntriesInputSchema = z.object({
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

  // Text search
  /** Search in DocNumber */
  docNumber: z.string().optional().describe('Filter by document number'),

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

export type SearchJournalEntriesInput = z.infer<typeof SearchJournalEntriesInputSchema>;
