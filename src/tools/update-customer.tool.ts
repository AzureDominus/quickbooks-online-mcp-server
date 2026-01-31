import { updateQuickbooksCustomer } from "../handlers/update-quickbooks-customer.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { UpdateCustomerInputSchema } from "../types/qbo-schemas.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

const toolName = "update_customer";
const toolDescription = `Update an existing customer in QuickBooks Online.

REQUIRED FIELDS:
- Id: Customer ID to update (required)
- SyncToken: Current sync token of the customer (required for optimistic locking)

OPTIONAL FIELDS (provide any to update):
- DisplayName: Unique display name for the customer (max 500 chars)
- CompanyName: Company/business name
- GivenName: First name
- FamilyName: Last name
- PrimaryEmailAddr: Primary email address (object with Address field)
- PrimaryPhone: Primary phone number (object with FreeFormNumber field)
- BillAddr: Billing address (Line1, City, Country, CountrySubDivisionCode, PostalCode)
- ShipAddr: Shipping address (same fields as BillAddr)
- Notes: Internal notes about customer (max 2000 chars)
- Active: Is customer active?
- Taxable: Is customer taxable?

NOTE: To update, you must first get the current customer to obtain the SyncToken.
The SyncToken prevents concurrent update conflicts.

Example:
{
  "Id": "123",
  "SyncToken": "2",
  "DisplayName": "Acme Corporation Updated",
  "PrimaryPhone": { "FreeFormNumber": "555-9999" }
}`;

const toolSchema = z.object({ customer: UpdateCustomerInputSchema });

// MCP SDK passes parsed args directly
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.customer as z.infer<typeof UpdateCustomerInputSchema>;
  
  logToolRequest(toolName, { Id: input.Id });

  try {
    const response = await updateQuickbooksCustomer(input);

    if (response.isError) {
      logger.error('Failed to update customer', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error updating customer: ${response.error}` },
        ],
      };
    }

    logger.info('Customer updated successfully', {
      customerId: input.Id,
      displayName: response.result?.DisplayName,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Customer updated successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in update_customer', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const UpdateCustomerTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 