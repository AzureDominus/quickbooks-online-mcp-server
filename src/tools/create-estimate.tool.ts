import { createQuickbooksEstimate } from '../handlers/create-quickbooks-estimate.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { CreateEstimateInputSchema } from '../types/qbo-schemas.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { checkIdempotency, storeIdempotency } from '../helpers/idempotency.js';
import { buildCreateToolPayload } from '../helpers/create-tool-output.js';

const toolName = 'create_estimate';
const toolDescription = `Create an estimate (quote) in QuickBooks Online.

REQUIRED FIELDS:
- CustomerRef: Customer reference object (required)
  - value: Customer ID (required)
  - name: Customer display name (optional)
- Line: Array of line items (at least one required)
  - Amount: Line total amount (required)
  - DetailType: Must be "SalesItemLineDetail" (default)
  - SalesItemLineDetail: Item details (required)
    - ItemRef: Item reference { value: string, name?: string }
    - Qty: Quantity (optional)
    - UnitPrice: Unit price (optional)
    - TaxCodeRef: Tax code reference (optional)
  - Description: Line description (optional, max 4000 chars)

OPTIONAL FIELDS:
- TxnDate: Estimate date (YYYY-MM-DD format)
- ExpirationDate: When the estimate expires (YYYY-MM-DD format)
- DocNumber: Estimate/quote number (max 21 chars)
- CustomerMemo: Message visible to customer { value: string }
- PrivateNote: Internal note not visible to customer (max 4000 chars)
- BillEmail: Email address for sending { Address: string }
- BillAddr: Billing address object (Line1, City, Country, CountrySubDivisionCode, PostalCode)
- ShipAddr: Shipping address object (same structure as BillAddr)
- TxnStatus: Estimate status - "Pending" | "Accepted" | "Closed" | "Rejected"
- GlobalTaxCalculation: Tax mode - "TaxExcluded" | "TaxInclusive" | "NotApplicable"

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original estimate ID is returned

EXAMPLE:
{
  "CustomerRef": { "value": "1" },
  "Line": [
    {
      "Amount": 150.00,
      "DetailType": "SalesItemLineDetail",
      "SalesItemLineDetail": {
        "ItemRef": { "value": "1", "name": "Services" },
        "Qty": 3,
        "UnitPrice": 50.00
      },
      "Description": "Consulting services"
    }
  ],
  "TxnDate": "2026-01-31",
  "ExpirationDate": "2026-02-28",
  "DocNumber": "EST-001",
  "CustomerMemo": { "value": "Thank you for your business!" },
  "TxnStatus": "Pending"
}`;

const toolSchema = z.object({
  estimate: CreateEstimateInputSchema,
  idempotencyKey: z.string().optional().describe('Optional key to prevent duplicate creation'),
  responseFormat: z
    .enum(['raw', 'envelope'])
    .optional()
    .describe(
      "Optional output format. 'raw' preserves existing output; 'envelope' wraps with meta."
    ),
});

// MCP SDK passes parsed args directly
const toolHandler = async (args: { [x: string]: unknown }) => {
  const startTime = Date.now();
  const input = args.estimate as z.infer<typeof CreateEstimateInputSchema>;
  const idempotencyKey = args.idempotencyKey as string | undefined;
  const responseFormat = args.responseFormat as 'raw' | 'envelope' | undefined;

  logToolRequest(toolName, {
    CustomerRef: input.CustomerRef,
    lineCount: input.Line?.length || 0,
    hasIdempotencyKey: !!idempotencyKey,
  });

  try {
    // Check idempotency first
    const existingId = checkIdempotency(idempotencyKey);
    if (existingId) {
      logger.info('Idempotency hit - returning cached result', {
        idempotencyKey,
        existingId,
      });

      logToolResponse(toolName, true, Date.now() - startTime);

      const payload = buildCreateToolPayload({
        entityType: 'Estimate',
        id: existingId,
        wasIdempotent: true,
        format: responseFormat,
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
      };
    }

    if (idempotencyKey) {
      logger.info('Idempotency miss - proceeding with creation', { idempotencyKey });
    }

    const response = await createQuickbooksEstimate(input);

    if (response.isError) {
      logger.error('Failed to create estimate', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error creating estimate: ${response.error}` }],
      };
    }

    // Store idempotency result
    if (response.result?.Id) {
      storeIdempotency(idempotencyKey, response.result.Id, 'Estimate');
    }

    logger.info('Estimate created successfully', {
      estimateId: response.result?.Id,
      customerId: input.CustomerRef?.value,
      lineCount: input.Line?.length || 0,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    const payload = buildCreateToolPayload({
      entityType: 'Estimate',
      entity: response.result,
      wasIdempotent: false,
      format: responseFormat,
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    };
  } catch (error) {
    logger.error('Unexpected error in create_estimate', error);
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

export const CreateEstimateTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
