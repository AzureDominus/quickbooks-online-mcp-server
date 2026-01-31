import { updateQuickbooksEstimate } from "../handlers/update-quickbooks-estimate.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { UpdateEstimateInputSchema } from "../types/qbo-schemas.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

const toolName = "update_estimate";
const toolDescription = `Update an existing estimate in QuickBooks Online.

REQUIRED FIELDS:
- Id: Estimate ID to update (required)
- SyncToken: Current sync token of the estimate (required for optimistic locking)

OPTIONAL FIELDS (provide any to update):
- CustomerRef: Customer reference (object with value field)
- Line: Array of estimate line items (replaces all existing lines)
- TxnDate: Estimate date (YYYY-MM-DD)
- ExpirationDate: Expiration date (YYYY-MM-DD)
- DocNumber: Estimate number
- CustomerMemo: Memo visible to customer
- PrivateNote: Internal note
- BillEmail: Email for sending estimate
- BillAddr: Billing address
- ShipAddr: Shipping address
- TxnStatus: Status (Pending, Accepted, Closed, Rejected)
- GlobalTaxCalculation: Tax calculation mode

NOTE: To update, you must first get the current estimate to obtain the SyncToken.
The SyncToken prevents concurrent update conflicts.

Example:
{
  "Id": "123",
  "SyncToken": "2",
  "TxnStatus": "Accepted",
  "PrivateNote": "Customer confirmed order"
}`;

const toolSchema = z.object({ estimate: UpdateEstimateInputSchema });

// MCP SDK passes parsed args directly
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.estimate as z.infer<typeof UpdateEstimateInputSchema>;
  
  logToolRequest(toolName, { Id: input.Id });

  try {
    const response = await updateQuickbooksEstimate(input);
    
    if (response.isError) {
      logger.error('Failed to update estimate', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return { content: [{ type: "text" as const, text: `Error updating estimate: ${response.error}` }] };
    }
    
    logger.info('Estimate updated successfully', { estimateId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);
    
    return {
      content: [
        { type: "text" as const, text: `Estimate updated successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in update_estimate', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
    };
  }
};

export const UpdateEstimateTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 