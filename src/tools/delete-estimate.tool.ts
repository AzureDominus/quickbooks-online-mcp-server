import { deleteQuickbooksEstimate } from "../handlers/delete-quickbooks-estimate.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { DeleteInputSchema } from "../types/qbo-schemas.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

const toolName = "delete_estimate";
const toolDescription = `Delete (void) an estimate in QuickBooks Online.

REQUIRED FIELDS:
- Id: Estimate ID to delete (required)
- SyncToken: Current sync token (required for optimistic locking)

NOTE: This operation voids the estimate rather than permanently deleting it.
The estimate will be marked as deleted but remains in the system for audit purposes.

Example:
{
  "Id": "123",
  "SyncToken": "2"
}`;

const toolSchema = z.object({ 
  idOrEntity: DeleteInputSchema.describe("Estimate to delete with Id and SyncToken") 
});

// MCP SDK passes parsed args directly
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.idOrEntity as z.infer<typeof DeleteInputSchema>;
  
  logToolRequest(toolName, { Id: input.Id });

  try {
    const response = await deleteQuickbooksEstimate(input);
    
    if (response.isError) {
      logger.error('Failed to delete estimate', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return { content: [{ type: "text" as const, text: `Error deleting estimate: ${response.error}` }] };
    }
    
    logger.info('Estimate deleted successfully', { estimateId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);
    
    return {
      content: [
        { type: "text" as const, text: `Estimate deleted successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in delete_estimate', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
    };
  }
};

export const DeleteEstimateTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 