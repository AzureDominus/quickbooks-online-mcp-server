import { createQuickbooksItem } from "../handlers/create-quickbooks-item.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { checkIdempotency, storeIdempotency } from "../helpers/idempotency.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

const toolName = "create_item";
const toolDescription = `Create an item in QuickBooks Online.

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original item ID is returned`;

const toolSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  income_account_ref: z.string().min(1),
  expense_account_ref: z.string().optional(),
  unit_price: z.number().optional(),
  description: z.string().optional(),
  idempotencyKey: z.string().optional().describe("Optional key to prevent duplicate item creation on retry"),
});

const toolHandler = async ({ params }: any) => {
  const startTime = Date.now();
  
  logToolRequest(toolName, params);

  try {
    // Check idempotency first
    const existingId = checkIdempotency(params.idempotencyKey);
    if (existingId) {
      logger.info('Idempotency hit - returning cached result', {
        idempotencyKey: params.idempotencyKey,
        existingId,
      });
      
      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Item already exists (idempotent):` },
          { type: "text" as const, text: JSON.stringify({ Id: existingId, wasIdempotent: true }) },
        ],
      };
    }

    const response = await createQuickbooksItem(params);
    
    if (response.isError) {
      logger.error('Failed to create item', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return { content: [{ type: "text" as const, text: `Error creating item: ${response.error}` }] };
    }

    // Store idempotency result
    if (response.result?.Id) {
      storeIdempotency(params.idempotencyKey, response.result.Id, 'Item');
    }

    logger.info('Item created successfully', {
      itemId: response.result?.Id,
      name: response.result?.Name,
      type: response.result?.Type,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Item created successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in create_item', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const CreateItemTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 