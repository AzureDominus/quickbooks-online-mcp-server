import { logger } from './logger.js';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit Breaker Pattern implementation
 * 
 * Prevents cascading failures by temporarily blocking requests when
 * too many failures occur. States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests are blocked
 * - HALF_OPEN: Testing if service recovered, allows one request through
 */
class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 60000;
  }

  /**
   * Execute a function through the circuit breaker
   * @throws Error if circuit is OPEN and timeout hasn't elapsed
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker transitioning to HALF_OPEN', {
          failureCount: this.failureCount,
          lastFailureTime: new Date(this.lastFailureTime).toISOString()
        });
      } else {
        const remainingMs = this.resetTimeoutMs - (Date.now() - this.lastFailureTime);
        throw new Error(
          `Circuit breaker is OPEN - service temporarily unavailable. ` +
          `Will retry in ${Math.ceil(remainingMs / 1000)} seconds.`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      logger.info('Circuit breaker closing after successful test request');
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('Circuit breaker opened due to repeated failures', {
        failureCount: this.failureCount,
        failureThreshold: this.failureThreshold,
        resetTimeoutMs: this.resetTimeoutMs
      });
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count for monitoring
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Get time since last failure in ms
   */
  getTimeSinceLastFailure(): number {
    if (this.lastFailureTime === 0) {
      return -1; // No failures recorded
    }
    return Date.now() - this.lastFailureTime;
  }

  /**
   * Get health status object for monitoring
   */
  getHealthStatus(): {
    state: CircuitState;
    failureCount: number;
    failureThreshold: number;
    timeSinceLastFailureMs: number;
    resetTimeoutMs: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      timeSinceLastFailureMs: this.getTimeSinceLastFailure(),
      resetTimeoutMs: this.resetTimeoutMs
    };
  }

  /**
   * Manually reset the circuit breaker (useful for testing or admin override)
   */
  reset(): void {
    logger.info('Circuit breaker manually reset', {
      previousState: this.state,
      previousFailureCount: this.failureCount
    });
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

// Default circuit breaker for QuickBooks API
export const qboCircuitBreaker = new CircuitBreaker({
  failureThreshold: parseInt(process.env.QUICKBOOKS_CIRCUIT_FAILURE_THRESHOLD || '5', 10),
  resetTimeoutMs: parseInt(process.env.QUICKBOOKS_CIRCUIT_RESET_TIMEOUT_MS || '60000', 10)
});

// Export class for custom instances
export { CircuitBreaker };
