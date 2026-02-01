/**
 * Test logging utilities
 * 
 * Provides controlled logging for tests:
 * - Silent by default
 * - Verbose mode via TEST_VERBOSE env var
 */

/**
 * Log test information - only when TEST_VERBOSE is set
 */
export function testInfo(message: string): void {
  if (process.env.TEST_VERBOSE) {
    console.log(`[TEST] ${message}`);
  }
}

/**
 * Log test warning - only when TEST_VERBOSE is set
 */
export function testWarn(message: string): void {
  if (process.env.TEST_VERBOSE) {
    console.log(`[WARN] ${message}`);
  }
}

/**
 * Log test error - always logged (these are important)
 */
export function testError(message: string, error?: unknown): void {
  if (process.env.TEST_VERBOSE) {
    console.error(`[ERROR] ${message}`, error ?? '');
  }
}
