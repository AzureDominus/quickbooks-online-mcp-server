/**
 * Integration Tests: Purchase Lifecycle and Search
 * 
 * Tests for purchase CRUD operations and advanced search filters.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// =============================================================================
// Integration Tests: Purchase API
// =============================================================================

describe('Integration Tests - Purchase API', () => {
  // Check if OAuth is configured
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Purchase API tests - OAuth not configured', () => {});
    return;
  }

  it('should be able to search purchases', async () => {
    const { searchQuickbooksPurchases } = await import('../../handlers/search-quickbooks-purchases.handler.js');
    
    const result = await searchQuickbooksPurchases({
      criteria: [],
      limit: 5,
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });

  it('should search purchases with date and amount filters', async () => {
    const { searchQuickbooksPurchases } = await import('../../handlers/search-quickbooks-purchases.handler.js');
    
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

  it('should complete full purchase lifecycle (create, read, delete)', async () => {
    const { createQuickbooksPurchase } = await import('../../handlers/create-quickbooks-purchase.handler.js');
    const { getQuickbooksPurchase } = await import('../../handlers/get-quickbooks-purchase.handler.js');
    const { deleteQuickbooksPurchase } = await import('../../handlers/delete-quickbooks-purchase.handler.js');
    const { searchQuickbooksAccounts } = await import('../../handlers/search-quickbooks-accounts.handler.js');
    
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
});

// =============================================================================
// Advanced Search Filters Integration Test
// =============================================================================

describe('Advanced Search Filters Integration Test', () => {
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Advanced Search tests - OAuth not configured', () => {});
    return;
  }

  it('should search purchases with dateFrom filter (last 30 days)', async () => {
    const { searchQuickbooksPurchases } = await import('../../handlers/search-quickbooks-purchases.handler.js');
    
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
    
    // Use proper criteria format that QBO understands
    const result = await searchQuickbooksPurchases({
      criteria: [
        { field: 'TxnDate', value: dateFrom, operator: '>=' },
      ],
      limit: 50,
      desc: 'TxnDate',
    });
    
    assert.ok(!result.isError, `Search failed: ${result.error}`);
    
    const purchases = (result.result as any)?.QueryResponse?.Purchase || [];
    console.log(`Found ${purchases.length} purchases with TxnDate >= ${dateFrom}`);
    
    // Verify we can retrieve purchases (the API call works)
    assert.ok(Array.isArray(purchases), 'Should return an array of purchases');
    
    // If we got results, verify they have expected properties
    if (purchases.length > 0) {
      assert.ok(purchases[0].Id, 'Purchases should have Id');
      assert.ok(purchases[0].TxnDate !== undefined, 'Purchases should have TxnDate');
    }
  });

  it('should search purchases with amount filter', async () => {
    const { searchQuickbooksPurchases } = await import('../../handlers/search-quickbooks-purchases.handler.js');
    
    const minAmount = 10;
    const maxAmount = 10000;  // Larger range for more flexibility
    
    // Use proper criteria format
    const result = await searchQuickbooksPurchases({
      criteria: [
        { field: 'TotalAmt', value: String(minAmount), operator: '>=' },
        { field: 'TotalAmt', value: String(maxAmount), operator: '<=' },
      ],
      limit: 50,
    });
    
    assert.ok(!result.isError, `Search failed: ${result.error}`);
    
    const purchases = (result.result as any)?.QueryResponse?.Purchase || [];
    console.log(`Found ${purchases.length} purchases with amount criteria`);
    
    // Verify the API call succeeded and returns expected structure
    assert.ok(Array.isArray(purchases), 'Should return an array of purchases');
    
    // If we got results, verify they have expected properties
    if (purchases.length > 0) {
      assert.ok(purchases[0].Id, 'Purchases should have Id');
      assert.ok(purchases[0].TotalAmt !== undefined, 'Purchases should have TotalAmt');
    }
  });

  it('should search invoices with customer filter', async () => {
    const { searchQuickbooksInvoices } = await import('../../handlers/search-quickbooks-invoices.handler.js');
    const { searchQuickbooksCustomers } = await import('../../handlers/search-quickbooks-customers.handler.js');
    
    // Get a customer to filter by
    const customerResult = await searchQuickbooksCustomers({ limit: 1 });
    if (customerResult.isError) {
      console.log('Could not fetch customers - skipping invoice filter test');
      return;
    }
    
    const customers = (customerResult.result as any)?.QueryResponse?.Customer || [];
    if (customers.length === 0) {
      console.log('No customers found - skipping invoice filter test');
      return;
    }
    
    const customerId = customers[0].Id;
    
    // Search invoices with customer filter using proper criteria format
    const result = await searchQuickbooksInvoices({
      criteria: [
        { field: 'CustomerRef', value: customerId },
      ],
      limit: 20,
    });
    
    assert.ok(!result.isError, `Invoice search failed: ${result.error}`);
    
    const invoices = (result.result as any)?.QueryResponse?.Invoice || [];
    console.log(`Found ${invoices.length} invoices for customer ${customerId}`);
    
    // Verify the API call succeeded
    assert.ok(Array.isArray(invoices), 'Should return an array of invoices');
    
    // If we got results, verify they have expected properties
    if (invoices.length > 0) {
      assert.ok(invoices[0].Id, 'Invoices should have Id');
      assert.ok(invoices[0].CustomerRef, 'Invoices should have CustomerRef');
    }
  });
});

console.log('Integration tests: Purchase loaded successfully');
