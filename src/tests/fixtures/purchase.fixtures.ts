/**
 * Test fixtures for Purchase entities
 * 
 * These fixtures provide standard test data for purchase-related tests.
 * Account IDs should be replaced with actual IDs from the test environment.
 */

// =============================================================================
// Basic Purchase Fixtures
// =============================================================================

/**
 * Valid cash purchase input
 */
export const validPurchaseInput = {
  txnDate: '2026-01-31',
  paymentType: 'Cash',
  paymentAccountId: '41', // Replace with actual bank account ID
  lines: [
    {
      amount: 100,
      expenseAccountId: '13', // Replace with actual expense account ID
      description: 'Test expense',
    },
  ],
};

/**
 * Purchase with vendor reference
 */
export const purchaseWithVendor = {
  ...validPurchaseInput,
  vendorId: '56', // Replace with actual vendor ID
};

/**
 * Purchase with multiple line items
 */
export const purchaseWithMultipleLines = {
  txnDate: '2026-01-31',
  paymentType: 'Cash',
  paymentAccountId: '41',
  lines: [
    {
      amount: 50,
      expenseAccountId: '13',
      description: 'Office supplies',
    },
    {
      amount: 75,
      expenseAccountId: '13',
      description: 'Equipment rental',
    },
    {
      amount: 25,
      expenseAccountId: '13',
      description: 'Miscellaneous',
    },
  ],
};

// =============================================================================
// Credit Card Purchase Fixtures
// =============================================================================

/**
 * Credit card purchase
 */
export const creditCardPurchase = {
  txnDate: '2026-01-31',
  paymentType: 'CreditCard',
  paymentAccountId: '42', // Replace with actual credit card account ID
  lines: [
    {
      amount: 250,
      expenseAccountId: '13',
      description: 'Credit card expense',
    },
  ],
};

// =============================================================================
// Check Purchase Fixtures
// =============================================================================

/**
 * Check purchase with check number
 */
export const checkPurchase = {
  txnDate: '2026-01-31',
  paymentType: 'Check',
  paymentAccountId: '41',
  docNumber: '1234',
  lines: [
    {
      amount: 500,
      expenseAccountId: '13',
      description: 'Check payment',
    },
  ],
};

// =============================================================================
// Raw API Format Fixtures
// =============================================================================

/**
 * Purchase in raw QuickBooks API format
 */
export const rawPurchaseApiFormat = {
  PaymentType: 'Cash',
  AccountRef: { value: '41' },
  TxnDate: '2026-01-31',
  Line: [
    {
      Amount: 100,
      DetailType: 'AccountBasedExpenseLineDetail',
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: '13' },
      },
      Description: 'Test expense in raw format',
    },
  ],
};

/**
 * Purchase with item-based expense line
 */
export const itemBasedPurchase = {
  PaymentType: 'Cash',
  AccountRef: { value: '41' },
  TxnDate: '2026-01-31',
  Line: [
    {
      Amount: 150,
      DetailType: 'ItemBasedExpenseLineDetail',
      ItemBasedExpenseLineDetail: {
        ItemRef: { value: '1' }, // Replace with actual item ID
        Qty: 3,
        UnitPrice: 50,
      },
      Description: 'Item-based expense',
    },
  ],
};

// =============================================================================
// Search Fixtures
// =============================================================================

/**
 * Search criteria for recent purchases
 */
export const recentPurchasesSearch = {
  criteria: [],
  limit: 10,
  desc: 'TxnDate',
};

/**
 * Search criteria for purchases by vendor
 */
export const purchasesByVendorSearch = (vendorId: string) => ({
  criteria: [
    { field: 'EntityRef', value: vendorId },
  ],
  limit: 20,
});

/**
 * Search criteria for purchases in date range
 */
export const purchasesInDateRange = (dateFrom: string, dateTo: string) => ({
  dateFrom,
  dateTo,
  limit: 50,
  asc: 'TxnDate',
});

/**
 * Search criteria for purchases above amount
 */
export const purchasesAboveAmount = (minAmount: number) => ({
  minAmount,
  limit: 20,
  desc: 'TotalAmt',
});

// =============================================================================
// Invalid Fixtures (for error testing)
// =============================================================================

/**
 * Invalid purchase - missing payment account
 */
export const invalidPurchaseMissingAccount = {
  txnDate: '2026-01-31',
  paymentType: 'Cash',
  // paymentAccountId is missing
  lines: [
    {
      amount: 100,
      expenseAccountId: '13',
      description: 'Test expense',
    },
  ],
};

/**
 * Invalid purchase - missing lines
 */
export const invalidPurchaseMissingLines = {
  txnDate: '2026-01-31',
  paymentType: 'Cash',
  paymentAccountId: '41',
  lines: [], // Empty lines array
};

/**
 * Invalid purchase - negative amount
 */
export const invalidPurchaseNegativeAmount = {
  txnDate: '2026-01-31',
  paymentType: 'Cash',
  paymentAccountId: '41',
  lines: [
    {
      amount: -100, // Negative amount
      expenseAccountId: '13',
      description: 'Invalid negative expense',
    },
  ],
};

/**
 * Invalid purchase - invalid date format
 */
export const invalidPurchaseBadDate = {
  txnDate: 'not-a-date',
  paymentType: 'Cash',
  paymentAccountId: '41',
  lines: [
    {
      amount: 100,
      expenseAccountId: '13',
      description: 'Test expense',
    },
  ],
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a purchase fixture with custom values
 */
export function createPurchaseFixture(overrides: Partial<typeof validPurchaseInput> = {}) {
  return {
    ...validPurchaseInput,
    ...overrides,
  };
}

/**
 * Create a raw API purchase fixture with custom values
 */
export function createRawPurchaseFixture(overrides: Partial<typeof rawPurchaseApiFormat> = {}) {
  return {
    ...rawPurchaseApiFormat,
    ...overrides,
  };
}
