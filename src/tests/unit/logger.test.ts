/**
 * Unit Tests: Logger
 * 
 * Tests for the logger module.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { logger, logToolRequest, logToolResponse } from '../../helpers/logger.js';

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

// Unit tests: Logger loaded
