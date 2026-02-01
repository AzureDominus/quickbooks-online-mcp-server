import { quickbooksClient } from '../clients/quickbooks-client.js';
import { ToolResponse } from '../types/tool-response.js';
import { formatError } from '../helpers/format-error.js';
import {
  buildQuickbooksSearchCriteria,
  isCountQuery,
  extractQueryResult,
  QuickbooksSearchCriteriaInput,
} from '../helpers/build-quickbooks-search-criteria.js';

export type InvoiceSearchCriteria = QuickbooksSearchCriteriaInput;

/**
 * Search for invoices in QuickBooks Online using criteria supported by node-quickbooks findInvoices.
 */
export async function searchQuickbooksInvoices(
  criteria: InvoiceSearchCriteria
): Promise<ToolResponse<any[] | number>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();
    const normalizedCriteria = buildQuickbooksSearchCriteria(criteria);
    const countMode = isCountQuery(normalizedCriteria);

    return new Promise((resolve) => {
      (quickbooks as any).findInvoices(normalizedCriteria, (err: any, invoices: any) => {
        if (err) {
          resolve({ result: null, isError: true, error: formatError(err) });
        } else {
          const result = extractQueryResult(invoices, 'Invoice', countMode);
          resolve({
            result,
            isError: false,
            error: null,
          });
        }
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
