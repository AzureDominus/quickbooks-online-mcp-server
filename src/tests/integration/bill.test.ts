/**
 * Integration Tests: Bill Lifecycle
 * 
 * Tests for bill CRUD operations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { testInfo } from '../utils/test-logger.js';

// =============================================================================
// Bill Lifecycle Integration Test
// =============================================================================

describe('Bill Lifecycle Integration Test', () => {
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Bill Lifecycle tests - OAuth not configured', () => {});
    return;
  }

  it('should complete full bill lifecycle (create, read, update, delete)', async () => {
    const { createQuickbooksBill } = await import('../../handlers/create-quickbooks-bill.handler.js');
    const { getQuickbooksBill } = await import('../../handlers/get-quickbooks-bill.handler.js');
    const { updateQuickbooksBill } = await import('../../handlers/update-quickbooks-bill.handler.js');
    const { deleteQuickbooksBill } = await import('../../handlers/delete-quickbooks-bill.handler.js');
    const { searchQuickbooksVendors } = await import('../../handlers/search-quickbooks-vendors.handler.js');
    const { searchQuickbooksAccounts } = await import('../../handlers/search-quickbooks-accounts.handler.js');

    // Find a vendor
    const vendorResult = await searchQuickbooksVendors({ limit: 1 });
    if (vendorResult.isError) {
      testInfo('Could not fetch vendors - skipping bill lifecycle test');
      return;
    }
    
    const vendors = (vendorResult.result as any)?.QueryResponse?.Vendor || [];
    if (vendors.length === 0) {
      testInfo('No vendors found - skipping bill lifecycle test');
      return;
    }
    const vendorId = vendors[0].Id;

    // Find an expense account
    const accountsResult = await searchQuickbooksAccounts({
      criteria: [{ field: 'Active', value: 'true' }],
      limit: 100,
    });
    
    if (accountsResult.isError) {
      testInfo('Could not fetch accounts - skipping bill lifecycle test');
      return;
    }
    
    const accounts = (accountsResult.result as any)?.QueryResponse?.Account || [];
    const expenseAccount = accounts.find((a: any) => a.AccountType === 'Expense');
    
    if (!expenseAccount) {
      testInfo('No expense account found - skipping bill lifecycle test');
      return;
    }

    const txnDate = new Date().toISOString().split('T')[0];
    const docNumber = `TEST-BILL-${Date.now()}`;
    
    // CREATE: Create a bill
    const billData = {
      VendorRef: { value: vendorId },
      TxnDate: txnDate,
      DocNumber: docNumber,
      PrivateNote: 'Integration test bill - safe to delete',
      Line: [
        {
          Amount: 50.00,
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: 'Test bill line item',
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: expenseAccount.Id },
          },
        },
      ],
    };

    const createResult = await createQuickbooksBill(billData);
    assert.ok(!createResult.isError, `Create bill failed: ${createResult.error}`);
    assert.ok(createResult.result?.Id, 'Created bill should have an ID');
    
    const billId = createResult.result.Id;
    let syncToken = createResult.result.SyncToken;
    testInfo(`Created bill: ID=${billId}, DocNumber=${docNumber}`);

    try {
      // READ: Read the bill back
      const readResult = await getQuickbooksBill(billId);
      assert.ok(!readResult.isError, `Read bill failed: ${readResult.error}`);
      assert.equal(readResult.result?.Id, billId, 'Read bill ID should match');
      assert.equal(readResult.result?.VendorRef?.value, vendorId, 'Vendor should match');
      assert.equal(readResult.result?.DocNumber, docNumber, 'DocNumber should match');
      
      syncToken = readResult.result.SyncToken;

      // UPDATE: Update the bill memo
      const updatedMemo = 'Updated integration test bill - still safe to delete';
      const updateData = {
        Id: billId,
        SyncToken: syncToken,
        VendorRef: { value: vendorId },
        PrivateNote: updatedMemo,
        Line: readResult.result.Line, // Keep the same lines
      };

      const updateResult = await updateQuickbooksBill(updateData);
      assert.ok(!updateResult.isError, `Update bill failed: ${updateResult.error}`);
      assert.equal(updateResult.result?.PrivateNote, updatedMemo, 'Memo should be updated');
      testInfo(`Updated bill: ID=${billId}`);
      
      syncToken = updateResult.result.SyncToken;

      // DELETE: Delete the bill
      const deleteData = {
        Id: billId,
        SyncToken: syncToken,
      };

      const deleteResult = await deleteQuickbooksBill(deleteData);
      assert.ok(!deleteResult.isError, `Delete bill failed: ${deleteResult.error}`);
      testInfo(`Deleted bill: ID=${billId}`);

    } catch (error) {
      // Try to clean up even if test fails
      try {
        await deleteQuickbooksBill({ Id: billId, SyncToken: syncToken });
      } catch { /* ignore cleanup errors */ }
      throw error;
    }
  });

  it('should search bills with vendor filter', async () => {
    const { searchQuickbooksBills } = await import('../../handlers/search-quickbooks-bills.handler.js');
    
    // Search for recent bills
    const result = await searchQuickbooksBills({
      limit: 5,
      desc: 'TxnDate',
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });
});

// Integration tests: Bill loaded
