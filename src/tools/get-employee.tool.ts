import { getQuickbooksEmployee } from '../handlers/get-quickbooks-employee.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

// Define the tool metadata
const toolName = 'get_employee';
const toolDescription = 'Get an employee by Id from QuickBooks Online.';

// Define the expected input schema for getting an employee
const toolSchema = z.object({
  id: z.string(),
});

// Define the tool handler
const toolHandler = async (args: any) => {
  logToolRequest('get_employee', args);
  const startTime = Date.now();

  try {
    const response = await getQuickbooksEmployee(args.id);

    if (response.isError) {
      logToolResponse('get_employee', false, Date.now() - startTime);
      logger.error(`Failed to get employee: ${response.error}`, undefined, { employeeId: args.id });
      return {
        content: [{ type: 'text' as const, text: `Error getting employee: ${response.error}` }],
      };
    }

    logToolResponse('get_employee', true, Date.now() - startTime);
    logger.info('Employee retrieved successfully', { employeeId: args.id });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logToolResponse('get_employee', false, Date.now() - startTime);
    logger.error('Failed to get employee', error, { employeeId: args.id });
    throw error;
  }
};

export const GetEmployeeTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
