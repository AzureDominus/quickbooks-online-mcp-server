import { searchQuickbooksPurchases } from "../handlers/search-quickbooks-purchases.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { SearchPurchasesInputSchema, type SearchPurchasesInput } from "../types/qbo-schemas.js";
import { buildPurchaseSearchCriteria, transformPurchaseFromQBO } from "../helpers/transform.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "search_purchases";
const toolDescription = `Search expense/purchase transactions in QuickBooks Online with advanced filtering.

Supports filtering by date range, amount range, vendor, payment account, payment type, and text search.
Returns a paginated list of matching expenses with key details.

FILTER OPTIONS:
- dateFrom/dateTo: Filter by transaction date range (YYYY-MM-DD)
- minAmount/maxAmount: Filter by total amount range
- vendorId: Filter by exact vendor ID
- paymentAccountId: Filter by payment account (bank/credit card) ID
- paymentType: Filter by payment type ('Cash', 'Check', 'CreditCard')
- text: Search text in memo field (partial match)

SORTING:
- asc: Sort ascending by field (e.g., 'TxnDate', 'TotalAmt')
- desc: Sort descending by field

PAGINATION:
- limit: Maximum results to return (1-1000, default 100)
- offset: Number of records to skip (for pagination)

OPTIONS:
- count: If true, only return count of matching records
- fetchAll: If true, fetch all matching records (may be slow)

Example - Find credit card expenses over $100 in January 2026:
{
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31",
  "minAmount": 100,
  "paymentType": "CreditCard",
  "desc": "TotalAmt",
  "limit": 50
}`;

// Use the properly typed schema - wrap in object to match expected structure
const toolSchema = SearchPurchasesInputSchema;

// Define the tool handler - MCP SDK passes parsed args directly
const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  // Args are passed directly as the schema result
  const input = args as SearchPurchasesInput;
  
  logToolRequest(toolName, input);

  try {
    // Build search criteria from input
    const { criteria, options } = buildPurchaseSearchCriteria(input);
    
    logger.debug('Built search criteria', { 
      criteriaCount: criteria.length, 
      options,
    });

    // Combine criteria and options for the handler
    const searchParams = {
      criteria,
      ...options,
    };

    const response = await searchQuickbooksPurchases(searchParams);

    if (response.isError) {
      logger.error('Failed to search purchases', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error searching purchases: ${response.error}` },
        ],
      };
    }

    // Handle count-only response
    if (input.count && typeof response.result === 'number') {
      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Found ${response.result} matching purchases` },
        ],
      };
    }

    // Transform results to user-friendly format
    const purchases = response.result?.QueryResponse?.Purchase || response.result || [];
    const purchaseArray = Array.isArray(purchases) ? purchases : [purchases];
    
    const transformedResults = purchaseArray.map(transformPurchaseFromQBO);
    
    logger.info('Purchase search completed', {
      resultCount: transformedResults.length,
      limit: input.limit,
      offset: input.offset,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    // Build response with pagination info
    const responseData = {
      purchases: transformedResults,
      count: transformedResults.length,
      pagination: {
        limit: input.limit || 100,
        offset: input.offset || 0,
        hasMore: transformedResults.length === (input.limit || 100),
      },
      filters: {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        minAmount: input.minAmount,
        maxAmount: input.maxAmount,
        vendorId: input.vendorId,
        paymentAccountId: input.paymentAccountId,
        paymentType: input.paymentType,
        text: input.text,
      },
    };

    return {
      content: [
        { type: "text" as const, text: `Found ${transformedResults.length} purchases:` },
        { type: "text" as const, text: JSON.stringify(responseData, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in search_purchases', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const SearchPurchasesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 