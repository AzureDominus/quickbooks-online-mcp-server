import { updateQuickbooksEmployee } from "../handlers/update-quickbooks-employee.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { UpdateEmployeeInputSchema } from "../types/qbo-schemas.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "update_employee";
const toolDescription = `Update an existing employee in QuickBooks Online.

REQUIRED FIELDS:
- Id: Employee ID to update (required)
- SyncToken: Current sync token of the employee (required for optimistic locking)

OPTIONAL FIELDS (provide any to update):
- GivenName: First name
- FamilyName: Last name
- DisplayName: Display name
- PrimaryEmailAddr: Primary email (object with Address field)
- PrimaryPhone: Primary phone (object with FreeFormNumber field)
- Mobile: Mobile phone
- PrimaryAddr: Primary address
- EmployeeNumber: Employee number
- HiredDate: Hire date (YYYY-MM-DD)
- ReleasedDate: Release/termination date (YYYY-MM-DD)
- Active: Is employee active?
- BillableTime: Track billable time?
- BillRate: Hourly bill rate
- BirthDate: Birth date (YYYY-MM-DD)
- Gender: Gender (Male/Female)

NOTE: To update, you must first get the current employee to obtain the SyncToken.

Example:
{
  "Id": "123",
  "SyncToken": "1",
  "BillRate": 150.00,
  "BillableTime": true
}`;

// Define the expected input schema for updating an employee
const toolSchema = z.object({
  employee: UpdateEmployeeInputSchema,
});

// Define the tool handler - MCP SDK passes parsed args directly
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.employee as z.infer<typeof UpdateEmployeeInputSchema>;
  
  logToolRequest(toolName, { Id: input.Id });

  try {
    const response = await updateQuickbooksEmployee(input);

    if (response.isError) {
      logger.error('Failed to update employee', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error updating employee: ${response.error}` },
        ],
      };
    }

    logger.info('Employee updated successfully', { employeeId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Employee updated successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in update_employee', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const UpdateEmployeeTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 