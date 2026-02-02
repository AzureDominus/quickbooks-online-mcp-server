/**
 * Employee Schemas
 *
 * Schemas for creating, updating, and searching employees in QuickBooks Online.
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

export const CreateEmployeeInputSchema = z.object({
  /** Given/first name (required) */
  GivenName: z.string().min(1).max(100).describe('First name (required)'),
  /** Family/last name (required) */
  FamilyName: z.string().min(1).max(100).describe('Last name (required)'),
  /** Display name (auto-generated if not provided) */
  DisplayName: z.string().max(500).optional().describe('Display name'),
  /** Primary email */
  PrimaryEmailAddr: EmailAddressSchema.optional().describe('Primary email'),
  /** Primary phone */
  PrimaryPhone: PhoneNumberSchema.optional().describe('Primary phone'),
  /** Mobile phone */
  Mobile: PhoneNumberSchema.optional().describe('Mobile phone'),
  /** Primary address */
  PrimaryAddr: PhysicalAddressSchema.optional().describe('Primary address'),
  /** SSN (last 4 digits only shown) */
  SSN: z.string().max(11).optional().describe('Social Security Number'),
  /** Employee number */
  EmployeeNumber: z.string().max(100).optional().describe('Employee number'),
  /** Hire date */
  HiredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Hire date (YYYY-MM-DD)'),
  /** Release/termination date */
  ReleasedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Release date (YYYY-MM-DD)'),
  /** Active status */
  Active: z.boolean().optional().default(true).describe('Is employee active?'),
  /** Billable time flag */
  BillableTime: z.boolean().optional().describe('Track billable time?'),
  /** Hourly bill rate */
  BillRate: z.number().optional().describe('Hourly bill rate'),
  /** Birth date */
  BirthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('Birth date (YYYY-MM-DD)'),
  /** Gender */
  Gender: z.enum(['Male', 'Female']).optional().describe('Gender'),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeInputSchema>;

export const UpdateEmployeeInputSchema = CreateEmployeeInputSchema.extend({
  /** Employee ID (required for update) */
  Id: QboIdSchema.describe('Employee ID (required)'),
  /** Sync token (required for update) */
  SyncToken: z.string().describe('Sync token (required)'),
})
  .partial()
  .required({ Id: true, SyncToken: true });

export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeInputSchema>;

// =============================================================================
// Search Schema
// =============================================================================

export const SearchEmployeesInputSchema = z.object({
  /** Search by name */
  search: z.string().optional().describe('Search employees by name'),
  /** Filter by active status */
  active: z.boolean().optional().describe('Filter by active status'),
  /** Raw filter criteria */
  criteria: z.array(SearchFilterSchema).optional(),
  asc: z.string().optional(),
  desc: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional().default(100),
  offset: z.number().int().min(0).optional().default(0),
});

export type SearchEmployeesInput = z.infer<typeof SearchEmployeesInputSchema>;
