/**
 * Input sanitization helpers for QuickBooks query strings
 * 
 * These functions help prevent query injection and ensure special characters
 * are properly escaped when building QuickBooks API queries.
 */

/**
 * Sanitize user input for QuickBooks query strings
 * Escapes special characters that could affect query parsing
 * 
 * @param value - The raw user input string
 * @returns Sanitized string safe for use in QBO queries
 */
export function sanitizeQueryValue(value: string): string {
  if (typeof value !== 'string') {
    return String(value);
  }
  
  // Escape backslashes first (so we don't double-escape later escapes)
  // Escape single quotes (SQL injection prevention)
  // Remove null bytes
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '');
}

/**
 * Sanitize LIKE pattern - escape wildcards if they're user input
 * 
 * @param value - The raw user input string
 * @param allowWildcards - If true, % and _ wildcards are preserved; if false, they're escaped
 * @returns Sanitized string safe for use in QBO LIKE queries
 */
export function sanitizeLikePattern(value: string, allowWildcards: boolean = false): string {
  let sanitized = sanitizeQueryValue(value);
  
  if (!allowWildcards) {
    // Escape LIKE wildcards
    sanitized = sanitized.replace(/%/g, '\\%').replace(/_/g, '\\_');
  }
  
  return sanitized;
}
