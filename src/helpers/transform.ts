/**
 * Transform Helpers for QuickBooks MCP Server
 * 
 * Converts user-friendly input schemas to QBO API format and vice versa.
 */

import { 
  CreatePurchaseInput, 
  SimplifiedExpenseLineSchema,
  SearchPurchasesInput,
  SearchBillsInput,
  SearchInvoicesInput,
  SearchEstimatesInput,
  Purchase,
  Reference,
} from '../types/qbo-schemas.js';
import { z } from 'zod';

type SimplifiedExpenseLine = z.infer<typeof SimplifiedExpenseLineSchema>;

/**
 * Transform a simplified expense line to QBO format
 */
export function transformExpenseLineToQBO(line: SimplifiedExpenseLine): Record<string, unknown> {
  const qboLine: Record<string, unknown> = {
    Amount: line.amount,
    DetailType: 'AccountBasedExpenseLineDetail',
    Description: line.description,
    AccountBasedExpenseLineDetail: {
      AccountRef: {
        value: line.expenseAccountId,
        name: line.expenseAccountName,
      },
    },
  };

  const detail = qboLine.AccountBasedExpenseLineDetail as Record<string, unknown>;

  // Add tax code if provided
  if (line.taxCodeId) {
    detail.TaxCodeRef = { value: line.taxCodeId };
  }

  // Add customer for billable expenses
  if (line.customerId) {
    detail.CustomerRef = { value: line.customerId };
    if (line.billable !== false) {
      detail.BillableStatus = 'Billable';
    }
  }

  // Add class for tracking
  if (line.classId) {
    detail.ClassRef = { value: line.classId };
  }

  return qboLine;
}

/**
 * Transform simplified purchase input to QBO API format
 */
export function transformPurchaseToQBO(input: CreatePurchaseInput): Record<string, unknown> {
  const purchase: Record<string, unknown> = {
    PaymentType: input.paymentType,
    AccountRef: {
      value: input.paymentAccountId,
      name: input.paymentAccountName,
    },
    TxnDate: input.txnDate,
    Line: input.lines.map(transformExpenseLineToQBO),
  };

  // Add vendor/entity
  if (input.vendorId) {
    purchase.EntityRef = {
      value: input.vendorId,
      type: 'Vendor',
    };
  }

  // Add currency
  if (input.currency) {
    purchase.CurrencyRef = { value: input.currency };
  }

  // Add memo
  if (input.memo) {
    purchase.Memo = input.memo;
  }

  // Add private note
  if (input.privateNote) {
    purchase.PrivateNote = input.privateNote;
  }

  // Add reference number
  if (input.referenceNumber) {
    purchase.DocNumber = input.referenceNumber;
  }

  // Add global tax calculation
  if (input.globalTaxCalculation) {
    purchase.GlobalTaxCalculation = input.globalTaxCalculation;
  }

  // Add credit flag
  if (input.isCredit) {
    purchase.Credit = true;
  }

  return purchase;
}

/**
 * Build QBO search criteria from advanced search input
 */
export function buildPurchaseSearchCriteria(input: SearchPurchasesInput): {
  criteria: Array<Record<string, unknown>>;
  options: Record<string, unknown>;
} {
  const criteria: Array<Record<string, unknown>> = [];

  // Date range filters
  if (input.dateFrom) {
    criteria.push({
      field: 'TxnDate',
      value: input.dateFrom,
      operator: '>=',
    });
  }
  if (input.dateTo) {
    criteria.push({
      field: 'TxnDate',
      value: input.dateTo,
      operator: '<=',
    });
  }

  // Amount range filters
  if (input.minAmount !== undefined) {
    criteria.push({
      field: 'TotalAmt',
      value: input.minAmount.toString(),
      operator: '>=',
    });
  }
  if (input.maxAmount !== undefined) {
    criteria.push({
      field: 'TotalAmt',
      value: input.maxAmount.toString(),
      operator: '<=',
    });
  }

  // Vendor filter
  if (input.vendorId) {
    // Note: QBO uses EntityRef for vendor in Purchase queries
    criteria.push({
      field: 'EntityRef',
      value: input.vendorId,
    });
  }

  // Payment account filter
  if (input.paymentAccountId) {
    criteria.push({
      field: 'AccountRef',
      value: input.paymentAccountId,
    });
  }

  // Payment type filter
  if (input.paymentType) {
    criteria.push({
      field: 'PaymentType',
      value: input.paymentType,
    });
  }

  // Text search (memo or doc number)
  if (input.text) {
    // QBO doesn't support full-text search directly, use LIKE on specific fields
    // We'll search in memo with LIKE
    criteria.push({
      field: 'Memo',
      value: `%${input.text}%`,
      operator: 'LIKE',
    });
  }

  // Add any raw criteria
  if (input.criteria) {
    for (const c of input.criteria) {
      criteria.push({
        field: c.field,
        value: c.value,
        operator: c.operator || '=',
      });
    }
  }

  // Build options
  const options: Record<string, unknown> = {};
  
  if (input.asc) options.asc = input.asc;
  if (input.desc) options.desc = input.desc;
  if (input.limit) options.limit = input.limit;
  if (input.offset) options.offset = input.offset;
  if (input.count) options.count = input.count;
  if (input.fetchAll) options.fetchAll = input.fetchAll;

  return { criteria, options };
}

/**
 * Build QBO search criteria from advanced invoices search input
 */
export function buildInvoiceSearchCriteria(input: SearchInvoicesInput): {
  criteria: Array<Record<string, unknown>>;
  options: Record<string, unknown>;
} {
  const criteria: Array<Record<string, unknown>> = [];

  // Invoice date range filters (TxnDate)
  if (input.dateFrom) {
    criteria.push({
      field: 'TxnDate',
      value: input.dateFrom,
      operator: '>=',
    });
  }
  if (input.dateTo) {
    criteria.push({
      field: 'TxnDate',
      value: input.dateTo,
      operator: '<=',
    });
  }

  // Due date range filters
  if (input.dueFrom) {
    criteria.push({
      field: 'DueDate',
      value: input.dueFrom,
      operator: '>=',
    });
  }
  if (input.dueTo) {
    criteria.push({
      field: 'DueDate',
      value: input.dueTo,
      operator: '<=',
    });
  }

  // Amount range filters
  if (input.amountMin !== undefined) {
    criteria.push({
      field: 'TotalAmt',
      value: input.amountMin.toString(),
      operator: '>=',
    });
  }
  if (input.amountMax !== undefined) {
    criteria.push({
      field: 'TotalAmt',
      value: input.amountMax.toString(),
      operator: '<=',
    });
  }

  // Balance range filters
  if (input.balanceMin !== undefined) {
    criteria.push({
      field: 'Balance',
      value: input.balanceMin.toString(),
      operator: '>=',
    });
  }
  if (input.balanceMax !== undefined) {
    criteria.push({
      field: 'Balance',
      value: input.balanceMax.toString(),
      operator: '<=',
    });
  }

  // Customer filter
  if (input.customerId) {
    criteria.push({
      field: 'CustomerRef',
      value: input.customerId,
    });
  }

  // DocNumber filter
  if (input.docNumber) {
    criteria.push({
      field: 'DocNumber',
      value: input.docNumber,
    });
  }

  // Add any raw criteria
  if (input.criteria) {
    for (const c of input.criteria) {
      criteria.push({
        field: c.field,
        value: c.value,
        operator: c.operator || '=',
      });
    }
  }

  // Build options
  const options: Record<string, unknown> = {};
  
  if (input.asc) options.asc = input.asc;
  if (input.desc) options.desc = input.desc;
  if (input.limit) options.limit = input.limit;
  if (input.offset) options.offset = input.offset;
  if (input.count) options.count = input.count;
  if (input.fetchAll) options.fetchAll = input.fetchAll;

  return { criteria, options };
}

/**
 * Build QBO search criteria from advanced bills search input
 */
export function buildBillSearchCriteria(input: SearchBillsInput): {
  criteria: Array<Record<string, unknown>>;
  options: Record<string, unknown>;
} {
  const criteria: Array<Record<string, unknown>> = [];

  // Bill date range filters
  if (input.dateFrom) {
    criteria.push({
      field: 'TxnDate',
      value: input.dateFrom,
      operator: '>=',
    });
  }
  if (input.dateTo) {
    criteria.push({
      field: 'TxnDate',
      value: input.dateTo,
      operator: '<=',
    });
  }

  // Due date range filters
  if (input.dueDateFrom) {
    criteria.push({
      field: 'DueDate',
      value: input.dueDateFrom,
      operator: '>=',
    });
  }
  if (input.dueDateTo) {
    criteria.push({
      field: 'DueDate',
      value: input.dueDateTo,
      operator: '<=',
    });
  }

  // Amount range filters
  if (input.amountMin !== undefined) {
    criteria.push({
      field: 'TotalAmt',
      value: input.amountMin.toString(),
      operator: '>=',
    });
  }
  if (input.amountMax !== undefined) {
    criteria.push({
      field: 'TotalAmt',
      value: input.amountMax.toString(),
      operator: '<=',
    });
  }

  // Balance range filters
  if (input.balanceMin !== undefined) {
    criteria.push({
      field: 'Balance',
      value: input.balanceMin.toString(),
      operator: '>=',
    });
  }
  if (input.balanceMax !== undefined) {
    criteria.push({
      field: 'Balance',
      value: input.balanceMax.toString(),
      operator: '<=',
    });
  }

  // Vendor filter
  if (input.vendorId) {
    criteria.push({
      field: 'VendorRef',
      value: input.vendorId,
    });
  }

  // Payment status filter (derived from Balance)
  if (input.paymentStatus) {
    switch (input.paymentStatus) {
      case 'Paid':
        criteria.push({
          field: 'Balance',
          value: '0',
          operator: '=',
        });
        break;
      case 'Unpaid':
        // Unpaid means Balance > 0
        criteria.push({
          field: 'Balance',
          value: '0',
          operator: '>',
        });
        break;
      case 'PartiallyPaid':
        // PartiallyPaid means Balance > 0 AND Balance < TotalAmt
        // Note: QBO can't do Balance < TotalAmt in a single query, so we filter for Balance > 0
        // and let the client filter for partial payments
        criteria.push({
          field: 'Balance',
          value: '0',
          operator: '>',
        });
        break;
    }
  }

  // DocNumber filter
  if (input.docNumber) {
    criteria.push({
      field: 'DocNumber',
      value: input.docNumber,
    });
  }

  // Add any raw criteria
  if (input.criteria) {
    for (const c of input.criteria) {
      criteria.push({
        field: c.field,
        value: c.value,
        operator: c.operator || '=',
      });
    }
  }

  // Build options
  const options: Record<string, unknown> = {};
  
  if (input.asc) options.asc = input.asc;
  if (input.desc) options.desc = input.desc;
  if (input.limit) options.limit = input.limit;
  if (input.offset) options.offset = input.offset;
  if (input.count) options.count = input.count;
  if (input.fetchAll) options.fetchAll = input.fetchAll;

  return { criteria, options };
}

/**
 * Build QBO search criteria from advanced estimates search input
 */
export function buildEstimateSearchCriteria(input: SearchEstimatesInput): {
  criteria: Array<Record<string, unknown>>;
  options: Record<string, unknown>;
} {
  const criteria: Array<Record<string, unknown>> = [];

  // Transaction date range filters (TxnDate)
  if (input.dateFrom) {
    criteria.push({
      field: 'TxnDate',
      value: input.dateFrom,
      operator: '>=',
    });
  }
  if (input.dateTo) {
    criteria.push({
      field: 'TxnDate',
      value: input.dateTo,
      operator: '<=',
    });
  }

  // Expiration date range filters
  if (input.expirationFrom) {
    criteria.push({
      field: 'ExpirationDate',
      value: input.expirationFrom,
      operator: '>=',
    });
  }
  if (input.expirationTo) {
    criteria.push({
      field: 'ExpirationDate',
      value: input.expirationTo,
      operator: '<=',
    });
  }

  // Amount range filters (TotalAmt)
  if (input.amountMin !== undefined) {
    criteria.push({
      field: 'TotalAmt',
      value: input.amountMin.toString(),
      operator: '>=',
    });
  }
  if (input.amountMax !== undefined) {
    criteria.push({
      field: 'TotalAmt',
      value: input.amountMax.toString(),
      operator: '<=',
    });
  }

  // Customer filter
  if (input.customerId) {
    criteria.push({
      field: 'CustomerRef',
      value: input.customerId,
    });
  }

  // Status filter
  if (input.txnStatus) {
    criteria.push({
      field: 'TxnStatus',
      value: input.txnStatus,
    });
  }

  // Text search (DocNumber with LIKE)
  if (input.search) {
    criteria.push({
      field: 'DocNumber',
      value: `%${input.search}%`,
      operator: 'LIKE',
    });
  }

  // Add any raw criteria
  if (input.criteria) {
    for (const c of input.criteria) {
      criteria.push({
        field: c.field,
        value: c.value,
        operator: c.operator || '=',
      });
    }
  }

  // Build options
  const options: Record<string, unknown> = {};
  
  if (input.asc) options.asc = input.asc;
  if (input.desc) options.desc = input.desc;
  if (input.limit) options.limit = input.limit;
  if (input.offset) options.offset = input.offset;
  if (input.count) options.count = input.count;
  if (input.fetchAll) options.fetchAll = input.fetchAll;

  return { criteria, options };
}

/**
 * Transform QBO Bill response to user-friendly format
 */
export function transformBillFromQBO(bill: any): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: bill.Id,
    syncToken: bill.SyncToken,
    txnDate: bill.TxnDate,
    dueDate: bill.DueDate,
    totalAmt: bill.TotalAmt,
    balance: bill.Balance,
    docNumber: bill.DocNumber,
    memo: bill.Memo,
    privateNote: bill.PrivateNote,
    globalTaxCalculation: bill.GlobalTaxCalculation,
    createTime: bill.MetaData?.CreateTime,
    lastUpdatedTime: bill.MetaData?.LastUpdatedTime,
  };

  // Add vendor info if present
  if (bill.VendorRef) {
    result.vendor = {
      id: bill.VendorRef.value,
      name: bill.VendorRef.name,
    };
  }

  // Add AP account info if present
  if (bill.APAccountRef) {
    result.apAccount = {
      id: bill.APAccountRef.value,
      name: bill.APAccountRef.name,
    };
  }

  // Add department if present
  if (bill.DepartmentRef) {
    result.department = {
      id: bill.DepartmentRef.value,
      name: bill.DepartmentRef.name,
    };
  }

  // Add currency if present
  if (bill.CurrencyRef) {
    result.currency = bill.CurrencyRef.value;
    result.exchangeRate = bill.ExchangeRate;
  }

  // Add payment status derived from balance
  if (bill.Balance !== undefined && bill.TotalAmt !== undefined) {
    if (bill.Balance === 0) {
      result.paymentStatus = 'Paid';
    } else if (bill.Balance === bill.TotalAmt) {
      result.paymentStatus = 'Unpaid';
    } else {
      result.paymentStatus = 'PartiallyPaid';
    }
  }

  // Transform line items
  if (bill.Line && Array.isArray(bill.Line)) {
    result.lines = bill.Line.map((line: any) => ({
      id: line.Id,
      amount: line.Amount,
      description: line.Description,
      detailType: line.DetailType,
      ...(line.AccountBasedExpenseLineDetail && {
        account: {
          id: line.AccountBasedExpenseLineDetail.AccountRef?.value,
          name: line.AccountBasedExpenseLineDetail.AccountRef?.name,
        },
        customer: line.AccountBasedExpenseLineDetail.CustomerRef ? {
          id: line.AccountBasedExpenseLineDetail.CustomerRef.value,
          name: line.AccountBasedExpenseLineDetail.CustomerRef.name,
        } : undefined,
        billableStatus: line.AccountBasedExpenseLineDetail.BillableStatus,
        taxCode: line.AccountBasedExpenseLineDetail.TaxCodeRef?.value,
      }),
      ...(line.ItemBasedExpenseLineDetail && {
        item: {
          id: line.ItemBasedExpenseLineDetail.ItemRef?.value,
          name: line.ItemBasedExpenseLineDetail.ItemRef?.name,
        },
        qty: line.ItemBasedExpenseLineDetail.Qty,
        unitPrice: line.ItemBasedExpenseLineDetail.UnitPrice,
        customer: line.ItemBasedExpenseLineDetail.CustomerRef ? {
          id: line.ItemBasedExpenseLineDetail.CustomerRef.value,
          name: line.ItemBasedExpenseLineDetail.CustomerRef.name,
        } : undefined,
        billableStatus: line.ItemBasedExpenseLineDetail.BillableStatus,
        taxCode: line.ItemBasedExpenseLineDetail.TaxCodeRef?.value,
      }),
    }));
  }

  return result;
}

/**
 * Transform QBO Purchase response to user-friendly format
 */
export function transformPurchaseFromQBO(purchase: any): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: purchase.Id,
    syncToken: purchase.SyncToken,
    txnDate: purchase.TxnDate,
    paymentType: purchase.PaymentType,
    totalAmt: purchase.TotalAmt,
    memo: purchase.Memo,
    privateNote: purchase.PrivateNote,
    docNumber: purchase.DocNumber,
    globalTaxCalculation: purchase.GlobalTaxCalculation,
    credit: purchase.Credit,
    createTime: purchase.MetaData?.CreateTime,
    lastUpdatedTime: purchase.MetaData?.LastUpdatedTime,
  };

  // Transform account reference
  if (purchase.AccountRef) {
    result.paymentAccount = {
      id: purchase.AccountRef.value,
      name: purchase.AccountRef.name,
    };
  }

  // Transform vendor/entity reference
  if (purchase.EntityRef) {
    result.vendor = {
      id: purchase.EntityRef.value,
      name: purchase.EntityRef.name,
      type: purchase.EntityRef.type,
    };
  }

  // Transform currency
  if (purchase.CurrencyRef) {
    result.currency = purchase.CurrencyRef.value;
  }

  // Transform lines
  if (Array.isArray(purchase.Line)) {
    result.lines = purchase.Line.map((line: any) => {
      const transformedLine: Record<string, unknown> = {
        id: line.Id,
        lineNum: line.LineNum,
        amount: line.Amount,
        description: line.Description,
        detailType: line.DetailType,
      };

      if (line.AccountBasedExpenseLineDetail) {
        const detail = line.AccountBasedExpenseLineDetail;
        transformedLine.expenseAccount = {
          id: detail.AccountRef?.value,
          name: detail.AccountRef?.name,
        };
        if (detail.TaxCodeRef) {
          transformedLine.taxCode = {
            id: detail.TaxCodeRef.value,
            name: detail.TaxCodeRef.name,
          };
        }
        if (detail.CustomerRef) {
          transformedLine.customer = {
            id: detail.CustomerRef.value,
            name: detail.CustomerRef.name,
          };
        }
        transformedLine.billableStatus = detail.BillableStatus;
      }

      if (line.ItemBasedExpenseLineDetail) {
        const detail = line.ItemBasedExpenseLineDetail;
        transformedLine.item = {
          id: detail.ItemRef?.value,
          name: detail.ItemRef?.name,
        };
        transformedLine.qty = detail.Qty;
        transformedLine.unitPrice = detail.UnitPrice;
      }

      return transformedLine;
    });
  }

  // Add tax detail
  if (purchase.TxnTaxDetail) {
    result.taxDetail = {
      totalTax: purchase.TxnTaxDetail.TotalTax,
    };
  }

  return result;
}

/**
 * Validate that required references exist (placeholder for actual validation)
 */
export function validateReferences(input: CreatePurchaseInput): string[] {
  const errors: string[] = [];

  // These would actually make API calls to validate, but for now just check format
  if (!input.paymentAccountId) {
    errors.push('paymentAccountId is required');
  }

  if (!input.lines || input.lines.length === 0) {
    errors.push('At least one line item is required');
  }

  for (let i = 0; i < (input.lines?.length || 0); i++) {
    const line = input.lines[i];
    if (!line.expenseAccountId) {
      errors.push(`Line ${i + 1}: expenseAccountId is required`);
    }
    if (line.amount <= 0) {
      errors.push(`Line ${i + 1}: amount must be positive`);
    }
  }

  // Validate total if provided
  if (input.totalAmt !== undefined && input.lines) {
    const calculatedTotal = input.lines.reduce((sum, line) => sum + line.amount, 0);
    // Allow small floating point differences
    if (Math.abs(calculatedTotal - input.totalAmt) > 0.01) {
      errors.push(
        `Total amount mismatch: expected ${input.totalAmt}, calculated ${calculatedTotal.toFixed(2)}`
      );
    }
  }

  return errors;
}

/**
 * Build a complete criteria array for node-quickbooks from our search options
 */
export function buildSearchCriteriaForNodeQB(input: SearchPurchasesInput): Array<Record<string, unknown>> {
  const { criteria, options } = buildPurchaseSearchCriteria(input);
  
  // node-quickbooks expects criteria as an array of {field, value, operator} objects
  // and options passed separately
  return criteria.map(c => ({
    ...c,
    // Add sorting and pagination options to each criteria object
    // (node-quickbooks handles this differently, may need adjustment)
  }));
}
