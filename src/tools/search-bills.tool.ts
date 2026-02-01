import { searchQuickbooksBills } from '../handlers/search-quickbooks-bills.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { SearchBillsInputSchema, type SearchBillsInput } from '../types/qbo-schemas.js';
import { buildBillSearchCriteria, transformBillFromQBO } from '../helpers/transform.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'search_bills';
const toolDescription = `Search bills in QuickBooks Online with advanced filtering.

Supports filtering by date range, due date range, amount range, balance range, vendor, payment status, and document number.
Returns a paginated list of matching bills with key details including vendor, amounts, and payment status.

FILTER OPTIONS:
- dateFrom/dateTo: Filter by bill date range (YYYY-MM-DD)
- dueDateFrom/dueDateTo: Filter by due date range (YYYY-MM-DD)
- amountMin/amountMax: Filter by total amount range
- balanceMin/balanceMax: Filter by balance amount range
- vendorId: Filter by exact vendor ID
- paymentStatus: Filter by payment status ('Paid', 'Unpaid', 'PartiallyPaid')
- docNumber: Filter by document/reference number

SORTING:
- asc: Sort ascending by field (e.g., 'TxnDate', 'TotalAmt', 'DueDate', 'Balance')
- desc: Sort descending by field

PAGINATION:
- limit: Maximum results to return (1-1000, default 100)
- offset: Number of records to skip (for pagination)

OPTIONS:
- count: If true, only return count of matching records
- fetchAll: If true, fetch all matching records (may be slow)

Example - Find unpaid bills due in January 2026 over $500:
{
  "dueDateFrom": "2026-01-01",
  "dueDateTo": "2026-01-31",
  "amountMin": 500,
  "paymentStatus": "Unpaid",
  "desc": "TotalAmt",
  "limit": 50
}`;

// Use the properly typed schema
const toolSchema = SearchBillsInputSchema;

// Define the tool handler
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args as SearchBillsInput;

  logToolRequest(toolName, input);

  try {
    // Build search criteria from input
    const { criteria, options } = buildBillSearchCriteria(input);

    logger.debug('Built bill search criteria', {
      criteriaCount: criteria.length,
      options,
    });

    // Combine criteria and options for the handler
    const searchParams = {
      criteria,
      ...options,
    };

    const response = await searchQuickbooksBills(searchParams);

    if (response.isError) {
      logger.error('Failed to search bills', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error searching bills: ${response.error}` }],
      };
    }

    // Handle count-only response
    if (input.count && typeof response.result === 'number') {
      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count: response.result }) }],
      };
    }

    // Transform results to user-friendly format
    // Note: handler already extracts QueryResponse.Bill, so result is the array directly
    const bills = response.result || [];
    const billArray = Array.isArray(bills) ? bills : [bills];

    // Filter for PartiallyPaid if needed (QBO can't distinguish partial payments in query)
    let transformedResults = billArray.map(transformBillFromQBO);

    if (input.paymentStatus === 'PartiallyPaid') {
      transformedResults = transformedResults.filter(
        (bill) => bill.paymentStatus === 'PartiallyPaid'
      );
    }

    logger.info('Bill search completed', {
      resultCount: transformedResults.length,
      limit: input.limit,
      offset: input.offset,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    // Build response with pagination info
    const responseData = {
      bills: transformedResults,
      count: transformedResults.length,
      pagination: {
        limit: input.limit || 100,
        offset: input.offset || 0,
        hasMore: transformedResults.length === (input.limit || 100),
      },
      filters: {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        dueDateFrom: input.dueDateFrom,
        dueDateTo: input.dueDateTo,
        amountMin: input.amountMin,
        amountMax: input.amountMax,
        balanceMin: input.balanceMin,
        balanceMax: input.balanceMax,
        vendorId: input.vendorId,
        paymentStatus: input.paymentStatus,
        docNumber: input.docNumber,
      },
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(responseData) }],
    };
  } catch (error) {
    logger.error('Unexpected error in search_bills', error);
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

export const SearchBillsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
