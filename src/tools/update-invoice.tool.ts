import { updateQuickbooksInvoice } from '../handlers/update-quickbooks-invoice.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { UpdateInvoiceInputSchema, type UpdateInvoiceInput } from '../types/qbo-schemas.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'update_invoice';
const toolDescription = `Update an existing invoice in QuickBooks Online (sparse update).

REQUIRED FIELDS:
- Id: Invoice ID to update (required)
- SyncToken: Current sync token (required for optimistic locking)

OPTIONAL FIELDS (provide any to update):
- CustomerRef: { value: "customerId" } - Customer reference
- Line: Array of invoice line items (replaces ALL existing lines)
- TxnDate: Invoice date (YYYY-MM-DD)
- DueDate: Payment due date (YYYY-MM-DD)
- DocNumber: Invoice number (max 21 chars)
- CustomerMemo: { value: "memo text" } - Memo visible to customer
- PrivateNote: Internal note (max 4000 chars)
- BillEmail: { Address: "email@example.com" } - Billing email
- BillAddr: Billing address object
- ShipAddr: Shipping address object

NOTE: This is a sparse update - only provided fields are changed.
To get the SyncToken, first retrieve the invoice using read_invoice.

LINE FORMAT:
{
  "Amount": 100.00,
  "DetailType": "SalesItemLineDetail",
  "SalesItemLineDetail": {
    "ItemRef": { "value": "itemId" },
    "Qty": 1,
    "UnitPrice": 100.00
  }
}

Example - Update due date and add note:
{
  "invoice": {
    "Id": "123",
    "SyncToken": "2",
    "DueDate": "2024-02-28",
    "PrivateNote": "Payment extended per customer request"
  }
}`;

// Define the expected input schema for updating an invoice
const toolSchema = z.object({
  invoice: UpdateInvoiceInputSchema.describe(
    'Invoice update data with Id, SyncToken, and fields to update'
  ),
});

// Define the tool handler
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.invoice as UpdateInvoiceInput;

  logToolRequest(toolName, { Id: input.Id });

  try {
    // Build update payload for the handler (which expects invoice_id and patch)
    const { Id, SyncToken, ...patch } = input;
    const response = await updateQuickbooksInvoice({
      invoice_id: Id,
      patch: { ...patch, SyncToken },
    });

    if (response.isError) {
      logger.error('Failed to update invoice', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error updating invoice: ${response.error}` }],
      };
    }

    logger.info('Invoice updated successfully', { invoiceId: Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logger.error('Unexpected error in update_invoice', error);
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

export const UpdateInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
