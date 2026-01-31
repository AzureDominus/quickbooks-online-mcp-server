import { getQuickbooksVendor } from "../handlers/get-quickbooks-vendor.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";
import { z } from "zod";

const toolName = "get-vendor";
const toolDescription = "Get a vendor by ID from QuickBooks Online.";
const toolSchema = z.object({
  id: z.string(),
});

const toolHandler = async (args: { [x: string]: any }) => {
  logToolRequest("get_vendor", args);
  const startTime = Date.now();

  try {
    const response = await getQuickbooksVendor(args.id);

    if (response.isError) {
      logToolResponse("get_vendor", false, Date.now() - startTime);
      logger.error(`Failed to get vendor: ${response.error}`, undefined, { vendorId: args.id });
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting vendor: ${response.error}`,
          },
        ],
      };
    }

    const vendor = response.result;

    logToolResponse("get_vendor", true, Date.now() - startTime);
    logger.info("Vendor retrieved successfully", { vendorId: args.id });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(vendor),
        }
      ],
    };
  } catch (error) {
    logToolResponse("get_vendor", false, Date.now() - startTime);
    logger.error("Failed to get vendor", error, { vendorId: args.id });
    throw error;
  }
};

export const GetVendorTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 