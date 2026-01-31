import { getTaxCode } from "../handlers/tax-code.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

const toolName = "get_tax_code";
const toolDescription = "Get a tax code by ID from QuickBooks Online. Returns the tax code details including name, description, rates, and whether it's taxable.";

const toolSchema = z.object({
  id: z.string().describe("The ID of the tax code to retrieve"),
});

const toolHandler = async (args: { [x: string]: any }) => {
  logToolRequest(toolName, args);
  const startTime = Date.now();

  try {
    const response = await getTaxCode(args.id);

    if (response.isError) {
      logToolResponse(toolName, false, Date.now() - startTime);
      logger.error(`Failed to get tax code: ${response.error}`, undefined, { taxCodeId: args.id });
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting tax code: ${response.error}`,
          },
        ],
      };
    }

    logToolResponse(toolName, true, Date.now() - startTime);
    logger.info("Tax code retrieved successfully", { taxCodeId: args.id });
    return {
      content: [
        {
          type: "text" as const,
          text: `Tax code retrieved:\n${JSON.stringify(response.result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    logToolResponse(toolName, false, Date.now() - startTime);
    logger.error("Failed to get tax code", error, { taxCodeId: args?.id });
    throw error;
  }
};

export const GetTaxCodeTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
