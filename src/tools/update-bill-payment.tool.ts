import { updateQuickbooksBillPayment } from "../handlers/update-quickbooks-bill-payment.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { UpdateBillPaymentInputSchema } from "../types/qbo-schemas.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "update_bill_payment";
const toolDescription = `Update an existing bill payment in QuickBooks Online.

REQUIRED FIELDS:
- Id: Bill payment ID to update (required)
- SyncToken: Current sync token (required for optimistic locking)

OPTIONAL FIELDS:
- VendorRef: Vendor reference
- Line: Payment lines (bills being paid)
- TotalAmt: Total payment amount
- PayType: Payment type (Check or CreditCard)
- CheckPayment: Check details (BankAccountRef, PrintStatus)
- CreditCardPayment: Credit card details (CCAccountRef)
- TxnDate: Payment date (YYYY-MM-DD)
- DocNumber: Reference number
- PrivateNote: Internal note

NOTE: Get the bill payment first to obtain the current SyncToken.

Example:
{
  "Id": "123",
  "SyncToken": "1",
  "PrivateNote": "Updated payment note"
}`;

// Define the expected input schema for updating a bill payment
const toolSchema = z.object({
  billPayment: UpdateBillPaymentInputSchema,
});

// Define the tool handler - MCP SDK passes parsed args directly
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.billPayment as z.infer<typeof UpdateBillPaymentInputSchema>;
  
  logToolRequest(toolName, { Id: input.Id });

  try {
    const response = await updateQuickbooksBillPayment(input);

    if (response.isError) {
      logger.error('Failed to update bill payment', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error updating bill payment: ${response.error}` },
        ],
      };
    }

    logger.info('Bill payment updated successfully', { billPaymentId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Bill payment updated successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in update_bill_payment', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const UpdateBillPaymentTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 