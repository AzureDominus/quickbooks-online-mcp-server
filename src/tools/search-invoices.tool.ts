import { searchQuickbooksInvoices } from "../handlers/search-quickbooks-invoices.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { SearchInvoicesInputSchema, type SearchInvoicesInput } from "../types/qbo-schemas.js";
import { buildInvoiceSearchCriteria } from "../helpers/transform.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "search_invoices";
const toolDescription = `Search invoices in QuickBooks Online with advanced filtering.

Invoices are sales forms that record sales of products or services to customers.

FILTER OPTIONS:
- dateFrom/dateTo: Filter by invoice date range (YYYY-MM-DD)
- dueFrom/dueTo: Filter by due date range (YYYY-MM-DD)
- amountMin/amountMax: Filter by total amount range
- balanceMin/balanceMax: Filter by unpaid balance range
- customerId: Filter by customer ID
- docNumber: Filter by invoice number

SORTING:
- asc: Sort ascending by field (e.g., 'TxnDate', 'TotalAmt', 'Balance')
- desc: Sort descending by field

PAGINATION:
- limit: Maximum results to return (1-1000, default 100)
- offset: Number of records to skip (for pagination)

OPTIONS:
- count: If true, only return count of matching records
- fetchAll: If true, fetch all matching records (may be slow)

ADVANCED USAGE:
- criteria: Array of raw filter objects for complex queries

Example - Find unpaid invoices over $500 in January 2026:
{
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31",
  "amountMin": 500,
  "balanceMin": 0.01,
  "desc": "TotalAmt",
  "limit": 50
}

Example - Find all invoices for a specific customer:
{
  "customerId": "123",
  "desc": "TxnDate"
}

Example - Find overdue invoices (due before today with balance):
{
  "dueTo": "2026-01-30",
  "balanceMin": 0.01,
  "desc": "DueDate"
}`;

// Use the properly typed schema from qbo-schemas
const toolSchema = SearchInvoicesInputSchema;

// Define the tool handler - MCP SDK passes parsed args directly
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  // Args are passed directly as the schema result
  const input = args as SearchInvoicesInput;
  
  logToolRequest(toolName, input);

  try {
    // Build search criteria from input
    const { criteria, options } = buildInvoiceSearchCriteria(input);
    
    logger.debug('Built invoice search criteria', { 
      criteriaCount: criteria.length, 
      options,
    });

    // Combine criteria and options for the handler
    const searchParams = {
      criteria,
      ...options,
    };

    const response = await searchQuickbooksInvoices(searchParams);

    if (response.isError) {
      logger.error('Failed to search invoices', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error searching invoices: ${response.error}` },
        ],
      };
    }

    // Handle count-only response
    if (input.count && typeof response.result === 'number') {
      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Found ${response.result} matching invoices` },
        ],
      };
    }

    const results = response.result || [];
    const resultArray = Array.isArray(results) ? results : [results];
    
    logger.info('Invoice search completed', {
      resultCount: resultArray.length,
      limit: input.limit,
      offset: input.offset,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    // Build response with pagination info
    const responseData = {
      invoices: resultArray,
      count: resultArray.length,
      pagination: {
        limit: input.limit || 100,
        offset: input.offset || 0,
        hasMore: resultArray.length === (input.limit || 100),
      },
      filters: {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        dueFrom: input.dueFrom,
        dueTo: input.dueTo,
        amountMin: input.amountMin,
        amountMax: input.amountMax,
        balanceMin: input.balanceMin,
        balanceMax: input.balanceMax,
        customerId: input.customerId,
        docNumber: input.docNumber,
      },
    };

    return {
      content: [
        { type: "text" as const, text: `Found ${resultArray.length} invoices:` },
        { type: "text" as const, text: JSON.stringify(responseData, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in search_invoices', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const SearchInvoicesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 