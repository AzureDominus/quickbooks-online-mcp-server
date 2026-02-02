/**
 * Item Schemas
 *
 * Schemas for creating, updating, and searching items in QuickBooks Online.
 */

import { z } from 'zod';
import { ReferenceSchema, SearchFilterSchema, QboIdRequiredSchema } from './common.schema.js';

// =============================================================================
// Create/Update Schemas
// =============================================================================

export const CreateItemInputSchema = z.object({
  /** Item name (required) */
  Name: z.string().min(1).max(100).describe('Item name (required)'),
  /** Item type */
  Type: z.enum(['Inventory', 'Service', 'NonInventory']).optional().describe('Item type'),
  /** Income account (for sales) */
  IncomeAccountRef: ReferenceSchema.optional().describe('Income account for sales'),
  /** Expense account (for purchases) */
  ExpenseAccountRef: ReferenceSchema.optional().describe('Expense account for purchases'),
  /** Asset account (for inventory) */
  AssetAccountRef: ReferenceSchema.optional().describe('Asset account (inventory items)'),
  /** Description for sales */
  Description: z.string().max(4000).optional(),
  /** Unit price */
  UnitPrice: z.number().optional().describe('Sales price'),
  /** Purchase cost */
  PurchaseCost: z.number().optional().describe('Purchase cost'),
  /** Quantity on hand (inventory) */
  QtyOnHand: z.number().optional().describe('Quantity on hand'),
  /** Is active */
  Active: z.boolean().optional().default(true),
  /** Is taxable */
  Taxable: z.boolean().optional(),
  /** SKU */
  Sku: z.string().max(100).optional(),
});

export type CreateItemInput = z.infer<typeof CreateItemInputSchema>;

/**
 * Schema for updating an existing item
 * Extends create schema with required Id and SyncToken, all other fields optional
 */
export const UpdateItemInputSchema = CreateItemInputSchema.extend({
  /** Item ID (required for update) */
  Id: QboIdRequiredSchema.describe('Item ID (required)'),
  /** Sync token for optimistic locking (required for update) */
  SyncToken: z.string().describe('Sync token for optimistic locking (required)'),
})
  .partial()
  .required({ Id: true, SyncToken: true });

export type UpdateItemInput = z.infer<typeof UpdateItemInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

export const SearchItemsInputSchema = z.object({
  /** Search by name */
  search: z.string().optional().describe('Search items by name'),
  /** Filter by item type */
  type: z.enum(['Inventory', 'Service', 'NonInventory']).optional().describe('Filter by item type'),
  /** Filter by active status */
  active: z.boolean().optional().describe('Filter by active status'),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
  fetchAll: z.boolean().optional(),
});

export type SearchItemsInput = z.infer<typeof SearchItemsInputSchema>;
