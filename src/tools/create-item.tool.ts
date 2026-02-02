import { createQuickbooksItem } from '../handlers/create-quickbooks-item.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { checkIdempotency, storeIdempotency } from '../helpers/idempotency.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { buildCreateToolPayload } from '../helpers/create-tool-output.js';

const toolName = 'create_item';
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
  idempotencyKey: z
    .string()
    .optional()
    .describe('Optional key to prevent duplicate item creation on retry'),
  responseFormat: z
    .enum(['raw', 'envelope'])
    .optional()
    .describe(
      "Optional output format. 'raw' preserves existing output; 'envelope' wraps with meta."
    ),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  // Args are passed directly (RegisterTool extracts raw shape)
  const typedArgs = args as ToolInput;
  const responseFormat = typedArgs.responseFormat;

  logToolRequest(toolName, typedArgs);

  try {
    // Check idempotency first
    const existingId = checkIdempotency(typedArgs.idempotencyKey);
    if (existingId) {
      logger.info('Idempotency hit - returning cached result', {
        idempotencyKey: typedArgs.idempotencyKey,
        existingId,
      });

      logToolResponse(toolName, true, Date.now() - startTime);

      const payload = buildCreateToolPayload({
        entityType: 'Item',
        id: existingId,
        wasIdempotent: true,
        format: responseFormat,
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
      };
    }

    const response = await createQuickbooksItem(typedArgs);

    if (response.isError) {
      logger.error('Failed to create item', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error creating item: ${response.error}` }],
      };
    }

    // Store idempotency result
    if (response.result?.Id) {
      storeIdempotency(typedArgs.idempotencyKey, response.result.Id, 'Item');
    }

    logger.info('Item created successfully', {
      itemId: response.result?.Id,
      name: response.result?.Name,
      type: response.result?.Type,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    const payload = buildCreateToolPayload({
      entityType: 'Item',
      entity: response.result,
      wasIdempotent: false,
      format: responseFormat,
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    };
  } catch (error) {
    logger.error('Unexpected error in create_item', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
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
