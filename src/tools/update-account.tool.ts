import { updateQuickbooksAccount } from "../handlers/update-quickbooks-account.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { UpdateAccountInputSchema, type UpdateAccountInput } from "../types/qbo-schemas.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

const toolName = "update_account";
const toolDescription = `Update an existing chart-of-accounts entry in QuickBooks Online.

REQUIRED FIELDS:
- Id: Account ID to update (required)
- SyncToken: Current sync token for optimistic locking (required)

OPTIONAL FIELDS (provide any to update):
- Name: Account name (max 100 chars, must be unique)
- AccountType: Account type - 'Bank', 'Expense', 'Income', 'Other Current Asset', 'Fixed Asset', etc.
- AccountSubType: Account subtype (e.g., 'Checking', 'Savings', 'Advertising', 'OfficeExpenses')
- Description: Account description (max 4000 chars)
- Classification: Account classification - 'Asset', 'Equity', 'Expense', 'Liability', or 'Revenue'
- Active: Whether account is active (boolean)
- SubAccount: Whether this is a sub-account (boolean)
- ParentRef: Parent account reference for sub-accounts (object with 'value' property containing account ID)
- AcctNum: User-defined account number (max 7 chars)

IMPORTANT:
- To get the current SyncToken, first retrieve the account using search_accounts
- This performs a sparse update - only specified fields are changed
- Some fields like AccountType cannot be changed after creation in certain cases

Example - Update name and description:
{
  "Id": "123",
  "SyncToken": "0",
  "Name": "Updated Account Name",
  "Description": "New description for the account"
}

Example - Deactivate an account:
{
  "Id": "123",
  "SyncToken": "0",
  "Active": false
}

Example - Make sub-account:
{
  "Id": "123",
  "SyncToken": "0",
  "SubAccount": true,
  "ParentRef": { "value": "456" }
}`;

const toolSchema = z.object({
  account: UpdateAccountInputSchema,
});

const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.account as UpdateAccountInput;

  logToolRequest(toolName, { Id: input.Id });

  try {
    // Validation: ensure at least one update field is provided beyond Id/SyncToken
    const updateFields = [
      input.Name, input.AccountType, input.AccountSubType, input.Description,
      input.Classification, input.Active, input.SubAccount, input.ParentRef, input.AcctNum,
    ];

    if (!updateFields.some(v => v !== undefined)) {
      return {
        content: [
          { type: "text" as const, text: `Error: At least one field to update must be provided (Name, AccountType, AccountSubType, Description, Classification, Active, SubAccount, ParentRef, or AcctNum)` },
        ],
      };
    }

    // Build the update payload for the handler
    // Extract fields to build a patch object compatible with the handler
    const patch: Record<string, unknown> = {};
    if (input.Name !== undefined) patch.Name = input.Name;
    if (input.AccountType !== undefined) patch.AccountType = input.AccountType;
    if (input.AccountSubType !== undefined) patch.AccountSubType = input.AccountSubType;
    if (input.Description !== undefined) patch.Description = input.Description;
    if (input.Classification !== undefined) patch.Classification = input.Classification;
    if (input.Active !== undefined) patch.Active = input.Active;
    if (input.SubAccount !== undefined) patch.SubAccount = input.SubAccount;
    if (input.ParentRef !== undefined) patch.ParentRef = input.ParentRef;
    if (input.AcctNum !== undefined) patch.AcctNum = input.AcctNum;

    const updatePayload = {
      account_id: input.Id,
      patch,
    };

    logger.debug('Update account payload', { payload: updatePayload });

    const response = await updateQuickbooksAccount(updatePayload);

    if (response.isError) {
      logger.error('Failed to update account', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error updating account: ${response.error}` },
        ],
      };
    }

    logger.info('Account updated successfully', { accountId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Account updated successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in update_account', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const UpdateAccountTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 