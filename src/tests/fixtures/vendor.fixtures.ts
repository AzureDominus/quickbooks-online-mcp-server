/**
 * Test fixtures for Vendor entities
 * 
 * These fixtures provide standard test data for vendor-related tests.
 */

// =============================================================================
// Basic Vendor Fixtures
// =============================================================================

/**
 * Valid vendor input with minimal required fields
 */
export const validVendorInput = {
  DisplayName: 'Test Vendor Inc',
};

/**
 * Vendor with full contact information
 */
export const vendorWithContactInfo = {
  DisplayName: 'Acme Supplies Co',
  CompanyName: 'Acme Supplies Company',
  GivenName: 'John',
  FamilyName: 'Smith',
  PrimaryPhone: {
    FreeFormNumber: '(555) 123-4567',
  },
  PrimaryEmailAddr: {
    Address: 'john.smith@acmesupplies.com',
  },
};

/**
 * Vendor with billing address
 */
export const vendorWithAddress = {
  DisplayName: 'Office Depot Store',
  CompanyName: 'Office Depot',
  BillAddr: {
    Line1: '456 Commerce Street',
    City: 'New York',
    CountrySubDivisionCode: 'NY',
    PostalCode: '10001',
    Country: 'USA',
  },
};

/**
 * Vendor with all fields populated
 */
export const vendorFullDetails = {
  DisplayName: 'Complete Vendor LLC',
  CompanyName: 'Complete Vendor Limited Liability Company',
  GivenName: 'Jane',
  MiddleName: 'Marie',
  FamilyName: 'Doe',
  PrintOnCheckName: 'Complete Vendor LLC',
  PrimaryPhone: {
    FreeFormNumber: '(555) 987-6543',
  },
  Mobile: {
    FreeFormNumber: '(555) 111-2222',
  },
  Fax: {
    FreeFormNumber: '(555) 333-4444',
  },
  PrimaryEmailAddr: {
    Address: 'accounts@completevendor.com',
  },
  WebAddr: {
    URI: 'https://www.completevendor.com',
  },
  BillAddr: {
    Line1: '789 Business Ave',
    Line2: 'Suite 100',
    City: 'Chicago',
    CountrySubDivisionCode: 'IL',
    PostalCode: '60601',
    Country: 'USA',
  },
  AcctNum: 'VEND-001',
  Vendor1099: false,
};

/**
 * 1099 Vendor (independent contractor)
 */
export const vendor1099 = {
  DisplayName: 'Freelance Contractor',
  GivenName: 'Alex',
  FamilyName: 'Johnson',
  Vendor1099: true,
  PrimaryEmailAddr: {
    Address: 'alex@freelancecontractor.com',
  },
  BillAddr: {
    Line1: '321 Remote Work Lane',
    City: 'Austin',
    CountrySubDivisionCode: 'TX',
    PostalCode: '78701',
    Country: 'USA',
  },
};

// =============================================================================
// Search Fixtures
// =============================================================================

/**
 * Search criteria for active vendors
 */
export const activeVendorsSearch = {
  criteria: [
    { field: 'Active', value: 'true' },
  ],
  limit: 50,
  asc: 'DisplayName',
};

/**
 * Search criteria for vendors by name (LIKE search)
 */
export const vendorsByNameSearch = (namePart: string) => ({
  criteria: [
    { field: 'DisplayName', value: `%${namePart}%`, operator: 'LIKE' as const },
  ],
  limit: 20,
});

/**
 * Search criteria for 1099 vendors
 */
export const vendors1099Search = {
  criteria: [
    { field: 'Vendor1099', value: 'true' },
  ],
  limit: 100,
};

/**
 * Search criteria for vendors with balance
 */
export const vendorsWithBalanceSearch = {
  criteria: [
    { field: 'Balance', value: '0', operator: '>' as const },
  ],
  limit: 50,
  desc: 'Balance',
};

// =============================================================================
// Invalid Fixtures (for error testing)
// =============================================================================

/**
 * Invalid vendor - missing display name
 */
export const invalidVendorMissingName = {
  CompanyName: 'No Display Name Corp',
  PrimaryEmailAddr: {
    Address: 'contact@nodisplayname.com',
  },
};

/**
 * Invalid vendor - duplicate display name (for testing uniqueness)
 */
export const invalidVendorDuplicateName = {
  DisplayName: 'Test Vendor Inc', // Same as validVendorInput
};

/**
 * Invalid vendor - invalid email format
 */
export const invalidVendorBadEmail = {
  DisplayName: 'Bad Email Vendor',
  PrimaryEmailAddr: {
    Address: 'not-a-valid-email',
  },
};

/**
 * Invalid vendor - empty display name
 */
export const invalidVendorEmptyName = {
  DisplayName: '',
};

// =============================================================================
// Update Fixtures
// =============================================================================

/**
 * Vendor update with new contact info
 */
export const vendorUpdateContactInfo = (id: string, syncToken: string) => ({
  Id: id,
  SyncToken: syncToken,
  DisplayName: 'Updated Vendor Name',
  PrimaryPhone: {
    FreeFormNumber: '(555) 999-0000',
  },
  PrimaryEmailAddr: {
    Address: 'newemail@vendor.com',
  },
});

/**
 * Vendor update with new address
 */
export const vendorUpdateAddress = (id: string, syncToken: string) => ({
  Id: id,
  SyncToken: syncToken,
  DisplayName: 'Vendor With New Address',
  BillAddr: {
    Line1: '999 New Location Blvd',
    City: 'Miami',
    CountrySubDivisionCode: 'FL',
    PostalCode: '33101',
    Country: 'USA',
  },
});

/**
 * Vendor deactivation
 */
export const vendorDeactivate = (id: string, syncToken: string, displayName: string) => ({
  Id: id,
  SyncToken: syncToken,
  DisplayName: displayName,
  Active: false,
});

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a vendor fixture with a unique display name
 */
export function createVendorFixture(namePrefix: string = 'Test Vendor'): typeof validVendorInput {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return {
    DisplayName: `${namePrefix} ${timestamp}${random}`,
  };
}

/**
 * Create a vendor fixture with full details and unique name
 */
export function createFullVendorFixture(namePrefix: string = 'Full Vendor'): typeof vendorFullDetails {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return {
    ...vendorFullDetails,
    DisplayName: `${namePrefix} ${timestamp}${random}`,
    PrimaryEmailAddr: {
      Address: `vendor-${timestamp}${random}@example.com`,
    },
  };
}

/**
 * Create a vendor with specific company name
 */
export function createVendorWithCompany(companyName: string) {
  const timestamp = Date.now().toString(36);
  return {
    DisplayName: `${companyName} ${timestamp}`,
    CompanyName: companyName,
  };
}
