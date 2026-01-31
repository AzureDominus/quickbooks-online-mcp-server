import { searchTaxCodes } from "../handlers/tax-code.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "search_tax_codes";
const toolDescription = `Search and list tax codes in QuickBooks Online.

Use this to find the correct TaxCodeRef value when creating expenses/purchases.
Returns tax code id, name, description, and whether it's taxable.

Common tax codes:
- TAX or taxable codes: Apply sales tax (GST, HST, PST, QST depending on jurisdiction)
- NON or exempt codes: No tax applied (e.g., for tips, exempt items)

For Canadian purchases, look for codes like:
- GST/HST codes for federal tax
- PST/QST codes for provincial tax
- Combined codes that apply both federal and provincial`;

// Allowed fields based on QuickBooks TaxCode entity
const ALLOWED_FILTER_FIELDS = [
  "Id",
  "Name",
  "Active",
  "Taxable",
  "TaxGroup",
  "Description",
] as const;

const toolSchema = z.object({
  criteria: z
    .array(
      z.object({
        field: z.enum(ALLOWED_FILTER_FIELDS).describe("Field to filter on"),
        value: z.union([z.string(), z.boolean()]).describe("Value to match"),
        operator: z
          .enum(["=", "<", ">", "<=", ">=", "LIKE", "IN"])
          .optional()
          .describe("Comparison operator, defaults to '='"),
      })
    )
    .optional()
    .describe("Filter criteria for tax codes"),
  fetchAll: z
    .boolean()
    .optional()
    .describe("If true, fetch all matching tax codes (may be slow)"),
  limit: z.number().optional().describe("Maximum number of results to return"),
  offset: z.number().optional().describe("Number of results to skip"),
  asc: z.enum(ALLOWED_FILTER_FIELDS).optional().describe("Field to sort ascending"),
  desc: z.enum(ALLOWED_FILTER_FIELDS).optional().describe("Field to sort descending"),
});

const toolHandler = async (args: { [x: string]: any }) => {
  const params = args.params;
  
  // Build criteria object for node-quickbooks
  const criteria: any = {};
  
  if (params.criteria && params.criteria.length > 0) {
    for (const filter of params.criteria) {
      const op = filter.operator || "=";
      if (op === "=") {
        criteria[filter.field] = filter.value;
      } else if (op === "LIKE") {
        criteria[filter.field] = { value: `%${filter.value}%`, operator: "LIKE" };
      } else {
        criteria[filter.field] = { value: filter.value, operator: op };
      }
    }
  }
  
  if (params.fetchAll) criteria.fetchAll = true;
  if (params.limit) criteria.limit = params.limit;
  if (params.offset) criteria.offset = params.offset;
  if (params.asc) criteria.asc = params.asc;
  if (params.desc) criteria.desc = params.desc;
  
  const response = await searchTaxCodes(criteria);

  if (response.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error searching tax codes: ${response.error}`,
        },
      ],
    };
  }

  const taxCodes = response.result || [];
  
  // Format results for readability
  const summary = taxCodes.map((tc: any) => ({
    id: tc.Id,
    name: tc.Name,
    description: tc.Description,
    active: tc.Active,
    taxable: tc.Taxable,
    taxGroup: tc.TaxGroup,
  }));

  return {
    content: [
      {
        type: "text" as const,
        text: `Found ${taxCodes.length} tax code(s):\n${JSON.stringify(summary, null, 2)}`,
      },
    ],
  };
};

export const SearchTaxCodesTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
