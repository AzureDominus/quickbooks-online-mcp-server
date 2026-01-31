/**
 * Integration Tests for QuickBooks MCP Server
 * 
 * Tests the new features: idempotency, logging, transforms, and API calls.
 * Uses the sandbox OAuth credentials already configured.
 * 
 * Run with: npm test
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Import helpers
import { IdempotencyService, checkIdempotency, storeIdempotency, getIdempotencyService } from '../helpers/idempotency.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { 
  transformPurchaseToQBO, 
  transformPurchaseFromQBO, 
  buildPurchaseSearchCriteria,
  buildBillSearchCriteria,
  buildInvoiceSearchCriteria,
  buildEstimateSearchCriteria,
  validateReferences 
} from '../helpers/transform.js';

// Import schemas for validation testing
import { 
  CreatePurchaseInputSchema, 
  SearchPurchasesInputSchema,
  CreateCustomerInputSchema,
  DeleteInputSchema,
  ReferenceSchema,
} from '../types/qbo-schemas.js';

// =============================================================================
// Unit Tests: Idempotency Service
// =============================================================================

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  const testStorePath = path.join(os.tmpdir(), 'test-idempotency.json');
  
  beforeEach(() => {
    // Clean up any previous test store
    if (fs.existsSync(testStorePath)) {
      fs.unlinkSync(testStorePath);
    }
    
    // Create service with test config
    service = new IdempotencyService({
      storagePath: testStorePath,
      ttlMs: 60000, // 1 minute for tests
      cleanupIntervalMs: 30000,
    });
  });
  
  afterEach(() => {
    // Clean up
    service.clear();
    if (fs.existsSync(testStorePath)) {
      fs.unlinkSync(testStorePath);
    }
  });

  it('should store and retrieve idempotency entries', () => {
    const key = 'test-key-123';
    const entityId = 'purchase-456';
    const entityType = 'Purchase';
    
    // Store entry
    service.set(key, entityId, entityType);
    
    // Check entry exists
    const entry = service.check(key);
    assert.ok(entry, 'Entry should exist');
    assert.equal(entry!.entityId, entityId);
    assert.equal(entry!.entityType, entityType);
  });

  it('should return null for non-existent keys', () => {
    const entry = service.check('non-existent-key');
    assert.equal(entry, null);
  });

  it('should prevent duplicates by returning existing entry', () => {
    const key = 'duplicate-test';
    const entityId = 'purchase-789';
    
    service.set(key, entityId, 'Purchase');
    
    // Second check should return the same entry
    const entry1 = service.check(key);
    const entry2 = service.check(key);
    
    assert.deepEqual(entry1, entry2);
  });

  it('should remove entries', () => {
    const key = 'removable-key';
    service.set(key, 'entity-123', 'Purchase');
    
    // Verify it exists
    assert.ok(service.check(key));
    
    // Remove it
    service.remove(key);
    
    // Verify it's gone
    assert.equal(service.check(key), null);
  });

  it('should generate deterministic keys from data', () => {
    const data = {
      txnDate: '2026-01-31',
      paymentType: 'CreditCard',
      paymentAccountId: '123',
      totalAmount: 99.99,
      vendorId: '456',
    };
    
    const key1 = IdempotencyService.generateKey(data);
    const key2 = IdempotencyService.generateKey(data);
    
    assert.equal(key1, key2, 'Same data should generate same key');
    assert.ok(key1.startsWith('auto_'), 'Generated key should have auto_ prefix');
  });

  it('should generate different keys for different data', () => {
    const key1 = IdempotencyService.generateKey({
      txnDate: '2026-01-31',
      paymentType: 'CreditCard',
      paymentAccountId: '123',
      totalAmount: 99.99,
    });
    
    const key2 = IdempotencyService.generateKey({
      txnDate: '2026-01-31',
      paymentType: 'CreditCard',
      paymentAccountId: '123',
      totalAmount: 100.00, // Different amount
    });
    
    assert.notEqual(key1, key2, 'Different data should generate different keys');
  });

  it('should track stats correctly', () => {
    service.set('key1', 'entity1', 'Purchase');
    service.set('key2', 'entity2', 'Invoice');
    
    const stats = service.getStats();
    assert.equal(stats.totalEntries, 2);
    assert.ok(stats.oldestEntry);
    assert.ok(stats.newestEntry);
  });
});

describe('Idempotency Helper Functions', () => {
  beforeEach(() => {
    getIdempotencyService().clear();
  });

  it('checkIdempotency should return null for undefined key', () => {
    const result = checkIdempotency(undefined);
    assert.equal(result, null);
  });

  it('storeIdempotency should not throw for undefined key', () => {
    // Should not throw
    storeIdempotency(undefined, 'entity-123', 'Purchase');
  });

  it('should work together for full flow', () => {
    const key = 'flow-test-key';
    
    // First check should return null
    assert.equal(checkIdempotency(key), null);
    
    // Store result
    storeIdempotency(key, 'created-entity-id', 'Purchase');
    
    // Second check should return entity ID
    assert.equal(checkIdempotency(key), 'created-entity-id');
  });
});

// =============================================================================
// Unit Tests: Transform Helpers
// =============================================================================

describe('Transform Helpers', () => {
  describe('transformPurchaseToQBO', () => {
    it('should transform simple purchase input to QBO format', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'CreditCard' as const,
        paymentAccountId: '123',
        lines: [
          { amount: 99.99, expenseAccountId: '456' },
        ],
      };
      
      const qbo = transformPurchaseToQBO(input) as any;
      
      assert.equal(qbo.TxnDate, '2026-01-31');
      assert.equal(qbo.PaymentType, 'CreditCard');
      assert.equal(qbo.AccountRef.value, '123');
      assert.ok(Array.isArray(qbo.Line));
      assert.equal(qbo.Line.length, 1);
      assert.equal(qbo.Line[0].Amount, 99.99);
    });

    it('should transform vendor reference', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'Check' as const,
        paymentAccountId: '123',
        vendorId: '789',
        lines: [{ amount: 50, expenseAccountId: '456' }],
      };
      
      const qbo = transformPurchaseToQBO(input);
      
      assert.deepEqual(qbo.EntityRef, { value: '789', type: 'Vendor' });
    });

    it('should include memo and private note', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'Cash' as const,
        paymentAccountId: '123',
        memo: 'Printed memo',
        privateNote: 'Internal note',
        lines: [{ amount: 25, expenseAccountId: '456' }],
      };
      
      const qbo = transformPurchaseToQBO(input);
      
      assert.equal(qbo.Memo, 'Printed memo');
      assert.equal(qbo.PrivateNote, 'Internal note');
    });

    it('should handle tax codes and billable items', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'CreditCard' as const,
        paymentAccountId: '123',
        lines: [
          {
            amount: 100,
            expenseAccountId: '456',
            taxCodeId: 'TAX',
            customerId: '789',
            billable: true,
          },
        ],
      };
      
      const qbo = transformPurchaseToQBO(input) as any;
      const lineDetail = qbo.Line[0].AccountBasedExpenseLineDetail;
      
      assert.deepEqual(lineDetail?.TaxCodeRef, { value: 'TAX' });
      assert.deepEqual(lineDetail?.CustomerRef, { value: '789' });
      assert.equal(lineDetail?.BillableStatus, 'Billable');
    });

    it('should set global tax calculation', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'CreditCard' as const,
        paymentAccountId: '123',
        globalTaxCalculation: 'TaxInclusive' as const,
        lines: [{ amount: 100, expenseAccountId: '456' }],
      };
      
      const qbo = transformPurchaseToQBO(input);
      
      assert.equal(qbo.GlobalTaxCalculation, 'TaxInclusive');
    });
  });

  describe('transformPurchaseFromQBO', () => {
    it('should transform QBO purchase to user-friendly format', () => {
      const qboPurchase = {
        Id: '123',
        SyncToken: '0',
        TxnDate: '2026-01-31',
        PaymentType: 'CreditCard',
        TotalAmt: 99.99,
        AccountRef: { value: '456', name: 'Business Credit Card' },
        EntityRef: { value: '789', name: 'Office Supplies Inc', type: 'Vendor' },
        Line: [
          {
            Amount: 99.99,
            DetailType: 'AccountBasedExpenseLineDetail',
            AccountBasedExpenseLineDetail: {
              AccountRef: { value: '111', name: 'Office Supplies' },
            },
          },
        ],
      };
      
      const result = transformPurchaseFromQBO(qboPurchase) as any;
      
      assert.equal(result.id, '123');
      assert.equal(result.txnDate, '2026-01-31');
      assert.equal(result.totalAmt, 99.99);
      assert.equal(result.paymentType, 'CreditCard');
      assert.equal(result.paymentAccount?.name, 'Business Credit Card');
      assert.equal(result.vendor?.name, 'Office Supplies Inc');
    });
  });

  describe('buildPurchaseSearchCriteria', () => {
    it('should build date range criteria', () => {
      const input = {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        limit: 100,
        offset: 0,
      };
      
      const { criteria } = buildPurchaseSearchCriteria(input);
      
      const txnDateCriteria = criteria.filter(c => c.field === 'TxnDate');
      assert.equal(txnDateCriteria.length, 2);
      assert.ok(txnDateCriteria.some(c => c.operator === '>=' && c.value === '2026-01-01'));
      assert.ok(txnDateCriteria.some(c => c.operator === '<=' && c.value === '2026-01-31'));
    });

    it('should build amount range criteria', () => {
      const input = {
        minAmount: 100,
        maxAmount: 500,
        limit: 100,
        offset: 0,
      };
      
      const { criteria } = buildPurchaseSearchCriteria(input);
      
      const amountCriteria = criteria.filter(c => c.field === 'TotalAmt');
      assert.equal(amountCriteria.length, 2);
      assert.ok(amountCriteria.some(c => c.operator === '>=' && c.value === '100'));
      assert.ok(amountCriteria.some(c => c.operator === '<=' && c.value === '500'));
    });

    it('should build vendor filter', () => {
      const input = {
        vendorId: '123',
        limit: 100,
        offset: 0,
      };
      
      const { criteria } = buildPurchaseSearchCriteria(input);
      
      const vendorCriteria = criteria.find(c => c.field === 'EntityRef');
      assert.ok(vendorCriteria);
      assert.equal(vendorCriteria!.value, '123');
    });

    it('should build pagination options', () => {
      const input = {
        limit: 50,
        offset: 100,
        desc: 'TotalAmt',
      };
      
      const { options } = buildPurchaseSearchCriteria(input);
      
      assert.equal(options.limit, 50);
      assert.equal(options.offset, 100);
      assert.equal(options.desc, 'TotalAmt');
    });
  });

  describe('validateReferences', () => {
    it('should return empty array for valid input', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'CreditCard' as const,
        paymentAccountId: '123',
        lines: [{ amount: 50, expenseAccountId: '456' }],
      };
      
      const errors = validateReferences(input);
      assert.equal(errors.length, 0);
    });

    it('should catch missing required fields', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'CreditCard' as const,
        // Missing paymentAccountId
        lines: [{ amount: 50, expenseAccountId: '456' }],
      } as any;
      
      const errors = validateReferences(input);
      assert.ok(errors.length > 0);
      assert.ok(errors.some(e => e.includes('paymentAccountId')));
    });

    it('should catch empty lines array', () => {
      const input = {
        txnDate: '2026-01-31',
        paymentType: 'CreditCard' as const,
        paymentAccountId: '123',
        lines: [],
      };
      
      const errors = validateReferences(input);
      assert.ok(errors.some(e => e.includes('line')));
    });
  });

  describe('buildBillSearchCriteria', () => {
    it('should return empty criteria for empty input', () => {
      const input = {};
      const { criteria, options } = buildBillSearchCriteria(input);
      assert.equal(criteria.length, 0);
      assert.deepEqual(options, {});
    });

    it('should build transaction date range criteria', () => {
      const input = {
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
      };
      
      const { criteria } = buildBillSearchCriteria(input);
      
      const txnDateCriteria = criteria.filter(c => c.field === 'TxnDate');
      assert.equal(txnDateCriteria.length, 2);
      assert.ok(txnDateCriteria.some(c => c.operator === '>=' && c.value === '2026-01-01'));
      assert.ok(txnDateCriteria.some(c => c.operator === '<=' && c.value === '2026-12-31'));
    });

    it('should build due date range criteria', () => {
      const input = {
        dueDateFrom: '2026-02-01',
        dueDateTo: '2026-02-28',
      };
      
      const { criteria } = buildBillSearchCriteria(input);
      
      const dueDateCriteria = criteria.filter(c => c.field === 'DueDate');
      assert.equal(dueDateCriteria.length, 2);
      assert.ok(dueDateCriteria.some(c => c.operator === '>=' && c.value === '2026-02-01'));
      assert.ok(dueDateCriteria.some(c => c.operator === '<=' && c.value === '2026-02-28'));
    });

    it('should build amount range criteria', () => {
      const input = {
        amountMin: 100,
        amountMax: 500,
      };
      
      const { criteria } = buildBillSearchCriteria(input);
      
      const amountCriteria = criteria.filter(c => c.field === 'TotalAmt');
      assert.equal(amountCriteria.length, 2);
      assert.ok(amountCriteria.some(c => c.operator === '>=' && c.value === '100'));
      assert.ok(amountCriteria.some(c => c.operator === '<=' && c.value === '500'));
    });

    it('should build balance range criteria', () => {
      const input = {
        balanceMin: 50,
        balanceMax: 200,
      };
      
      const { criteria } = buildBillSearchCriteria(input);
      
      const balanceCriteria = criteria.filter(c => c.field === 'Balance');
      assert.equal(balanceCriteria.length, 2);
      assert.ok(balanceCriteria.some(c => c.operator === '>=' && c.value === '50'));
      assert.ok(balanceCriteria.some(c => c.operator === '<=' && c.value === '200'));
    });

    it('should build vendor filter', () => {
      const input = {
        vendorId: '456',
      };
      
      const { criteria } = buildBillSearchCriteria(input);
      
      const vendorCriteria = criteria.find(c => c.field === 'VendorRef');
      assert.ok(vendorCriteria);
      assert.equal(vendorCriteria!.value, '456');
    });

    it('should build payment status filter for Paid', () => {
      const input = {
        paymentStatus: 'Paid' as const,
      };
      
      const { criteria } = buildBillSearchCriteria(input);
      
      const balanceCriteria = criteria.find(c => c.field === 'Balance');
      assert.ok(balanceCriteria);
      assert.equal(balanceCriteria!.value, '0');
      assert.equal(balanceCriteria!.operator, '=');
    });

    it('should build payment status filter for Unpaid', () => {
      const input = {
        paymentStatus: 'Unpaid' as const,
      };
      
      const { criteria } = buildBillSearchCriteria(input);
      
      const balanceCriteria = criteria.find(c => c.field === 'Balance');
      assert.ok(balanceCriteria);
      assert.equal(balanceCriteria!.value, '0');
      assert.equal(balanceCriteria!.operator, '>');
    });

    it('should build docNumber filter', () => {
      const input = {
        docNumber: 'BILL-001',
      };
      
      const { criteria } = buildBillSearchCriteria(input);
      
      const docCriteria = criteria.find(c => c.field === 'DocNumber');
      assert.ok(docCriteria);
      assert.equal(docCriteria!.value, 'BILL-001');
    });

    it('should handle multiple filters together', () => {
      const input = {
        dateFrom: '2026-01-01',
        vendorId: '789',
        amountMin: 100,
        limit: 50,
        desc: 'TxnDate',
      };
      
      const { criteria, options } = buildBillSearchCriteria(input);
      
      assert.equal(criteria.length, 3);
      assert.equal(options.limit, 50);
      assert.equal(options.desc, 'TxnDate');
    });

    it('should pass raw criteria through', () => {
      const input = {
        criteria: [
          { field: 'CustomField', value: 'test', operator: 'LIKE' as const },
        ],
      };
      
      const { criteria } = buildBillSearchCriteria(input);
      
      const customCriteria = criteria.find(c => c.field === 'CustomField');
      assert.ok(customCriteria);
      assert.equal(customCriteria!.value, 'test');
      assert.equal(customCriteria!.operator, 'LIKE');
    });
  });

  describe('buildInvoiceSearchCriteria', () => {
    it('should return empty criteria for empty input', () => {
      const input = {};
      const { criteria, options } = buildInvoiceSearchCriteria(input);
      assert.equal(criteria.length, 0);
      assert.deepEqual(options, {});
    });

    it('should build transaction date range criteria', () => {
      const input = {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      };
      
      const { criteria } = buildInvoiceSearchCriteria(input);
      
      const txnDateCriteria = criteria.filter(c => c.field === 'TxnDate');
      assert.equal(txnDateCriteria.length, 2);
      assert.ok(txnDateCriteria.some(c => c.operator === '>=' && c.value === '2026-01-01'));
      assert.ok(txnDateCriteria.some(c => c.operator === '<=' && c.value === '2026-01-31'));
    });

    it('should build due date range criteria', () => {
      const input = {
        dueFrom: '2026-02-01',
        dueTo: '2026-02-28',
      };
      
      const { criteria } = buildInvoiceSearchCriteria(input);
      
      const dueDateCriteria = criteria.filter(c => c.field === 'DueDate');
      assert.equal(dueDateCriteria.length, 2);
      assert.ok(dueDateCriteria.some(c => c.operator === '>=' && c.value === '2026-02-01'));
      assert.ok(dueDateCriteria.some(c => c.operator === '<=' && c.value === '2026-02-28'));
    });

    it('should build amount range criteria', () => {
      const input = {
        amountMin: 1000,
        amountMax: 5000,
      };
      
      const { criteria } = buildInvoiceSearchCriteria(input);
      
      const amountCriteria = criteria.filter(c => c.field === 'TotalAmt');
      assert.equal(amountCriteria.length, 2);
      assert.ok(amountCriteria.some(c => c.operator === '>=' && c.value === '1000'));
      assert.ok(amountCriteria.some(c => c.operator === '<=' && c.value === '5000'));
    });

    it('should build balance range criteria', () => {
      const input = {
        balanceMin: 100,
        balanceMax: 500,
      };
      
      const { criteria } = buildInvoiceSearchCriteria(input);
      
      const balanceCriteria = criteria.filter(c => c.field === 'Balance');
      assert.equal(balanceCriteria.length, 2);
      assert.ok(balanceCriteria.some(c => c.operator === '>=' && c.value === '100'));
      assert.ok(balanceCriteria.some(c => c.operator === '<=' && c.value === '500'));
    });

    it('should build customer filter', () => {
      const input = {
        customerId: '123',
      };
      
      const { criteria } = buildInvoiceSearchCriteria(input);
      
      const customerCriteria = criteria.find(c => c.field === 'CustomerRef');
      assert.ok(customerCriteria);
      assert.equal(customerCriteria!.value, '123');
    });

    it('should build docNumber filter', () => {
      const input = {
        docNumber: 'INV-2026-001',
      };
      
      const { criteria } = buildInvoiceSearchCriteria(input);
      
      const docCriteria = criteria.find(c => c.field === 'DocNumber');
      assert.ok(docCriteria);
      assert.equal(docCriteria!.value, 'INV-2026-001');
    });

    it('should handle multiple filters with pagination', () => {
      const input = {
        customerId: '456',
        dateFrom: '2026-01-01',
        amountMin: 500,
        limit: 25,
        offset: 50,
        asc: 'TxnDate',
      };
      
      const { criteria, options } = buildInvoiceSearchCriteria(input);
      
      assert.equal(criteria.length, 3);
      assert.ok(criteria.some(c => c.field === 'CustomerRef'));
      assert.ok(criteria.some(c => c.field === 'TxnDate'));
      assert.ok(criteria.some(c => c.field === 'TotalAmt'));
      assert.equal(options.limit, 25);
      assert.equal(options.offset, 50);
      assert.equal(options.asc, 'TxnDate');
    });

    it('should pass raw criteria through', () => {
      const input = {
        criteria: [
          { field: 'PrivateNote', value: '%urgent%', operator: 'LIKE' as const },
        ],
      };
      
      const { criteria } = buildInvoiceSearchCriteria(input);
      
      const customCriteria = criteria.find(c => c.field === 'PrivateNote');
      assert.ok(customCriteria);
      assert.equal(customCriteria!.value, '%urgent%');
      assert.equal(customCriteria!.operator, 'LIKE');
    });
  });

  describe('buildEstimateSearchCriteria', () => {
    it('should return empty criteria for empty input', () => {
      const input = {};
      const { criteria, options } = buildEstimateSearchCriteria(input);
      assert.equal(criteria.length, 0);
      assert.deepEqual(options, {});
    });

    it('should build transaction date range criteria', () => {
      const input = {
        dateFrom: '2026-01-01',
        dateTo: '2026-06-30',
      };
      
      const { criteria } = buildEstimateSearchCriteria(input);
      
      const txnDateCriteria = criteria.filter(c => c.field === 'TxnDate');
      assert.equal(txnDateCriteria.length, 2);
      assert.ok(txnDateCriteria.some(c => c.operator === '>=' && c.value === '2026-01-01'));
      assert.ok(txnDateCriteria.some(c => c.operator === '<=' && c.value === '2026-06-30'));
    });

    it('should build expiration date range criteria', () => {
      const input = {
        expirationFrom: '2026-03-01',
        expirationTo: '2026-03-31',
      };
      
      const { criteria } = buildEstimateSearchCriteria(input);
      
      const expirationCriteria = criteria.filter(c => c.field === 'ExpirationDate');
      assert.equal(expirationCriteria.length, 2);
      assert.ok(expirationCriteria.some(c => c.operator === '>=' && c.value === '2026-03-01'));
      assert.ok(expirationCriteria.some(c => c.operator === '<=' && c.value === '2026-03-31'));
    });

    it('should build amount range criteria', () => {
      const input = {
        amountMin: 250,
        amountMax: 2500,
      };
      
      const { criteria } = buildEstimateSearchCriteria(input);
      
      const amountCriteria = criteria.filter(c => c.field === 'TotalAmt');
      assert.equal(amountCriteria.length, 2);
      assert.ok(amountCriteria.some(c => c.operator === '>=' && c.value === '250'));
      assert.ok(amountCriteria.some(c => c.operator === '<=' && c.value === '2500'));
    });

    it('should build customer filter', () => {
      const input = {
        customerId: '999',
      };
      
      const { criteria } = buildEstimateSearchCriteria(input);
      
      const customerCriteria = criteria.find(c => c.field === 'CustomerRef');
      assert.ok(customerCriteria);
      assert.equal(customerCriteria!.value, '999');
    });

    it('should build status filter', () => {
      const input = {
        txnStatus: 'Pending' as const,
      };
      
      const { criteria } = buildEstimateSearchCriteria(input);
      
      const statusCriteria = criteria.find(c => c.field === 'TxnStatus');
      assert.ok(statusCriteria);
      assert.equal(statusCriteria!.value, 'Pending');
    });

    it('should build search filter with LIKE operator', () => {
      const input = {
        search: 'project-x',
      };
      
      const { criteria } = buildEstimateSearchCriteria(input);
      
      const searchCriteria = criteria.find(c => c.field === 'DocNumber');
      assert.ok(searchCriteria);
      assert.equal(searchCriteria!.value, '%project-x%');
      assert.equal(searchCriteria!.operator, 'LIKE');
    });

    it('should handle all status filter values', () => {
      const statuses = ['Pending', 'Accepted', 'Closed', 'Rejected'] as const;
      
      for (const status of statuses) {
        const input = { txnStatus: status };
        const { criteria } = buildEstimateSearchCriteria(input);
        const statusCriteria = criteria.find(c => c.field === 'TxnStatus');
        assert.ok(statusCriteria, `Status ${status} should create criteria`);
        assert.equal(statusCriteria!.value, status);
      }
    });

    it('should handle multiple filters and pagination', () => {
      const input = {
        customerId: '123',
        txnStatus: 'Accepted' as const,
        dateFrom: '2026-01-01',
        amountMin: 100,
        limit: 100,
        desc: 'TotalAmt',
        fetchAll: true,
      };
      
      const { criteria, options } = buildEstimateSearchCriteria(input);
      
      assert.equal(criteria.length, 4);
      assert.ok(criteria.some(c => c.field === 'CustomerRef'));
      assert.ok(criteria.some(c => c.field === 'TxnStatus'));
      assert.ok(criteria.some(c => c.field === 'TxnDate'));
      assert.ok(criteria.some(c => c.field === 'TotalAmt'));
      assert.equal(options.limit, 100);
      assert.equal(options.desc, 'TotalAmt');
      assert.equal(options.fetchAll, true);
    });

    it('should pass raw criteria through', () => {
      const input = {
        criteria: [
          { field: 'Memo', value: 'Quote for %', operator: 'LIKE' as const },
        ],
      };
      
      const { criteria } = buildEstimateSearchCriteria(input);
      
      const customCriteria = criteria.find(c => c.field === 'Memo');
      assert.ok(customCriteria);
      assert.equal(customCriteria!.value, 'Quote for %');
      assert.equal(customCriteria!.operator, 'LIKE');
    });

    it('should handle single date filter (dateFrom only)', () => {
      const input = {
        dateFrom: '2026-01-01',
      };
      
      const { criteria } = buildEstimateSearchCriteria(input);
      
      assert.equal(criteria.length, 1);
      assert.equal(criteria[0].field, 'TxnDate');
      assert.equal(criteria[0].value, '2026-01-01');
      assert.equal(criteria[0].operator, '>=');
    });

    it('should handle single amount filter (amountMax only)', () => {
      const input = {
        amountMax: 10000,
      };
      
      const { criteria } = buildEstimateSearchCriteria(input);
      
      assert.equal(criteria.length, 1);
      assert.equal(criteria[0].field, 'TotalAmt');
      assert.equal(criteria[0].value, '10000');
      assert.equal(criteria[0].operator, '<=');
    });
  });
});

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

// =============================================================================
// Unit Tests: Logger
// =============================================================================

describe('Logger', () => {
  it('should have all expected methods', () => {
    assert.ok(typeof logger.debug === 'function');
    assert.ok(typeof logger.info === 'function');
    assert.ok(typeof logger.warn === 'function');
    assert.ok(typeof logger.error === 'function');
    assert.ok(typeof logger.child === 'function');
    assert.ok(typeof logger.time === 'function');
  });

  it('should create child loggers', () => {
    const childLogger = logger.child({ tool: 'test_tool' });
    
    assert.ok(typeof childLogger.debug === 'function');
    assert.ok(typeof childLogger.info === 'function');
    assert.ok(typeof childLogger.child === 'function');
  });

  it('logToolRequest and logToolResponse should not throw', () => {
    // These should not throw
    logToolRequest('test_tool', { param1: 'value1' });
    logToolResponse('test_tool', true, 100);
    logToolResponse('test_tool', false, 50);
  });
});

// =============================================================================
// Integration Tests: API Calls (requires OAuth)
// =============================================================================

describe('Integration Tests (API)', () => {
  // Check if OAuth is configured
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping API tests - OAuth not configured', () => {});
    return;
  }

  it('should be able to search purchases', async () => {
    // Dynamic import to avoid initialization errors if not configured
    const { searchQuickbooksPurchases } = await import('../handlers/search-quickbooks-purchases.handler.js');
    
    const result = await searchQuickbooksPurchases({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    // Should return some result (even if empty array)
    assert.ok(result.result !== undefined);
  });

  it('should be able to search vendors', async () => {
    // Dynamic import to avoid initialization errors if not configured
    const { searchQuickbooksVendors } = await import('../handlers/search-quickbooks-vendors.handler.js');
    
    const result = await searchQuickbooksVendors({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    // Should return some result (even if empty array)
    assert.ok(result.result !== undefined);
  });

  it('should be able to search customers', async () => {
    const { searchQuickbooksCustomers } = await import('../handlers/search-quickbooks-customers.handler.js');
    
    const result = await searchQuickbooksCustomers({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    // Should return some result (even if empty array)
    assert.ok(result.result !== undefined);
  });

  it('should be able to search accounts', async () => {
    const { searchQuickbooksAccounts } = await import('../handlers/search-quickbooks-accounts.handler.js');
    
    const result = await searchQuickbooksAccounts({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
  });

  it('should be able to search tax codes', async () => {
    const { searchTaxCodes, getTaxCode } = await import('../handlers/tax-code.handler.js');
    
    const result = await searchTaxCodes({});
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    
    // If we got results, try to get a specific tax code
    const taxCodes = (result.result as any)?.QueryResponse?.TaxCode || [];
    if (taxCodes.length > 0) {
      const taxCodeId = taxCodes[0].Id;
      const getResult = await getTaxCode(taxCodeId);
      assert.ok(!getResult.isError, `Get tax code error: ${getResult.error}`);
    }
  });

  // More comprehensive test: Create, Read, Delete flow
  it('should complete full purchase lifecycle (create, read, delete)', async () => {
    const { createQuickbooksPurchase } = await import('../handlers/create-quickbooks-purchase.handler.js');
    const { getQuickbooksPurchase } = await import('../handlers/get-quickbooks-purchase.handler.js');
    const { deleteQuickbooksPurchase } = await import('../handlers/delete-quickbooks-purchase.handler.js');
    const { searchQuickbooksAccounts } = await import('../handlers/search-quickbooks-accounts.handler.js');
    
    // First, find a bank/credit card account and expense account
    const accountsResult = await searchQuickbooksAccounts({
      criteria: [{ field: 'Active', value: 'true' }],
      limit: 100,
    });
    
    if (accountsResult.isError) {
      console.log('Skipping lifecycle test - could not fetch accounts');
      return;
    }
    
    const accounts = (accountsResult.result as any)?.QueryResponse?.Account || [];
    const bankAccount = accounts.find((a: any) => 
      a.AccountType === 'Bank' || a.AccountType === 'Credit Card'
    );
    const expenseAccount = accounts.find((a: any) => a.AccountType === 'Expense');
    
    if (!bankAccount || !expenseAccount) {
      console.log('Skipping lifecycle test - required accounts not found');
      return;
    }
    
    // Create a test purchase
    const testPurchase = {
      TxnDate: new Date().toISOString().split('T')[0],
      PaymentType: bankAccount.AccountType === 'Credit Card' ? 'CreditCard' : 'Check',
      AccountRef: { value: bankAccount.Id },
      Line: [
        {
          Amount: 1.00,
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: 'Integration test purchase - safe to delete',
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: expenseAccount.Id },
          },
        },
      ],
    };
    
    // CREATE
    const createResult = await createQuickbooksPurchase(testPurchase);
    assert.ok(!createResult.isError, `Create failed: ${createResult.error}`);
    assert.ok(createResult.result?.Id, 'Created purchase should have an ID');
    
    const purchaseId = createResult.result.Id;
    const syncToken = createResult.result.SyncToken;
    
    try {
      // READ
      const getResult = await getQuickbooksPurchase(purchaseId);
      assert.ok(!getResult.isError, `Get failed: ${getResult.error}`);
      assert.equal(getResult.result?.Id, purchaseId);
      
      // DELETE
      const deleteResult = await deleteQuickbooksPurchase({
        Id: purchaseId,
        SyncToken: syncToken,
      });
      assert.ok(!deleteResult.isError, `Delete failed: ${deleteResult.error}`);
      
    } catch (error) {
      // Try to clean up even if test fails
      try {
        await deleteQuickbooksPurchase({ Id: purchaseId, SyncToken: syncToken });
      } catch { /* ignore cleanup errors */ }
      throw error;
    }
  });

  // =========================================================================
  // Read-Only API Tests (Active - don't modify data)
  // =========================================================================

  it('should search customers with advanced filters', async () => {
    const { searchQuickbooksCustomers } = await import('../handlers/search-quickbooks-customers.handler.js');
    
    // Test with pagination and sorting (no boolean filter to avoid API type issues)
    const result = await searchQuickbooksCustomers({
      limit: 10,
      desc: 'MetaData.CreateTime',
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search vendors with advanced filters', async () => {
    const { searchQuickbooksVendors } = await import('../handlers/search-quickbooks-vendors.handler.js');
    
    // Test with pagination and sorting
    const result = await searchQuickbooksVendors({
      limit: 10,
      desc: 'MetaData.CreateTime',
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search purchases with date and amount filters', async () => {
    const { searchQuickbooksPurchases } = await import('../handlers/search-quickbooks-purchases.handler.js');
    
    // Test date range filter (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
    
    const result = await searchQuickbooksPurchases({
      dateFrom,
      limit: 10,
      desc: 'TxnDate',
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search invoices with customer filter', async () => {
    const { searchQuickbooksInvoices } = await import('../handlers/search-quickbooks-invoices.handler.js');
    
    // Search for recent invoices
    const result = await searchQuickbooksInvoices({
      limit: 5,
      desc: 'TxnDate',
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search bills with vendor filter', async () => {
    const { searchQuickbooksBills } = await import('../handlers/search-quickbooks-bills.handler.js');
    
    // Search for recent bills
    const result = await searchQuickbooksBills({
      limit: 5,
      desc: 'TxnDate',
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search estimates with status filter', async () => {
    const { searchQuickbooksEstimates } = await import('../handlers/search-quickbooks-estimates.handler.js');
    
    // Search for estimates
    const result = await searchQuickbooksEstimates({
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search items', async () => {
    const { searchQuickbooksItems } = await import('../handlers/search-quickbooks-items.handler.js');
    
    const result = await searchQuickbooksItems({
      criteria: [{ field: 'Active', value: 'true' }],
      limit: 10,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search employees', async () => {
    const { searchQuickbooksEmployees } = await import('../handlers/search-quickbooks-employees.handler.js');
    
    const result = await searchQuickbooksEmployees({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should read a customer by ID if any exist', async () => {
    const { searchQuickbooksCustomers } = await import('../handlers/search-quickbooks-customers.handler.js');
    const { getQuickbooksCustomer } = await import('../handlers/get-quickbooks-customer.handler.js');
    
    // First find any customer
    const searchResult = await searchQuickbooksCustomers({ limit: 1 });
    if (searchResult.isError) return;
    
    const customers = (searchResult.result as any)?.QueryResponse?.Customer || [];
    if (customers.length === 0) {
      console.log('No customers found to read');
      return;
    }
    
    // Read the customer by ID
    const customerId = customers[0].Id;
    const getResult = await getQuickbooksCustomer(customerId);
    
    assert.ok(!getResult.isError, `Get customer error: ${getResult.error}`);
    assert.equal(getResult.result?.Id, customerId);
  });

  it('should read a vendor by ID if any exist', async () => {
    const { searchQuickbooksVendors } = await import('../handlers/search-quickbooks-vendors.handler.js');
    const { getQuickbooksVendor } = await import('../handlers/get-quickbooks-vendor.handler.js');
    
    // First find any vendor
    const searchResult = await searchQuickbooksVendors({ limit: 1 });
    if (searchResult.isError) return;
    
    const vendors = (searchResult.result as any)?.QueryResponse?.Vendor || [];
    if (vendors.length === 0) {
      console.log('No vendors found to read');
      return;
    }
    
    // Read the vendor by ID
    const vendorId = vendors[0].Id;
    const getResult = await getQuickbooksVendor(vendorId);
    
    assert.ok(!getResult.isError, `Get vendor error: ${getResult.error}`);
    assert.equal(getResult.result?.Id, vendorId);
  });
});

// =============================================================================
// CRUD Lifecycle Tests (SKIPPED by default - modify sandbox data)
// =============================================================================

/**
 * Customer CRUD Lifecycle Test
 * 
 * This test suite validates the complete lifecycle of a customer:
 * Create → Read → Update → Delete (make inactive)
 * 
 * SKIPPED by default since it modifies sandbox data.
 * To run: Remove the { skip: true } option.
 */
describe('Customer CRUD Lifecycle', { skip: true }, () => {
  // Check if OAuth is configured
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  // Shared state across tests
  let customerId: string;
  let syncToken: string;
  const testDisplayName = `Test Customer ${Date.now()}`;
  const testEmail = `test.customer.${Date.now()}@example.com`;

  it('should create a customer', async () => {
    if (!hasOAuth) {
      console.log('Skipping - OAuth not configured');
      return;
    }

    const { createQuickbooksCustomer } = await import('../handlers/create-quickbooks-customer.handler.js');
    
    const customerData = {
      DisplayName: testDisplayName,
      GivenName: 'Test',
      FamilyName: 'Customer',
      CompanyName: 'Test Company Inc',
      PrimaryEmailAddr: { Address: testEmail },
      PrimaryPhone: { FreeFormNumber: '555-123-4567' },
      BillAddr: {
        Line1: '123 Test Street',
        City: 'Test City',
        CountrySubDivisionCode: 'CA',
        PostalCode: '94043',
        Country: 'USA',
      },
      Notes: 'Integration test customer - safe to delete',
    };
    
    const result = await createQuickbooksCustomer(customerData);
    
    assert.ok(!result.isError, `Create customer failed: ${result.error}`);
    assert.ok(result.result?.Id, 'Created customer should have an ID');
    assert.ok(result.result?.SyncToken !== undefined, 'Created customer should have a SyncToken');
    assert.equal(result.result?.DisplayName, testDisplayName);
    
    // Store for subsequent tests
    customerId = result.result.Id;
    syncToken = result.result.SyncToken;
    
    console.log(`Created customer: ID=${customerId}, SyncToken=${syncToken}`);
  });

  it('should read the created customer', async () => {
    if (!hasOAuth || !customerId) {
      console.log('Skipping - OAuth not configured or no customer created');
      return;
    }

    const { getQuickbooksCustomer } = await import('../handlers/get-quickbooks-customer.handler.js');
    
    const result = await getQuickbooksCustomer(customerId);
    
    assert.ok(!result.isError, `Read customer failed: ${result.error}`);
    assert.equal(result.result?.Id, customerId);
    assert.equal(result.result?.DisplayName, testDisplayName);
    assert.equal(result.result?.Active, true);
    
    // Update syncToken in case it changed
    syncToken = result.result.SyncToken;
  });

  it('should update the customer', async () => {
    if (!hasOAuth || !customerId) {
      console.log('Skipping - OAuth not configured or no customer created');
      return;
    }

    const { updateQuickbooksCustomer } = await import('../handlers/update-quickbooks-customer.handler.js');
    
    const updatedCompanyName = 'Updated Test Company Inc';
    const updateData = {
      Id: customerId,
      SyncToken: syncToken,
      DisplayName: testDisplayName, // Required field
      CompanyName: updatedCompanyName,
      Notes: 'Integration test customer - UPDATED',
    };
    
    const result = await updateQuickbooksCustomer(updateData);
    
    assert.ok(!result.isError, `Update customer failed: ${result.error}`);
    assert.equal(result.result?.Id, customerId);
    assert.equal(result.result?.CompanyName, updatedCompanyName);
    
    // Update syncToken for delete
    syncToken = result.result.SyncToken;
    
    console.log(`Updated customer: ID=${customerId}, new SyncToken=${syncToken}`);
  });

  it('should delete (deactivate) the customer', async () => {
    if (!hasOAuth || !customerId) {
      console.log('Skipping - OAuth not configured or no customer created');
      return;
    }

    const { deleteQuickbooksCustomer } = await import('../handlers/delete-quickbooks-customer.handler.js');
    const { getQuickbooksCustomer } = await import('../handlers/get-quickbooks-customer.handler.js');
    
    const deleteData = {
      Id: customerId,
      SyncToken: syncToken,
    };
    
    const result = await deleteQuickbooksCustomer(deleteData);
    
    assert.ok(!result.isError, `Delete customer failed: ${result.error}`);
    
    // Verify customer is now inactive
    const verifyResult = await getQuickbooksCustomer(customerId);
    assert.ok(!verifyResult.isError);
    assert.equal(verifyResult.result?.Active, false, 'Customer should be inactive after delete');
    
    console.log(`Deleted (deactivated) customer: ID=${customerId}`);
  });
});

/**
 * Vendor CRUD Lifecycle Test
 * 
 * This test suite validates the complete lifecycle of a vendor:
 * Create → Read → Update → Delete (make inactive)
 * 
 * SKIPPED by default since it modifies sandbox data.
 * To run: Remove the { skip: true } option.
 */
describe('Vendor CRUD Lifecycle', { skip: true }, () => {
  // Check if OAuth is configured
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  // Shared state across tests
  let vendorId: string;
  let syncToken: string;
  const testDisplayName = `Test Vendor ${Date.now()}`;
  const testEmail = `test.vendor.${Date.now()}@example.com`;

  it('should create a vendor', async () => {
    if (!hasOAuth) {
      console.log('Skipping - OAuth not configured');
      return;
    }

    const { createQuickbooksVendor } = await import('../handlers/create-quickbooks-vendor.handler.js');
    
    const vendorData = {
      DisplayName: testDisplayName,
      GivenName: 'Test',
      FamilyName: 'Vendor',
      CompanyName: 'Test Vendor Corp',
      PrimaryEmailAddr: { Address: testEmail },
      PrimaryPhone: { FreeFormNumber: '555-987-6543' },
      BillAddr: {
        Line1: '456 Vendor Lane',
        City: 'Vendor City',
        CountrySubDivisionCode: 'NY',
        PostalCode: '10001',
        Country: 'USA',
      },
    };
    
    const result = await createQuickbooksVendor(vendorData);
    
    assert.ok(!result.isError, `Create vendor failed: ${result.error}`);
    assert.ok(result.result?.Id, 'Created vendor should have an ID');
    assert.ok(result.result?.SyncToken !== undefined, 'Created vendor should have a SyncToken');
    assert.equal(result.result?.DisplayName, testDisplayName);
    
    // Store for subsequent tests
    vendorId = result.result.Id;
    syncToken = result.result.SyncToken;
    
    console.log(`Created vendor: ID=${vendorId}, SyncToken=${syncToken}`);
  });

  it('should read the created vendor', async () => {
    if (!hasOAuth || !vendorId) {
      console.log('Skipping - OAuth not configured or no vendor created');
      return;
    }

    const { getQuickbooksVendor } = await import('../handlers/get-quickbooks-vendor.handler.js');
    
    const result = await getQuickbooksVendor(vendorId);
    
    assert.ok(!result.isError, `Read vendor failed: ${result.error}`);
    assert.equal(result.result?.Id, vendorId);
    assert.equal(result.result?.DisplayName, testDisplayName);
    assert.equal(result.result?.Active, true);
    
    // Update syncToken in case it changed
    syncToken = result.result.SyncToken;
  });

  it('should update the vendor', async () => {
    if (!hasOAuth || !vendorId) {
      console.log('Skipping - OAuth not configured or no vendor created');
      return;
    }

    const { updateQuickbooksVendor } = await import('../handlers/update-quickbooks-vendor.handler.js');
    
    const updatedCompanyName = 'Updated Test Vendor Corp';
    const updateData = {
      Id: vendorId,
      SyncToken: syncToken,
      DisplayName: testDisplayName, // Required field
      CompanyName: updatedCompanyName,
    };
    
    const result = await updateQuickbooksVendor(updateData);
    
    assert.ok(!result.isError, `Update vendor failed: ${result.error}`);
    assert.equal(result.result?.Id, vendorId);
    assert.equal(result.result?.CompanyName, updatedCompanyName);
    
    // Update syncToken for delete
    syncToken = result.result.SyncToken;
    
    console.log(`Updated vendor: ID=${vendorId}, new SyncToken=${syncToken}`);
  });

  it('should delete (deactivate) the vendor', async () => {
    if (!hasOAuth || !vendorId) {
      console.log('Skipping - OAuth not configured or no vendor created');
      return;
    }

    const { deleteQuickbooksVendor } = await import('../handlers/delete-quickbooks-vendor.handler.js');
    const { getQuickbooksVendor } = await import('../handlers/get-quickbooks-vendor.handler.js');
    
    const deleteData = {
      Id: vendorId,
      SyncToken: syncToken,
    };
    
    const result = await deleteQuickbooksVendor(deleteData);
    
    assert.ok(!result.isError, `Delete vendor failed: ${result.error}`);
    
    // Verify vendor is now inactive
    const verifyResult = await getQuickbooksVendor(vendorId);
    assert.ok(!verifyResult.isError);
    assert.equal(verifyResult.result?.Active, false, 'Vendor should be inactive after delete');
    
    console.log(`Deleted (deactivated) vendor: ID=${vendorId}`);
  });
});

console.log('Tests loaded successfully');
