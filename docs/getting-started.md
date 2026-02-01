# Getting Started

This guide will help you set up and run the QuickBooks MCP Server for the first time.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Configuration](#quick-configuration)
- [First Run Walkthrough](#first-run-walkthrough)
- [Verifying Connection](#verifying-connection)
- [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have the following:

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or higher | Runtime environment |
| npm | 9.x or higher | Package manager |
| Git | Any recent version | Version control |

### QuickBooks Developer Account

You need a QuickBooks developer account to get API credentials:

1. Go to the [Intuit Developer Portal](https://developer.intuit.com/)
2. Sign up or log in with your Intuit account
3. Create a new app (see [Authentication Guide](authentication.md) for details)

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/quickbooks-online-mcp-server.git
cd quickbooks-online-mcp-server
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build the Project

```bash
npm run build
```

This compiles the TypeScript source to JavaScript in the `dist/` directory.

## Quick Configuration

### Step 1: Create Environment File

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

### Step 2: Add Required Variables

Open `.env` and add your QuickBooks credentials:

```env
# Required - Get these from Intuit Developer Portal
QUICKBOOKS_CLIENT_ID=your_client_id_here
QUICKBOOKS_CLIENT_SECRET=your_client_secret_here

# Environment - Use 'sandbox' for testing, 'production' for live data
QUICKBOOKS_ENVIRONMENT=sandbox
```

### Step 3: Configure Redirect URI

In your Intuit Developer app settings, add this redirect URI:

```
http://localhost:8765/callback
```

> **Note**: The default OAuth port is 8765. You can change it with `QUICKBOOKS_OAUTH_PORT`.

## First Run Walkthrough

### Option A: OAuth Flow (Recommended for First-Time Setup)

If you don't have a refresh token yet, the server will automatically start the OAuth flow:

1. **Start the MCP server** (via your MCP client)
2. **A browser window opens** with the QuickBooks login page
3. **Log in** with your QuickBooks account
4. **Authorize the app** to access your QuickBooks data
5. **Tokens are saved automatically** to `~/.config/quickbooks-mcp/tokens.json`

### Option B: Manual Token Setup

If you already have a refresh token and realm ID:

```env
# Add to your .env file
QUICKBOOKS_REFRESH_TOKEN=your_refresh_token_here
QUICKBOOKS_REALM_ID=your_realm_id_here
```

## Verifying Connection

After setup, verify the connection works by testing a simple search:

### Using Claude Desktop

Add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "node",
      "args": ["/path/to/quickbooks-online-mcp-server/dist/index.js"],
      "env": {
        "QUICKBOOKS_CLIENT_ID": "your_client_id",
        "QUICKBOOKS_CLIENT_SECRET": "your_client_secret",
        "QUICKBOOKS_ENVIRONMENT": "sandbox"
      }
    }
  }
}
```

Then ask Claude: "List my QuickBooks accounts"

### Expected Success Response

```json
{
  "accounts": [
    {
      "Id": "1",
      "Name": "Checking",
      "AccountType": "Bank"
    }
  ],
  "count": 1
}
```

### Troubleshooting First Run

If you encounter issues:

| Problem | Solution |
|---------|----------|
| "QuickBooks not connected" | Check your `.env` file has all required variables |
| OAuth window doesn't open | Check firewall settings, try a different port |
| "Invalid client" error | Verify Client ID/Secret match your Intuit app |
| "Invalid redirect URI" | Ensure `http://localhost:8765/callback` is in your app settings |

See the full [Troubleshooting Guide](troubleshooting.md) for more solutions.

## Next Steps

- [Configure additional environment variables](configuration.md)
- [Learn about OAuth and token management](authentication.md)
- [Explore available tools in the main README](../README.md)

---

Need help? Check the [Troubleshooting Guide](troubleshooting.md) or open a GitHub issue.
