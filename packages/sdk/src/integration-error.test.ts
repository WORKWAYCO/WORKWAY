/**
 * IntegrationError Tests
 *
 * Tests for the standardized error taxonomy.
 */

import { describe, it, expect, vi } from 'vitest';
import {
	IntegrationError,
	ErrorCode,
	ErrorCategory,
	BreakdownSeverity,
	createErrorFromResponse,
	isIntegrationError,
	toIntegrationError,
	getBreakdownSeverity,
	hasUnifiedErrorInterface,
} from './integration-error.js';

// ============================================================================
// INTEGRATIONERROR CONSTRUCTOR TESTS
// ============================================================================

describe('IntegrationError constructor', () => {
	it('should create error with code and message', () => {
		const error = new IntegrationError(ErrorCode.NOT_FOUND, 'Resource not found');

		expect(error.code).toBe(ErrorCode.NOT_FOUND);
		expect(error.message).toBe('Resource not found');
		expect(error.name).toBe('IntegrationError');
	});

	it('should set timestamp on creation', () => {
		const before = Date.now();
		const error = new IntegrationError(ErrorCode.API_ERROR, 'Test');
		const after = Date.now();

		expect(error.timestamp).toBeGreaterThanOrEqual(before);
		expect(error.timestamp).toBeLessThanOrEqual(after);
	});

	it('should include context when provided', () => {
		const error = new IntegrationError(ErrorCode.AUTH_MISSING, 'Not authenticated', {
			integration: 'gmail',
			action: 'send-email',
			statusCode: 401,
		});

		expect(error.context.integration).toBe('gmail');
		expect(error.context.action).toBe('send-email');
		expect(error.context.statusCode).toBe(401);
	});

	it('should extend Error class', () => {
		const error = new IntegrationError(ErrorCode.API_ERROR, 'Test');
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(IntegrationError);
	});

	it('should preserve stack trace', () => {
		const error = new IntegrationError(ErrorCode.API_ERROR, 'Test');
		expect(error.stack).toBeDefined();
		expect(error.stack).toContain('IntegrationError');
	});
});

// ============================================================================
// ERROR CATEGORY TESTS
// ============================================================================

describe('Error categorization', () => {
	it('should categorize auth errors correctly', () => {
		expect(new IntegrationError(ErrorCode.AUTH_MISSING, 'test').category).toBe(
			ErrorCategory.AUTHENTICATION
		);
		expect(new IntegrationError(ErrorCode.AUTH_EXPIRED, 'test').category).toBe(
			ErrorCategory.AUTHENTICATION
		);
		expect(new IntegrationError(ErrorCode.AUTH_INVALID, 'test').category).toBe(
			ErrorCategory.AUTHENTICATION
		);
		expect(new IntegrationError(ErrorCode.AUTH_INSUFFICIENT_SCOPE, 'test').category).toBe(
			ErrorCategory.AUTHENTICATION
		);
	});

	it('should categorize rate limit errors correctly', () => {
		expect(new IntegrationError(ErrorCode.RATE_LIMITED, 'test').category).toBe(
			ErrorCategory.RATE_LIMIT
		);
		expect(new IntegrationError(ErrorCode.QUOTA_EXCEEDED, 'test').category).toBe(
			ErrorCategory.RATE_LIMIT
		);
	});

	it('should categorize configuration errors correctly', () => {
		expect(new IntegrationError(ErrorCode.INVALID_CONFIG, 'test').category).toBe(
			ErrorCategory.CONFIGURATION
		);
		expect(new IntegrationError(ErrorCode.MISSING_REQUIRED_FIELD, 'test').category).toBe(
			ErrorCategory.CONFIGURATION
		);
		expect(new IntegrationError(ErrorCode.INVALID_INPUT, 'test').category).toBe(
			ErrorCategory.CONFIGURATION
		);
	});

	it('should categorize API errors correctly', () => {
		expect(new IntegrationError(ErrorCode.API_ERROR, 'test').category).toBe(ErrorCategory.API);
		expect(new IntegrationError(ErrorCode.NOT_FOUND, 'test').category).toBe(ErrorCategory.API);
		expect(new IntegrationError(ErrorCode.PERMISSION_DENIED, 'test').category).toBe(
			ErrorCategory.API
		);
		expect(new IntegrationError(ErrorCode.CONFLICT, 'test').category).toBe(ErrorCategory.API);
	});

	it('should categorize network errors correctly', () => {
		expect(new IntegrationError(ErrorCode.NETWORK_ERROR, 'test').category).toBe(
			ErrorCategory.NETWORK
		);
		expect(new IntegrationError(ErrorCode.PROVIDER_DOWN, 'test').category).toBe(
			ErrorCategory.NETWORK
		);
	});

	it('should categorize workflow errors correctly', () => {
		expect(new IntegrationError(ErrorCode.TIMEOUT, 'test').category).toBe(ErrorCategory.WORKFLOW);
		expect(new IntegrationError(ErrorCode.CANCELLED, 'test').category).toBe(
			ErrorCategory.WORKFLOW
		);
	});

	it('should categorize unknown errors correctly', () => {
		expect(new IntegrationError(ErrorCode.UNKNOWN, 'test').category).toBe(ErrorCategory.UNKNOWN);
	});
});

// ============================================================================
// RETRYABLE LOGIC TESTS
// ============================================================================

describe('Retryable logic', () => {
	it('should mark AUTH_EXPIRED as retryable (can refresh)', () => {
		const error = new IntegrationError(ErrorCode.AUTH_EXPIRED, 'Token expired');
		expect(error.isRetryable()).toBe(true);
		expect(error.getMaxRetries()).toBe(1);
	});

	it('should mark RATE_LIMITED as retryable', () => {
		const error = new IntegrationError(ErrorCode.RATE_LIMITED, 'Rate limited');
		expect(error.isRetryable()).toBe(true);
		expect(error.getMaxRetries()).toBe(3);
	});

	it('should mark NETWORK_ERROR as retryable', () => {
		const error = new IntegrationError(ErrorCode.NETWORK_ERROR, 'Network error');
		expect(error.isRetryable()).toBe(true);
		expect(error.getMaxRetries()).toBe(5);
	});

	it('should mark PROVIDER_DOWN as retryable', () => {
		const error = new IntegrationError(ErrorCode.PROVIDER_DOWN, 'Service unavailable');
		expect(error.isRetryable()).toBe(true);
		expect(error.getMaxRetries()).toBe(5);
	});

	it('should mark TIMEOUT as retryable', () => {
		const error = new IntegrationError(ErrorCode.TIMEOUT, 'Request timed out');
		expect(error.isRetryable()).toBe(true);
		expect(error.getMaxRetries()).toBe(2);
	});

	it('should NOT mark AUTH_INVALID as retryable', () => {
		const error = new IntegrationError(ErrorCode.AUTH_INVALID, 'Token revoked');
		expect(error.isRetryable()).toBe(false);
	});

	it('should NOT mark INVALID_CONFIG as retryable', () => {
		const error = new IntegrationError(ErrorCode.INVALID_CONFIG, 'Bad config');
		expect(error.isRetryable()).toBe(false);
	});

	it('should NOT mark NOT_FOUND as retryable', () => {
		const error = new IntegrationError(ErrorCode.NOT_FOUND, 'Not found');
		expect(error.isRetryable()).toBe(false);
	});

	it('should allow context to override retryable default', () => {
		const error = new IntegrationError(ErrorCode.API_ERROR, 'Error', {
			retryable: true,
		});
		expect(error.isRetryable()).toBe(true);
	});

	it('should return retryAfterMs when set', () => {
		const error = new IntegrationError(ErrorCode.RATE_LIMITED, 'Rate limited', {
			retryAfterMs: 60000,
		});
		expect(error.getRetryAfterMs()).toBe(60000);
	});

	it('should return null for retryAfterMs when not retryable', () => {
		const error = new IntegrationError(ErrorCode.NOT_FOUND, 'Not found');
		expect(error.getRetryAfterMs()).toBeNull();
	});
});

// ============================================================================
// HELPER METHOD TESTS
// ============================================================================

describe('Helper methods', () => {
	describe('shouldRefreshAuth', () => {
		it('should return true for AUTH_EXPIRED', () => {
			const error = new IntegrationError(ErrorCode.AUTH_EXPIRED, 'Expired');
			expect(error.shouldRefreshAuth()).toBe(true);
		});

		it('should return false for other auth errors', () => {
			expect(new IntegrationError(ErrorCode.AUTH_MISSING, 'test').shouldRefreshAuth()).toBe(
				false
			);
			expect(new IntegrationError(ErrorCode.AUTH_INVALID, 'test').shouldRefreshAuth()).toBe(
				false
			);
		});
	});

	describe('shouldNotifyUser', () => {
		it('should return true for non-retryable user-action errors', () => {
			expect(new IntegrationError(ErrorCode.AUTH_MISSING, 'test').shouldNotifyUser()).toBe(true);
			expect(new IntegrationError(ErrorCode.AUTH_INVALID, 'test').shouldNotifyUser()).toBe(true);
			expect(new IntegrationError(ErrorCode.INVALID_CONFIG, 'test').shouldNotifyUser()).toBe(
				true
			);
			expect(new IntegrationError(ErrorCode.PERMISSION_DENIED, 'test').shouldNotifyUser()).toBe(
				true
			);
		});

		it('should return false for retryable errors', () => {
			expect(new IntegrationError(ErrorCode.RATE_LIMITED, 'test').shouldNotifyUser()).toBe(false);
			expect(new IntegrationError(ErrorCode.NETWORK_ERROR, 'test').shouldNotifyUser()).toBe(
				false
			);
		});
	});

	describe('toJSON', () => {
		it('should serialize error to JSON format', () => {
			const error = new IntegrationError(ErrorCode.NOT_FOUND, 'Resource not found', {
				integration: 'notion',
				action: 'get-page',
				statusCode: 404,
			});

			const json = error.toJSON();

			expect(json.name).toBe('IntegrationError');
			expect(json.message).toBe('Resource not found');
			expect(json.code).toBe(ErrorCode.NOT_FOUND);
			expect(json.category).toBe(ErrorCategory.API);
			expect(json.context.integration).toBe('notion');
			expect(json.timestamp).toBeDefined();
			expect(json.stack).toBeDefined();
		});
	});

	describe('getUserMessage', () => {
		it('should return user-friendly message for AUTH_MISSING', () => {
			const error = new IntegrationError(ErrorCode.AUTH_MISSING, 'test', {
				integration: 'gmail',
			});
			expect(error.getUserMessage()).toContain('connect your gmail');
		});

		it('should return user-friendly message for RATE_LIMITED', () => {
			const error = new IntegrationError(ErrorCode.RATE_LIMITED, 'test');
			expect(error.getUserMessage()).toContain('rate limits');
			expect(error.getUserMessage()).toContain('retry');
		});

		it('should include wait time in RATE_LIMITED message when retryAfterMs is set', () => {
			const error = new IntegrationError(ErrorCode.RATE_LIMITED, 'test', {
				retryAfterMs: 30000, // 30 seconds
			});
			expect(error.getUserMessage()).toContain('rate limits');
			expect(error.getUserMessage()).toContain('30 seconds');
		});

		it('should round up fractional seconds in RATE_LIMITED message', () => {
			const error = new IntegrationError(ErrorCode.RATE_LIMITED, 'test', {
				retryAfterMs: 1500, // 1.5 seconds
			});
			expect(error.getUserMessage()).toContain('2 seconds');
		});

		it('should return original message for unknown errors', () => {
			const error = new IntegrationError(ErrorCode.UNKNOWN, 'Custom error message');
			expect(error.getUserMessage()).toBe('Custom error message');
		});
	});
});

// ============================================================================
// UNIFIED ERROR INTERFACE TESTS
// ============================================================================

describe('Unified error interface', () => {
	describe('isUnauthorized', () => {
		it('should return true for 401 status', () => {
			const error = new IntegrationError(ErrorCode.API_ERROR, 'test', { statusCode: 401 });
			expect(error.isUnauthorized()).toBe(true);
		});

		it('should return true for AUTH_EXPIRED', () => {
			const error = new IntegrationError(ErrorCode.AUTH_EXPIRED, 'test');
			expect(error.isUnauthorized()).toBe(true);
		});
	});

	describe('isForbidden', () => {
		it('should return true for 403 status', () => {
			const error = new IntegrationError(ErrorCode.API_ERROR, 'test', { statusCode: 403 });
			expect(error.isForbidden()).toBe(true);
		});

		it('should return true for PERMISSION_DENIED', () => {
			const error = new IntegrationError(ErrorCode.PERMISSION_DENIED, 'test');
			expect(error.isForbidden()).toBe(true);
		});
	});

	describe('isNotFound', () => {
		it('should return true for 404 status', () => {
			const error = new IntegrationError(ErrorCode.API_ERROR, 'test', { statusCode: 404 });
			expect(error.isNotFound()).toBe(true);
		});

		it('should return true for NOT_FOUND code', () => {
			const error = new IntegrationError(ErrorCode.NOT_FOUND, 'test');
			expect(error.isNotFound()).toBe(true);
		});
	});

	describe('isConflict', () => {
		it('should return true for 409 status', () => {
			const error = new IntegrationError(ErrorCode.API_ERROR, 'test', { statusCode: 409 });
			expect(error.isConflict()).toBe(true);
		});
	});

	describe('isRateLimited', () => {
		it('should return true for 429 status', () => {
			const error = new IntegrationError(ErrorCode.API_ERROR, 'test', { statusCode: 429 });
			expect(error.isRateLimited()).toBe(true);
		});
	});

	describe('isValidationError', () => {
		it('should return true for 422 status', () => {
			const error = new IntegrationError(ErrorCode.API_ERROR, 'test', { statusCode: 422 });
			expect(error.isValidationError()).toBe(true);
		});

		it('should return true for validation codes', () => {
			expect(new IntegrationError(ErrorCode.VALIDATION_ERROR, 'test').isValidationError()).toBe(
				true
			);
			expect(new IntegrationError(ErrorCode.INVALID_INPUT, 'test').isValidationError()).toBe(
				true
			);
			expect(
				new IntegrationError(ErrorCode.MISSING_REQUIRED_FIELD, 'test').isValidationError()
			).toBe(true);
		});
	});

	describe('isNetworkError', () => {
		it('should return true for network codes', () => {
			expect(new IntegrationError(ErrorCode.NETWORK_ERROR, 'test').isNetworkError()).toBe(true);
			expect(new IntegrationError(ErrorCode.PROVIDER_DOWN, 'test').isNetworkError()).toBe(true);
		});
	});

	describe('isServerError', () => {
		it('should return true for 5xx status', () => {
			expect(
				new IntegrationError(ErrorCode.API_ERROR, 'test', { statusCode: 500 }).isServerError()
			).toBe(true);
			expect(
				new IntegrationError(ErrorCode.API_ERROR, 'test', { statusCode: 502 }).isServerError()
			).toBe(true);
			expect(
				new IntegrationError(ErrorCode.API_ERROR, 'test', { statusCode: 503 }).isServerError()
			).toBe(true);
		});

		it('should return true for PROVIDER_DOWN', () => {
			expect(new IntegrationError(ErrorCode.PROVIDER_DOWN, 'test').isServerError()).toBe(true);
		});
	});

	describe('requiresReauth', () => {
		it('should return true for auth errors requiring user action', () => {
			expect(new IntegrationError(ErrorCode.AUTH_MISSING, 'test').requiresReauth()).toBe(true);
			expect(new IntegrationError(ErrorCode.AUTH_INVALID, 'test').requiresReauth()).toBe(true);
			expect(
				new IntegrationError(ErrorCode.AUTH_INSUFFICIENT_SCOPE, 'test').requiresReauth()
			).toBe(true);
		});

		it('should return false for AUTH_EXPIRED (can auto-refresh)', () => {
			expect(new IntegrationError(ErrorCode.AUTH_EXPIRED, 'test').requiresReauth()).toBe(false);
		});
	});
});

// ============================================================================
// CREATEERRORFROMRESPONSE TESTS
// ============================================================================

describe('createErrorFromResponse', () => {
	it('should create error from 401 response', async () => {
		const response = new Response(null, { status: 401, statusText: 'Unauthorized' });
		const error = await createErrorFromResponse(response);

		expect(error.code).toBe(ErrorCode.AUTH_EXPIRED);
		expect(error.context.statusCode).toBe(401);
	});

	it('should create error from 404 response', async () => {
		const response = new Response(null, { status: 404, statusText: 'Not Found' });
		const error = await createErrorFromResponse(response);

		expect(error.code).toBe(ErrorCode.NOT_FOUND);
	});

	it('should create error from 429 response with Retry-After header', async () => {
		const response = new Response(null, {
			status: 429,
			statusText: 'Too Many Requests',
			headers: { 'Retry-After': '60' },
		});
		const error = await createErrorFromResponse(response);

		expect(error.code).toBe(ErrorCode.RATE_LIMITED);
		expect(error.context.retryAfterMs).toBe(60000);
	});

	it('should create error from 429 response with HTTP date Retry-After header', async () => {
		const futureDate = new Date(Date.now() + 120000); // 2 minutes from now
		const response = new Response(null, {
			status: 429,
			statusText: 'Too Many Requests',
			headers: { 'Retry-After': futureDate.toUTCString() },
		});
		const error = await createErrorFromResponse(response);

		expect(error.code).toBe(ErrorCode.RATE_LIMITED);
		// Allow 10 second tolerance for timing
		expect(error.context.retryAfterMs).toBeGreaterThan(100000);
		expect(error.context.retryAfterMs).toBeLessThan(130000);
	});

	it('should create error from 429 response without Retry-After header', async () => {
		const response = new Response(null, {
			status: 429,
			statusText: 'Too Many Requests',
		});
		const error = await createErrorFromResponse(response);

		expect(error.code).toBe(ErrorCode.RATE_LIMITED);
		expect(error.context.retryAfterMs).toBeUndefined();
	});

	it('should create error from 500 response', async () => {
		const response = new Response(null, { status: 500, statusText: 'Internal Server Error' });
		const error = await createErrorFromResponse(response);

		expect(error.code).toBe(ErrorCode.PROVIDER_DOWN);
	});

	it('should parse JSON error response', async () => {
		const errorData = { error: { message: 'Custom error', code: 'CUSTOM_CODE' } };
		const response = new Response(JSON.stringify(errorData), {
			status: 400,
			headers: { 'content-type': 'application/json' },
		});
		const error = await createErrorFromResponse(response);

		expect(error.context.providerMessage).toBe('Custom error');
		expect(error.context.providerCode).toBe('CUSTOM_CODE');
	});

	it('should preserve context options', async () => {
		const response = new Response(null, { status: 404 });
		const error = await createErrorFromResponse(response, {
			integration: 'notion',
			action: 'get-page',
		});

		expect(error.context.integration).toBe('notion');
		expect(error.context.action).toBe('get-page');
	});
});

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe('isIntegrationError', () => {
	it('should return true for IntegrationError', () => {
		const error = new IntegrationError(ErrorCode.API_ERROR, 'test');
		expect(isIntegrationError(error)).toBe(true);
	});

	it('should return false for regular Error', () => {
		expect(isIntegrationError(new Error('test'))).toBe(false);
	});

	it('should return false for null', () => {
		expect(isIntegrationError(null)).toBe(false);
	});

	it('should return false for string', () => {
		expect(isIntegrationError('error')).toBe(false);
	});
});

describe('toIntegrationError', () => {
	it('should return same error if already IntegrationError', () => {
		const original = new IntegrationError(ErrorCode.NOT_FOUND, 'test');
		const converted = toIntegrationError(original);
		expect(converted).toBe(original);
	});

	it('should convert regular Error to IntegrationError', () => {
		const original = new Error('Something went wrong');
		const converted = toIntegrationError(original);

		expect(converted).toBeInstanceOf(IntegrationError);
		expect(converted.code).toBe(ErrorCode.UNKNOWN);
		expect(converted.message).toBe('Something went wrong');
	});

	it('should convert string to IntegrationError', () => {
		const converted = toIntegrationError('String error');

		expect(converted).toBeInstanceOf(IntegrationError);
		expect(converted.message).toBe('String error');
	});

	it('should preserve context when converting', () => {
		const converted = toIntegrationError(new Error('test'), {
			integration: 'slack',
			action: 'post-message',
		});

		expect(converted.context.integration).toBe('slack');
		expect(converted.context.action).toBe('post-message');
	});
});

// ============================================================================
// BREAKDOWN SEVERITY TESTS
// ============================================================================

describe('getBreakdownSeverity', () => {
	it('should return SILENT for retryable TIMEOUT', () => {
		const error = new IntegrationError(ErrorCode.TIMEOUT, 'Timed out');
		expect(getBreakdownSeverity(error)).toBe(BreakdownSeverity.SILENT);
	});

	it('should return AMBIENT for rate limiting', () => {
		const error = new IntegrationError(ErrorCode.RATE_LIMITED, 'Rate limited');
		expect(getBreakdownSeverity(error)).toBe(BreakdownSeverity.AMBIENT);
	});

	it('should return AMBIENT for network errors', () => {
		const error = new IntegrationError(ErrorCode.NETWORK_ERROR, 'Network issue');
		expect(getBreakdownSeverity(error)).toBe(BreakdownSeverity.AMBIENT);
	});

	it('should return NOTIFICATION for AUTH_EXPIRED', () => {
		const error = new IntegrationError(ErrorCode.AUTH_EXPIRED, 'Token expired');
		expect(getBreakdownSeverity(error)).toBe(BreakdownSeverity.NOTIFICATION);
	});

	it('should return NOTIFICATION for PROVIDER_DOWN', () => {
		const error = new IntegrationError(ErrorCode.PROVIDER_DOWN, 'Service down');
		expect(getBreakdownSeverity(error)).toBe(BreakdownSeverity.NOTIFICATION);
	});

	it('should return BLOCKING for auth errors requiring reauth', () => {
		expect(getBreakdownSeverity(new IntegrationError(ErrorCode.AUTH_MISSING, 'test'))).toBe(
			BreakdownSeverity.BLOCKING
		);
		expect(getBreakdownSeverity(new IntegrationError(ErrorCode.AUTH_INVALID, 'test'))).toBe(
			BreakdownSeverity.BLOCKING
		);
	});

	it('should return BLOCKING for INVALID_CONFIG', () => {
		const error = new IntegrationError(ErrorCode.INVALID_CONFIG, 'Bad config');
		expect(getBreakdownSeverity(error)).toBe(BreakdownSeverity.BLOCKING);
	});
});

// ============================================================================
// HASUNIFIEDERRORINTERFACE TESTS
// ============================================================================

describe('hasUnifiedErrorInterface', () => {
	it('should return true for IntegrationError', () => {
		const error = new IntegrationError(ErrorCode.API_ERROR, 'test');
		expect(hasUnifiedErrorInterface(error)).toBe(true);
	});

	it('should return false for regular Error', () => {
		expect(hasUnifiedErrorInterface(new Error('test'))).toBe(false);
	});

	it('should return false for null', () => {
		expect(hasUnifiedErrorInterface(null)).toBe(false);
	});

	it('should return false for object without methods', () => {
		expect(hasUnifiedErrorInterface({ message: 'error' })).toBe(false);
	});
});

// ============================================================================
// ERROR CODE ALIASES TESTS
// ============================================================================

describe('ErrorCode aliases', () => {
	it('should have RATE_LIMIT alias for RATE_LIMITED', () => {
		expect(ErrorCode.RATE_LIMIT).toBe(ErrorCode.RATE_LIMITED);
	});

	it('should have UNKNOWN_ERROR alias for UNKNOWN', () => {
		expect(ErrorCode.UNKNOWN_ERROR).toBe(ErrorCode.UNKNOWN);
	});

	it('should have EXTERNAL_SERVICE_ERROR alias for PROVIDER_DOWN', () => {
		expect(ErrorCode.EXTERNAL_SERVICE_ERROR).toBe(ErrorCode.PROVIDER_DOWN);
	});
});
