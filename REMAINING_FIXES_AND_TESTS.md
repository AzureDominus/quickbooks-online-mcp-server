# Remaining Fixes + Testing Checklist (Agent Handoff)

Date: 2026-02-01

This is a handoff doc for the next agent working on the **QuickBooks Online MCP server** repo.

Scope: what’s still worth fixing or re-testing after the JSON-output normalization work.

---

## TL;DR

- Tool outputs were normalized so `mcporter call ... --output json` and the generated CLI are **jq-friendly** (single JSON payload, no human prefixes).
- **Count mode** (`{"count": true}`) was fixed in the server (see `PARSING_ISSUES.md` + `docs/mcporter-json-output.md`).
- The main remaining pain point is **mcporter itself**: on **input validation errors**, `--output json` can emit **non-JSON** and exit code **0**, which breaks pipelines.

---

## 1) What’s still “broken” / risky

### A) mcporter validation errors are not valid JSON (UPSTREAM)

**Symptom**
- When you accidentally pass the wrong type (common: IDs as numbers instead of strings), `mcporter --output json` may print something like a JS-ish object (`{ content: [ ... ], isError: true }`), not strict JSON.
- It also often exits **0**, so `jq` fails but your shell pipeline might not.

**Repro** (example)
```bash
# This tends to trigger schema validation error because id is numeric
mcporter call QuickBooks.get_customer id:83 --output json | jq .
```

**Workaround (recommended)**
```bash
# Force types explicitly (IDs as strings)
mcporter call QuickBooks.get_customer --args '{"id":"83"}' --output json | jq .
```

**Desired fix (in mcporter, not this repo)**
- For `--output json`, always emit strict JSON (even for errors), and return a **non-zero** exit code when `isError:true`.

### B) Create tool outputs: default raw, optional envelope

This repo’s normalization goal is: **JSON-only, single payload**.

By default, `create_*` tools return the created entity **directly** (raw), while **idempotency hits** return:

```json
{ "Id": "123", "wasIdempotent": true }
```

This is convenient for `jq '.Id'` in the common case, but it is a caller gotcha if you expect one stable output shape.

#### Non-breaking consistency option: `responseFormat: "envelope"`

All `create_*` tools accept an optional `responseFormat`:

- `responseFormat: "raw"` (default) → preserves existing output
- `responseFormat: "envelope"` → returns a stable wrapper:

```json
{
  "entityType": "Vendor",
  "entity": { /* created object (or transformed object for Purchase) */ },
  "meta": {
    "id": "123",
    "wasIdempotent": false
  }
}
```

For idempotency hits, `envelope` returns the same wrapper with `meta.wasIdempotent: true`.

---

## 2) What’s left to test (manual smoke test)

Even though there are integration tests, the safest “agent-style” verification is still: run **every tool once** against sandbox and confirm output is JSON.

### A) Prereqs / environment

- **Build requirement**: `mcporter` runs `dist/index.js` and `dist/` is gitignored.
  - After pulling changes: run `npm run build`.
  - Or use the wrapper if present: `bin/quickbooks-mcp`.

- OAuth token storage: `~/.config/quickbooks-mcp/tokens.json` (encrypted)
- OAuth callback port: `8765` (if using that setup)

### B) Tool inventory

To list tool names from schema:
```bash
mcporter list QuickBooks --schema --json > /tmp/qbo_tools.json
jq -r '.tools[].name' /tmp/qbo_tools.json
```

### C) “Try every tool” checklist (recommended order)

Core:
- `health_check`

Master data CRUD:
- Customers: `create_customer`, `get_customer`, `update_customer`, `delete_customer`, `search_customers`
- Vendors: `create_vendor`, `get_vendor`, `update_vendor`, `delete_vendor`, `search_vendors`
- Items: `create_item`, `read_item`, `update_item`, `search_items`

Sales:
- Estimates: `create_estimate`, `get_estimate`, `update_estimate`, `delete_estimate`, `search_estimates`
- Invoices: `create_invoice`, `read_invoice`, `update_invoice`, `search_invoices`

Expenses:
- Bills: `create_bill`, `get_bill`, `update_bill`, `delete_bill`, `search_bills`
- Purchases: `create_purchase`, `get_purchase`, `update_purchase`, `delete_purchase`, `search_purchases`

Payroll / accounting:
- Employees: `create_employee`, `get_employee`, `update_employee`, `search_employees`
- Journal entries: `create_journal_entry`, `get_journal_entry`, `update_journal_entry`, `delete_journal_entry`, `search_journal_entries`
- Bill payments: `create_bill_payment`, `get_bill_payment`, `update_bill_payment`, `delete_bill_payment`, `search_bill_payments`

Attachments:
- `upload_attachment`, `get_attachments`, `download_attachment`

### D) Key gotchas during testing

- **Use `--args` for anything with an ID**, and keep IDs as **strings**.
  - Example: `--args '{"id":"83"}'`

- **Canada sandbox tax requirement**: invoices/estimates/bills may require tax codes.
  - If you see: “Make sure all your transactions have a GST/HST rate…”, add a tax code ref.

- Count mode should be tested for a few endpoints:
```bash
mcporter call QuickBooks.search_customers --args '{"count":true}' --output json | jq -r '.count'
mcporter call QuickBooks.search_vendors --args '{"count":true}' --output json | jq -r '.count'
mcporter call QuickBooks.search_invoices --args '{"count":true}' --output json | jq -r '.count'
mcporter call QuickBooks.search_items --args '{"count":true}' --output json | jq -r '.count'
```

---

## 3) Where to find prior smoke-test artifacts

Prior runs often produced `/tmp/qbo_*.json` artifacts (create/get/update/delete payload captures).
If you’re on the same machine, check:

```bash
ls -la /tmp | grep -E '^qbo_'
```

Typical useful ones:
- `/tmp/qbo_tools.json` (tool schema dump)
- `/tmp/qbo_executed.txt` (partial executed list)
- `/tmp/qbo-tested.txt` (full tool name list)

---

## 4) Repo docs to read first

- `PARSING_ISSUES.md` (root): output contract + build caveat
- `docs/mcporter-json-output.md`: details of count-mode + JSON normalization
