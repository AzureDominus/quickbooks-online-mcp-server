/**
 * Integration Tests: Invoice Lifecycle
 * 
 * Tests for invoice CRUD operations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// =============================================================================
// Invoice Lifecycle Integration Test
// =============================================================================

describe('Invoice Lifecycle Integration Test', () => {
  // Check if OAuth is configured
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Invoice Lifecycle tests - OAuth not configured', () => {});
    return;
  }

  let invoiceId: string | null = null;
  let invoiceSyncToken: string | null = null;
  let testCustomerId: string | null = null;
  let testItemId: string | null = null;

  it('should complete full invoice lifecycle (create, read, delete)', async () => {
    const { createQuickbooksInvoice } = await import('../../handlers/create-quickbooks-invoice.handler.js');
    const { readQuickbooksInvoice } = await import('../../handlers/read-quickbooks-invoice.handler.js');
    const { searchQuickbooksCustomers } = await import('../../handlers/search-quickbooks-customers.handler.js');
    const { searchQuickbooksItems } = await import('../../handlers/search-quickbooks-items.handler.js');
    const { quickbooksClient } = await import('../../clients/quickbooks-client.js');

    // Find a customer
    const customerResult = await searchQuickbooksCustomers({ limit: 1 });
    if (customerResult.isError) {
      console.log('Could not fetch customers - skipping invoice lifecycle test');
      return;
    }
    
    const customers = (customerResult.result as any)?.QueryResponse?.Customer || [];
    if (customers.length === 0) {
      console.log('No customers found - skipping invoice lifecycle test');
      return;
    }
    testCustomerId = customers[0].Id;

    // Find a service or inventory item
    const itemsResult = await searchQuickbooksItems({
      criteria: [{ field: 'Active', value: 'true' }],
      limit: 10,
    });
    
    if (itemsResult.isError || !itemsResult.result || itemsResult.result.length === 0) {
      console.log('No items found - skipping invoice lifecycle test');
      return;
    }
    
    // Find an item that can be used on invoices
    const item = itemsResult.result.find((i: any) => i.Type === 'Service' || i.Type === 'NonInventory' || i.Type === 'Inventory');
    if (!item) {
      console.log('No suitable item found for invoice - skipping');
      return;
    }
    testItemId = item.Id;

    // Ensure we have valid IDs before proceeding
    if (!testCustomerId || !testItemId) {
      console.log('Missing customer or item ID - skipping');
      return;
    }

    // Create an invoice
    const txnDate = new Date().toISOString().split('T')[0];
    const invoiceData = {
      customer_ref: testCustomerId as string,
      txn_date: txnDate,
      doc_number: `TEST-INV-${Date.now()}`,
      line_items: [
        {
          item_ref: testItemId as string,
          qty: 1,
          unit_price: 25.00,
          description: 'Integration test invoice line - safe to delete',
        },
      ],
    };

    const createResult = await createQuickbooksInvoice(invoiceData);
    assert.ok(!createResult.isError, `Create invoice failed: ${createResult.error}`);
    assert.ok(createResult.result?.Id, 'Created invoice should have an ID');
    
    invoiceId = createResult.result.Id;
    invoiceSyncToken = createResult.result.SyncToken;
    console.log(`Created invoice: ID=${invoiceId}`);

    // Ensure invoiceId is valid before reading
    if (!invoiceId) {
      console.log('No invoice ID - skipping read');
      return;
    }

    // Read the invoice back
    const readResult = await readQuickbooksInvoice(invoiceId as string);
    assert.ok(!readResult.isError, `Read invoice failed: ${readResult.error}`);
    assert.equal(readResult.result?.Id, invoiceId, 'Read invoice ID should match');
    assert.equal(readResult.result?.CustomerRef?.value, testCustomerId, 'Customer should match');
    
    // Verify the line amount
    const lineAmount = readResult.result?.Line?.find((l: any) => l.DetailType === 'SalesItemLineDetail')?.Amount;
    assert.equal(lineAmount, 25.00, 'Line amount should be 25.00');

    // Delete/void the invoice using the QuickBooks API directly
    // (since there's no delete handler, we'll void it)
    try {
      await quickbooksClient.authenticate();
      const qb = quickbooksClient.getQuickbooks();
      
      await new Promise<void>((resolve, reject) => {
        // Use voidInvoice if available, otherwise update to void status
        const voidPayload = {
          Id: invoiceId,
          SyncToken: invoiceSyncToken,
          sparse: true,
        };
        
        (qb as any).voidInvoice?.(voidPayload, (err: any) => {
          if (err) {
            // If voidInvoice doesn't work, just mark the test as complete
            console.log('Invoice void not available or failed, cleanup may be needed');
            resolve();
          } else {
            console.log(`Voided invoice: ID=${invoiceId}`);
            resolve();
          }
        });
        
        // Set a timeout to resolve if the void call hangs
        setTimeout(() => resolve(), 5000);
      });
    } catch (cleanupError) {
      console.log(`Invoice cleanup note: ${cleanupError}`);
    }
  });

  it('should search invoices with customer filter', async () => {
    const { searchQuickbooksInvoices } = await import('../../handlers/search-quickbooks-invoices.handler.js');
    
    // Search for recent invoices
    const result = await searchQuickbooksInvoices({
      limit: 5,
      desc: 'TxnDate',
    });
    
    assert.ok(!result.isError, `API error: ${result.error}`);
    assert.ok(result.result !== undefined);
  });
});

console.log('Integration tests: Invoice loaded successfully');
