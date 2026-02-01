import { quickbooksClient } from '../clients/quickbooks-client.js';
import { qboCircuitBreaker } from '../helpers/circuit-breaker.js';
import { ToolDefinition } from '../types/tool-definition.js';
import { logger, logToolRequest, logToolResponse } from '../helpers/logger.js';
import { z } from 'zod';

const toolName = 'health_check';
const toolDescription =
  'Check QuickBooks connection status and service health. Returns OAuth status, circuit breaker state, and API connectivity.';
const toolSchema = z.object({});

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    oauth: {
      status: 'ok' | 'error';
      authenticated: boolean;
      message?: string;
    };
    circuitBreaker: {
      status: 'ok' | 'warning' | 'error';
      state: string;
      failureCount: number;
      failureThreshold: number;
      timeSinceLastFailureMs: number;
    };
    api: {
      status: 'ok' | 'error';
      responseTimeMs?: number;
      message?: string;
    };
  };
  environment: string;
  timeoutMs: number;
}

const toolHandler = async (_args: Record<string, unknown>) => {
  logToolRequest('health_check', {});
  const startTime = Date.now();

  const result: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      oauth: { status: 'ok', authenticated: false },
      circuitBreaker: {
        status: 'ok',
        state: 'UNKNOWN',
        failureCount: 0,
        failureThreshold: 5,
        timeSinceLastFailureMs: -1,
      },
      api: { status: 'error', message: 'Not checked' },
    },
    environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
    timeoutMs: parseInt(process.env.QUICKBOOKS_TIMEOUT_MS || '30000', 10),
  };

  try {
    // Check 1: Circuit Breaker Status
    const cbHealth = qboCircuitBreaker.getHealthStatus();
    result.checks.circuitBreaker = {
      status:
        cbHealth.state === 'CLOSED' ? 'ok' : cbHealth.state === 'HALF_OPEN' ? 'warning' : 'error',
      state: cbHealth.state,
      failureCount: cbHealth.failureCount,
      failureThreshold: cbHealth.failureThreshold,
      timeSinceLastFailureMs: cbHealth.timeSinceLastFailureMs,
    };

    // If circuit is OPEN, mark as degraded
    if (cbHealth.state === 'OPEN') {
      result.status = 'degraded';
    }

    // Check 2: OAuth Status - NEVER trigger OAuth flow, just check state
    const hasTokens = quickbooksClient.hasRefreshToken();
    let isAuthenticated = false;

    if (!hasTokens) {
      result.checks.oauth = {
        status: 'error',
        authenticated: false,
        message: 'No OAuth tokens found. Run authentication flow first.',
      };
      result.status = 'unhealthy';
    } else {
      // Check if we have an active QuickBooks instance
      try {
        quickbooksClient.getQuickbooks();
        isAuthenticated = true;
        result.checks.oauth = {
          status: 'ok',
          authenticated: true,
        };
      } catch {
        // Tokens exist but session not established yet
        result.checks.oauth = {
          status: 'ok',
          authenticated: false,
          message:
            'Tokens exist but not authenticated in this session. First API call will authenticate.',
        };
      }
    }

    // Check 3: API Connectivity - only if already authenticated
    if (isAuthenticated) {
      const apiStartTime = Date.now();
      try {
        const qb = quickbooksClient.getQuickbooks() as any;

        // Use circuit breaker for the API call
        await qboCircuitBreaker.execute(
          () =>
            new Promise<void>((resolve, reject) => {
              qb.getCompanyInfo((err: any, _companyInfo: any) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            })
        );

        result.checks.api = {
          status: 'ok',
          responseTimeMs: Date.now() - apiStartTime,
        };
      } catch (apiError) {
        result.checks.api = {
          status: 'error',
          responseTimeMs: Date.now() - apiStartTime,
          message: apiError instanceof Error ? apiError.message : String(apiError),
        };
        result.status = result.status === 'unhealthy' ? 'unhealthy' : 'degraded';
      }
    }

    // Determine overall status
    const allOk =
      result.checks.oauth.status === 'ok' &&
      result.checks.api.status === 'ok' &&
      result.checks.circuitBreaker.status === 'ok';

    if (allOk) {
      result.status = 'healthy';
    }

    logToolResponse('health_check', result.status === 'healthy', Date.now() - startTime);
    logger.info('Health check completed', {
      status: result.status,
      circuitBreakerState: result.checks.circuitBreaker.state,
      oauthStatus: result.checks.oauth.status,
      apiStatus: result.checks.api.status,
    });

    return {
      content: [
        { type: 'text' as const, text: `Health Check Result:` },
        { type: 'text' as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  } catch (error) {
    logToolResponse('health_check', false, Date.now() - startTime);
    logger.error('Health check failed', error);

    result.status = 'unhealthy';
    return {
      content: [
        {
          type: 'text' as const,
          text: `Health check error: ${error instanceof Error ? error.message : String(error)}`,
        },
        { type: 'text' as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  }
};

export const HealthCheckTool: ToolDefinition<typeof toolSchema> = {
  name: toolName,
  description: toolDescription,
  schema: toolSchema,
  handler: toolHandler,
};
