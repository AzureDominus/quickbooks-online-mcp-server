import { searchQuickbooksAccounts } from "../handlers/search-quickbooks-accounts.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

const toolName = "search_accounts";
const toolDescription = `Search chart-of-accounts entries in QuickBooks Online with advanced filtering.

Accounts represent the categories in your chart of accounts for tracking financial transactions.

FILTER OPTIONS:
- accountType: Filter by account type (e.g., "Bank", "Expense", "Income", "Other Current Asset", "Fixed Asset", "Other Current Liability", "Long Term Liability", "Equity", "Cost of Goods Sold", "Other Income", "Other Expense")
- classification: Filter by classification (e.g., "Asset", "Liability", "Equity", "Revenue", "Expense")
- balanceMin/balanceMax: Filter by current balance range
- active: Filter by active status (true/false)
- name: Filter by account name (supports LIKE with % wildcard)

SORTING:
- asc: Sort ascending by field (e.g., 'Name', 'CurrentBalance', 'Id')
- desc: Sort descending by field

PAGINATION:
- limit: Maximum results to return (1-1000, default 100)
- offset: Number of records to skip (for pagination)

OPTIONS:
- count: If true, only return count of matching records
- fetchAll: If true, fetch all matching records (may be slow)

ADVANCED USAGE:
- criteria: Object with "filters" array for complex queries using raw field/value/operator

Example - Find active expense accounts:
{
  "accountType": "Expense",
  "active": true,
  "asc": "Name"
}

Example - Find accounts with balance over $1000:
{
  "balanceMin": 1000,
  "desc": "CurrentBalance",
  "limit": 50
}

Example - Find bank accounts:
{
  "accountType": "Bank",
  "active": true
}`;

// Allowed field lists based on QuickBooks Online Account entity documentation. Only these can be
// used in the search criteria.
const ALLOWED_FILTER_FIELDS = [
  "Id",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "Name",
  "SubAccount",
  "ParentRef",
  "Description",
  "Active",
  "Classification",
  "AccountType",
  "CurrentBalance",
] as const;

const ALLOWED_SORT_FIELDS = [
  "Id",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
  "Name",
  "SubAccount",
  "ParentRef",
  "Description",
  "CurrentBalance",
] as const;

// BEGIN ADD FIELD TYPE MAP
const ACCOUNT_FIELD_TYPE_MAP: Record<string, "string" | "number" | "boolean" | "date"> = {
  Id: "string",
  "MetaData.CreateTime": "date",
  "MetaData.LastUpdatedTime": "date",
  Name: "string",
  SubAccount: "boolean",
  ParentRef: "string",
  Description: "string",
  Active: "boolean",
  Classification: "string",
  AccountType: "string",
  CurrentBalance: "number",
};

function isValidValueType(field: string, value: any): boolean {
  const expected = ACCOUNT_FIELD_TYPE_MAP[field];
  if (!expected) return true; // If field not in map, skip type check.
  switch (expected) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "date":
      return typeof value === "string"; // assume ISO date string
    default:
      return true;
  }
}
// END ADD FIELD TYPE MAP

// Zod schemas that validate the fields against the above white-lists
const filterableFieldSchema = z
  .string()
  .refine((val) => (ALLOWED_FILTER_FIELDS as readonly string[]).includes(val), {
    message: `Field must be one of: ${ALLOWED_FILTER_FIELDS.join(", ")}`,
  });

const sortableFieldSchema = z
  .string()
  .refine((val) => (ALLOWED_SORT_FIELDS as readonly string[]).includes(val), {
    message: `Sort field must be one of: ${ALLOWED_SORT_FIELDS.join(", ")}`,
  });

// Advanced criteria shape
const operatorSchema = z.enum(["=", "IN", "<", ">", "<=", ">=", "LIKE"]).optional();
const criteriaValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]);
const filterSchema = z.object({
  field: filterableFieldSchema,
  value: criteriaValueSchema,
  operator: operatorSchema,
}).superRefine((obj, ctx) => {
  if (!isValidValueType(obj.field, obj.value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Value type does not match expected type for field ${obj.field}`,
    });
  }
});

const advancedCriteriaSchema = z.object({
  filters: z.array(filterSchema).optional(),
  asc: sortableFieldSchema.optional(),
  desc: sortableFieldSchema.optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  count: z.boolean().optional(),
  fetchAll: z.boolean().optional(),
});

// Runtime schema keeps full validation
const simpleFilterValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const RUNTIME_CRITERIA_SCHEMA = z.union([
  z.record(z.string(), simpleFilterValueSchema),
  z.array(z.record(z.string(), simpleFilterValueSchema)),
  advancedCriteriaSchema,
]);

// ---------- Coercion & Normalization ----------
function coerceAccountFieldValue(field: string, value: any): any {
  const expected = ACCOUNT_FIELD_TYPE_MAP[field as keyof typeof ACCOUNT_FIELD_TYPE_MAP];
  if (!expected) return value;

  const convert = (v: any): any => {
    switch (expected) {
      case "string":
        return typeof v === "string" ? v : String(v);
      case "number":
        return typeof v === "number" ? v : Number(v);
      case "boolean":
        return typeof v === "boolean" ? v : (v === "true" || v === 1 || v === "1");
      case "date":
        return typeof v === "string" ? v : String(v);
      default:
        return v;
    }
  };
  return Array.isArray(value) ? value.map(convert) : convert(value);
}

function normalizeAccountCriteria(criteria: any): any {
  if (!criteria) return criteria;

  // Advanced format with filters
  if (criteria.filters && Array.isArray(criteria.filters)) {
    return {
      ...criteria,
      filters: criteria.filters.map((f: any) => ({
        ...f,
        value: coerceAccountFieldValue(f.field, f.value),
      })),
    };
  }

  // Array of criteria objects
  if (Array.isArray(criteria)) {
    return criteria.map(normalizeAccountCriteria);
  }

  // Simple key-value map criteria
  if (typeof criteria === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(criteria)) {
      out[k] = coerceAccountFieldValue(k, v);
    }
    return out;
  }

  return criteria;
}

// Schema exposed to function definition - typed schema for MCP tool
const criteriaSchema = advancedCriteriaSchema;

// Main tool schema with convenience filter parameters
const toolSchema = z.object({
  // Convenience filter parameters
  accountType: z.string()
    .optional()
    .describe("Filter by account type (e.g., 'Bank', 'Expense', 'Income', 'Other Current Asset', 'Fixed Asset', 'Other Current Liability', 'Long Term Liability', 'Equity', 'Cost of Goods Sold', 'Other Income', 'Other Expense')"),
  classification: z.enum(["Asset", "Liability", "Equity", "Revenue", "Expense"])
    .optional()
    .describe("Filter by account classification"),
  balanceMin: z.number()
    .optional()
    .describe("Minimum current balance"),
  balanceMax: z.number()
    .optional()
    .describe("Maximum current balance"),
  active: z.boolean()
    .optional()
    .describe("Filter by active status (true/false)"),
  name: z.string()
    .optional()
    .describe("Filter by account name (use % as wildcard for partial match)"),
  // Sorting
  asc: sortableFieldSchema
    .optional()
    .describe(`Sort ascending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(", ")}`),
  desc: sortableFieldSchema
    .optional()
    .describe(`Sort descending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(", ")}`),
  // Pagination
  limit: z.number().int().min(1).max(1000)
    .optional()
    .describe("Maximum results to return (1-1000, default 100)"),
  offset: z.number().int().min(0)
    .optional()
    .describe("Number of records to skip for pagination"),
  // Options
  count: z.boolean()
    .optional()
    .describe("If true, only return count of matching records"),
  fetchAll: z.boolean()
    .optional()
    .describe("If true, fetch all matching records (may be slow)"),
  // Advanced criteria object for complex queries
  criteria: criteriaSchema
    .optional()
    .describe("Advanced criteria object with filters array for complex queries"),
});

type ToolParams = z.infer<typeof toolSchema>;

/**
 * Build search filters from convenience parameters
 */
function buildAccountSearchFilters(input: ToolParams): any[] {
  const filters: any[] = [];

  if (input.accountType !== undefined) {
    filters.push({ field: "AccountType", value: input.accountType, operator: "=" });
  }
  if (input.classification !== undefined) {
    filters.push({ field: "Classification", value: input.classification, operator: "=" });
  }
  if (input.balanceMin !== undefined) {
    filters.push({ field: "CurrentBalance", value: input.balanceMin, operator: ">=" });
  }
  if (input.balanceMax !== undefined) {
    filters.push({ field: "CurrentBalance", value: input.balanceMax, operator: "<=" });
  }
  if (input.active !== undefined) {
    filters.push({ field: "Active", value: input.active, operator: "=" });
  }
  if (input.name !== undefined) {
    const operator = input.name.includes("%") ? "LIKE" : "=";
    filters.push({ field: "Name", value: input.name, operator });
  }

  return filters;
}

// Tool handler with runtime validation & coercion
const toolHandler = async (args: { params?: ToolParams } & ToolParams) => {
  // Handle both wrapped params and direct args
  const input = args.params ?? args;
  
  logToolRequest("search_accounts", input);
  const startTime = Date.now();

  try {
    // Build criteria from convenience parameters
    const convenienceFilters = buildAccountSearchFilters(input);
    
    // Merge with any advanced criteria if provided
    let finalCriteria: any;
    
    if (input.criteria) {
      // User provided advanced criteria - merge with convenience filters
      const advancedFilters = input.criteria.filters || [];
      finalCriteria = {
        filters: [...convenienceFilters, ...advancedFilters],
        asc: input.asc || input.criteria.asc,
        desc: input.desc || input.criteria.desc,
        limit: input.limit ?? input.criteria.limit,
        offset: input.offset ?? input.criteria.offset,
        count: input.count ?? input.criteria.count,
        fetchAll: input.fetchAll ?? input.criteria.fetchAll,
      };
    } else if (convenienceFilters.length > 0) {
      // Only convenience filters
      finalCriteria = {
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
      finalCriteria = {
        asc: input.asc,
        desc: input.desc,
        limit: input.limit,
        offset: input.offset,
        count: input.count,
        fetchAll: input.fetchAll,
      };
    }
    
    const normalized = normalizeAccountCriteria(finalCriteria);
    const response = await searchQuickbooksAccounts(normalized);
    
    if (response.isError) {
      logToolResponse("search_accounts", false, Date.now() - startTime);
      logger.error("Accounts search failed", response.error, { criteria: normalized });
      return { content: [{ type: "text" as const, text: `Error searching accounts: ${response.error}` }] };
    }
    
    const accounts = response.result;
    logToolResponse("search_accounts", true, Date.now() - startTime);
    logger.info("Accounts search completed", { count: accounts?.length || 0, criteria: normalized });
    
    // Handle count-only response
    if (input.count && typeof accounts === 'number') {
      return {
        content: [
          { type: "text" as const, text: `Found ${accounts} matching accounts` },
        ],
      };
    }
    
    const accountArray = Array.isArray(accounts) ? accounts : [];
    
    // Build response with filter info
    const responseData = {
      accounts: accountArray,
      count: accountArray.length,
      pagination: {
        limit: input.limit || 100,
        offset: input.offset || 0,
        hasMore: accountArray.length === (input.limit || 100),
      },
      filters: {
        accountType: input.accountType,
        classification: input.classification,
        balanceMin: input.balanceMin,
        balanceMax: input.balanceMax,
        active: input.active,
        name: input.name,
      },
    };
    
    return {
      content: [
        { type: "text" as const, text: `Found ${accountArray.length} accounts:` },
        { type: "text" as const, text: JSON.stringify(responseData, null, 2) },
      ],
    };
  } catch (error) {
    logToolResponse("search_accounts", false, Date.now() - startTime);
    logger.error("Accounts search failed", error, { input });
    throw error;
  }
};

// Update export
export const SearchAccountsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 