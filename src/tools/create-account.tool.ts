import { createQuickbooksAccount } from "../handlers/create-quickbooks-account.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

const toolName = "create_account";
const toolDescription = "Create a chart‑of‑accounts entry in QuickBooks Online.";

const toolSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  sub_type: z.string().optional(),
  description: z.string().optional(),
});

const toolHandler = async ({ params }: any) => {
  const startTime = Date.now();
  
  logToolRequest(toolName, params);

  try {
    const response = await createQuickbooksAccount(params);
    
    if (response.isError) {
      logger.error('Failed to create account', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return { content: [{ type: "text" as const, text: `Error creating account: ${response.error}` }] };
    }

    logger.info('Account created successfully', {
      accountId: response.result?.Id,
      name: response.result?.Name,
      type: response.result?.AccountType,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Account created successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in create_account', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
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