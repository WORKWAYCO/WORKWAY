/**
 * Standard Error Types for WORKWAY Construction MCP
 *
 * Provides consistent error format across MCP tools, REST API, and SDK.
 *
 * Error Code Categories:
 * - AUTH_*: Authentication errors (1xxx)
 * - PROCORE_*: Procore integration errors (2xxx)
 * - WORKFLOW_*: Workflow lifecycle errors (3xxx)
 * - VALIDATION_*: Input validation errors (4xxx)
 * - SYSTEM_*: Internal system errors (5xxx)
 */

import { ZodError } from 'zod';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Standard error codes organized by category
 */
export enum ErrorCode {
  // Auth errors (1xxx)
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_INSUFFICIENT_SCOPES = 'AUTH_INSUFFICIENT_SCOPES',
  AUTH_REFRESH_FAILED = 'AUTH_REFRESH_FAILED',

  // Procore errors (2xxx)
  PROCORE_NOT_CONNECTED = 'PROCORE_NOT_CONNECTED',
  PROCORE_AUTH_FAILED = 'PROCORE_AUTH_FAILED',
  PROCORE_RATE_LIMITED = 'PROCORE_RATE_LIMITED',
  PROCORE_NOT_FOUND = 'PROCORE_NOT_FOUND',
  PROCORE_FORBIDDEN = 'PROCORE_FORBIDDEN',
  PROCORE_API_ERROR = 'PROCORE_API_ERROR',
  PROCORE_SANDBOX_NOT_CONFIGURED = 'PROCORE_SANDBOX_NOT_CONFIGURED',
  PROCORE_COMPANY_NOT_SET = 'PROCORE_COMPANY_NOT_SET',

  // Workflow errors (3xxx)
  WORKFLOW_NOT_FOUND = 'WORKFLOW_NOT_FOUND',
  WORKFLOW_INVALID = 'WORKFLOW_INVALID',
  WORKFLOW_NO_ACTIONS = 'WORKFLOW_NO_ACTIONS',
  WORKFLOW_NO_TRIGGER = 'WORKFLOW_NO_TRIGGER',
  WORKFLOW_INVALID_TRIGGER = 'WORKFLOW_INVALID_TRIGGER',
  WORKFLOW_EXECUTION_FAILED = 'WORKFLOW_EXECUTION_FAILED',
  WORKFLOW_ALREADY_ACTIVE = 'WORKFLOW_ALREADY_ACTIVE',

  // Validation errors (4xxx)
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_CRON_EXPRESSION = 'INVALID_CRON_EXPRESSION',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  INVALID_ID_FORMAT = 'INVALID_ID_FORMAT',

  // System errors (5xxx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',

  // Webhook errors (6xxx)
  WEBHOOK_NOT_FOUND = 'WEBHOOK_NOT_FOUND',
  WEBHOOK_CREATION_FAILED = 'WEBHOOK_CREATION_FAILED',

  // Execution errors (7xxx)
  EXECUTION_NOT_FOUND = 'EXECUTION_NOT_FOUND',
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',
  ACTION_EXECUTION_FAILED = 'ACTION_EXECUTION_FAILED',
}

/**
 * HTTP status codes mapped to error categories
 */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  // Auth errors → 401/403
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.AUTH_EXPIRED]: 401,
  [ErrorCode.AUTH_INVALID]: 401,
  [ErrorCode.AUTH_INSUFFICIENT_SCOPES]: 403,
  [ErrorCode.AUTH_REFRESH_FAILED]: 401,

  // Procore errors → mixed
  [ErrorCode.PROCORE_NOT_CONNECTED]: 401,
  [ErrorCode.PROCORE_AUTH_FAILED]: 401,
  [ErrorCode.PROCORE_RATE_LIMITED]: 429,
  [ErrorCode.PROCORE_NOT_FOUND]: 404,
  [ErrorCode.PROCORE_FORBIDDEN]: 403,
  [ErrorCode.PROCORE_API_ERROR]: 502,
  [ErrorCode.PROCORE_SANDBOX_NOT_CONFIGURED]: 500,
  [ErrorCode.PROCORE_COMPANY_NOT_SET]: 400,

  // Workflow errors → 400/404
  [ErrorCode.WORKFLOW_NOT_FOUND]: 404,
  [ErrorCode.WORKFLOW_INVALID]: 400,
  [ErrorCode.WORKFLOW_NO_ACTIONS]: 400,
  [ErrorCode.WORKFLOW_NO_TRIGGER]: 400,
  [ErrorCode.WORKFLOW_INVALID_TRIGGER]: 400,
  [ErrorCode.WORKFLOW_EXECUTION_FAILED]: 500,
  [ErrorCode.WORKFLOW_ALREADY_ACTIVE]: 409,

  // Validation errors → 400
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_CRON_EXPRESSION]: 400,
  [ErrorCode.INVALID_DATE_FORMAT]: 400,
  [ErrorCode.INVALID_ID_FORMAT]: 400,

  // System errors → 500/503
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.TIMEOUT]: 504,
  [ErrorCode.CONFIGURATION_ERROR]: 500,

  // Webhook errors
  [ErrorCode.WEBHOOK_NOT_FOUND]: 404,
  [ErrorCode.WEBHOOK_CREATION_FAILED]: 500,

  // Execution errors
  [ErrorCode.EXECUTION_NOT_FOUND]: 404,
  [ErrorCode.EXECUTION_TIMEOUT]: 504,
  [ErrorCode.ACTION_EXECUTION_FAILED]: 500,
};

// ============================================================================
// Response Types
// ============================================================================

/**
 * Standard error response structure
 */
export interface StandardError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    retryAfter?: number; // For rate limit errors (seconds)
    httpStatus?: number; // For REST API responses
  };
}

/**
 * Standard success response structure
 */
export interface StandardSuccess<T> {
  success: true;
  data: T;
  metadata?: {
    executionTime?: number;
    cached?: boolean;
  };
}

/**
 * Combined response type
 */
export type StandardResponse<T> = StandardSuccess<T> | StandardError;

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for all WORKWAY errors
 */
export class WorkwayError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly retryAfter?: number;
  public readonly httpStatus: number;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      retryAfter?: number;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'WorkwayError';
    this.code = code;
    this.details = options?.details;
    this.retryAfter = options?.retryAfter;
    this.httpStatus = ERROR_HTTP_STATUS[code] || 500;
  }

  /**
   * Convert error to standard response format
   */
  toResponse(): StandardError {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        retryAfter: this.retryAfter,
        httpStatus: this.httpStatus,
      },
    };
  }

  /**
   * Create a standard error response without throwing
   */
  static response(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ): StandardError {
    return new WorkwayError(code, message, { details }).toResponse();
  }
}

/**
 * Authentication-related errors
 */
export class AuthError extends WorkwayError {
  constructor(
    code:
      | ErrorCode.AUTH_REQUIRED
      | ErrorCode.AUTH_EXPIRED
      | ErrorCode.AUTH_INVALID
      | ErrorCode.AUTH_INSUFFICIENT_SCOPES
      | ErrorCode.AUTH_REFRESH_FAILED,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, options);
    this.name = 'AuthError';
  }
}

/**
 * Procore-specific errors
 */
export class ProcoreError extends WorkwayError {
  constructor(
    code:
      | ErrorCode.PROCORE_NOT_CONNECTED
      | ErrorCode.PROCORE_AUTH_FAILED
      | ErrorCode.PROCORE_RATE_LIMITED
      | ErrorCode.PROCORE_NOT_FOUND
      | ErrorCode.PROCORE_FORBIDDEN
      | ErrorCode.PROCORE_API_ERROR
      | ErrorCode.PROCORE_SANDBOX_NOT_CONFIGURED
      | ErrorCode.PROCORE_COMPANY_NOT_SET,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      retryAfter?: number;
      cause?: Error;
    }
  ) {
    super(code, message, options);
    this.name = 'ProcoreError';
  }
}

/**
 * Workflow-related errors
 */
export class WorkflowError extends WorkwayError {
  constructor(
    code:
      | ErrorCode.WORKFLOW_NOT_FOUND
      | ErrorCode.WORKFLOW_INVALID
      | ErrorCode.WORKFLOW_NO_ACTIONS
      | ErrorCode.WORKFLOW_NO_TRIGGER
      | ErrorCode.WORKFLOW_INVALID_TRIGGER
      | ErrorCode.WORKFLOW_EXECUTION_FAILED
      | ErrorCode.WORKFLOW_ALREADY_ACTIVE,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, options);
    this.name = 'WorkflowError';
  }
}

/**
 * Validation errors
 */
export class ValidationError extends WorkwayError {
  public readonly issues?: Array<{ path: string; message: string }>;

  constructor(
    code:
      | ErrorCode.VALIDATION_FAILED
      | ErrorCode.INVALID_INPUT
      | ErrorCode.MISSING_REQUIRED_FIELD
      | ErrorCode.INVALID_CRON_EXPRESSION
      | ErrorCode.INVALID_DATE_FORMAT
      | ErrorCode.INVALID_ID_FORMAT,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      issues?: Array<{ path: string; message: string }>;
      cause?: Error;
    }
  ) {
    super(code, message, {
      details: options?.issues
        ? { ...options.details, issues: options.issues }
        : options?.details,
      cause: options?.cause,
    });
    this.name = 'ValidationError';
    this.issues = options?.issues;
  }

  /**
   * Create ValidationError from Zod error
   */
  static fromZodError(error: ZodError): ValidationError {
    const issues = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    return new ValidationError(
      ErrorCode.VALIDATION_FAILED,
      'Invalid input: ' + issues.map((i) => i.message).join(', '),
      { issues }
    );
  }
}

/**
 * System/internal errors
 */
export class SystemError extends WorkwayError {
  constructor(
    code:
      | ErrorCode.INTERNAL_ERROR
      | ErrorCode.SERVICE_UNAVAILABLE
      | ErrorCode.DATABASE_ERROR
      | ErrorCode.TIMEOUT
      | ErrorCode.CONFIGURATION_ERROR,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, options);
    this.name = 'SystemError';
  }
}

/**
 * Execution-related errors
 */
export class ExecutionError extends WorkwayError {
  constructor(
    code:
      | ErrorCode.EXECUTION_NOT_FOUND
      | ErrorCode.EXECUTION_TIMEOUT
      | ErrorCode.ACTION_EXECUTION_FAILED,
    message: string,
    options?: {
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, options);
    this.name = 'ExecutionError';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a success response
 */
export function success<T>(
  data: T,
  metadata?: { executionTime?: number; cached?: boolean }
): StandardSuccess<T> {
  return {
    success: true,
    data,
    ...(metadata && { metadata }),
  };
}

/**
 * Create an error response from any error
 */
export function errorResponse(error: unknown): StandardError {
  if (error instanceof WorkwayError) {
    return error.toResponse();
  }

  if (error instanceof ZodError) {
    return ValidationError.fromZodError(error).toResponse();
  }

  if (error instanceof Error) {
    return new WorkwayError(ErrorCode.INTERNAL_ERROR, error.message, {
      cause: error,
    }).toResponse();
  }

  return new WorkwayError(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred'
  ).toResponse();
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse<T>(
  response: StandardResponse<T>
): response is StandardError {
  return response.success === false;
}

/**
 * Type guard to check if response is a success
 */
export function isSuccessResponse<T>(
  response: StandardResponse<T>
): response is StandardSuccess<T> {
  return response.success === true;
}
