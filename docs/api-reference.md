# QuickBooks MCP Server - API Reference

This document provides comprehensive documentation for all MCP tools available in the QuickBooks MCP Server.

## Table of Contents

- [Overview](#overview)
- [Common Concepts](#common-concepts)
  - [Idempotency](#idempotency)
  - [Optimistic Locking (SyncToken)](#optimistic-locking-synctoken)
  - [Pagination](#pagination)
  - [Search Operators](#search-operators)
- [Accounts](#accounts)
  - [create_account](#create_account)
  - [update_account](#update_account)
  - [search_accounts](#search_accounts)
- [Bills](#bills)
  - [create-bill](#create-bill)
  - [get-bill](#get-bill)
  - [update_bill](#update_bill)
  - [delete-bill](#delete-bill)
  - [search_bills](#search_bills)
- [Bill Payments](#bill-payments)
  - [create_bill_payment](#create_bill_payment)
  - [get_bill_payment](#get_bill_payment)
  - [update_bill_payment](#update_bill_payment)
  - [delete_bill_payment](#delete_bill_payment)
  - [search_bill_payments](#search_bill_payments)
- [Customers](#customers)
  - [create_customer](#create_customer)
  - [get_customer](#get_customer)
  - [update_customer](#update_customer)
  - [delete_customer](#delete_customer)
  - [search_customers](#search_customers)
- [Employees](#employees)
  - [create_employee](#create_employee)
  - [get_employee](#get_employee)
  - [update_employee](#update_employee)
  - [search_employees](#search_employees)
- [Estimates](#estimates)
  - [create_estimate](#create_estimate)
  - [get_estimate](#get_estimate)
  - [update_estimate](#update_estimate)
  - [delete_estimate](#delete_estimate)
  - [search_estimates](#search_estimates)
- [Invoices](#invoices)
  - [create_invoice](#create_invoice)
  - [read_invoice](#read_invoice)
  - [update_invoice](#update_invoice)
  - [search_invoices](#search_invoices)
- [Items](#items)
  - [create_item](#create_item)
  - [read_item](#read_item)
  - [update_item](#update_item)
  - [search_items](#search_items)
- [Journal Entries](#journal-entries)
  - [create_journal_entry](#create_journal_entry)
  - [get_journal_entry](#get_journal_entry)
  - [update_journal_entry](#update_journal_entry)
  - [delete_journal_entry](#delete_journal_entry)
  - [search_journal_entries](#search_journal_entries)
- [Purchases](#purchases)
  - [create_purchase](#create_purchase)
  - [get_purchase](#get_purchase)
  - [update_purchase](#update_purchase)
  - [delete_purchase](#delete_purchase)
  - [search_purchases](#search_purchases)
- [Vendors](#vendors)
  - [create-vendor](#create-vendor)
  - [get-vendor](#get-vendor)
  - [update-vendor](#update-vendor)
  - [delete-vendor](#delete-vendor)
  - [search_vendors](#search_vendors)
- [Tax Codes](#tax-codes)
  - [get_tax_code](#get_tax_code)
  - [search_tax_codes](#search_tax_codes)
- [Attachments](#attachments)
  - [upload_attachment](#upload_attachment)
  - [get_attachments](#get_attachments)
  - [download_attachment](#download_attachment)

---

## Overview

The QuickBooks MCP Server provides **54 tools** for interacting with QuickBooks Online. These tools enable full CRUD (Create, Read, Update, Delete) operations on major QuickBooks entities including accounts, bills, customers, invoices, purchases, and more.

All tools follow a consistent pattern:
- **Create tools** support idempotency keys to prevent duplicate creation
- **Update tools** require SyncToken for optimistic locking
- **Delete tools** typically perform soft-delete (void) operations
- **Search tools** support advanced filtering, sorting, and pagination

---

## Common Concepts

### Idempotency

Create operations support an optional `idempotencyKey` parameter to prevent duplicate creation on retry. If the same key is used twice, the original entity ID is returned instead of creating a duplicate.

```json
{
  "idempotencyKey": "unique-request-id-12345"
}
```

### Optimistic Locking (SyncToken)

Update and delete operations require a `SyncToken` to prevent concurrent update conflicts. The SyncToken changes each time an entity is modified. Always retrieve the current entity first to get the latest SyncToken.

```json
{
  "Id": "123",
  "SyncToken": "2"
}
```

### Pagination

Search tools support pagination with these parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Maximum results to return (1-1000, default 100) |
| offset | number | Number of records to skip |
| fetchAll | boolean | Fetch all matching records (may be slow) |
| count | boolean | Return only the count of matching records |

### Search Operators

For advanced filtering, use criteria arrays with these operators:

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Exact match (default) | `{ "field": "Name", "value": "Acme", "operator": "=" }` |
| `<` | Less than | `{ "field": "Balance", "value": "1000", "operator": "<" }` |
| `>` | Greater than | `{ "field": "Balance", "value": "500", "operator": ">" }` |
| `<=` | Less than or equal | `{ "field": "TxnDate", "value": "2026-01-31", "operator": "<=" }` |
| `>=` | Greater than or equal | `{ "field": "TxnDate", "value": "2026-01-01", "operator": ">=" }` |
| `LIKE` | Partial text match | `{ "field": "Name", "value": "%Smith%", "operator": "LIKE" }` |
| `IN` | Match any in list | `{ "field": "Id", "value": "1,2,3", "operator": "IN" }` |

---

## Accounts

Accounts represent categories in your chart of accounts for tracking financial transactions.

### create_account

**Description:** Create a chart-of-accounts entry in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Account name (must be unique) |
| type | string | Yes | Account type (e.g., "Bank", "Expense", "Income") |
| sub_type | string | No | Account subtype (e.g., "Checking", "Advertising") |
| description | string | No | Account description |
| idempotencyKey | string | No | Key to prevent duplicate creation on retry |

**Example Request:**
```json
{
  "name": "Office Supplies",
  "type": "Expense",
  "sub_type": "OfficeExpenses",
  "description": "General office supplies and materials",
  "idempotencyKey": "acct-office-supplies-001"
}
```

**Example Response:**
```json
{
  "Id": "123",
  "Name": "Office Supplies",
  "AccountType": "Expense",
  "AccountSubType": "OfficeExpenses",
  "Description": "General office supplies and materials",
  "Active": true,
  "SyncToken": "0"
}
```

**Common Errors:**
- `Duplicate Name Exists Error`: An account with this name already exists
- `Invalid AccountType`: The specified account type is not valid

---

### update_account

**Description:** Update an existing chart-of-accounts entry in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| account.Id | string | Yes | Account ID to update |
| account.SyncToken | string | Yes | Current sync token for optimistic locking |
| account.Name | string | No | Account name (max 100 chars, must be unique) |
| account.AccountType | string | No | Account type |
| account.AccountSubType | string | No | Account subtype |
| account.Description | string | No | Account description (max 4000 chars) |
| account.Classification | string | No | Asset, Equity, Expense, Liability, or Revenue |
| account.Active | boolean | No | Whether account is active |
| account.SubAccount | boolean | No | Whether this is a sub-account |
| account.ParentRef | object | No | Parent account reference for sub-accounts |
| account.AcctNum | string | No | User-defined account number (max 7 chars) |

**Example Request:**
```json
{
  "account": {
    "Id": "123",
    "SyncToken": "0",
    "Name": "Updated Account Name",
    "Description": "New description for the account"
  }
}
```

**Example Response:**
```json
{
  "Id": "123",
  "Name": "Updated Account Name",
  "Description": "New description for the account",
  "SyncToken": "1"
}
```

**Common Errors:**
- `Stale Object Error`: SyncToken is outdated; fetch current entity and retry
- `Object Not Found`: Account with specified ID does not exist

---

### search_accounts

**Description:** Search chart-of-accounts entries in QuickBooks Online with advanced filtering.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| accountType | string | No | Filter by type (Bank, Expense, Income, etc.) |
| classification | string | No | Filter by classification (Asset, Liability, etc.) |
| balanceMin | number | No | Minimum balance filter |
| balanceMax | number | No | Maximum balance filter |
| active | boolean | No | Filter by active status |
| name | string | No | Filter by name (supports LIKE with % wildcard) |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| limit | number | No | Max results (1-1000, default 100) |
| offset | number | No | Records to skip for pagination |
| count | boolean | No | Return only count of matches |
| fetchAll | boolean | No | Fetch all matching records |

**Example Request:**
```json
{
  "accountType": "Expense",
  "active": true,
  "asc": "Name",
  "limit": 50
}
```

**Example Response:**
```json
[
  {
    "Id": "123",
    "Name": "Advertising",
    "AccountType": "Expense",
    "Active": true,
    "CurrentBalance": 5000.00
  },
  {
    "Id": "124",
    "Name": "Office Supplies",
    "AccountType": "Expense",
    "Active": true,
    "CurrentBalance": 1250.00
  }
]
```

**Common Errors:**
- `Invalid field`: Specified filter field is not valid for Account entity

---

## Bills

Bills are payable transactions representing amounts owed to vendors.

### create-bill

**Description:** Create a bill in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| bill.Line | array | Yes | Array of bill line items |
| bill.Line[].Amount | number | Yes | Line amount |
| bill.Line[].DetailType | string | Yes | Detail type |
| bill.Line[].Description | string | Yes | Line description |
| bill.Line[].AccountRef | object | Yes | Account reference with value (ID) |
| bill.VendorRef | object | Yes | Vendor reference with value (ID) |
| bill.DueDate | string | Yes | Due date (YYYY-MM-DD) |
| bill.Balance | number | Yes | Bill balance |
| bill.TotalAmt | number | Yes | Total amount |
| idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "bill": {
    "Line": [
      {
        "Amount": 500.00,
        "DetailType": "AccountBasedExpenseLineDetail",
        "Description": "Office furniture",
        "AccountRef": { "value": "123", "name": "Furniture" }
      }
    ],
    "VendorRef": { "value": "456", "name": "Office Depot" },
    "DueDate": "2026-02-28",
    "Balance": 500.00,
    "TotalAmt": 500.00
  },
  "idempotencyKey": "bill-office-furniture-001"
}
```

**Example Response:**
```json
{
  "Id": "789",
  "VendorRef": { "value": "456", "name": "Office Depot" },
  "TotalAmt": 500.00,
  "Balance": 500.00,
  "DueDate": "2026-02-28",
  "SyncToken": "0"
}
```

---

### get-bill

**Description:** Get a bill by ID from QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Bill ID to retrieve |

**Example Request:**
```json
{
  "id": "789"
}
```

**Example Response:**
```json
{
  "Id": "789",
  "VendorRef": { "value": "456", "name": "Office Depot" },
  "TotalAmt": 500.00,
  "Balance": 500.00,
  "DueDate": "2026-02-28",
  "TxnDate": "2026-01-31",
  "Line": [...],
  "SyncToken": "0"
}
```

---

### update_bill

**Description:** Update a bill in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| bill.Id | string | Yes | Bill ID to update |
| bill.SyncToken | string | Yes | Current sync token |
| bill.VendorRef | object | No | Vendor reference |
| bill.Line | array | No | Bill line items (replaces existing) |
| bill.TxnDate | string | No | Bill date (YYYY-MM-DD) |
| bill.DueDate | string | No | Payment due date (YYYY-MM-DD) |
| bill.DocNumber | string | No | Bill reference number |
| bill.Memo | string | No | Memo text |
| bill.PrivateNote | string | No | Internal note |

**Example Request:**
```json
{
  "bill": {
    "Id": "789",
    "SyncToken": "0",
    "DueDate": "2026-03-15",
    "PrivateNote": "Extended due date approved"
  }
}
```

---

### delete-bill

**Description:** Delete (void) a bill in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| bill.Id | string | Yes | Bill ID to delete |
| bill.SyncToken | string | Yes | Current sync token |

**Example Request:**
```json
{
  "bill": {
    "Id": "789",
    "SyncToken": "1"
  }
}
```

---

### search_bills

**Description:** Search bills in QuickBooks Online with advanced filtering.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dateFrom | string | No | Start of bill date range (YYYY-MM-DD) |
| dateTo | string | No | End of bill date range (YYYY-MM-DD) |
| dueDateFrom | string | No | Start of due date range |
| dueDateTo | string | No | End of due date range |
| amountMin | number | No | Minimum total amount |
| amountMax | number | No | Maximum total amount |
| balanceMin | number | No | Minimum balance |
| balanceMax | number | No | Maximum balance |
| vendorId | string | No | Filter by vendor ID |
| paymentStatus | string | No | Paid, Unpaid, or PartiallyPaid |
| docNumber | string | No | Filter by document number |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |

**Example Request:**
```json
{
  "dueDateFrom": "2026-01-01",
  "dueDateTo": "2026-01-31",
  "paymentStatus": "Unpaid",
  "amountMin": 500,
  "desc": "TotalAmt",
  "limit": 50
}
```

---

## Bill Payments

Bill payments record payments made to vendors against outstanding bills.

### create_bill_payment

**Description:** Create a bill payment in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| billPayment.VendorRef | object | Yes | Vendor reference |
| billPayment.Line | array | Yes | Payment line items |
| billPayment.TotalAmt | number | Yes | Total payment amount |
| billPayment.PayType | string | Yes | Check or CreditCard |
| billPayment.CheckPayment | object | No | Check details (if PayType is Check) |
| billPayment.CreditCardPayment | object | No | Credit card details (if PayType is CreditCard) |
| idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "billPayment": {
    "VendorRef": { "value": "456" },
    "Line": [
      {
        "Amount": 500.00,
        "LinkedTxn": [
          { "TxnId": "789", "TxnType": "Bill" }
        ]
      }
    ],
    "TotalAmt": 500.00,
    "PayType": "Check",
    "CheckPayment": {
      "BankAccountRef": { "value": "35" }
    }
  },
  "idempotencyKey": "billpmt-vendor456-001"
}
```

---

### get_bill_payment

**Description:** Get a bill payment by ID from QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Bill payment ID to retrieve |

**Example Request:**
```json
{
  "id": "101"
}
```

---

### update_bill_payment

**Description:** Update an existing bill payment in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| billPayment.Id | string | Yes | Bill payment ID to update |
| billPayment.SyncToken | string | Yes | Current sync token |
| billPayment.VendorRef | object | No | Vendor reference |
| billPayment.Line | array | No | Payment lines |
| billPayment.TotalAmt | number | No | Total payment amount |
| billPayment.PayType | string | No | Check or CreditCard |
| billPayment.TxnDate | string | No | Payment date (YYYY-MM-DD) |
| billPayment.DocNumber | string | No | Reference number |
| billPayment.PrivateNote | string | No | Internal note |

**Example Request:**
```json
{
  "billPayment": {
    "Id": "101",
    "SyncToken": "1",
    "PrivateNote": "Updated payment note"
  }
}
```

---

### delete_bill_payment

**Description:** Delete (void) a bill payment in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| idOrEntity.Id | string | Yes | Bill payment ID to delete |
| idOrEntity.SyncToken | string | Yes | Current sync token |

**Example Request:**
```json
{
  "idOrEntity": {
    "Id": "101",
    "SyncToken": "2"
  }
}
```

---

### search_bill_payments

**Description:** Search bill payments in QuickBooks Online with advanced filtering.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| txnDateFrom | string | No | Start of transaction date range (YYYY-MM-DD) |
| txnDateTo | string | No | End of transaction date range |
| totalAmtMin | number | No | Minimum total amount |
| totalAmtMax | number | No | Maximum total amount |
| vendorId | string | No | Filter by vendor ID |
| payType | string | No | Check or CreditCard |
| docNumber | string | No | Filter by document/reference number |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |

**Example Request:**
```json
{
  "txnDateFrom": "2026-01-01",
  "txnDateTo": "2026-01-31",
  "totalAmtMin": 1000,
  "desc": "TxnDate",
  "limit": 50
}
```

---

## Customers

Customers are individuals or businesses that purchase goods or services from your company.

### create_customer

**Description:** Create a new customer in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customer.DisplayName | string | Yes | Unique display name (max 500 chars) |
| customer.CompanyName | string | No | Company/business name |
| customer.GivenName | string | No | First name |
| customer.FamilyName | string | No | Last name |
| customer.PrimaryEmailAddr | object | No | Email address { Address: string } |
| customer.PrimaryPhone | object | No | Phone { FreeFormNumber: string } |
| customer.BillAddr | object | No | Billing address |
| customer.ShipAddr | object | No | Shipping address |
| customer.Notes | string | No | Internal notes (max 2000 chars) |
| customer.Active | boolean | No | Is customer active? (default true) |
| customer.Taxable | boolean | No | Is customer taxable? |
| idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "customer": {
    "DisplayName": "Acme Corporation",
    "CompanyName": "Acme Corp",
    "GivenName": "John",
    "FamilyName": "Doe",
    "PrimaryEmailAddr": { "Address": "john@acme.com" },
    "PrimaryPhone": { "FreeFormNumber": "555-1234" },
    "BillAddr": {
      "Line1": "123 Main St",
      "City": "San Francisco",
      "CountrySubDivisionCode": "CA",
      "PostalCode": "94102",
      "Country": "USA"
    }
  },
  "idempotencyKey": "cust-acme-001"
}
```

**Example Response:**
```json
{
  "Id": "201",
  "DisplayName": "Acme Corporation",
  "CompanyName": "Acme Corp",
  "GivenName": "John",
  "FamilyName": "Doe",
  "Active": true,
  "SyncToken": "0"
}
```

---

### get_customer

**Description:** Get a customer by ID from QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Customer ID to retrieve |

**Example Request:**
```json
{
  "id": "201"
}
```

---

### update_customer

**Description:** Update an existing customer in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customer.Id | string | Yes | Customer ID to update |
| customer.SyncToken | string | Yes | Current sync token |
| customer.DisplayName | string | No | Display name (max 500 chars) |
| customer.CompanyName | string | No | Company name |
| customer.GivenName | string | No | First name |
| customer.FamilyName | string | No | Last name |
| customer.PrimaryEmailAddr | object | No | Email address |
| customer.PrimaryPhone | object | No | Phone number |
| customer.BillAddr | object | No | Billing address |
| customer.ShipAddr | object | No | Shipping address |
| customer.Notes | string | No | Internal notes |
| customer.Active | boolean | No | Is customer active? |
| customer.Taxable | boolean | No | Is customer taxable? |

**Example Request:**
```json
{
  "customer": {
    "Id": "201",
    "SyncToken": "0",
    "DisplayName": "Acme Corporation Updated",
    "PrimaryPhone": { "FreeFormNumber": "555-9999" }
  }
}
```

---

### delete_customer

**Description:** Delete (make inactive) a customer in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| idOrEntity.Id | string | Yes | Customer ID to delete |
| idOrEntity.SyncToken | string | Yes | Current sync token |

**Note:** This makes the customer inactive rather than permanently deleting. Use update_customer with `Active: true` to reactivate.

**Example Request:**
```json
{
  "idOrEntity": {
    "Id": "201",
    "SyncToken": "1"
  }
}
```

---

### search_customers

**Description:** Search customers in QuickBooks Online that match given criteria.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| criteria | array | No | Array of filter criteria |
| criteria[].field | string | No | Field to filter (DisplayName, CompanyName, etc.) |
| criteria[].value | string/boolean | No | Value to match |
| criteria[].operator | string | No | Comparison operator (=, <, >, LIKE, etc.) |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| fetchAll | boolean | No | Fetch all matching records |
| count | boolean | No | Return only count |

**Example Request:**
```json
{
  "criteria": [
    { "field": "Active", "value": true },
    { "field": "DisplayName", "value": "%Acme%", "operator": "LIKE" }
  ],
  "asc": "DisplayName",
  "limit": 50
}
```

---

## Employees

Employees are individuals who work for the company and may receive paychecks.

### create_employee

**Description:** Create an employee in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employee.DisplayName | string | Yes | Display name |
| employee.GivenName | string | No | First name |
| employee.FamilyName | string | No | Last name |
| employee.PrimaryEmailAddr | object | No | Email address |
| employee.PrimaryPhone | object | No | Phone number |
| employee.EmployeeNumber | string | No | Employee number |
| employee.HiredDate | string | No | Hire date (YYYY-MM-DD) |
| idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "employee": {
    "DisplayName": "Jane Smith",
    "GivenName": "Jane",
    "FamilyName": "Smith",
    "PrimaryEmailAddr": { "Address": "jane.smith@company.com" },
    "HiredDate": "2026-01-15"
  },
  "idempotencyKey": "emp-jane-smith-001"
}
```

---

### get_employee

**Description:** Get an employee by ID from QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Employee ID to retrieve |

**Example Request:**
```json
{
  "id": "301"
}
```

---

### update_employee

**Description:** Update an existing employee in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| employee.Id | string | Yes | Employee ID to update |
| employee.SyncToken | string | Yes | Current sync token |
| employee.GivenName | string | No | First name |
| employee.FamilyName | string | No | Last name |
| employee.DisplayName | string | No | Display name |
| employee.PrimaryEmailAddr | object | No | Email address |
| employee.PrimaryPhone | object | No | Phone number |
| employee.Mobile | object | No | Mobile phone |
| employee.PrimaryAddr | object | No | Primary address |
| employee.EmployeeNumber | string | No | Employee number |
| employee.HiredDate | string | No | Hire date (YYYY-MM-DD) |
| employee.ReleasedDate | string | No | Termination date (YYYY-MM-DD) |
| employee.Active | boolean | No | Is employee active? |
| employee.BillableTime | boolean | No | Track billable time? |
| employee.BillRate | number | No | Hourly bill rate |
| employee.BirthDate | string | No | Birth date (YYYY-MM-DD) |
| employee.Gender | string | No | Male or Female |

**Example Request:**
```json
{
  "employee": {
    "Id": "301",
    "SyncToken": "0",
    "BillRate": 150.00,
    "BillableTime": true
  }
}
```

---

### search_employees

**Description:** Search employees in QuickBooks Online with advanced filtering.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| active | boolean | No | Filter by active status |
| givenName | string | No | Filter by first name (supports LIKE) |
| familyName | string | No | Filter by last name (supports LIKE) |
| displayName | string | No | Filter by display name (supports LIKE) |
| hiredDateFrom | string | No | Start of hired date range (YYYY-MM-DD) |
| hiredDateTo | string | No | End of hired date range |
| releasedDateFrom | string | No | Start of released date range |
| releasedDateTo | string | No | End of released date range |
| email | string | No | Filter by email address |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |

**Example Request:**
```json
{
  "active": true,
  "hiredDateFrom": "2025-01-01",
  "hiredDateTo": "2025-12-31",
  "asc": "DisplayName"
}
```

---

## Estimates

Estimates (quotes) are proposals sent to customers before an actual sale.

### create_estimate

**Description:** Create an estimate (quote) in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| estimate.CustomerRef | object | Yes | Customer reference { value: "customerId" } |
| estimate.Line | array | Yes | Array of line items |
| estimate.Line[].Amount | number | Yes | Line total amount |
| estimate.Line[].DetailType | string | No | "SalesItemLineDetail" (default) |
| estimate.Line[].SalesItemLineDetail | object | Yes | Item details |
| estimate.Line[].SalesItemLineDetail.ItemRef | object | Yes | Item reference |
| estimate.Line[].Description | string | No | Line description |
| estimate.TxnDate | string | No | Estimate date (YYYY-MM-DD) |
| estimate.ExpirationDate | string | No | Expiration date (YYYY-MM-DD) |
| estimate.DocNumber | string | No | Estimate number (max 21 chars) |
| estimate.CustomerMemo | object | No | Customer-visible memo { value: string } |
| estimate.PrivateNote | string | No | Internal note (max 4000 chars) |
| estimate.BillEmail | object | No | Email for sending { Address: string } |
| estimate.BillAddr | object | No | Billing address |
| estimate.ShipAddr | object | No | Shipping address |
| estimate.TxnStatus | string | No | Pending, Accepted, Closed, or Rejected |
| estimate.GlobalTaxCalculation | string | No | TaxExcluded, TaxInclusive, or NotApplicable |
| idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "estimate": {
    "CustomerRef": { "value": "201" },
    "Line": [
      {
        "Amount": 150.00,
        "DetailType": "SalesItemLineDetail",
        "SalesItemLineDetail": {
          "ItemRef": { "value": "1", "name": "Services" },
          "Qty": 3,
          "UnitPrice": 50.00
        },
        "Description": "Consulting services"
      }
    ],
    "TxnDate": "2026-01-31",
    "ExpirationDate": "2026-02-28",
    "DocNumber": "EST-001",
    "CustomerMemo": { "value": "Thank you for your business!" },
    "TxnStatus": "Pending"
  },
  "idempotencyKey": "est-001-cust201"
}
```

---

### get_estimate

**Description:** Get an estimate by ID from QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Estimate ID to retrieve |

**Example Request:**
```json
{
  "id": "401"
}
```

---

### update_estimate

**Description:** Update an existing estimate in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| estimate.Id | string | Yes | Estimate ID to update |
| estimate.SyncToken | string | Yes | Current sync token |
| estimate.CustomerRef | object | No | Customer reference |
| estimate.Line | array | No | Line items (replaces existing) |
| estimate.TxnDate | string | No | Estimate date |
| estimate.ExpirationDate | string | No | Expiration date |
| estimate.DocNumber | string | No | Estimate number |
| estimate.CustomerMemo | object | No | Customer memo |
| estimate.PrivateNote | string | No | Internal note |
| estimate.BillEmail | object | No | Email address |
| estimate.BillAddr | object | No | Billing address |
| estimate.ShipAddr | object | No | Shipping address |
| estimate.TxnStatus | string | No | Status (Pending, Accepted, Closed, Rejected) |
| estimate.GlobalTaxCalculation | string | No | Tax calculation mode |

**Example Request:**
```json
{
  "estimate": {
    "Id": "401",
    "SyncToken": "0",
    "TxnStatus": "Accepted",
    "PrivateNote": "Customer confirmed order"
  }
}
```

---

### delete_estimate

**Description:** Delete (void) an estimate in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| idOrEntity.Id | string | Yes | Estimate ID to delete |
| idOrEntity.SyncToken | string | Yes | Current sync token |

**Example Request:**
```json
{
  "idOrEntity": {
    "Id": "401",
    "SyncToken": "1"
  }
}
```

---

### search_estimates

**Description:** Search estimates in QuickBooks Online with advanced filtering.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dateFrom | string | No | Start of transaction date range (YYYY-MM-DD) |
| dateTo | string | No | End of transaction date range |
| expirationFrom | string | No | Start of expiration date range |
| expirationTo | string | No | End of expiration date range |
| amountMin | number | No | Minimum total amount |
| amountMax | number | No | Maximum total amount |
| customerId | string | No | Filter by customer ID |
| txnStatus | string | No | Pending, Accepted, Closed, or Rejected |
| search | string | No | Search text in estimate number |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |
| count | boolean | No | Return only count |
| fetchAll | boolean | No | Fetch all matching records |

**Example Request:**
```json
{
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31",
  "txnStatus": "Pending",
  "amountMin": 1000,
  "desc": "TotalAmt",
  "limit": 50
}
```

---

## Invoices

Invoices are sales forms that record sales of products or services to customers.

### create_invoice

**Description:** Create an invoice in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customer_ref | string | Yes | Customer ID |
| line_items | array | Yes | Array of line items |
| line_items[].item_ref | string | Yes | Item ID |
| line_items[].qty | number | Yes | Quantity (positive) |
| line_items[].unit_price | number | Yes | Unit price (non-negative) |
| line_items[].description | string | No | Line description |
| doc_number | string | No | Invoice number |
| txn_date | string | No | Invoice date (YYYY-MM-DD) |
| idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "customer_ref": "201",
  "line_items": [
    {
      "item_ref": "1",
      "qty": 5,
      "unit_price": 100.00,
      "description": "Professional services"
    }
  ],
  "doc_number": "INV-001",
  "txn_date": "2026-01-31",
  "idempotencyKey": "inv-001-cust201"
}
```

**Example Response:**
```json
{
  "Id": "501",
  "DocNumber": "INV-001",
  "TxnDate": "2026-01-31",
  "TotalAmt": 500.00,
  "Balance": 500.00,
  "CustomerRef": { "value": "201" },
  "SyncToken": "0"
}
```

---

### read_invoice

**Description:** Read a single invoice from QuickBooks Online by its ID.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| invoice_id | string | Yes | Invoice ID to retrieve |

**Example Request:**
```json
{
  "invoice_id": "501"
}
```

---

### update_invoice

**Description:** Update an existing invoice in QuickBooks Online (sparse update).

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| invoice.Id | string | Yes | Invoice ID to update |
| invoice.SyncToken | string | Yes | Current sync token |
| invoice.CustomerRef | object | No | Customer reference { value: "customerId" } |
| invoice.Line | array | No | Line items (replaces ALL existing lines) |
| invoice.TxnDate | string | No | Invoice date (YYYY-MM-DD) |
| invoice.DueDate | string | No | Payment due date (YYYY-MM-DD) |
| invoice.DocNumber | string | No | Invoice number (max 21 chars) |
| invoice.CustomerMemo | object | No | Customer memo { value: "text" } |
| invoice.PrivateNote | string | No | Internal note (max 4000 chars) |
| invoice.BillEmail | object | No | Billing email { Address: "email" } |
| invoice.BillAddr | object | No | Billing address |
| invoice.ShipAddr | object | No | Shipping address |

**Example Request:**
```json
{
  "invoice": {
    "Id": "501",
    "SyncToken": "0",
    "DueDate": "2026-02-28",
    "PrivateNote": "Payment extended per customer request"
  }
}
```

---

### search_invoices

**Description:** Search invoices in QuickBooks Online with advanced filtering.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dateFrom | string | No | Start of invoice date range (YYYY-MM-DD) |
| dateTo | string | No | End of invoice date range |
| dueFrom | string | No | Start of due date range |
| dueTo | string | No | End of due date range |
| amountMin | number | No | Minimum total amount |
| amountMax | number | No | Maximum total amount |
| balanceMin | number | No | Minimum unpaid balance |
| balanceMax | number | No | Maximum unpaid balance |
| customerId | string | No | Filter by customer ID |
| docNumber | string | No | Filter by invoice number |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |
| count | boolean | No | Return only count |
| fetchAll | boolean | No | Fetch all matching records |

**Example Request:**
```json
{
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31",
  "balanceMin": 0.01,
  "desc": "TotalAmt",
  "limit": 50
}
```

---

## Items

Items are products or services that a company buys, sells, or resells.

### create_item

**Description:** Create an item in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Item name (must be unique) |
| type | string | Yes | Item type (Service, Inventory, NonInventory) |
| income_account_ref | string | Yes | Income account ID for sales |
| expense_account_ref | string | No | Expense account ID for purchases |
| unit_price | number | No | Sales price |
| description | string | No | Item description |
| idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "name": "Consulting Services",
  "type": "Service",
  "income_account_ref": "1",
  "unit_price": 150.00,
  "description": "Professional consulting services",
  "idempotencyKey": "item-consulting-001"
}
```

**Example Response:**
```json
{
  "Id": "601",
  "Name": "Consulting Services",
  "Type": "Service",
  "UnitPrice": 150.00,
  "Active": true,
  "SyncToken": "0"
}
```

---

### read_item

**Description:** Read a single item in QuickBooks Online by its ID.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| item_id | string | Yes | Item ID to retrieve |

**Example Request:**
```json
{
  "item_id": "601"
}
```

---

### update_item

**Description:** Update an existing item (product/service) in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| item.Id | string | Yes | Item ID to update |
| item.SyncToken | string | Yes | Current sync token |
| item.Name | string | No | Item name (max 100 chars, must be unique) |
| item.Type | string | No | Inventory, Service, or NonInventory |
| item.Description | string | No | Item description (max 4000 chars) |
| item.UnitPrice | number | No | Sales price |
| item.PurchaseCost | number | No | Purchase cost |
| item.Taxable | boolean | No | Whether item is taxable |
| item.Active | boolean | No | Whether item is active |
| item.IncomeAccountRef | object | No | Income account { value: "accountId" } |
| item.ExpenseAccountRef | object | No | Expense account { value: "accountId" } |
| item.AssetAccountRef | object | No | Asset account for inventory { value: "accountId" } |
| item.Sku | string | No | Stock keeping unit (max 100 chars) |
| item.QtyOnHand | number | No | Quantity on hand (inventory items) |

**Example Request:**
```json
{
  "item": {
    "Id": "601",
    "SyncToken": "0",
    "UnitPrice": 175.00,
    "Description": "Updated consulting services"
  }
}
```

---

### search_items

**Description:** Search items (products and services) in QuickBooks Online with advanced filtering.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | No | Service, Inventory, NonInventory, Group, Category |
| active | boolean | No | Filter by active status |
| unitPriceMin | number | No | Minimum unit price |
| unitPriceMax | number | No | Maximum unit price |
| name | string | No | Filter by name (use % for LIKE matching) |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |
| count | boolean | No | Return only count |
| fetchAll | boolean | No | Fetch all matching records |

**Example Request:**
```json
{
  "type": "Service",
  "active": true,
  "unitPriceMin": 50,
  "asc": "Name",
  "limit": 100
}
```

---

## Journal Entries

Journal entries are double-entry transactions for recording debits and credits directly to accounts.

### create_journal_entry

**Description:** Create a journal entry in QuickBooks Online.

**Important:** Total debits must equal total credits for the entry to be valid.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| journalEntry.Line | array | Yes | Array of journal lines (minimum 2) |
| journalEntry.Line[].Amount | number | Yes | Line amount (always positive) |
| journalEntry.Line[].DetailType | string | Yes | Must be "JournalEntryLineDetail" |
| journalEntry.Line[].JournalEntryLineDetail | object | Yes | Line detail |
| journalEntry.Line[].JournalEntryLineDetail.AccountRef | object | Yes | Account { value: "accountId" } |
| journalEntry.Line[].JournalEntryLineDetail.PostingType | string | Yes | "Debit" or "Credit" |
| journalEntry.Line[].Description | string | No | Line description |
| journalEntry.TxnDate | string | No | Transaction date (YYYY-MM-DD) |
| journalEntry.DocNumber | string | No | Reference number |
| journalEntry.PrivateNote | string | No | Internal note |
| journalEntry.Adjustment | boolean | No | True if adjusting entry |
| journalEntry.CurrencyRef | object | No | Currency (for multi-currency) |
| idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "journalEntry": {
    "TxnDate": "2026-01-31",
    "DocNumber": "JE-001",
    "Line": [
      {
        "Amount": 500.00,
        "DetailType": "JournalEntryLineDetail",
        "JournalEntryLineDetail": {
          "AccountRef": { "value": "1" },
          "PostingType": "Debit"
        },
        "Description": "Office Supplies Expense"
      },
      {
        "Amount": 500.00,
        "DetailType": "JournalEntryLineDetail",
        "JournalEntryLineDetail": {
          "AccountRef": { "value": "2" },
          "PostingType": "Credit"
        },
        "Description": "Checking Account"
      }
    ]
  },
  "idempotencyKey": "je-001-2026"
}
```

**Common Errors:**
- `Debits must equal Credits`: Line amounts don't balance

---

### get_journal_entry

**Description:** Get a journal entry by ID from QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Journal entry ID to retrieve |

**Example Request:**
```json
{
  "id": "701"
}
```

---

### update_journal_entry

**Description:** Update an existing journal entry in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| journalEntry.Id | string | Yes | Journal entry ID to update |
| journalEntry.SyncToken | string | Yes | Current sync token |
| journalEntry.Line | array | No | Lines (replaces ALL existing if provided) |
| journalEntry.TxnDate | string | No | Transaction date (YYYY-MM-DD) |
| journalEntry.DocNumber | string | No | Reference number (max 21 chars) |
| journalEntry.PrivateNote | string | No | Internal note (max 4000 chars) |
| journalEntry.Adjustment | boolean | No | Whether this is an adjusting entry |

**Example Request:**
```json
{
  "journalEntry": {
    "Id": "701",
    "SyncToken": "0",
    "TxnDate": "2026-01-15",
    "PrivateNote": "Corrected entry date"
  }
}
```

---

### delete_journal_entry

**Description:** Delete (void) a journal entry in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| idOrEntity.Id | string | Yes | Journal entry ID to delete |
| idOrEntity.SyncToken | string | Yes | Current sync token |

**Example Request:**
```json
{
  "idOrEntity": {
    "Id": "701",
    "SyncToken": "1"
  }
}
```

---

### search_journal_entries

**Description:** Search journal entries in QuickBooks Online with advanced filtering.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| txnDateFrom | string | No | Start of transaction date range (YYYY-MM-DD) |
| txnDateTo | string | No | End of transaction date range |
| totalAmtMin | number | No | Minimum total amount |
| totalAmtMax | number | No | Maximum total amount |
| docNumber | string | No | Filter by document number (use % for LIKE) |
| adjustment | boolean | No | Filter by adjustment flag |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |
| count | boolean | No | Return only count |
| fetchAll | boolean | No | Fetch all matching records |

**Example Request:**
```json
{
  "txnDateFrom": "2026-01-01",
  "txnDateTo": "2026-01-31",
  "totalAmtMin": 1000,
  "desc": "TxnDate",
  "limit": 100
}
```

---

## Purchases

Purchases (expenses) are transactions recording money spent, typically categorized by expense account.

### create_purchase

**Description:** Create a new expense/purchase transaction in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| purchase.txnDate | string | Yes | Transaction date (YYYY-MM-DD) |
| purchase.paymentType | string | Yes | Cash, Check, or CreditCard |
| purchase.paymentAccountId | string | Yes | Bank or CreditCard account ID |
| purchase.lines | array | Yes | Array of expense line items |
| purchase.lines[].amount | number | Yes | Line amount (positive) |
| purchase.lines[].expenseAccountId | string | Yes | Expense account/category ID |
| purchase.lines[].description | string | No | Line description |
| purchase.lines[].taxCodeId | string | No | Tax code ID |
| purchase.lines[].customerId | string | No | Customer ID for billable |
| purchase.lines[].classId | string | No | Class ID for tracking |
| purchase.lines[].billable | boolean | No | Whether expense is billable |
| purchase.vendorId | string | No | Vendor/payee ID |
| purchase.memo | string | No | Printed memo |
| purchase.privateNote | string | No | Internal note |
| purchase.referenceNumber | string | No | Reference number |
| purchase.globalTaxCalculation | string | No | TaxExcluded, TaxInclusive, NotApplicable |
| purchase.idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "purchase": {
    "txnDate": "2026-01-31",
    "paymentType": "CreditCard",
    "paymentAccountId": "123",
    "vendorId": "456",
    "memo": "Office supplies",
    "lines": [
      {
        "amount": 99.99,
        "expenseAccountId": "789",
        "description": "Printer paper"
      }
    ],
    "idempotencyKey": "purch-office-supplies-001"
  }
}
```

**Example Response:**
```json
{
  "id": "801",
  "txnDate": "2026-01-31",
  "paymentType": "CreditCard",
  "vendorName": "Office Depot",
  "totalAmount": 99.99,
  "memo": "Office supplies"
}
```

---

### get_purchase

**Description:** Get a purchase by ID from QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Purchase ID to retrieve |

**Example Request:**
```json
{
  "id": "801"
}
```

---

### update_purchase

**Description:** Update an existing expense/purchase transaction in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| purchase.purchaseId | string | Yes | Purchase ID to update |
| purchase.txnDate | string | No | Transaction date (YYYY-MM-DD) |
| purchase.paymentType | string | No | Cash, Check, or CreditCard |
| purchase.paymentAccountId | string | No | Payment account ID |
| purchase.vendorId | string | No | Vendor/payee ID |
| purchase.vendorName | string | No | Vendor name (resolves to ID) |
| purchase.memo | string | No | Printed memo |
| purchase.privateNote | string | No | Internal note |
| purchase.referenceNumber | string | No | Reference number |
| purchase.globalTaxCalculation | string | No | Tax calculation mode |
| purchase.lines | array | No | Lines (replaces ALL existing) |

**Example Request:**
```json
{
  "purchase": {
    "purchaseId": "801",
    "memo": "Updated office supplies order",
    "privateNote": "Approved by manager"
  }
}
```

---

### delete_purchase

**Description:** Delete (void) a purchase/expense in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| idOrEntity.Id | string | Yes | Purchase ID to delete |
| idOrEntity.SyncToken | string | Yes | Current sync token |

**Example Request:**
```json
{
  "idOrEntity": {
    "Id": "801",
    "SyncToken": "1"
  }
}
```

---

### search_purchases

**Description:** Search expense/purchase transactions in QuickBooks Online with advanced filtering.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| dateFrom | string | No | Start of transaction date range (YYYY-MM-DD) |
| dateTo | string | No | End of transaction date range |
| minAmount | number | No | Minimum total amount |
| maxAmount | number | No | Maximum total amount |
| vendorId | string | No | Filter by vendor ID |
| paymentAccountId | string | No | Filter by payment account ID |
| paymentType | string | No | Cash, Check, or CreditCard |
| text | string | No | Search text in memo (partial match) |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |
| count | boolean | No | Return only count |
| fetchAll | boolean | No | Fetch all matching records |

**Example Request:**
```json
{
  "dateFrom": "2026-01-01",
  "dateTo": "2026-01-31",
  "paymentType": "CreditCard",
  "minAmount": 100,
  "desc": "TotalAmt",
  "limit": 50
}
```

---

## Vendors

Vendors are companies or individuals from whom you purchase goods or services.

### create-vendor

**Description:** Create a vendor in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| vendor.DisplayName | string | Yes | Unique display name |
| vendor.GivenName | string | No | First name |
| vendor.FamilyName | string | No | Last name |
| vendor.CompanyName | string | No | Company/business name |
| vendor.PrimaryEmailAddr | object | No | Email { Address: string } |
| vendor.PrimaryPhone | object | No | Phone { FreeFormNumber: string } |
| vendor.BillAddr | object | No | Billing address |
| idempotencyKey | string | No | Key to prevent duplicate creation |

**Example Request:**
```json
{
  "vendor": {
    "DisplayName": "Office Depot",
    "CompanyName": "Office Depot Inc",
    "PrimaryEmailAddr": { "Address": "orders@officedepot.com" },
    "PrimaryPhone": { "FreeFormNumber": "800-555-1234" },
    "BillAddr": {
      "Line1": "100 Supplier Way",
      "City": "Atlanta",
      "CountrySubDivisionCode": "GA",
      "PostalCode": "30301",
      "Country": "USA"
    }
  },
  "idempotencyKey": "vendor-office-depot-001"
}
```

**Example Response:**
```json
{
  "Id": "456",
  "DisplayName": "Office Depot",
  "CompanyName": "Office Depot Inc",
  "Active": true,
  "Balance": 0,
  "SyncToken": "0"
}
```

---

### get-vendor

**Description:** Get a vendor by ID from QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Vendor ID to retrieve |

**Example Request:**
```json
{
  "id": "456"
}
```

---

### update-vendor

**Description:** Update a vendor in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| vendor.Id | string | Yes | Vendor ID to update |
| vendor.SyncToken | string | Yes | Current sync token |
| vendor.DisplayName | string | Yes | Display name (required for update) |
| vendor.GivenName | string | No | First name |
| vendor.FamilyName | string | No | Last name |
| vendor.CompanyName | string | No | Company name |
| vendor.PrimaryEmailAddr | object | No | Email address |
| vendor.PrimaryPhone | object | No | Phone number |
| vendor.BillAddr | object | No | Billing address |

**Example Request:**
```json
{
  "vendor": {
    "Id": "456",
    "SyncToken": "0",
    "DisplayName": "Office Depot Inc",
    "PrimaryPhone": { "FreeFormNumber": "800-555-9999" }
  }
}
```

---

### delete-vendor

**Description:** Delete (make inactive) a vendor in QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| vendor.Id | string | Yes | Vendor ID to delete |
| vendor.SyncToken | string | Yes | Current sync token |

**Example Request:**
```json
{
  "vendor": {
    "Id": "456",
    "SyncToken": "1"
  }
}
```

---

### search_vendors

**Description:** Search vendors in QuickBooks Online that match given criteria.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| criteria | array | No | Array of filter criteria |
| criteria[].field | string | No | Field to filter (DisplayName, CompanyName, Active, Balance, etc.) |
| criteria[].value | string/boolean | No | Value to match |
| criteria[].operator | string | No | Comparison operator (=, <, >, LIKE, etc.) |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |
| fetchAll | boolean | No | Fetch all matching records |
| count | boolean | No | Return only count |

**Searchable Fields:** Id, DisplayName, CompanyName, GivenName, FamilyName, Active, Balance, BillRate, AcctNum, Vendor1099, PrimaryEmailAddr, PrimaryPhone, Mobile, WebAddr

**Example Request:**
```json
{
  "criteria": [
    { "field": "Active", "value": true },
    { "field": "DisplayName", "value": "%Office%", "operator": "LIKE" }
  ],
  "asc": "DisplayName",
  "limit": 50
}
```

---

## Tax Codes

Tax codes define tax rates applied to transactions.

### get_tax_code

**Description:** Get a tax code by ID from QuickBooks Online.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Tax code ID to retrieve |

**Example Request:**
```json
{
  "id": "TAX"
}
```

**Example Response:**
```json
{
  "Id": "2",
  "Name": "TAX",
  "Description": "State Tax",
  "Active": true,
  "Taxable": true,
  "TaxGroup": false
}
```

---

### search_tax_codes

**Description:** Search and list tax codes in QuickBooks Online.

Use this to find the correct TaxCodeRef value when creating expenses/purchases.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| criteria | array | No | Array of filter criteria |
| criteria[].field | string | No | Id, Name, Active, Taxable, TaxGroup, Description |
| criteria[].value | string/boolean | No | Value to match |
| criteria[].operator | string | No | =, <, >, LIKE, etc. |
| fetchAll | boolean | No | Fetch all matching codes |
| limit | number | No | Maximum results |
| offset | number | No | Records to skip |
| asc | string | No | Sort ascending by field |
| desc | string | No | Sort descending by field |

**Common Tax Codes:**
- **TAX/taxable codes**: Apply sales tax (GST, HST, PST, QST depending on jurisdiction)
- **NON/exempt codes**: No tax applied (for tips, exempt items)

**Example Request:**
```json
{
  "criteria": [
    { "field": "Active", "value": true },
    { "field": "Taxable", "value": true }
  ],
  "asc": "Name"
}
```

**Example Response:**
```json
[
  { "id": "2", "name": "TAX", "description": "State Tax", "active": true, "taxable": true },
  { "id": "5", "name": "GST", "description": "Goods and Services Tax", "active": true, "taxable": true }
]
```

---

## Attachments

Attachments allow you to upload and manage files (receipts, documents) linked to QuickBooks entities.

### upload_attachment

**Description:** Upload a file attachment (receipt, document) to a QuickBooks entity.

**Supported File Types:** JPEG, PNG, GIF, TIFF, PDF

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file_path | string | Yes | Path to file (supports ~ for home directory) |
| entity_type | string | Yes | Purchase, Invoice, Bill, Estimate, Vendor, Customer, JournalEntry |
| entity_id | string | Yes | ID of the entity to attach to |

**Example Request:**
```json
{
  "file_path": "~/receipts/office-supplies-2026-01-31.pdf",
  "entity_type": "Purchase",
  "entity_id": "801"
}
```

**Example Response:**
```json
{
  "Id": "1001",
  "FileName": "office-supplies-2026-01-31.pdf",
  "FileAccessUri": "https://...",
  "Size": 125432
}
```

**Common Errors:**
- `File not found`: Specified file path does not exist
- `Unsupported file type`: File type is not JPEG, PNG, GIF, TIFF, or PDF

---

### get_attachments

**Description:** Get all attachments linked to a QuickBooks entity.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| entity_type | string | Yes | Purchase, Invoice, Bill, Estimate, Vendor, Customer, JournalEntry |
| entity_id | string | Yes | ID of the entity |

**Example Request:**
```json
{
  "entity_type": "Purchase",
  "entity_id": "801"
}
```

**Example Response:**
```json
[
  {
    "Id": "1001",
    "FileName": "receipt.pdf",
    "FileAccessUri": "https://...",
    "Size": 125432,
    "ContentType": "application/pdf"
  }
]
```

---

### download_attachment

**Description:** Download an attachment from QuickBooks to a local file.

**Input Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| attachment_id | string | Yes | QuickBooks attachment ID to download |
| destination_path | string | Yes | Local path or directory (supports ~ for home) |

**Note:** Use `get_attachments` first to find the attachment ID for an entity. If destination_path is a directory, the original filename will be used.

**Example Request:**
```json
{
  "attachment_id": "1001",
  "destination_path": "~/downloads/"
}
```

**Example Response:**
```json
{
  "filePath": "/home/user/downloads/receipt.pdf",
  "size": 125432
}
```

**Common Errors:**
- `Attachment not found`: Specified attachment ID does not exist
- `Permission denied`: Cannot write to destination path

---

## Error Handling

All tools follow a consistent error response format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error [operation]: [error message]"
    }
  ]
}
```

### Common Error Types

| Error | Description | Resolution |
|-------|-------------|------------|
| `Stale Object Error` | SyncToken is outdated | Fetch current entity and retry with new SyncToken |
| `Object Not Found` | Entity doesn't exist | Verify the ID is correct |
| `Duplicate Name Exists Error` | Name must be unique | Use a different name |
| `Business Validation Error` | Data doesn't meet business rules | Check field values and requirements |
| `Authentication Error` | OAuth tokens expired | Re-authenticate with QuickBooks |
| `Rate Limit Exceeded` | Too many API requests | Wait and retry with exponential backoff |

---

## Rate Limiting

QuickBooks Online API has rate limits. The MCP server handles these automatically with:
- Exponential backoff on rate limit errors
- Request queuing to prevent burst requests
- Automatic token refresh before expiration

If you encounter rate limit errors, reduce request frequency or use batch operations where possible.

---

## Changelog

- **v1.0.0** (2026-01-31): Initial release with 54 tools covering all major QuickBooks Online entities
