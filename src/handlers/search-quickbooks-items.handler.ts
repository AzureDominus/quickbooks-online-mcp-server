import { quickbooksClient } from '../clients/quickbooks-client.js';
import { ToolResponse } from '../types/tool-response.js';
import { formatError } from '../helpers/format-error.js';
import {
  buildQuickbooksSearchCriteria,
  isCountQuery,
  extractQueryResult,
  QuickbooksSearchCriteriaInput,
} from '../helpers/build-quickbooks-search-criteria.js';

export type ItemSearchCriteria = QuickbooksSearchCriteriaInput;

export async function searchQuickbooksItems(
  criteria: ItemSearchCriteria
): Promise<ToolResponse<any[] | number>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();
    const normalizedCriteria = buildQuickbooksSearchCriteria(criteria);
    const countMode = isCountQuery(normalizedCriteria);

    return new Promise((resolve) => {
      (quickbooks as any).findItems(normalizedCriteria, (err: any, items: any) => {
        if (err) {
          resolve({ result: null, isError: true, error: formatError(err) });
        } else {
          const result = extractQueryResult(items, 'Item', countMode);
          resolve({ result, isError: false, error: null });
        }
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
