/**
 * Tool Error Handling Helpers
 * 
 * Provides consistent error handling and response formatting
 * for MCP tool handlers.
 */

import { logger } from './logger.js';

export interface ToolError {
  isError: true;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface ToolSuccessResponse<T> {
  result: T;
  message?: string;
}

/**
 * Handle tool errors consistently
 * 
 * Logs the error with context and returns a structured error object.
 */
export function handleToolError(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): ToolError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as Record<string, unknown>)?.code as string | undefined 
    || (error as Record<string, unknown>)?.statusCode as string | undefined;
  
  logger.error(`${operation} failed`, error instanceof Error ? error : undefined, {
    code: errorCode,
    ...context
  });
  
  return {
    isError: true,
    error: errorMessage,
    code: errorCode,
    details: context
  };
}

/**
 * Create a success response
 */
export function toolSuccess<T>(
  result: T,
  message?: string
): ToolSuccessResponse<T> {
  return { result, message };
}

/**
 * Format an error for MCP tool content response
 */
export function formatToolErrorContent(error: string, prefix?: string): { type: 'text'; text: string }[] {
  const message = prefix ? `${prefix}: ${error}` : `Error: ${error}`;
  return [{ type: 'text' as const, text: message }];
}

/**
 * Create a standardized MCP error response
 */
export function createMCPErrorResponse(error: unknown, operation: string) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    content: formatToolErrorContent(errorMessage, `Error ${operation}`),
  };
}
