import { z } from 'zod';
import { quickbooksClient } from '../clients/quickbooks-client.js';
import { logToolRequest, logToolResponse, logger } from '../helpers/logger.js';
import { ToolDefinition } from '../types/tool-definition.js';

const toolName = 'logout';
const toolDescription =
  'Clear stored OAuth tokens and pending OAuth state for the current profile.';

const toolSchema = z.object({});

const toolHandler = async (_args: Record<string, unknown>) => {
  const startTime = Date.now();
  logToolRequest(toolName, {});

  try {
    const { tokenPath, oauthStatePath } = quickbooksClient.logout();

    logToolResponse(toolName, true, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            tokenPath,
            oauthStatePath,
          }),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to logout', error);
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

export const LogoutTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
