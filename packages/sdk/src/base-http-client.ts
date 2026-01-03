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
 * Configuration for request tracing
 *
 * Enables correlation ID propagation for distributed tracing.
 * Each request gets a unique ID that flows through the system.
 */
export interface TracingConfig {
	/**
	 * Whether tracing is enabled (default: true)
	 */
	enabled?: boolean;

	/**
	 * Header name for correlation ID (default: 'X-Correlation-ID')
	 *
	 * Common alternatives:
	 * - 'X-Request-ID'
	 * - 'X-Trace-ID'
	 * - 'traceparent' (W3C Trace Context)
	 */
	headerName?: string;

	/**
	 * Custom correlation ID generator
	 *
	 * Default: crypto.randomUUID() (RFC 4122 v4)
	 *
	 * @example
	 * ```typescript
	 * generateId: () => `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
	 * ```
	 */
	generateId?: () => string;

	/**
	 * Whether to propagate correlation IDs from incoming requests
	 *
	 * If true, the client will use a correlation ID passed via
	 * `options.headers[headerName]` instead of generating a new one.
	 * This maintains trace continuity across service boundaries.
	 *
	 * Default: true
	 */
	propagate?: boolean;
}

/**
 * Token refresh handler for OAuth token refresh
 */
export interface TokenRefreshHandler {
	/** Refresh token for OAuth token refresh */
	refreshToken: string;
	/** OAuth token endpoint URL */
	tokenEndpoint: string;
	/** Client ID for OAuth token refresh */
	clientId: string;
	/** Client secret for OAuth token refresh */
	clientSecret: string;
	/**
	 * Callback to update the access token after refresh
	 * @param newAccessToken - The new access token
	 * @param newRefreshToken - The new refresh token (if rotated)
	 * @param expiresIn - Token lifetime in seconds (if provided by OAuth server)
	 */
	onTokenRefreshed: (
		newAccessToken: string,
		newRefreshToken?: string,
		expiresIn?: number
	) => void | Promise<void>;
}

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

	/**
	 * Request tracing configuration
	 *
	 * When enabled, adds correlation IDs to all requests for distributed tracing.
	 * IDs are included in error context for debugging.
	 *
	 * @default { enabled: true, headerName: 'X-Correlation-ID' }
	 */
	tracing?: TracingConfig;
}

/**
 * Configuration for authenticated clients
 */
export interface AuthenticatedHTTPClientConfig extends HTTPClientConfig {
	/** Bearer token for authentication */
	accessToken: string;

	/** Optional: Token expiration timestamp (Unix ms) for proactive refresh */
	tokenExpiresAt?: number;

	/** Optional: How many ms before expiration to proactively refresh (default: 5 minutes) */
	proactiveRefreshThreshold?: number;

	/** Optional: OAuth token refresh configuration */
	tokenRefresh?: TokenRefreshHandler;
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

	/**
	 * Correlation ID for request tracing
	 *
	 * If provided, this ID is used instead of generating a new one.
	 * Use this to propagate correlation IDs from incoming requests.
	 *
	 * @example
	 * ```typescript
	 * // In a Cloudflare Worker
	 * const incomingId = request.headers.get('X-Correlation-ID');
	 * const data = await client.getJson('/users', {
	 *   correlationId: incomingId || undefined
	 * });
	 * ```
	 */
	correlationId?: string;
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

/** Default correlation ID header name */
const DEFAULT_CORRELATION_HEADER = 'X-Correlation-ID';

/**
 * Generate a correlation ID using crypto.randomUUID()
 *
 * This is available in Cloudflare Workers and modern browsers.
 * Falls back to a simple random string if not available.
 */
function generateCorrelationId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for environments without crypto.randomUUID
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

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
	protected readonly tracing: {
		enabled: boolean;
		headerName: string;
		generateId: () => string;
		propagate: boolean;
	};

	/** The correlation ID from the last request (for debugging) */
	protected lastCorrelationId?: string;

	constructor(config: HTTPClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
		this.timeout = config.timeout ?? 30000;
		this.defaultHeaders = {
			'Content-Type': 'application/json',
			...config.defaultHeaders,
		};
		this.errorContext = config.errorContext ?? {};

		// Initialize tracing with defaults
		this.tracing = {
			enabled: config.tracing?.enabled ?? true,
			headerName: config.tracing?.headerName ?? DEFAULT_CORRELATION_HEADER,
			generateId: config.tracing?.generateId ?? generateCorrelationId,
			propagate: config.tracing?.propagate ?? true,
		};
	}

	/**
	 * Get the correlation ID from the last request
	 *
	 * Useful for logging and debugging.
	 */
	getLastCorrelationId(): string | undefined {
		return this.lastCorrelationId;
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

		// Generate or propagate correlation ID
		let correlationId: string | undefined;
		if (this.tracing.enabled) {
			// Check for propagated ID first (from options or headers)
			if (this.tracing.propagate && options.correlationId) {
				correlationId = options.correlationId;
			} else if (this.tracing.propagate && options.headers?.[this.tracing.headerName]) {
				correlationId = options.headers[this.tracing.headerName];
			} else {
				correlationId = this.tracing.generateId();
			}

			// Store for debugging
			this.lastCorrelationId = correlationId;

			// Add to request headers
			headers.set(this.tracing.headerName, correlationId);
		}

		// Add request-specific headers
		if (options.headers) {
			for (const [key, value] of Object.entries(options.headers)) {
				headers.set(key, value);
			}
		}

		// Build error context with correlation ID
		const errorContextWithTrace: Partial<ErrorContext> = {
			...this.errorContext,
			...(correlationId && { correlationId }),
		};

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
					...errorContextWithTrace,
					retryable: true,
				});
			}
			throw new IntegrationError(ErrorCode.NETWORK_ERROR, `Network request failed: ${error}`, {
				...errorContextWithTrace,
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
	 * Get error context with correlation ID
	 */
	protected getErrorContext(): Partial<ErrorContext> {
		return {
			...this.errorContext,
			...(this.lastCorrelationId && { correlationId: this.lastCorrelationId }),
		};
	}

	/**
	 * Parse JSON response with error handling
	 *
	 * Throws IntegrationError if response is not OK or parsing fails.
	 */
	protected async parseJsonResponse<T>(response: Response): Promise<T> {
		if (!response.ok) {
			throw await createErrorFromResponse(response, this.getErrorContext());
		}

		try {
			return (await response.json()) as T;
		} catch {
			throw new IntegrationError(
				ErrorCode.API_ERROR,
				'Failed to parse JSON response',
				this.getErrorContext()
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
			throw await createErrorFromResponse(response, this.getErrorContext());
		}
	}
}

// ============================================================================
// AUTHENTICATED HTTP CLIENT
// ============================================================================

/** Default proactive refresh threshold: 5 minutes before expiration */
const DEFAULT_PROACTIVE_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in ms

/**
 * HTTP client with Bearer token authentication
 *
 * Extends BaseHTTPClient with automatic Authorization header injection
 * and optional automatic token refresh on 401 responses.
 *
 * Supports proactive token refresh: if tokenExpiresAt is provided and
 * the token is about to expire (within proactiveRefreshThreshold),
 * the token will be refreshed BEFORE making the request, avoiding
 * failed requests and reducing latency.
 */
export class AuthenticatedHTTPClient extends BaseHTTPClient {
	protected accessToken: string;
	protected tokenExpiresAt?: number;
	protected readonly proactiveRefreshThreshold: number;
	protected readonly tokenRefresh?: TokenRefreshHandler;
	private isRefreshing = false;
	private refreshPromise: Promise<void> | null = null;

	constructor(config: AuthenticatedHTTPClientConfig) {
		super({
			...config,
			defaultHeaders: {
				...config.defaultHeaders,
				Authorization: `Bearer ${config.accessToken}`,
			},
		});
		this.accessToken = config.accessToken;
		this.tokenExpiresAt = config.tokenExpiresAt;
		this.proactiveRefreshThreshold = config.proactiveRefreshThreshold ?? DEFAULT_PROACTIVE_REFRESH_THRESHOLD;
		this.tokenRefresh = config.tokenRefresh;
	}

	/**
	 * Check if the token is expiring soon (within proactive refresh threshold)
	 */
	isTokenExpiringSoon(): boolean {
		if (!this.tokenExpiresAt) return false;
		return Date.now() >= this.tokenExpiresAt - this.proactiveRefreshThreshold;
	}

	/**
	 * Check if the token has already expired
	 */
	isTokenExpired(): boolean {
		if (!this.tokenExpiresAt) return false;
		return Date.now() >= this.tokenExpiresAt;
	}

	/**
	 * Get time until token expires in milliseconds (negative if expired)
	 */
	getTimeUntilExpiry(): number | null {
		if (!this.tokenExpiresAt) return null;
		return this.tokenExpiresAt - Date.now();
	}

	/**
	 * Make an HTTP request with proactive and reactive token refresh
	 *
	 * Proactive: If token is expiring soon, refresh BEFORE making request
	 * Reactive: If 401 received, refresh and retry (fallback)
	 */
	protected override async request(
		method: string,
		path: string,
		options: RequestWithBodyOptions = {},
		isRetry = false
	): Promise<Response> {
		// Proactive refresh: if token is expiring soon, refresh before request
		if (!isRetry && this.tokenRefresh && this.isTokenExpiringSoon()) {
			await this.ensureTokenRefreshed();
		}

		const response = await super.request(method, path, options);

		// Reactive refresh: handle 401 Unauthorized as fallback
		if (response.status === 401 && !isRetry && this.tokenRefresh) {
			await this.ensureTokenRefreshed();
			// Retry the request once with the new token
			return this.request(method, path, options, true);
		}

		return response;
	}

	/**
	 * Ensure token is refreshed, with deduplication for concurrent requests
	 *
	 * If multiple requests trigger refresh simultaneously, only one refresh
	 * occurs and all requests wait for the same refresh to complete.
	 */
	private async ensureTokenRefreshed(): Promise<void> {
		// If already refreshing, wait for the existing refresh to complete
		if (this.isRefreshing && this.refreshPromise) {
			await this.refreshPromise;
			return;
		}

		// Start refresh
		this.isRefreshing = true;
		this.refreshPromise = this.refreshAccessToken();

		try {
			await this.refreshPromise;
		} finally {
			this.isRefreshing = false;
			this.refreshPromise = null;
		}
	}

	/**
	 * Refresh the OAuth access token
	 *
	 * Uses the OAuth refresh token to get a new access token.
	 * Updates the internal accessToken and calls the onTokenRefreshed callback.
	 */
	private async refreshAccessToken(): Promise<void> {
		if (!this.tokenRefresh) {
			throw new IntegrationError(
				ErrorCode.AUTH_EXPIRED,
				'Token expired and no refresh configuration provided',
				this.errorContext
			);
		}

		const { refreshToken, tokenEndpoint, clientId, clientSecret, onTokenRefreshed } = this.tokenRefresh;

		try {
			const response = await fetch(tokenEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					grant_type: 'refresh_token',
					refresh_token: refreshToken,
					client_id: clientId,
					client_secret: clientSecret,
				}),
			});

			if (!response.ok) {
				throw new IntegrationError(
					ErrorCode.AUTH_EXPIRED,
					`Token refresh failed: ${response.status} ${response.statusText}`,
					{
						...this.errorContext,
						retryable: false,
					}
				);
			}

			const data = await response.json() as {
				access_token: string;
				refresh_token?: string;
				expires_in?: number;
			};

			if (!data.access_token) {
				throw new IntegrationError(
					ErrorCode.AUTH_EXPIRED,
					'Token refresh response missing access_token',
					this.errorContext
				);
			}

			// Update internal access token and default headers
			this.accessToken = data.access_token;
			this.defaultHeaders['Authorization'] = `Bearer ${data.access_token}`;

			// Update token expiration if expires_in is provided
			if (data.expires_in) {
				this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
			}

			// Call the callback to persist the new token
			await onTokenRefreshed(data.access_token, data.refresh_token, data.expires_in);
		} catch (error) {
			if (error instanceof IntegrationError) {
				throw error;
			}
			throw new IntegrationError(
				ErrorCode.AUTH_EXPIRED,
				`Token refresh failed: ${error}`,
				{
					...this.errorContext,
					retryable: false,
				}
			);
		}
	}

	/**
	 * Update the access token (for token refresh)
	 * @param token - New access token
	 * @param expiresAt - Optional expiration timestamp (Unix ms)
	 */
	setAccessToken(token: string, expiresAt?: number): AuthenticatedHTTPClient {
		return new AuthenticatedHTTPClient({
			baseUrl: this.baseUrl,
			timeout: this.timeout,
			defaultHeaders: { ...this.defaultHeaders },
			accessToken: token,
			tokenExpiresAt: expiresAt ?? this.tokenExpiresAt,
			proactiveRefreshThreshold: this.proactiveRefreshThreshold,
			errorContext: this.errorContext,
			tokenRefresh: this.tokenRefresh,
		});
	}

	/**
	 * Get the current token expiration timestamp
	 */
	getTokenExpiresAt(): number | undefined {
		return this.tokenExpiresAt;
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
