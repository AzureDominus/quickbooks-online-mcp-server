# QuickBooks MCP Server Tool Test Report

**Date:** January 31, 2026  
**Environment:** Sandbox  
**OAuth Status:** Connected (tokens exist)

---

## Executive Summary

Testing revealed **a critical bug affecting most tools**: the MCP server's `RegisterTool` helper wraps schemas with `{ params: ... }`, but many tool handlers don't extract from `args.params`, causing "Cannot read properties of undefined" errors.

### Overall Results
- **Working Tools:** 8
- **Broken Tools (params extraction bug):** 20+
- **Broken Tools (API/Query errors):** 6

---

## Tool Test Results

### ✅ WORKING TOOLS

| Tool | Status | Notes |
|------|--------|-------|
| `health_check` | ✅ Working | Returns OAuth status, circuit breaker state |
| `search_accounts` | ✅ Working | Returns chart of accounts correctly |
| `search_customers` | ✅ Working | Returns customer list correctly |
| `search_vendors` | ✅ Working | Returns vendor list correctly |
| `search_items` | ✅ Working | Returns items correctly |
| `search_tax_codes` | ✅ Working | Returns tax codes correctly |
| `search_bill_payments` | ✅ Working | Returns bill payments correctly |
| `search_journal_entries` | ✅ Working | Returns journal entries correctly |
| `search_employees` | ✅ Working | Returns employees (empty in sandbox) |
| `get_customer` | ✅ Working | Correctly extracts `args.params` |
| `read_item` | ✅ Working | Returns item details |
| `create_account` | ✅ Working | Successfully created test account |
| `create_item` | ✅ Working | Successfully created test service item |
| `get_attachments` | ✅ Working | Returns "no attachments found" correctly |

### ❌ BROKEN - Parameter Extraction Bug

These tools fail with: `Cannot read properties of undefined (reading 'PropertyName')`

**Root Cause:** The `RegisterTool` function wraps schemas: `{ params: toolDefinition.schema }`, but handlers access `args.property` instead of `args.params.property`.

| Tool | Error | Fix Required |
|------|-------|--------------|
| `create_customer` | `Cannot read properties of undefined (reading 'DisplayName')` | Extract from `args.params` |
| `create_estimate` | `Cannot read properties of undefined (reading 'CustomerRef')` | Extract from `args.params` |
| `create_journal_entry` | `Cannot read properties of undefined (reading 'Line')` | Extract from `args.params` |
| `create-bill` | `Cannot read properties of undefined (reading 'VendorRef')` | Extract from `args.params` |
| `create_purchase` | `Cannot read properties of undefined (reading 'lines')` | Extract from `args.params` |
| `update_account` | `Cannot read properties of undefined (reading 'Id')` | Extract from `args.params` |
| `update_customer` | Likely same issue | Extract from `args.params` |
| `update_estimate` | Likely same issue | Extract from `args.params` |
| `update_bill` | Likely same issue | Extract from `args.params` |
| `update_employee` | Likely same issue | Extract from `args.params` |
| `update_item` | Likely same issue | Extract from `args.params` |
| `update_journal_entry` | Likely same issue | Extract from `args.params` |
| `update_invoice` | Likely same issue | Extract from `args.params` |
| `update_bill_payment` | Likely same issue | Extract from `args.params` |
| `update_purchase` | Likely same issue | Extract from `args.params` |
| `delete_customer` | `Cannot read properties of undefined (reading 'Id')` | Extract from `args.params` |
| `delete_estimate` | Likely same issue | Extract from `args.params` |
| `delete_bill` | Likely same issue | Extract from `args.params` |
| `delete_journal_entry` | Likely same issue | Extract from `args.params` |
| `delete_bill_payment` | Likely same issue | Extract from `args.params` |
| `delete_purchase` | Likely same issue | Extract from `args.params` |
| `delete_vendor` | Likely same issue | Extract from `args.params` |

### ❌ BROKEN - API/HTTP Method Errors

These tools fail with: `Unsupported Operation: No resource method found for GET, return 405 with Allow header`

**Root Cause:** The `node-quickbooks` library's GET methods (e.g., `getVendor`, `getBill`, `getEmployee`) are likely using incorrect HTTP methods or endpoints.

| Tool | Error |
|------|-------|
| `get-vendor` | 405 - No resource method found for GET |
| `get-bill` | 500 - operation could not find resource for entity bill |
| `get_bill_payment` | 405 - No resource method found for GET |
| `get_estimate` | 405 - No resource method found for GET |
| `get_journal_entry` | 405 - No resource method found for GET |
| `get_employee` | 405 - No resource method found for GET |
| `get_purchase` | 500 - operation could not find resource for entity purchase |
| `get_tax_code` | 500 - operation could not find resource for entity taxcode |

### ❌ BROKEN - Query Parser Errors

These search tools fail with: `QueryParserError: Encountered ")" at line 1, column XX`

**Root Cause:** The query builder is generating malformed SQL with empty parentheses like `WHERE ()`.

| Tool | Error |
|------|-------|
| `search_invoices` | QueryParserError - malformed query |
| `search_bills` | QueryParserError - malformed query |
| `search_purchases` | QueryParserError - malformed query |
| `search_estimates` | QueryParserError - malformed query |

### ⚠️ PARTIAL ISSUES

| Tool | Issue |
|------|-------|
| `create_invoice` | Works but fails on Canadian tax validation: "Make sure all your transactions have a GST/HST rate before you save" - need to include tax code refs |
| `create-vendor` | SAX Parse error - likely malformed XML request body |
| `read_invoice` | Works but ID 100-101 returned "TxnType does not match" - need valid invoice IDs |

---

## Recommended Fixes

### Priority 1: Fix Parameter Extraction Bug (Critical)

All tool handlers that define nested schemas need to extract from `args.params`:

**Current (broken):**
```typescript
const toolHandler = async (args: Record<string, unknown>) => {
  const typedArgs = args as ToolInput;
  const input = typedArgs.customer;  // ❌ undefined
```

**Fixed:**
```typescript
const toolHandler = async (args: Record<string, unknown>) => {
  const params = (args as { params?: ToolInput }).params;
  if (!params) {
    return { content: [{ type: "text" as const, text: "Error: Missing params" }] };
  }
  const input = params.customer;  // ✅ Works
```

### Priority 2: Fix GET Operations

Investigate the `node-quickbooks` library's GET methods. The error suggests they may be using incorrect HTTP methods. Consider:
1. Using query-based lookups instead (e.g., `SELECT * FROM Vendor WHERE Id = 'x'`)
2. Checking if the library version is outdated
3. Implementing custom GET handlers using raw API calls

### Priority 3: Fix Query Builder

The query builder is generating malformed SQL when no filters are provided. Ensure:
1. Empty WHERE clauses are omitted entirely
2. The query builder handles edge cases with empty filter arrays

---

## Test Data Created

| Entity | ID | Name | Notes |
|--------|----|----- |-------|
| Account | 1150040001 | Test Expense Account MCP | Created successfully |
| Item | 28 | MCP Test Service | Created successfully, $150 service |

---

## Files Requiring Changes

Based on grep analysis, these files need the `args.params` extraction fix:

1. `src/tools/create-customer.tool.ts`
2. `src/tools/create-estimate.tool.ts`
3. `src/tools/create-journal-entry.tool.ts`
4. `src/tools/create-bill.tool.ts`
5. `src/tools/create-purchase.tool.ts`
6. `src/tools/create-vendor.tool.ts`
7. `src/tools/update-account.tool.ts`
8. `src/tools/update-customer.tool.ts`
9. `src/tools/update-estimate.tool.ts`
10. `src/tools/update-bill.tool.ts`
11. `src/tools/update-employee.tool.ts`
12. `src/tools/update-item.tool.ts`
13. `src/tools/update-journal-entry.tool.ts`
14. `src/tools/update-invoice.tool.ts`
15. `src/tools/update-bill-payment.tool.ts`
16. `src/tools/update-purchase.tool.ts`
17. `src/tools/delete-customer.tool.ts`
18. `src/tools/delete-estimate.tool.ts`
19. `src/tools/delete-bill.tool.ts`
20. `src/tools/delete-journal-entry.tool.ts`
21. `src/tools/delete-bill-payment.tool.ts`
22. `src/tools/delete-purchase.tool.ts`
23. `src/tools/delete-vendor.tool.ts`
24. `src/tools/search-invoices.tool.ts`
25. `src/tools/search-bills.tool.ts`
26. `src/tools/search-purchases.tool.ts`
27. `src/tools/search-estimates.tool.ts`

---

## Conclusion

The QuickBooks MCP server has solid foundational architecture but suffers from an inconsistent parameter extraction pattern across tools. The fix is straightforward - all handlers need to extract `args.params` before accessing nested properties. The GET operation failures suggest library-level issues that may require deeper investigation or alternative implementation approaches.
