/**
 * Unit Tests: Transform Helpers
 * 
 * Tests for the transform helper functions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { 
  transformPurchaseToQBO, 
  transformPurchaseFromQBO, 
  buildPurchaseSearchCriteria,
  buildBillSearchCriteria,
  buildInvoiceSearchCriteria,
  buildEstimateSearchCriteria,
  validateReferences 
} from '../../helpers/transform.js';

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

// Unit tests: Transform loaded
