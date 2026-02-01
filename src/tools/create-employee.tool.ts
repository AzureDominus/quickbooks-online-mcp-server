import { createQuickbooksEmployee } from '../handlers/create-quickbooks-employee.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { checkIdempotency, storeIdempotency } from '../helpers/idempotency.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { CreateEmployeeInputSchema } from '../types/qbo-schemas.js';

// Define the tool metadata
const toolName = 'create_employee';
const toolDescription = `Create an employee in QuickBooks Online.

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original employee ID is returned`;

// Define the expected input schema for creating an employee
const toolSchema = z.object({
  employee: CreateEmployeeInputSchema,
  idempotencyKey: z
    .string()
    .optional()
    .describe('Optional key to prevent duplicate employee creation on retry'),
});

// Define the tool handler
const toolHandler = async (args: any) => {
  const startTime = Date.now();

  logToolRequest(toolName, args);

  try {
    // Check idempotency first
    const existingId = checkIdempotency(args.idempotencyKey);
    if (existingId) {
      logger.info('Idempotency hit - returning cached result', {
        idempotencyKey: args.idempotencyKey,
        existingId,
      });

      logToolResponse(toolName, true, Date.now() - startTime);
      return {
        content: [
          { type: 'text' as const, text: `Employee already exists (idempotent):` },
          { type: 'text' as const, text: JSON.stringify({ Id: existingId, wasIdempotent: true }) },
        ],
      };
    }

    const response = await createQuickbooksEmployee(args.employee);

    if (response.isError) {
      logger.error('Failed to create employee', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error creating employee: ${response.error}` }],
      };
    }

    // Store idempotency result
    if (response.result?.Id) {
      storeIdempotency(args.idempotencyKey, response.result.Id, 'Employee');
    }

    logger.info('Employee created successfully', {
      employeeId: response.result?.Id,
      displayName: response.result?.DisplayName,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: 'text' as const, text: `Employee created:` },
        { type: 'text' as const, text: JSON.stringify(response.result) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in create_employee', error);
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

export const CreateEmployeeTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
