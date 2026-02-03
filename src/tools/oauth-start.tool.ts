import { z } from 'zod';
import { quickbooksClient } from '../clients/quickbooks-client.js';
import { logToolRequest, logToolResponse, logger } from '../helpers/logger.js';
import { ToolDefinition } from '../types/tool-definition.js';

const toolName = 'oauth_start';
const toolDescription =
  'Start a headless OAuth flow. Returns an authorization URL and redirect URI. ' +
  'Open the URL in a browser, then call oauth_complete with the final redirect URL.';

const toolSchema = z.object({});

const toolHandler = async (_args: Record<string, unknown>) => {
  const startTime = Date.now();
  logToolRequest(toolName, {});

  try {
    const { authUrl, redirectUri, state } = quickbooksClient.beginManualOAuth();

    logToolResponse(toolName, true, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ authUrl, redirectUri, state }),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to start manual OAuth flow', error);
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

export const OauthStartTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
