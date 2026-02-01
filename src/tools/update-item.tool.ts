import { updateQuickbooksItem } from '../handlers/update-quickbooks-item.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { UpdateItemInputSchema, type UpdateItemInput } from '../types/qbo-schemas.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'update_item';
const toolDescription = `Update an existing item (product/service) in QuickBooks Online.

REQUIRED FIELDS:
- Id: Item ID to update (required)
- SyncToken: Current sync token for optimistic locking (required)

OPTIONAL FIELDS (provide any to update):
- Name: Item name (max 100 chars, must be unique)
- Type: Item type - 'Inventory', 'Service', or 'NonInventory'
- Description: Item description (max 4000 chars)
- UnitPrice: Sales price
- PurchaseCost: Purchase cost
- Taxable: Whether the item is taxable (boolean)
- Active: Whether the item is active (boolean)
- IncomeAccountRef: Income account for sales (object with 'value' property containing account ID)
- ExpenseAccountRef: Expense account for purchases (object with 'value' property containing account ID)
- AssetAccountRef: Asset account for inventory items (object with 'value' property containing account ID)
- Sku: Stock keeping unit (max 100 chars)
- QtyOnHand: Quantity on hand (for inventory items)

IMPORTANT:
- To get the current SyncToken, first retrieve the item using read_item
- This performs a sparse update - only specified fields are changed
- For reference fields (IncomeAccountRef, etc.), use format: { "value": "accountId" }

Example - Update price and description:
{
  "Id": "123",
  "SyncToken": "0",
  "UnitPrice": 29.99,
  "Description": "Updated product description"
}

Example - Update income account:
{
  "Id": "123",
  "SyncToken": "0",
  "IncomeAccountRef": { "value": "1" }
}`;

const toolSchema = z.object({
  item: UpdateItemInputSchema,
});

const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.item as UpdateItemInput;

  logToolRequest(toolName, { Id: input.Id });

  try {
    // Validation: ensure at least one update field is provided beyond Id/SyncToken
    const updateFields = [
      input.Name,
      input.Type,
      input.Description,
      input.UnitPrice,
      input.PurchaseCost,
      input.Taxable,
      input.Active,
      input.IncomeAccountRef,
      input.ExpenseAccountRef,
      input.AssetAccountRef,
      input.Sku,
      input.QtyOnHand,
    ];

    if (!updateFields.some((v) => v !== undefined)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: At least one field to update must be provided (Name, Type, Description, UnitPrice, PurchaseCost, Taxable, Active, IncomeAccountRef, ExpenseAccountRef, AssetAccountRef, Sku, or QtyOnHand)`,
          },
        ],
      };
    }

    // Build the update payload for the handler
    const updatePayload = {
      item_id: input.Id,
      patch: {
        ...input,
        sparse: true,
      },
    };

    logger.debug('Update item payload', { payload: updatePayload });

    const response = await updateQuickbooksItem(updatePayload);

    if (response.isError) {
      logger.error('Failed to update item', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error updating item: ${response.error}` }],
      };
    }

    logger.info('Item updated successfully', { itemId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logger.error('Unexpected error in update_item', error);
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

export const UpdateItemTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
