import { searchQuickbooksEmployees } from '../handlers/search-quickbooks-employees.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import {
  buildDateRangeFilter,
  buildLikeFilter,
  buildEqualityFilter,
  buildStringFilter,
  mergeFilters,
  SearchFilter,
} from '../helpers/search-filters.js';
import { createMCPErrorResponse } from '../helpers/tool-error.js';

// Define the tool metadata
const toolName = 'search_employees';
const toolDescription = `Search employees in QuickBooks Online with advanced filtering.

Employees are individuals who work for the company and may receive paychecks.

FILTER OPTIONS:
- active: Filter by active status (true/false)
- givenName: Filter by first name (supports LIKE with % wildcard)
- familyName: Filter by last name (supports LIKE with % wildcard)
- displayName: Filter by display name (supports LIKE with % wildcard)
- hiredDateFrom/hiredDateTo: Filter by hired date range (YYYY-MM-DD)
- releasedDateFrom/releasedDateTo: Filter by released date range (YYYY-MM-DD)
- email: Filter by primary email address

SEARCHABLE FIELDS (for advanced criteria):
- Id: Unique identifier for the employee
- GivenName: First name
- MiddleName: Middle name
- FamilyName: Last name
- DisplayName: Display name (combination of name parts)
- PrintOnCheckName: Name to print on checks
- Active: Whether employee is active (true/false)
- PrimaryPhone: Primary phone number
- Mobile: Mobile phone number
- PrimaryEmailAddr: Primary email address
- HiredDate: Date employee was hired (YYYY-MM-DD)
- ReleasedDate: Date employee was released (YYYY-MM-DD)
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
- limit: Maximum results to return
- offset: Number of records to skip

Example - Find active employees:
{
  "active": true,
  "asc": "DisplayName",
  "limit": 100
}

Example - Find employees hired in 2025:
{
  "hiredDateFrom": "2025-01-01",
  "hiredDateTo": "2025-12-31",
  "active": true
}

Example - Find employees by last name:
{
  "familyName": "Smith%",
  "asc": "FamilyName"
}`;

// Allowed fields for Employee entity filtering
const ALLOWED_FILTER_FIELDS = [
  'Id',
  'GivenName',
  'MiddleName',
  'FamilyName',
  'DisplayName',
  'PrintOnCheckName',
  'Active',
  'PrimaryPhone',
  'Mobile',
  'PrimaryEmailAddr',
  'HiredDate',
  'ReleasedDate',
  'MetaData.CreateTime',
  'MetaData.LastUpdatedTime',
] as const;

const ALLOWED_SORT_FIELDS = [
  'Id',
  'GivenName',
  'FamilyName',
  'DisplayName',
  'HiredDate',
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

// Define the expected input schema for searching employees
const toolSchema = z.object({
  // Convenience filter parameters
  active: z.boolean().optional().describe('Filter by active status (true/false)'),
  givenName: z
    .string()
    .optional()
    .describe('Filter by first name (use % as wildcard for partial match)'),
  familyName: z
    .string()
    .optional()
    .describe('Filter by last name (use % as wildcard for partial match)'),
  displayName: z
    .string()
    .optional()
    .describe('Filter by display name (use % as wildcard for partial match)'),
  hiredDateFrom: z
    .string()
    .optional()
    .describe('Filter employees hired on or after this date (YYYY-MM-DD)'),
  hiredDateTo: z
    .string()
    .optional()
    .describe('Filter employees hired on or before this date (YYYY-MM-DD)'),
  releasedDateFrom: z
    .string()
    .optional()
    .describe('Filter employees released on or after this date (YYYY-MM-DD)'),
  releasedDateTo: z
    .string()
    .optional()
    .describe('Filter employees released on or before this date (YYYY-MM-DD)'),
  email: z.string().optional().describe('Filter by primary email address'),
  // Advanced criteria for complex queries
  criteria: z
    .array(CriterionSchema)
    .optional()
    .describe('Advanced filter criteria for complex queries'),
  // Sorting
  asc: z
    .enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort ascending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(', ')}`),
  desc: z
    .enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort descending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(', ')}`),
  // Pagination
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum results to return (1-1000)'),
  offset: z.number().int().min(0).optional().describe('Number of records to skip for pagination'),
  count: z.boolean().optional().describe('If true, only return count of matching records'),
  fetchAll: z.boolean().optional().describe('If true, fetch all matching records (may be slow)'),
});

type ToolParams = z.infer<typeof toolSchema>;

/**
 * Build search filters from convenience parameters
 */
function buildEmployeeSearchFilters(input: ToolParams): SearchFilter[] {
  return mergeFilters(
    // Active status filter
    buildEqualityFilter('Active', input.active),
    // Name filters with LIKE support
    buildLikeFilter('GivenName', input.givenName),
    buildLikeFilter('FamilyName', input.familyName),
    buildLikeFilter('DisplayName', input.displayName),
    // Date range filters
    buildDateRangeFilter('HiredDate', input.hiredDateFrom, input.hiredDateTo),
    buildDateRangeFilter('ReleasedDate', input.releasedDateFrom, input.releasedDateTo),
    // Email filter
    buildStringFilter('PrimaryEmailAddr', input.email)
  );
}

// Define the tool handler
const toolHandler = async (args: { params?: ToolParams } & ToolParams) => {
  const startTime = Date.now();
  // Handle both wrapped params and direct args
  const input = args.params ?? args;

  logToolRequest(toolName, input);

  try {
    // Build criteria from convenience parameters
    const convenienceFilters = buildEmployeeSearchFilters(input);

    // Merge with any advanced criteria if provided
    let searchParams: any;

    if (input.criteria && input.criteria.length > 0) {
      // User provided advanced criteria - merge with convenience filters
      const advancedFilters = input.criteria.map((c) => ({
        field: c.field,
        value: c.value,
        operator: c.operator || '=',
      }));
      searchParams = {
        filters: [...convenienceFilters, ...advancedFilters],
        asc: input.asc,
        desc: input.desc,
        limit: input.limit,
        offset: input.offset,
        count: input.count,
        fetchAll: input.fetchAll,
      };
    } else if (convenienceFilters.length > 0) {
      // Only convenience filters
      searchParams = {
        filters: convenienceFilters,
        asc: input.asc,
        desc: input.desc,
        limit: input.limit,
        offset: input.offset,
        count: input.count,
        fetchAll: input.fetchAll,
      };
    } else {
      // No filters - just options
      searchParams = {
        asc: input.asc,
        desc: input.desc,
        limit: input.limit,
        offset: input.offset,
        count: input.count,
        fetchAll: input.fetchAll,
      };
    }

    const response = await searchQuickbooksEmployees(searchParams);

    if (response.isError) {
      logger.error('Failed to search employees', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error searching employees: ${response.error}` }],
      };
    }

    // Handle count-only response
    if (input.count && typeof response.result === 'number') {
      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count: response.result }) }],
      };
    }

    // Handler now returns the extracted array directly
    const results = response.result || [];
    const resultArray = Array.isArray(results) ? results : [results];

    logger.info('Employee search completed', {
      resultCount: resultArray.length,
      limit: input.limit,
      offset: input.offset,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    // Build response with filter info
    const responseData = {
      employees: resultArray,
      count: resultArray.length,
      pagination: {
        limit: input.limit || 100,
        offset: input.offset || 0,
        hasMore: resultArray.length === (input.limit || 100),
      },
      filters: {
        active: input.active,
        givenName: input.givenName,
        familyName: input.familyName,
        displayName: input.displayName,
        hiredDateFrom: input.hiredDateFrom,
        hiredDateTo: input.hiredDateTo,
        releasedDateFrom: input.releasedDateFrom,
        releasedDateTo: input.releasedDateTo,
        email: input.email,
      },
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(responseData) }],
    };
  } catch (error) {
    logger.error('Unexpected error in search_employees', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return createMCPErrorResponse(error, 'searching employees');
  }
};

export const SearchEmployeesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
