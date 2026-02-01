import { readQuickbooksItem } from '../handlers/read-quickbooks-item.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

const toolName = 'read_item';
const toolDescription = 'Read a single item in QuickBooks Online by its ID.';

const toolSchema = z.object({
  item_id: z.string().min(1, { message: 'Item ID is required' }),
});

type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const { item_id } = args as ToolInput;
  logToolRequest('read_item', { item_id });
  const startTime = Date.now();

  try {
    const response = await readQuickbooksItem(item_id);

    if (response.isError) {
      logToolResponse('read_item', false, Date.now() - startTime);
      logger.error(`Failed to read item: ${response.error}`, undefined, { itemId: item_id });
      return {
        content: [
          { type: 'text' as const, text: `Error reading item ${item_id}: ${response.error}` },
        ],
      };
    }

    logToolResponse('read_item', true, Date.now() - startTime);
    logger.info('Item read successfully', { itemId: item_id });
    return {
      content: [
        { type: 'text' as const, text: `Item details for ID ${item_id}:` },
        { type: 'text' as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logToolResponse('read_item', false, Date.now() - startTime);
    logger.error('Failed to read item', error, { itemId: item_id });
    throw error;
  }
};

export const ReadItemTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
