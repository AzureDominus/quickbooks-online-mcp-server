/**
 * Search Filter Helpers
 * 
 * Provides reusable functions for building search filters
 * across different QuickBooks entity search tools.
 */

import { sanitizeLikePattern, sanitizeQueryValue } from './sanitize.js';

export interface SearchFilter {
  field: string;
  value: string | number | boolean;
  operator?: '=' | '<' | '>' | '<=' | '>=' | 'LIKE' | 'IN';
}

/**
 * Build a date range filter
 */
export function buildDateRangeFilter(
  fieldName: string,
  dateFrom?: string,
  dateTo?: string
): SearchFilter[] {
  const filters: SearchFilter[] = [];
  if (dateFrom) {
    filters.push({ field: fieldName, value: dateFrom, operator: '>=' });
  }
  if (dateTo) {
    filters.push({ field: fieldName, value: dateTo, operator: '<=' });
  }
  return filters;
}

/**
 * Build an amount range filter
 */
export function buildAmountRangeFilter(
  fieldName: string,
  minAmount?: number,
  maxAmount?: number
): SearchFilter[] {
  const filters: SearchFilter[] = [];
  if (minAmount !== undefined) {
    filters.push({ field: fieldName, value: minAmount, operator: '>=' });
  }
  if (maxAmount !== undefined) {
    filters.push({ field: fieldName, value: maxAmount, operator: '<=' });
  }
  return filters;
}

/**
 * Build a LIKE filter with sanitization
 * 
 * If the value contains wildcards (%) and allowWildcards is true,
 * the operator will be LIKE; otherwise it will be =
 */
export function buildLikeFilter(
  fieldName: string,
  value?: string,
  allowWildcards: boolean = true
): SearchFilter[] {
  if (!value) return [];
  const sanitized = sanitizeLikePattern(value, allowWildcards);
  const operator = allowWildcards && value.includes('%') ? 'LIKE' : '=';
  return [{ field: fieldName, value: sanitized, operator }];
}

/**
 * Build an equality filter
 */
export function buildEqualityFilter(
  fieldName: string,
  value?: string | number | boolean
): SearchFilter[] {
  if (value === undefined) return [];
  return [{ field: fieldName, value, operator: '=' }];
}

/**
 * Build a string value filter with sanitization
 */
export function buildStringFilter(
  fieldName: string,
  value?: string
): SearchFilter[] {
  if (value === undefined) return [];
  const sanitized = sanitizeQueryValue(value);
  return [{ field: fieldName, value: sanitized, operator: '=' }];
}

/**
 * Convert filters to QuickBooks criteria format
 */
export function filtersToQBOCriteria(filters: SearchFilter[]): Array<{field: string; value: string | number | boolean; operator?: string}> {
  return filters.map(f => ({
    field: f.field,
    value: f.value,
    operator: f.operator || '='
  }));
}

/**
 * Merge multiple filter arrays into one
 */
export function mergeFilters(...filterArrays: SearchFilter[][]): SearchFilter[] {
  return filterArrays.flat();
}
