/**
 * HTTP Module
 *
 * Simplified HTTP client for workflow development.
 * Wraps native fetch with retry logic, timeout handling, and error normalization.
 */

import { ErrorCode } from './integration-error.js';
import { sleep } from './utils.js';

// ============================================================================
// TYPES
// ============================================================================

export interface HttpOptions {
	headers?: Record<string, string>;
	query?: Record<string, string>;
	timeout?: number;
	retry?: {
		attempts?: number;
		backoff?: 'linear' | 'exponential';
		delay?: number;
	};
}

export interface HttpRequestOptions extends HttpOptions {
	body?: any;
}

export interface HttpResponse<T = any> {
	data: T;
	status: number;
	headers: Record<string, string>;
	ok: boolean;
}

/**
 * HTTP Error with standardized error code
 *
 * Includes both human-readable message and machine-parseable code
 * for consistent client-side error handling.
 */
export class HttpError extends Error {
	public readonly code: ErrorCode;

	constructor(
		message: string,
		public status: number,
		public response?: any,
		code?: ErrorCode
	) {
		super(message);
		this.name = 'HttpError';
		this.code = code ?? this.mapStatusToCode(status);
	}

	/**
	 * Map HTTP status to standardized ErrorCode
	 */
	private mapStatusToCode(status: number): ErrorCode {
		switch (status) {
			case 401:
				return ErrorCode.AUTH_EXPIRED;
			case 403:
				return ErrorCode.PERMISSION_DENIED;
			case 404:
				return ErrorCode.NOT_FOUND;
			case 409:
				return ErrorCode.CONFLICT;
			case 422:
				return ErrorCode.VALIDATION_ERROR;
			case 429:
				return ErrorCode.RATE_LIMITED;
			default:
				if (status >= 500) {
					return ErrorCode.PROVIDER_DOWN;
				}
				return ErrorCode.API_ERROR;
		}
	}

	/**
	 * Serialize error for API responses
	 *
	 * Returns standardized format: { error: string, code: string }
	 */
	toJSON(): {
		error: string;
		code: string;
		status: number;
		response?: any;
	} {
		return {
			error: this.message,
			code: this.code,
			status: this.status,
			response: this.response,
		};
	}

	/**
	 * Check if this is an authentication error (401)
	 */
	isUnauthorized(): boolean {
		return this.status === 401;
	}

	/**
	 * Check if this is a permission error (403)
	 */
	isForbidden(): boolean {
		return this.status === 403;
	}

	/**
	 * Check if this is a not found error (404)
	 */
	isNotFound(): boolean {
		return this.status === 404;
	}

	/**
	 * Check if this is a rate limit error (429)
	 */
	isRateLimited(): boolean {
		return this.status === 429;
	}

	/**
	 * Check if this is a server error (5xx)
	 */
	isServerError(): boolean {
		return this.status >= 500;
	}

	/**
	 * Check if this error is retryable
	 */
	isRetryable(): boolean {
		return (
			this.status === 429 ||
			this.status === 503 ||
			this.status >= 500
		);
	}
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

/**
 * HTTP client with retry and timeout support
 */
export const http = {
	/**
	 * GET request
	 */
	async get<T = any>(url: string, options: HttpOptions = {}): Promise<HttpResponse<T>> {
		return request<T>('GET', url, options);
	},

	/**
	 * POST request
	 */
	async post<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
		return request<T>('POST', url, options);
	},

	/**
	 * PUT request
	 */
	async put<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
		return request<T>('PUT', url, options);
	},

	/**
	 * PATCH request
	 */
	async patch<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
		return request<T>('PATCH', url, options);
	},

	/**
	 * DELETE request
	 */
	async delete<T = any>(url: string, options: HttpOptions = {}): Promise<HttpResponse<T>> {
		return request<T>('DELETE', url, options);
	},
};

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function request<T>(
	method: string,
	url: string,
	options: HttpRequestOptions
): Promise<HttpResponse<T>> {
	const {
		headers = {},
		query,
		body,
		timeout = 30000,
		retry = {},
	} = options;

	const { attempts = 1, backoff = 'exponential', delay = 1000 } = retry;

	// Build URL with query params
	let finalUrl = url;
	if (query && Object.keys(query).length > 0) {
		const params = new URLSearchParams(query);
		finalUrl = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
	}

	// Build request options
	const fetchOptions: RequestInit = {
		method,
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
	};

	if (body && method !== 'GET') {
		fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
	}

	// Execute with retry
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			const response = await fetch(finalUrl, {
				...fetchOptions,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			// Parse response
			const responseHeaders: Record<string, string> = {};
			response.headers.forEach((value, key) => {
				responseHeaders[key] = value;
			});

			let data: T;
			const contentType = response.headers.get('content-type') || '';

			if (contentType.includes('application/json')) {
				data = await response.json();
			} else {
				data = (await response.text()) as T;
			}

			if (!response.ok) {
				throw new HttpError(
					`HTTP ${response.status}: ${response.statusText}`,
					response.status,
					data
				);
			}

			return {
				data,
				status: response.status,
				headers: responseHeaders,
				ok: true,
			};
		} catch (error: any) {
			lastError = error;

			// Don't retry on client errors (4xx)
			if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
				throw error;
			}

			// Wait before retry (except on last attempt)
			if (attempt < attempts) {
				const waitTime = backoff === 'exponential'
					? delay * Math.pow(2, attempt - 1)
					: delay * attempt;
				await sleep(waitTime);
			}
		}
	}

	throw lastError || new Error('Request failed');
}

// sleep is now imported from ./utils.js

export default http;
