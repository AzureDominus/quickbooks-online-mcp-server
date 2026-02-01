import { getQuickbooksCustomer } from '../handlers/get-quickbooks-customer.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

const toolName = 'get_customer';
const toolDescription = 'Get a customer by Id from QuickBooks Online.';
const toolSchema = z.object({ id: z.string() });

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  logToolRequest('get_customer', args);
  const startTime = Date.now();
  const typedArgs = args as ToolInput;
  const id = typedArgs.id;

  if (!id) {
    return { content: [{ type: 'text' as const, text: "Error: Missing required parameter 'id'" }] };
  }

  try {
    const response = await getQuickbooksCustomer(id);

    if (response.isError) {
      logToolResponse('get_customer', false, Date.now() - startTime);
      logger.error(`Failed to get customer: ${response.error}`, undefined, { customerId: id });
      return {
        content: [{ type: 'text' as const, text: `Error getting customer: ${response.error}` }],
      };
    }

    logToolResponse('get_customer', true, Date.now() - startTime);
    logger.info('Customer retrieved successfully', { customerId: id });
    return {
      content: [
        { type: 'text' as const, text: `Customer:` },
        { type: 'text' as const, text: JSON.stringify(response.result) },
      ],
    };
  } catch (error) {
    logToolResponse('get_customer', false, Date.now() - startTime);
    logger.error('Failed to get customer', error, { customerId: id });
    throw error;
  }
};

export const GetCustomerTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
