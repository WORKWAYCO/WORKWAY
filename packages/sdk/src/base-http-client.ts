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
 * BaseHTTPClient - Unified HTTP Foundation
 *
 * Weniger, aber besser: One HTTP implementation for all packages.
 * Eliminates ~200 lines of duplicate HTTP handling across CLI, SDK, and integrations.
 *
 * Features:
 * - Timeout handling via AbortController
 * - Automatic JSON parsing with type safety
 * - Unified error handling (IntegrationError)
 * - Bearer token authentication
 * - Integration-specific headers support
 *
 * Usage:
 * - Integrations: Extend BaseAPIClient (which uses this)
 * - SDK: Use directly or via http module
 * - CLI: Use as base for WorkwayAPIClient
 */

import {
	IntegrationError,
	ErrorCode,
	createErrorFromResponse,
	type ErrorContext,
} from './integration-error';

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for BaseHTTPClient
 */
export interface HTTPClientConfig {
	/** Base API URL */
	baseUrl: string;

	/** Request timeout in ms (default: 30000) */
	timeout?: number;

	/** Default headers to include in all requests */
	defaultHeaders?: Record<string, string>;

	/** Context for error reporting */
	errorContext?: Partial<ErrorContext>;
}

/**
 * Configuration for authenticated clients
 */
export interface AuthenticatedHTTPClientConfig extends HTTPClientConfig {
	/** Bearer token for authentication */
	accessToken: string;
}

/**
 * Request options for HTTP methods
 */
export interface RequestOptions {
	/** Additional headers for this request */
	headers?: Record<string, string>;

	/** Query parameters */
	query?: Record<string, string | number | boolean | undefined | null>;

	/** Override timeout for this request */
	timeout?: number;

	/** Signal for request cancellation */
	signal?: AbortSignal;
}

/**
 * Request options with body
 */
export interface RequestWithBodyOptions extends RequestOptions {
	/** Request body (will be JSON serialized) */
	body?: unknown;
}

// ============================================================================
// BASE HTTP CLIENT
// ============================================================================

/**
 * Base HTTP client providing core request functionality
 *
 * This is the foundation class. For authenticated clients, use
 * AuthenticatedHTTPClient or extend BaseAPIClient.
 */
export class BaseHTTPClient {
	protected readonly baseUrl: string;
	protected readonly timeout: number;
	protected readonly defaultHeaders: Record<string, string>;
	protected readonly errorContext: Partial<ErrorContext>;

	constructor(config: HTTPClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
		this.timeout = config.timeout ?? 30000;
		this.defaultHeaders = {
			'Content-Type': 'application/json',
			...config.defaultHeaders,
		};
		this.errorContext = config.errorContext ?? {};
	}

	/**
	 * Make an HTTP request
	 */
	protected async request(
		method: string,
		path: string,
		options: RequestWithBodyOptions = {}
	): Promise<Response> {
		const url = this.buildUrl(path, options.query);
		const headers = new Headers(this.defaultHeaders);

		// Add request-specific headers
		if (options.headers) {
			for (const [key, value] of Object.entries(options.headers)) {
				headers.set(key, value);
			}
		}

		// Setup timeout
		const timeoutMs = options.timeout ?? this.timeout;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		// Combine signals if provided
		const signal = options.signal
			? this.combineSignals(options.signal, controller.signal)
			: controller.signal;

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
				signal,
			});

			return response;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new IntegrationError(ErrorCode.TIMEOUT, `Request timed out after ${timeoutMs}ms`, {
					...this.errorContext,
					retryable: true,
				});
			}
			throw new IntegrationError(ErrorCode.NETWORK_ERROR, `Network request failed: ${error}`, {
				...this.errorContext,
				retryable: true,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Build URL with query parameters
	 */
	protected buildUrl(
		path: string,
		query?: Record<string, string | number | boolean | undefined | null>
	): string {
		const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

		if (!query) return url;

		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined && value !== null && value !== '') {
				params.set(key, String(value));
			}
		}

		const queryString = params.toString();
		return queryString ? `${url}?${queryString}` : url;
	}

	/**
	 * Combine multiple abort signals
	 */
	private combineSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
		const controller = new AbortController();

		const abort = () => controller.abort();
		signal1.addEventListener('abort', abort);
		signal2.addEventListener('abort', abort);

		return controller.signal;
	}

	// =========================================================================
	// CONVENIENCE METHODS
	// =========================================================================

	/**
	 * GET request returning Response
	 */
	get(path: string, options: RequestOptions = {}): Promise<Response> {
		return this.request('GET', path, options);
	}

	/**
	 * POST request returning Response
	 */
	post(path: string, options: RequestWithBodyOptions = {}): Promise<Response> {
		return this.request('POST', path, options);
	}

	/**
	 * PATCH request returning Response
	 */
	patch(path: string, options: RequestWithBodyOptions = {}): Promise<Response> {
		return this.request('PATCH', path, options);
	}

	/**
	 * PUT request returning Response
	 */
	put(path: string, options: RequestWithBodyOptions = {}): Promise<Response> {
		return this.request('PUT', path, options);
	}

	/**
	 * DELETE request returning Response
	 */
	delete(path: string, options: RequestOptions = {}): Promise<Response> {
		return this.request('DELETE', path, options);
	}

	// =========================================================================
	// JSON HELPERS (Weniger, aber besser)
	// =========================================================================
	// These helpers combine request + response parsing + error handling
	// into single calls, eliminating ~100 lines of duplicate code.

	/**
	 * GET request with automatic JSON parsing
	 *
	 * @example
	 * ```typescript
	 * const users = await client.getJson<User[]>('/users');
	 * const user = await client.getJson<User>('/users/123');
	 * ```
	 */
	async getJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
		const response = await this.get(path, options);
		return this.parseJsonResponse<T>(response);
	}

	/**
	 * POST request with automatic JSON parsing
	 *
	 * @example
	 * ```typescript
	 * const user = await client.postJson<User>('/users', {
	 *   body: { name: 'John', email: 'john@example.com' }
	 * });
	 * ```
	 */
	async postJson<T>(path: string, options: RequestWithBodyOptions = {}): Promise<T> {
		const response = await this.post(path, options);
		return this.parseJsonResponse<T>(response);
	}

	/**
	 * PATCH request with automatic JSON parsing
	 */
	async patchJson<T>(path: string, options: RequestWithBodyOptions = {}): Promise<T> {
		const response = await this.patch(path, options);
		return this.parseJsonResponse<T>(response);
	}

	/**
	 * PUT request with automatic JSON parsing
	 */
	async putJson<T>(path: string, options: RequestWithBodyOptions = {}): Promise<T> {
		const response = await this.put(path, options);
		return this.parseJsonResponse<T>(response);
	}

	/**
	 * DELETE request with automatic JSON parsing (if response has body)
	 */
	async deleteJson<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
		const response = await this.delete(path, options);

		// Handle empty responses (204 No Content)
		if (response.status === 204) {
			return undefined as T;
		}

		return this.parseJsonResponse<T>(response);
	}

	/**
	 * Parse JSON response with error handling
	 *
	 * Throws IntegrationError if response is not OK or parsing fails.
	 */
	protected async parseJsonResponse<T>(response: Response): Promise<T> {
		if (!response.ok) {
			throw await createErrorFromResponse(response, this.errorContext);
		}

		try {
			return (await response.json()) as T;
		} catch {
			throw new IntegrationError(
				ErrorCode.API_ERROR,
				'Failed to parse JSON response',
				this.errorContext
			);
		}
	}

	/**
	 * Assert response is OK, throw if not
	 *
	 * Use this when you need the raw response but want error handling.
	 */
	protected async assertResponseOk(response: Response): Promise<void> {
		if (!response.ok) {
			throw await createErrorFromResponse(response, this.errorContext);
		}
	}
}

// ============================================================================
// AUTHENTICATED HTTP CLIENT
// ============================================================================

/**
 * HTTP client with Bearer token authentication
 *
 * Extends BaseHTTPClient with automatic Authorization header injection.
 */
export class AuthenticatedHTTPClient extends BaseHTTPClient {
	protected readonly accessToken: string;

	constructor(config: AuthenticatedHTTPClientConfig) {
		super({
			...config,
			defaultHeaders: {
				...config.defaultHeaders,
				Authorization: `Bearer ${config.accessToken}`,
			},
		});
		this.accessToken = config.accessToken;
	}

	/**
	 * Update the access token (for token refresh)
	 */
	setAccessToken(token: string): AuthenticatedHTTPClient {
		return new AuthenticatedHTTPClient({
			baseUrl: this.baseUrl,
			timeout: this.timeout,
			defaultHeaders: { ...this.defaultHeaders },
			accessToken: token,
			errorContext: this.errorContext,
		});
	}
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a BaseHTTPClient instance
 */
export function createHTTPClient(config: HTTPClientConfig): BaseHTTPClient {
	return new BaseHTTPClient(config);
}

/**
 * Create an AuthenticatedHTTPClient instance
 */
export function createAuthenticatedHTTPClient(
	config: AuthenticatedHTTPClientConfig
): AuthenticatedHTTPClient {
	return new AuthenticatedHTTPClient(config);
}

// ============================================================================
// QUERY STRING UTILITY
// ============================================================================

/**
 * Build a query string from an object, filtering out undefined/null values
 *
 * @example
 * ```typescript
 * buildQueryString({ page: 1, limit: 10, filter: undefined })
 * // Returns: "?page=1&limit=10"
 * ```
 */
export function buildQueryString(
	params: Record<string, string | number | boolean | undefined | null>
): string {
	const search = new URLSearchParams();

	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== '') {
			search.set(key, String(value));
		}
	}

	const str = search.toString();
	return str ? `?${str}` : '';
}
