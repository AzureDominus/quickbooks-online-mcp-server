import { createQuickbooksCustomer } from '../handlers/create-quickbooks-customer.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { CreateCustomerInputSchema } from '../types/qbo-schemas.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { checkIdempotency, storeIdempotency } from '../helpers/idempotency.js';
import { buildCreateToolPayload } from '../helpers/create-tool-output.js';

// Define the tool metadata
const toolName = 'create_customer';
const toolDescription = `Create a new customer in QuickBooks Online.

REQUIRED FIELDS:
- DisplayName: Unique display name for the customer (required, max 500 chars)

OPTIONAL FIELDS:
- CompanyName: Company/business name
- GivenName: First name
- FamilyName: Last name
- PrimaryEmailAddr: Primary email address (object with Address field)
- PrimaryPhone: Primary phone number (object with FreeFormNumber field)
- BillAddr: Billing address (Line1, City, Country, CountrySubDivisionCode, PostalCode)
- ShipAddr: Shipping address (same fields as BillAddr)
- Notes: Internal notes about customer (max 2000 chars)
- Active: Is customer active? (default true)
- Taxable: Is customer taxable?

Example:
{
  "DisplayName": "Acme Corporation",
  "CompanyName": "Acme Corp",
  "GivenName": "John",
  "FamilyName": "Doe",
  "PrimaryEmailAddr": { "Address": "john@acme.com" },
  "PrimaryPhone": { "FreeFormNumber": "555-1234" },
  "BillAddr": {
    "Line1": "123 Main St",
    "City": "San Francisco",
    "CountrySubDivisionCode": "CA",
    "PostalCode": "94102",
    "Country": "USA"
  }
}

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original customer ID is returned`;

// Define the expected input schema for creating a customer - properly typed
const toolSchema = z.object({
  customer: CreateCustomerInputSchema,
  idempotencyKey: z
    .string()
    .optional()
    .describe('Optional key to prevent duplicate customer creation on retry'),
  responseFormat: z
    .enum(['raw', 'envelope'])
    .optional()
    .describe(
      "Optional output format. 'raw' preserves existing output; 'envelope' wraps with meta."
    ),
});

/** Inferred input type from Zod schema */
type ToolInput = z.infer<typeof toolSchema>;

// Define the tool handler - MCP SDK passes parsed args directly
const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  const typedArgs = args as ToolInput;
  const input = typedArgs.customer;
  const idempotencyKey = typedArgs.idempotencyKey;
  const responseFormat = typedArgs.responseFormat;

  logToolRequest(toolName, { DisplayName: input.DisplayName, idempotencyKey });

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
        entityType: 'Customer',
        id: existingId,
        wasIdempotent: true,
        format: responseFormat,
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
      };
    }

    const response = await createQuickbooksCustomer(input);

    if (response.isError) {
      logger.error('Failed to create customer', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error creating customer: ${response.error}` }],
      };
    }

    // Store idempotency result
    if (response.result?.Id && idempotencyKey) {
      storeIdempotency(idempotencyKey, response.result.Id, 'Customer');
      logger.info('Idempotency miss - stored new result', {
        idempotencyKey,
        customerId: response.result.Id,
      });
    }

    logger.info('Customer created successfully', {
      customerId: response.result?.Id,
      displayName: response.result?.DisplayName,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    const payload = buildCreateToolPayload({
      entityType: 'Customer',
      entity: response.result,
      wasIdempotent: false,
      format: responseFormat,
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    };
  } catch (error) {
    logger.error('Unexpected error in create_customer', error);
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

export const CreateCustomerTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
