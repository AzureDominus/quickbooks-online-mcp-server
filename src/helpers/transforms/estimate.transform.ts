/**
 * Estimate Transform Helpers for QuickBooks MCP Server
 *
 * Transforms for Estimate entities.
 */

import { SearchEstimatesInput } from '../../types/qbo-schemas.js';
import { sanitizeLikePattern } from '../sanitize.js';

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
    // Sanitize user input to prevent query injection
    const sanitizedSearch = sanitizeLikePattern(input.search, false);
    criteria.push({
      field: 'DocNumber',
      value: `%${sanitizedSearch}%`,
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
