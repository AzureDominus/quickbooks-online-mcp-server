/**
 * Structured Logger for QuickBooks MCP Server
 * 
 * Provides consistent, structured logging with support for:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR)
 * - JSON output for production environments
 * - Context tracking for operations
 * - Performance timing
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  duration_ms?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger interface - explicit type to avoid circular reference
 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
  child(boundContext: LogContext): Logger;
  time(operation: string, context?: LogContext): () => void;
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Output format: 'json' for production, 'pretty' for development */
  format: 'json' | 'pretty';
  /** Include stack traces in error logs */
  includeStackTrace: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Get configuration from environment
 */
function getConfig(): LoggerConfig {
  const level = (process.env.LOG_LEVEL?.toUpperCase() || 'INFO') as LogLevel;
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    level: LOG_LEVELS[level] !== undefined ? level : 'INFO',
    format: isProduction ? 'json' : 'pretty',
    includeStackTrace: !isProduction,
  };
}

const config = getConfig();

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (config.format === 'json') {
    return JSON.stringify(entry);
  }
  
  // Pretty format for development
  const timestamp = entry.timestamp.split('T')[1]?.replace('Z', '') || entry.timestamp;
  const levelColors: Record<LogLevel, string> = {
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m',  // Green
    WARN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m', // Red
  };
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';
  
  let output = `${dim}${timestamp}${reset} ${levelColors[entry.level]}${entry.level.padEnd(5)}${reset} ${entry.message}`;
  
  if (entry.duration_ms !== undefined) {
    output += ` ${dim}(${entry.duration_ms}ms)${reset}`;
  }
  
  if (entry.context && Object.keys(entry.context).length > 0) {
    output += ` ${dim}${JSON.stringify(entry.context)}${reset}`;
  }
  
  if (entry.error) {
    output += `\n  ${levelColors.ERROR}Error: ${entry.error.message}${reset}`;
    if (entry.error.stack && config.includeStackTrace) {
      output += `\n${dim}${entry.error.stack}${reset}`;
    }
  }
  
  return output;
}

/**
 * Check if log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

/**
 * Core log function
 */
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  if (!shouldLog(level)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  
  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }
  
  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: config.includeStackTrace ? error.stack : undefined,
    };
  }
  
  const output = formatLogEntry(entry);
  
  if (level === 'ERROR' || level === 'WARN') {
    console.error(output);
  } else {
    console.log(output);
  }
}

/**
 * Structured logger instance
 */
export const logger = {
  /**
   * Debug level logging - detailed information for debugging
   */
  debug(message: string, context?: LogContext): void {
    log('DEBUG', message, context);
  },
  
  /**
   * Info level logging - general operational messages
   */
  info(message: string, context?: LogContext): void {
    log('INFO', message, context);
  },
  
  /**
   * Warning level logging - potentially harmful situations
   */
  warn(message: string, context?: LogContext): void {
    log('WARN', message, context);
  },
  
  /**
   * Error level logging - error events
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : 
      error ? new Error(String(error)) : undefined;
    log('ERROR', message, context, err);
  },
  
  /**
   * Create a child logger with bound context
   */
  child(boundContext: LogContext): Logger {
    return {
      debug: (msg: string, ctx?: LogContext) => 
        log('DEBUG', msg, { ...boundContext, ...ctx }),
      info: (msg: string, ctx?: LogContext) => 
        log('INFO', msg, { ...boundContext, ...ctx }),
      warn: (msg: string, ctx?: LogContext) => 
        log('WARN', msg, { ...boundContext, ...ctx }),
      error: (msg: string, err?: Error | unknown, ctx?: LogContext) => {
        const e = err instanceof Error ? err : err ? new Error(String(err)) : undefined;
        log('ERROR', msg, { ...boundContext, ...ctx }, e);
      },
      child: (ctx: LogContext) => logger.child({ ...boundContext, ...ctx }),
      time: (operation: string, ctx?: LogContext) => 
        logger.time(operation, { ...boundContext, ...ctx }),
    };
  },
  
  /**
   * Start a timed operation - returns a function to call when complete
   */
  time(operation: string, context?: LogContext): () => void {
    const start = Date.now();
    log('DEBUG', `Starting: ${operation}`, context);
    
    return () => {
      const duration = Date.now() - start;
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Completed: ${operation}`,
        duration_ms: duration,
        context,
      };
      
      if (shouldLog('INFO')) {
        console.log(formatLogEntry(entry));
      }
    };
  },
};

/**
 * Tool operation logger - creates contextual logging for tool execution
 */
export function createToolLogger(toolName: string) {
  return logger.child({ tool: toolName });
}

/**
 * Request logger - logs incoming tool requests
 */
export function logToolRequest(toolName: string, params: unknown): void {
  logger.info(`Tool request: ${toolName}`, {
    tool: toolName,
    params: sanitizeParams(params),
  });
}

/**
 * Response logger - logs tool responses
 */
export function logToolResponse(toolName: string, success: boolean, duration?: number): void {
  logger.info(`Tool response: ${toolName}`, {
    tool: toolName,
    success,
    duration_ms: duration,
  });
}

/**
 * Sanitize params for logging (remove sensitive data)
 */
function sanitizeParams(params: unknown): unknown {
  if (!params || typeof params !== 'object') {
    return params;
  }
  
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeParams(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

export default logger;
