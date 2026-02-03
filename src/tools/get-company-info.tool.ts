import { z } from 'zod';
import { getCompanyInfo } from '../handlers/get-company-info.handler.js';
import { logToolRequest, logToolResponse, logger } from '../helpers/logger.js';
import { ToolDefinition } from '../types/tool-definition.js';

const toolName = 'get_company_info';
const toolDescription = 'Fetch the current QuickBooks company info for the authenticated realm.';

const toolSchema = z.object({});

const toolHandler = async (_args: Record<string, unknown>) => {
  const startTime = Date.now();
  logToolRequest(toolName, {});

  try {
    const response = await getCompanyInfo();

    if (response.isError) {
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error: ${response.error}` }],
      };
    }

    logToolResponse(toolName, true, Date.now() - startTime);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logger.error('Unexpected error fetching company info', error);
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

export const GetCompanyInfoTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
