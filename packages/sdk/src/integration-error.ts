/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * IntegrationError - Narrow Waist for Error Handling
 *
 * Standardized error taxonomy for all integrations.
 * Enables intelligent error handling without M × N error-specific logic.
 *
 * Pattern Reference: OAuth.ts - single interface abstracts provider differences
 */

import { parseRetryAfter as parseRetryAfterHeader } from './retry.js';

// ============================================================================
// ERROR CODES (The Narrow Waist)
// ============================================================================

/**
 * Standardized error codes
 *
 * These codes enable WorkflowExecutor to make smart decisions:
 * - AUTH_EXPIRED → Refresh OAuth token automatically
 * - RATE_LIMITED → Retry with exponential backoff
 * - INVALID_CONFIG → Notify user, don't retry
 * - PROVIDER_DOWN → Retry later
 * - PERMANENT_FAILURE → Don't retry, mark as failed
 */
export enum ErrorCode {
	// Authentication errors
	AUTH_MISSING = 'auth_missing', // OAuth connection not found
	AUTH_EXPIRED = 'auth_expired', // Token expired (can refresh)
	AUTH_INVALID = 'auth_invalid', // Token revoked or invalid (can't refresh)
	AUTH_INSUFFICIENT_SCOPE = 'auth_insufficient_scope', // Missing required OAuth scopes

	// Rate limiting
	RATE_LIMITED = 'rate_limited', // Hit API rate limit (retry after backoff)
	QUOTA_EXCEEDED = 'quota_exceeded', // Monthly/daily quota exceeded (don't retry)

	// Configuration errors
	INVALID_CONFIG = 'invalid_config', // User configuration is invalid
	MISSING_REQUIRED_FIELD = 'missing_required_field', // Required input field missing
	INVALID_INPUT = 'invalid_input', // Input validation failed

	// API errors
	API_ERROR = 'api_error', // Generic API error (check details)
	NOT_FOUND = 'not_found', // Resource not found
	PERMISSION_DENIED = 'permission_denied', // User lacks permission
	CONFLICT = 'conflict', // Resource conflict (e.g., duplicate)

	// Database errors
	DATABASE_ERROR = 'database_error', // Database operation failed
	SEARCH_ERROR = 'search_error', // Search operation failed

	// Processing errors
	PROCESSING_ERROR = 'processing_error', // General processing/transformation error
	CONFIGURATION_ERROR = 'configuration_error', // Service misconfiguration (alias for INVALID_CONFIG)

	// AI errors
	AI_MODEL_ERROR = 'ai_model_error', // AI model execution failed

	// Payment errors
	PAYMENT_FAILED = 'payment_failed', // Payment processing failed (card declined, etc.)

	// Validation errors
	VALIDATION_ERROR = 'validation_error', // Input validation failed

	// Network errors
	NETWORK_ERROR = 'network_error', // Network timeout, connection failed
	PROVIDER_DOWN = 'provider_down', // Provider service is down

	// Workflow errors
	TIMEOUT = 'timeout', // Action execution timeout
	CANCELLED = 'cancelled', // Action was cancelled

	// Unknown
	UNKNOWN = 'unknown', // Fallback for unexpected errors

	// Aliases for backwards compatibility
	RATE_LIMIT = 'rate_limited', // Alias for RATE_LIMITED
	UNKNOWN_ERROR = 'unknown', // Alias for UNKNOWN
	EXTERNAL_SERVICE_ERROR = 'provider_down', // Alias for PROVIDER_DOWN
}

// ============================================================================
// ERROR CATEGORY (Grouping for high-level handling)
// ============================================================================

export enum ErrorCategory {
	AUTHENTICATION = 'authentication', // All AUTH_* codes
	RATE_LIMIT = 'rate_limit', // RATE_LIMITED, QUOTA_EXCEEDED
	CONFIGURATION = 'configuration', // INVALID_CONFIG, MISSING_REQUIRED_FIELD
	API = 'api', // API_ERROR, NOT_FOUND, etc.
	NETWORK = 'network', // NETWORK_ERROR, PROVIDER_DOWN
	WORKFLOW = 'workflow', // TIMEOUT, CANCELLED
	UNKNOWN = 'unknown',
}

// ============================================================================
// ERROR CONTEXT
// ============================================================================

/**
 * Additional context about the error
 */
export interface ErrorContext {
	/**
	 * Which integration threw this error
	 */
	integration?: string;

	/**
	 * Which action threw this error
	 */
	action?: string;

	/**
	 * HTTP status code (if applicable)
	 */
	statusCode?: number;

	/**
	 * Provider-specific error code
	 */
	providerCode?: string;

	/**
	 * Provider-specific error message
	 */
	providerMessage?: string;

	/**
	 * Should this error be retried?
	 */
	retryable: boolean;

	/**
	 * If retryable, when to retry (milliseconds from now)
	 * If not specified, use exponential backoff
	 */
	retryAfterMs?: number;

	/**
	 * Maximum number of retries for this error
	 */
	maxRetries?: number;

	/**
	 * Additional arbitrary context
	 */
	metadata?: Record<string, unknown>;
}

// ============================================================================
// INTEGRATION ERROR CLASS
// ============================================================================

/**
 * IntegrationError - The Narrow Waist for all integration errors
 *
 * Usage in actions:
 * ```typescript
 * if (!tokens) {
 *   throw new IntegrationError(
 *     ErrorCode.AUTH_MISSING,
 *     'Gmail not connected for this user',
 *     { integration: 'gmail', action: 'send-email', retryable: false }
 *   );
 * }
 *
 * if (response.status === 429) {
 *   const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
 *   throw new IntegrationError(
 *     ErrorCode.RATE_LIMITED,
 *     'Gmail API rate limit exceeded',
 *     { retryable: true, retryAfterMs: retryAfter * 1000, maxRetries: 3 }
 *   );
 * }
 * ```
 */
export class IntegrationError extends Error {
	public readonly code: ErrorCode;
	public readonly category: ErrorCategory;
	public readonly context: ErrorContext;
	public readonly timestamp: number;

	constructor(code: ErrorCode, message: string, context: Partial<ErrorContext> = {}) {
		super(message);

		this.name = 'IntegrationError';
		this.code = code;
		this.category = this.categorizeError(code);
		this.timestamp = Date.now();

		// Default context
		this.context = {
			retryable: this.isRetryableByDefault(code),
			maxRetries: this.getDefaultMaxRetries(code),
			...context,
		};

		// Maintain proper stack trace (V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, IntegrationError);
		}
	}

	/**
	 * Categorize error code into high-level category
	 */
	private categorizeError(code: ErrorCode): ErrorCategory {
		if (
			[
				ErrorCode.AUTH_MISSING,
				ErrorCode.AUTH_EXPIRED,
				ErrorCode.AUTH_INVALID,
				ErrorCode.AUTH_INSUFFICIENT_SCOPE,
			].includes(code)
		) {
			return ErrorCategory.AUTHENTICATION;
		}

		if ([ErrorCode.RATE_LIMITED, ErrorCode.QUOTA_EXCEEDED].includes(code)) {
			return ErrorCategory.RATE_LIMIT;
		}

		if (
			[ErrorCode.INVALID_CONFIG, ErrorCode.MISSING_REQUIRED_FIELD, ErrorCode.INVALID_INPUT].includes(code)
		) {
			return ErrorCategory.CONFIGURATION;
		}

		if ([
			ErrorCode.API_ERROR,
			ErrorCode.NOT_FOUND,
			ErrorCode.PERMISSION_DENIED,
			ErrorCode.CONFLICT,
			ErrorCode.DATABASE_ERROR,
			ErrorCode.SEARCH_ERROR,
			ErrorCode.AI_MODEL_ERROR,
		].includes(code)) {
			return ErrorCategory.API;
		}

		if ([ErrorCode.NETWORK_ERROR, ErrorCode.PROVIDER_DOWN].includes(code)) {
			return ErrorCategory.NETWORK;
		}

		if ([ErrorCode.TIMEOUT, ErrorCode.CANCELLED].includes(code)) {
			return ErrorCategory.WORKFLOW;
		}

		if ([ErrorCode.PROCESSING_ERROR, ErrorCode.CONFIGURATION_ERROR].includes(code)) {
			return ErrorCategory.CONFIGURATION;
		}

		return ErrorCategory.UNKNOWN;
	}

	/**
	 * Determine if error is retryable by default based on code
	 */
	private isRetryableByDefault(code: ErrorCode): boolean {
		// Retryable errors
		const retryable = [
			ErrorCode.AUTH_EXPIRED, // Can refresh token
			ErrorCode.RATE_LIMITED, // Can retry after backoff
			ErrorCode.NETWORK_ERROR, // Transient network issue
			ErrorCode.PROVIDER_DOWN, // Provider might come back
			ErrorCode.TIMEOUT, // Might succeed on retry
		];

		return retryable.includes(code);
	}

	/**
	 * Get default max retries based on error code
	 */
	private getDefaultMaxRetries(code: ErrorCode): number {
		switch (code) {
			case ErrorCode.AUTH_EXPIRED:
				return 1; // Only retry once after refresh

			case ErrorCode.RATE_LIMITED:
				return 3; // Retry with exponential backoff

			case ErrorCode.NETWORK_ERROR:
			case ErrorCode.PROVIDER_DOWN:
				return 5; // More retries for transient issues

			case ErrorCode.TIMEOUT:
				return 2; // Limited retries for timeouts

			default:
				return 1; // Most errors shouldn't retry
		}
	}

	/**
	 * Check if this error should be retried
	 */
	isRetryable(): boolean {
		return this.context.retryable;
	}

	/**
	 * Get how long to wait before retrying (in milliseconds)
	 * Returns null if not retryable
	 */
	getRetryAfterMs(): number | null {
		if (!this.isRetryable()) {
			return null;
		}

		return this.context.retryAfterMs || null;
	}

	/**
	 * Get maximum number of retries
	 */
	getMaxRetries(): number {
		return this.context.maxRetries || 1;
	}

	/**
	 * Should this error trigger OAuth token refresh?
	 */
	shouldRefreshAuth(): boolean {
		return this.code === ErrorCode.AUTH_EXPIRED;
	}

	/**
	 * Should this error notify the user?
	 */
	shouldNotifyUser(): boolean {
		// Notify for non-retryable errors that require user action
		return (
			!this.isRetryable() &&
			[
				ErrorCode.AUTH_MISSING,
				ErrorCode.AUTH_INVALID,
				ErrorCode.AUTH_INSUFFICIENT_SCOPE,
				ErrorCode.INVALID_CONFIG,
				ErrorCode.PERMISSION_DENIED,
				ErrorCode.QUOTA_EXCEEDED,
			].includes(this.code)
		);
	}

	/**
	 * Convert to JSON for storage/logging
	 */
	toJSON(): {
		name: string;
		message: string;
		code: ErrorCode;
		category: ErrorCategory;
		context: ErrorContext;
		timestamp: number;
		stack?: string;
	} {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			category: this.category,
			context: this.context,
			timestamp: this.timestamp,
			stack: this.stack,
		};
	}

	// =========================================================================
	// UNIFIED ERROR HELPERS (Weniger, aber besser)
	// =========================================================================
	// These helpers unify CLI's APIError pattern with SDK's IntegrationError.
	// One interface for all error type checks across CLI, SDK, and integrations.

	/**
	 * Is this an authentication error (401)?
	 */
	isUnauthorized(): boolean {
		return this.context.statusCode === 401 || this.code === ErrorCode.AUTH_EXPIRED;
	}

	/**
	 * Is this a permission error (403)?
	 */
	isForbidden(): boolean {
		return this.context.statusCode === 403 || this.code === ErrorCode.PERMISSION_DENIED;
	}

	/**
	 * Is this a not found error (404)?
	 */
	isNotFound(): boolean {
		return this.context.statusCode === 404 || this.code === ErrorCode.NOT_FOUND;
	}

	/**
	 * Is this a conflict error (409)?
	 */
	isConflict(): boolean {
		return this.context.statusCode === 409 || this.code === ErrorCode.CONFLICT;
	}

	/**
	 * Is this a rate limit error (429)?
	 */
	isRateLimited(): boolean {
		return this.context.statusCode === 429 || this.code === ErrorCode.RATE_LIMITED;
	}

	/**
	 * Is this a validation/input error (422)?
	 */
	isValidationError(): boolean {
		return (
			this.context.statusCode === 422 ||
			this.code === ErrorCode.VALIDATION_ERROR ||
			this.code === ErrorCode.INVALID_INPUT ||
			this.code === ErrorCode.MISSING_REQUIRED_FIELD
		);
	}

	/**
	 * Is this a network/connectivity error?
	 */
	isNetworkError(): boolean {
		return this.code === ErrorCode.NETWORK_ERROR || this.code === ErrorCode.PROVIDER_DOWN;
	}

	/**
	 * Is this a server error (5xx)?
	 */
	isServerError(): boolean {
		const status = this.context.statusCode;
		return (status !== undefined && status >= 500) || this.code === ErrorCode.PROVIDER_DOWN;
	}

	/**
	 * Is this an authentication-related error that requires user action?
	 */
	requiresReauth(): boolean {
		return [
			ErrorCode.AUTH_MISSING,
			ErrorCode.AUTH_INVALID,
			ErrorCode.AUTH_INSUFFICIENT_SCOPE,
		].includes(this.code);
	}

	/**
	 * Create user-friendly error message
	 */
	getUserMessage(): string {
		switch (this.code) {
			case ErrorCode.AUTH_MISSING:
				return `Please connect your ${this.context.integration || 'account'} to continue.`;

			case ErrorCode.AUTH_EXPIRED:
				return `Your ${this.context.integration || 'account'} connection has expired. We're refreshing it automatically.`;

			case ErrorCode.AUTH_INVALID:
				return `Your ${this.context.integration || 'account'} connection is no longer valid. Please reconnect.`;

			case ErrorCode.AUTH_INSUFFICIENT_SCOPE:
				return `Additional permissions are required. Please reconnect your ${this.context.integration || 'account'}.`;

			case ErrorCode.RATE_LIMITED:
				if (this.context.retryAfterMs) {
					const seconds = Math.ceil(this.context.retryAfterMs / 1000);
					return `We're hitting rate limits. Your workflow will retry in ${seconds} seconds.`;
				}
				return `We're hitting rate limits. Your workflow will retry automatically.`;

			case ErrorCode.QUOTA_EXCEEDED:
				return `You've exceeded the API quota for ${this.context.integration || 'this service'}. Try again later.`;

			case ErrorCode.INVALID_CONFIG:
				return `There's an issue with your workflow configuration. Please review your settings.`;

			case ErrorCode.PERMISSION_DENIED:
				return `You don't have permission to perform this action.`;

			case ErrorCode.PROVIDER_DOWN:
				return `${this.context.integration || 'The service'} appears to be down. We'll retry automatically.`;

			default:
				return this.message;
		}
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create IntegrationError from HTTP response
 */
export async function createErrorFromResponse(
	response: Response,
	context: Partial<ErrorContext> = {}
): Promise<IntegrationError> {
	const statusCode = response.status;
	let providerMessage = response.statusText;
	let providerCode: string | undefined;

	// Try to parse error response
	try {
		const contentType = response.headers.get('content-type');
		if (contentType?.includes('application/json')) {
			const errorData = await response.json() as any;
			providerMessage = errorData.error?.message || errorData.message || providerMessage;
			providerCode = errorData.error?.code || errorData.code;
		} else {
			providerMessage = await response.text();
		}
	} catch {
		// Ignore parse errors
	}

	// Map HTTP status to error code
	let code: ErrorCode;
	let message: string;

	switch (statusCode) {
		case 401:
			code = ErrorCode.AUTH_EXPIRED;
			message = 'Authentication failed - token may be expired';
			break;

		case 403:
			code = ErrorCode.PERMISSION_DENIED;
			message = 'Permission denied';
			break;

		case 404:
			code = ErrorCode.NOT_FOUND;
			message = 'Resource not found';
			break;

		case 409:
			code = ErrorCode.CONFLICT;
			message = 'Resource conflict';
			break;

		case 429:
			code = ErrorCode.RATE_LIMITED;
			message = 'Rate limit exceeded';
			// Parse Retry-After header using shared utility (DRY)
			const retryAfterMs = parseRetryAfterHeader(response);
			if (retryAfterMs !== null) {
				context.retryAfterMs = retryAfterMs;
			}
			break;

		case 500:
		case 502:
		case 503:
		case 504:
			code = ErrorCode.PROVIDER_DOWN;
			message = 'Provider service error';
			break;

		default:
			code = ErrorCode.API_ERROR;
			message = `API error: ${statusCode}`;
	}

	return new IntegrationError(code, message, {
		...context,
		statusCode,
		providerCode,
		providerMessage,
	});
}

/**
 * Type guard to check if error is IntegrationError
 */
export function isIntegrationError(error: unknown): error is IntegrationError {
	return error instanceof IntegrationError;
}

/**
 * Convert any error to IntegrationError
 */
export function toIntegrationError(error: unknown, context: Partial<ErrorContext> = {}): IntegrationError {
	if (isIntegrationError(error)) {
		return error;
	}

	if (error instanceof Error) {
		return new IntegrationError(ErrorCode.UNKNOWN, error.message, {
			...context,
			metadata: {
				originalError: error.name,
				stack: error.stack,
			},
		});
	}

	return new IntegrationError(ErrorCode.UNKNOWN, String(error), context);
}

// ============================================================================
// BREAKDOWN SEVERITY BRIDGE (Heideggerian Visibility)
// ============================================================================

/**
 * BreakdownSeverity - When Zuhandenheit fails
 *
 * Heideggerian principle: Tools become visible (Vorhandenheit) when they break.
 * We minimize visibility and provide paths back to invisibility.
 *
 * Imported here for unified error handling - errors map to breakdown severity
 * to determine user-facing visibility.
 */
export enum BreakdownSeverity {
	/** Auto-recover, user never knows */
	SILENT = 'silent',

	/** Subtle indicator, no action required */
	AMBIENT = 'ambient',

	/** User informed, action optional */
	NOTIFICATION = 'notification',

	/** User must act to proceed */
	BLOCKING = 'blocking',
}

/**
 * Map ErrorCode to BreakdownSeverity
 *
 * Weniger, aber besser: One mapping function for all error → visibility decisions.
 * Used by both SDK and CLI for consistent user experience.
 */
export function getBreakdownSeverity(error: IntegrationError): BreakdownSeverity {
	// Silent: Auto-recoverable, user never knows
	if (error.isRetryable() && error.code === ErrorCode.TIMEOUT) {
		return BreakdownSeverity.SILENT;
	}

	// Ambient: Subtle indicator, no action needed
	if (error.isRateLimited() || error.code === ErrorCode.NETWORK_ERROR) {
		return BreakdownSeverity.AMBIENT;
	}

	// Notification: User informed, action optional
	if (error.code === ErrorCode.AUTH_EXPIRED || error.code === ErrorCode.PROVIDER_DOWN) {
		return BreakdownSeverity.NOTIFICATION;
	}

	// Blocking: User must act
	if (error.requiresReauth() || error.code === ErrorCode.INVALID_CONFIG) {
		return BreakdownSeverity.BLOCKING;
	}

	// Default to notification for unknown errors
	return BreakdownSeverity.NOTIFICATION;
}

/**
 * Unified error type guard that works with any error-like object
 *
 * Checks if the object has the unified error interface (isUnauthorized, etc.)
 */
export function hasUnifiedErrorInterface(
	error: unknown
): error is { isUnauthorized: () => boolean; isForbidden: () => boolean; isRetryable: () => boolean } {
	return (
		error !== null &&
		typeof error === 'object' &&
		'isUnauthorized' in error &&
		'isForbidden' in error &&
		typeof (error as any).isUnauthorized === 'function'
	);
}
