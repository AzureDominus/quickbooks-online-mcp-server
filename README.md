# QuickBooks Online MCP Server

A production-ready Model Context Protocol (MCP) server for QuickBooks Online integration with advanced features for reliability and observability.

## Features

- **Full CRUD Operations**: Create, Read, Update, Delete for all major QBO entities
- **Idempotency Support**: Prevent duplicate transactions with idempotency keys
- **Structured Logging**: JSON logging with timing and configurable log levels
- **Advanced Search**: Filter by date ranges, amounts, vendors, and more
- **Type Validation**: Zod schemas ensure correct input format and helpful error messages
- **Attachment Support**: Upload and download receipts and documents

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```env
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_ENVIRONMENT=sandbox
```

3. Get your Client ID and Client Secret:
   - Go to the [Intuit Developer Portal](https://developer.intuit.com/)
   - Create a new app or select an existing one
   - Get the Client ID and Client Secret from the app's keys section
   - Add `http://localhost:8000/callback` to the app's Redirect URIs

## Authentication

There are two ways to authenticate with QuickBooks Online:

### Option 1: Using Environment Variables

If you already have a refresh token and realm ID, you can add them directly to your `.env` file:

```env
QUICKBOOKS_REFRESH_TOKEN=your_refresh_token
QUICKBOOKS_REALM_ID=your_realm_id
```

### Option 2: Using the OAuth Flow

If you don't have a refresh token, you can use the built-in OAuth flow:

This will:
- Start a temporary local server
- Open your default browser automatically
- Redirect you to QuickBooks for authentication
- Save the tokens to your `.env` file once authenticated
- Close automatically when complete

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `QUICKBOOKS_CLIENT_ID` | OAuth Client ID | Required |
| `QUICKBOOKS_CLIENT_SECRET` | OAuth Client Secret | Required |
| `QUICKBOOKS_ENVIRONMENT` | `sandbox` or `production` | `sandbox` |
| `QUICKBOOKS_REFRESH_TOKEN` | OAuth Refresh Token | Optional |
| `QUICKBOOKS_REALM_ID` | Company/Realm ID | Optional |
| `LOG_LEVEL` | Logging level: `DEBUG`, `INFO`, `WARN`, `ERROR` | `INFO` |
| `NODE_ENV` | Environment: `development` or `production` | `development` |
| `IDEMPOTENCY_TTL_MS` | Idempotency key TTL in milliseconds | `86400000` (24h) |
| `IDEMPOTENCY_STORAGE_PATH` | Path to idempotency storage file | `~/.config/quickbooks-mcp/idempotency.json` |

## Available Tools

CRUD operations for the following entities:

- Account
- Bill Payment
- Bill
- Customer
- Employee
- Estimate
- Invoice
- Item
- Journal Entry
- Purchase
- Vendor
- Tax Code (read/search)
- Attachments (upload/download)

## Production Features

### Idempotency Support

Prevent duplicate transactions when retrying failed requests. Pass an `idempotencyKey` parameter when creating entities:

```json
{
  "txnDate": "2026-01-31",
  "paymentType": "CreditCard",
  "paymentAccountId": "41",
  "vendorId": "56",
  "lines": [
    {
      "amount": 45.99,
      "expenseAccountId": "13",
      "description": "Office supplies"
    }
  ],
  "idempotencyKey": "order-12345-purchase"
}
```

**How it works:**
- Keys are stored locally and expire after 24 hours (configurable via `IDEMPOTENCY_TTL_MS`)
- If the same key is used again, the previously created entity ID is returned
- The response includes `wasIdempotent: true` when returning a cached result
- Keys should be unique per transaction (e.g., based on order ID, invoice number, etc.)

### Structured Logging

The server provides JSON-structured logging with timing information for observability:

```json
{
  "timestamp": "2026-01-31T10:15:30.123Z",
  "level": "INFO",
  "message": "Purchase created successfully",
  "context": {
    "entityId": "1234",
    "paymentType": "CreditCard"
  },
  "duration_ms": 245
}
```

**Log Levels:**
- `DEBUG`: Detailed debugging information
- `INFO`: General operational information
- `WARN`: Warning conditions
- `ERROR`: Error conditions

Configure via `LOG_LEVEL` environment variable. In production (`NODE_ENV=production`), logs are output as JSON. In development, logs use colorized pretty formatting.

### Advanced Search

Search endpoints support rich filtering options:

#### Date Range Filtering
```json
{
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31"
}
```

#### Amount Range Filtering
```json
{
  "minAmount": 100,
  "maxAmount": 500
}
```

#### Entity Filtering
```json
{
  "vendorId": "56",
  "paymentAccountId": "41",
  "paymentType": "CreditCard"
}
```

#### Text Search
```json
{
  "text": "office supplies"
}
```

#### Combined Filters with Sorting and Pagination
```json
{
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31",
  "minAmount": 50,
  "vendorId": "56",
  "desc": "TxnDate",
  "limit": 25,
  "offset": 0
}
```

#### Raw Criteria (Advanced)
For complex queries, use the raw criteria format with operators:
```json
{
  "criteria": [
    { "field": "TotalAmt", "value": 100, "operator": ">=" },
    { "field": "TxnDate", "value": "2026-01-01", "operator": ">=" },
    { "field": "DocNumber", "value": "INV%", "operator": "LIKE" }
  ]
}
```

**Supported operators:** `=`, `<`, `>`, `<=`, `>=`, `LIKE`, `IN`

### Type Validation

All inputs are validated using Zod schemas, providing:

- **Type safety**: Ensures correct data types for all fields
- **Helpful errors**: Clear messages explaining what's wrong
- **Field descriptions**: Self-documenting API parameters
- **Format validation**: Dates must be `YYYY-MM-DD`, emails must be valid, etc.

Example validation error:
```json
{
  "isError": true,
  "error": "Validation error: txnDate must match YYYY-MM-DD format"
}
```

## Usage Examples

### Creating a Purchase with Idempotency

```json
{
  "tool": "create_purchase",
  "params": {
    "txnDate": "2026-01-31",
    "paymentType": "CreditCard",
    "paymentAccountId": "41",
    "vendorId": "56",
    "lines": [
      {
        "amount": 125.50,
        "expenseAccountId": "13",
        "description": "Monthly software subscription"
      }
    ],
    "memo": "January subscription",
    "idempotencyKey": "subscription-jan-2026"
  }
}
```

### Searching Purchases by Date and Amount Range

```json
{
  "tool": "search_purchases",
  "params": {
    "dateFrom": "2026-01-01",
    "dateTo": "2026-01-31",
    "minAmount": 100,
    "maxAmount": 1000,
    "paymentType": "CreditCard",
    "desc": "TxnDate",
    "limit": 50
  }
}
```

### Searching with Text Filter

```json
{
  "tool": "search_purchases",
  "params": {
    "text": "software",
    "dateFrom": "2026-01-01"
  }
}
```

## Error Handling

If you see an error message like "QuickBooks not connected", make sure to:

1. Check that your `.env` file contains all required variables
2. Verify that your tokens are valid and not expired
3. Check the logs for detailed error information (set `LOG_LEVEL=DEBUG` for more details)
