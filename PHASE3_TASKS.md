# QuickBooks MCP Server - Phase 3 Tasks

> **Created:** 2026-01-31
> **Status:** 🔄 IN PROGRESS - 17/35 Complete

## Overview

Phase 3 focuses on code quality, security hardening, test organization, and comprehensive documentation. Based on comprehensive code scan.

---

## Priority 1: Security Improvements 🔒 (Critical)

### Task 1.1: Remove hardcoded console.error calls with sensitive data
- **Status:** ✅ Completed (commit 4a8838a)
- **Files:** `src/clients/quickbooks-client.ts`, `src/index.ts`
- **Fix:** Replaced console.error with logger.error for structured logging

### Task 1.2: Add input sanitization for search queries
- **Status:** ✅ Completed (commit 4a8838a)
- **Files:** Created `src/helpers/sanitize.ts`, updated 7 search tools
- **Fix:** Added sanitizeQueryValue() and sanitizeLikePattern() helpers, applied to all search tools

### Task 1.3: Add rate limiting awareness
- **Status:** ✅ Completed (commit 69d13c7)
- **Files:** Created `src/helpers/retry.ts`, updated `src/clients/quickbooks-client.ts`
- **Fix:** Added withRetry() with exponential backoff, handles 429/5xx, respects Retry-After header

### Task 1.4: Validate OAuth state parameter
- **Status:** ✅ Completed (commit de43fce)
- **File:** `src/clients/quickbooks-client.ts`
- **Fix:** Added cryptographic random state generation, validated on callback, prevents CSRF attacks

### Task 1.5: Add token encryption at rest
- **Status:** 🔴 Not Started
- **File:** `src/clients/quickbooks-client.ts`
- **Issue:** Refresh tokens stored in plaintext JSON files
- **Action:** Encrypt tokens before writing to disk using user's keychain or encryption key

---

## Priority 2: Test Suite Reorganization 🧪 (High)

### Task 2.1: Split integration.test.ts into modules
- **Status:** ✅ Completed (commit dca708a)
- **Files:** Created 12 test files in `src/tests/unit/` and `src/tests/integration/`
- **Fix:** Split 2313-line file into modular test files, 101 tests all passing

### Task 2.2: Create test utilities module
- **Status:** ✅ Completed (commit 8836ea2)
- **File:** `src/tests/utils/test-helpers.ts`
- **Fix:** Created with hasOAuthCredentials, getTestAccounts, createTestPurchase, cleanupTestData, retry helpers

### Task 2.3: Add test fixtures
- **Status:** ✅ Completed (commit 8836ea2)
- **Files:** Created `src/tests/fixtures/` with purchase, invoice, vendor, customer fixtures
- **Fix:** Added factory functions and common test data

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
- **Status:** ✅ Completed (commit 0e4e42b)
- **Files:** Created 6 docs: README.md, getting-started.md, authentication.md, configuration.md, troubleshooting.md, development.md
- **Fix:** 5,748 words of comprehensive documentation
  - `docs/development.md` (contributing guide)
  - `docs/architecture.md` (codebase structure)

### Task 3.2: Create API Reference documentation
- **Status:** ✅ Completed (commit 09bedde)
- **File:** `docs/api-reference.md`
- **Fix:** Documented all 54 tools with parameters, examples, and common errors

### Task 3.3: Create Entity Relationship documentation
- **Status:** ✅ Completed (commit 4fb560b)
- **File:** `docs/entities.md`
- **Fix:** Documented all 12 QuickBooks entities with fields, relationships, examples (1344 lines)

### Task 3.4: Add JSDoc comments to all exported functions
- **Status:** 🔴 Not Started
- **Files:** `src/helpers/*.ts`, `src/clients/*.ts`
- **Issue:** Many functions lack JSDoc documentation
- **Action:** Add `@param`, `@returns`, `@throws`, `@example` comments

### Task 3.5: Create CHANGELOG.md
- **Status:** ✅ Completed (commit 0e4e42b)
- **File:** `CHANGELOG.md`
- **Fix:** Documented Phase 1, Phase 2, and Phase 3 progress

### Task 3.6: Add mermaid diagrams for architecture
- **Status:** ✅ Completed (commit fc0bc68)
- **File:** `docs/architecture.md`
- **Fix:** Added 4 mermaid diagrams: OAuth flow, MCP request flow, project structure, entity relationships

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

### Task 6.4: Add npm scripts for common tasks
- **Status:** ✅ Completed (commit 77e33f4)
- **File:** `package.json`
- **Fix:** Added lint, lint:fix, format, format:check scripts

---

## Completion Tracking

| Priority | Total Tasks | Completed | In Progress | Not Started |
|----------|-------------|-----------|-------------|-------------|
| P1 - Security | 5 | 4 | 0 | 1 |
| P2 - Tests | 5 | 3 | 0 | 2 |
| P3 - Documentation | 6 | 6 | 0 | 0 |
| P4 - Code Quality | 8 | 0 | 0 | 8 |
| P5 - Error Handling | 5 | 1 | 0 | 4 |
| P6 - Developer Experience | 4 | 1 | 0 | 3 |
| **TOTAL** | **35** | **17** | **0** | **18** |

---

## Agent Assignment Log (Phase 3)

| Task | Agent | Started | Status | Notes |
|------|-------|---------|--------|-------|
| P2.1 | Subagent-31 | 2026-01-31 | ✅ Complete | Commit dca708a - Split tests into 12 files |
| P3.1-P3.3, P3.5 | Subagent-32 | 2026-01-31 | ✅ Complete | Commit 0e4e42b - 7 doc files, 5748 words |
| P1.1-P1.2 | Subagent-33 | 2026-01-31 | ✅ Complete | Commit 4a8838a - Security fixes |
| P3.2 | Subagent-34 | 2026-01-31 | ✅ Complete | Commit 09bedde - API reference, 54 tools |
| P2.2-P2.3 | Subagent-35 | 2026-01-31 | ✅ Complete | Commit 8836ea2 - Test utils & fixtures |
| P1.4 | Subagent-36 | 2026-01-31 | ✅ Complete | Commit de43fce - OAuth CSRF protection |
| P1.3, P5.1 | Subagent-37 | 2026-01-31 | ✅ Complete | Commit 69d13c7 - Retry with backoff |
| P6.1-P6.2 | Subagent-38 | 2026-01-31 | ✅ Complete | Commit 77e33f4 - ESLint + Prettier |
| P3.6 | Subagent-39 | 2026-01-31 | ✅ Complete | Commit fc0bc68 - Mermaid diagrams |
| P3.3 | Subagent-40 | 2026-01-31 | ✅ Complete | Commit 4fb560b - Entity docs (1344 lines) |

---

## Notes

- P1 Security is CRITICAL - should be addressed first
- P2 Tests and P3 Documentation can be parallelized
- P4 Refactoring should wait until tests are reorganized
- P5 and P6 are improvements that can be done incrementally
- Each subagent MUST commit and push before completing

---

## Code Metrics Summary (Updated)

| Metric | Before | After |
|--------|--------|-------|
| Test File Size | 2313 lines (1 file) | 12 files organized |
| Documentation | 287 lines (README only) | 6000+ words (8 docs) |
| console.* in non-logger | 20+ | Mostly fixed |
| Query Sanitization | None | All search tools protected |
| Test Fixtures | None | 5 fixture files |
| Test Helpers | None | Comprehensive helper module |

