import { getQuickbooksBill } from "../handlers/get-quickbooks-bill.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";
import { z } from "zod";

const toolName = "get-bill";
const toolDescription = "Get a bill by ID from QuickBooks Online.";
const toolSchema = z.object({
  id: z.string(),
});

const toolHandler = async (args: { [x: string]: any }) => {
  logToolRequest("get_bill", args);
  const startTime = Date.now();

  try {
    const response = await getQuickbooksBill(args.id);

    if (response.isError) {
      logToolResponse("get_bill", false, Date.now() - startTime);
      logger.error(`Failed to get bill: ${response.error}`, undefined, { billId: args.id });
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting bill: ${response.error}`,
          },
        ],
      };
    }

    const bill = response.result;

    logToolResponse("get_bill", true, Date.now() - startTime);
    logger.info("Bill retrieved successfully", { billId: args.id });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(bill),
        }
      ],
    };
  } catch (error) {
    logToolResponse("get_bill", false, Date.now() - startTime);
    logger.error("Failed to get bill", error, { billId: args.id });
    throw error;
  }
};

export const GetBillTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 