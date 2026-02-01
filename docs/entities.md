# QuickBooks Entity Reference

Complete documentation of QuickBooks Online entities, their fields, relationships, and usage patterns.

## Overview

QuickBooks Online uses a rich entity model to represent accounting data. Each entity has:
- **Required fields** - Must be provided when creating
- **Optional fields** - Can be set during create or update
- **Read-only fields** - Set by QuickBooks (Id, SyncToken, MetaData)
- **Reference fields** - Links to other entities

> **Official Documentation**: [Intuit Developer API Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)

---

## Core Entities

### Account

Represents a chart of accounts entry (bank account, expense category, income category, etc.).

#### Description
Accounts are the foundation of the accounting system. Every transaction ultimately affects one or more accounts. They're organized by type and can form hierarchies using sub-accounts.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `Name` | String | Account name (required, max 100 chars) |
| `AccountType` | Enum | Type of account (required) |
| `AccountSubType` | String | More specific classification |
| `Classification` | Enum | Asset, Liability, Equity, Revenue, Expense |
| `CurrentBalance` | Decimal | Current balance (read-only) |
| `Active` | Boolean | Whether account is active |
| `ParentRef` | Reference | Parent account for sub-accounts |
| `FullyQualifiedName` | String | Full path including parents (read-only) |

#### AccountType Enum Values

| Type | Classification | Description |
|------|----------------|-------------|
| `Bank` | Asset | Checking, savings, money market |
| `Accounts Receivable` | Asset | Money owed by customers |
| `Other Current Asset` | Asset | Short-term assets |
| `Fixed Asset` | Asset | Long-term assets (equipment, property) |
| `Other Asset` | Asset | Other assets |
| `Accounts Payable` | Liability | Money owed to vendors |
| `Credit Card` | Liability | Credit card accounts |
| `Other Current Liability` | Liability | Short-term liabilities |
| `Long Term Liability` | Liability | Long-term debt |
| `Equity` | Equity | Owner's equity, retained earnings |
| `Income` | Revenue | Sales, service income |
| `Other Income` | Revenue | Interest, other income |
| `Cost of Goods Sold` | Expense | Direct costs of products sold |
| `Expense` | Expense | Operating expenses |
| `Other Expense` | Expense | Non-operating expenses |

#### Required Fields for Create
- `Name`
- `AccountType`

#### Updatable Fields
- `Name`
- `AccountSubType`
- `Description`
- `Active`
- `ParentRef`

#### Relationships
- **ParentRef** → Account (for sub-accounts)
- Referenced by: Bill lines, Invoice lines, Purchase lines, Journal Entry lines

#### Common Use Cases
```javascript
// Create an expense account
{
  "Name": "Office Supplies",
  "AccountType": "Expense",
  "AccountSubType": "SuppliesMaterials"
}

// Create a sub-account
{
  "Name": "Printer Supplies",
  "AccountType": "Expense",
  "ParentRef": {
    "value": "123"  // Parent account ID
  }
}
```

---

### Bill

Represents a payable to a vendor (accounts payable transaction).

#### Description
Bills track money owed to vendors for goods or services received. They create an accounts payable entry and are later paid using Bill Payments.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `VendorRef` | Reference | Vendor being paid (required) |
| `APAccountRef` | Reference | Accounts Payable account |
| `TxnDate` | Date | Transaction date |
| `DueDate` | Date | Payment due date |
| `Balance` | Decimal | Remaining balance (read-only) |
| `TotalAmt` | Decimal | Total amount (read-only) |
| `Line` | Array | Line items (required) |
| `DocNumber` | String | Bill/reference number |
| `PrivateNote` | String | Internal memo |

#### Line Item Types

**AccountBasedExpenseLineDetail** - Expense to an account:
```javascript
{
  "DetailType": "AccountBasedExpenseLineDetail",
  "Amount": 150.00,
  "AccountBasedExpenseLineDetail": {
    "AccountRef": {
      "value": "123",
      "name": "Office Supplies"
    },
    "Description": "Printer paper",
    "BillableStatus": "NotBillable"
  }
}
```

**ItemBasedExpenseLineDetail** - Purchase of inventory/items:
```javascript
{
  "DetailType": "ItemBasedExpenseLineDetail",
  "Amount": 500.00,
  "ItemBasedExpenseLineDetail": {
    "ItemRef": {
      "value": "456",
      "name": "Widget"
    },
    "Qty": 10,
    "UnitPrice": 50.00,
    "BillableStatus": "NotBillable"
  }
}
```

#### Required Fields for Create
- `VendorRef`
- `Line` (at least one line item)

#### Updatable Fields
- `VendorRef`
- `TxnDate`
- `DueDate`
- `Line`
- `DocNumber`
- `PrivateNote`
- `APAccountRef`

#### Relationships
- **VendorRef** → Vendor (required)
- **APAccountRef** → Account (Accounts Payable type)
- **Line.AccountRef** → Account
- **Line.ItemRef** → Item
- Referenced by: BillPayment

#### Common Use Cases
```javascript
// Create a bill for office supplies
{
  "VendorRef": {
    "value": "56"
  },
  "TxnDate": "2024-01-15",
  "DueDate": "2024-02-15",
  "Line": [
    {
      "DetailType": "AccountBasedExpenseLineDetail",
      "Amount": 150.00,
      "AccountBasedExpenseLineDetail": {
        "AccountRef": { "value": "123" }
      }
    }
  ]
}
```

---

### Bill Payment

Records payment of one or more bills.

#### Description
Bill Payments reduce accounts payable by recording payments made to vendors. A single Bill Payment can pay multiple bills from the same vendor.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `VendorRef` | Reference | Vendor being paid (required) |
| `PayType` | Enum | Check or CreditCard (required) |
| `TotalAmt` | Decimal | Payment amount (required) |
| `TxnDate` | Date | Payment date |
| `Line` | Array | Bills being paid |
| `CheckPayment` | Object | Check details (if PayType=Check) |
| `CreditCardPayment` | Object | Card details (if PayType=CreditCard) |
| `DocNumber` | String | Check/reference number |

#### PayType Options

**Check Payment**:
```javascript
{
  "PayType": "Check",
  "CheckPayment": {
    "BankAccountRef": {
      "value": "35",
      "name": "Checking"
    }
  }
}
```

**Credit Card Payment**:
```javascript
{
  "PayType": "CreditCard",
  "CreditCardPayment": {
    "CCAccountRef": {
      "value": "42",
      "name": "Visa"
    }
  }
}
```

#### Line Items (Linking to Bills)
```javascript
{
  "Line": [
    {
      "Amount": 150.00,
      "LinkedTxn": [
        {
          "TxnId": "789",      // Bill ID
          "TxnType": "Bill"
        }
      ]
    }
  ]
}
```

#### Required Fields for Create
- `VendorRef`
- `PayType`
- `TotalAmt`
- `CheckPayment.BankAccountRef` (if PayType=Check)
- `CreditCardPayment.CCAccountRef` (if PayType=CreditCard)

#### Updatable Fields
- `TxnDate`
- `DocNumber`
- `PrivateNote`
- `Line`

#### Relationships
- **VendorRef** → Vendor (required)
- **CheckPayment.BankAccountRef** → Account (Bank type)
- **CreditCardPayment.CCAccountRef** → Account (Credit Card type)
- **Line.LinkedTxn** → Bill

#### Common Use Cases
```javascript
// Pay a bill with a check
{
  "VendorRef": { "value": "56" },
  "PayType": "Check",
  "TotalAmt": 150.00,
  "CheckPayment": {
    "BankAccountRef": { "value": "35" }
  },
  "Line": [
    {
      "Amount": 150.00,
      "LinkedTxn": [
        { "TxnId": "789", "TxnType": "Bill" }
      ]
    }
  ]
}
```

---

### Customer

Represents a customer or client who purchases goods/services.

#### Description
Customers are the recipients of invoices and the source of revenue. They can be organized hierarchically using sub-customers (jobs).

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `DisplayName` | String | Display name (required, unique) |
| `GivenName` | String | First name |
| `FamilyName` | String | Last name |
| `CompanyName` | String | Company/business name |
| `PrimaryEmailAddr` | Object | Primary email address |
| `PrimaryPhone` | Object | Primary phone number |
| `BillAddr` | Object | Billing address |
| `ShipAddr` | Object | Shipping address |
| `Balance` | Decimal | Open balance (read-only) |
| `BalanceWithJobs` | Decimal | Balance including sub-customers (read-only) |
| `ParentRef` | Reference | Parent customer (for sub-customers) |
| `Job` | Boolean | Whether this is a job/project |
| `Active` | Boolean | Whether customer is active |
| `Taxable` | Boolean | Whether customer is taxable |

#### Address Structure
```javascript
{
  "BillAddr": {
    "Line1": "123 Main Street",
    "Line2": "Suite 100",
    "City": "San Francisco",
    "CountrySubDivisionCode": "CA",
    "PostalCode": "94105",
    "Country": "USA"
  }
}
```

#### Email/Phone Structure
```javascript
{
  "PrimaryEmailAddr": {
    "Address": "customer@example.com"
  },
  "PrimaryPhone": {
    "FreeFormNumber": "(555) 123-4567"
  }
}
```

#### Required Fields for Create
- `DisplayName` (must be unique)

#### Updatable Fields
- `DisplayName`
- `GivenName`, `FamilyName`
- `CompanyName`
- `PrimaryEmailAddr`, `PrimaryPhone`
- `BillAddr`, `ShipAddr`
- `ParentRef`
- `Taxable`
- `Active`

#### Relationships
- **ParentRef** → Customer (for sub-customers/jobs)
- Referenced by: Invoice, Estimate, Payment

#### Common Use Cases
```javascript
// Create a customer
{
  "DisplayName": "ABC Company",
  "CompanyName": "ABC Company Inc.",
  "PrimaryEmailAddr": {
    "Address": "billing@abc.com"
  },
  "BillAddr": {
    "Line1": "123 Business Ave",
    "City": "San Francisco",
    "CountrySubDivisionCode": "CA",
    "PostalCode": "94105"
  }
}

// Create a sub-customer (job)
{
  "DisplayName": "ABC Company:Website Project",
  "ParentRef": { "value": "123" },
  "Job": true
}
```

---

### Employee

Represents an employee of the company.

#### Description
Employees are individuals who work for the company. This entity is used for payroll, time tracking, and billable time features.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `DisplayName` | String | Display name (required) |
| `GivenName` | String | First name |
| `FamilyName` | String | Last name |
| `SSN` | String | Social Security Number (**sensitive**) |
| `PrimaryAddr` | Object | Home address |
| `PrimaryPhone` | Object | Phone number |
| `PrimaryEmailAddr` | Object | Email address |
| `HiredDate` | Date | Date hired |
| `ReleasedDate` | Date | Date terminated |
| `BillableTime` | Boolean | Whether time is billable |
| `Active` | Boolean | Whether employee is active |
| `BillRate` | Decimal | Billable hourly rate |

#### Required Fields for Create
- `GivenName` or `FamilyName` (at least one)

#### Updatable Fields
- `GivenName`, `FamilyName`
- `DisplayName`
- `PrimaryAddr`, `PrimaryPhone`, `PrimaryEmailAddr`
- `HiredDate`, `ReleasedDate`
- `BillableTime`, `BillRate`
- `Active`

#### Security Note
> ⚠️ **SSN is sensitive data**. It is write-only (cannot be read back via API) and should be handled with extreme care. Never log or expose SSN values.

#### Relationships
- Referenced by: Time activities, Payroll transactions

#### Common Use Cases
```javascript
// Create an employee
{
  "GivenName": "John",
  "FamilyName": "Smith",
  "DisplayName": "John Smith",
  "HiredDate": "2024-01-15",
  "BillableTime": true,
  "BillRate": 75.00,
  "PrimaryEmailAddr": {
    "Address": "john.smith@company.com"
  }
}
```

---

### Estimate

Represents a quote or proposal to a customer.

#### Description
Estimates are quotes for potential work. They can be sent to customers and, if accepted, converted to invoices.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `CustomerRef` | Reference | Customer being quoted (required) |
| `TxnDate` | Date | Estimate date |
| `ExpirationDate` | Date | Quote expiration date |
| `TotalAmt` | Decimal | Total amount (read-only) |
| `TxnStatus` | Enum | Pending, Accepted, Closed, Rejected |
| `AcceptedDate` | Date | Date customer accepted |
| `AcceptedBy` | String | Who accepted the estimate |
| `Line` | Array | Line items |
| `DocNumber` | String | Estimate number |
| `CustomerMemo` | Object | Message to customer |
| `EmailStatus` | Enum | NotSet, NeedToSend, EmailSent |
| `PrintStatus` | Enum | NotSet, NeedToPrint, PrintComplete |

#### Line Items (SalesItemLineDetail)
```javascript
{
  "DetailType": "SalesItemLineDetail",
  "Amount": 500.00,
  "SalesItemLineDetail": {
    "ItemRef": {
      "value": "1",
      "name": "Consulting"
    },
    "Qty": 10,
    "UnitPrice": 50.00
  }
}
```

#### Required Fields for Create
- `CustomerRef`
- `Line` (at least one)

#### Updatable Fields
- `CustomerRef`
- `TxnDate`, `ExpirationDate`
- `Line`
- `DocNumber`
- `CustomerMemo`
- `PrivateNote`
- `TxnStatus`

#### Relationships
- **CustomerRef** → Customer (required)
- **Line.ItemRef** → Item
- Converts to → Invoice

#### Common Use Cases
```javascript
// Create an estimate
{
  "CustomerRef": { "value": "123" },
  "TxnDate": "2024-01-15",
  "ExpirationDate": "2024-02-15",
  "Line": [
    {
      "DetailType": "SalesItemLineDetail",
      "Amount": 500.00,
      "SalesItemLineDetail": {
        "ItemRef": { "value": "1" },
        "Qty": 10,
        "UnitPrice": 50.00
      }
    }
  ],
  "CustomerMemo": {
    "value": "Thank you for your business!"
  }
}
```

---

### Invoice

Represents a sales invoice to a customer.

#### Description
Invoices are requests for payment from customers. They create accounts receivable entries and can be paid through Payments.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `CustomerRef` | Reference | Customer being invoiced (required) |
| `TxnDate` | Date | Invoice date |
| `DueDate` | Date | Payment due date |
| `TotalAmt` | Decimal | Total amount (read-only) |
| `Balance` | Decimal | Remaining balance (read-only) |
| `Line` | Array | Line items (required) |
| `DocNumber` | String | Invoice number |
| `BillEmail` | Object | Email address for invoice |
| `EmailStatus` | Enum | NotSet, NeedToSend, EmailSent |
| `PrintStatus` | Enum | NotSet, NeedToPrint, PrintComplete |
| `CustomerMemo` | Object | Message to customer |
| `PrivateNote` | String | Internal memo |
| `SalesTermRef` | Reference | Payment terms |
| `LinkedTxn` | Array | Linked transactions (estimates, payments) |

#### Line Items (SalesItemLineDetail)
```javascript
{
  "DetailType": "SalesItemLineDetail",
  "Amount": 100.00,
  "SalesItemLineDetail": {
    "ItemRef": {
      "value": "1",
      "name": "Consulting"
    },
    "Qty": 2,
    "UnitPrice": 50.00,
    "TaxCodeRef": {
      "value": "TAX"
    }
  }
}
```

#### Required Fields for Create
- `CustomerRef`
- `Line` (at least one line with SalesItemLineDetail)

#### Updatable Fields
- `CustomerRef`
- `TxnDate`, `DueDate`
- `Line`
- `DocNumber`
- `BillEmail`
- `CustomerMemo`
- `PrivateNote`
- `SalesTermRef`

#### Relationships
- **CustomerRef** → Customer (required)
- **Line.ItemRef** → Item
- **Line.TaxCodeRef** → TaxCode
- **SalesTermRef** → Term
- **LinkedTxn** → Estimate, Payment

#### Common Use Cases
```javascript
// Create an invoice
{
  "CustomerRef": { "value": "123" },
  "TxnDate": "2024-01-15",
  "DueDate": "2024-02-15",
  "Line": [
    {
      "DetailType": "SalesItemLineDetail",
      "Amount": 150.00,
      "SalesItemLineDetail": {
        "ItemRef": { "value": "1" },
        "Qty": 3,
        "UnitPrice": 50.00
      }
    }
  ],
  "BillEmail": {
    "Address": "customer@example.com"
  }
}
```

---

### Item

Represents a product or service that can be sold or purchased.

#### Description
Items are the products and services in your catalog. They can be used on invoices (sales), bills (purchases), or both.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `Name` | String | Item name (required) |
| `Type` | Enum | Service, Inventory, NonInventory, etc. |
| `Active` | Boolean | Whether item is active |
| `UnitPrice` | Decimal | Sales price |
| `PurchaseCost` | Decimal | Purchase cost |
| `IncomeAccountRef` | Reference | Sales income account |
| `ExpenseAccountRef` | Reference | Purchase expense account |
| `AssetAccountRef` | Reference | Inventory asset account |
| `Description` | String | Sales description |
| `PurchaseDesc` | String | Purchase description |
| `TrackQtyOnHand` | Boolean | Track inventory quantity |
| `QtyOnHand` | Decimal | Current quantity (if tracking) |
| `InvStartDate` | Date | Inventory tracking start date |
| `Taxable` | Boolean | Whether item is taxable |
| `SalesTaxIncluded` | Boolean | Whether price includes tax |
| `Sku` | String | Stock keeping unit |

#### Type Enum Values

| Type | Description |
|------|-------------|
| `Service` | Non-physical service |
| `Inventory` | Physical product (tracks quantity) |
| `NonInventory` | Physical product (no quantity tracking) |
| `Bundle` | Collection of items sold together |
| `Group` | Items grouped on transactions |
| `Category` | Item category (organizational) |

#### Required Fields for Create

**For Service items**:
- `Name`
- `IncomeAccountRef` (if selling) or `ExpenseAccountRef` (if purchasing)

**For Inventory items**:
- `Name`
- `Type: "Inventory"`
- `IncomeAccountRef`
- `ExpenseAccountRef`
- `AssetAccountRef`
- `TrackQtyOnHand: true`
- `QtyOnHand`
- `InvStartDate`

#### Updatable Fields
- `Name`
- `Active`
- `UnitPrice`, `PurchaseCost`
- `Description`, `PurchaseDesc`
- `Taxable`
- `Sku`
- `QtyOnHand` (only through inventory adjustments)

#### Relationships
- **IncomeAccountRef** → Account (Income type)
- **ExpenseAccountRef** → Account (Expense or COGS type)
- **AssetAccountRef** → Account (Asset type)
- Referenced by: Invoice lines, Bill lines, Estimate lines

#### Common Use Cases
```javascript
// Create a service item
{
  "Name": "Consulting",
  "Type": "Service",
  "UnitPrice": 150.00,
  "IncomeAccountRef": { "value": "1" },
  "Description": "Professional consulting services"
}

// Create an inventory item
{
  "Name": "Widget",
  "Type": "Inventory",
  "TrackQtyOnHand": true,
  "QtyOnHand": 100,
  "InvStartDate": "2024-01-01",
  "UnitPrice": 25.00,
  "PurchaseCost": 10.00,
  "IncomeAccountRef": { "value": "1" },
  "ExpenseAccountRef": { "value": "54" },
  "AssetAccountRef": { "value": "81" }
}
```

---

### Journal Entry

Represents a manual accounting entry (debits and credits).

#### Description
Journal entries allow direct manipulation of account balances. They must always balance (total debits = total credits).

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `TxnDate` | Date | Transaction date |
| `DocNumber` | String | Entry number |
| `Line` | Array | Debit and credit lines (required) |
| `PrivateNote` | String | Internal memo |
| `Adjustment` | Boolean | Whether this is an adjustment entry |
| `TotalAmt` | Decimal | Total of all lines (read-only) |

#### Line Items (JournalEntryLineDetail)
```javascript
// Debit line
{
  "DetailType": "JournalEntryLineDetail",
  "Amount": 500.00,
  "JournalEntryLineDetail": {
    "PostingType": "Debit",
    "AccountRef": {
      "value": "123",
      "name": "Office Supplies"
    },
    "Description": "Office supplies purchase"
  }
}

// Credit line
{
  "DetailType": "JournalEntryLineDetail",
  "Amount": 500.00,
  "JournalEntryLineDetail": {
    "PostingType": "Credit",
    "AccountRef": {
      "value": "35",
      "name": "Checking"
    },
    "Description": "Payment from checking"
  }
}
```

#### Required Fields for Create
- `Line` (must have at least one debit and one credit)
- Lines must balance (sum of debits = sum of credits)

#### Updatable Fields
- `TxnDate`
- `DocNumber`
- `Line`
- `PrivateNote`

#### Balance Requirement
> ⚠️ **Journal entries must balance**. The total of all debit lines must equal the total of all credit lines, or the API will reject the entry.

#### Relationships
- **Line.AccountRef** → Account
- **Line.Entity** → Customer, Vendor, or Employee (optional)

#### Common Use Cases
```javascript
// Record an owner's contribution
{
  "TxnDate": "2024-01-15",
  "DocNumber": "JE-001",
  "Line": [
    {
      "DetailType": "JournalEntryLineDetail",
      "Amount": 10000.00,
      "JournalEntryLineDetail": {
        "PostingType": "Debit",
        "AccountRef": { "value": "35" },  // Checking
        "Description": "Owner contribution"
      }
    },
    {
      "DetailType": "JournalEntryLineDetail",
      "Amount": 10000.00,
      "JournalEntryLineDetail": {
        "PostingType": "Credit",
        "AccountRef": { "value": "92" },  // Owner's Equity
        "Description": "Owner contribution"
      }
    }
  ]
}
```

---

### Purchase

Represents a direct expense or purchase (check, credit card, or cash).

#### Description
Purchases record expenses that are paid immediately (not on credit like Bills). They can be checks, credit card charges, or cash payments.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `PaymentType` | Enum | Cash, Check, or CreditCard (required) |
| `AccountRef` | Reference | Payment account (required) |
| `EntityRef` | Reference | Vendor being paid |
| `TxnDate` | Date | Transaction date |
| `TotalAmt` | Decimal | Total amount (read-only) |
| `Line` | Array | Expense line items (required) |
| `DocNumber` | String | Check/reference number |
| `PrivateNote` | String | Internal memo |
| `Credit` | Boolean | Whether this is a refund/credit |

#### PaymentType Options

| Type | AccountRef Must Be |
|------|-------------------|
| `Cash` | Bank or Cash account |
| `Check` | Bank account |
| `CreditCard` | Credit Card account |

#### Line Items

Same as Bill:
- `AccountBasedExpenseLineDetail` - Expense to an account
- `ItemBasedExpenseLineDetail` - Purchase of items

#### Required Fields for Create
- `PaymentType`
- `AccountRef`
- `Line` (at least one)

#### Updatable Fields
- `TxnDate`
- `EntityRef`
- `Line`
- `DocNumber`
- `PrivateNote`

#### Relationships
- **AccountRef** → Account (Bank or Credit Card)
- **EntityRef** → Vendor
- **Line.AccountRef** → Account
- **Line.ItemRef** → Item

#### Common Use Cases
```javascript
// Record a credit card expense
{
  "PaymentType": "CreditCard",
  "AccountRef": { "value": "42" },  // Visa card
  "EntityRef": { 
    "value": "56",
    "type": "Vendor"
  },
  "TxnDate": "2024-01-15",
  "Line": [
    {
      "DetailType": "AccountBasedExpenseLineDetail",
      "Amount": 75.00,
      "AccountBasedExpenseLineDetail": {
        "AccountRef": { "value": "123" }  // Meals expense
      }
    }
  ]
}

// Write a check
{
  "PaymentType": "Check",
  "AccountRef": { "value": "35" },  // Checking
  "DocNumber": "1234",
  "TxnDate": "2024-01-15",
  "Line": [
    {
      "DetailType": "AccountBasedExpenseLineDetail",
      "Amount": 200.00,
      "AccountBasedExpenseLineDetail": {
        "AccountRef": { "value": "456" }
      }
    }
  ]
}
```

---

### Vendor

Represents a supplier or vendor from whom you purchase goods/services.

#### Description
Vendors are suppliers you pay for goods and services. They're the payees on bills and purchases.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier (read-only) |
| `DisplayName` | String | Display name (required, unique) |
| `GivenName` | String | First name |
| `FamilyName` | String | Last name |
| `CompanyName` | String | Company name |
| `PrimaryEmailAddr` | Object | Primary email |
| `PrimaryPhone` | Object | Primary phone |
| `BillAddr` | Object | Billing/remit address |
| `Balance` | Decimal | Amount owed (read-only) |
| `Vendor1099` | Boolean | Whether vendor receives 1099 |
| `AcctNum` | String | Account number with vendor |
| `Active` | Boolean | Whether vendor is active |
| `TaxIdentifier` | String | Tax ID/EIN |

#### Required Fields for Create
- `DisplayName` (must be unique)

#### Updatable Fields
- `DisplayName`
- `GivenName`, `FamilyName`
- `CompanyName`
- `PrimaryEmailAddr`, `PrimaryPhone`
- `BillAddr`
- `Vendor1099`
- `AcctNum`
- `Active`

#### 1099 Tracking
> If `Vendor1099` is true, payments to this vendor will be tracked for 1099-MISC reporting. Ensure TaxIdentifier is set for accurate reporting.

#### Relationships
- Referenced by: Bill, Purchase, BillPayment

#### Common Use Cases
```javascript
// Create a vendor
{
  "DisplayName": "Office Supply Co",
  "CompanyName": "Office Supply Company Inc.",
  "Vendor1099": false,
  "PrimaryEmailAddr": {
    "Address": "orders@officesupply.com"
  },
  "PrimaryPhone": {
    "FreeFormNumber": "(555) 987-6543"
  },
  "BillAddr": {
    "Line1": "456 Vendor Lane",
    "City": "Los Angeles",
    "CountrySubDivisionCode": "CA",
    "PostalCode": "90001"
  }
}

// Create a 1099 contractor
{
  "DisplayName": "John Consultant",
  "GivenName": "John",
  "FamilyName": "Consultant",
  "Vendor1099": true,
  "TaxIdentifier": "XX-XXXXXXX"
}
```

---

### Tax Code

Represents a tax code/rate configuration (read-only).

#### Description
Tax codes define whether and how tax is applied to transactions. They reference tax rates and can apply to sales, purchases, or both.

#### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `Id` | String | Unique identifier |
| `Name` | String | Tax code name |
| `Description` | String | Description |
| `Active` | Boolean | Whether code is active |
| `Taxable` | Boolean | Whether this applies tax |
| `TaxGroup` | Boolean | Whether this is a group of rates |
| `SalesTaxRateList` | Object | Sales tax rates |
| `PurchaseTaxRateList` | Object | Purchase tax rates |

#### Read-Only Entity
> ⚠️ Tax codes are **read-only** via the API. They must be configured in the QuickBooks Online interface.

#### Common Tax Codes

| Code | Taxable | Description |
|------|---------|-------------|
| `TAX` | true | Standard taxable |
| `NON` | false | Non-taxable |

#### Usage in Transactions
```javascript
// On invoice/estimate lines
{
  "DetailType": "SalesItemLineDetail",
  "Amount": 100.00,
  "SalesItemLineDetail": {
    "ItemRef": { "value": "1" },
    "TaxCodeRef": { "value": "TAX" }
  }
}

// On bill/purchase lines
{
  "DetailType": "AccountBasedExpenseLineDetail",
  "Amount": 50.00,
  "AccountBasedExpenseLineDetail": {
    "AccountRef": { "value": "123" },
    "TaxCodeRef": { "value": "TAX" }
  }
}
```

---

## Common Patterns

### Reference Objects

Most entity relationships use reference objects with `value` (ID) and optional `name`:

```javascript
{
  "VendorRef": {
    "value": "56",           // Required: entity ID
    "name": "Vendor Name"    // Optional: display name (read-only on response)
  }
}
```

Common reference fields:
- `CustomerRef` → Customer
- `VendorRef` → Vendor
- `AccountRef` → Account
- `ItemRef` → Item
- `TaxCodeRef` → TaxCode
- `ParentRef` → Parent entity (same type)

### Line Item Types

Different transaction types use different line detail types:

| Transaction | Detail Type | Purpose |
|-------------|-------------|---------|
| Bill, Purchase | `AccountBasedExpenseLineDetail` | Expense to account |
| Bill, Purchase | `ItemBasedExpenseLineDetail` | Purchase of item |
| Invoice, Estimate | `SalesItemLineDetail` | Sale of item |
| Journal Entry | `JournalEntryLineDetail` | Debit/credit to account |
| All | `DescriptionOnly` | Text-only line (subtotals, notes) |

### SyncToken (Optimistic Locking)

Every entity has a `SyncToken` that changes on each update:

```javascript
// Response from GET
{
  "Id": "123",
  "SyncToken": "2",
  "DisplayName": "Customer Name"
}

// Must include SyncToken in UPDATE
{
  "Id": "123",
  "SyncToken": "2",           // Must match current value
  "DisplayName": "New Name"
}
```

> ⚠️ **Always fetch before update**. If the SyncToken doesn't match, the update will fail with a conflict error. This prevents concurrent updates from overwriting each other.

### MetaData Object

All entities include metadata about creation and modification:

```javascript
{
  "MetaData": {
    "CreateTime": "2024-01-15T10:30:00-08:00",
    "LastUpdatedTime": "2024-01-20T14:45:00-08:00"
  }
}
```

---

## Entity Lifecycle Examples

### Creating an Invoice from an Estimate

```javascript
// 1. First, create the estimate
const estimate = await createEstimate({
  CustomerRef: { value: "123" },
  Line: [
    {
      DetailType: "SalesItemLineDetail",
      Amount: 500.00,
      SalesItemLineDetail: {
        ItemRef: { value: "1" },
        Qty: 10,
        UnitPrice: 50.00
      }
    }
  ]
});

// 2. When customer accepts, create invoice linked to estimate
const invoice = await createInvoice({
  CustomerRef: { value: "123" },
  Line: [
    // Copy lines from estimate
    {
      DetailType: "SalesItemLineDetail",
      Amount: 500.00,
      SalesItemLineDetail: {
        ItemRef: { value: "1" },
        Qty: 10,
        UnitPrice: 50.00
      }
    }
  ],
  LinkedTxn: [
    {
      TxnId: estimate.Id,
      TxnType: "Estimate"
    }
  ]
});

// 3. Update estimate status
await updateEstimate({
  Id: estimate.Id,
  SyncToken: estimate.SyncToken,
  TxnStatus: "Accepted"
});
```

### Recording a Payment for a Bill

```javascript
// 1. Create the bill
const bill = await createBill({
  VendorRef: { value: "56" },
  DueDate: "2024-02-15",
  Line: [
    {
      DetailType: "AccountBasedExpenseLineDetail",
      Amount: 1000.00,
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: "123" }
      }
    }
  ]
});

// 2. When ready to pay, create bill payment
const payment = await createBillPayment({
  VendorRef: { value: "56" },
  PayType: "Check",
  TotalAmt: 1000.00,
  CheckPayment: {
    BankAccountRef: { value: "35" }
  },
  Line: [
    {
      Amount: 1000.00,
      LinkedTxn: [
        {
          TxnId: bill.Id,
          TxnType: "Bill"
        }
      ]
    }
  ]
});

// Bill.Balance is now 0 (read-only, auto-updated)
```

### Creating a Balanced Journal Entry

```javascript
// Reclassify an expense from one account to another
const journalEntry = await createJournalEntry({
  TxnDate: "2024-01-31",
  DocNumber: "JE-001",
  PrivateNote: "Reclassify office supplies to marketing",
  Line: [
    // Debit the destination account (increase expense)
    {
      DetailType: "JournalEntryLineDetail",
      Amount: 250.00,
      JournalEntryLineDetail: {
        PostingType: "Debit",
        AccountRef: { value: "789" },  // Marketing expense
        Description: "Reclassify from office supplies"
      }
    },
    // Credit the source account (decrease expense)
    {
      DetailType: "JournalEntryLineDetail",
      Amount: 250.00,
      JournalEntryLineDetail: {
        PostingType: "Credit",
        AccountRef: { value: "123" },  // Office supplies
        Description: "Reclassify to marketing"
      }
    }
  ]
});

// Entry is only accepted if debits ($250) = credits ($250)
```

---

## Entity Relationship Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Customer  │◄────────│   Invoice   │────────►│    Item     │
│             │         │             │         │             │
│ DisplayName │         │ CustomerRef │         │    Name     │
│ Balance     │         │ Line[]      │         │  UnitPrice  │
└─────────────┘         │ Balance     │         │IncomeAcct   │
      ▲                 └─────────────┘         └──────┬──────┘
      │                        │                       │
      │                        ▼                       ▼
      │                 ┌─────────────┐         ┌─────────────┐
      │                 │   Payment   │         │   Account   │
      │                 └─────────────┘         │             │
      │                                         │    Name     │
┌─────┴───────┐                                 │ AccountType │
│  Estimate   │                                 │ Balance     │
│             │                                 └──────┬──────┘
│ CustomerRef │                                        │
│ Line[]      │                                        │
└─────────────┘                                        ▼
                                                ┌─────────────┐
┌─────────────┐         ┌─────────────┐         │Journal Entry│
│   Vendor    │◄────────│    Bill     │────────►│             │
│             │         │             │         │ Line[]      │
│ DisplayName │         │ VendorRef   │         │ (Debits =   │
│ Balance     │         │ Line[]      │         │  Credits)   │
│ Vendor1099  │         │ Balance     │         └─────────────┘
└─────────────┘         └──────┬──────┘
      ▲                        │
      │                        ▼
      │                 ┌─────────────┐
      │                 │ BillPayment │
      │                 │             │
      │                 │ VendorRef   │
      │                 │ PayType     │
      │                 │ Line[]      │
      │                 └─────────────┘
      │
      │                 ┌─────────────┐
      └─────────────────│  Purchase   │
                        │             │
                        │ PaymentType │
                        │ AccountRef  │
                        │ EntityRef   │
                        │ Line[]      │
                        └─────────────┘
```

---

## Quick Reference

### Creating Transactions

| To... | Create... | Required Refs |
|-------|-----------|---------------|
| Invoice a customer | Invoice | CustomerRef, Line with ItemRef |
| Quote a customer | Estimate | CustomerRef, Line with ItemRef |
| Record a bill | Bill | VendorRef, Line with AccountRef or ItemRef |
| Pay a bill | BillPayment | VendorRef, PayType, BankAccountRef or CCAccountRef |
| Record an expense | Purchase | PaymentType, AccountRef, Line |
| Manual adjustment | JournalEntry | Balanced Line items with AccountRef |

### Entity Dependencies

| Entity | Depends On |
|--------|------------|
| Invoice | Customer, Item (for lines), TaxCode |
| Estimate | Customer, Item (for lines) |
| Bill | Vendor, Account or Item (for lines) |
| BillPayment | Vendor, Bill, Bank or CC Account |
| Purchase | Vendor (optional), Account (for payment and lines) |
| JournalEntry | Account (for all lines) |
| Item | Account (income, expense, asset) |
| Sub-Account | Parent Account |
| Sub-Customer | Parent Customer |
