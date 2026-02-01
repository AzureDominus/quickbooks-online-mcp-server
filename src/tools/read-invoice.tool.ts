import { readQuickbooksInvoice } from '../handlers/read-quickbooks-invoice.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

const toolName = 'read_invoice';
const toolDescription = 'Read a single invoice from QuickBooks Online by its ID.';

const toolSchema = z.object({
  invoice_id: z.string().min(1, { message: 'Invoice ID is required' }),
});

type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const { invoice_id } = args as ToolInput;
  logToolRequest('read_invoice', { invoice_id });
  const startTime = Date.now();

  try {
    const response = await readQuickbooksInvoice(invoice_id);

    if (response.isError) {
      logToolResponse('read_invoice', false, Date.now() - startTime);
      logger.error(`Failed to read invoice: ${response.error}`, undefined, {
        invoiceId: invoice_id,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error reading invoice ${invoice_id}: ${response.error}`,
          },
        ],
      };
    }

    logToolResponse('read_invoice', true, Date.now() - startTime);
    logger.info('Invoice read successfully', { invoiceId: invoice_id });
    return {
      content: [
        {
          type: 'text' as const,
          text: `Invoice details for ID ${invoice_id}:`,
        },
        {
          type: 'text' as const,
          text: JSON.stringify(response.result, null, 2),
        },
      ],
    };
  } catch (error) {
    logToolResponse('read_invoice', false, Date.now() - startTime);
    logger.error('Failed to read invoice', error, { invoiceId: invoice_id });
    throw error;
  }
};

export const ReadInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
