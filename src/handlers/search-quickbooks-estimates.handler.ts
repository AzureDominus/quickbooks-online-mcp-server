import { quickbooksClient } from '../clients/quickbooks-client.js';
import { ToolResponse } from '../types/tool-response.js';
import { formatError } from '../helpers/format-error.js';
import {
  buildQuickbooksSearchCriteria,
  isCountQuery,
  extractQueryResult,
} from '../helpers/build-quickbooks-search-criteria.js';

/**
 * Search estimates from QuickBooks Online using the supplied criteria.
 * The criteria object is processed through buildQuickbooksSearchCriteria
 * and passed to node‑quickbooks `findEstimates`.
 */
export async function searchQuickbooksEstimates(
  params: object | Array<Record<string, any>> = {}
): Promise<ToolResponse<any[] | number>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    const criteria = buildQuickbooksSearchCriteria(params);
    const countMode = isCountQuery(criteria);

    return new Promise((resolve) => {
      (quickbooks as any).findEstimates(criteria as any, (err: any, estimates: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          const result = extractQueryResult(estimates, 'Estimate', countMode);
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
