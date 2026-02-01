# Changelog

All notable changes to the QuickBooks MCP Server are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Phase 3: Quality & Documentation (In Progress)

Phase 3 focuses on code quality, security hardening, test organization, and comprehensive documentation.

#### Added
- Comprehensive documentation structure in `docs/`
  - Getting Started guide
  - Authentication guide
  - Configuration reference
  - Troubleshooting guide
  - Development guide for contributors
- This CHANGELOG file

#### Changed
- Split monolithic integration tests into modular files
- Reorganized test utilities and fixtures

#### Security
- (Planned) Remove hardcoded console.error calls with sensitive data
- (Planned) Add input sanitization for search queries
- (Planned) Add rate limiting awareness with exponential backoff
- (Planned) Validate OAuth state parameter (CSRF protection)
- (Planned) Add token encryption at rest

---

## [0.0.1] - 2026-01-31

### Phase 2: Bug Fixes & Improvements (30 tasks completed)

Major bug fixes and code quality improvements based on comprehensive code review.

#### Fixed
- **Args Pattern Bugs**: Fixed 10 tools using incorrect `args.params.*` pattern
  - update-vendor, delete-vendor, get-employee, get-bill-payment
  - get-estimate, get-journal-entry, get-purchase, get-tax-code
  - create-employee, download-attachment, upload-attachment
- **Schema Issues**: Replaced all `z.any()` with typed Zod schemas
  - create-employee, create-bill-payment, search-accounts

#### Added
- Logging to all tools that were missing it
  - get-vendor, get-customer, get-bill, search-vendors
  - search-customers, search-items, search-accounts
  - update-vendor, delete-vendor, and more
- Advanced search filtering for bills and estimates
  - Date range filters (`dateFrom`, `dateTo`)
  - Amount range filters (`minAmount`, `maxAmount`)
  - Vendor/customer filtering
  - Text search
- Test organization improvements
  - Modular test file structure
  - Test utilities and fixtures

#### Changed
- Improved error messages with context
- Enhanced search result formatting

---

### Phase 1: Initial Features (24 tasks completed)

Initial release with core functionality.

#### Added
- **Full CRUD Operations** for QuickBooks entities:
  - Account (create, read, update, search)
  - Bill (create, read, update, delete, search)
  - Bill Payment (create, read, update, delete, search)
  - Customer (create, read, update, delete, search)
  - Employee (create, read, update, search)
  - Estimate (create, read, update, delete, search)
  - Invoice (create, read, update, search)
  - Item (create, read, update, search)
  - Journal Entry (create, read, update, delete, search)
  - Purchase (create, read, update, delete, search)
  - Vendor (create, read, update, delete, search)
  - Tax Code (read, search)

- **Attachment Support**:
  - Upload attachments to entities
  - Download attachments
  - Get attachments for entities

- **Idempotency Support**:
  - Prevent duplicate transactions with idempotency keys
  - Configurable TTL for idempotency keys
  - Automatic cleanup of expired keys

- **Structured Logging**:
  - JSON logging with timestamps
  - Configurable log levels (DEBUG, INFO, WARN, ERROR)
  - Duration tracking for all operations
  - Pretty formatting in development, JSON in production

- **Advanced Search**:
  - Date range filtering
  - Amount range filtering
  - Entity-specific filters (vendor, customer, payment type, etc.)
  - Text search
  - Sorting and pagination
  - Raw criteria support for complex queries

- **Type Validation**:
  - Zod schemas for all inputs
  - Helpful validation error messages
  - Self-documenting API parameters

- **OAuth 2.0 Authentication**:
  - Automatic OAuth flow with browser redirect
  - Token refresh handling
  - Secure token storage
  - Support for environment variables or stored tokens

- **Environment Support**:
  - Sandbox mode for development
  - Production mode for live data
  - Environment-specific token storage

---

## Migration Notes

### Upgrading to Phase 2

If upgrading from Phase 1:

1. **No breaking changes** - all existing tool interfaces are preserved
2. **Improved reliability** - args pattern fixes mean tools work correctly
3. **Better logging** - all operations now have structured logs

### Environment Variables

New optional environment variables in Phase 2:
- `IDEMPOTENCY_CLEANUP_MS` - Cleanup interval for idempotency keys

---

## Version History

| Version | Date | Phase | Tasks |
|---------|------|-------|-------|
| 0.0.1 | 2026-01-31 | Phase 1 + 2 | 54 tasks |
| (next) | TBD | Phase 3 | 42 tasks planned |

---

## Links

- [Documentation](docs/README.md)
- [Getting Started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
