import { searchQuickbooksItems } from "../handlers/search-quickbooks-items.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "search_items";
const toolDescription = `Search items (products and services) in QuickBooks Online with advanced filtering.

Items are products or services that a company buys, sells, or resells.

FILTER OPTIONS:
- type: Filter by item type ('Service', 'Inventory', 'NonInventory', 'Group', 'Category')
- active: Filter by active status (true/false)
- unitPriceMin/unitPriceMax: Filter by unit price range
- name: Filter by item name (use % for LIKE matching)

SEARCHABLE FIELDS (for advanced criteria):
- Id: Unique identifier for the item
- Name: Item name (unique within account)
- Active: Whether item is active (true/false)
- Type: Item type ('Inventory', 'NonInventory', 'Service', 'Group', 'Category')
- Sku: Stock keeping unit (SKU)
- MetaData.CreateTime: Record creation timestamp
- MetaData.LastUpdatedTime: Last modification timestamp

SORTABLE FIELDS:
- Id, Name, Type, ParentRef, PrefVendorRef, UnitPrice, QtyOnHand
- MetaData.CreateTime, MetaData.LastUpdatedTime

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

Example - Find active service items:
{
  "type": "Service",
  "active": true,
  "asc": "Name",
  "limit": 100
}

Example - Find items priced over $50:
{
  "unitPriceMin": 50,
  "active": true,
  "desc": "UnitPrice"
}

Example - Search items by name:
{
  "name": "%consulting%",
  "type": "Service"
}`;

// Allowed field lists based on QuickBooks Online Item entity documentation
const ALLOWED_FILTER_FIELDS = [
  "Id",
  "Name",
  "Active",
  "Type",
  "Sku",
  "UnitPrice",
  "MetaData.CreateTime",
  "MetaData.LastUpdatedTime",
] as const;

const ALLOWED_SORT_FIELDS = [
  "Id",
  "Name",
  "Type",
  "ParentRef",
  "PrefVendorRef",
  "UnitPrice",
  "QtyOnHand",
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

// Item types supported by QuickBooks Online
const ITEM_TYPES = ["Service", "Inventory", "NonInventory", "Group", "Category"] as const;

// Define the expected input schema for searching items
const toolSchema = z.object({
  // Convenience filter parameters
  /** Filter by item type */
  type: z.enum(ITEM_TYPES)
    .optional()
    .describe("Filter by item type ('Service', 'Inventory', 'NonInventory', 'Group', 'Category')"),
  /** Filter by active status */
  active: z.boolean()
    .optional()
    .describe("Filter by active status (true/false)"),
  /** Minimum unit price */
  unitPriceMin: z.number()
    .optional()
    .describe("Filter by minimum unit price"),
  /** Maximum unit price */
  unitPriceMax: z.number()
    .optional()
    .describe("Filter by maximum unit price"),
  /** Filter by item name */
  name: z.string()
    .optional()
    .describe("Filter by item name (use % for LIKE matching)"),
  // Advanced criteria for complex queries
  criteria: z.array(CriterionSchema)
    .optional()
    .describe("Additional filter criteria for advanced queries"),
  asc: z.enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort ascending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(", ")}`),
  desc: z.enum(ALLOWED_SORT_FIELDS)
    .optional()
    .describe(`Sort descending by field. Allowed: ${ALLOWED_SORT_FIELDS.join(", ")}`),
  limit: z.number().int().min(1).max(1000)
    .optional()
    .describe("Maximum results to return (1-1000, default 100)"),
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

/**
 * Build search criteria from convenience filter parameters
 */
function buildItemSearchCriteria(input: ToolParams): Array<{ field: string; value: string | boolean; operator?: string }> {
  const criteria: Array<{ field: string; value: string | boolean; operator?: string }> = [];

  // Item type filter
  if (input.type !== undefined) {
    criteria.push({ field: 'Type', value: input.type, operator: '=' });
  }

  // Active status filter
  if (input.active !== undefined) {
    criteria.push({ field: 'Active', value: input.active, operator: '=' });
  }

  // Unit price range filters
  if (input.unitPriceMin !== undefined) {
    criteria.push({ field: 'UnitPrice', value: input.unitPriceMin.toString(), operator: '>=' });
  }
  if (input.unitPriceMax !== undefined) {
    criteria.push({ field: 'UnitPrice', value: input.unitPriceMax.toString(), operator: '<=' });
  }

  // Name filter with LIKE support
  if (input.name !== undefined) {
    const operator = input.name.includes('%') ? 'LIKE' : '=';
    criteria.push({ field: 'Name', value: input.name, operator });
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
    const convenienceFilters = buildItemSearchCriteria(input);
    
    // Merge convenience filters with any advanced criteria
    const allCriteria = [
      ...convenienceFilters,
      ...(input.criteria || []),
    ];
    
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
    
    logger.debug('Built item search criteria', {
      convenienceFiltersCount: convenienceFilters.length,
      totalCriteriaCount: allCriteria.length,
    });
    
    const response = await searchQuickbooksItems(searchParams);

    if (response.isError) {
      logger.error('Failed to search items', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error searching items: ${response.error}` },
        ],
      };
    }

    const results = response.result;
    const resultCount = Array.isArray(results) ? results.length : 
      (typeof results === 'number' ? results : 0);
    
    logger.info('Item search completed', {
      resultCount,
      limit: input.limit,
      offset: input.offset,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    if (input.count && typeof results === 'number') {
      return {
        content: [
          { type: "text" as const, text: `Found ${results} matching items` },
        ],
      };
    }

    return {
      content: [
        { type: "text" as const, text: `Items found: ${resultCount}` },
        { type: "text" as const, text: JSON.stringify(results, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in search_items', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const SearchItemsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 