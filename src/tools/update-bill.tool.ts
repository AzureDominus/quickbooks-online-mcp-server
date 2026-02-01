import { updateQuickbooksBill } from '../handlers/update-quickbooks-bill.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'update_bill';
const toolDescription = `Update a bill in QuickBooks Online.

REQUIRED FIELDS:
- Id: Bill ID to update (required)
- SyncToken: Current sync token of the bill (required for optimistic locking)

OPTIONAL FIELDS (provide any to update):
- VendorRef: Vendor reference (object with value field)
- Line: Array of bill line items (replaces all existing lines)
- TxnDate: Bill date (YYYY-MM-DD)
- DueDate: Payment due date (YYYY-MM-DD)
- DocNumber: Bill reference number
- Memo: Memo
- PrivateNote: Internal note

NOTE: To update, you must first get the current bill to obtain the SyncToken.
The SyncToken prevents concurrent update conflicts.

Example:
{
  "Id": "123",
  "SyncToken": "2",
  "DueDate": "2026-02-15",
  "PrivateNote": "Payment scheduled"
}`;

// Line item schema for bill lines
const BillLineSchema = z.object({
  Amount: z.number().describe('Line amount'),
  DetailType: z
    .enum(['AccountBasedExpenseLineDetail', 'ItemBasedExpenseLineDetail'])
    .describe('Type of line detail'),
  Description: z.string().optional().describe('Line description'),
  AccountBasedExpenseLineDetail: z
    .object({
      AccountRef: z
        .object({
          value: z.string().describe('Account ID'),
          name: z.string().optional().describe('Account name'),
        })
        .describe('Account reference'),
      TaxCodeRef: z
        .object({
          value: z.string().describe('Tax code ID'),
        })
        .optional()
        .describe('Tax code reference'),
    })
    .optional()
    .describe('Account-based expense details'),
  ItemBasedExpenseLineDetail: z
    .object({
      ItemRef: z
        .object({
          value: z.string().describe('Item ID'),
          name: z.string().optional().describe('Item name'),
        })
        .describe('Item reference'),
      Qty: z.number().optional().describe('Quantity'),
      UnitPrice: z.number().optional().describe('Unit price'),
    })
    .optional()
    .describe('Item-based expense details'),
});

// Update bill input schema with required SyncToken
const UpdateBillInputSchema = z.object({
  Id: z.string().describe('Bill ID to update (required)'),
  SyncToken: z.string().describe('Sync token for optimistic locking (required)'),
  VendorRef: z
    .object({
      value: z.string().describe('Vendor ID'),
      name: z.string().optional().describe('Vendor name'),
    })
    .optional()
    .describe('Vendor reference'),
  Line: z.array(BillLineSchema).optional().describe('Bill line items'),
  TxnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Bill date (YYYY-MM-DD)'),
  DueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Payment due date (YYYY-MM-DD)'),
  DocNumber: z.string().max(21).optional().describe('Bill reference number'),
  Memo: z.string().max(4000).optional().describe('Memo'),
  PrivateNote: z.string().max(4000).optional().describe('Internal note'),
});

const toolSchema = z.object({ bill: UpdateBillInputSchema });

const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.bill as z.infer<typeof UpdateBillInputSchema>;

  logToolRequest(toolName, { Id: input.Id });
  logger.info('Updating bill', { billId: input.Id, hasLines: !!input.Line });

  try {
    const response = await updateQuickbooksBill(input);

    if (response.isError) {
      logger.error('Failed to update bill', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error updating bill: ${response.error}`,
          },
        ],
      };
    }

    logger.info('Bill updated successfully', { billId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logger.error('Unexpected error in update_bill', error);
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

export const UpdateBillTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
