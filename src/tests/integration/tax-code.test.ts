/**
 * Integration Tests: Tax Code
 * 
 * Tests for tax code operations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// =============================================================================
// Tax Code Integration Tests
// =============================================================================

describe('Integration Tests - Tax Code API', () => {
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Tax Code API tests - OAuth not configured', () => {});
    return;
  }

  it('should be able to search tax codes', async () => {
    const { searchTaxCodes, getTaxCode } = await import('../../handlers/tax-code.handler.js');
    
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
});

// =============================================================================
// Additional Read-Only API Tests
// =============================================================================

describe('Integration Tests - Additional Read-Only APIs', () => {
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Read-Only API tests - OAuth not configured', () => {});
    return;
  }

  it('should be able to search accounts', async () => {
    const { searchQuickbooksAccounts } = await import('../../handlers/search-quickbooks-accounts.handler.js');
    
    const result = await searchQuickbooksAccounts({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
  });

  it('should search estimates with status filter', async () => {
    const { searchQuickbooksEstimates } = await import('../../handlers/search-quickbooks-estimates.handler.js');
    
    // Search for estimates
    const result = await searchQuickbooksEstimates({
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search items', async () => {
    const { searchQuickbooksItems } = await import('../../handlers/search-quickbooks-items.handler.js');
    
    const result = await searchQuickbooksItems({
      criteria: [{ field: 'Active', value: 'true' }],
      limit: 10,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search employees', async () => {
    const { searchQuickbooksEmployees } = await import('../../handlers/search-quickbooks-employees.handler.js');
    
    const result = await searchQuickbooksEmployees({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });
});

console.log('Integration tests: Tax Code loaded successfully');
