import { deleteQuickbooksPurchase } from "../handlers/delete-quickbooks-purchase.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { DeleteInputSchema } from "../types/qbo-schemas.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "delete_purchase";
const toolDescription = `Delete (void) a purchase/expense in QuickBooks Online.

REQUIRED FIELDS:
- Id: Purchase ID to delete (required)
- SyncToken: Current sync token (required for optimistic locking)

NOTE: This operation voids the purchase rather than permanently deleting it.
The transaction will be marked as deleted but remains in the system for audit purposes.

To get the SyncToken, first retrieve the purchase using get_purchase.

Example:
{
  "Id": "123",
  "SyncToken": "2"
}`;

// Define the expected input schema for deleting a purchase
const toolSchema = z.object({
  idOrEntity: DeleteInputSchema.describe("Purchase to delete with Id and SyncToken"),
});

// Define the tool handler
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.idOrEntity as z.infer<typeof DeleteInputSchema>;
  
  logToolRequest(toolName, { Id: input.Id });

  try {
    const response = await deleteQuickbooksPurchase(input);

    if (response.isError) {
      logger.error('Failed to delete purchase', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error deleting purchase: ${response.error}` },
        ],
      };
    }

    logger.info('Purchase deleted successfully', { purchaseId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Purchase deleted successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in delete_purchase', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const DeletePurchaseTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 