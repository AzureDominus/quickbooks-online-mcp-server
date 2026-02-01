import { getQuickbooksBillPayment } from '../handlers/get-quickbooks-bill-payment.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

// Define the tool metadata
const toolName = 'get_bill_payment';
const toolDescription = 'Get a bill payment by Id from QuickBooks Online.';

// Define the expected input schema for getting a bill payment
const toolSchema = z.object({
  id: z.string(),
});

// Define the tool handler
const toolHandler = async (args: any) => {
  logToolRequest('get_bill_payment', args);
  const startTime = Date.now();

  try {
    const response = await getQuickbooksBillPayment(args.id);

    if (response.isError) {
      logToolResponse('get_bill_payment', false, Date.now() - startTime);
      logger.error(`Failed to get bill payment: ${response.error}`, undefined, {
        billPaymentId: args.id,
      });
      return {
        content: [{ type: 'text' as const, text: `Error getting bill payment: ${response.error}` }],
      };
    }

    logToolResponse('get_bill_payment', true, Date.now() - startTime);
    logger.info('Bill payment retrieved successfully', { billPaymentId: args.id });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logToolResponse('get_bill_payment', false, Date.now() - startTime);
    logger.error('Failed to get bill payment', error, { billPaymentId: args.id });
    throw error;
  }
};

export const GetBillPaymentTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
