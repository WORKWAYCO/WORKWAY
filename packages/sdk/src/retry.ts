/**
 * Retry Module
 *
 * Shared retry utility with exponential backoff for integrations.
 * Addresses Canon Audit critical violation: "No retry logic"
 *
 * @example
 * ```typescript
 * // Wrap any async function with retry
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3, backoff: 'exponential' }
 * );
 *
 * // Or use the helper for fetch specifically
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' }),
 * }, { maxAttempts: 3 });
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RetryOptions {
	/**
	 * Maximum number of retry attempts (including the initial attempt)
	 * @default 3
	 */
	maxAttempts?: number;

	/**
	 * Backoff strategy
	 * - 'exponential': delay * 2^attempt (recommended)
	 * - 'linear': delay * attempt
	 * - 'constant': same delay each time
	 * @default 'exponential'
	 */
	backoff?: 'exponential' | 'linear' | 'constant';

	/**
	 * Initial delay in milliseconds between retries
	 * @default 1000
	 */
	initialDelay?: number;

	/**
	 * Maximum delay in milliseconds (caps exponential growth)
	 * @default 30000
	 */
	maxDelay?: number;

	/**
	 * Jitter factor (0-1) to randomize delay
	 * Helps prevent thundering herd problem
	 * @default 0.1
	 */
	jitter?: number;

	/**
	 * Custom function to determine if error should trigger retry
	 * By default, retries on network errors and 5xx responses
	 */
	shouldRetry?: (error: unknown, attempt: number) => boolean;

	/**
	 * Optional callback for retry events (for logging/monitoring)
	 */
	onRetry?: (error: unknown, attempt: number, delay: number) => void;

	/**
	 * Request timeout in milliseconds
	 * @default 30000
	 */
	timeout?: number;
}

export interface RetryContext {
	attempt: number;
	maxAttempts: number;
	lastError: unknown;
	totalElapsedMs: number;
}

// ============================================================================
// DEFAULT RETRY POLICY
// ============================================================================

/**
 * Default function to determine if an error should be retried
 */
export function defaultShouldRetry(error: unknown, _attempt: number): boolean {
	// Network errors - always retry
	if (error instanceof TypeError) {
		// fetch throws TypeError for network errors
		return true;
	}

	// AbortError from timeout - retry
	if (error instanceof DOMException && error.name === 'AbortError') {
		return true;
	}

	// HTTP responses - only retry 5xx errors
	if (error instanceof Response) {
		const status = error.status;
		// Retry on server errors (5xx) but not client errors (4xx)
		// Exception: 429 Too Many Requests should be retried
		return status >= 500 || status === 429;
	}

	// Custom HttpError type
	if (error && typeof error === 'object' && 'status' in error) {
		const status = (error as { status: number }).status;
		return status >= 500 || status === 429;
	}

	// Unknown errors - don't retry by default
	return false;
}

/**
 * Check if a Response should be retried (for use with fetch)
 */
export function shouldRetryResponse(response: Response): boolean {
	const status = response.status;
	// Retry on server errors (5xx) and rate limits (429)
	return status >= 500 || status === 429;
}

// ============================================================================
// RETRY IMPLEMENTATION
// ============================================================================

/**
 * Calculate delay for next retry attempt
 */
function calculateDelay(
	attempt: number,
	options: Required<Pick<RetryOptions, 'backoff' | 'initialDelay' | 'maxDelay' | 'jitter'>>
): number {
	const { backoff, initialDelay, maxDelay, jitter } = options;

	let delay: number;

	switch (backoff) {
		case 'exponential':
			// 2^attempt * initialDelay (e.g., 1s, 2s, 4s, 8s...)
			delay = initialDelay * Math.pow(2, attempt - 1);
			break;
		case 'linear':
			// attempt * initialDelay (e.g., 1s, 2s, 3s, 4s...)
			delay = initialDelay * attempt;
			break;
		case 'constant':
			delay = initialDelay;
			break;
		default:
			delay = initialDelay;
	}

	// Apply max delay cap
	delay = Math.min(delay, maxDelay);

	// Apply jitter (randomize by up to jitter %)
	if (jitter > 0) {
		const jitterAmount = delay * jitter;
		delay = delay + (Math.random() * 2 - 1) * jitterAmount;
	}

	return Math.max(0, Math.round(delay));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap any async function with retry logic
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => {
 *     const response = await fetch('https://api.example.com/data');
 *     if (!response.ok) throw response;
 *     return response.json();
 *   },
 *   { maxAttempts: 3, backoff: 'exponential' }
 * );
 * ```
 */
export async function withRetry<T>(
	fn: (context: RetryContext) => Promise<T>,
	options: RetryOptions = {}
): Promise<T> {
	const {
		maxAttempts = 3,
		backoff = 'exponential',
		initialDelay = 1000,
		maxDelay = 30000,
		jitter = 0.1,
		shouldRetry = defaultShouldRetry,
		onRetry,
	} = options;

	const startTime = Date.now();
	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const context: RetryContext = {
			attempt,
			maxAttempts,
			lastError,
			totalElapsedMs: Date.now() - startTime,
		};

		try {
			return await fn(context);
		} catch (error) {
			lastError = error;

			// Check if we should retry
			const isLastAttempt = attempt >= maxAttempts;
			const canRetry = shouldRetry(error, attempt);

			if (isLastAttempt || !canRetry) {
				throw error;
			}

			// Calculate delay and wait
			const delay = calculateDelay(attempt, { backoff, initialDelay, maxDelay, jitter });

			// Notify about retry (for logging/monitoring)
			if (onRetry) {
				onRetry(error, attempt, delay);
			}

			await sleep(delay);
		}
	}

	// This should never be reached, but TypeScript needs it
	throw lastError;
}

// ============================================================================
// FETCH WITH RETRY
// ============================================================================

/**
 * Fetch with automatic retry and timeout handling
 *
 * This is the recommended way to make HTTP requests in integrations.
 *
 * @example
 * ```typescript
 * const response = await fetchWithRetry('https://api.slack.com/api/chat.postMessage', {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({ channel, text }),
 * }, {
 *   maxAttempts: 3,
 *   timeout: 10000,
 * });
 *
 * if (!response.ok) {
 *   // Handle error
 * }
 * const data = await response.json();
 * ```
 */
export async function fetchWithRetry(
	url: string,
	init: RequestInit = {},
	options: RetryOptions = {}
): Promise<Response> {
	const { timeout = 30000, ...retryOptions } = options;

	return withRetry(
		async () => {
			// Create AbortController for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			try {
				const response = await fetch(url, {
					...init,
					signal: controller.signal,
				});

				// If response indicates an error that should be retried, throw it
				if (shouldRetryResponse(response)) {
					throw response;
				}

				return response;
			} finally {
				clearTimeout(timeoutId);
			}
		},
		{
			...retryOptions,
			shouldRetry: (error, attempt) => {
				// Use custom shouldRetry if provided
				if (retryOptions.shouldRetry) {
					return retryOptions.shouldRetry(error, attempt);
				}
				return defaultShouldRetry(error, attempt);
			},
		}
	);
}

// ============================================================================
// RATE LIMIT HELPERS
// ============================================================================

/**
 * Parse Retry-After header from response
 * Returns delay in milliseconds, or null if not present
 */
export function parseRetryAfter(response: Response): number | null {
	const retryAfter = response.headers.get('Retry-After');
	if (!retryAfter) {
		return null;
	}

	// Try parsing as seconds (most common)
	const seconds = parseInt(retryAfter, 10);
	if (!isNaN(seconds)) {
		return seconds * 1000;
	}

	// Try parsing as HTTP date
	const date = Date.parse(retryAfter);
	if (!isNaN(date)) {
		return Math.max(0, date - Date.now());
	}

	return null;
}

/**
 * Create a shouldRetry function that respects Retry-After header
 */
export function createRateLimitAwareRetry(
	options: { maxWait?: number; onRateLimit?: (waitMs: number) => void } = {}
): (error: unknown, attempt: number) => boolean {
	const { maxWait = 60000, onRateLimit } = options;

	return (error: unknown, attempt: number) => {
		// Check if it's a 429 response
		if (error instanceof Response && error.status === 429) {
			const retryAfter = parseRetryAfter(error);

			// If Retry-After is too long, don't retry
			if (retryAfter && retryAfter > maxWait) {
				return false;
			}

			// Notify about rate limit
			if (onRateLimit && retryAfter) {
				onRateLimit(retryAfter);
			}

			return true;
		}

		// Fall back to default retry logic
		return defaultShouldRetry(error, attempt);
	};
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
	withRetry,
	fetchWithRetry,
	defaultShouldRetry,
	shouldRetryResponse,
	parseRetryAfter,
	createRateLimitAwareRetry,
};
