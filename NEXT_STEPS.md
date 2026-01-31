# QuickBooks MCP Server - Next Steps Tracking (Phase 2)

> **Last Updated:** 2026-01-31
> **Status:** 🔄 NEW PHASE - Code Review Findings

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

## Priority 1: Critical Bugs - Args Pattern Inconsistencies

Several tools use `args.params.` pattern which is WRONG - MCP SDK passes args directly.

### Task 1.1: Fix update-vendor.tool.ts Args Pattern
- **Status:** 🔴 Not Started
- **File:** `src/tools/update-vendor.tool.ts`
- **Issue:** Uses `args.params.vendor` instead of `args.vendor`
- **Also Missing:** Logging, proper error handling

### Task 1.2: Fix delete-vendor.tool.ts Args Pattern
- **Status:** 🔴 Not Started
- **File:** `src/tools/delete-vendor.tool.ts`
- **Issue:** Uses `args.params.vendor` instead of `args.vendor`
- **Also Missing:** Logging

### Task 1.3: Fix get-employee.tool.ts Args Pattern
- **Status:** 🔴 Not Started
- **File:** `src/tools/get-employee.tool.ts`
- **Issue:** Uses `args.params.id` instead of `args.id`

### Task 1.4: Fix get-bill-payment.tool.ts Args Pattern
- **Status:** 🔴 Not Started
- **File:** `src/tools/get-bill-payment.tool.ts`
- **Issue:** Uses `args.params.id` instead of `args.id`

### Task 1.5: Fix get-estimate.tool.ts Args Pattern
- **Status:** 🔴 Not Started
- **File:** `src/tools/get-estimate.tool.ts`
- **Issue:** Uses `args.params.id` instead of `args.id`

### Task 1.6: Fix get-journal-entry.tool.ts Args Pattern
- **Status:** 🔴 Not Started
- **File:** `src/tools/get-journal-entry.tool.ts`
- **Issue:** Uses `args.params.id` instead of `args.id`

### Task 1.7: Fix get-purchase.tool.ts Args Pattern
- **Status:** 🔴 Not Started
- **File:** `src/tools/get-purchase.tool.ts`
- **Issue:** Uses `args.params.id` instead of `args.id`

### Task 1.8: Fix get-tax-code.tool.ts Args Pattern
- **Status:** 🔴 Not Started
- **File:** `src/tools/get-tax-code.tool.ts`
- **Issue:** Uses `args.params.id` instead of `args.id`

### Task 1.9: Fix create-employee.tool.ts Args Pattern
- **Status:** 🔴 Not Started
- **File:** `src/tools/create-employee.tool.ts`
- **Issue:** Uses `args.params.employee` instead of `args.employee`
- **Also:** Still uses z.any() for employee schema

### Task 1.10: Fix download/upload attachment tools
- **Status:** 🔴 Not Started
- **Files:** `src/tools/download-attachment.tool.ts`, `src/tools/upload-attachment.tool.ts`
- **Issue:** Uses `{ params }` destructuring pattern instead of direct args
- **Also Missing:** Logging

---

## Priority 2: Remaining z.any() Schemas

### Task 2.1: Replace z.any() in create-employee.tool.ts
- **Status:** 🔴 Not Started
- **File:** `src/tools/create-employee.tool.ts`
- **Issue:** Uses `z.any()` for employee parameter
- **Action:** Create CreateEmployeeInputSchema in qbo-schemas.ts

### Task 2.2: Replace z.any() in create-bill-payment.tool.ts
- **Status:** 🔴 Not Started
- **File:** `src/tools/create-bill-payment.tool.ts`
- **Issue:** Uses `z.any()` for billPayment parameter (line 17)
- **Action:** Create CreateBillPaymentInputSchema in qbo-schemas.ts

### Task 2.3: Fix search-accounts.tool.ts Loose Schemas
- **Status:** 🔴 Not Started
- **File:** `src/tools/search-accounts.tool.ts`
- **Issue:** Multiple z.any() usages (lines 86, 109, 110, 168)
- **Action:** Replace with typed schemas like other search tools

---

## Priority 3: Missing Logging in Tools

### Task 3.1: Add Logging to update-vendor.tool.ts
- **Status:** 🔴 Not Started
- **Issue:** No logging imports or calls

### Task 3.2: Add Logging to delete-vendor.tool.ts
- **Status:** 🔴 Not Started
- **Issue:** No logging imports or calls

### Task 3.3: Add Logging to update-bill.tool.ts
- **Status:** 🔴 Not Started
- **Issue:** No logging, also missing SyncToken in schema

### Task 3.4: Add Logging to download/upload attachment tools
- **Status:** 🔴 Not Started
- **Files:** download-attachment.tool.ts, upload-attachment.tool.ts
- **Issue:** No logging

---

## Priority 4: Integration Tests for Real Sandbox

### Task 4.1: Add Real API Integration Tests for Create Operations
- **Status:** 🔴 Not Started
- **Issue:** Most "integration" tests are actually unit tests with mocks
- **Action:** Add tests that actually create/read/delete via sandbox API
- **Entities:** Invoice, Bill, BillPayment, JournalEntry

### Task 4.2: Add Integration Tests for Idempotency
- **Status:** 🔴 Not Started
- **Issue:** Idempotency isn't tested against real API
- **Action:** Test that same key returns same entity without creating duplicate

### Task 4.3: Add Integration Tests for Advanced Search
- **Status:** 🔴 Not Started
- **Issue:** Advanced search filters not tested with real data
- **Action:** Create entities, then search with filters, verify results

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
| P1 - Args Bugs | 10 | 0 | 0 | 10 |
| P2 - z.any() | 3 | 0 | 0 | 3 |
| P3 - Logging | 4 | 0 | 0 | 4 |
| P4 - Integration Tests | 4 | 0 | 0 | 4 |
| P5 - Search | 5 | 0 | 0 | 5 |
| P6 - Idempotency | 4 | 0 | 0 | 4 |
| **TOTAL** | **30** | **0** | **0** | **30** |

---

## Agent Assignment Log (Phase 2)

| Task | Agent | Started | Status | Notes |
|------|-------|---------|--------|-------|

---

## Notes

- P1 is CRITICAL - tools using wrong args pattern will fail at runtime
- All changes should be followed by `npm run build` to verify compilation
- Run `npm test` after completing each task to ensure no regressions
- Integration tests should use the sandbox environment with real API calls
- The sandbox OAuth tokens are stored at `~/.config/quickbooks-mcp/tokens.json`
