/**
 * Unit Tests: Schema Validation
 * 
 * Tests for Zod schema validation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { 
  CreatePurchaseInputSchema, 
  SearchPurchasesInputSchema,
  CreateCustomerInputSchema,
  DeleteInputSchema,
  ReferenceSchema,
} from '../../types/qbo-schemas.js';

// =============================================================================
// Unit Tests: Schema Validation
// =============================================================================

describe('Schema Validation', () => {
  describe('CreatePurchaseInputSchema', () => {
    it('should accept valid purchase input', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'CreditCard',
        paymentAccountId: '123',
        lines: [
          { amount: 99.99, expenseAccountId: '456' },
        ],
      };
      
      const result = CreatePurchaseInputSchema.safeParse(input);
      assert.ok(result.success, `Validation failed: ${JSON.stringify(result.error?.issues)}`);
    });

    it('should reject invalid payment type', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'Bitcoin', // Invalid
        paymentAccountId: '123',
        lines: [{ amount: 50, expenseAccountId: '456' }],
      };
      
      const result = CreatePurchaseInputSchema.safeParse(input);
      assert.ok(!result.success);
    });

    it('should reject invalid date format', () => {
      const input = {
        txnDate: '01/31/2026', // Wrong format
        paymentType: 'CreditCard',
        paymentAccountId: '123',
        lines: [{ amount: 50, expenseAccountId: '456' }],
      };
      
      const result = CreatePurchaseInputSchema.safeParse(input);
      assert.ok(!result.success);
    });

    it('should accept optional fields', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'Check',
        paymentAccountId: '123',
        vendorId: '789',
        memo: 'Test memo',
        privateNote: 'Test note',
        referenceNumber: 'REF-001',
        globalTaxCalculation: 'TaxExcluded',
        idempotencyKey: 'my-unique-key',
        lines: [
          {
            amount: 100,
            expenseAccountId: '456',
            description: 'Test item',
            taxCodeId: 'TAX',
            customerId: '111',
            classId: '222',
            billable: true,
          },
        ],
      };
      
      const result = CreatePurchaseInputSchema.safeParse(input);
      assert.ok(result.success, `Validation failed: ${JSON.stringify(result.error?.issues)}`);
    });
  });

  describe('SearchPurchasesInputSchema', () => {
    it('should accept empty search (all defaults)', () => {
      const result = SearchPurchasesInputSchema.safeParse({});
      assert.ok(result.success);
    });

    it('should accept date range filter', () => {
      const input = {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      };
      
      const result = SearchPurchasesInputSchema.safeParse(input);
      assert.ok(result.success);
    });

    it('should accept amount range filter', () => {
      const input = {
        minAmount: 100,
        maxAmount: 500,
      };
      
      const result = SearchPurchasesInputSchema.safeParse(input);
      assert.ok(result.success);
    });

    it('should accept pagination options', () => {
      const input = {
        limit: 50,
        offset: 100,
        desc: 'TotalAmt',
      };
      
      const result = SearchPurchasesInputSchema.safeParse(input);
      assert.ok(result.success);
    });

    it('should reject limit over 1000', () => {
      const input = {
        limit: 2000,
      };
      
      const result = SearchPurchasesInputSchema.safeParse(input);
      assert.ok(!result.success);
    });
  });

  describe('CreateCustomerInputSchema', () => {
    it('should accept valid customer input', () => {
      const input = {
        DisplayName: 'Test Customer',
        GivenName: 'John',
        FamilyName: 'Doe',
        PrimaryEmailAddr: { Address: 'john@test.com' },
      };
      
      const result = CreateCustomerInputSchema.safeParse(input);
      assert.ok(result.success, `Validation failed: ${JSON.stringify(result.error?.issues)}`);
    });

    it('should require DisplayName', () => {
      const input = {
        GivenName: 'John',
        FamilyName: 'Doe',
      };
      
      const result = CreateCustomerInputSchema.safeParse(input);
      assert.ok(!result.success);
    });
  });

  describe('DeleteInputSchema', () => {
    it('should accept valid delete input', () => {
      const input = {
        Id: '123',
        SyncToken: '0',
      };
      
      const result = DeleteInputSchema.safeParse(input);
      assert.ok(result.success);
    });

    it('should require both Id and SyncToken', () => {
      const input1 = { Id: '123' };
      const input2 = { SyncToken: '0' };
      
      assert.ok(!DeleteInputSchema.safeParse(input1).success);
      assert.ok(!DeleteInputSchema.safeParse(input2).success);
    });
  });

  describe('ReferenceSchema', () => {
    it('should accept reference with value only', () => {
      const input = { value: '123' };
      const result = ReferenceSchema.safeParse(input);
      assert.ok(result.success);
    });

    it('should accept reference with value and name', () => {
      const input = { value: '123', name: 'Test Account' };
      const result = ReferenceSchema.safeParse(input);
      assert.ok(result.success);
    });

    it('should require value', () => {
      const input = { name: 'Test Account' };
      const result = ReferenceSchema.safeParse(input);
      assert.ok(!result.success);
    });
  });
});

console.log('Unit tests: Schemas loaded successfully');
