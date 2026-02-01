import { quickbooksClient } from '../clients/quickbooks-client.js';
import { ToolResponse } from '../types/tool-response.js';
import { formatError } from '../helpers/format-error.js';
import { sanitizeQueryValue } from '../helpers/sanitize.js';
import { extractQueryResult } from '../helpers/build-quickbooks-search-criteria.js';

interface CustomerSearchCriterion {
  field: string;
  value: any;
  operator?: string;
}

interface CustomerSearchParams {
  criteria?: CustomerSearchCriterion[];
  asc?: string;
  desc?: string;
  limit?: number;
  offset?: number;
  count?: boolean;
  fetchAll?: boolean;
}

/**
 * Search customers from QuickBooks Online.
 *
 * Accepts either:
 *   • A plain criteria object (key/value pairs) – passed directly to findCustomers
 *   • An **array** of objects in the `{ field, value, operator? }` shape – this
 *     allows use of operators such as `IN`, `LIKE`, `>`, `<`, `>=`, `<=` etc.
 *
 * Pagination / sorting options such as `limit`, `offset`, `asc`, `desc`,
 * `fetchAll`, `count` can be supplied via the top‑level criteria object or as
 * dedicated entries in the array form (see README in user prompt).
 */
export async function searchQuickbooksCustomers(
  params: CustomerSearchParams | Array<Record<string, any>> = {}
): Promise<ToolResponse<any[] | number>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    // Build the criteria array for node-quickbooks findCustomers
    // node-quickbooks accepts an array of {field, value, operator?} objects
    let criteriaArray: Array<Record<string, any>> = [];
    let countMode = false;

    if (Array.isArray(params)) {
      // Legacy array format - pass through directly with type assertion
      criteriaArray = params as Array<Record<string, any>>;
      // Check if count mode is requested in array format
      countMode = params.some((c) => c.count === true);
    } else {
      // Object format with criteria array and options
      const { criteria = [], asc, desc, limit, offset, count, fetchAll } = params;
      countMode = !!count;

      // Handle count mode: node-quickbooks looks for a top-level `count: true` property,
      // NOT `{field: 'count', value: true}`. We must insert it at index 0 to work around
      // a splice bug in node-quickbooks that removes extra elements at higher indices.
      if (count) {
        criteriaArray.push({ count: true });
      }

      // Add filter criteria
      for (const c of criteria) {
        // Sanitize string values to prevent query injection
        const sanitizedValue = typeof c.value === 'string' ? sanitizeQueryValue(c.value) : c.value;
        criteriaArray.push({
          field: c.field,
          value: sanitizedValue,
          operator: c.operator,
        });
      }

      // Add sorting
      if (asc) {
        criteriaArray.push({ field: 'asc', value: asc });
      }
      if (desc) {
        criteriaArray.push({ field: 'desc', value: desc });
      }

      // Add pagination
      if (typeof limit === 'number') {
        criteriaArray.push({ field: 'limit', value: limit });
      }
      if (typeof offset === 'number') {
        criteriaArray.push({ field: 'offset', value: offset });
      }

      // Add fetchAll flag
      if (fetchAll) {
        criteriaArray.push({ field: 'fetchAll', value: true });
      }
    }

    return new Promise((resolve) => {
      (quickbooks as any).findCustomers(criteriaArray, (err: any, customers: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          const result = extractQueryResult(customers, 'Customer', countMode);
          resolve({
            result,
            isError: false,
            error: null,
          });
        }
      });
    });
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
