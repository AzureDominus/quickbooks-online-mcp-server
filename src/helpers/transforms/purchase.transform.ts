/**
 * Purchase Transform Helpers for QuickBooks MCP Server
 *
 * Transforms for Purchase (expense) entities.
 */

import { CreatePurchaseInput, SearchPurchasesInput } from '../../types/qbo-schemas.js';
import { sanitizeLikePattern } from '../sanitize.js';
import { transformExpenseLineToQBO } from './common.transform.js';

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
    // Sanitize user input to prevent query injection
    const sanitizedText = sanitizeLikePattern(input.text, false);
    criteria.push({
      field: 'Memo',
      value: `%${sanitizedText}%`,
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
 * Build a complete criteria array for node-quickbooks from our search options
 */
export function buildSearchCriteriaForNodeQB(
  input: SearchPurchasesInput
): Array<Record<string, unknown>> {
  const { criteria, options: _options } = buildPurchaseSearchCriteria(input);

  // node-quickbooks expects criteria as an array of {field, value, operator} objects
  // and options passed separately
  return criteria.map((c) => ({
    ...c,
    // Add sorting and pagination options to each criteria object
    // (node-quickbooks handles this differently, may need adjustment)
  }));
}
