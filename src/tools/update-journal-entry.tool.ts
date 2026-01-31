import { updateQuickbooksJournalEntry } from "../handlers/update-quickbooks-journal-entry.handler.js";
import { ToolDefinition } from "../types/tool-definition.js";
import { z } from "zod";
import { UpdateJournalEntryInputSchema, type UpdateJournalEntryInput } from "../types/qbo-schemas.js";
import { logger, logToolRequest, logToolResponse } from "../helpers/logger.js";

// Define the tool metadata
const toolName = "update_journal_entry";
const toolDescription = `Update an existing journal entry in QuickBooks Online.

REQUIRED FIELDS:
- Id: Journal entry ID to update (required)
- SyncToken: Current sync token for optimistic locking (required)

OPTIONAL FIELDS (provide any to update):
- Line: Array of journal entry lines (replaces ALL existing lines if provided)
  - Each line requires: Amount, JournalEntryLineDetail.PostingType (Debit/Credit), JournalEntryLineDetail.AccountRef.value
  - Minimum 2 lines required, and debits must equal credits
- TxnDate: Transaction date (YYYY-MM-DD format)
- DocNumber: Reference/document number (max 21 chars)
- PrivateNote: Internal note (max 4000 chars)
- Adjustment: Whether this is an adjusting journal entry (boolean)

IMPORTANT:
- To get the current SyncToken, first retrieve the journal entry using get_journal_entry
- When updating lines, ALL existing lines are replaced
- Debits must equal credits for the journal entry to be valid

Example - Update date and add note:
{
  "Id": "123",
  "SyncToken": "0",
  "TxnDate": "2024-01-15",
  "PrivateNote": "Corrected entry date"
}

Example - Update with new lines (replaces existing):
{
  "Id": "123",
  "SyncToken": "0",
  "Line": [
    {
      "Amount": 500.00,
      "JournalEntryLineDetail": {
        "PostingType": "Debit",
        "AccountRef": { "value": "1" }
      }
    },
    {
      "Amount": 500.00,
      "JournalEntryLineDetail": {
        "PostingType": "Credit",
        "AccountRef": { "value": "2" }
      }
    }
  ]
}`;

// Define the expected input schema for updating a journal entry
const toolSchema = z.object({
  journalEntry: UpdateJournalEntryInputSchema,
});

// Define the tool handler
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.journalEntry as UpdateJournalEntryInput;

  logToolRequest(toolName, { Id: input.Id });

  try {
    // Validation: ensure at least one update field is provided beyond Id/SyncToken
    const updateFields = [
      input.Line, input.TxnDate, input.DocNumber,
      input.PrivateNote, input.Adjustment,
    ];

    if (!updateFields.some(v => v !== undefined)) {
      return {
        content: [
          { type: "text" as const, text: `Error: At least one field to update must be provided (Line, TxnDate, DocNumber, PrivateNote, or Adjustment)` },
        ],
      };
    }

    // Build the update payload
    const updatePayload: Record<string, unknown> = {
      Id: input.Id,
      SyncToken: input.SyncToken,
      sparse: true, // Use sparse update to only change specified fields
    };

    if (input.Line) updatePayload.Line = input.Line;
    if (input.TxnDate) updatePayload.TxnDate = input.TxnDate;
    if (input.DocNumber) updatePayload.DocNumber = input.DocNumber;
    if (input.PrivateNote) updatePayload.PrivateNote = input.PrivateNote;
    if (input.Adjustment !== undefined) updatePayload.Adjustment = input.Adjustment;

    logger.debug('Update journal entry payload', { payload: updatePayload });

    const response = await updateQuickbooksJournalEntry(updatePayload);

    if (response.isError) {
      logger.error('Failed to update journal entry', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: "text" as const, text: `Error updating journal entry: ${response.error}` },
        ],
      };
    }

    logger.info('Journal entry updated successfully', { journalEntryId: input.Id });
    logToolResponse(toolName, true, Date.now() - startTime);

    return {
      content: [
        { type: "text" as const, text: `Journal entry updated successfully:` },
        { type: "text" as const, text: JSON.stringify(response.result, null, 2) },
      ],
    };
  } catch (error) {
    logger.error('Unexpected error in update_journal_entry', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        { type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ],
    };
  }
};

export const UpdateJournalEntryTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
}; 