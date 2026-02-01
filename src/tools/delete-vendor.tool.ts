import { deleteQuickbooksVendor } from '../handlers/delete-quickbooks-vendor.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

const toolName = 'delete_vendor';
const toolDescription = 'Delete a vendor in QuickBooks Online.';
const toolSchema = z.object({
  vendor: z.object({
    Id: z.string(),
    SyncToken: z.string(),
  }),
});

const toolHandler = async (args: { [x: string]: any }) => {
  logToolRequest('delete_vendor', args);
  const startTime = Date.now();

  try {
    const response = await deleteQuickbooksVendor(args.vendor);

    if (response.isError) {
      logToolResponse('delete_vendor', false, Date.now() - startTime);
      logger.error(`Failed to delete vendor: ${response.error}`, undefined, {
        vendorId: args.vendor?.Id,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error deleting vendor: ${response.error}`,
          },
        ],
      };
    }

    const vendor = response.result;

    logToolResponse('delete_vendor', true, Date.now() - startTime);
    logger.info('Vendor deleted successfully', { vendorId: args.vendor?.Id });
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(vendor),
        },
      ],
    };
  } catch (error) {
    logToolResponse('delete_vendor', false, Date.now() - startTime);
    logger.error('Failed to delete vendor', error, { vendorId: args.vendor?.Id });
    throw error;
  }
};

export const DeleteVendorTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
