import { createQuickbooksPurchase } from '../handlers/create-quickbooks-purchase.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { CreatePurchaseInputSchema } from '../types/qbo-schemas.js';
import {
  transformPurchaseToQBO,
  transformPurchaseFromQBO,
  validateReferences,
} from '../helpers/transform.js';
import { checkIdempotency, storeIdempotency } from '../helpers/idempotency.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { buildCreateToolPayload } from '../helpers/create-tool-output.js';

// Define the tool metadata
const toolName = 'create_purchase';
const toolDescription = `Create a new expense/purchase transaction in QuickBooks Online.

Creates a Purchase transaction with required date, payment type, payment account, and expense line items.

REQUIRED FIELDS:
- txnDate: Transaction date (YYYY-MM-DD format)
- paymentType: Payment method - 'Cash', 'Check', or 'CreditCard'
- paymentAccountId: ID of the Bank or CreditCard account used for payment
- lines: Array of expense line items (at least one required)

EACH LINE REQUIRES:
- amount: Line amount (positive number)
- expenseAccountId: ID of the expense account/category

OPTIONAL LINE FIELDS:
- description: Line description
- taxCodeId: Tax code ID for this line
- customerId: Customer ID to make this billable
- classId: Class ID for departmental tracking
- billable: Whether this expense is billable

TAX HANDLING:
- globalTaxCalculation specifies how line amounts relate to tax:
  - 'TaxExcluded': Line amounts are before tax (tax added on top)
  - 'TaxInclusive': Line amounts already include tax (tax extracted)
  - 'NotApplicable': No tax calculation (default)

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original purchase ID is returned

Example:
{
  "txnDate": "2026-01-31",
  "paymentType": "CreditCard",
  "paymentAccountId": "123",
  "vendorId": "456",
  "memo": "Office supplies",
  "lines": [
    {
      "amount": 99.99,
      "expenseAccountId": "789",
      "description": "Printer paper"
    }
  ]
}`;

// Use the properly typed schema
const toolSchema = z.object({
  purchase: CreatePurchaseInputSchema,
  responseFormat: z
    .enum(['raw', 'envelope'])
    .optional()
    .describe(
      "Optional output format. 'raw' preserves existing output; 'envelope' wraps with meta."
    ),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  const typedArgs = args as ToolInput;
  const input = typedArgs.purchase;
  const responseFormat = typedArgs.responseFormat;

  logToolRequest(toolName, {
    ...input,
    responseFormat,
    lines: `[${input.lines?.length || 0} lines]`,
  });

  try {
    // Check idempotency first
    const existingId = checkIdempotency(input.idempotencyKey);
    if (existingId) {
      logger.info('Returning cached result due to idempotency key', {
        idempotencyKey: input.idempotencyKey,
        existingId,
      });

      logToolResponse(toolName, true, Date.now() - startTime);

      const payload = buildCreateToolPayload({
        entityType: 'Purchase',
        id: existingId,
        wasIdempotent: true,
        format: responseFormat,
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
      };
    }

    // Validate input
    const validationErrors = validateReferences(input);
    if (validationErrors.length > 0) {
      logger.warn('Purchase validation failed', { errors: validationErrors });
      return {
        content: [
          { type: 'text' as const, text: `Validation error: ${validationErrors.join('; ')}` },
        ],
      };
    }

    // Transform to QBO format
    const qboPurchase = transformPurchaseToQBO(input);
    logger.debug('Transformed purchase to QBO format', { qboPurchase });

    // Create the purchase
    const response = await createQuickbooksPurchase(qboPurchase);

    if (response.isError) {
      logger.error('Failed to create purchase', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error creating purchase: ${response.error}` }],
      };
    }

    // Store idempotency result
    if (response.result?.Id) {
      storeIdempotency(input.idempotencyKey, response.result.Id, 'Purchase');
    }

    // Transform response to user-friendly format
    const transformedResult = transformPurchaseFromQBO(response.result);

    logger.info('Purchase created successfully', {
      purchaseId: response.result?.Id,
      totalAmt: response.result?.TotalAmt,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    const payload = buildCreateToolPayload({
      entityType: 'Purchase',
      entity: transformedResult,
      wasIdempotent: false,
      format: responseFormat,
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    };
  } catch (error) {
    logger.error('Unexpected error in create_purchase', error);
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

export const CreatePurchaseTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
