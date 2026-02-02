/**
 * Account Schemas
 *
 * Schemas for creating, updating, and searching accounts (chart of accounts) in QuickBooks Online.
 */

import { z } from 'zod';
import {
  ReferenceSchema,
  AccountTypeEnum,
  SearchFilterSchema,
  QboIdRequiredSchema,
} from './common.schema.js';

// =============================================================================
// Create/Update Schemas
// =============================================================================

/**
 * Schema for creating a chart of accounts entry
 */
export const CreateAccountInputSchema = z.object({
  /** Account name (required, unique) */
  Name: z.string().min(1).max(100).describe('Account name (required, must be unique)'),
  /** Account type (required) */
  AccountType: AccountTypeEnum.describe('Account type (required)'),
  /** Account subtype */
  AccountSubType: z
    .string()
    .optional()
    .describe("Account subtype (e.g., 'Checking', 'Savings', 'Advertising')"),
  /** Description */
  Description: z.string().max(4000).optional().describe('Account description'),
  /** Classification */
  Classification: z
    .enum(['Asset', 'Equity', 'Expense', 'Liability', 'Revenue'])
    .optional()
    .describe('Account classification'),
  /** Is active */
  Active: z.boolean().optional().default(true).describe('Whether account is active'),
  /** Is sub-account */
  SubAccount: z.boolean().optional().describe('Is this a sub-account?'),
  /** Parent account reference (if sub-account) */
  ParentRef: ReferenceSchema.optional().describe('Parent account reference (for sub-accounts)'),
  /** Account number */
  AcctNum: z.string().max(7).optional().describe('User-defined account number'),
});

export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;

/**
 * Schema for updating an existing account
 * Extends create schema with required Id and SyncToken, all other fields optional
 */
export const UpdateAccountInputSchema = CreateAccountInputSchema.extend({
  /** Account ID (required for update) */
  Id: QboIdRequiredSchema.describe('Account ID (required)'),
  /** Sync token for optimistic locking (required for update) */
  SyncToken: z.string().describe('Sync token for optimistic locking (required)'),
})
  .partial()
  .required({ Id: true, SyncToken: true });

export type UpdateAccountInput = z.infer<typeof UpdateAccountInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

export const SearchAccountsInputSchema = z.object({
  /** Filter by account type */
  accountType: AccountTypeEnum.optional().describe('Filter by account type'),
  /** Filter by account subtype */
  accountSubType: z.string().optional().describe('Filter by account subtype'),
  /** Search by name */
  search: z.string().optional().describe('Search accounts by name'),
  /** Filter by active status */
  active: z.boolean().optional().describe('Filter by active status'),
  /** Filter by kind (helper for expense/payment accounts) */
  kind: z
    .enum(['expense_categories', 'payment_accounts', 'all'])
    .optional()
    .describe('Filter by account kind: expense_categories, payment_accounts, or all'),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

export type SearchAccountsInput = z.infer<typeof SearchAccountsInputSchema>;
