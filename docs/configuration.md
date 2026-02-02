# Configuration Reference

This document provides a comprehensive reference for all environment variables and configuration options.

## Table of Contents

- [Quick Start](#quick-start)
- [OAuth Configuration](#oauth-configuration)
- [Environment Settings](#environment-settings)
- [Profile-based Configuration](#profile-based-configuration)
- [Logging Configuration](#logging-configuration)
- [Idempotency Settings](#idempotency-settings)
- [Example Configurations](#example-configurations)

## Quick Start

Create a `.env` file in the project root:

```env
# Minimum required configuration
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_ENVIRONMENT=sandbox
```

If you prefer profile-based configuration, see [Profile-based Configuration](#profile-based-configuration).

## Profile-based Configuration

The server supports profile-based config files for easy switching between environments and companies.

Default locations:

- Non-secrets: `~/.config/quickbooks-mcp/config.json`
- Secrets: `~/.config/quickbooks-mcp/secrets.json`

Select a profile with:

```env
QUICKBOOKS_PROFILE=sandbox-test
```

Optional overrides:

```env
QUICKBOOKS_CONFIG_PATH=/custom/path/config.json
QUICKBOOKS_SECRETS_PATH=/custom/path/secrets.json
```

Example `config.json`:

```json
{
  "defaultProfile": "sandbox-test",
  "profiles": {
    "sandbox-test": {
      "environment": "sandbox",
      "realmId": "1234567890123456",
      "companyName": "Testing Sandbox Company",
      "tokenPath": "~/.config/quickbooks-mcp/tokens/sandbox-test.json",
      "allowProductionWrites": false
    },
    "production-main": {
      "environment": "production",
      "realmId": "9999999999999999",
      "companyName": "Production Main Company",
      "tokenPath": "~/.config/quickbooks-mcp/tokens/production-main.json",
      "allowProductionWrites": false
    }
  }
}
```

Example `secrets.json`:

```json
{
  "profiles": {
    "sandbox-test": {
      "clientId": "your_sandbox_client_id",
      "clientSecret": "your_sandbox_client_secret",
      "refreshToken": "your_sandbox_refresh_token"
    },
    "production-main": {
      "clientId": "your_production_client_id",
      "clientSecret": "your_production_client_secret",
      "refreshToken": "your_production_refresh_token"
    }
  }
}
```

Notes:

- Existing `QUICKBOOKS_*` env vars still override profile settings.
- Tokens are stored per profile via `tokenPath`.
- For production writes, set `allowProductionWrites=true` in the profile and
  `QUICKBOOKS_ALLOW_PRODUCTION_WRITES=1` in the environment.
- You can inspect the resolved config with the `get_current_config` tool.

## OAuth Configuration

### QUICKBOOKS_CLIENT_ID

| Property | Value  |
| -------- | ------ |
| Required | Yes    |
| Type     | String |
| Default  | None   |

Your OAuth 2.0 Client ID from the Intuit Developer Portal.

```env
QUICKBOOKS_CLIENT_ID=ABcXYZ123456789
```

**How to get it**: Go to [developer.intuit.com](https://developer.intuit.com/) → Your App → Keys & credentials

---

### QUICKBOOKS_CLIENT_SECRET

| Property | Value  |
| -------- | ------ |
| Required | Yes    |
| Type     | String |
| Default  | None   |

Your OAuth 2.0 Client Secret from the Intuit Developer Portal.

```env
QUICKBOOKS_CLIENT_SECRET=abcd1234secretkey5678
```

> ⚠️ **Security**: Never commit this to version control.

---

### QUICKBOOKS_REFRESH_TOKEN

| Property | Value                        |
| -------- | ---------------------------- |
| Required | No (obtained via OAuth flow) |
| Type     | String                       |
| Default  | None                         |

Pre-configured refresh token. If not provided, the OAuth flow will be triggered automatically.

```env
QUICKBOOKS_REFRESH_TOKEN=AB11...very-long-token...
```

**Note**: Tokens obtained via OAuth flow are stored in the token file, not the `.env`.

---

### QUICKBOOKS_REALM_ID

| Property | Value                        |
| -------- | ---------------------------- |
| Required | No (obtained via OAuth flow) |
| Type     | String                       |
| Default  | None                         |

The QuickBooks company ID (also called Realm ID).

```env
QUICKBOOKS_REALM_ID=1234567890123456
```

**Note**: This is obtained automatically during OAuth and stored in the token file.

---

### QUICKBOOKS_OAUTH_PORT

| Property | Value   |
| -------- | ------- |
| Required | No      |
| Type     | Integer |
| Default  | 8765    |

Port for the OAuth callback server.

```env
QUICKBOOKS_OAUTH_PORT=9000
```

**Note**: Remember to add the corresponding redirect URI to your Intuit app.

---

### QUICKBOOKS_TOKEN_PATH

| Property | Value                                  |
| -------- | -------------------------------------- |
| Required | No                                     |
| Type     | File path                              |
| Default  | `~/.config/quickbooks-mcp/tokens.json` |

Path where OAuth tokens are stored.

```env
QUICKBOOKS_TOKEN_PATH=/home/user/secure/qb-tokens.json
```

## Environment Settings

### QUICKBOOKS_ENVIRONMENT

| Property | Value                              |
| -------- | ---------------------------------- |
| Required | No                                 |
| Type     | String (`sandbox` or `production`) |
| Default  | `sandbox`                          |

QuickBooks API environment.

```env
QUICKBOOKS_ENVIRONMENT=sandbox
```

| Value        | API Endpoint                      | Use Case            |
| ------------ | --------------------------------- | ------------------- |
| `sandbox`    | sandbox-quickbooks.api.intuit.com | Development/testing |
| `production` | quickbooks.api.intuit.com         | Live data           |

---

### NODE_ENV

| Property | Value                                  |
| -------- | -------------------------------------- |
| Required | No                                     |
| Type     | String (`development` or `production`) |
| Default  | `development`                          |

Node.js environment, affects logging format.

```env
NODE_ENV=production
```

| Value         | Log Format                |
| ------------- | ------------------------- |
| `development` | Colorized, human-readable |
| `production`  | JSON structured           |

## Logging Configuration

### LOG_LEVEL

| Property | Value  |
| -------- | ------ |
| Required | No     |
| Type     | String |
| Default  | `INFO` |

Minimum log level to output.

```env
LOG_LEVEL=DEBUG
```

| Level   | Description                     | Use Case                         |
| ------- | ------------------------------- | -------------------------------- |
| `DEBUG` | Verbose debugging information   | Development troubleshooting      |
| `INFO`  | General operational information | Normal operation                 |
| `WARN`  | Warning conditions              | Unusual but not error conditions |
| `ERROR` | Error conditions                | Failures and exceptions          |

**Log Output Examples**:

Development mode (colorized):

```
[2026-01-31T10:15:30.123Z] INFO: Purchase created successfully {"entityId":"1234"}
```

Production mode (JSON):

```json
{
  "timestamp": "2026-01-31T10:15:30.123Z",
  "level": "INFO",
  "message": "Purchase created successfully",
  "context": { "entityId": "1234" },
  "duration_ms": 245
}
```

## Idempotency Settings

Idempotency prevents duplicate transactions when retrying failed requests.

### IDEMPOTENCY_TTL_MS

| Property | Value                  |
| -------- | ---------------------- |
| Required | No                     |
| Type     | Integer (milliseconds) |
| Default  | `86400000` (24 hours)  |

How long idempotency keys are remembered.

```env
IDEMPOTENCY_TTL_MS=172800000  # 48 hours
```

---

### IDEMPOTENCY_STORAGE_PATH

| Property | Value                                       |
| -------- | ------------------------------------------- |
| Required | No                                          |
| Type     | File path                                   |
| Default  | `~/.config/quickbooks-mcp/idempotency.json` |

Path where idempotency records are stored.

```env
IDEMPOTENCY_STORAGE_PATH=/var/lib/quickbooks-mcp/idempotency.json
```

---

### IDEMPOTENCY_CLEANUP_MS

| Property | Value                  |
| -------- | ---------------------- |
| Required | No                     |
| Type     | Integer (milliseconds) |
| Default  | `3600000` (1 hour)     |

How often expired idempotency keys are cleaned up.

```env
IDEMPOTENCY_CLEANUP_MS=1800000  # 30 minutes
```

## Example Configurations

### Development Setup

Minimal configuration for local development:

```env
# OAuth credentials
QUICKBOOKS_CLIENT_ID=your_sandbox_client_id
QUICKBOOKS_CLIENT_SECRET=your_sandbox_client_secret

# Use sandbox environment
QUICKBOOKS_ENVIRONMENT=sandbox

# Enable debug logging
LOG_LEVEL=DEBUG
NODE_ENV=development
```

### Production Setup

Full configuration for production deployment:

```env
# OAuth credentials
QUICKBOOKS_CLIENT_ID=your_production_client_id
QUICKBOOKS_CLIENT_SECRET=your_production_client_secret

# Use production environment
QUICKBOOKS_ENVIRONMENT=production

# Production logging
LOG_LEVEL=INFO
NODE_ENV=production

# Custom storage paths
QUICKBOOKS_TOKEN_PATH=/var/lib/quickbooks-mcp/tokens.json
IDEMPOTENCY_STORAGE_PATH=/var/lib/quickbooks-mcp/idempotency.json

# Extended idempotency TTL for production
IDEMPOTENCY_TTL_MS=172800000
IDEMPOTENCY_CLEANUP_MS=3600000
```

### CI/CD Testing Setup

Configuration for automated testing:

```env
# Test credentials
QUICKBOOKS_CLIENT_ID=test_client_id
QUICKBOOKS_CLIENT_SECRET=test_client_secret
QUICKBOOKS_REFRESH_TOKEN=test_refresh_token
QUICKBOOKS_REALM_ID=test_realm_id

# Sandbox for testing
QUICKBOOKS_ENVIRONMENT=sandbox

# Minimal logging
LOG_LEVEL=ERROR
NODE_ENV=development

# Short TTLs for testing
IDEMPOTENCY_TTL_MS=60000
IDEMPOTENCY_CLEANUP_MS=30000
```

### Claude Desktop Configuration

Example `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "node",
      "args": ["/path/to/quickbooks-online-mcp-server/dist/index.js"],
      "env": {
        "QUICKBOOKS_CLIENT_ID": "your_client_id",
        "QUICKBOOKS_CLIENT_SECRET": "your_client_secret",
        "QUICKBOOKS_ENVIRONMENT": "sandbox",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

---

For authentication setup, see the [Authentication Guide](authentication.md). For troubleshooting, see the [Troubleshooting Guide](troubleshooting.md).
