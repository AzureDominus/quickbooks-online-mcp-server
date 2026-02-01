/**
 * Vendor Schemas
 *
 * Schemas for creating, updating, and searching vendors in QuickBooks Online.
 */

import { z } from 'zod';
import {
  EmailAddressSchema,
  PhoneNumberSchema,
  PhysicalAddressSchema,
  WebAddressSchema,
  SearchFilterSchema,
} from './common.schema.js';

// =============================================================================
// Create/Update Schemas
// =============================================================================

export const CreateVendorInputSchema = z.object({
  /** Display name (required, must be unique) */
  DisplayName: z.string().min(1).max(500).describe('Unique display name for the vendor (required)'),
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
  /** Website */
  WebAddr: WebAddressSchema.optional().describe('Website URL'),
  /** Account number with vendor */
  AcctNum: z.string().max(100).optional().describe('Account number with this vendor'),
  /** Is 1099 vendor */
  Vendor1099: z.boolean().optional().describe('Is this a 1099 vendor?'),
  /** Active status */
  Active: z.boolean().optional().default(true).describe('Is vendor active?'),
  /** Notes */
  Notes: z.string().max(2000).optional().describe('Internal notes about vendor'),
});

export type CreateVendorInput = z.infer<typeof CreateVendorInputSchema>;

export const UpdateVendorInputSchema = CreateVendorInputSchema.extend({
  /** Vendor ID (required for update) */
  Id: z.string().describe('Vendor ID (required)'),
  /** Sync token (required for update) */
  SyncToken: z.string().describe('Sync token (required)'),
})
  .partial()
  .required({ Id: true, SyncToken: true, DisplayName: true });

export type UpdateVendorInput = z.infer<typeof UpdateVendorInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

export const SearchVendorsInputSchema = z.object({
  /** Search by display name (partial match) */
  search: z.string().optional().describe('Search vendors by name (partial match)'),
  /** Filter by active status */
  active: z.boolean().optional().describe('Filter by active status'),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional().describe('Raw filter criteria'),
  /** Sort ascending */
  asc: z.string().optional().describe('Sort ascending by field'),
  /** Sort descending */
  desc: z.string().optional().describe('Sort descending by field'),
  /** Limit results */
  limit: z.number().int().min(1).max(1000).optional().default(100),
  /** Offset for pagination */
  offset: z.number().int().min(0).optional().default(0),
  /** Fetch all */
  fetchAll: z.boolean().optional(),
});

export type SearchVendorsInput = z.infer<typeof SearchVendorsInputSchema>;
