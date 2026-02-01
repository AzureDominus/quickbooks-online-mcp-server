import { createQuickbooksInvoice } from '../handlers/create-quickbooks-invoice.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { checkIdempotency, storeIdempotency } from '../helpers/idempotency.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'create_invoice';
const toolDescription = `Create an invoice in QuickBooks Online.

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original invoice ID is returned`;

const lineItemSchema = z.object({
  item_ref: z.string().min(1),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
  description: z.string().optional(),
  tax_code_ref: z
    .string()
    .optional()
    .describe('Tax code ID (e.g., "5" for HST in Canada). Required for Canadian companies.'),
});

const toolSchema = z.object({
  customer_ref: z.string().min(1),
  line_items: z.array(lineItemSchema).min(1),
  doc_number: z.string().optional(),
  txn_date: z.string().optional(),
  idempotencyKey: z
    .string()
    .optional()
    .describe('Optional key to prevent duplicate invoice creation on retry'),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  // Args are passed directly (RegisterTool extracts raw shape)
  const typedArgs = args as ToolInput;

  logToolRequest(toolName, {
    ...typedArgs,
    line_items: `[${typedArgs.line_items?.length || 0} items]`,
  });

  try {
    // Check idempotency first
    const existingId = checkIdempotency(typedArgs.idempotencyKey);
    if (existingId) {
      logger.info('Idempotency hit - returning cached result', {
        idempotencyKey: typedArgs.idempotencyKey,
        existingId,
      });

      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify({ Id: existingId, wasIdempotent: true }) },
        ],
      };
    }

    // Create the invoice
    const response = await createQuickbooksInvoice(typedArgs);

    if (response.isError) {
      logger.error('Failed to create invoice', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error creating invoice: ${response.error}` }],
      };
    }

    // Store idempotency result
    if (response.result?.Id) {
      storeIdempotency(typedArgs.idempotencyKey, response.result.Id, 'Invoice');
    }

    logger.info('Invoice created successfully', {
      invoiceId: response.result?.Id,
      docNumber: response.result?.DocNumber,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logger.error('Unexpected error in create_invoice', error);
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

export const CreateInvoiceTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
