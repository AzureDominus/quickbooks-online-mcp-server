/**
 * Invoice Transform Helpers for QuickBooks MCP Server
 *
 * Transforms for Invoice entities.
 */

import { SearchInvoicesInput } from '../../types/qbo-schemas.js';

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
