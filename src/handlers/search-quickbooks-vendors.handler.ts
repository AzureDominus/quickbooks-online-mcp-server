import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

interface VendorSearchCriterion {
  field: string;
  value: any;
  operator?: string;
}

interface VendorSearchParams {
  criteria?: VendorSearchCriterion[];
  asc?: string;
  desc?: string;
  limit?: number;
  offset?: number;
  count?: boolean;
  fetchAll?: boolean;
}

/**
 * Search vendors from QuickBooks Online.
 *
 * Accepts either:
 *   • A plain criteria object (key/value pairs) – passed directly to findVendors
 *   • An **array** of objects in the `{ field, value, operator? }` shape – this
 *     allows use of operators such as `IN`, `LIKE`, `>`, `<`, `>=`, `<=` etc.
 *
 * Pagination / sorting options such as `limit`, `offset`, `asc`, `desc`,
 * `fetchAll`, `count` can be supplied via the top‑level criteria object or as
 * dedicated entries in the array form.
 */
export async function searchQuickbooksVendors(params: VendorSearchParams | Array<Record<string, any>> = {}): Promise<ToolResponse<any[]>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    // Build the criteria array for node-quickbooks findVendors
    // node-quickbooks accepts an array of {field, value, operator?} objects
    let criteriaArray: Array<{ field: string; value: any; operator?: string }> = [];

    if (Array.isArray(params)) {
      // Legacy array format - pass through directly with type assertion
      criteriaArray = params as Array<{ field: string; value: any; operator?: string }>;
    } else {
      // Object format with criteria array and options
      const { criteria = [], asc, desc, limit, offset, count, fetchAll } = params;

      // Add filter criteria
      for (const c of criteria) {
        criteriaArray.push({
          field: c.field,
          value: c.value,
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

      // Add count flag
      if (count) {
        criteriaArray.push({ field: 'count', value: true });
      }

      // Add fetchAll flag
      if (fetchAll) {
        criteriaArray.push({ field: 'fetchAll', value: true });
      }
    }

    // If no criteria at all, pass empty object to get all vendors
    const findCriteria = criteriaArray.length > 0 ? criteriaArray : {};

    return new Promise((resolve) => {
      (quickbooks as any).findVendors(findCriteria, (err: any, vendors: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          resolve({
            result:
              vendors?.QueryResponse?.Vendor ??
              vendors?.QueryResponse?.totalCount ??
              [],
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