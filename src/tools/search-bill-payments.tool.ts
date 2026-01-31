import { searchQuickbooksBillPayments } from "../handlers/search-quickbooks-bill-payments.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "search_bill_payments";
const toolDescription = `Search bill payments in QuickBooks Online with advanced filtering.

Bill payments are transactions that record payments made to vendors against bills.

FILTER OPTIONS:
- txnDateFrom/txnDateTo: Filter by transaction date range (YYYY-MM-DD)
- totalAmtMin/totalAmtMax: Filter by total amount range
- vendorId: Filter by vendor ID
- payType: Filter by payment type ('Check' or 'CreditCard')
- docNumber: Filter by document/reference number

SEARCHABLE FIELDS (for advanced criteria):
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

Example - Find bill payments in January 2026:
{
  "txnDateFrom": "2026-01-01",
  "txnDateTo": "2026-01-31",
  "desc": "TotalAmt",
  "limit": 50
}

Example - Find bill payments over $1000:
{
  "totalAmtMin": 1000,
  "desc": "TxnDate"
}

Example - Find payments to a specific vendor:
{
  "vendorId": "123",
  "desc": "TxnDate"
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
  // Convenience filter parameters
  txnDateFrom: z.string()
    .optional()
    .describe("Filter payments on or after this date (YYYY-MM-DD)"),
  txnDateTo: z.string()
    .optional()
    .describe("Filter payments on or before this date (YYYY-MM-DD)"),
  totalAmtMin: z.number()
    .optional()
    .describe("Minimum total amount"),
  totalAmtMax: z.number()
    .optional()
    .describe("Maximum total amount"),
  vendorId: z.string()
    .optional()
    .describe("Filter by vendor ID"),
  payType: z.enum(["Check", "CreditCard"])
    .optional()
    .describe("Filter by payment type"),
  docNumber: z.string()
    .optional()
    .describe("Filter by document/reference number"),
  // Advanced criteria for complex queries
  criteria: z.array(CriterionSchema)
    .optional()
    .describe("Advanced filter criteria for complex queries"),
  // Sorting
  asc: z.enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort ascending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(", ")}`),
  desc: z.enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort descending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(", ")}`),
  // Pagination
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

/**
 * Build search filters from convenience parameters
 */
function buildBillPaymentSearchFilters(input: ToolParams): any[] {
  const filters: any[] = [];

  if (input.txnDateFrom !== undefined) {
    filters.push({ field: "TxnDate", value: input.txnDateFrom, operator: ">=" });
  }
  if (input.txnDateTo !== undefined) {
    filters.push({ field: "TxnDate", value: input.txnDateTo, operator: "<=" });
  }
  if (input.totalAmtMin !== undefined) {
    filters.push({ field: "TotalAmt", value: String(input.totalAmtMin), operator: ">=" });
  }
  if (input.totalAmtMax !== undefined) {
    filters.push({ field: "TotalAmt", value: String(input.totalAmtMax), operator: "<=" });
  }
  if (input.vendorId !== undefined) {
    filters.push({ field: "VendorRef", value: input.vendorId, operator: "=" });
  }
  if (input.payType !== undefined) {
    filters.push({ field: "PayType", value: input.payType, operator: "=" });
  }
  if (input.docNumber !== undefined) {
    filters.push({ field: "DocNumber", value: input.docNumber, operator: "=" });
  }

  return filters;
}

// Define the tool handler
const toolHandler = async (args: { params?: ToolParams } & ToolParams) => {
  const startTime = Date.now();
  // Handle both wrapped params and direct args
  const input = args.params ?? args;
  
  logToolRequest(toolName, input);

  try {
    // Build criteria from convenience parameters
    const convenienceFilters = buildBillPaymentSearchFilters(input);
    
    // Merge with any advanced criteria if provided
    let searchParams: any;
    
    if (input.criteria && input.criteria.length > 0) {
      // User provided advanced criteria - merge with convenience filters
      const advancedFilters = input.criteria.map(c => ({
        field: c.field,
        value: c.value,
        operator: c.operator || "=",
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
    
    const response = await searchQuickbooksBillPayments(searchParams);

    if (response.isError) {
      logger.error('Failed to search bill payments', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error searching bill payments: ${response.error}` },
        ],
      };
    }

    // Handle count-only response
    if (input.count && typeof response.result === 'number') {
      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Found ${response.result} matching bill payments` },
        ],
      };
    }

    const results = response.result?.QueryResponse?.BillPayment || response.result || [];
    const resultArray = Array.isArray(results) ? results : [results];
    
    logger.info('Bill payment search completed', {
      resultCount: resultArray.length,
      limit: input.limit,
      offset: input.offset,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    // Build response with filter info
    const responseData = {
      billPayments: resultArray,
      count: resultArray.length,
      pagination: {
        limit: input.limit || 100,
        offset: input.offset || 0,
        hasMore: resultArray.length === (input.limit || 100),
      },
      filters: {
        txnDateFrom: input.txnDateFrom,
        txnDateTo: input.txnDateTo,
        totalAmtMin: input.totalAmtMin,
        totalAmtMax: input.totalAmtMax,
        vendorId: input.vendorId,
        payType: input.payType,
        docNumber: input.docNumber,
      },
    };

    return {
      content: [
        { type: "text" as const, text: `Found ${resultArray.length} bill payments:` },
        { type: "text" as const, text: JSON.stringify(responseData, null, 2) },
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