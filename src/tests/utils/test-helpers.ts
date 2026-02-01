/**
 * Test helper utilities for QuickBooks MCP Server tests
 * 
 * This module provides common utilities for integration and unit tests,
 * including OAuth checking, test client creation, and cleanup helpers.
 */

import { quickbooksClient } from '../../clients/quickbooks-client.js';
import { searchQuickbooksAccounts } from '../../handlers/search-quickbooks-accounts.handler.js';
import { createQuickbooksPurchase } from '../../handlers/create-quickbooks-purchase.handler.js';
import { deleteQuickbooksPurchase } from '../../handlers/delete-quickbooks-purchase.handler.js';
import { deleteQuickbooksVendor } from '../../handlers/delete-quickbooks-vendor.handler.js';
import { deleteQuickbooksCustomer } from '../../handlers/delete-quickbooks-customer.handler.js';
import { deleteQuickbooksBill } from '../../handlers/delete-quickbooks-bill.handler.js';
import { deleteQuickbooksEstimate } from '../../handlers/delete-quickbooks-estimate.handler.js';

// =============================================================================
// OAuth Helpers
// =============================================================================

/**
 * Check if OAuth credentials are configured
 */
export function hasOAuthCredentials(): boolean {
  return !!(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

/**
 * Skip test with message if no OAuth
 * @returns true if OAuth is not configured (test should be skipped)
 */
export function skipIfNoOAuth(message: string = 'OAuth not configured'): boolean {
  if (!hasOAuthCredentials()) {
    console.log(`⏭️  ${message}`);
    return true;
  }
  return false;
}

/**
 * Get QuickBooks client, returns null if not available
 */
export async function getTestClient(): Promise<typeof quickbooksClient | null> {
  try {
    if (!hasOAuthCredentials()) {
      return null;
    }
    await quickbooksClient.authenticate();
    return quickbooksClient;
  } catch {
    return null;
  }
}

// =============================================================================
// Account Helpers
// =============================================================================

interface TestAccounts {
  bankAccount: any;
  expenseAccount: any;
  incomeAccount?: any;
}

/**
 * Fetch test accounts (bank and expense) needed for most tests
 * @returns Object with bankAccount and expenseAccount, or null if not found
 */
export async function getTestAccounts(): Promise<TestAccounts | null> {
  try {
    const accountsResult = await searchQuickbooksAccounts({
      criteria: [{ field: 'Active', value: 'true' }],
      limit: 100,
    });

    if (accountsResult.isError) {
      console.log('❌ Could not fetch accounts:', accountsResult.error);
      return null;
    }

    const accounts = (accountsResult.result as any)?.QueryResponse?.Account || [];
    
    const bankAccount = accounts.find((a: any) => 
      a.AccountType === 'Bank' || a.AccountType === 'Credit Card'
    );
    const expenseAccount = accounts.find((a: any) => a.AccountType === 'Expense');
    const incomeAccount = accounts.find((a: any) => a.AccountType === 'Income');

    if (!bankAccount || !expenseAccount) {
      console.log('❌ Required accounts not found (need Bank/Credit Card and Expense accounts)');
      return null;
    }

    return { bankAccount, expenseAccount, incomeAccount };
  } catch (error) {
    console.log('❌ Error fetching test accounts:', error);
    return null;
  }
}

// =============================================================================
// Test Entity Creation
// =============================================================================

/**
 * Create a test purchase for testing
 * @param bankAccountId The bank/credit card account ID for payment
 * @param expenseAccountId The expense account ID for the line item
 * @param options Additional options for the purchase
 */
export async function createTestPurchase(
  bankAccountId: string, 
  expenseAccountId: string,
  options: {
    amount?: number;
    description?: string;
    vendorId?: string;
    paymentType?: 'Cash' | 'Check' | 'CreditCard';
  } = {}
): Promise<any> {
  const { 
    amount = 100, 
    description = 'Test purchase', 
    vendorId,
    paymentType = 'Cash'
  } = options;

  const purchaseData: any = {
    PaymentType: paymentType,
    AccountRef: { value: bankAccountId },
    Line: [
      {
        Amount: amount,
        DetailType: 'AccountBasedExpenseLineDetail',
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: expenseAccountId },
        },
        Description: description,
      },
    ],
    TxnDate: new Date().toISOString().split('T')[0],
    PrivateNote: generateTestId('purchase'),
  };

  if (vendorId) {
    purchaseData.EntityRef = { value: vendorId, type: 'Vendor' };
  }

  const result = await createQuickbooksPurchase(purchaseData);
  
  if (result.isError) {
    throw new Error(`Failed to create test purchase: ${result.error}`);
  }

  return result.result;
}

// =============================================================================
// Test ID Generation
// =============================================================================

/**
 * Generate unique test identifiers
 * @param prefix Optional prefix for the ID
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique display name for test entities
 * @param entityType Type of entity (e.g., 'Vendor', 'Customer')
 */
export function generateTestDisplayName(entityType: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `Test ${entityType} ${timestamp}${random}`;
}

/**
 * Generate a unique email for test entities
 */
export function generateTestEmail(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `test-${timestamp}${random}@example.com`;
}

// =============================================================================
// Cleanup Helpers
// =============================================================================

type SupportedEntityType = 'Purchase' | 'Vendor' | 'Customer' | 'Bill' | 'Estimate';

/**
 * Cleanup helper - delete test entities
 * @param entityType The type of entity to delete
 * @param entityId The ID of the entity
 * @param syncToken The sync token for the entity
 */
export async function cleanupTestData(
  entityType: SupportedEntityType, 
  entityId: string, 
  syncToken: string
): Promise<void> {
  try {
    switch (entityType) {
      case 'Purchase':
        await deleteQuickbooksPurchase({ Id: entityId, SyncToken: syncToken });
        break;
      case 'Vendor':
        await deleteQuickbooksVendor({ Id: entityId, SyncToken: syncToken });
        break;
      case 'Customer':
        await deleteQuickbooksCustomer({ Id: entityId, SyncToken: syncToken });
        break;
      case 'Bill':
        await deleteQuickbooksBill({ Id: entityId, SyncToken: syncToken });
        break;
      case 'Estimate':
        await deleteQuickbooksEstimate({ Id: entityId, SyncToken: syncToken });
        break;
      default:
        console.log(`⚠️  Cleanup not implemented for entity type: ${entityType}`);
    }
  } catch (error) {
    console.log(`⚠️  Failed to cleanup ${entityType} ${entityId}:`, error);
  }
}

/**
 * Cleanup multiple test entities
 * @param entities Array of entities to clean up
 */
export async function cleanupTestEntities(
  entities: Array<{ type: SupportedEntityType; id: string; syncToken: string }>
): Promise<void> {
  for (const entity of entities) {
    await cleanupTestData(entity.type, entity.id, entity.syncToken);
  }
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that an API result is successful
 */
export function assertSuccess<T>(result: { isError: boolean; error: string | null; result: T | null }): asserts result is { isError: false; error: null; result: T } {
  if (result.isError) {
    throw new Error(`Expected success but got error: ${result.error}`);
  }
}

/**
 * Assert that an API result is an error
 */
export function assertError<T>(result: { isError: boolean; error: string | null; result: T | null }): asserts result is { isError: true; error: string; result: null } {
  if (!result.isError) {
    throw new Error(`Expected error but got success`);
  }
}

// =============================================================================
// Wait/Retry Helpers
// =============================================================================

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxAttempts) {
        console.log(`⏳ Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await wait(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelay);
      }
    }
  }

  throw lastError;
}
