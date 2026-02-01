import { getAttachments } from '../handlers/upload-attachment.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';

const toolName = 'get_attachments';
const toolDescription =
  'Get all attachments linked to a QuickBooks entity (Purchase, Invoice, Bill, etc.)';

const toolSchema = z.object({
  entity_type: z
    .enum(['Purchase', 'Invoice', 'Bill', 'Estimate', 'Vendor', 'Customer', 'JournalEntry'])
    .describe('QuickBooks entity type'),
  entity_id: z.string().min(1).describe('ID of the entity'),
});

type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const { entity_type, entity_id } = args as ToolInput;
  const response = await getAttachments(entity_type, entity_id);

  if (response.isError) {
    return {
      content: [{ type: 'text' as const, text: `Error getting attachments: ${response.error}` }],
    };
  }

  const attachments = response.result || [];

  if (attachments.length === 0) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ count: 0, attachments: [] }) }],
    };
  }

  return {
    content: [
      { type: 'text' as const, text: JSON.stringify({ count: attachments.length, attachments }) },
    ],
  };
};

export const GetAttachmentsTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
