/**
 * Integration Tests: Attachment Upload/Download
 * 
 * Tests for attachment operations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { testInfo } from '../utils/test-logger.js';

// =============================================================================
// Attachment Upload/Download Integration Test
// =============================================================================

describe('Attachment Upload/Download Integration Test', () => {
  const hasOAuth = process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET;
  
  if (!hasOAuth) {
    it.skip('Skipping Attachment tests - OAuth not configured', () => {});
    return;
  }

  // State shared across tests
  let testPurchaseId: string | null = null;
  let testPurchaseSyncToken: string | null = null;
  let testAttachmentId: string | null = null;
  let testFilePath: string | null = null;
  let downloadedFilePath: string | null = null;

  // Create a test file before tests
  const testFileName = `test-receipt-${Date.now()}.txt`;
  const testFileContent = `Test attachment file created at ${new Date().toISOString()}\nThis is a test file for QuickBooks attachment integration testing.`;

  it('should create a test purchase for attachment testing', async () => {
    const { createQuickbooksPurchase } = await import('../../handlers/create-quickbooks-purchase.handler.js');
    const { searchQuickbooksAccounts } = await import('../../handlers/search-quickbooks-accounts.handler.js');

    // Get accounts for the test
    const accountsResult = await searchQuickbooksAccounts({
      criteria: [{ field: 'Active', value: 'true' }],
      limit: 100,
    });
    
    if (accountsResult.isError) {
      testInfo('Could not fetch accounts - skipping attachment test');
      return;
    }
    
    const accounts = (accountsResult.result as any)?.QueryResponse?.Account || [];
    const bankAccount = accounts.find((a: any) => a.AccountType === 'Bank' || a.AccountType === 'Credit Card');
    const expenseAccount = accounts.find((a: any) => a.AccountType === 'Expense');
    
    if (!bankAccount || !expenseAccount) {
      testInfo('Required accounts not found - skipping attachment test');
      return;
    }

    const purchaseData = {
      TxnDate: new Date().toISOString().split('T')[0],
      PaymentType: bankAccount.AccountType === 'Credit Card' ? 'CreditCard' : 'Check',
      AccountRef: { value: bankAccount.Id },
      PrivateNote: 'Attachment integration test purchase - safe to delete',
      Line: [
        {
          Amount: 10.00,
          DetailType: 'AccountBasedExpenseLineDetail',
          Description: 'Attachment test expense',
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: expenseAccount.Id },
          },
        },
      ],
    };

    const result = await createQuickbooksPurchase(purchaseData);
    assert.ok(!result.isError, `Create purchase failed: ${result.error}`);
    assert.ok(result.result?.Id, 'Created purchase should have an ID');
    
    testPurchaseId = result.result.Id;
    testPurchaseSyncToken = result.result.SyncToken;
    testInfo(`Created test purchase for attachment: ID=${testPurchaseId}`);
  });

  it('should upload an attachment to the test purchase', async () => {
    if (!testPurchaseId) {
      testInfo('No test purchase - skipping upload test');
      return;
    }

    const { uploadAttachment } = await import('../../handlers/upload-attachment.handler.js');
    
    // Create a test file
    testFilePath = path.join(os.tmpdir(), testFileName);
    fs.writeFileSync(testFilePath, testFileContent);
    testInfo(`Created test file: ${testFilePath}`);

    // Upload the attachment
    const result = await uploadAttachment({
      filePath: testFilePath,
      entityType: 'Purchase',
      entityId: testPurchaseId,
    });

    assert.ok(!result.isError, `Upload attachment failed: ${result.error}`);
    assert.ok(result.result?.id, 'Upload should return an attachment ID');
    assert.equal(result.result?.entityType, 'Purchase', 'Entity type should match');
    assert.equal(result.result?.entityId, testPurchaseId, 'Entity ID should match');

    testAttachmentId = result.result.id;
    testInfo(`Uploaded attachment: ID=${testAttachmentId}, fileName=${result.result.fileName}`);
  });

  it('should get attachments for the test purchase', async () => {
    if (!testPurchaseId) {
      testInfo('No test purchase - skipping get attachments test');
      return;
    }

    const { getAttachments } = await import('../../handlers/upload-attachment.handler.js');

    const result = await getAttachments('Purchase', testPurchaseId);

    assert.ok(!result.isError, `Get attachments failed: ${result.error}`);
    assert.ok(Array.isArray(result.result), 'Result should be an array');
    
    // If we uploaded an attachment, it should be in the list
    if (testAttachmentId) {
      const found = result.result?.find((a: any) => a.id === testAttachmentId);
      assert.ok(found, `Should find the uploaded attachment with ID ${testAttachmentId}`);
      testInfo(`Found ${result.result?.length} attachments for purchase`);
    } else {
      testInfo(`Found ${result.result?.length || 0} attachments for purchase`);
    }
  });

  it('should download the uploaded attachment', async () => {
    if (!testAttachmentId) {
      testInfo('No test attachment - skipping download test');
      return;
    }

    const { downloadAttachment } = await import('../../handlers/upload-attachment.handler.js');

    // Download to temp directory
    downloadedFilePath = path.join(os.tmpdir(), `downloaded-${testFileName}`);

    const result = await downloadAttachment(testAttachmentId, downloadedFilePath);

    assert.ok(!result.isError, `Download attachment failed: ${result.error}`);
    assert.ok(result.result?.filePath, 'Download should return file path');
    assert.ok(result.result?.size && result.result.size > 0, 'Downloaded file should have size > 0');
    
    // Verify file exists
    assert.ok(fs.existsSync(result.result.filePath), 'Downloaded file should exist');
    
    // Verify content matches (if it's a text file)
    const downloadedContent = fs.readFileSync(result.result.filePath, 'utf-8');
    assert.equal(downloadedContent, testFileContent, 'Downloaded content should match original');
    
    testInfo(`Downloaded attachment to: ${result.result.filePath}, size=${result.result.size}`);
  });

  it('should clean up: delete the test purchase', async () => {
    // Clean up test files
    if (testFilePath && fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      testInfo(`Deleted test file: ${testFilePath}`);
    }
    
    if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
      fs.unlinkSync(downloadedFilePath);
      testInfo(`Deleted downloaded file: ${downloadedFilePath}`);
    }

    if (!testPurchaseId || !testPurchaseSyncToken) {
      testInfo('No test purchase to clean up');
      return;
    }

    const { deleteQuickbooksPurchase } = await import('../../handlers/delete-quickbooks-purchase.handler.js');

    const result = await deleteQuickbooksPurchase({
      Id: testPurchaseId,
      SyncToken: testPurchaseSyncToken,
    });

    assert.ok(!result.isError, `Delete purchase failed: ${result.error}`);
    testInfo(`Deleted test purchase: ID=${testPurchaseId}`);
  });
});

// Integration tests: Attachment loaded
