import { searchQuickbooksCustomers } from '../handlers/search-quickbooks-customers.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'search_customers';
const toolDescription = 'Search customers in QuickBooks Online that match given criteria.';

// Common Customer entity fields that are filterable. Not exhaustive – any
// property present on the QuickBooks Customer object is valid.
const customerFieldEnum = z
  .enum([
    'Id',
    'DisplayName',
    'GivenName',
    'FamilyName',
    'CompanyName',
    'PrimaryEmailAddr',
    'PrimaryPhone',
    'Balance',
    'Active',
    'MetaData.CreateTime',
    'MetaData.LastUpdatedTime',
  ])
  .describe('Field to filter on – must be a property of the QuickBooks Online Customer entity.');

const criterionSchema = z.object({
  key: z.string().describe('Simple key (legacy) – any Customer property name.'),
  value: z.union([z.string(), z.boolean()]),
});

const advancedCriterionSchema = z.object({
  field: customerFieldEnum,
  value: z.union([z.string(), z.boolean()]),
  operator: z.enum(['=', '<', '>', '<=', '>=', 'LIKE', 'IN']).optional(),
});

const toolSchema = z.object({
  // Criteria can be passed as list of key/value/operator triples (array form)
  // or omitted for unfiltered search.
  criteria: z
    .array(advancedCriterionSchema.or(criterionSchema))
    .optional()
    .describe(
      'Filters to apply. Use the advanced form {field,value,operator?} for operators or the simple {key,value} pairs.'
    ),

  // Pagination / sorting / count
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

const toolHandler = async (args: { params?: ToolInput }) => {
  logToolRequest('search_customers', args.params);
  const startTime = Date.now();

  try {
    const { criteria = [], ...options } = args.params ?? ({} as ToolInput);

    // Build criteria to send to SDK. If user provided the advanced array with field/operator/value
    // we pass it straight through. Otherwise we transform legacy {key,value} pairs to object.
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
        // original simple key/value list → map
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

    const response = await searchQuickbooksCustomers(criteriaToSend);
    if (response.isError) {
      logToolResponse('search_customers', false, Date.now() - startTime);
      logger.error('Customers search failed', response.error, { criteria: criteriaToSend });
      return {
        content: [{ type: 'text' as const, text: `Error searching customers: ${response.error}` }],
      };
    }
    const resultCount = Array.isArray(response.result) ? response.result.length : response.result;
    logToolResponse('search_customers', true, Date.now() - startTime);
    logger.info('Customers search completed', { count: resultCount, criteria: criteriaToSend });

    // Return a single JSON payload.
    if (Array.isArray(response.result)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ count: response.result.length, customers: response.result }),
          },
        ],
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ count: response.result }) }],
    };
  } catch (error) {
    logToolResponse('search_customers', false, Date.now() - startTime);
    logger.error('Customers search failed', error, { params: args.params });
    throw error;
  }
};

export const SearchCustomersTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
