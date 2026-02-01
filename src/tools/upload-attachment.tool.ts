import { uploadAttachment } from '../handlers/upload-attachment.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'upload_attachment';
const toolDescription = `Upload a file attachment (receipt, document) to a QuickBooks entity.

Supports: Purchase (expense), Invoice, Bill, Estimate, etc.
Supported file types: JPEG, PNG, GIF, TIFF, PDF

Use this to attach receipts to expenses after creating them.`;

const toolSchema = z.object({
  file_path: z
    .string()
    .min(1)
    .describe('Path to the file to upload (supports ~ for home directory)'),
  entity_type: z
    .enum(['Purchase', 'Invoice', 'Bill', 'Estimate', 'Vendor', 'Customer', 'JournalEntry'])
    .describe('QuickBooks entity type to attach to'),
  entity_id: z.string().min(1).describe('ID of the entity to attach the file to'),
});

const toolHandler = async (args: any) => {
  logToolRequest(toolName, args);
  const startTime = Date.now();

  try {
    const response = await uploadAttachment({
      filePath: args.file_path,
      entityType: args.entity_type,
      entityId: args.entity_id,
    });

    if (response.isError) {
      logToolResponse(toolName, false, Date.now() - startTime);
      logger.error(`Failed to upload attachment: ${response.error}`, undefined, {
        entityType: args.entity_type,
        entityId: args.entity_id,
      });
      return {
        content: [{ type: 'text' as const, text: `Error uploading attachment: ${response.error}` }],
      };
    }

    logToolResponse(toolName, true, Date.now() - startTime);
    logger.info('Attachment uploaded successfully', {
      entityType: args.entity_type,
      entityId: args.entity_id,
    });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logToolResponse(toolName, false, Date.now() - startTime);
    logger.error('Failed to upload attachment', error, {
      entityType: args?.entity_type,
      entityId: args?.entity_id,
    });
    throw error;
  }
};

export const UploadAttachmentTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
