import { updateQuickbooksPurchase } from "../handlers/update-quickbooks-purchase.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { UpdatePurchaseInputSchema, type UpdatePurchaseInput } from "../types/qbo-schemas.js";
import { transformPurchaseFromQBO } from "../helpers/transform.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "update_purchase";
const toolDescription = `Update an existing expense/purchase transaction in QuickBooks Online.

REQUIRED FIELDS:
- purchaseId: Purchase/expense ID to update (required)

OPTIONAL FIELDS (provide any to update):
- txnDate: Transaction date (YYYY-MM-DD)
- paymentType: Payment method (Cash, Check, CreditCard)
- paymentAccountId: Payment account ID (Bank or CreditCard account)
- vendorId: Vendor/payee ID
- vendorName: Vendor name (will resolve to ID)
- memo: Printed memo
- privateNote: Internal note
- referenceNumber: Reference/document number
- globalTaxCalculation: Tax mode (TaxExcluded, TaxInclusive, NotApplicable)
- lines: Replacement expense line items (replaces ALL existing lines)

IMPORTANT:
- To update, first get the purchase to obtain its current data
- When updating lines, ALL existing lines are replaced
- Use get_purchase first if you need to merge with existing lines

LINE FORMAT (same as create):
- amount: Line amount (positive number)
- expenseAccountId: Expense account/category ID
- description: Line description (optional)
- taxCodeId: Tax code ID (optional)
- customerId: Customer ID for billable (optional)
- classId: Class ID for tracking (optional)

Example - Update memo and add a note:
{
  "purchaseId": "123",
  "memo": "Updated office supplies order",
  "privateNote": "Approved by manager"
}

Example - Replace line items:
{
  "purchaseId": "123",
  "lines": [
    { "amount": 150.00, "expenseAccountId": "456", "description": "Updated item" }
  ]
}`;

// Use simplified update schema
const toolSchema = z.object({
  purchase: UpdatePurchaseInputSchema,
});

// Define the tool handler - MCP SDK passes parsed args directly
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.purchase as UpdatePurchaseInput;
  
  logToolRequest(toolName, { purchaseId: input.purchaseId });

  try {
    // Validation: ensure at least one update field is provided
    const updateFields = [
      input.txnDate, input.paymentType, input.paymentAccountId,
      input.vendorId, input.vendorName, input.memo, input.privateNote,
      input.referenceNumber, input.globalTaxCalculation, input.lines,
    ];
    
    if (!updateFields.some(v => v !== undefined)) {
      return {
        content: [
          { type: "text" as const, text: `Error: At least one field to update must be provided` },
        ],
      };
    }

    // Build the update payload
    // Note: The handler expects a full purchase object with Id and changes
    // We need to fetch the current purchase first to get SyncToken
    const updatePayload: Record<string, unknown> = {
      Id: input.purchaseId,
      sparse: true, // Use sparse update to only change specified fields
    };

    if (input.txnDate) updatePayload.TxnDate = input.txnDate;
    if (input.paymentType) updatePayload.PaymentType = input.paymentType;
    if (input.paymentAccountId) {
      updatePayload.AccountRef = { value: input.paymentAccountId };
    }
    if (input.vendorId) {
      updatePayload.EntityRef = { value: input.vendorId, type: 'Vendor' };
    }
    if (input.memo) updatePayload.Memo = input.memo;
    if (input.privateNote) updatePayload.PrivateNote = input.privateNote;
    if (input.referenceNumber) updatePayload.DocNumber = input.referenceNumber;
    if (input.globalTaxCalculation) {
      updatePayload.GlobalTaxCalculation = input.globalTaxCalculation;
    }
    if (input.lines) {
      updatePayload.Line = input.lines.map(line => ({
        Amount: line.amount,
        DetailType: 'AccountBasedExpenseLineDetail',
        Description: line.description,
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: line.expenseAccountId, name: line.expenseAccountName },
          TaxCodeRef: line.taxCodeId ? { value: line.taxCodeId } : undefined,
          CustomerRef: line.customerId ? { value: line.customerId } : undefined,
          ClassRef: line.classId ? { value: line.classId } : undefined,
          BillableStatus: line.billable ? 'Billable' : undefined,
        },
      }));
    }

    logger.debug('Update payload', { payload: updatePayload });

    const response = await updateQuickbooksPurchase(updatePayload);

    if (response.isError) {
      logger.error('Failed to update purchase', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error updating purchase: ${response.error}` },
        ],
      };
    }

    // Transform response to user-friendly format
    const transformedResult = transformPurchaseFromQBO(response.result);
    
    logger.info('Purchase updated successfully', {
      purchaseId: input.purchaseId,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Purchase updated successfully:` },
        { type: "text" as const, text: JSON.stringify(transformedResult, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in update_purchase', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const UpdatePurchaseTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 