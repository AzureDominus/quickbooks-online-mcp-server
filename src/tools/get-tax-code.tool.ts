import { getTaxCode } from "../handlers/tax-code.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";

const toolName = "get_tax_code";
const toolDescription = "Get a tax code by ID from QuickBooks Online. Returns the tax code details including name, description, rates, and whether it's taxable.";

const toolSchema = z.object({
  id: z.string().describe("The ID of the tax code to retrieve"),
});

const toolHandler = async (args: { [x: string]: any }) => {
  const response = await getTaxCode(args.params.id);

  if (response.isError) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting tax code: ${response.error}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `Tax code retrieved:\n${JSON.stringify(response.result, null, 2)}`,
      },
    ],
  };
};

export const GetTaxCodeTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
