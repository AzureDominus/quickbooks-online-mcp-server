import { quickbooksClient } from "../clients/quickbooks-client.js";
import { ToolResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

/**
 * Get a single tax code by ID from QuickBooks Online
 */
export async function getTaxCode(id: string): Promise<ToolResponse<any>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks() as any;

    return new Promise((resolve) => {
      quickbooks.getTaxCode(id, (err: any, taxCode: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          resolve({
            result: taxCode,
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

/**
 * Search/list tax codes from QuickBooks Online
 */
export async function searchTaxCodes(criteria: any): Promise<ToolResponse<any[]>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks() as any;

    return new Promise((resolve) => {
      quickbooks.findTaxCodes(criteria, (err: any, taxCodes: any) => {
        if (err) {
          resolve({
            result: null,
            isError: true,
            error: formatError(err),
          });
        } else {
          // findTaxCodes returns { QueryResponse: { TaxCode: [...] } }
          const results = taxCodes?.QueryResponse?.TaxCode || [];
          resolve({
            result: results,
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
