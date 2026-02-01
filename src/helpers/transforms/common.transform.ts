/**
 * Common Transform Helpers for QuickBooks MCP Server
 *
 * Shared utilities used across entity-specific transformers.
 */

import { CreatePurchaseInput, SimplifiedExpenseLineSchema } from '../../types/qbo-schemas.js';
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
