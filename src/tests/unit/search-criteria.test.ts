/**
 * Unit Tests: Search Criteria Builder
 *
 * Tests for buildQuickbooksSearchCriteria, isCountQuery, and extractQueryResult.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQuickbooksSearchCriteria,
  isCountQuery,
  extractQueryResult,
} from '../../helpers/build-quickbooks-search-criteria.js';

// =============================================================================
// Unit Tests: buildQuickbooksSearchCriteria
// =============================================================================

describe('buildQuickbooksSearchCriteria', () => {
  describe('basic behavior', () => {
    it('should return empty object for empty input', () => {
      const result = buildQuickbooksSearchCriteria({});
      assert.deepEqual(result, {});
    });

    it('should pass through array input unchanged', () => {
      const input = [{ field: 'Name', value: 'Test' }];
      const result = buildQuickbooksSearchCriteria(input);
      assert.deepEqual(result, input);
    });

    it('should pass through simple object input unchanged', () => {
      const input = { Name: 'Test', Active: true };
      const result = buildQuickbooksSearchCriteria(input);
      assert.deepEqual(result, input);
    });
  });

  describe('advanced options', () => {
    it('should convert filters to criteria array', () => {
      const input = {
        filters: [{ field: 'Name', value: 'Test', operator: '=' }],
      };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      assert.ok(Array.isArray(result));
      assert.ok(result.some((c) => c.field === 'Name' && c.value === 'Test'));
    });

    it('should add asc sorting', () => {
      const input = { asc: 'Name' };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      assert.ok(result.some((c) => c.field === 'asc' && c.value === 'Name'));
    });

    it('should add desc sorting', () => {
      const input = { desc: 'TxnDate' };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      assert.ok(result.some((c) => c.field === 'desc' && c.value === 'TxnDate'));
    });

    it('should add limit', () => {
      const input = { limit: 50 };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      assert.ok(result.some((c) => c.field === 'limit' && c.value === 50));
    });

    it('should add offset', () => {
      const input = { offset: 100 };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      assert.ok(result.some((c) => c.field === 'offset' && c.value === 100));
    });

    it('should add fetchAll', () => {
      const input = { fetchAll: true };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      assert.ok(result.some((c) => c.field === 'fetchAll' && c.value === true));
    });
  });

  describe('count mode', () => {
    it('should add count as object with count:true property, not field:count', () => {
      const input = { count: true };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      assert.ok(Array.isArray(result));
      // Should have {count: true} NOT {field: 'count', value: true}
      assert.ok(
        result.some((c) => c.count === true),
        'Expected {count: true} in criteria'
      );
      assert.ok(
        !result.some((c) => c.field === 'count'),
        'Should NOT have {field: "count"} in criteria'
      );
    });

    it('should put count at index 0 to avoid node-quickbooks splice bug', () => {
      const input = {
        count: true,
        filters: [{ field: 'Name', value: 'Test' }],
        limit: 100,
      };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      assert.ok(Array.isArray(result));
      assert.ok(result.length >= 2);
      // Count should be at the beginning
      assert.equal(result[0].count, true);
    });

    it('should produce criteria shape that triggers count mode in node-quickbooks', () => {
      // node-quickbooks looks for obj[p].toLowerCase() === 'count' when iterating keys
      // This means it looks for a property named 'count' (case-insensitive) with truthy value
      const input = { count: true };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      // Simulate what node-quickbooks does
      let countModeTriggered = false;
      for (const obj of result) {
        for (const p in obj) {
          if (obj[p] && p.toLowerCase() === 'count') {
            countModeTriggered = true;
          }
        }
      }

      assert.ok(countModeTriggered, 'Criteria should trigger count mode in node-quickbooks');
    });

    it('should NOT produce count = true SQL in query', () => {
      // The bug was that {field: 'count', value: true} gets turned into
      // "count = true" in the SQL WHERE clause, which is invalid
      const input = { count: true };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      // Check that no criteria has field: 'count'
      const hasFieldCount = result.some((c) => c.field === 'count');
      assert.ok(!hasFieldCount, 'Should not have {field: "count"} which causes SQL error');
    });

    it('should work with count and other criteria together', () => {
      const input = {
        count: true,
        filters: [
          { field: 'TxnDate', value: '2026-01-01', operator: '>=' },
          { field: 'TxnDate', value: '2026-12-31', operator: '<=' },
        ],
        limit: 100,
        desc: 'TxnDate',
      };
      const result = buildQuickbooksSearchCriteria(input) as Array<Record<string, any>>;

      assert.ok(Array.isArray(result));
      // Count at index 0
      assert.equal(result[0].count, true);
      // Other criteria should be present
      assert.ok(result.some((c) => c.field === 'TxnDate' && c.operator === '>='));
      assert.ok(result.some((c) => c.field === 'TxnDate' && c.operator === '<='));
      assert.ok(result.some((c) => c.field === 'limit' && c.value === 100));
      assert.ok(result.some((c) => c.field === 'desc' && c.value === 'TxnDate'));
    });
  });
});

// =============================================================================
// Unit Tests: isCountQuery
// =============================================================================

describe('isCountQuery', () => {
  it('should return false for empty object', () => {
    assert.equal(isCountQuery({}), false);
  });

  it('should return false for empty array', () => {
    assert.equal(isCountQuery([]), false);
  });

  it('should return true for object with count: true', () => {
    assert.equal(isCountQuery({ count: true }), true);
  });

  it('should return false for object with count: false', () => {
    assert.equal(isCountQuery({ count: false }), false);
  });

  it('should return true for array containing {count: true}', () => {
    assert.equal(isCountQuery([{ count: true }]), true);
  });

  it('should return true for array with count at any position', () => {
    assert.equal(
      isCountQuery([
        { field: 'Name', value: 'Test' },
        { count: true },
        { field: 'limit', value: 10 },
      ]),
      true
    );
  });

  it('should return false for array without count', () => {
    assert.equal(isCountQuery([{ field: 'Name', value: 'Test' }]), false);
  });

  it('should return false for array with field: count (wrong format)', () => {
    // This is the old buggy format - should NOT be detected as count query
    // because node-quickbooks won't recognize it as count mode either
    assert.equal(isCountQuery([{ field: 'count', value: true }]), false);
  });
});

// =============================================================================
// Unit Tests: extractQueryResult
// =============================================================================

describe('extractQueryResult', () => {
  describe('normal query mode', () => {
    it('should extract entity array from QueryResponse', () => {
      const queryResponse = {
        QueryResponse: {
          Invoice: [{ Id: '1' }, { Id: '2' }],
          startPosition: 1,
          maxResults: 2,
        },
      };

      const result = extractQueryResult(queryResponse, 'Invoice', false);

      assert.ok(Array.isArray(result));
      assert.equal(result.length, 2);
    });

    it('should return empty array if entity key is missing', () => {
      const queryResponse = {
        QueryResponse: {
          startPosition: 1,
          maxResults: 0,
        },
      };

      const result = extractQueryResult(queryResponse, 'Invoice', false);

      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('should return empty array if QueryResponse is missing', () => {
      const result = extractQueryResult({}, 'Invoice', false);

      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('should return empty array for null/undefined input', () => {
      assert.deepEqual(extractQueryResult(null, 'Invoice', false), []);
      assert.deepEqual(extractQueryResult(undefined, 'Invoice', false), []);
    });
  });

  describe('count query mode', () => {
    it('should extract totalCount as number', () => {
      const queryResponse = {
        QueryResponse: {
          totalCount: 42,
        },
      };

      const result = extractQueryResult(queryResponse, 'Invoice', true);

      assert.equal(typeof result, 'number');
      assert.equal(result, 42);
    });

    it('should return 0 if totalCount is missing', () => {
      const queryResponse = {
        QueryResponse: {},
      };

      const result = extractQueryResult(queryResponse, 'Invoice', true);

      assert.equal(result, 0);
    });

    it('should return 0 for null/undefined input in count mode', () => {
      assert.equal(extractQueryResult(null, 'Invoice', true), 0);
      assert.equal(extractQueryResult(undefined, 'Invoice', true), 0);
    });

    it('should return 0 if QueryResponse is missing in count mode', () => {
      const result = extractQueryResult({}, 'Invoice', true);

      assert.equal(result, 0);
    });
  });

  describe('entity key handling', () => {
    it('should work with Invoice entity', () => {
      const queryResponse = {
        QueryResponse: {
          Invoice: [{ Id: '1' }],
        },
      };

      const result = extractQueryResult(queryResponse, 'Invoice', false);
      assert.ok(Array.isArray(result));
      assert.equal((result as any[]).length, 1);
    });

    it('should work with Item entity', () => {
      const queryResponse = {
        QueryResponse: {
          Item: [{ Id: '1' }, { Id: '2' }, { Id: '3' }],
        },
      };

      const result = extractQueryResult(queryResponse, 'Item', false);
      assert.ok(Array.isArray(result));
      assert.equal((result as any[]).length, 3);
    });

    it('should work with Customer entity', () => {
      const queryResponse = {
        QueryResponse: {
          Customer: [{ Id: '1' }],
        },
      };

      const result = extractQueryResult(queryResponse, 'Customer', false);
      assert.ok(Array.isArray(result));
      assert.equal((result as any[]).length, 1);
    });

    it('should work with Vendor entity', () => {
      const queryResponse = {
        QueryResponse: {
          Vendor: [{ Id: '1' }, { Id: '2' }],
        },
      };

      const result = extractQueryResult(queryResponse, 'Vendor', false);
      assert.ok(Array.isArray(result));
      assert.equal((result as any[]).length, 2);
    });
  });
});
