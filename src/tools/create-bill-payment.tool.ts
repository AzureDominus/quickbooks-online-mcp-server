import { createQuickbooksBillPayment } from "../handlers/create-quickbooks-bill-payment.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";
import { checkIdempotency, storeIdempotency } from "../helpers/idempotency.js";

// Define the tool metadata
const toolName = "create_bill_payment";
const toolDescription = `Create a bill payment in QuickBooks Online.

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original bill payment ID is returned`;

// Define the expected input schema for creating a bill payment
const toolSchema = z.object({
  billPayment: z.any(),
  idempotencyKey: z.string().optional().describe("Optional key to prevent duplicate creation"),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  const startTime = Date.now();
  const input = args.billPayment;
  const idempotencyKey = args.idempotencyKey as string | undefined;

  logToolRequest(toolName, { 
    hasIdempotencyKey: !!idempotencyKey,
  });

  try {
    // Check idempotency first
    const existingId = checkIdempotency(idempotencyKey);
    if (existingId) {
      logger.info('Idempotency hit - returning cached result', {
        idempotencyKey,
        existingId,
      });
      
      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Bill payment already exists (idempotent):` },
          { type: "text" as const, text: JSON.stringify({ Id: existingId, wasIdempotent: true }) },
        ],
      };
    }

    if (idempotencyKey) {
      logger.info('Idempotency miss - proceeding with creation', { idempotencyKey });
    }

    const response = await createQuickbooksBillPayment(input);

    if (response.isError) {
      logger.error('Failed to create bill payment', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error creating bill payment: ${response.error}` },
        ],
      };
    }

    // Store idempotency result
    if (response.result?.Id) {
      storeIdempotency(idempotencyKey, response.result.Id, 'BillPayment');
    }

    logger.info('Bill payment created successfully', {
      billPaymentId: response.result?.Id,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Bill payment created:` },
        { type: "text" as const, text: JSON.stringify(response.result) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in create_bill_payment', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
    };
  }
};

export const CreateBillPaymentTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 