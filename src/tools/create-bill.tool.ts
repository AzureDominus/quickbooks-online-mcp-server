import { createQuickbooksBill } from '../handlers/create-quickbooks-bill.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { checkIdempotency, storeIdempotency } from '../helpers/idempotency.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'create_bill';
const toolDescription = `Create a bill in QuickBooks Online.

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original bill ID is returned`;

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

const toolSchema = z.object({
  bill: z.object({
    Line: z.array(BillLineSchema).min(1).describe('Bill line items'),
    VendorRef: z.object({
      value: z.string().describe('Vendor ID'),
      name: z.string().optional().describe('Vendor name'),
    }),
    DueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe('Due date (YYYY-MM-DD)'),
    TxnDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe('Bill date (YYYY-MM-DD)'),
    DocNumber: z.string().max(21).optional().describe('Bill reference number'),
    Memo: z.string().max(4000).optional().describe('Memo'),
    PrivateNote: z.string().max(4000).optional().describe('Internal note'),
  }),
  idempotencyKey: z
    .string()
    .optional()
    .describe('Optional unique key to prevent duplicate bill creation on retry'),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  const typedArgs = args as ToolInput;
  const { bill, idempotencyKey } = typedArgs;

  logToolRequest(toolName, {
    vendorRef: bill.VendorRef?.value,
    lineCount: bill.Line?.length,
    hasIdempotencyKey: !!idempotencyKey,
  });

  try {
    // Check idempotency first
    const existingId = checkIdempotency(idempotencyKey);
    if (existingId) {
      logger.info('Idempotency hit - returning cached result for bill', {
        idempotencyKey,
        existingId,
      });

      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: 'text' as const, text: `Bill already exists (idempotent):` },
          { type: 'text' as const, text: JSON.stringify({ Id: existingId, wasIdempotent: true }) },
        ],
      };
    }

    if (idempotencyKey) {
      logger.debug('Idempotency miss - proceeding with bill creation', { idempotencyKey });
    }

    const response = await createQuickbooksBill(bill);

    if (response.isError) {
      logger.error('Failed to create bill', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error creating bill: ${response.error}`,
          },
        ],
      };
    }

    const createdBill = response.result;

    // Store idempotency result after successful creation
    if (createdBill?.Id) {
      storeIdempotency(idempotencyKey, createdBill.Id, 'Bill');
    }

    logger.info('Bill created successfully', {
      billId: createdBill?.Id,
      totalAmt: createdBill?.TotalAmt,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: 'text' as const, text: `Bill created successfully:` },
        { type: 'text' as const, text: JSON.stringify(createdBill) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in create-bill', error);
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

export const CreateBillTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
