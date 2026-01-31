import { getQuickbooksPurchase } from "../handlers/get-quickbooks-purchase.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";
import { z } from "zod";

// Define the tool metadata
const toolName = "get_purchase";
const toolDescription = "Get a purchase by Id from QuickBooks Online.";

// Define the expected input schema for getting a purchase
const toolSchema = z.object({
  id: z.string(),
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  logToolRequest("get_purchase", args);
  const startTime = Date.now();

  try {
    const response = await getQuickbooksPurchase(args.id);

    if (response.isError) {
      logToolResponse("get_purchase", false, Date.now() - startTime);
      logger.error(`Failed to get purchase: ${response.error}`, undefined, { purchaseId: args.id });
      return {
        content: [
          { type: "text" as const, text: `Error getting purchase: ${response.error}` },
        ],
      };
    }

    logToolResponse("get_purchase", true, Date.now() - startTime);
    logger.info("Purchase retrieved successfully", { purchaseId: args.id });
    return {
      content: [
        { type: "text" as const, text: `Purchase retrieved:` },
        { type: "text" as const, text: JSON.stringify(response.result) },
      ],
    };
  } catch (error) {
    logToolResponse("get_purchase", false, Date.now() - startTime);
    logger.error("Failed to get purchase", error, { purchaseId: args?.id });
    throw error;
  }
};

export const GetPurchaseTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 