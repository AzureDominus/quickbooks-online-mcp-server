import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { logger } from "../helpers/logger.js";

/**
 * Update a bill in QuickBooks Online
 */
export async function updateQuickbooksBill(bill: any): Promise<ToolResponse<any>> {
  logger.info("Updating bill in QuickBooks", { billId: bill?.Id, syncToken: bill?.SyncToken });

  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    return new Promise((resolve) => {
      quickbooks.updateBill(bill, (err: any, updatedBill: any) => {
        if (err) {
          logger.error("Failed to update bill in QuickBooks", err, { billId: bill?.Id });
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          logger.info("Bill updated successfully in QuickBooks", { 
            billId: updatedBill?.Id, 
            newSyncToken: updatedBill?.SyncToken 
          });
          resolve({
            result: updatedBill,
            isError: false,
            error: null,
          });
        }
      });
    });
  } catch (error) {
    logger.error("Exception updating bill in QuickBooks", error, { billId: bill?.Id });
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
} 