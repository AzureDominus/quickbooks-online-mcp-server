# Upstream issue draft: mcporter `--output json` is not strict JSON on validation errors

Date: 2026-02-01

This repo generally ensures tool **success** outputs are jq-friendly (single JSON payload). However, there is still an upstream rough edge in **mcporter itself**:

- On **input/schema validation errors** (`MCP error -32602`), `mcporter --output json` can emit output that is **not strict JSON**.
- It may also exit with status code **0**, even though the payload is an error.

This breaks automation that expects:
- JSON on stdout when `--output json` is requested, and
- non-zero exit codes on failure.

---

## Draft issue report (do not file from this repo)

### Title
`--output json` prints non-JSON on validation/MCP errors and exits with code 0

### Environment
- mcporter: `0.7.3`
- Node: `v25.5.0`
- OS: Linux (Ubuntu kernel `6.8.0-90-generic`)
- Repro server: QuickBooks Online MCP server (stdio)

### Repro steps

1) Call a tool successfully (control):

```bash
mcporter --config /home/timmy/claw-spaces/don/config/mcporter.json \
  call QuickBooks.health_check --output json

echo "exit=$?"
```

**Expected/Actual:** stdout is valid JSON; exit code is 0.

2) Trigger a schema validation error (wrong type):

```bash
mcporter --config /home/timmy/claw-spaces/don/config/mcporter.json \
  call QuickBooks.search_customers limit=foo --output json

echo "exit=$?"
```

**Actual:**
- exit code is **0**
- stdout is **not valid JSON** (JS-ish object literal formatting; unquoted keys, single quotes)
- stderr is empty

### Expected behavior
When `--output json` is requested:
- stdout should always be strict JSON (even for error responses), and
- process exit code should be non-zero for failures.

### Why it matters
In scripts/CI, users commonly do:

```bash
mcporter call ... --output json | jq .
```

If the tool call fails, the pipeline may break in surprising ways (parse errors), and the overall command can still look "successful" because the CLI exits 0.

---

## Local mitigations in this repo

- Prefer `--args` (JSON) for IDs and typed fields, keeping IDs as strings.
- For scripting/CI, use:
  - `set -o pipefail`
  - `jq -e` to fail on non-JSON
- Optionally wrap with `bin/strict-json` to:
  - ensure stdout is JSON, and
  - return non-zero if the parsed payload contains `{ "isError": true }`.

Example:

```bash
set -o pipefail
bin/strict-json mcporter call QuickBooks.search_customers limit=foo --output json | jq -e .
```
