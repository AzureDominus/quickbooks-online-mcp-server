import { createQuickbooksAccount } from '../handlers/create-quickbooks-account.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { checkIdempotency, storeIdempotency } from '../helpers/idempotency.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'create_account';
const toolDescription = `Create a chart‑of‑accounts entry in QuickBooks Online.

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original account ID is returned`;

const toolSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  sub_type: z.string().optional(),
  description: z.string().optional(),
  idempotencyKey: z
    .string()
    .optional()
    .describe('Optional key to prevent duplicate account creation on retry'),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  // Args are passed directly (RegisterTool extracts raw shape)
  const typedArgs = args as ToolInput;

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
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify({ Id: existingId, wasIdempotent: true }) },
        ],
      };
    }

    const response = await createQuickbooksAccount(typedArgs);

    if (response.isError) {
      logger.error('Failed to create account', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error creating account: ${response.error}` }],
      };
    }

    // Store idempotency result
    if (response.result?.Id) {
      storeIdempotency(typedArgs.idempotencyKey, response.result.Id, 'Account');
    }

    logger.info('Account created successfully', {
      accountId: response.result?.Id,
      name: response.result?.Name,
      type: response.result?.AccountType,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logger.error('Unexpected error in create_account', error);
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

export const CreateAccountTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
