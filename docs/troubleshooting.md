# Troubleshooting Guide

This guide covers common issues and their solutions when using the QuickBooks MCP Server.

## Table of Contents

- [Connection Issues](#connection-issues)
- [OAuth and Authentication Issues](#oauth-and-authentication-issues)
- [Token Issues](#token-issues)
- [API and Rate Limiting Issues](#api-and-rate-limiting-issues)
- [Sandbox vs Production Issues](#sandbox-vs-production-issues)
- [Validation Errors](#validation-errors)
- [Debugging Tips](#debugging-tips)

## Connection Issues

### "QuickBooks not connected" Error

**Symptoms**: Every API call fails with "QuickBooks not connected".

**Causes and Solutions**:

1. **Missing environment variables**
   ```bash
   # Check your .env file has these
   QUICKBOOKS_CLIENT_ID=your_client_id
   QUICKBOOKS_CLIENT_SECRET=your_client_secret
   ```

2. **OAuth flow not completed**
   - Delete stored tokens: `rm ~/.config/quickbooks-mcp/tokens.json`
   - Restart the server to trigger OAuth flow
   - Complete the authorization in your browser

3. **Environment mismatch**
   - Tokens are environment-specific
   - If you switch from sandbox to production, delete tokens and re-authenticate

4. **Token file corrupted**
   ```bash
   cat ~/.config/quickbooks-mcp/tokens.json
   # Should be valid JSON with refresh_token, realm_id, environment
   ```

### Server Won't Start

**Symptoms**: Server exits immediately without error message.

**Solutions**:

1. **Check Node.js version**
   ```bash
   node --version  # Should be 18.x or higher
   ```

2. **Rebuild the project**
   ```bash
   npm run build
   ```

3. **Check for missing dependencies**
   ```bash
   rm -rf node_modules
   npm install
   npm run build
   ```

4. **Enable debug logging**
   ```env
   LOG_LEVEL=DEBUG
   ```

## OAuth and Authentication Issues

### OAuth Window Doesn't Open

**Symptoms**: Server starts but no browser window appears for OAuth.

**Solutions**:

1. **Check firewall settings**
   - Ensure port 8765 (or your custom port) is not blocked
   - Try a different port: `QUICKBOOKS_OAUTH_PORT=9999`

2. **Check browser settings**
   - Ensure a default browser is configured
   - Try opening the URL manually from the terminal output

3. **WSL/Remote environment**
   - The browser may open on the host machine, not in WSL
   - Copy the OAuth URL and open it manually

### "Invalid client" Error

**Symptoms**: OAuth fails with "invalid_client" error.

**Solutions**:

1. **Verify credentials**
   - Double-check `QUICKBOOKS_CLIENT_ID` and `QUICKBOOKS_CLIENT_SECRET`
   - Ensure no extra spaces or newlines in the values

2. **Check environment match**
   - Sandbox credentials only work with `QUICKBOOKS_ENVIRONMENT=sandbox`
   - Production credentials only work with `QUICKBOOKS_ENVIRONMENT=production`

3. **Regenerate credentials**
   - In Intuit Developer Portal, try regenerating your Client Secret

### "Invalid redirect URI" Error

**Symptoms**: OAuth fails with redirect URI error.

**Solutions**:

1. **Add redirect URI to Intuit app**
   - Go to developer.intuit.com → Your App → Keys & credentials
   - Add: `http://localhost:8765/callback`

2. **Check port configuration**
   - If using custom port, ensure redirect URI matches
   - `QUICKBOOKS_OAUTH_PORT=9000` requires `http://localhost:9000/callback`

3. **Check for typos**
   - URI must be exactly `http://localhost:PORT/callback`
   - No trailing slash

### "Access denied" Error

**Symptoms**: User sees "Access denied" after login.

**Solutions**:

1. **Authorize all permissions**
   - Click "Connect" on all permission requests
   - Don't skip any permissions

2. **Check app scopes**
   - In Intuit Developer Portal, verify app has accounting scopes

## Token Issues

### "Refresh token expired" Error

**Symptoms**: API calls fail with token expiration error.

**Cause**: Refresh tokens expire after 100 days of non-use.

**Solution**:
```bash
# Delete old tokens
rm ~/.config/quickbooks-mcp/tokens.json

# Restart server to trigger new OAuth flow
```

### Tokens Not Saving

**Symptoms**: OAuth succeeds but tokens are lost on restart.

**Solutions**:

1. **Check file permissions**
   ```bash
   ls -la ~/.config/quickbooks-mcp/
   # Directory should be writable
   ```

2. **Create directory manually**
   ```bash
   mkdir -p ~/.config/quickbooks-mcp
   chmod 700 ~/.config/quickbooks-mcp
   ```

3. **Use custom path**
   ```env
   QUICKBOOKS_TOKEN_PATH=/tmp/qb-tokens.json
   ```

### Wrong Company Connected

**Symptoms**: API returns data from wrong QuickBooks company.

**Solution**:
```bash
# Delete tokens to force re-authentication
rm ~/.config/quickbooks-mcp/tokens.json

# Restart and select the correct company during OAuth
```

## API and Rate Limiting Issues

### API Rate Limit Errors

**Symptoms**: Requests fail with 429 status code.

**QuickBooks Rate Limits**:
- 500 requests per minute per realm
- Throttling applies to all API calls

**Solutions**:

1. **Add delays between bulk operations**
   - Avoid rapid sequential API calls
   - Space out requests in automated workflows

2. **Use search instead of individual gets**
   - Fetch multiple records with `search_*` tools
   - More efficient than multiple `get_*` calls

3. **Check for loops**
   - Ensure your workflow isn't creating infinite loops

### API Timeout Errors

**Symptoms**: Requests fail with timeout errors.

**Solutions**:

1. **Check network connectivity**
   ```bash
   curl https://sandbox-quickbooks.api.intuit.com
   ```

2. **Reduce batch sizes**
   - Use smaller `limit` values in search queries

3. **Retry transient failures**
   - Some timeouts are temporary

## Sandbox vs Production Issues

### Sandbox Data Differs from Production

**Note**: Sandbox and Production are completely separate:
- Different API endpoints
- Different credentials (can be same app, different keys)
- Different data

### Switching Environments

When switching between sandbox and production:

1. Update environment variable:
   ```env
   QUICKBOOKS_ENVIRONMENT=production
   ```

2. Delete stored tokens (they're environment-specific):
   ```bash
   rm ~/.config/quickbooks-mcp/tokens.json
   ```

3. Restart and re-authenticate

### Testing in Sandbox

Best practices for sandbox testing:
- Use sandbox for all development
- Create test data in sandbox
- Test all workflows before production

## Validation Errors

### "Validation error" Messages

**Symptoms**: Tool calls fail with validation errors.

**Common Validation Errors**:

| Error | Cause | Solution |
|-------|-------|----------|
| "txnDate must match YYYY-MM-DD" | Wrong date format | Use `2026-01-31`, not `01/31/2026` |
| "amount must be a number" | String instead of number | Use `100.50`, not `"100.50"` |
| "vendorId is required" | Missing required field | Include all required fields |
| "Invalid email format" | Malformed email | Use valid email format |

### Required Fields

Each entity has different required fields. Common patterns:

**Purchase**:
```json
{
  "txnDate": "2026-01-31",
  "paymentType": "CreditCard",
  "paymentAccountId": "41",
  "lines": [{"amount": 100, "expenseAccountId": "13"}]
}
```

**Vendor**:
```json
{
  "DisplayName": "Vendor Name"
}
```

**Customer**:
```json
{
  "DisplayName": "Customer Name"
}
```

## Debugging Tips

### Enable Debug Logging

```env
LOG_LEVEL=DEBUG
```

This shows:
- All API requests and responses
- Token refresh operations
- Detailed error information

### Check Token File

```bash
cat ~/.config/quickbooks-mcp/tokens.json | jq .
```

Should contain:
```json
{
  "refresh_token": "...",
  "realm_id": "...",
  "environment": "sandbox"
}
```

### Verify Build

```bash
npm run build
echo $?  # Should be 0
```

### Check Environment Variables

```bash
# In your shell, verify variables are set
echo $QUICKBOOKS_CLIENT_ID
echo $QUICKBOOKS_ENVIRONMENT
```

### Test API Connection Manually

Use the search tools to test connectivity:
```
Ask: "Search for QuickBooks accounts"
```

If this works, the connection is valid.

### View Server Logs

When running via Claude Desktop or other MCP clients, check:
- Claude Desktop: Settings → Developer → Logs
- Other clients: Check their log configuration

---

## Still Having Issues?

1. Check the [Configuration Reference](configuration.md)
2. Review the [Authentication Guide](authentication.md)
3. Open a GitHub issue with:
   - Error message
   - Environment (sandbox/production)
   - Node.js version
   - Steps to reproduce
