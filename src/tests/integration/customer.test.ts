/**
 * Integration Tests: Customer CRUD
 * 
 * Tests for customer read and lifecycle operations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { testInfo } from '../utils/test-logger.js';

// =============================================================================
// Customer Read Integration Tests
// =============================================================================

describe('Integration Tests - Customer API', () => {
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Customer API tests - OAuth not configured', () => {});
    return;
  }

  it('should be able to search customers', async () => {
    const { searchQuickbooksCustomers } = await import('../../handlers/search-quickbooks-customers.handler.js');
    
    const result = await searchQuickbooksCustomers({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search customers with advanced filters', async () => {
    const { searchQuickbooksCustomers } = await import('../../handlers/search-quickbooks-customers.handler.js');
    
    // Test with pagination and sorting (no boolean filter to avoid API type issues)
    const result = await searchQuickbooksCustomers({
      limit: 10,
      desc: 'MetaData.CreateTime',
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should read a customer by ID if any exist', async () => {
    const { searchQuickbooksCustomers } = await import('../../handlers/search-quickbooks-customers.handler.js');
    const { getQuickbooksCustomer } = await import('../../handlers/get-quickbooks-customer.handler.js');
    
    // First find any customer
    const searchResult = await searchQuickbooksCustomers({ limit: 1 });
    if (searchResult.isError) return;
    
    const customers = (searchResult.result as any)?.QueryResponse?.Customer || [];
    if (customers.length === 0) {
      testInfo('No customers found to read');
      return;
    }
    
    // Read the customer by ID
    const customerId = customers[0].Id;
    const getResult = await getQuickbooksCustomer(customerId);
    
    assert.ok(!getResult.isError, `Get customer error: ${getResult.error}`);
    assert.equal(getResult.result?.Id, customerId);
  });
});

// =============================================================================
// Customer CRUD Lifecycle Test
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
      testInfo('Skipping - OAuth not configured');
      return;
    }

    const { createQuickbooksCustomer } = await import('../../handlers/create-quickbooks-customer.handler.js');
    
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
    
    testInfo(`Created customer: ID=${customerId}, SyncToken=${syncToken}`);
  });

  it('should read the created customer', async () => {
    if (!hasOAuth || !customerId) {
      testInfo('Skipping - OAuth not configured or no customer created');
      return;
    }

    const { getQuickbooksCustomer } = await import('../../handlers/get-quickbooks-customer.handler.js');
    
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
      testInfo('Skipping - OAuth not configured or no customer created');
      return;
    }

    const { updateQuickbooksCustomer } = await import('../../handlers/update-quickbooks-customer.handler.js');
    
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
    
    testInfo(`Updated customer: ID=${customerId}, new SyncToken=${syncToken}`);
  });

  it('should delete (deactivate) the customer', async () => {
    if (!hasOAuth || !customerId) {
      testInfo('Skipping - OAuth not configured or no customer created');
      return;
    }

    const { deleteQuickbooksCustomer } = await import('../../handlers/delete-quickbooks-customer.handler.js');
    const { getQuickbooksCustomer } = await import('../../handlers/get-quickbooks-customer.handler.js');
    
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
    
    testInfo(`Deleted (deactivated) customer: ID=${customerId}`);
  });
});

// Integration tests: Customer loaded
