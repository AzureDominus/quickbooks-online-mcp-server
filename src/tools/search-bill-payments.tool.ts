import { searchQuickbooksBillPayments } from "../handlers/search-quickbooks-bill-payments.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "search_bill_payments";
const toolDescription = `Search bill payments in QuickBooks Online with advanced filtering.

Bill payments are transactions that record payments made to vendors against bills.

SEARCHABLE FIELDS:
- Id: Unique identifier for the bill payment
- DocNumber: Reference/check number
- TxnDate: Transaction date (YYYY-MM-DD)
- VendorRef: Vendor ID reference
- TotalAmt: Total payment amount
- PayType: Payment type ('Check' or 'CreditCard')
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

Example - Find bill payments over $1000:
{
  "criteria": [{ "field": "TotalAmt", "value": "1000", "operator": ">" }],
  "desc": "TxnDate",
  "limit": 50
}`;

// Allowed fields for BillPayment entity filtering
const ALLOWED_FILTER_FIELDS = [
  "Id",
  "DocNumber",
  "TxnDate",
  "VendorRef",
  "TotalAmt",
  "PayType",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
] as const;

const ALLOWED_SORT_FIELDS = [
  "Id",
  "DocNumber",
  "TxnDate",
  "TotalAmt",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
] as const;

// Criterion schema for typed search criteria
const CriterionSchema = z.object({
  field: z.enum(ALLOWED_FILTER_FIELDS).describe(
    `Field to filter on. Allowed: ${ALLOWED_FILTER_FIELDS.join(", ")}`
  ),
  value: z.union([z.string(), z.boolean()]).describe("Value to match"),
  operator: z.enum(["=", "<", ">", "<=", ">=", "LIKE", "IN"])
    .optional()
    .default("=")
    .describe("Comparison operator (default: =)"),
});

// Define the expected input schema for searching bill payments
const toolSchema = z.object({
  criteria: z.array(CriterionSchema)
    .optional()
    .describe("Filter criteria for searching bill payments"),
  asc: z.enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort ascending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(", ")}`),
  desc: z.enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort descending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(", ")}`),
  limit: z.number().int().min(1).max(1000)
    .optional()
    .describe("Maximum results to return (1-1000)"),
  offset: z.number().int().min(0)
    .optional()
    .describe("Number of records to skip for pagination"),
  count: z.boolean()
    .optional()
    .describe("If true, only return count of matching records"),
  fetchAll: z.boolean()
    .optional()
    .describe("If true, fetch all matching records (may be slow)"),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: { params?: ToolParams } & ToolParams) => {
  const startTime = Date.now();
  // Handle both wrapped params and direct args
  const input = args.params ?? args;
  
  logToolRequest(toolName, input);

  try {
    const response = await searchQuickbooksBillPayments(input);

    if (response.isError) {
      logger.error('Failed to search bill payments', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error searching bill payments: ${response.error}` },
        ],
      };
    }

    const results = response.result;
    const resultCount = Array.isArray(results) ? results.length : 
      (typeof results === 'number' ? results : 0);
    
    logger.info('Bill payment search completed', {
      resultCount,
      limit: input.limit,
      offset: input.offset,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    if (input.count && typeof results === 'number') {
      return {
        content: [
          { type: "text" as const, text: `Found ${results} matching bill payments` },
        ],
      };
    }

    return {
      content: [
        { type: "text" as const, text: `Bill payments found: ${resultCount}` },
        { type: "text" as const, text: JSON.stringify(results, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in search_bill_payments', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const SearchBillPaymentsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 