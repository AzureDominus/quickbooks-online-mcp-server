# Authentication Guide

This guide explains how to set up and manage OAuth 2.0 authentication with QuickBooks Online.

## Table of Contents

- [OAuth 2.0 Overview](#oauth-20-overview)
- [Setting Up Your Intuit Developer App](#setting-up-your-intuit-developer-app)
- [Configuring Redirect URIs](#configuring-redirect-uris)
- [Environment Variable Setup](#environment-variable-setup)
- [Token Refresh Process](#token-refresh-process)
- [Token Storage](#token-storage)
- [Troubleshooting Auth Issues](#troubleshooting-auth-issues)

## OAuth 2.0 Overview

QuickBooks Online uses OAuth 2.0 for secure API access. Here's how the flow works:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   MCP       │     │   QuickBooks │     │   QuickBooks    │
│   Server    │────▶│   Login Page │────▶│   API           │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                    │                     │
       │ 1. Start OAuth     │                     │
       │────────────────────▶                     │
       │                    │ 2. User logs in     │
       │                    │ 3. User authorizes  │
       │◀───────────────────│                     │
       │ 4. Receive tokens  │                     │
       │                    │                     │
       │ 5. Access API with │                     │
       │    access token    │─────────────────────▶
       │                    │                     │
       │                    │◀────────────────────│
       │                    │ 6. Return data      │
```

### Token Types

| Token | Purpose | Lifetime |
|-------|---------|----------|
| Access Token | Authenticate API requests | ~1 hour |
| Refresh Token | Obtain new access tokens | 100 days |
| Realm ID | Identify the QuickBooks company | Permanent |

## Setting Up Your Intuit Developer App

### Step 1: Create a Developer Account

1. Go to [developer.intuit.com](https://developer.intuit.com/)
2. Click **Sign Up** or **Sign In**
3. Complete the registration process

### Step 2: Create an App

1. Go to the **Dashboard**
2. Click **Create an app**
3. Select **QuickBooks Online and Payments**
4. Enter your app name
5. Click **Create**

### Step 3: Get Your Credentials

1. Open your app
2. Go to **Keys & credentials**
3. Copy your:
   - **Client ID**
   - **Client Secret**

> ⚠️ **Security Note**: Never commit your Client Secret to version control. Keep it in environment variables only.

### Step 4: Choose Your Environment

| Environment | Use Case | Data |
|-------------|----------|------|
| Sandbox | Development and testing | Fake test data |
| Production | Live integration | Real customer data |

Start with **Sandbox** for development. Switch to **Production** when ready to go live.

## Configuring Redirect URIs

The OAuth flow requires a redirect URI where QuickBooks sends the authorization code.

### Step 1: Add Redirect URI in Intuit Dashboard

1. Open your app in the Intuit Developer Portal
2. Go to **Keys & credentials**
3. Under **Redirect URIs**, click **Add URI**
4. Enter: `http://localhost:8765/callback`
5. Click **Save**

### Custom Port Configuration

If port 8765 is in use, configure a different port:

```env
QUICKBOOKS_OAUTH_PORT=9000
```

Then add the corresponding redirect URI in Intuit:
```
http://localhost:9000/callback
```

### Production Redirect URIs

For production deployments, you may need HTTPS redirect URIs:
```
https://your-domain.com/oauth/callback
```

## Environment Variable Setup

### Required Variables

```env
# OAuth Credentials (from Intuit Developer Portal)
QUICKBOOKS_CLIENT_ID=ABc123...
QUICKBOOKS_CLIENT_SECRET=xyz789...

# Environment
QUICKBOOKS_ENVIRONMENT=sandbox
```

### Optional: Pre-configured Tokens

If you already have tokens (e.g., from a previous OAuth flow):

```env
QUICKBOOKS_REFRESH_TOKEN=AB11...long-token...
QUICKBOOKS_REALM_ID=1234567890
```

### Optional: Custom OAuth Port

```env
QUICKBOOKS_OAUTH_PORT=8765
```

### Optional: Custom Token Storage Path

```env
QUICKBOOKS_TOKEN_PATH=/path/to/tokens.json
```

## Token Refresh Process

### Automatic Refresh

The MCP server handles token refresh automatically:

1. Before each API call, checks if access token is expired
2. If expired, uses the refresh token to get a new access token
3. Saves the new tokens to storage
4. Proceeds with the API call

### Refresh Token Expiration

Refresh tokens expire after **100 days** of non-use. If your refresh token expires:

1. Delete the stored tokens: `rm ~/.config/quickbooks-mcp/tokens.json`
2. Restart the MCP server
3. Complete the OAuth flow again

### Manual Token Refresh

If needed, you can trigger a manual reconnection by deleting stored tokens:

```bash
rm ~/.config/quickbooks-mcp/tokens.json
```

## Token Storage

### Default Storage Location

Tokens are stored at:
```
~/.config/quickbooks-mcp/tokens.json
```

### Storage Format

```json
{
  "refresh_token": "AB11...",
  "realm_id": "1234567890",
  "environment": "sandbox"
}
```

### Custom Storage Location

Set a custom path with:

```env
QUICKBOOKS_TOKEN_PATH=/custom/path/tokens.json
```

### Security Considerations

- Token files are stored with standard file permissions
- Keep token files out of version control (add to `.gitignore`)
- In production, consider encrypting tokens at rest
- Never share or expose your tokens

## Troubleshooting Auth Issues

### "Invalid client" Error

**Cause**: Client ID or Secret is incorrect.

**Solution**:
1. Verify `QUICKBOOKS_CLIENT_ID` matches your Intuit app
2. Verify `QUICKBOOKS_CLIENT_SECRET` matches your Intuit app
3. Ensure you're using the correct environment (sandbox vs production)

### "Invalid redirect URI" Error

**Cause**: Redirect URI mismatch.

**Solution**:
1. Check your Intuit app's redirect URIs
2. Ensure `http://localhost:8765/callback` is listed
3. If using a custom port, ensure the URI matches

### "Refresh token expired" Error

**Cause**: Refresh token hasn't been used in 100 days.

**Solution**:
1. Delete stored tokens: `rm ~/.config/quickbooks-mcp/tokens.json`
2. Restart the MCP server
3. Complete OAuth flow again

### OAuth Window Doesn't Open

**Cause**: Browser or firewall issue.

**Solution**:
1. Check firewall isn't blocking the OAuth port
2. Try a different port with `QUICKBOOKS_OAUTH_PORT`
3. Manually open the OAuth URL printed in logs

### "Access denied" Error

**Cause**: User denied authorization or app lacks required scopes.

**Solution**:
1. Ensure you authorize all requested permissions
2. Check app scopes in Intuit Developer Portal

### Token File Not Saving

**Cause**: File permission or path issue.

**Solution**:
1. Check write permissions on the token directory
2. Try a different path with `QUICKBOOKS_TOKEN_PATH`
3. Ensure the parent directory exists

---

For more help, see the [Troubleshooting Guide](troubleshooting.md) or the [Configuration Reference](configuration.md).
