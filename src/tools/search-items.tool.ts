import { searchQuickbooksItems } from "../handlers/search-quickbooks-items.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "search_items";
const toolDescription = `Search items (products and services) in QuickBooks Online with advanced filtering.

Items are products or services that a company buys, sells, or resells.

SEARCHABLE FIELDS:
- Id: Unique identifier for the item
- Name: Item name (unique within account)
- Active: Whether item is active (true/false)
- Type: Item type ('Inventory', 'NonInventory', 'Service', 'Group', 'Category')
- Sku: Stock keeping unit (SKU)
- MetaData.CreateTime: Record creation timestamp
- MetaData.LastUpdatedTime: Last modification timestamp

SORTABLE FIELDS (in addition to searchable):
- ParentRef: Parent item reference (for sub-items)
- PrefVendorRef: Preferred vendor reference
- UnitPrice: Sale price per unit
- QtyOnHand: Quantity on hand (inventory items only)

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

Example - Find active inventory items:
{
  "criteria": [
    { "field": "Active", "value": true },
    { "field": "Type", "value": "Inventory" }
  ],
  "asc": "Name",
  "limit": 100
}`;

// Allowed field lists based on QuickBooks Online Item entity documentation
const ALLOWED_FILTER_FIELDS = [
  "Id",
  "Name",
  "Active",
  "Type",
  "Sku",
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

// Define the expected input schema for searching items
const toolSchema = z.object({
  criteria: z.array(CriterionSchema)
    .optional()
    .describe("Filter criteria for searching items"),
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
    const response = await searchQuickbooksItems(input);

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