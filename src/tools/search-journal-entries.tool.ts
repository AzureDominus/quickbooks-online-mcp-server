import { searchQuickbooksJournalEntries } from '../handlers/search-quickbooks-journal-entries.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

// Define the tool metadata
const toolName = 'search_journal_entries';
const toolDescription = `Search journal entries in QuickBooks Online with advanced filtering.

Journal entries are used to record debits and credits to accounts, typically for adjusting entries, 
accruals, reclassifications, or other accounting adjustments.

FILTER OPTIONS:
- txnDateFrom/txnDateTo: Filter by transaction date range (YYYY-MM-DD)
- totalAmtMin/totalAmtMax: Filter by total amount range
- docNumber: Filter by document/reference number (use % for LIKE matching)
- adjustment: Filter by adjustment flag (true/false)

SEARCHABLE FIELDS (for advanced criteria):
- Id: Unique identifier for the journal entry
- DocNumber: Document/reference number
- TxnDate: Transaction date (YYYY-MM-DD)
- TotalAmt: Total amount of the journal entry
- Adjustment: Whether this is an adjustment entry (true/false)
- PrivateNote: Internal notes/memo
- MetaData.CreateTime: Record creation timestamp
- MetaData.LastUpdatedTime: Last modification timestamp

OPERATORS:
- "=" : Exact match (default)
- "<", ">", "<=", ">=" : Numeric/date comparisons
- "LIKE" : Partial text match (use % as wildcard)
- "IN" : Match any in list (comma-separated values)

SORTING:
- asc: Sort ascending by field name
- desc: Sort descending by field name

PAGINATION:
- limit: Maximum results to return (1-1000, default 100)
- offset: Number of records to skip

OPTIONS:
- count: If true, only return count of matching records
- fetchAll: If true, fetch all matching records (may be slow)

Example - Find journal entries in January 2026 over $1000:
{
  "txnDateFrom": "2026-01-01",
  "txnDateTo": "2026-01-31",
  "totalAmtMin": 1000,
  "desc": "TxnDate",
  "limit": 100
}

Example - Find adjustment entries:
{
  "adjustment": true,
  "desc": "TotalAmt"
}`;

// Allowed fields for JournalEntry entity filtering
const ALLOWED_FILTER_FIELDS = [
  'Id',
  'DocNumber',
  'TxnDate',
  'TotalAmt',
  'Adjustment',
  'PrivateNote',
  'MetaData.CreateTime',
  'MetaData.LastUpdatedTime',
] as const;

const ALLOWED_SORT_FIELDS = [
  'Id',
  'DocNumber',
  'TxnDate',
  'TotalAmt',
  'MetaData.CreateTime',
  'MetaData.LastUpdatedTime',
] as const;

// Criterion schema for typed search criteria
const CriterionSchema = z.object({
  field: z
    .enum(ALLOWED_FILTER_FIELDS)
    .describe(`Field to filter on. Allowed: ${ALLOWED_FILTER_FIELDS.join(', ')}`),
  value: z.union([z.string(), z.boolean()]).describe('Value to match'),
  operator: z
    .enum(['=', '<', '>', '<=', '>=', 'LIKE', 'IN'])
    .optional()
    .default('=')
    .describe('Comparison operator (default: =)'),
});

// Define the expected input schema for searching journal entries
const toolSchema = z.object({
  // Convenience filter parameters
  /** Start date (inclusive) for transaction date */
  txnDateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by start date (YYYY-MM-DD, inclusive)'),
  /** End date (inclusive) for transaction date */
  txnDateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Filter by end date (YYYY-MM-DD, inclusive)'),
  /** Minimum total amount */
  totalAmtMin: z.number().optional().describe('Filter by minimum total amount'),
  /** Maximum total amount */
  totalAmtMax: z.number().optional().describe('Filter by maximum total amount'),
  /** Document/reference number filter */
  docNumber: z
    .string()
    .optional()
    .describe('Filter by document/reference number (use % for LIKE matching)'),
  /** Filter by adjustment flag */
  adjustment: z
    .boolean()
    .optional()
    .describe('Filter by adjustment flag (true = adjustment entries only)'),
  // Advanced criteria for complex queries
  criteria: z
    .array(CriterionSchema)
    .optional()
    .describe('Additional filter criteria for advanced queries'),
  asc: z
    .enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort ascending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(', ')}`),
  desc: z
    .enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort descending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(', ')}`),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum results to return (1-1000, default 100)'),
  offset: z.number().int().min(0).optional().describe('Number of records to skip for pagination'),
  count: z.boolean().optional().describe('If true, only return count of matching records'),
  fetchAll: z.boolean().optional().describe('If true, fetch all matching records (may be slow)'),
});

/**
 * Build search criteria from convenience filter parameters
 */
function buildJournalEntrySearchCriteria(
  input: ToolParams
): Array<{ field: string; value: string | boolean; operator?: string }> {
  const criteria: Array<{ field: string; value: string | boolean; operator?: string }> = [];

  // Transaction date range filters
  if (input.txnDateFrom) {
    criteria.push({ field: 'TxnDate', value: input.txnDateFrom, operator: '>=' });
  }
  if (input.txnDateTo) {
    criteria.push({ field: 'TxnDate', value: input.txnDateTo, operator: '<=' });
  }

  // Amount range filters
  if (input.totalAmtMin !== undefined) {
    criteria.push({ field: 'TotalAmt', value: input.totalAmtMin.toString(), operator: '>=' });
  }
  if (input.totalAmtMax !== undefined) {
    criteria.push({ field: 'TotalAmt', value: input.totalAmtMax.toString(), operator: '<=' });
  }

  // Document number filter
  if (input.docNumber !== undefined) {
    const operator = input.docNumber.includes('%') ? 'LIKE' : '=';
    criteria.push({ field: 'DocNumber', value: input.docNumber, operator });
  }

  // Adjustment flag filter
  if (input.adjustment !== undefined) {
    criteria.push({ field: 'Adjustment', value: input.adjustment, operator: '=' });
  }

  return criteria;
}

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: { params?: ToolParams } & ToolParams) => {
  const startTime = Date.now();
  // Handle both wrapped params and direct args
  const input = args.params ?? args;

  logToolRequest(toolName, input);

  try {
    // Build criteria from convenience filter parameters
    const convenienceFilters = buildJournalEntrySearchCriteria(input);

    // Merge convenience filters with any advanced criteria
    const allCriteria = [...convenienceFilters, ...(input.criteria || [])];

    // Build search params
    const searchParams = {
      criteria: allCriteria.length > 0 ? allCriteria : undefined,
      asc: input.asc,
      desc: input.desc,
      limit: input.limit,
      offset: input.offset,
      count: input.count,
      fetchAll: input.fetchAll,
    };

    logger.debug('Built journal entry search criteria', {
      convenienceFiltersCount: convenienceFilters.length,
      totalCriteriaCount: allCriteria.length,
    });

    const response = await searchQuickbooksJournalEntries(searchParams);

    if (response.isError) {
      logger.error(
        'Failed to search journal entries',
        new Error(response.error || 'Unknown error')
      );
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: 'text' as const, text: `Error searching journal entries: ${response.error}` },
        ],
      };
    }

    const results = response.result;
    const resultCount = Array.isArray(results)
      ? results.length
      : typeof results === 'number'
        ? results
        : 0;

    logger.info('Journal entry search completed', {
      resultCount,
      limit: input.limit,
      offset: input.offset,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    if (input.count && typeof results === 'number') {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count: results }) }],
      };
    }

    // Return a single JSON payload.
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ count: resultCount, journalEntries: results }),
        },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in search_journal_entries', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
};

export const SearchJournalEntriesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
