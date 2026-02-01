/**
 * Customer Schemas
 *
 * Schemas for creating, updating, and searching customers in QuickBooks Online.
 */

import { z } from 'zod';
import {
  EmailAddressSchema,
  PhoneNumberSchema,
  PhysicalAddressSchema,
  SearchFilterSchema,
  QboIdSchema,
} from './common.schema.js';

// =============================================================================
// Create/Update Schemas
// =============================================================================

export const CreateCustomerInputSchema = z.object({
  /** Display name (required, must be unique) */
  DisplayName: z
    .string()
    .min(1)
    .max(500)
    .describe('Unique display name for the customer (required)'),
  /** Company name */
  CompanyName: z.string().max(500).optional().describe('Company/business name'),
  /** Given/first name */
  GivenName: z.string().max(100).optional().describe('First name'),
  /** Family/last name */
  FamilyName: z.string().max(100).optional().describe('Last name'),
  /** Primary email */
  PrimaryEmailAddr: EmailAddressSchema.optional().describe('Primary email address'),
  /** Primary phone */
  PrimaryPhone: PhoneNumberSchema.optional().describe('Primary phone number'),
  /** Billing address */
  BillAddr: PhysicalAddressSchema.optional().describe('Billing address'),
  /** Shipping address */
  ShipAddr: PhysicalAddressSchema.optional().describe('Shipping address'),
  /** Active status */
  Active: z.boolean().optional().default(true).describe('Is customer active?'),
  /** Notes */
  Notes: z.string().max(2000).optional().describe('Internal notes about customer'),
  /** Is this customer taxable? */
  Taxable: z.boolean().optional().describe('Is customer taxable?'),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;

export const UpdateCustomerInputSchema = CreateCustomerInputSchema.extend({
  /** Customer ID (required for update) */
  Id: QboIdSchema.describe('Customer ID (required)'),
  /** Sync token (required for update) */
  SyncToken: z.string().describe('Sync token (required)'),
})
  .partial()
  .required({ Id: true, SyncToken: true });

export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

export const SearchCustomersInputSchema = z.object({
  /** Search by display name */
  search: z.string().optional().describe('Search customers by name (partial match)'),
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

export type SearchCustomersInput = z.infer<typeof SearchCustomersInputSchema>;
