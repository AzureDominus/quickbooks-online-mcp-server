import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [429, 500, 502, 503, 504]
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, options.maxDelayMs);
}

/**
 * Parse Retry-After header value
 * @param retryAfter - The Retry-After header value (seconds or HTTP-date)
 * @returns Delay in milliseconds, or null if invalid
 */
function parseRetryAfter(retryAfter: string | null | undefined): number | null {
  if (!retryAfter) return null;
  
  // Try parsing as seconds
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }
  
  // Try parsing as HTTP-date
  const date = Date.parse(retryAfter);
  if (!isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? delay : null;
  }
  
  return null;
}

/**
 * Check if an error is retryable based on status code or network error
 */
function isRetryableError(error: any, retryableStatuses: number[]): boolean {
  // Extract status code from various error formats
  const statusCode = error.statusCode || error.status || 
    (error.Fault?.Error?.[0]?.code ? parseInt(error.Fault.Error[0].code, 10) : null);
  
  // Check for retryable HTTP status codes
  if (typeof statusCode === 'number' && retryableStatuses.includes(statusCode)) {
    return true;
  }
  
  // Check for network-level transient errors
  const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN'];
  if (error.code && networkErrors.includes(error.code)) {
    return true;
  }
  
  // Check for rate limit in error message
  if (error.message?.toLowerCase().includes('rate limit') ||
      error.message?.toLowerCase().includes('too many requests') ||
      error.message?.toLowerCase().includes('throttl')) {
    return true;
  }
  
  return false;
}

/**
 * Extract status code from error for logging
 */
function getErrorStatusCode(error: any): number | string | undefined {
  return error.statusCode || error.status || error.code ||
    error.Fault?.Error?.[0]?.code;
}

/**
 * Retry a function with exponential backoff
 * Handles rate limits (429) and transient server errors (5xx)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      const isRetryable = isRetryableError(error, opts.retryableStatuses);
      
      if (!isRetryable || attempt === opts.maxRetries) {
        throw error;
      }
      
      // Calculate delay - use Retry-After header for 429 if available
      const statusCode = getErrorStatusCode(error);
      let delay: number;
      if (statusCode === 429 && error.headers?.['retry-after']) {
        const retryAfterDelay = parseRetryAfter(error.headers['retry-after']);
        delay = retryAfterDelay ?? calculateDelay(attempt, opts);
      } else {
        delay = calculateDelay(attempt, opts);
      }
      
      // Cap delay at maxDelayMs
      delay = Math.min(delay, opts.maxDelayMs);
      
      logger.warn('Retrying after transient failure', {
        attempt: attempt + 1,
        maxRetries: opts.maxRetries,
        delayMs: Math.round(delay),
        errorCode: statusCode,
        errorMessage: error.message
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Wrap a node-quickbooks callback-style function with retry logic
 * @param callbackFn - A function that takes a callback as its last argument
 * @param options - Retry options
 * @returns Promise that resolves with the result or rejects with error
 */
export function withCallbackRetry<T>(
  callbackFn: (callback: (err: any, result: T) => void) => void,
  options: RetryOptions = {}
): Promise<T> {
  const promiseFn = () => new Promise<T>((resolve, reject) => {
    callbackFn((err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
  
  return withRetry(promiseFn, options);
}
