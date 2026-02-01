# QuickBooks MCP Server Documentation

Welcome to the QuickBooks Online MCP Server documentation. This Model Context Protocol (MCP) server provides a comprehensive interface for integrating AI assistants with QuickBooks Online accounting software.

## Table of Contents

### Getting Started
- [Getting Started Guide](getting-started.md) - Quick setup and first run
- [Authentication](authentication.md) - OAuth 2.0 setup and token management
- [Configuration](configuration.md) - Environment variables reference

### Usage
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

### For Contributors
- [Development Guide](development.md) - Contributing to the project

## Quick Links

| Task | Link |
|------|------|
| Install and run for the first time | [Getting Started](getting-started.md) |
| Set up QuickBooks OAuth | [Authentication](authentication.md) |
| Configure environment variables | [Configuration](configuration.md) |
| Fix connection issues | [Troubleshooting](troubleshooting.md) |
| Contribute to the project | [Development Guide](development.md) |

## Available Tools

The server provides full CRUD operations for QuickBooks Online entities:

| Entity | Create | Read | Update | Delete | Search |
|--------|--------|------|--------|--------|--------|
| Account | ✅ | ✅ | ✅ | - | ✅ |
| Bill | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bill Payment | ✅ | ✅ | ✅ | ✅ | ✅ |
| Customer | ✅ | ✅ | ✅ | ✅ | ✅ |
| Employee | ✅ | ✅ | ✅ | - | ✅ |
| Estimate | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invoice | ✅ | ✅ | ✅ | - | ✅ |
| Item | ✅ | ✅ | ✅ | - | ✅ |
| Journal Entry | ✅ | ✅ | ✅ | ✅ | ✅ |
| Purchase | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vendor | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tax Code | - | ✅ | - | - | ✅ |
| Attachments | Upload | Download | - | - | Get |

## Key Features

- **Full CRUD Operations** - Create, Read, Update, Delete for major QBO entities
- **Idempotency Support** - Prevent duplicate transactions with idempotency keys
- **Structured Logging** - JSON logging with timing and configurable log levels
- **Advanced Search** - Filter by date ranges, amounts, vendors, and more
- **Type Validation** - Zod schemas ensure correct input format
- **Attachment Support** - Upload and download receipts and documents

## Support

- **GitHub Issues**: Report bugs or request features
- **Changelog**: See [CHANGELOG.md](../CHANGELOG.md) for version history

---

*This documentation is for QuickBooks MCP Server v0.0.1*
