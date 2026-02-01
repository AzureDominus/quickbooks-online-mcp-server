# QuickBooks MCP Server - Phase 3 Tasks

> **Created:** 2026-01-31
> **Status:** 🔄 IN PROGRESS - 0/42 Complete

## Overview

Phase 3 focuses on code quality, security hardening, test organization, and comprehensive documentation. Based on comprehensive code scan.

---

## Priority 1: Security Improvements 🔒 (Critical)

### Task 1.1: Remove hardcoded console.error calls with sensitive data
- **Status:** 🔴 Not Started
- **Files:** `src/clients/quickbooks-client.ts` (lines 53, 150, 190), `src/index.ts` (line 183)
- **Issue:** Raw `console.error` calls may leak sensitive token/error info
- **Action:** Replace with `logger.error()` for structured, safe logging

### Task 1.2: Add input sanitization for search queries
- **Status:** 🔴 Not Started
- **Files:** All `search-*.tool.ts` files
- **Issue:** SQL-like queries built from user input (LIKE operator)
- **Action:** Sanitize special characters to prevent query injection

### Task 1.3: Add rate limiting awareness
- **Status:** 🔴 Not Started
- **Files:** `src/clients/quickbooks-client.ts`
- **Issue:** No handling for QuickBooks API rate limits (429 responses)
- **Action:** Add exponential backoff retry logic for rate-limited requests

### Task 1.4: Validate OAuth state parameter
- **Status:** 🔴 Not Started
- **File:** `src/clients/quickbooks-client.ts` (line 180)
- **Issue:** Static state 'testState' used - vulnerable to CSRF
- **Action:** Generate cryptographic random state, validate on callback

### Task 1.5: Add token encryption at rest
- **Status:** 🔴 Not Started
- **File:** `src/clients/quickbooks-client.ts`
- **Issue:** Refresh tokens stored in plaintext JSON files
- **Action:** Encrypt tokens before writing to disk using user's keychain or encryption key

---

## Priority 2: Test Suite Reorganization 🧪 (High)

### Task 2.1: Split integration.test.ts into modules
- **Status:** 🔴 Not Started
- **File:** `src/tests/integration.test.ts` (2313 lines - too large!)
- **Action:** Split into:
  - `src/tests/unit/idempotency.test.ts`
  - `src/tests/unit/logger.test.ts`
  - `src/tests/unit/transform.test.ts`
  - `src/tests/unit/schemas.test.ts`
  - `src/tests/integration/purchase.test.ts`
  - `src/tests/integration/invoice.test.ts`
  - `src/tests/integration/bill.test.ts`
  - `src/tests/integration/vendor.test.ts`
  - `src/tests/integration/customer.test.ts`
  - `src/tests/integration/attachment.test.ts`

### Task 2.2: Create test utilities module
- **Status:** 🔴 Not Started
- **Action:** Create `src/tests/utils/test-helpers.ts` with:
  - `hasOAuthCredentials()` - check for OAuth setup
  - `getTestAccounts()` - fetch bank/expense accounts
  - `createTestPurchase()` - create test purchase fixture
  - `cleanupTestData()` - cleanup helper

### Task 2.3: Add test fixtures
- **Status:** 🔴 Not Started
- **Action:** Create `src/tests/fixtures/` with:
  - `purchase.fixtures.ts`
  - `invoice.fixtures.ts`
  - `vendor.fixtures.ts`
  - `customer.fixtures.ts`

### Task 2.4: Replace console.log with test context logging
- **Status:** 🔴 Not Started
- **Issue:** 20+ `console.log` calls in tests
- **Action:** Replace with `context.diagnostic()` or structured test output

### Task 2.5: Add test coverage reporting
- **Status:** 🔴 Not Started
- **Action:** Add c8 or nyc for coverage, add coverage badge to README

---

## Priority 3: Documentation 📚 (High)

### Task 3.1: Create docs/ directory structure
- **Status:** 🔴 Not Started
- **Action:** Create:
  - `docs/README.md` (documentation index)
  - `docs/getting-started.md` (quick start guide)
  - `docs/authentication.md` (OAuth setup details)
  - `docs/configuration.md` (all env vars explained)
  - `docs/api-reference.md` (tool reference)
  - `docs/troubleshooting.md` (common issues)
  - `docs/development.md` (contributing guide)
  - `docs/architecture.md` (codebase structure)

### Task 3.2: Create API Reference documentation
- **Status:** 🔴 Not Started
- **Action:** Document each tool with:
  - Description
  - Input parameters (with types)
  - Output format
  - Example request/response
  - Common errors

### Task 3.3: Create Entity Relationship documentation
- **Status:** 🔴 Not Started
- **Action:** Document QuickBooks entity relationships:
  - Invoice → Customer, Items, TaxCodes
  - Bill → Vendor, Accounts, TaxCodes
  - Purchase → Vendor, Accounts, PaymentAccount
  - JournalEntry → Accounts

### Task 3.4: Add JSDoc comments to all exported functions
- **Status:** 🔴 Not Started
- **Files:** `src/helpers/*.ts`, `src/clients/*.ts`
- **Issue:** Many functions lack JSDoc documentation
- **Action:** Add `@param`, `@returns`, `@throws`, `@example` comments

### Task 3.5: Create CHANGELOG.md
- **Status:** 🔴 Not Started
- **Action:** Document all phases and major changes

### Task 3.6: Add mermaid diagrams for architecture
- **Status:** 🔴 Not Started
- **Action:** Create diagrams for:
  - OAuth flow
  - MCP request flow
  - Entity relationships

---

## Priority 4: Code Quality & Refactoring 🔧 (Medium)

### Task 4.1: Remove all `as any` type assertions
- **Status:** 🔴 Not Started
- **Issue:** 50+ `as any` usages, especially in tests and handlers
- **Action:** Replace with proper types or type guards

### Task 4.2: Create proper return types for tool handlers
- **Status:** 🔴 Not Started
- **Files:** All `src/tools/*.tool.ts`
- **Issue:** Many handlers have `{ [x: string]: any }` parameter types
- **Action:** Create specific input/output types using Zod inference

### Task 4.3: Extract duplicate code in search tools
- **Status:** 🔴 Not Started
- **Files:** `search-*.tool.ts` files
- **Issue:** Similar filter building logic duplicated across files
- **Action:** Create shared `buildSearchFilters()` helper

### Task 4.4: Consolidate error handling patterns
- **Status:** 🔴 Not Started
- **Issue:** Inconsistent error handling - some use `throw error`, some use `logger.error`
- **Action:** Create `handleToolError()` wrapper for consistent error handling

### Task 4.5: Remove deprecated handlers/ directory
- **Status:** 🔴 Not Started
- **Files:** `src/handlers/*.ts` (54 files)
- **Issue:** Handlers seem to be legacy - tools now contain their own handlers
- **Action:** Verify handlers not used, remove or consolidate

### Task 4.6: Add strict TypeScript config
- **Status:** 🔴 Not Started
- **File:** `tsconfig.json`
- **Action:** Enable `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`

### Task 4.7: Reduce transform.ts size
- **Status:** 🔴 Not Started
- **File:** `src/helpers/transform.ts` (827 lines)
- **Action:** Split into entity-specific transform files:
  - `src/helpers/transforms/purchase.transform.ts`
  - `src/helpers/transforms/bill.transform.ts`
  - `src/helpers/transforms/invoice.transform.ts`

### Task 4.8: Reduce qbo-schemas.ts size
- **Status:** 🔴 Not Started
- **File:** `src/types/qbo-schemas.ts` (1351 lines)
- **Action:** Split into entity-specific schema files:
  - `src/types/schemas/purchase.schema.ts`
  - `src/types/schemas/invoice.schema.ts`
  - `src/types/schemas/vendor.schema.ts`
  - etc.

---

## Priority 5: Error Handling & Resilience 🛡️ (Medium)

### Task 5.1: Add retry logic for transient failures
- **Status:** 🔴 Not Started
- **Files:** `src/clients/quickbooks-client.ts`
- **Action:** Add configurable retry with exponential backoff for:
  - Network errors
  - 5xx responses
  - Token refresh failures

### Task 5.2: Add circuit breaker pattern
- **Status:** 🔴 Not Started
- **Action:** Implement circuit breaker to prevent cascading failures

### Task 5.3: Improve token refresh error handling
- **Status:** 🔴 Not Started
- **File:** `src/clients/quickbooks-client.ts`
- **Action:** Better handling when refresh token is expired/revoked

### Task 5.4: Add request timeout configuration
- **Status:** 🔴 Not Started
- **Issue:** No configurable timeout for QBO API calls
- **Action:** Add `QUICKBOOKS_TIMEOUT_MS` environment variable

### Task 5.5: Add health check endpoint
- **Status:** 🔴 Not Started
- **Action:** Create MCP tool to check QBO connection status

---

## Priority 6: Developer Experience 🛠️ (Low)

### Task 6.1: Add ESLint configuration
- **Status:** 🔴 Not Started
- **Action:** Add `.eslintrc.js` with TypeScript rules

### Task 6.2: Add Prettier configuration
- **Status:** 🔴 Not Started
- **Action:** Add `.prettierrc` for consistent formatting

### Task 6.3: Add pre-commit hooks
- **Status:** 🔴 Not Started
- **Action:** Add husky + lint-staged for pre-commit linting/formatting

### Task 6.4: Add GitHub Actions CI workflow
- **Status:** 🔴 Not Started
- **Action:** Create `.github/workflows/ci.yml` with:
  - TypeScript compilation check
  - ESLint
  - Unit tests
  - (Optional) Integration tests with sandbox

### Task 6.5: Add VS Code workspace settings
- **Status:** 🔴 Not Started
- **Action:** Create `.vscode/settings.json` with recommended settings

### Task 6.6: Add npm scripts for common tasks
- **Status:** 🔴 Not Started
- **Action:** Add to `package.json`:
  - `lint`, `lint:fix`
  - `format`, `format:check`
  - `test:unit`, `test:integration`, `test:coverage`
  - `docs:build`

---

## Completion Tracking

| Priority | Total Tasks | Completed | In Progress | Not Started |
|----------|-------------|-----------|-------------|-------------|
| P1 - Security | 5 | 0 | 0 | 5 |
| P2 - Tests | 5 | 0 | 0 | 5 |
| P3 - Documentation | 6 | 0 | 0 | 6 |
| P4 - Code Quality | 8 | 0 | 0 | 8 |
| P5 - Error Handling | 5 | 0 | 0 | 5 |
| P6 - Developer Experience | 6 | 0 | 0 | 6 |
| **TOTAL** | **35** | **0** | **0** | **35** |

---

## Agent Assignment Log (Phase 3)

| Task | Agent | Started | Status | Notes |
|------|-------|---------|--------|-------|

---

## Notes

- P1 Security is CRITICAL - should be addressed first
- P2 Tests and P3 Documentation can be parallelized
- P4 Refactoring should wait until tests are reorganized
- P5 and P6 are improvements that can be done incrementally
- Each subagent MUST commit and push before completing

---

## Code Metrics Summary

| Metric | Value |
|--------|-------|
| Total TypeScript Files | 110+ |
| Test File Size | 2313 lines |
| Largest Helper | transform.ts (827 lines) |
| Largest Schema | qbo-schemas.ts (1351 lines) |
| Handler Files | 54 |
| Tool Files | 57 |
| `as any` Count | 50+ |
| `console.*` in non-logger | 20+ |

