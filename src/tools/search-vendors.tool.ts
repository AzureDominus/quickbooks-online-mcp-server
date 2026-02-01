import { searchQuickbooksVendors } from '../handlers/search-quickbooks-vendors.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';

const toolName = 'search_vendors';
const toolDescription = 'Search vendors in QuickBooks Online that match given criteria.';

// A subset of commonly-used Vendor fields that can be filtered on.
// This is *not* an exhaustive list, but provides helpful IntelliSense / docs
// to users of the tool. Any field returned in the Quickbooks Vendor entity is
// technically valid.
const vendorFieldEnum = z
  .enum([
    'Id',
    'SyncToken',
    'MetaData.CreateTime',
    'MetaData.LastUpdatedTime',
    'GivenName',
    'MiddleName',
    'FamilyName',
    'CompanyName',
    'DisplayName',
    'PrintOnCheckName',
    'Active',
    'PrimaryPhone',
    'AlternatePhone',
    'Mobile',
    'Fax',
    'PrimaryEmailAddr',
    'WebAddr',
    'Title',
    'Balance',
    'BillRate',
    'AcctNum',
    'Vendor1099',
  ])
  .describe('Field to filter on – must be a property of the QuickBooks Online Vendor entity.');

const criterionSchema = z.object({
  key: z.string().describe('Simple key (legacy) – any Vendor property name.'),
  value: z.union([z.string(), z.boolean()]),
});

// Advanced criterion schema with operator support.
const advancedCriterionSchema = z.object({
  field: vendorFieldEnum,
  value: z.union([z.string(), z.boolean()]),
  operator: z
    .enum(['=', '<', '>', '<=', '>=', 'LIKE', 'IN'])
    .optional()
    .describe("Comparison operator. Defaults to '=' if omitted."),
});

const toolSchema = z.object({
  // Allow advanced criteria array like [{field,value,operator}]
  criteria: z
    .array(advancedCriterionSchema.or(criterionSchema))
    .optional()
    .describe(
      'Filters to apply. Use the advanced form {field,value,operator?} for operators or the simple {key,value} pairs.'
    ),

  limit: z.number().optional(),
  offset: z.number().optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  fetchAll: z.boolean().optional(),
  count: z.boolean().optional(),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

/** Criterion type for checking field presence */
type AdvancedCriterion = z.infer<typeof advancedCriterionSchema>;
type SimpleCriterion = z.infer<typeof criterionSchema>;

export const SearchVendorsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: async (args: { params?: ToolInput }) => {
    const { criteria = [], ...options } = args.params ?? ({} as ToolInput);

    // build criteria to pass to SDK, supporting advanced operator syntax
    let criteriaToSend: Array<AdvancedCriterion | SimpleCriterion> | Record<string, unknown>;
    if (Array.isArray(criteria) && criteria.length > 0) {
      const first = criteria[0];
      // Check if this is an advanced criterion with 'field' property
      if (typeof first === 'object' && 'field' in first) {
        criteriaToSend = [
          ...criteria,
          ...Object.entries(options).map(([key, value]) => ({
            field: key as AdvancedCriterion['field'],
            value: value as string | boolean,
          })),
        ];
      } else {
        criteriaToSend = (criteria as SimpleCriterion[]).reduce<Record<string, unknown>>(
          (acc, { key, value }) => {
            if (value !== undefined && value !== null) acc[key] = value;
            return acc;
          },
          { ...options }
        );
      }
    } else {
      criteriaToSend = { ...options };
    }

    const response = await searchQuickbooksVendors(criteriaToSend);
    if (response.isError) {
      return {
        content: [{ type: 'text' as const, text: `Error searching vendors: ${response.error}` }],
      };
    }
    // Return a single JSON payload so callers (mcporter/CLIs) can reliably parse it.
    // (Streaming one vendor per text chunk makes headless automation annoying.)
    if (Array.isArray(response.result)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ count: response.result.length, vendors: response.result }),
          },
        ],
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ count: response.result }) }],
    };
  },
};
