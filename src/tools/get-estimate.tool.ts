import { getQuickbooksEstimate } from '../handlers/get-quickbooks-estimate.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

const toolName = 'get_estimate';
const toolDescription = 'Get an estimate by Id from QuickBooks Online.';
const toolSchema = z.object({ id: z.string() });

const toolHandler = async (args: any) => {
  logToolRequest('get_estimate', args);
  const startTime = Date.now();

  try {
    const response = await getQuickbooksEstimate(args.id);
    if (response.isError) {
      logToolResponse('get_estimate', false, Date.now() - startTime);
      logger.error(`Failed to get estimate: ${response.error}`, undefined, { estimateId: args.id });
      return {
        content: [{ type: 'text' as const, text: `Error getting estimate: ${response.error}` }],
      };
    }

    logToolResponse('get_estimate', true, Date.now() - startTime);
    logger.info('Estimate retrieved successfully', { estimateId: args.id });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logToolResponse('get_estimate', false, Date.now() - startTime);
    logger.error('Failed to get estimate', error, { estimateId: args.id });
    throw error;
  }
};

export const GetEstimateTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
