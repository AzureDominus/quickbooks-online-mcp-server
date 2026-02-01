import { quickbooksClient } from '../clients/quickbooks-client.js';
import { ToolResponse } from '../types/tool-response.js';
import { formatError } from '../helpers/format-error.js';
import {
  buildQuickbooksSearchCriteria,
  isCountQuery,
  extractQueryResult,
} from '../helpers/build-quickbooks-search-criteria.js';

/**
 * Search bill payments in QuickBooks Online that match given criteria
 */
export async function searchQuickbooksBillPayments(
  params: any
): Promise<ToolResponse<any[] | number>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    const criteria = buildQuickbooksSearchCriteria(params);
    const countMode = isCountQuery(criteria);

    return new Promise((resolve) => {
      quickbooks.findBillPayments(criteria, (err: any, billPayments: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          const result = extractQueryResult(billPayments, 'BillPayment', countMode);
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
