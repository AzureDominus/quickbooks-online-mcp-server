import { updateQuickbooksVendor } from '../handlers/update-quickbooks-vendor.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

const toolName = 'update_vendor';
const toolDescription = 'Update a vendor in QuickBooks Online.';
const toolSchema = z.object({
  vendor: z.object({
    Id: z.string(),
    SyncToken: z.string(),
    DisplayName: z.string(),
    GivenName: z.string().optional(),
    FamilyName: z.string().optional(),
    CompanyName: z.string().optional(),
    PrimaryEmailAddr: z
      .object({
        Address: z.string().optional(),
      })
      .optional(),
    PrimaryPhone: z
      .object({
        FreeFormNumber: z.string().optional(),
      })
      .optional(),
    BillAddr: z
      .object({
        Line1: z.string().optional(),
        City: z.string().optional(),
        Country: z.string().optional(),
        CountrySubDivisionCode: z.string().optional(),
        PostalCode: z.string().optional(),
      })
      .optional(),
  }),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  logToolRequest('update_vendor', args);
  const startTime = Date.now();
  const typedArgs = args as ToolInput;

  try {
    const response = await updateQuickbooksVendor(typedArgs.vendor);

    if (response.isError) {
      logToolResponse('update_vendor', false, Date.now() - startTime);
      logger.error(`Failed to update vendor: ${response.error}`, undefined, {
        vendorId: typedArgs.vendor?.Id,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error updating vendor: ${response.error}`,
          },
        ],
      };
    }

    const vendor = response.result;

    logToolResponse('update_vendor', true, Date.now() - startTime);
    logger.info('Vendor updated successfully', { vendorId: typedArgs.vendor?.Id });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(vendor) }],
    };
  } catch (error) {
    logToolResponse('update_vendor', false, Date.now() - startTime);
    logger.error('Failed to update vendor', error, { vendorId: typedArgs.vendor?.Id });
    throw error;
  }
};

export const UpdateVendorTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
