# AGENTS.md - QuickBooks Online MCP Server

This document provides guidelines for AI coding agents working in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server for QuickBooks Online integration. It provides CRUD operations for QuickBooks entities (invoices, customers, vendors, bills, etc.) via the MCP SDK.

**Tech Stack:** TypeScript, Node.js 22+, Zod (validation), MCP SDK, node-quickbooks

## Build/Lint/Test Commands

```bash
# Build
npm run build              # Compile TypeScript to dist/

# Lint
npm run lint               # Run ESLint on src/
npm run lint:fix           # Run ESLint with auto-fix

# Format
npm run format             # Format code with Prettier
npm run format:check       # Check formatting without changes

# Test - All tests
npm test                   # Run all tests

# Test - By category
npm run test:unit          # Run only unit tests
npm run test:integration   # Run only integration tests

# Test - Single file (use node directly with glob pattern)
node --test --experimental-strip-types --import tsx src/tests/unit/transform.test.ts
node --test --experimental-strip-types --import tsx src/tests/unit/logger.test.ts

# Test - With coverage
npm run test:coverage      # Run tests with c8 coverage

# Watch mode
npm run watch              # Watch and rebuild TypeScript
```

## Running the MCP Server

When running the MCP server via mcporter, CLI tools, or directly, use the auto-build wrapper script:

```bash
# Preferred method - auto-builds if sources are newer than dist
./bin/quickbooks-mcp

# The script will:
# 1. Check for node_modules (errors if missing, telling you to run npm install)
# 2. Rebuild dist/ if:
#    - dist/index.js is missing
#    - Any src/**/*.ts file is newer than dist/index.js
#    - package.json, package-lock.json, or tsconfig.json is newer
# 3. Run `node dist/index.js` with any passed arguments
```

This is important because `dist/` is gitignored. After switching branches, the compiled JavaScript may be stale even if TypeScript sources are fixed. The script ensures you always run against up-to-date code.

For mcporter configurations, point to `bin/quickbooks-mcp` instead of `dist/index.js`.

When scripting mcporter with `--output json`, consider wrapping calls with `bin/strict-json` (or using `jq -e`) to guard against upstream cases where mcporter emits non-JSON on validation errors and still exits 0.

## Directory Structure

```
src/
├── index.ts              # Entry point - registers all tools
├── server/               # MCP server singleton
├── tools/                # Tool definitions (name, schema, handler)
├── handlers/             # Business logic for each operation
├── clients/              # QuickBooks API client with OAuth
├── helpers/              # Utilities (logging, transforms, errors)
│   └── transforms/       # Entity-specific transform functions
├── types/
│   ├── schemas/          # Zod schemas for each entity
│   └── *.d.ts            # TypeScript type declarations
└── tests/
    ├── unit/             # Unit tests (no API calls)
    └── integration/      # Integration tests (require OAuth)
```

## Code Style Guidelines

### TypeScript Configuration

- Target: ES2020, Module: NodeNext
- Strict mode enabled with all strict checks
- No unused locals/parameters, no implicit returns
- No fallthrough cases in switch statements

### Formatting (Prettier)

- Semicolons: always
- Single quotes for strings
- Tab width: 2 spaces
- Trailing commas: es5
- Print width: 100 characters
- Bracket spacing: true

### ESLint Rules

- `@typescript-eslint/no-unused-vars`: warn (ignore args starting with `_`)
- `@typescript-eslint/no-explicit-any`: warn
- `no-console`: warn (except `console.error`)

### Import Conventions

- Use `.js` extension in imports (required for NodeNext module resolution)
- Order: external packages first, then local imports
- Group imports by category with comments for large files

```typescript
// External
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Internal
import { logger } from '../helpers/logger.js';
import { ToolDefinition } from '../types/tool-definition.js';
```

### Naming Conventions

- **Files:** kebab-case with descriptive suffixes
  - Tools: `create-customer.tool.ts`
  - Handlers: `create-quickbooks-customer.handler.ts`
  - Schemas: `customer.schema.ts`
  - Tests: `customer.test.ts`
- **Classes:** PascalCase (e.g., `QuickbooksMCPServer`)
- **Functions:** camelCase (e.g., `createQuickbooksCustomer`)
- **Constants:** UPPER_SNAKE_CASE for env vars, camelCase for others
- **Types/Interfaces:** PascalCase (e.g., `ToolDefinition`, `CreateCustomerInput`)
- **Zod schemas:** PascalCase with Schema suffix (e.g., `CreateCustomerInputSchema`)

### Tool Definition Pattern

Tools follow a consistent structure:

```typescript
import { z } from 'zod';
import { ToolDefinition } from '../types/tool-definition.js';
import { someHandler } from '../handlers/some.handler.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';

const toolName = 'tool_name'; // snake_case
const toolDescription = `Description with examples...`;

const toolSchema = z.object({
  fieldName: z.string().describe('Field description'),
});

type ToolInput = z.infer<typeof toolSchema>;

const toolHandler = async (args: Record<string, unknown>) => {
  const startTime = Date.now();
  const typedArgs = args as ToolInput;

  logToolRequest(toolName, typedArgs);

  try {
    const response = await someHandler(typedArgs);

    if (response.isError) {
      logToolResponse(toolName, false, Date.now() - startTime);
      return {
        content: [{ type: 'text' as const, text: `Error: ${response.error}` }],
      };
    }

    logToolResponse(toolName, true, Date.now() - startTime);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(response.result) }],
    };
  } catch (error) {
    logger.error('Unexpected error', error);
    logToolResponse(toolName, false, Date.now() - startTime);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
};

export const SomeToolName: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
```

### Handler Pattern

Handlers interact with the QuickBooks client:

```typescript
import { quickbooksClient } from '../clients/quickbooks-client.js';
import { ToolResponse } from '../types/tool-response.js';
import { formatError } from '../helpers/format-error.js';

export async function someHandler(data: SomeInput): Promise<ToolResponse<SomeOutput>> {
  try {
    await quickbooksClient.authenticate();
    const quickbooks = quickbooksClient.getQuickbooks();

    return new Promise((resolve) => {
      quickbooks.someMethod(data, (err: any, result: any) => {
        if (err) {
          resolve({ result: null, isError: true, error: formatError(err) });
        } else {
          resolve({ result, isError: false, error: null });
        }
      });
    });
  } catch (error) {
    return { result: null, isError: true, error: formatError(error) };
  }
}
```

### Error Handling

- Use `ToolResponse<T>` type with `isError` flag for handler returns
- Format errors consistently with `formatError()` helper
- Log errors with context using the structured logger
- Never throw from tool handlers; always return error responses

### Testing Conventions

- Use Node.js built-in test runner (`node:test`)
- Use `node:assert/strict` for assertions
- Tests follow describe/it pattern
- Integration tests check for OAuth config before running

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Feature Name', () => {
  it('should do something', () => {
    const result = someFunction(input);
    assert.equal(result.field, expectedValue);
    assert.ok(result.success);
  });
});
```

### Zod Schema Conventions

- Define schemas in `src/types/schemas/` by entity
- Use `.describe()` for all fields to generate good tool descriptions
- Export both schema and inferred type
- Use common schemas for shared patterns (addresses, emails, etc.)

```typescript
export const CreateEntityInputSchema = z.object({
  requiredField: z.string().min(1).describe('Description (required)'),
  optionalField: z.string().optional().describe('Description'),
});

export type CreateEntityInput = z.infer<typeof CreateEntityInputSchema>;
```

## Key Files to Understand

- `src/index.ts` - Entry point, tool registration
- `src/types/tool-definition.ts` - Tool interface definition
- `src/helpers/register-tool.ts` - Tool registration helper
- `src/helpers/logger.ts` - Structured logging utilities
- `src/clients/quickbooks-client.ts` - OAuth and API client
- `src/types/schemas/common.schema.ts` - Shared Zod schemas

## Environment Variables

Required for operation:

- `QUICKBOOKS_CLIENT_ID` - OAuth Client ID
- `QUICKBOOKS_CLIENT_SECRET` - OAuth Client Secret

Optional:

- `QUICKBOOKS_ENVIRONMENT` - `sandbox` or `production` (default: sandbox)
- `LOG_LEVEL` - DEBUG, INFO, WARN, ERROR (default: INFO)
- `NODE_ENV` - development or production

## Pre-commit Hooks

The project uses Husky with lint-staged:

- ESLint auto-fix runs on staged `.ts` files
- Prettier formats staged `.ts` files
