/**
 * Test Fixtures Index
 * 
 * Central export for all test fixtures used in QuickBooks MCP Server tests.
 * Import fixtures from this module for consistent test data across tests.
 * 
 * @example
 * import { validPurchaseInput, createVendorFixture } from '../fixtures/index.js';
 */

// =============================================================================
// Purchase Fixtures
// =============================================================================
export {
  // Basic fixtures
  validPurchaseInput,
  purchaseWithVendor,
  purchaseWithMultipleLines,
  creditCardPurchase,
  checkPurchase,
  
  // Raw API format
  rawPurchaseApiFormat,
  itemBasedPurchase,
  
  // Search fixtures
  recentPurchasesSearch,
  purchasesByVendorSearch,
  purchasesInDateRange,
  purchasesAboveAmount,
  
  // Invalid fixtures
  invalidPurchaseMissingAccount,
  invalidPurchaseMissingLines,
  invalidPurchaseNegativeAmount,
  invalidPurchaseBadDate,
  
  // Factory functions
  createPurchaseFixture,
  createRawPurchaseFixture,
} from './purchase.fixtures.js';

// =============================================================================
// Invoice Fixtures
// =============================================================================
export {
  // Basic fixtures
  validInvoiceInput,
  invoiceWithMultipleLines,
  invoiceWithNotes,
  invoiceWithBillingAddress,
  
  // Raw API format
  rawInvoiceApiFormat,
  invoiceWithDiscount,
  
  // Search fixtures
  unpaidInvoicesSearch,
  invoicesByCustomerSearch,
  overdueInvoicesSearch,
  recentInvoicesSearch,
  
  // Invalid fixtures
  invalidInvoiceMissingCustomer,
  invalidInvoiceMissingLines,
  invalidInvoiceNegativeAmount,
  invalidInvoiceBadDates,
  
  // Factory functions
  createInvoiceFixture,
  createRawInvoiceFixture,
  createInvoiceWithTotal,
} from './invoice.fixtures.js';

// =============================================================================
// Vendor Fixtures
// =============================================================================
export {
  // Basic fixtures
  validVendorInput,
  vendorWithContactInfo,
  vendorWithAddress,
  vendorFullDetails,
  vendor1099,
  
  // Search fixtures
  activeVendorsSearch,
  vendorsByNameSearch,
  vendors1099Search,
  vendorsWithBalanceSearch,
  
  // Invalid fixtures
  invalidVendorMissingName,
  invalidVendorDuplicateName,
  invalidVendorBadEmail,
  invalidVendorEmptyName,
  
  // Update fixtures
  vendorUpdateContactInfo,
  vendorUpdateAddress,
  vendorDeactivate,
  
  // Factory functions
  createVendorFixture,
  createFullVendorFixture,
  createVendorWithCompany,
} from './vendor.fixtures.js';

// =============================================================================
// Customer Fixtures
// =============================================================================
export {
  // Basic fixtures
  validCustomerInput,
  customerWithContactInfo,
  customerWithAddresses,
  customerFullDetails,
  individualCustomer,
  customerWithTerms,
  subCustomerFixture,
  
  // Search fixtures
  activeCustomersSearch,
  customersByNameSearch,
  customersWithBalanceSearch,
  customersByEmailSearch,
  recentCustomersSearch,
  
  // Invalid fixtures
  invalidCustomerMissingName,
  invalidCustomerDuplicateName,
  invalidCustomerBadEmail,
  invalidCustomerEmptyName,
  
  // Update fixtures
  customerUpdateContactInfo,
  customerUpdateAddress,
  customerDeactivate,
  
  // Factory functions
  createCustomerFixture,
  createFullCustomerFixture,
  createCustomerWithCompany,
  createCustomerWithEmail,
} from './customer.fixtures.js';
