import { createQuickbooksJournalEntry } from '../handlers/create-quickbooks-journal-entry.handler.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { z } from 'zod';
import {
  CreateJournalEntryInputSchema,
  type CreateJournalEntryInput,
} from '../types/qbo-schemas.js';
import { checkIdempotency, storeIdempotency } from '../helpers/idempotency.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { buildCreateToolPayload } from '../helpers/create-tool-output.js';

// Define the tool metadata
const toolName = 'create_journal_entry';
const toolDescription = `Create a journal entry in QuickBooks Online.

IDEMPOTENCY:
- Use idempotencyKey to prevent duplicate creation on retry
- If the same key is used twice, the original journal entry ID is returned

Journal entries are double-entry transactions that must balance (debits = credits).

REQUIRED FIELDS:
- Line: Array of journal lines (minimum 2 lines)

EACH LINE REQUIRES:
- Amount: Line amount (always positive)
- DetailType: Must be "JournalEntryLineDetail"
- JournalEntryLineDetail:
  - AccountRef: { value: "accountId" }
  - PostingType: "Debit" or "Credit"

OPTIONAL FIELDS:
- TxnDate: Transaction date (YYYY-MM-DD)
- DocNumber: Reference number
- PrivateNote: Internal note
- Adjustment: True if adjusting entry
- CurrencyRef: Currency (for multi-currency)

IMPORTANT: Total debits must equal total credits!

Example - Record a $500 expense paid from checking:
{
  "TxnDate": "2026-01-31",
  "DocNumber": "JE-001",
  "Line": [
    {
      "Amount": 500.00,
      "DetailType": "JournalEntryLineDetail",
      "JournalEntryLineDetail": {
        "AccountRef": { "value": "1" },
        "PostingType": "Debit"
      },
      "Description": "Office Supplies Expense"
    },
    {
      "Amount": 500.00,
      "DetailType": "JournalEntryLineDetail",
      "JournalEntryLineDetail": {
        "AccountRef": { "value": "2" },
        "PostingType": "Credit"
      },
      "Description": "Checking Account"
    }
  ]
}`;

// Define the expected input schema for creating a journal entry
const toolSchema = z.object({
  journalEntry: CreateJournalEntryInputSchema,
  idempotencyKey: z
    .string()
    .optional()
    .describe('Optional key to prevent duplicate journal entry creation on retry'),
  responseFormat: z
    .enum(['raw', 'envelope'])
    .optional()
    .describe(
      "Optional output format. 'raw' preserves existing output; 'envelope' wraps with meta."
    ),
});

// Define the tool handler
const toolHandler = async (args: { [x: string]: any }) => {
  const startTime = Date.now();
  const input = args.journalEntry as CreateJournalEntryInput;
  const responseFormat = args.responseFormat as 'raw' | 'envelope' | undefined;

  logToolRequest(toolName, {
    lineCount: input.Line?.length,
    txnDate: input.TxnDate,
  });

  try {
    // Check idempotency first
    const existingId = checkIdempotency(args.idempotencyKey);
    if (existingId) {
      logger.info('Idempotency hit - returning cached result', {
        idempotencyKey: args.idempotencyKey,
        existingId,
      });

      logToolResponse(toolName, true, Date.now() - startTime);

      const payload = buildCreateToolPayload({
        entityType: 'JournalEntry',
        id: existingId,
        wasIdempotent: true,
        format: responseFormat,
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
      };
    }

    // Validate that debits equal credits
    let totalDebits = 0;
    let totalCredits = 0;
    for (const line of input.Line || []) {
      if (line.JournalEntryLineDetail?.PostingType === 'Debit') {
        totalDebits += line.Amount || 0;
      } else {
        totalCredits += line.Amount || 0;
      }
    }

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Debits ($${totalDebits.toFixed(2)}) must equal Credits ($${totalCredits.toFixed(2)})`,
          },
        ],
      };
    }

    const response = await createQuickbooksJournalEntry(input);

    if (response.isError) {
      logger.error('Failed to create journal entry', new Error(response.error || 'Unknown error'));
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [
          { type: 'text' as const, text: `Error creating journal entry: ${response.error}` },
        ],
      };
    }

    // Store idempotency result
    if (response.result?.Id) {
      storeIdempotency(args.idempotencyKey, response.result.Id, 'JournalEntry');
    }

    logger.info('Journal entry created successfully', {
      journalEntryId: response.result?.Id,
      totalAmt: response.result?.TotalAmt,
    });
    logToolResponse(toolName, true, Date.now() - startTime);

    const payload = buildCreateToolPayload({
      entityType: 'JournalEntry',
      entity: response.result,
      wasIdempotent: false,
      format: responseFormat,
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
    };
  } catch (error) {
    logger.error('Unexpected error in create_journal_entry', error);
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

export const CreateJournalEntryTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
