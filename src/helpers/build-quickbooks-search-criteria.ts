import { sanitizeQueryValue } from './sanitize.js';

export interface QuickbooksFilter {
  /** Field/column name to filter on */
  field: string;
  /** Value to match against */
  value: any;
  /** Comparison operator to use (default '=') */
  operator?: string;
}

export interface AdvancedQuickbooksSearchOptions {
  /** Array of filter objects that map to QuickBooks query filters */
  filters?: QuickbooksFilter[];
  /** Alias for filters - array of filter objects (used by transform functions) */
  criteria?: QuickbooksFilter[];
  /** Sort ascending by the provided field */
  asc?: string;
  /** Sort descending by the provided field */
  desc?: string;
  /** Maximum number of rows to return */
  limit?: number;
  /** Number of rows to skip from the start of the result set */
  offset?: number;
  /** If true, only a count of rows is returned */
  count?: boolean;
  /** If true, transparently fetches all records. */
  fetchAll?: boolean;
}

/**
 * User-supplied criteria can be one of:
 *  1. A simple criteria object (e.g. { Name: 'Foo' })
 *  2. An array of objects specifying field/value/operator
 *  3. An {@link AdvancedQuickbooksSearchOptions} object that is translated to the array format expected by node-quickbooks
 */
export type QuickbooksSearchCriteriaInput =
  | Record<string, any>
  | Array<Record<string, any>>
  | AdvancedQuickbooksSearchOptions;

/**
 * Convert various input shapes into the criteria shape that `node-quickbooks` expects.
 *
 * If the input is already an object or array that `node-quickbooks` understands, it is returned untouched.
 * If the input is an {@link AdvancedQuickbooksSearchOptions} instance, it is converted to an array of
 * `{field, value, operator}` objects.
 */
export function buildQuickbooksSearchCriteria(
  input: QuickbooksSearchCriteriaInput
): Record<string, any> | Array<Record<string, any>> {
  // If the user supplied an array we assume they know what they're doing.
  if (Array.isArray(input)) {
    return input as Array<Record<string, any>>;
  }

  // If the input is a plain object that does NOT look like advanced options, forward as-is
  const possibleAdvancedKeys: (keyof AdvancedQuickbooksSearchOptions)[] = [
    'filters',
    'criteria',
    'asc',
    'desc',
    'limit',
    'offset',
    'count',
    'fetchAll',
  ];

  const inputKeys = Object.keys(input || {});
  const isAdvanced = inputKeys.some((k) =>
    possibleAdvancedKeys.includes(k as keyof AdvancedQuickbooksSearchOptions)
  );

  if (!isAdvanced) {
    // simple criteria object – pass through
    return input as Record<string, any>;
  }

  // At this point we treat the input as AdvancedQuickbooksSearchOptions
  const options = input as AdvancedQuickbooksSearchOptions;
  const criteriaArr: Array<Record<string, any>> = [];

  // Convert filters (support both 'filters' and 'criteria' keys)
  const filtersToProcess = options.filters ?? options.criteria ?? [];
  filtersToProcess.forEach((f) => {
    // Sanitize string values to prevent query injection
    const sanitizedValue = typeof f.value === 'string' ? sanitizeQueryValue(f.value) : f.value;
    criteriaArr.push({ field: f.field, value: sanitizedValue, operator: f.operator });
  });

  // Sorting
  if (options.asc) {
    criteriaArr.push({ field: 'asc', value: options.asc });
  }
  if (options.desc) {
    criteriaArr.push({ field: 'desc', value: options.desc });
  }

  // Pagination / meta
  if (typeof options.limit === 'number') {
    criteriaArr.push({ field: 'limit', value: options.limit });
  }
  if (typeof options.offset === 'number') {
    criteriaArr.push({ field: 'offset', value: options.offset });
  }
  if (options.fetchAll) {
    criteriaArr.push({ field: 'fetchAll', value: true });
  }

  // Handle count mode: node-quickbooks looks for a top-level `count: true` property,
  // NOT `{field: 'count', value: true}`. We must insert it at index 0 to work around
  // a splice bug in node-quickbooks that removes extra elements at higher indices.
  if (options.count) {
    criteriaArr.unshift({ count: true });
  }

  // If nothing ended up in the array, return empty object so Quickbooks returns all items.
  return criteriaArr.length > 0 ? criteriaArr : {};
}

/**
 * Check if a criteria array/object has count mode enabled.
 * node-quickbooks looks for `{count: true}` objects in the criteria array.
 */
export function isCountQuery(criteria: Record<string, any> | Array<Record<string, any>>): boolean {
  if (Array.isArray(criteria)) {
    return criteria.some((c) => c.count === true);
  }
  return criteria?.count === true;
}

/**
 * Extract the appropriate result from a QueryResponse.
 *
 * When a count query is performed, node-quickbooks returns `{QueryResponse: {totalCount: N}}`.
 * When a normal query is performed, it returns `{QueryResponse: {EntityName: [...]}}`.
 *
 * @param queryResponse - The raw response from node-quickbooks findXxx methods
 * @param entityKey - The key for the entity in QueryResponse (e.g., 'Invoice', 'Item', 'Customer')
 * @param isCount - Whether this was a count query
 * @returns The entity array, or totalCount as a number for count queries
 */
export function extractQueryResult(
  queryResponse: any,
  entityKey: string,
  isCount: boolean
): any[] | number {
  const qr = queryResponse?.QueryResponse;
  if (!qr) {
    return isCount ? 0 : [];
  }

  if (isCount) {
    // For count queries, return the totalCount as a number
    return typeof qr.totalCount === 'number' ? qr.totalCount : 0;
  }

  // For normal queries, return the entity array
  return qr[entityKey] || [];
}
