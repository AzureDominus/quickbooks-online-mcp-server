/**
 * Unit Tests: Idempotency Service
 * 
 * Tests for the IdempotencyService and related helper functions.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';

import { IdempotencyService, checkIdempotency, storeIdempotency, getIdempotencyService } from '../../helpers/idempotency.js';

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

console.log('Unit tests: Idempotency loaded successfully');
