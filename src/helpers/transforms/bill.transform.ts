/**
 * Bill Transform Helpers for QuickBooks MCP Server
 *
 * Transforms for Bill entities.
 */

import { SearchBillsInput } from '../../types/qbo-schemas.js';

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
        customer: line.AccountBasedExpenseLineDetail.CustomerRef
          ? {
              id: line.AccountBasedExpenseLineDetail.CustomerRef.value,
              name: line.AccountBasedExpenseLineDetail.CustomerRef.name,
            }
          : undefined,
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
        customer: line.ItemBasedExpenseLineDetail.CustomerRef
          ? {
              id: line.ItemBasedExpenseLineDetail.CustomerRef.value,
              name: line.ItemBasedExpenseLineDetail.CustomerRef.name,
            }
          : undefined,
        billableStatus: line.ItemBasedExpenseLineDetail.BillableStatus,
        taxCode: line.ItemBasedExpenseLineDetail.TaxCodeRef?.value,
      }),
    }));
  }

  return result;
}
