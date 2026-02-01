import { deleteQuickbooksCustomer } from '../handlers/delete-quickbooks-customer.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { DeleteInputSchema } from '../types/qbo-schemas.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'delete_customer';
const toolDescription = `Delete (make inactive) a customer in QuickBooks Online.

REQUIRED FIELDS:
- Id: Customer ID to delete (required)
- SyncToken: Current sync token (required for optimistic locking)

NOTE: This operation makes the customer inactive rather than permanently deleting it.
The customer will be marked as inactive but remains in the system for audit purposes
and to preserve historical transaction data.

To reactivate a customer, use the update_customer tool with Active: true.

Example:
{
  "Id": "123",
  "SyncToken": "2"
}`;

const toolSchema = z.object({
  idOrEntity: DeleteInputSchema.describe('Customer to delete with Id and SyncToken'),
});

// MCP SDK passes parsed args directly
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.idOrEntity as z.infer<typeof DeleteInputSchema>;

  logToolRequest(toolName, { Id: input.Id });

  try {
    const response = await deleteQuickbooksCustomer(input);

    if (response.isError) {
      logger.error('Failed to delete customer', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error deleting customer: ${response.error}` }],
      };
    }

    logger.info('Customer deleted successfully', { customerId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logger.error('Unexpected error in delete_customer', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
};

export const DeleteCustomerTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
