/**
 * Test fixtures for Invoice entities
 * 
 * These fixtures provide standard test data for invoice-related tests.
 * Customer and item IDs should be replaced with actual IDs from the test environment.
 */

// =============================================================================
// Basic Invoice Fixtures
// =============================================================================

/**
 * Valid invoice input with single line item
 */
export const validInvoiceInput = {
  customerId: '1', // Replace with actual customer ID
  txnDate: '2026-01-31',
  dueDate: '2026-02-28',
  lines: [
    {
      amount: 500,
      description: 'Professional services',
      itemId: '1', // Replace with actual item ID
      qty: 1,
      unitPrice: 500,
    },
  ],
};

/**
 * Invoice with multiple line items
 */
export const invoiceWithMultipleLines = {
  customerId: '1',
  txnDate: '2026-01-31',
  dueDate: '2026-02-28',
  lines: [
    {
      amount: 200,
      description: 'Consulting - 2 hours',
      itemId: '1',
      qty: 2,
      unitPrice: 100,
    },
    {
      amount: 150,
      description: 'Software license',
      itemId: '2',
      qty: 1,
      unitPrice: 150,
    },
    {
      amount: 75,
      description: 'Support fee',
      itemId: '3',
      qty: 1,
      unitPrice: 75,
    },
  ],
};

/**
 * Invoice with customer memo and private note
 */
export const invoiceWithNotes = {
  ...validInvoiceInput,
  customerMemo: 'Thank you for your business!',
  privateNote: 'Follow up in 2 weeks if not paid',
};

/**
 * Invoice with billing address
 */
export const invoiceWithBillingAddress = {
  ...validInvoiceInput,
  billAddr: {
    line1: '123 Main Street',
    city: 'San Francisco',
    countrySubDivisionCode: 'CA',
    postalCode: '94102',
    country: 'USA',
  },
};

// =============================================================================
// Raw API Format Fixtures
// =============================================================================

/**
 * Invoice in raw QuickBooks API format
 */
export const rawInvoiceApiFormat = {
  CustomerRef: { value: '1' },
  TxnDate: '2026-01-31',
  DueDate: '2026-02-28',
  Line: [
    {
      Amount: 500,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: '1' },
        Qty: 1,
        UnitPrice: 500,
      },
      Description: 'Professional services',
    },
  ],
};

/**
 * Invoice with discount line
 */
export const invoiceWithDiscount = {
  CustomerRef: { value: '1' },
  TxnDate: '2026-01-31',
  DueDate: '2026-02-28',
  Line: [
    {
      Amount: 500,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: '1' },
        Qty: 1,
        UnitPrice: 500,
      },
      Description: 'Professional services',
    },
    {
      Amount: 50,
      DetailType: 'DiscountLineDetail',
      DiscountLineDetail: {
        PercentBased: true,
        DiscountPercent: 10,
      },
      Description: '10% loyalty discount',
    },
  ],
};

// =============================================================================
// Search Fixtures
// =============================================================================

/**
 * Search criteria for unpaid invoices
 */
export const unpaidInvoicesSearch = {
  criteria: [
    { field: 'Balance', value: '0', operator: '>' as const },
  ],
  limit: 20,
  desc: 'DueDate',
};

/**
 * Search criteria for invoices by customer
 */
export const invoicesByCustomerSearch = (customerId: string) => ({
  criteria: [
    { field: 'CustomerRef', value: customerId },
  ],
  limit: 20,
  desc: 'TxnDate',
});

/**
 * Search criteria for overdue invoices
 */
export const overdueInvoicesSearch = (beforeDate: string) => ({
  criteria: [
    { field: 'Balance', value: '0', operator: '>' as const },
    { field: 'DueDate', value: beforeDate, operator: '<' as const },
  ],
  limit: 50,
});

/**
 * Search criteria for recent invoices
 */
export const recentInvoicesSearch = {
  criteria: [],
  limit: 10,
  desc: 'TxnDate',
};

// =============================================================================
// Invalid Fixtures (for error testing)
// =============================================================================

/**
 * Invalid invoice - missing customer
 */
export const invalidInvoiceMissingCustomer = {
  txnDate: '2026-01-31',
  dueDate: '2026-02-28',
  lines: [
    {
      amount: 500,
      description: 'Professional services',
      itemId: '1',
      qty: 1,
      unitPrice: 500,
    },
  ],
};

/**
 * Invalid invoice - missing lines
 */
export const invalidInvoiceMissingLines = {
  customerId: '1',
  txnDate: '2026-01-31',
  dueDate: '2026-02-28',
  lines: [],
};

/**
 * Invalid invoice - negative amount
 */
export const invalidInvoiceNegativeAmount = {
  customerId: '1',
  txnDate: '2026-01-31',
  dueDate: '2026-02-28',
  lines: [
    {
      amount: -500,
      description: 'Invalid negative amount',
      itemId: '1',
      qty: 1,
      unitPrice: -500,
    },
  ],
};

/**
 * Invalid invoice - due date before transaction date
 */
export const invalidInvoiceBadDates = {
  customerId: '1',
  txnDate: '2026-02-28',
  dueDate: '2026-01-31', // Due date before transaction date
  lines: [
    {
      amount: 500,
      description: 'Professional services',
      itemId: '1',
      qty: 1,
      unitPrice: 500,
    },
  ],
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an invoice fixture with custom values
 */
export function createInvoiceFixture(overrides: Partial<typeof validInvoiceInput> = {}) {
  return {
    ...validInvoiceInput,
    ...overrides,
  };
}

/**
 * Create a raw API invoice fixture with custom values
 */
export function createRawInvoiceFixture(overrides: Partial<typeof rawInvoiceApiFormat> = {}) {
  return {
    ...rawInvoiceApiFormat,
    ...overrides,
  };
}

/**
 * Create an invoice with a specific total amount
 */
export function createInvoiceWithTotal(customerId: string, totalAmount: number) {
  return {
    customerId,
    txnDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    lines: [
      {
        amount: totalAmount,
        description: 'Services',
        itemId: '1',
        qty: 1,
        unitPrice: totalAmount,
      },
    ],
  };
}
