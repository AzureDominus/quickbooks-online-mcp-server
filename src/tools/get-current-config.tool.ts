import { z } from 'zod';
import { ToolDefinition } from '../types/tool-definition.js';
import { getPublicConfig, loadQuickbooksConfig } from '../helpers/config.js';
import { logToolRequest, logToolResponse, logger } from '../helpers/logger.js';

const toolName = 'get_current_config';
const toolDescription =
  'Return the resolved QuickBooks configuration, including profile, environment, realm ID, and paths.';

const toolSchema = z.object({});

const toolHandler = async (_args: Record<string, unknown>) => {
  const startTime = Date.now();
  logToolRequest(toolName, {});

  try {
    const config = loadQuickbooksConfig();
    const payload = getPublicConfig(config);

    logToolResponse(toolName, true, Date.now() - startTime);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    };
  } catch (error) {
    logger.error('Failed to resolve current config', error);
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

export const GetCurrentConfigTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
