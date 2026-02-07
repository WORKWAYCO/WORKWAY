/**
 * Error Handler Middleware
 *
 * Catches errors from tool execution and converts them to standard format.
 * Ensures consistent error responses across all MCP tools.
 */

import { ZodError } from 'zod';
import {
  WorkwayError,
  ValidationError,
  SystemError,
  ErrorCode,
  StandardError,
  StandardResponse,
  errorResponse,
} from '../lib/errors';

/**
 * Wraps a tool executor to catch and format errors consistently
 */
export function withErrorHandler<TInput, TOutput>(
  executor: (input: TInput, env: unknown) => Promise<StandardResponse<TOutput>>
): (input: TInput, env: unknown) => Promise<StandardResponse<TOutput>> {
  return async (input: TInput, env: unknown): Promise<StandardResponse<TOutput>> => {
    try {
      return await executor(input, env);
    } catch (error) {
      console.error('[Error Handler] Caught error:', error);
      return errorResponse(error) as StandardResponse<TOutput>;
    }
  };
}

/**
 * Process caught errors and convert to StandardError format
 *
 * Handles:
 * - WorkwayError and subclasses (already formatted)
 * - ZodError (validation errors)
 * - Generic Error objects
 * - Unknown error types
 */
export function handleError(error: unknown): StandardError {
  // Already a WorkwayError - convert to response
  if (error instanceof WorkwayError) {
    return error.toResponse();
  }

  // Zod validation error - convert to ValidationError
  if (error instanceof ZodError) {
    return ValidationError.fromZodError(error).toResponse();
  }

  // Check for specific error patterns in generic Error
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Rate limit detection
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return new WorkwayError(ErrorCode.PROCORE_RATE_LIMITED, error.message, {
        cause: error,
        retryAfter: extractRetryAfter(error.message),
      }).toResponse();
    }

    // Auth detection
    if (
      message.includes('not connected') ||
      message.includes('reconnect') ||
      message.includes('token expired')
    ) {
      return new WorkwayError(ErrorCode.AUTH_REQUIRED, error.message, {
        cause: error,
      }).toResponse();
    }

    // Procore API error detection
    if (message.includes('procore') && message.includes('error')) {
      const statusMatch = message.match(/(\d{3})/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;

      if (status === 401) {
        return new WorkwayError(ErrorCode.PROCORE_AUTH_FAILED, error.message, {
          cause: error,
        }).toResponse();
      }
      if (status === 403) {
        return new WorkwayError(ErrorCode.PROCORE_FORBIDDEN, error.message, {
          cause: error,
        }).toResponse();
      }
      if (status === 404) {
        return new WorkwayError(ErrorCode.PROCORE_NOT_FOUND, error.message, {
          cause: error,
        }).toResponse();
      }

      return new WorkwayError(ErrorCode.PROCORE_API_ERROR, error.message, {
        cause: error,
        details: { httpStatus: status },
      }).toResponse();
    }

    // Database error detection
    if (message.includes('database') || message.includes('sql') || message.includes('d1')) {
      return new SystemError(ErrorCode.DATABASE_ERROR, error.message, {
        cause: error,
      }).toResponse();
    }

    // Generic error - wrap as internal error
    return new SystemError(ErrorCode.INTERNAL_ERROR, error.message, {
      cause: error,
    }).toResponse();
  }

  // Unknown error type - wrap with generic message
  console.error('[Error Handler] Unknown error type:', error);
  return new SystemError(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred. Please try again.'
  ).toResponse();
}

/**
 * Extract retry-after seconds from error message
 */
function extractRetryAfter(message: string): number | undefined {
  const match = message.match(/retry after (\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Default retry for rate limits
  return 60;
}

/**
 * Error logging utility for audit purposes
 */
export function logError(
  error: unknown,
  context: {
    toolName: string;
    userId?: string;
    workflowId?: string;
    executionId?: string;
  }
): void {
  const errorInfo =
    error instanceof WorkwayError
      ? {
          code: error.code,
          message: error.message,
          details: error.details,
        }
      : {
          code: 'UNKNOWN',
          message: error instanceof Error ? error.message : String(error),
        };

  console.error('[Tool Error]', {
    ...context,
    error: errorInfo,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create a formatted error for MCP tool response
 * Use this when you want to return an error without throwing
 */
export function createToolError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): StandardError {
  return new WorkwayError(code, message, { details }).toResponse();
}
