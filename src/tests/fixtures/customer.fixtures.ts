/**
 * Test fixtures for Customer entities
 * 
 * These fixtures provide standard test data for customer-related tests.
 */

// =============================================================================
// Basic Customer Fixtures
// =============================================================================

/**
 * Valid customer input with minimal required fields
 */
export const validCustomerInput = {
  DisplayName: 'Test Customer Inc',
};

/**
 * Customer with full contact information
 */
export const customerWithContactInfo = {
  DisplayName: 'Premium Client Corp',
  CompanyName: 'Premium Client Corporation',
  GivenName: 'Sarah',
  FamilyName: 'Williams',
  PrimaryPhone: {
    FreeFormNumber: '(555) 234-5678',
  },
  PrimaryEmailAddr: {
    Address: 'sarah.williams@premiumclient.com',
  },
};

/**
 * Customer with billing and shipping addresses
 */
export const customerWithAddresses = {
  DisplayName: 'Multi-Location Client',
  CompanyName: 'Multi-Location Enterprises',
  BillAddr: {
    Line1: '100 Billing Street',
    City: 'Los Angeles',
    CountrySubDivisionCode: 'CA',
    PostalCode: '90001',
    Country: 'USA',
  },
  ShipAddr: {
    Line1: '200 Shipping Boulevard',
    City: 'Los Angeles',
    CountrySubDivisionCode: 'CA',
    PostalCode: '90002',
    Country: 'USA',
  },
};

/**
 * Customer with all fields populated
 */
export const customerFullDetails = {
  DisplayName: 'Complete Customer LLC',
  CompanyName: 'Complete Customer Limited Liability Company',
  GivenName: 'Michael',
  MiddleName: 'James',
  FamilyName: 'Brown',
  PrintOnCheckName: 'Complete Customer LLC',
  PrimaryPhone: {
    FreeFormNumber: '(555) 876-5432',
  },
  Mobile: {
    FreeFormNumber: '(555) 222-3333',
  },
  Fax: {
    FreeFormNumber: '(555) 444-5555',
  },
  PrimaryEmailAddr: {
    Address: 'billing@completecustomer.com',
  },
  WebAddr: {
    URI: 'https://www.completecustomer.com',
  },
  BillAddr: {
    Line1: '500 Enterprise Way',
    Line2: 'Floor 10',
    City: 'Boston',
    CountrySubDivisionCode: 'MA',
    PostalCode: '02101',
    Country: 'USA',
  },
  ShipAddr: {
    Line1: '500 Enterprise Way',
    Line2: 'Loading Dock B',
    City: 'Boston',
    CountrySubDivisionCode: 'MA',
    PostalCode: '02101',
    Country: 'USA',
  },
  Notes: 'VIP customer - priority support',
};

/**
 * Individual customer (not a company)
 */
export const individualCustomer = {
  DisplayName: 'John Doe',
  GivenName: 'John',
  MiddleName: 'Robert',
  FamilyName: 'Doe',
  PrimaryEmailAddr: {
    Address: 'john.doe@email.com',
  },
  PrimaryPhone: {
    FreeFormNumber: '(555) 111-2222',
  },
};

/**
 * Customer with payment terms
 */
export const customerWithTerms = {
  DisplayName: 'Net 30 Customer',
  CompanyName: 'Net 30 Corporation',
  // Note: SalesTermRef would need actual term ID from environment
};

// =============================================================================
// Sub-Customer Fixtures
// =============================================================================

/**
 * Sub-customer (child of another customer)
 */
export const subCustomerFixture = (parentCustomerId: string) => ({
  DisplayName: 'Sub-Location Branch',
  CompanyName: 'Branch Office',
  ParentRef: {
    value: parentCustomerId,
  },
  BillWithParent: true,
});

// =============================================================================
// Search Fixtures
// =============================================================================

/**
 * Search criteria for active customers
 */
export const activeCustomersSearch = {
  criteria: [
    { field: 'Active', value: 'true' },
  ],
  limit: 50,
  asc: 'DisplayName',
};

/**
 * Search criteria for customers by name (LIKE search)
 */
export const customersByNameSearch = (namePart: string) => ({
  criteria: [
    { field: 'DisplayName', value: `%${namePart}%`, operator: 'LIKE' as const },
  ],
  limit: 20,
});

/**
 * Search criteria for customers with balance
 */
export const customersWithBalanceSearch = {
  criteria: [
    { field: 'Balance', value: '0', operator: '>' as const },
  ],
  limit: 50,
  desc: 'Balance',
};

/**
 * Search criteria for customers by email
 */
export const customersByEmailSearch = (email: string) => ({
  criteria: [
    { field: 'PrimaryEmailAddr', value: email },
  ],
  limit: 10,
});

/**
 * Search criteria for recently created customers
 */
export const recentCustomersSearch = {
  criteria: [],
  limit: 10,
  desc: 'MetaData.CreateTime',
};

// =============================================================================
// Invalid Fixtures (for error testing)
// =============================================================================

/**
 * Invalid customer - missing display name
 */
export const invalidCustomerMissingName = {
  CompanyName: 'No Display Name Corp',
  PrimaryEmailAddr: {
    Address: 'contact@nodisplayname.com',
  },
};

/**
 * Invalid customer - duplicate display name (for testing uniqueness)
 */
export const invalidCustomerDuplicateName = {
  DisplayName: 'Test Customer Inc', // Same as validCustomerInput
};

/**
 * Invalid customer - invalid email format
 */
export const invalidCustomerBadEmail = {
  DisplayName: 'Bad Email Customer',
  PrimaryEmailAddr: {
    Address: 'not-a-valid-email',
  },
};

/**
 * Invalid customer - empty display name
 */
export const invalidCustomerEmptyName = {
  DisplayName: '',
};

// =============================================================================
// Update Fixtures
// =============================================================================

/**
 * Customer update with new contact info
 */
export const customerUpdateContactInfo = (id: string, syncToken: string) => ({
  Id: id,
  SyncToken: syncToken,
  DisplayName: 'Updated Customer Name',
  PrimaryPhone: {
    FreeFormNumber: '(555) 888-9999',
  },
  PrimaryEmailAddr: {
    Address: 'updated@customer.com',
  },
});

/**
 * Customer update with new address
 */
export const customerUpdateAddress = (id: string, syncToken: string) => ({
  Id: id,
  SyncToken: syncToken,
  DisplayName: 'Customer With New Address',
  BillAddr: {
    Line1: '888 Relocation Road',
    City: 'Seattle',
    CountrySubDivisionCode: 'WA',
    PostalCode: '98101',
    Country: 'USA',
  },
});

/**
 * Customer deactivation
 */
export const customerDeactivate = (id: string, syncToken: string, displayName: string) => ({
  Id: id,
  SyncToken: syncToken,
  DisplayName: displayName,
  Active: false,
});

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a customer fixture with a unique display name
 */
export function createCustomerFixture(namePrefix: string = 'Test Customer'): typeof validCustomerInput {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return {
    DisplayName: `${namePrefix} ${timestamp}${random}`,
  };
}

/**
 * Create a customer fixture with full details and unique name
 */
export function createFullCustomerFixture(namePrefix: string = 'Full Customer'): typeof customerFullDetails {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return {
    ...customerFullDetails,
    DisplayName: `${namePrefix} ${timestamp}${random}`,
    PrimaryEmailAddr: {
      Address: `customer-${timestamp}${random}@example.com`,
    },
  };
}

/**
 * Create a customer with specific company name
 */
export function createCustomerWithCompany(companyName: string) {
  const timestamp = Date.now().toString(36);
  return {
    DisplayName: `${companyName} ${timestamp}`,
    CompanyName: companyName,
  };
}

/**
 * Create a customer with email
 */
export function createCustomerWithEmail(email: string) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return {
    DisplayName: `Email Customer ${timestamp}${random}`,
    PrimaryEmailAddr: {
      Address: email,
    },
  };
}
