import { deleteQuickbooksJournalEntry } from '../handlers/delete-quickbooks-journal-entry.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import { DeleteInputSchema } from '../types/qbo-schemas.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

// Define the tool metadata
const toolName = 'delete_journal_entry';
const toolDescription = `Delete (void) a journal entry in QuickBooks Online.

REQUIRED FIELDS:
- Id: Journal entry ID to delete (required)
- SyncToken: Current sync token for optimistic locking (required)

NOTE: This operation voids/deletes the journal entry. In QuickBooks Online,
journal entries are typically soft-deleted (voided) and remain in the system
for audit purposes.

To get the SyncToken, first retrieve the journal entry using get_journal_entry.

Example:
{
  "Id": "123",
  "SyncToken": "0"
}`;

// Define the expected input schema for deleting a journal entry
const toolSchema = z.object({
  idOrEntity: DeleteInputSchema.describe('Journal entry to delete with Id and SyncToken'),
});

// Define the tool handler
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.idOrEntity as z.infer<typeof DeleteInputSchema>;

  logToolRequest(toolName, { Id: input.Id });

  try {
    const response = await deleteQuickbooksJournalEntry(input);

    if (response.isError) {
      logger.error('Failed to delete journal entry', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: 'text' as const, text: `Error deleting journal entry: ${response.error}` },
        ],
      };
    }

    logger.info('Journal entry deleted successfully', { journalEntryId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logger.error('Unexpected error in delete_journal_entry', error);
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

export const DeleteJournalEntryTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
