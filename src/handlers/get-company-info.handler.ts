import { quickbooksClient } from '../clients/quickbooks-client.js';
import { formatError } from '../helpers/format-error.js';
import { ToolResponse } from '../types/tool-response.js';

export async function getCompanyInfo(): Promise<ToolResponse<any>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks() as any;
    const realmId = quickbooksClient.getRealmId();
    if (!realmId) {
      return {
        result: null,
        isError: true,
        error: 'No realm ID available. Re-authenticate and try again.',
      };
    }

    return new Promise((resolve) => {
      quickbooks.getCompanyInfo(realmId, (err: any, result: any) => {
        if (err) {
          resolve({ result: null, isError: true, error: formatError(err) });
        } else {
          resolve({ result, isError: false, error: null });
        }
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
