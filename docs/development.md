# Development Guide

This guide is for contributors who want to add features, fix bugs, or improve the QuickBooks MCP Server.

## Table of Contents

- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [How to Add New Tools](#how-to-add-new-tools)
- [Testing Approach](#testing-approach)
- [Code Style Guidelines](#code-style-guidelines)
- [Pull Request Process](#pull-request-process)

## Project Structure

```
quickbooks-online-mcp-server/
├── src/
│   ├── index.ts              # Main entry point, MCP server setup
│   ├── clients/
│   │   └── quickbooks-client.ts  # QuickBooks API client, OAuth handling
│   ├── handlers/
│   │   └── *.handler.ts      # Request handlers for each tool
│   ├── helpers/
│   │   ├── build-quickbooks-search-criteria.ts  # Query builder
│   │   ├── format-error.ts   # Error formatting
│   │   ├── idempotency.ts    # Idempotency key management
│   │   ├── logger.ts         # Structured logging
│   │   ├── register-tool.ts  # Tool registration helper
│   │   └── transform.ts      # Data transformation utilities
│   ├── server/               # MCP server configuration
│   ├── tests/
│   │   ├── unit/             # Unit tests
│   │   ├── integration/      # Integration tests
│   │   └── fixtures/         # Test fixtures
│   ├── tools/
│   │   └── *.tool.ts         # Tool definitions with Zod schemas
│   └── types/
│       ├── qbo-schemas.ts    # Zod schemas for QBO entities
│       ├── tool-definition.ts # Tool type definitions
│       └── tool-response.ts  # Response type definitions
├── docs/                     # Documentation
├── dist/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── .env                      # Environment variables (not in git)
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `tools/*.tool.ts` | Define available MCP tools with Zod schemas |
| `handlers/*.handler.ts` | Handle tool execution, call QuickBooks API |
| `clients/quickbooks-client.ts` | OAuth flow, API calls, token management |
| `helpers/` | Shared utilities (logging, idempotency, etc.) |
| `types/` | TypeScript types and Zod schemas |

## Development Setup

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- A QuickBooks Developer account (for integration testing)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/quickbooks-online-mcp-server.git
cd quickbooks-online-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Copy environment template
cp .env.example .env
# Edit .env with your credentials
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run watch` | Compile and watch for changes |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests only |
| `npm run lint` | Check code style |
| `npm run lint:fix` | Fix code style issues |

## How to Add New Tools

### Step 1: Create the Tool Definition

Create a new file in `src/tools/`:

```typescript
// src/tools/my-new-entity.tool.ts
import { z } from 'zod';
import type { ToolDefinition } from '../types/tool-definition.js';

// Define input schema with Zod
const MyNewEntityInputSchema = z.object({
  id: z.string().describe('Entity ID'),
  name: z.string().optional().describe('Entity name'),
});

// Export the tool definition
export const myNewEntityTool: ToolDefinition = {
  name: 'my_new_entity',
  description: 'Description of what this tool does',
  inputSchema: MyNewEntityInputSchema,
};

// Export the schema type for use in handler
export type MyNewEntityInput = z.infer<typeof MyNewEntityInputSchema>;
```

### Step 2: Create the Handler

Create a new file in `src/handlers/`:

```typescript
// src/handlers/my-new-entity.handler.ts
import type { MyNewEntityInput } from '../tools/my-new-entity.tool.js';
import { getQuickBooksClient } from '../clients/quickbooks-client.js';
import { logger } from '../helpers/logger.js';
import { formatError } from '../helpers/format-error.js';
import type { ToolResponse } from '../types/tool-response.js';

export async function handleMyNewEntity(
  args: MyNewEntityInput
): Promise<ToolResponse> {
  const startTime = Date.now();
  
  try {
    const qbo = await getQuickBooksClient();
    
    // Call QuickBooks API
    const result = await new Promise((resolve, reject) => {
      qbo.getMyEntity(args.id, (err: Error | null, entity: unknown) => {
        if (err) reject(err);
        else resolve(entity);
      });
    });
    
    logger.info('Entity retrieved', {
      entityId: args.id,
      duration_ms: Date.now() - startTime,
    });
    
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    logger.error('Failed to get entity', {
      entityId: args.id,
      error: formatError(error),
      duration_ms: Date.now() - startTime,
    });
    
    return {
      content: [{ type: 'text', text: `Error: ${formatError(error)}` }],
      isError: true,
    };
  }
}
```

### Step 3: Register the Tool

Add to `src/index.ts`:

```typescript
import { myNewEntityTool } from './tools/my-new-entity.tool.js';
import { handleMyNewEntity } from './handlers/my-new-entity.handler.js';

// In the tools array
const tools = [
  // ... existing tools
  myNewEntityTool,
];

// In the handler switch/map
case 'my_new_entity':
  return handleMyNewEntity(args);
```

### Step 4: Add Tests

Create tests in `src/tests/`:

```typescript
// src/tests/unit/my-new-entity.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { myNewEntityTool } from '../../tools/my-new-entity.tool.js';

describe('my_new_entity tool', () => {
  it('has correct name', () => {
    assert.strictEqual(myNewEntityTool.name, 'my_new_entity');
  });
  
  it('validates required fields', () => {
    const result = myNewEntityTool.inputSchema.safeParse({});
    assert.strictEqual(result.success, false);
  });
});
```

## Testing Approach

### Test Structure

```
src/tests/
├── unit/                  # Fast, no external dependencies
│   ├── idempotency.test.ts
│   ├── logger.test.ts
│   ├── transform.test.ts
│   └── schemas.test.ts
├── integration/           # Require QuickBooks connection
│   ├── purchase.test.ts
│   ├── vendor.test.ts
│   └── ...
└── fixtures/             # Test data
```

### Running Tests

```bash
# All tests
npm test

# Unit tests only (fast, no credentials needed)
npm run test:unit

# Integration tests (requires QuickBooks credentials)
npm run test:integration
```

### Writing Good Tests

1. **Unit tests** should be fast and not require external services
2. **Integration tests** should clean up after themselves
3. Use descriptive test names
4. Test both success and error cases

### Integration Test Requirements

Integration tests require:
- Valid QuickBooks OAuth credentials in `.env`
- Access to a QuickBooks sandbox company
- Network connectivity

## Code Style Guidelines

### TypeScript

- Use strict TypeScript (`"strict": true` in tsconfig)
- Prefer `const` over `let`
- Use explicit return types for functions
- Avoid `any` - use `unknown` and type guards instead

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `create-purchase.tool.ts` |
| Variables | camelCase | `purchaseId` |
| Types/Interfaces | PascalCase | `PurchaseInput` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_LIMIT` |

### Zod Schemas

- Always add `.describe()` to fields for self-documentation
- Use specific types (`z.string().email()`) over generic ones
- Export schema types for reuse

```typescript
const MySchema = z.object({
  email: z.string().email().describe('Customer email address'),
  amount: z.number().positive().describe('Transaction amount'),
});
```

### Error Handling

- Always catch and log errors
- Return structured error responses
- Include helpful context in error messages

```typescript
try {
  // operation
} catch (error) {
  logger.error('Operation failed', { context, error: formatError(error) });
  return { content: [...], isError: true };
}
```

### Logging

Use the structured logger:

```typescript
import { logger } from '../helpers/logger.js';

logger.debug('Detailed info', { data });
logger.info('Operation completed', { entityId, duration_ms });
logger.warn('Unusual condition', { warning });
logger.error('Operation failed', { error: formatError(error) });
```

## Pull Request Process

### Before Submitting

1. **Run the build**
   ```bash
   npm run build
   ```

2. **Run linting**
   ```bash
   npm run lint:fix
   ```

3. **Run tests**
   ```bash
   npm test
   ```

4. **Update documentation** if adding new features

### PR Guidelines

1. **Title**: Use clear, descriptive titles
   - Good: "Add support for Credit Memo entity"
   - Bad: "New feature"

2. **Description**: Explain what and why
   - What does this change do?
   - Why is it needed?
   - Any breaking changes?

3. **Size**: Keep PRs focused
   - One feature or fix per PR
   - Split large changes into multiple PRs

4. **Tests**: Include tests for new functionality

### Review Process

1. All PRs require at least one approval
2. CI must pass (build, lint, tests)
3. Resolve all review comments
4. Squash commits on merge

---

## Resources

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [QuickBooks API Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities)
- [Zod Documentation](https://zod.dev/)
- [Node.js Test Runner](https://nodejs.org/api/test.html)
