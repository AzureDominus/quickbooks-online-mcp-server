import { deleteQuickbooksBillPayment } from "../handlers/delete-quickbooks-bill-payment.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { DeleteInputSchema } from "../types/qbo-schemas.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "delete_bill_payment";
const toolDescription = `Delete (void) a bill payment in QuickBooks Online.

REQUIRED FIELDS:
- Id: Bill payment ID to delete (required)
- SyncToken: Current sync token (required for optimistic locking)

NOTE: This operation voids the bill payment rather than permanently deleting it.
The transaction will be marked as deleted but remains in the system for audit purposes.

To get the SyncToken, first retrieve the bill payment using get_bill_payment.

Example:
{
  "idOrEntity": {
    "Id": "123",
    "SyncToken": "2"
  }
}`;

// Define the expected input schema for deleting a bill payment
const toolSchema = z.object({
  idOrEntity: DeleteInputSchema.describe("Bill payment to delete with Id and SyncToken"),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.idOrEntity as z.infer<typeof DeleteInputSchema>;

  logToolRequest(toolName, { Id: input.Id });

  try {
    const response = await deleteQuickbooksBillPayment(input);

    if (response.isError) {
      logger.error('Failed to delete bill payment', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error deleting bill payment: ${response.error}` },
        ],
      };
    }

    logger.info('Bill payment deleted successfully', { billPaymentId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Bill payment deleted successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in delete_bill_payment', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const DeleteBillPaymentTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 