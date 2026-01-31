import { searchQuickbooksEstimates } from "../handlers/search-quickbooks-estimates.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { SearchEstimatesInputSchema, type SearchEstimatesInput } from "../types/qbo-schemas.js";
import { buildEstimateSearchCriteria } from "../helpers/transform.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "search_estimates";
const toolDescription = `Search estimates in QuickBooks Online with advanced filtering.

Supports filtering by date range, expiration date range, amount range, customer, and status.
Returns a paginated list of matching estimates with key details.

FILTER OPTIONS:
- dateFrom/dateTo: Filter by transaction date range (YYYY-MM-DD)
- expirationFrom/expirationTo: Filter by expiration date range (YYYY-MM-DD)
- amountMin/amountMax: Filter by total amount range
- customerId: Filter by exact customer ID
- txnStatus: Filter by status ('Pending', 'Accepted', 'Closed', 'Rejected')
- search: Search text in estimate number (partial match)

SORTING:
- asc: Sort ascending by field (e.g., 'TxnDate', 'TotalAmt')
- desc: Sort descending by field

PAGINATION:
- limit: Maximum results to return (1-1000, default 100)
- offset: Number of records to skip (for pagination)

OPTIONS:
- count: If true, only return count of matching records
- fetchAll: If true, fetch all matching records (may be slow)

Example - Find pending estimates over $1000 in January 2026:
{
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31",
  "amountMin": 1000,
  "txnStatus": "Pending",
  "desc": "TotalAmt",
  "limit": 50
}`;

// Use the properly typed schema
const toolSchema = SearchEstimatesInputSchema;

// Define the tool handler
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args as SearchEstimatesInput;
  
  logToolRequest(toolName, input);

  try {
    // Build search criteria from input
    const { criteria, options } = buildEstimateSearchCriteria(input);
    
    logger.debug('Built estimate search criteria', { 
      criteriaCount: criteria.length, 
      options,
    });

    // Combine criteria and options for the handler
    const searchParams = {
      criteria,
      ...options,
    };

    const response = await searchQuickbooksEstimates(searchParams);

    if (response.isError) {
      logger.error('Failed to search estimates', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error searching estimates: ${response.error}` },
        ],
      };
    }

    // Handle count-only response
    if (input.count && typeof response.result === 'number') {
      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Found ${response.result} matching estimates` },
        ],
      };
    }

    // Get estimates from response (handler already extracts from QueryResponse)
    const estimates = response.result || [];
    const estimateArray = Array.isArray(estimates) ? estimates : [estimates];
    
    logger.info('Estimate search completed', {
      resultCount: estimateArray.length,
      limit: input.limit,
      offset: input.offset,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    // Build response with pagination info
    const responseData = {
      estimates: estimateArray,
      count: estimateArray.length,
      pagination: {
        limit: input.limit || 100,
        offset: input.offset || 0,
        hasMore: estimateArray.length === (input.limit || 100),
      },
      filters: {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        expirationFrom: input.expirationFrom,
        expirationTo: input.expirationTo,
        amountMin: input.amountMin,
        amountMax: input.amountMax,
        customerId: input.customerId,
        txnStatus: input.txnStatus,
        search: input.search,
      },
    };

    return {
      content: [
        { type: "text" as const, text: `Found ${estimateArray.length} estimates:` },
        { type: "text" as const, text: JSON.stringify(responseData, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in search_estimates', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const SearchEstimatesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 