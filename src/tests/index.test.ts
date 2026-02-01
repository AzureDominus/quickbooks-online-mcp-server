/**
 * Test Index
 * 
 * This file imports all test files to run them together.
 * Individual test files can also be run independently.
 * 
 * Run all tests with: npm test
 */

// Import unit tests
import './unit/idempotency.test.js';
import './unit/logger.test.js';
import './unit/transform.test.js';
import './unit/schemas.test.js';

// Import integration tests
import './integration/purchase.test.js';
import './integration/invoice.test.js';
import './integration/bill.test.js';
import './integration/vendor.test.js';
import './integration/customer.test.js';
import './integration/attachment.test.js';
import './integration/tax-code.test.js';
import './integration/idempotency.test.js';

// All test files loaded
