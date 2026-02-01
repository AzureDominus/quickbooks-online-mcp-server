# Parsing Issues Tracker

This document tracks JSON output normalization issues for the QuickBooks MCP server.

---

## IMPORTANT: Build Requirement

> **mcporter and the generated CLI run `dist/index.js`, and `dist/` is gitignored.**
>
> After switching branches or pulling new changes, you **MUST** either:
>
> 1. Run `npm run build` to compile TypeScript to `dist/`, **OR**
> 2. Use the auto-build wrapper script: `bin/quickbooks-mcp` (if available)
>
> Without this step, you will be running stale code from a previous build!

---

## Issue Status Summary

| Tool / Feature     | Status    | Notes                                                  |
| ------------------ | --------- | ------------------------------------------------------ |
| `search_vendors`   | **FIXED** | Returns `{count, vendors}` - requires `npm run build`  |
| `search_tax_codes` | **FIXED** | Returns `{count, taxCodes}` - requires `npm run build` |
| `search_items`     | **FIXED** | Returns `{count, items}` - requires `npm run build`    |
| `count:true` mode  | **FIXED** | Returns `{count}` for all search\_\* tools             |

---

## Details

### search_vendors (FIXED)

**Before:** Returned multiple content chunks (one per vendor) with a human-readable prefix.

**After:** Returns a single JSON object:

```json
{"count": 5, "vendors": [...]}
```

**Source:** `src/tools/search-vendors.tool.ts` (lines 121-129)

---

### search_tax_codes (FIXED)

**Before:** Returned multiple content chunks with human-readable prefix.

**After:** Returns a single JSON object:

```json
{"count": 3, "taxCodes": [...]}
```

**Source:** `src/tools/search-tax-codes.tool.ts` (lines 101-109)

---

### search_items (FIXED)

**Before:** Returned unparseable or inconsistent output.

**After:** Returns a single JSON object:

```json
{"count": 10, "items": [...]}
```

**Source:** `src/tools/search-items.tool.ts` (lines 239-243)

---

### count:true mode (FIXED)

**Before:** `count:true` caused QBO query parse errors for some endpoints (invalid SQL like `count = true` in WHERE clause).

**After:** All search\_\* tools correctly return:

```json
{ "count": 42 }
```

**Root cause & fix:** See `docs/mcporter-json-output.md` for full details on the `buildQuickbooksSearchCriteria` fix.

---

## Verification Checklist

After making changes or switching branches, verify everything works:

### 1. Build the project

```bash
npm run build
```

### 2. Run tests

```bash
npm test
```

### 3. Verify JSON output is parseable by jq

```bash
# Test search_vendors
mcporter call QuickBooks.search_vendors limit:3 --output json | jq .

# Test search_tax_codes
mcporter call QuickBooks.search_tax_codes --output json | jq .

# Test search_items
mcporter call QuickBooks.search_items limit:3 --output json | jq .

# Test count mode
mcporter call QuickBooks.search_invoices count:true --output json | jq .
mcporter call QuickBooks.search_items count:true --output json | jq .
mcporter call QuickBooks.search_customers count:true --output json | jq .
```

All commands should:

- Exit with status 0
- Output valid JSON that jq can parse
- Return objects with expected structure (`{count, <entities>}` or `{count}`)

### 4. Verify with generated CLI (optional)

```bash
cd /path/to/workspace
mcporter generate-cli --server QuickBooks --output ./generated/QuickBooks.ts --bundle ./bin/quickbooks
./bin/quickbooks -o json search-vendors --limit 3 | jq .
```

---

## Related Documentation

- [docs/mcporter-json-output.md](docs/mcporter-json-output.md) - Full technical details on the normalization fix
