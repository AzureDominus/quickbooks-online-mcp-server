# QuickBooks MCP Server - Next Steps Tracking (Phase 2)

> **Security Note:** `.env` is intentionally ignored and must never be committed. Use `.env.example` as a template.


> **Last Updated:** 2026-01-31
> **Status:** 🔄 IN PROGRESS - 17/30 Complete

## Overview

This document tracks Phase 2 improvements based on comprehensive code review. The previous 24 tasks are complete - this phase addresses newly identified issues.

---

## Phase 1 Completed Tasks (Summary)
- ✅ P1: Fixed vendor/customer search bugs
- ✅ P2: Replaced z.any() in most tools with typed schemas
- ✅ P3: Added idempotency to 6 create operations
- ✅ P4: Added logging to all get/read/search/create tools
- ✅ P5: Added advanced search to bills/invoices/estimates
- ✅ P6: Added tests and documentation

---

## Priority 1: Critical Bugs - Args Pattern Inconsistencies ✅ COMPLETE

Several tools use `args.params.` pattern which is WRONG - MCP SDK passes args directly.

### Task 1.1: Fix update-vendor.tool.ts Args Pattern
- **Status:** ✅ Completed (commit 8898cf6)
- **File:** `src/tools/update-vendor.tool.ts`
- **Fix:** Changed `args.params.vendor` → `args.vendor`, added logging

### Task 1.2: Fix delete-vendor.tool.ts Args Pattern
- **Status:** ✅ Completed (commit 8898cf6)
- **File:** `src/tools/delete-vendor.tool.ts`
- **Fix:** Changed `args.params.vendor` → `args.vendor`, added logging

### Task 1.3: Fix get-employee.tool.ts Args Pattern
- **Status:** ✅ Completed (commit 8898cf6)
- **File:** `src/tools/get-employee.tool.ts`
- **Fix:** Changed `args.params.id` → `args.id`

### Task 1.4: Fix get-bill-payment.tool.ts Args Pattern
- **Status:** ✅ Completed (commit 8898cf6)
- **File:** `src/tools/get-bill-payment.tool.ts`
- **Fix:** Changed `args.params.id` → `args.id`

### Task 1.5: Fix get-estimate.tool.ts Args Pattern
- **Status:** ✅ Completed (commit 8898cf6)
- **File:** `src/tools/get-estimate.tool.ts`
- **Fix:** Changed `args.params.id` → `args.id`

### Task 1.6: Fix get-journal-entry.tool.ts Args Pattern
- **Status:** ✅ Completed (commit 6648e90)
- **File:** `src/tools/get-journal-entry.tool.ts`
- **Fix:** Changed `args.params.id` → `args.id`

### Task 1.7: Fix get-purchase.tool.ts Args Pattern
- **Status:** ✅ Completed (commit 6648e90)
- **File:** `src/tools/get-purchase.tool.ts`
- **Fix:** Changed `args.params.id` → `args.id`

### Task 1.8: Fix get-tax-code.tool.ts Args Pattern
- **Status:** ✅ Completed (commit 6648e90)
- **File:** `src/tools/get-tax-code.tool.ts`
- **Fix:** Changed `args.params.id` → `args.id`, added logging

### Task 1.9: Fix create-employee.tool.ts Args Pattern
- **Status:** ✅ Completed (commit 6648e90)
- **File:** `src/tools/create-employee.tool.ts`
- **Fix:** Changed `args.params.employee` → `args.employee`

### Task 1.10: Fix download/upload attachment tools
- **Status:** ✅ Completed (commit 6648e90)
- **Files:** `src/tools/download-attachment.tool.ts`, `src/tools/upload-attachment.tool.ts`
- **Fix:** Changed `{ params }` → direct args, added logging

---

## Priority 2: Remaining z.any() Schemas ✅ COMPLETE

### Task 2.1: Replace z.any() in create-employee.tool.ts
- **Status:** ✅ Completed (commit 5df7950)
- **File:** `src/tools/create-employee.tool.ts`
- **Fix:** Created and used CreateEmployeeInputSchema

### Task 2.2: Replace z.any() in create-bill-payment.tool.ts
- **Status:** ✅ Completed (commit 5df7950)
- **File:** `src/tools/create-bill-payment.tool.ts`
- **Fix:** Created and used CreateBillPaymentInputSchema

### Task 2.3: Fix search-accounts.tool.ts Loose Schemas
- **Status:** 🔴 Not Started
- **File:** `src/tools/search-accounts.tool.ts`
- **Issue:** Multiple z.any() usages (lines 86, 109, 110, 168)
- **Action:** Replace with typed schemas like other search tools

---

## Priority 3: Missing Logging in Tools

## Priority 3: Missing Logging in Tools ✅ MOSTLY COMPLETE

### Task 3.1: Add Logging to update-vendor.tool.ts
- **Status:** ✅ Completed (commit 8898cf6)
- **Fix:** Added logging in args fix

### Task 3.2: Add Logging to delete-vendor.tool.ts
- **Status:** ✅ Completed (commit 8898cf6)
- **Fix:** Added logging in args fix

### Task 3.3: Add Logging to update-bill.tool.ts
- **Status:** 🔴 Not Started
- **Issue:** No logging, also missing SyncToken in schema

### Task 3.4: Add Logging to download/upload attachment tools
- **Status:** ✅ Completed (commit 6648e90)
- **Fix:** Added logging in args fix

---

## Priority 4: Integration Tests for Real Sandbox ✅ COMPLETE

### Task 4.1: Add Real API Integration Tests for Create Operations
- **Status:** ✅ Completed (commit f79e66f)
- **Fix:** Added invoice and bill lifecycle tests against real sandbox

### Task 4.2: Add Integration Tests for Idempotency
- **Status:** ✅ Completed (commit f79e66f)
- **Fix:** Added test that verifies same idempotency key returns same entity

### Task 4.3: Add Integration Tests for Advanced Search
- **Status:** ✅ Completed (commit f79e66f)
- **Fix:** Added search filter tests for purchases and invoices

### Task 4.4: Add Integration Tests for Attachments
- **Status:** 🔴 Not Started
- **Issue:** Attachment upload/download not tested
- **Action:** Upload a test file, verify attachment exists, download it

---

## Priority 5: Advanced Search Enhancements

### Task 5.1: Add Advanced Search to Accounts
- **Status:** 🔴 Not Started
- **File:** `src/tools/search-accounts.tool.ts`
- **Action:** Add filtering by AccountType, Classification, Balance ranges

### Task 5.2: Add Advanced Search to Employees
- **Status:** 🔴 Not Started
- **File:** `src/tools/search-employees.tool.ts`
- **Action:** Add filtering by Active status, HiredDate ranges

### Task 5.3: Add Advanced Search to Bill Payments
- **Status:** 🔴 Not Started
- **File:** `src/tools/search-bill-payments.tool.ts`
- **Action:** Add date range, amount range filters

### Task 5.4: Add Advanced Search to Journal Entries
- **Status:** 🔴 Not Started
- **File:** `src/tools/search-journal-entries.tool.ts`
- **Action:** Add date range, amount filters

### Task 5.5: Add Advanced Search to Items
- **Status:** 🔴 Not Started
- **File:** `src/tools/search-items.tool.ts`
- **Action:** Add filtering by Type, Active status, UnitPrice range

---

## Priority 6: Missing Idempotency

### Task 6.1: Add Idempotency to create-account.tool.ts
- **Status:** 🔴 Not Started
- **Issue:** Account creation lacks idempotency

### Task 6.2: Add Idempotency to create-employee.tool.ts
- **Status:** 🔴 Not Started
- **Issue:** Employee creation lacks idempotency

### Task 6.3: Add Idempotency to create-item.tool.ts
- **Status:** 🔴 Not Started
- **Issue:** Item creation lacks idempotency

### Task 6.4: Add Idempotency to create-journal-entry.tool.ts
- **Status:** 🔴 Not Started
- **Issue:** Journal entry creation lacks idempotency

---

## Completion Tracking

| Priority | Total Tasks | Completed | In Progress | Not Started |
|----------|-------------|-----------|-------------|-------------|
| P1 - Args Bugs | 10 | 10 | 0 | 0 |
| P2 - z.any() | 3 | 2 | 0 | 1 |
| P3 - Logging | 4 | 3 | 0 | 1 |
| P4 - Integration Tests | 4 | 3 | 0 | 1 |
| P5 - Search | 5 | 0 | 0 | 5 |
| P6 - Idempotency | 4 | 0 | 0 | 4 |
| **TOTAL** | **30** | **18** | **0** | **12** |

---

## Agent Assignment Log (Phase 2)

| Task | Agent | Started | Status | Notes |
|------|-------|---------|--------|-------|
| 1.1-1.5 | Subagent-22 | 2026-01-31 | ✅ Complete | Commit 8898cf6 |
| 1.6-1.10 | Subagent-23 | 2026-01-31 | ✅ Complete | Commit 6648e90 |
| 2.1-2.2 | Subagent-24 | 2026-01-31 | ✅ Complete | Commit 5df7950 |
| 4.1-4.3 | Subagent-25 | 2026-01-31 | ✅ Complete | Commit f79e66f, 96 tests |

---

## Notes

- P1 is CRITICAL - tools using wrong args pattern will fail at runtime
- All changes should be followed by `npm run build` to verify compilation
- Run `npm test` after completing each task to ensure no regressions
- Integration tests should use the sandbox environment with real API calls
- The sandbox OAuth tokens are stored at `~/.config/quickbooks-mcp/tokens.json`
