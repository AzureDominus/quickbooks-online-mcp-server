import { getQuickbooksJournalEntry } from '../handlers/get-quickbooks-journal-entry.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

// Define the tool metadata
const toolName = 'get_journal_entry';
const toolDescription = 'Get a journal entry by Id from QuickBooks Online.';

// Define the expected input schema for getting a journal entry
const toolSchema = z.object({
  id: z.string(),
});

// Define the tool handler
const toolHandler = async (args: any) => {
  logToolRequest('get_journal_entry', args);
  const startTime = Date.now();

  try {
    const response = await getQuickbooksJournalEntry(args.id);

    if (response.isError) {
      logToolResponse('get_journal_entry', false, Date.now() - startTime);
      logger.error(`Failed to get journal entry: ${response.error}`, undefined, {
        journalEntryId: args.id,
      });
      return {
        content: [
          { type: 'text' as const, text: `Error getting journal entry: ${response.error}` },
        ],
      };
    }

    logToolResponse('get_journal_entry', true, Date.now() - startTime);
    logger.info('Journal entry retrieved successfully', { journalEntryId: args.id });
    return {
      content: [
        { type: 'text' as const, text: `Journal entry retrieved:` },
        { type: 'text' as const, text: JSON.stringify(response.result) },
      ],
    };
  } catch (error) {
    logToolResponse('get_journal_entry', false, Date.now() - startTime);
    logger.error('Failed to get journal entry', error, { journalEntryId: args?.id });
    throw error;
  }
};

export const GetJournalEntryTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
