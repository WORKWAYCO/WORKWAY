/**
 * Retry Module Tests
 *
 * Tests for the retry utilities with exponential backoff.
 * These utilities are core to all integrations' resilience.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	withRetry,
	fetchWithRetry,
	defaultShouldRetry,
	shouldRetryResponse,
	parseRetryAfter,
	createRateLimitAwareRetry,
	type RetryOptions,
	type RetryContext,
} from './retry.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a mock Response-like object (for tests that don't need instanceof)
 */
function createMockResponse(status: number, headers: Record<string, string> = {}): Response {
	return {
		status,
		ok: status >= 200 && status < 300,
		headers: new Headers(headers),
	} as Response;
}

/**
 * Create a real Response object (for tests that need instanceof checks)
 */
function createRealResponse(status: number, headers: Record<string, string> = {}): Response {
	return new Response(null, { status, headers });
}

// ============================================================================
// defaultShouldRetry TESTS
// ============================================================================

describe('defaultShouldRetry', () => {
	describe('TypeError (network errors)', () => {
		it('should return true for TypeError', () => {
			const error = new TypeError('fetch failed');
			expect(defaultShouldRetry(error, 1)).toBe(true);
		});

		it('should retry on multiple attempts', () => {
			const error = new TypeError('network unavailable');
			expect(defaultShouldRetry(error, 1)).toBe(true);
			expect(defaultShouldRetry(error, 2)).toBe(true);
			expect(defaultShouldRetry(error, 3)).toBe(true);
		});
	});

	describe('AbortError (timeout)', () => {
		it('should return true for AbortError DOMException', () => {
			const error = new DOMException('The operation was aborted', 'AbortError');
			expect(defaultShouldRetry(error, 1)).toBe(true);
		});

		it('should return false for other DOMException types', () => {
			const error = new DOMException('Security error', 'SecurityError');
			expect(defaultShouldRetry(error, 1)).toBe(false);
		});
	});

	describe('Response objects (HTTP errors)', () => {
		it('should return true for 5xx server errors', () => {
			expect(defaultShouldRetry(createMockResponse(500), 1)).toBe(true);
			expect(defaultShouldRetry(createMockResponse(502), 1)).toBe(true);
			expect(defaultShouldRetry(createMockResponse(503), 1)).toBe(true);
			expect(defaultShouldRetry(createMockResponse(504), 1)).toBe(true);
		});

		it('should return true for 429 rate limit', () => {
			expect(defaultShouldRetry(createMockResponse(429), 1)).toBe(true);
		});

		it('should return false for 4xx client errors (except 429)', () => {
			expect(defaultShouldRetry(createMockResponse(400), 1)).toBe(false);
			expect(defaultShouldRetry(createMockResponse(401), 1)).toBe(false);
			expect(defaultShouldRetry(createMockResponse(403), 1)).toBe(false);
			expect(defaultShouldRetry(createMockResponse(404), 1)).toBe(false);
			expect(defaultShouldRetry(createMockResponse(422), 1)).toBe(false);
		});

		it('should return false for 2xx success', () => {
			expect(defaultShouldRetry(createMockResponse(200), 1)).toBe(false);
			expect(defaultShouldRetry(createMockResponse(201), 1)).toBe(false);
			expect(defaultShouldRetry(createMockResponse(204), 1)).toBe(false);
		});

		it('should return false for 3xx redirects', () => {
			expect(defaultShouldRetry(createMockResponse(301), 1)).toBe(false);
			expect(defaultShouldRetry(createMockResponse(302), 1)).toBe(false);
			expect(defaultShouldRetry(createMockResponse(304), 1)).toBe(false);
		});
	});

	describe('objects with status property', () => {
		it('should return true for objects with 5xx status', () => {
			expect(defaultShouldRetry({ status: 500 }, 1)).toBe(true);
			expect(defaultShouldRetry({ status: 503 }, 1)).toBe(true);
		});

		it('should return true for objects with 429 status', () => {
			expect(defaultShouldRetry({ status: 429 }, 1)).toBe(true);
		});

		it('should return false for objects with 4xx status', () => {
			expect(defaultShouldRetry({ status: 400 }, 1)).toBe(false);
			expect(defaultShouldRetry({ status: 404 }, 1)).toBe(false);
		});
	});

	describe('unknown errors', () => {
		it('should return false for unknown error types', () => {
			expect(defaultShouldRetry(new Error('generic error'), 1)).toBe(false);
			expect(defaultShouldRetry('string error', 1)).toBe(false);
			expect(defaultShouldRetry(null, 1)).toBe(false);
			expect(defaultShouldRetry(undefined, 1)).toBe(false);
			expect(defaultShouldRetry(42, 1)).toBe(false);
		});
	});
});

// ============================================================================
// shouldRetryResponse TESTS
// ============================================================================

describe('shouldRetryResponse', () => {
	it('should return true for 5xx responses', () => {
		expect(shouldRetryResponse(createMockResponse(500))).toBe(true);
		expect(shouldRetryResponse(createMockResponse(502))).toBe(true);
		expect(shouldRetryResponse(createMockResponse(503))).toBe(true);
	});

	it('should return true for 429 rate limit', () => {
		expect(shouldRetryResponse(createMockResponse(429))).toBe(true);
	});

	it('should return false for success responses', () => {
		expect(shouldRetryResponse(createMockResponse(200))).toBe(false);
		expect(shouldRetryResponse(createMockResponse(201))).toBe(false);
	});

	it('should return false for 4xx client errors (except 429)', () => {
		expect(shouldRetryResponse(createMockResponse(400))).toBe(false);
		expect(shouldRetryResponse(createMockResponse(401))).toBe(false);
		expect(shouldRetryResponse(createMockResponse(404))).toBe(false);
	});
});

// ============================================================================
// withRetry TESTS
// ============================================================================

describe('withRetry', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('successful execution', () => {
		it('should return result on first success', async () => {
			const fn = vi.fn().mockResolvedValue('success');
			const promise = withRetry(fn);
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe('success');
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should pass RetryContext to function', async () => {
			const fn = vi.fn().mockResolvedValue('done');
			const promise = withRetry(fn);
			await vi.runAllTimersAsync();
			await promise;

			expect(fn).toHaveBeenCalledWith(
				expect.objectContaining({
					attempt: 1,
					maxAttempts: 3,
					totalElapsedMs: expect.any(Number),
				})
			);
		});

		it('should succeed after retries', async () => {
			const fn = vi
				.fn()
				.mockRejectedValueOnce(new TypeError('network error'))
				.mockRejectedValueOnce(new TypeError('network error'))
				.mockResolvedValue('success on third try');

			const promise = withRetry(fn, { maxAttempts: 3, initialDelay: 100 });
			await vi.runAllTimersAsync();
			const result = await promise;

			expect(result).toBe('success on third try');
			expect(fn).toHaveBeenCalledTimes(3);
		});
	});

	describe('retry behavior', () => {
		it('should respect maxAttempts option', async () => {
			const fn = vi.fn().mockRejectedValue(new TypeError('always fails'));
			const promise = withRetry(fn, { maxAttempts: 5, initialDelay: 100 });
			// Attach catch to prevent unhandled rejection during timer advancement
			const handledPromise = promise.catch(() => {});

			await vi.runAllTimersAsync();
			await handledPromise;
			await expect(promise).rejects.toThrow('always fails');
			expect(fn).toHaveBeenCalledTimes(5);
		});

		it('should not retry when shouldRetry returns false', async () => {
			const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));

			const promise = withRetry(fn, {
				maxAttempts: 3,
				shouldRetry: () => false,
			});
			const handledPromise = promise.catch(() => {});

			await vi.runAllTimersAsync();
			await handledPromise;
			await expect(promise).rejects.toThrow('non-retryable');
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should call onRetry callback on each retry', async () => {
			const onRetry = vi.fn();
			const error = new TypeError('network error');
			const fn = vi.fn().mockRejectedValue(error);

			const promise = withRetry(fn, {
				maxAttempts: 3,
				initialDelay: 1000,
				onRetry,
			});
			const handledPromise = promise.catch(() => {});

			await vi.runAllTimersAsync();
			await handledPromise;
			await expect(promise).rejects.toThrow();

			// onRetry should be called for retries (not the final failure)
			expect(onRetry).toHaveBeenCalledTimes(2);
			expect(onRetry).toHaveBeenCalledWith(error, 1, expect.any(Number));
			expect(onRetry).toHaveBeenCalledWith(error, 2, expect.any(Number));
		});
	});

	describe('backoff strategies', () => {
		it('should use exponential backoff by default', async () => {
			const delays: number[] = [];
			const fn = vi.fn().mockRejectedValue(new TypeError('error'));

			const promise = withRetry(fn, {
				maxAttempts: 4,
				initialDelay: 1000,
				jitter: 0, // Disable jitter for predictable tests
				onRetry: (_err, _attempt, delay) => delays.push(delay),
			});
			const handledPromise = promise.catch(() => {});

			await vi.runAllTimersAsync();
			await handledPromise;
			await expect(promise).rejects.toThrow();

			// Exponential: 1000, 2000, 4000
			expect(delays).toEqual([1000, 2000, 4000]);
		});

		it('should use linear backoff when specified', async () => {
			const delays: number[] = [];
			const fn = vi.fn().mockRejectedValue(new TypeError('error'));

			const promise = withRetry(fn, {
				maxAttempts: 4,
				backoff: 'linear',
				initialDelay: 1000,
				jitter: 0,
				onRetry: (_err, _attempt, delay) => delays.push(delay),
			});
			const handledPromise = promise.catch(() => {});

			await vi.runAllTimersAsync();
			await handledPromise;
			await expect(promise).rejects.toThrow();

			// Linear: 1000, 2000, 3000
			expect(delays).toEqual([1000, 2000, 3000]);
		});

		it('should use constant backoff when specified', async () => {
			const delays: number[] = [];
			const fn = vi.fn().mockRejectedValue(new TypeError('error'));

			const promise = withRetry(fn, {
				maxAttempts: 4,
				backoff: 'constant',
				initialDelay: 1000,
				jitter: 0,
				onRetry: (_err, _attempt, delay) => delays.push(delay),
			});
			const handledPromise = promise.catch(() => {});

			await vi.runAllTimersAsync();
			await handledPromise;
			await expect(promise).rejects.toThrow();

			// Constant: 1000, 1000, 1000
			expect(delays).toEqual([1000, 1000, 1000]);
		});

		it('should cap delay at maxDelay', async () => {
			const delays: number[] = [];
			const fn = vi.fn().mockRejectedValue(new TypeError('error'));

			const promise = withRetry(fn, {
				maxAttempts: 5,
				initialDelay: 1000,
				maxDelay: 3000,
				jitter: 0,
				onRetry: (_err, _attempt, delay) => delays.push(delay),
			});
			const handledPromise = promise.catch(() => {});

			await vi.runAllTimersAsync();
			await handledPromise;
			await expect(promise).rejects.toThrow();

			// Exponential with cap: 1000, 2000, 3000, 3000
			expect(delays).toEqual([1000, 2000, 3000, 3000]);
		});
	});

	describe('jitter', () => {
		it('should apply jitter when configured', async () => {
			const delays: number[] = [];
			const fn = vi.fn().mockRejectedValue(new TypeError('error'));

			// Run multiple times to ensure jitter is applied
			for (let i = 0; i < 5; i++) {
				delays.length = 0;
				fn.mockClear();

				const promise = withRetry(fn, {
					maxAttempts: 2,
					initialDelay: 1000,
					jitter: 0.5, // 50% jitter
					onRetry: (_err, _attempt, delay) => delays.push(delay),
				});
				const handledPromise = promise.catch(() => {});

				await vi.runAllTimersAsync();
				await handledPromise;
				await expect(promise).rejects.toThrow();

				// With 50% jitter, delay should be between 500 and 1500
				expect(delays[0]).toBeGreaterThanOrEqual(500);
				expect(delays[0]).toBeLessThanOrEqual(1500);
			}
		});
	});

	describe('edge cases', () => {
		it('should handle maxAttempts = 1 (no retries)', async () => {
			const fn = vi.fn().mockRejectedValue(new TypeError('error'));

			const promise = withRetry(fn, { maxAttempts: 1 });
			const handledPromise = promise.catch(() => {});
			await vi.runAllTimersAsync();
			await handledPromise;
			await expect(promise).rejects.toThrow('error');
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should update lastError in context', async () => {
			const contexts: RetryContext[] = [];
			const error1 = new TypeError('first error');
			const error2 = new TypeError('second error');

			const fn = vi
				.fn()
				.mockImplementationOnce((ctx) => {
					contexts.push({ ...ctx });
					throw error1;
				})
				.mockImplementationOnce((ctx) => {
					contexts.push({ ...ctx });
					throw error2;
				})
				.mockResolvedValue('success');

			const promise = withRetry(fn, { maxAttempts: 3, initialDelay: 100 });
			await vi.runAllTimersAsync();
			await promise;

			expect(contexts[0].lastError).toBeUndefined();
			expect(contexts[1].lastError).toBe(error1);
		});
	});
});

// ============================================================================
// parseRetryAfter TESTS
// ============================================================================

describe('parseRetryAfter', () => {
	it('should return null when header is not present', () => {
		const response = createMockResponse(429);
		expect(parseRetryAfter(response)).toBeNull();
	});

	it('should parse seconds value', () => {
		const response = createMockResponse(429, { 'Retry-After': '60' });
		expect(parseRetryAfter(response)).toBe(60000); // 60 seconds in ms
	});

	it('should parse single digit seconds', () => {
		const response = createMockResponse(429, { 'Retry-After': '5' });
		expect(parseRetryAfter(response)).toBe(5000);
	});

	it('should parse HTTP date format', () => {
		// Set a future date
		const futureDate = new Date(Date.now() + 30000);
		const dateString = futureDate.toUTCString();
		const response = createMockResponse(429, { 'Retry-After': dateString });

		const result = parseRetryAfter(response);
		expect(result).not.toBeNull();
		// Should be approximately 30 seconds (allowing for test execution time)
		expect(result!).toBeGreaterThan(25000);
		expect(result!).toBeLessThanOrEqual(30000);
	});

	it('should return 0 for past dates', () => {
		const pastDate = new Date(Date.now() - 60000);
		const dateString = pastDate.toUTCString();
		const response = createMockResponse(429, { 'Retry-After': dateString });

		const result = parseRetryAfter(response);
		expect(result).toBe(0);
	});

	it('should return null for invalid values', () => {
		const response = createMockResponse(429, { 'Retry-After': 'invalid' });
		expect(parseRetryAfter(response)).toBeNull();
	});
});

// ============================================================================
// createRateLimitAwareRetry TESTS
// ============================================================================

describe('createRateLimitAwareRetry', () => {
	it('should return a shouldRetry function', () => {
		const shouldRetry = createRateLimitAwareRetry();
		expect(typeof shouldRetry).toBe('function');
	});

	it('should return true for 429 responses within maxWait', () => {
		const shouldRetry = createRateLimitAwareRetry({ maxWait: 60000 });
		// Use real Response for instanceof check
		const response = createRealResponse(429, { 'Retry-After': '30' });
		expect(shouldRetry(response, 1)).toBe(true);
	});

	it('should return false for 429 responses exceeding maxWait', () => {
		const shouldRetry = createRateLimitAwareRetry({ maxWait: 10000 });
		// Use real Response for instanceof check
		const response = createRealResponse(429, { 'Retry-After': '60' });
		expect(shouldRetry(response, 1)).toBe(false);
	});

	it('should call onRateLimit callback with wait time', () => {
		const onRateLimit = vi.fn();
		const shouldRetry = createRateLimitAwareRetry({ onRateLimit });
		// Use real Response for instanceof check
		const response = createRealResponse(429, { 'Retry-After': '45' });

		shouldRetry(response, 1);
		expect(onRateLimit).toHaveBeenCalledWith(45000);
	});

	it('should not call onRateLimit when no Retry-After header', () => {
		const onRateLimit = vi.fn();
		const shouldRetry = createRateLimitAwareRetry({ onRateLimit });
		// Use real Response for instanceof check
		const response = createRealResponse(429);

		shouldRetry(response, 1);
		expect(onRateLimit).not.toHaveBeenCalled();
	});

	it('should fall back to default retry logic for non-429 errors', () => {
		const shouldRetry = createRateLimitAwareRetry();

		// 5xx should be retried (from default logic) - these use mock since they hit status property check
		expect(shouldRetry(createMockResponse(500), 1)).toBe(true);
		expect(shouldRetry(createMockResponse(503), 1)).toBe(true);

		// 4xx should not be retried
		expect(shouldRetry(createMockResponse(400), 1)).toBe(false);
		expect(shouldRetry(createMockResponse(404), 1)).toBe(false);

		// Network errors should be retried
		expect(shouldRetry(new TypeError('network error'), 1)).toBe(true);
	});
});

// ============================================================================
// fetchWithRetry TESTS (Integration-style)
// ============================================================================

describe('fetchWithRetry', () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		vi.useFakeTimers();
		originalFetch = global.fetch;
	});

	afterEach(() => {
		vi.useRealTimers();
		global.fetch = originalFetch;
	});

	it('should return successful response immediately', async () => {
		const mockResponse = createMockResponse(200);
		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const promise = fetchWithRetry('https://api.example.com/data');
		await vi.runAllTimersAsync();
		const response = await promise;

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('should retry on 5xx responses', async () => {
		const errorResponse = createMockResponse(503);
		const successResponse = createMockResponse(200);

		global.fetch = vi
			.fn()
			.mockResolvedValueOnce(errorResponse)
			.mockResolvedValueOnce(successResponse);

		const promise = fetchWithRetry('https://api.example.com/data', {}, { initialDelay: 100 });
		await vi.runAllTimersAsync();
		const response = await promise;

		expect(response.status).toBe(200);
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it('should pass request init to fetch', async () => {
		const mockResponse = createMockResponse(200);
		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const promise = fetchWithRetry(
			'https://api.example.com/data',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: 'value' }),
			},
			{}
		);
		await vi.runAllTimersAsync();
		await promise;

		expect(global.fetch).toHaveBeenCalledWith(
			'https://api.example.com/data',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: 'value' }),
			})
		);
	});

	it('should not retry on 4xx responses', async () => {
		const errorResponse = createMockResponse(400);
		global.fetch = vi.fn().mockResolvedValue(errorResponse);

		const promise = fetchWithRetry('https://api.example.com/data', {}, { maxAttempts: 3 });
		await vi.runAllTimersAsync();
		const response = await promise;

		// 4xx responses are returned (not thrown), so it should succeed
		expect(response.status).toBe(400);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it('should use custom shouldRetry when provided', async () => {
		const customShouldRetry = vi.fn().mockReturnValue(false);
		const errorResponse = createMockResponse(503);
		global.fetch = vi.fn().mockResolvedValue(errorResponse);

		const promise = fetchWithRetry(
			'https://api.example.com/data',
			{},
			{
				maxAttempts: 3,
				shouldRetry: customShouldRetry,
			}
		);
		const handledPromise = promise.catch(() => {});
		await vi.runAllTimersAsync();
		await handledPromise;

		// Should throw because the 503 response is thrown internally
		// and customShouldRetry returns false
		try {
			await promise;
		} catch {
			// Expected to throw
		}

		expect(customShouldRetry).toHaveBeenCalled();
	});
});

// ============================================================================
// DEFAULT OPTIONS TESTS
// ============================================================================

describe('default options', () => {
	it('should use maxAttempts = 3 by default', async () => {
		vi.useFakeTimers();
		const fn = vi.fn().mockRejectedValue(new TypeError('error'));

		const promise = withRetry(fn);
		const handledPromise = promise.catch(() => {});
		await vi.runAllTimersAsync();
		await handledPromise;
		await expect(promise).rejects.toThrow();

		expect(fn).toHaveBeenCalledTimes(3);
		vi.useRealTimers();
	});

	it('should use exponential backoff by default', async () => {
		vi.useFakeTimers();
		const delays: number[] = [];
		const fn = vi.fn().mockRejectedValue(new TypeError('error'));

		const promise = withRetry(fn, {
			jitter: 0,
			onRetry: (_err, _attempt, delay) => delays.push(delay),
		});
		const handledPromise = promise.catch(() => {});
		await vi.runAllTimersAsync();
		await handledPromise;
		await expect(promise).rejects.toThrow();

		// Default: exponential with 1000ms initial
		expect(delays[0]).toBe(1000);
		expect(delays[1]).toBe(2000);
		vi.useRealTimers();
	});

	it('should use initialDelay = 1000 by default', async () => {
		vi.useFakeTimers();
		let capturedDelay = 0;
		const fn = vi.fn().mockRejectedValue(new TypeError('error'));

		const promise = withRetry(fn, {
			maxAttempts: 2,
			jitter: 0,
			onRetry: (_err, _attempt, delay) => {
				capturedDelay = delay;
			},
		});
		const handledPromise = promise.catch(() => {});
		await vi.runAllTimersAsync();
		await handledPromise;
		await expect(promise).rejects.toThrow();

		expect(capturedDelay).toBe(1000);
		vi.useRealTimers();
	});
});
