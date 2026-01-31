import { createQuickbooksEmployee } from "../handlers/create-quickbooks-employee.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";
import { CreateEmployeeInputSchema } from "../types/qbo-schemas.js";

// Define the tool metadata
const toolName = "create_employee";
const toolDescription = "Create an employee in QuickBooks Online.";

// Define the expected input schema for creating an employee
const toolSchema = z.object({
  employee: CreateEmployeeInputSchema,
});

type ToolParams = z.infer<typeof toolSchema>;

// Define the tool handler
const toolHandler = async (args: any) => {
  const startTime = Date.now();
  
  logToolRequest(toolName, args);

  try {
    const response = await createQuickbooksEmployee(args.employee);

    if (response.isError) {
      logger.error('Failed to create employee', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error creating employee: ${response.error}` },
        ],
      };
    }

    logger.info('Employee created successfully', {
      employeeId: response.result?.Id,
      displayName: response.result?.DisplayName,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Employee created:` },
        { type: "text" as const, text: JSON.stringify(response.result) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in create_employee', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
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