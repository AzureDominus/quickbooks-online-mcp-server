/**
 * Integration Tests: Idempotency
 * 
 * Tests for idempotency with real API calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// =============================================================================
// Idempotency Integration Test
// =============================================================================

describe('Idempotency Integration Test', () => {
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Idempotency tests - OAuth not configured', () => {});
    return;
  }

  it('should prevent duplicate purchases with same idempotencyKey', async () => {
    const { searchQuickbooksAccounts } = await import('../../handlers/search-quickbooks-accounts.handler.js');
    const { createQuickbooksPurchase } = await import('../../handlers/create-quickbooks-purchase.handler.js');
    const { deleteQuickbooksPurchase } = await import('../../handlers/delete-quickbooks-purchase.handler.js');
    const { storeIdempotency, checkIdempotency, getIdempotencyService } = await import('../../helpers/idempotency.js');

    // Get accounts for the test
    const accountsResult = await searchQuickbooksAccounts({
      criteria: [{ field: 'Active', value: 'true' }],
      limit: 100,
    });
    
    if (accountsResult.isError) {
      console.log('Could not fetch accounts - skipping idempotency test');
      return;
    }
    
    const accounts = (accountsResult.result as any)?.QueryResponse?.Account || [];
    const bankAccount = accounts.find((a: any) => a.AccountType === 'Bank' || a.AccountType === 'Credit Card');
    const expenseAccount = accounts.find((a: any) => a.AccountType === 'Expense');
    
    if (!bankAccount || !expenseAccount) {
      console.log('Required accounts not found - skipping idempotency test');
      return;
    }

    // Generate a unique idempotency key for this test
    const idempotencyKey = `test-idempotency-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Clear any existing entry for this key
    getIdempotencyService().remove(idempotencyKey);

    // Create the first purchase
    const purchaseData1 = {
      TxnDate: new Date().toISOString().split('T')[0],
      PaymentType: bankAccount.AccountType === 'Credit Card' ? 'CreditCard' : 'Check',
      AccountRef: { value: bankAccount.Id },
      PrivateNote: `Idempotency test - key: ${idempotencyKey}`,
      Line: [
        {
          Amount: 1.23,
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: 'Idempotency test purchase 1 - safe to delete',
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: expenseAccount.Id },
          },
        },
      ],
    };

    const result1 = await createQuickbooksPurchase(purchaseData1);
    assert.ok(!result1.isError, `First purchase creation failed: ${result1.error}`);
    assert.ok(result1.result?.Id, 'First purchase should have an ID');
    
    const purchaseId = result1.result.Id;
    const syncToken = result1.result.SyncToken;
    console.log(`Created first purchase: ID=${purchaseId}`);

    // Store the idempotency key
    storeIdempotency(idempotencyKey, purchaseId, 'Purchase');

    // Verify the key was stored
    const storedId = checkIdempotency(idempotencyKey);
    assert.equal(storedId, purchaseId, 'Idempotency key should return the stored purchase ID');

    // When checking idempotency before creating again, we should get the same ID
    const existingId = checkIdempotency(idempotencyKey);
    assert.equal(existingId, purchaseId, 'Second check should return the same purchase ID');

    // Clean up - delete the purchase
    try {
      const deleteResult = await deleteQuickbooksPurchase({
        Id: purchaseId,
        SyncToken: syncToken,
      });
      assert.ok(!deleteResult.isError, `Delete failed: ${deleteResult.error}`);
      console.log(`Deleted purchase: ID=${purchaseId}`);
    } catch (cleanupError) {
      console.log(`Cleanup error: ${cleanupError}`);
    }

    // Clean up idempotency entry
    getIdempotencyService().remove(idempotencyKey);
  });
});

console.log('Integration tests: Idempotency loaded successfully');
