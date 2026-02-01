/**
 * Integration Tests: Vendor CRUD
 * 
 * Tests for vendor read and lifecycle operations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { testInfo } from '../utils/test-logger.js';

// =============================================================================
// Vendor Read Integration Tests
// =============================================================================

describe('Integration Tests - Vendor API', () => {
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Vendor API tests - OAuth not configured', () => {});
    return;
  }

  it('should be able to search vendors', async () => {
    const { searchQuickbooksVendors } = await import('../../handlers/search-quickbooks-vendors.handler.js');
    
    const result = await searchQuickbooksVendors({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search vendors with advanced filters', async () => {
    const { searchQuickbooksVendors } = await import('../../handlers/search-quickbooks-vendors.handler.js');
    
    // Test with pagination and sorting
    const result = await searchQuickbooksVendors({
      limit: 10,
      desc: 'MetaData.CreateTime',
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should read a vendor by ID if any exist', async () => {
    const { searchQuickbooksVendors } = await import('../../handlers/search-quickbooks-vendors.handler.js');
    const { getQuickbooksVendor } = await import('../../handlers/get-quickbooks-vendor.handler.js');
    
    // First find any vendor
    const searchResult = await searchQuickbooksVendors({ limit: 1 });
    if (searchResult.isError) return;
    
    const vendors = (searchResult.result as any)?.QueryResponse?.Vendor || [];
    if (vendors.length === 0) {
      testInfo('No vendors found to read');
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
// Vendor CRUD Lifecycle Test
// =============================================================================

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
      testInfo('Skipping - OAuth not configured');
      return;
    }

    const { createQuickbooksVendor } = await import('../../handlers/create-quickbooks-vendor.handler.js');
    
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
    
    testInfo(`Created vendor: ID=${vendorId}, SyncToken=${syncToken}`);
  });

  it('should read the created vendor', async () => {
    if (!hasOAuth || !vendorId) {
      testInfo('Skipping - OAuth not configured or no vendor created');
      return;
    }

    const { getQuickbooksVendor } = await import('../../handlers/get-quickbooks-vendor.handler.js');
    
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
      testInfo('Skipping - OAuth not configured or no vendor created');
      return;
    }

    const { updateQuickbooksVendor } = await import('../../handlers/update-quickbooks-vendor.handler.js');
    
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
    
    testInfo(`Updated vendor: ID=${vendorId}, new SyncToken=${syncToken}`);
  });

  it('should delete (deactivate) the vendor', async () => {
    if (!hasOAuth || !vendorId) {
      testInfo('Skipping - OAuth not configured or no vendor created');
      return;
    }

    const { deleteQuickbooksVendor } = await import('../../handlers/delete-quickbooks-vendor.handler.js');
    const { getQuickbooksVendor } = await import('../../handlers/get-quickbooks-vendor.handler.js');
    
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
    
    testInfo(`Deleted (deactivated) vendor: ID=${vendorId}`);
  });
});

// Integration tests: Vendor loaded
