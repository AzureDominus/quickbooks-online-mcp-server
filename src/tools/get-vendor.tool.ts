import { getQuickbooksVendor } from '../handlers/get-quickbooks-vendor.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

const toolName = 'get_vendor';
const toolDescription = 'Get a vendor by ID from QuickBooks Online.';
const toolSchema = z.object({
  id: z.string(),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  logToolRequest('get_vendor', args);
  const startTime = Date.now();
  const typedArgs = args as ToolInput;

  try {
    const response = await getQuickbooksVendor(typedArgs.id);

    if (response.isError) {
      logToolResponse('get_vendor', false, Date.now() - startTime);
      logger.error(`Failed to get vendor: ${response.error}`, undefined, {
        vendorId: typedArgs.id,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error getting vendor: ${response.error}`,
          },
        ],
      };
    }

    const vendor = response.result;

    logToolResponse('get_vendor', true, Date.now() - startTime);
    logger.info('Vendor retrieved successfully', { vendorId: args.id });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(vendor) }],
    };
  } catch (error) {
    logToolResponse('get_vendor', false, Date.now() - startTime);
    logger.error('Failed to get vendor', error, { vendorId: args.id });
    throw error;
  }
};

export const GetVendorTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
