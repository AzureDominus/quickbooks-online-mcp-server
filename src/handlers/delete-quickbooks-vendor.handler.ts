import { quickbooksClient } from '../clients/quickbooks-client.js';
import { ToolResponse } from '../types/tool-response.js';
import { formatError } from '../helpers/format-error.js';

/**
 * Delete (make inactive) a vendor in QuickBooks Online
 * QuickBooks doesn't support hard deletes for vendors, so we set Active=false
 */
export async function deleteQuickbooksVendor(vendor: any): Promise<ToolResponse<any>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    // QuickBooks API doesn't support hard deletes for vendors
    // Instead, we mark them as inactive by setting Active=false
    const updatePayload = {
      Id: vendor.Id,
      SyncToken: vendor.SyncToken,
      Active: false,
      sparse: true,
    };

    return new Promise((resolve) => {
      quickbooks.updateVendor(updatePayload, (err: any, updatedVendor: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          resolve({
            result: updatedVendor,
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
