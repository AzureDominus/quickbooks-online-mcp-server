import { z } from 'zod';
import { quickbooksClient } from '../clients/quickbooks-client.js';
import { logToolRequest, logToolResponse, logger } from '../helpers/logger.js';
import { ToolDefinition } from '../types/tool-definition.js';

const toolName = 'oauth_complete';
const toolDescription =
  'Complete a headless OAuth flow by supplying the redirect URL from the browser. ' +
  'The URL should include code, realmId, and state parameters.';

const toolSchema = z.object({
  redirectUrl: z
    .string()
    .min(1)
    .describe('Full redirect URL (or just the query string) returned after OAuth approval.'),
});

type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  const typedArgs = args as ToolInput;

  logToolRequest(toolName, { redirectUrl: typedArgs.redirectUrl });

  try {
    const result = await quickbooksClient.completeManualOAuth(typedArgs.redirectUrl);

    logToolResponse(toolName, true, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ success: true, realmId: result.realmId }),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to complete manual OAuth flow', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            isError: true,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
    };
  }
};

export const OauthCompleteTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
