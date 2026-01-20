/**
 * Base API Client
 *
 * Weniger, aber besser: One HTTP request implementation for all integrations.
 * Eliminates ~120-180 lines of duplicate code across integrations.
 *
 * Now extends SDK's AuthenticatedHTTPClient - eliminates duplicate AbortController logic.
 */

import {
	AuthenticatedHTTPClient,
	type AuthenticatedHTTPClientConfig,
	type TokenRefreshHandler,
	buildQueryString,
} from '@workwayco/sdk';

/**
 * Configuration for BaseAPIClient
 */
export interface BaseClientConfig {
	/** API URL */
	apiUrl: string;
	/** OAuth access token */
	accessToken: string;
	/** Request timeout in ms */
	timeout?: number;
	/** Error context for better error messages */
	errorContext?: { integration: string };
	/** OAuth token refresh configuration */
	tokenRefresh?: TokenRefreshHandler;
	/** Token expiration timestamp (Unix ms) for proactive refresh */
	tokenExpiresAt?: number;
}

export { TokenRefreshHandler };

/**
 * Base API client with standardized HTTP request handling
 *
 * Extends AuthenticatedHTTPClient from SDK, providing:
 * - Automatic AbortController timeout handling (no manual fetch)
 * - Automatic token refresh on 401
 * - Proactive token refresh before expiration
 * - Unified error handling via IntegrationError
 * - JSON-parsing helpers (getJson, postJson, etc.)
 *
 * Integration-specific behavior (like custom headers) is added via
 * wrapper methods that preserve the simple API.
 */
export class BaseAPIClient extends AuthenticatedHTTPClient {
	constructor(config: BaseClientConfig) {
		super({
			baseUrl: config.apiUrl,
			accessToken: config.accessToken,
			timeout: config.timeout,
			errorContext: config.errorContext,
			tokenRefresh: config.tokenRefresh,
			tokenExpiresAt: config.tokenExpiresAt,
		});
	}

	// =========================================================================
	// COMPATIBILITY GETTERS
	// =========================================================================

	// For backwards compatibility with integrations that access these directly

	/**
	 * Get the API URL (alias for baseUrl from parent)
	 */
	get apiUrl(): string {
		return this.baseUrl;
	}

	// =========================================================================
	// LOW-LEVEL REQUEST METHOD
	// =========================================================================

	// For advanced integrations that need direct access to request() with custom options

	/**
	 * Make a low-level HTTP request (old signature for backwards compatibility)
	 *
	 * This method provides the old request() signature that integrations expect.
	 * It converts RequestInit-style options to the new signature.
	 *
	 * @param path - API endpoint path
	 * @param options - RequestInit options (method, headers, body, etc.)
	 * @param additionalHeaders - Extra headers (e.g., API version headers)
	 * @deprecated Use get(), post(), patch(), etc. methods instead
	 */
	// @ts-expect-error - Intentionally overriding with different signature for backwards compatibility
	async request(
		path: string,
		options: RequestInit = {},
		additionalHeaders: Record<string, string> = {}
	): Promise<Response> {
		const method = (options.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

		// Extract body - it might be stringified JSON or already an object
		let body: unknown = undefined;
		if (options.body) {
			if (typeof options.body === 'string') {
				try {
					body = JSON.parse(options.body);
				} catch {
					// If it's not JSON, pass it through
					body = options.body;
				}
			} else {
				body = options.body;
			}
		}

		// Convert headers to a plain object
		const headersObj: Record<string, string> = {};
		if (options.headers) {
			const headers = new Headers(options.headers);
			headers.forEach((value, key) => {
				headersObj[key] = value;
			});
		}

		return super.request(method, path, {
			body,
			headers: {
				...headersObj,
				...additionalHeaders,
			},
		});
	}

	// =========================================================================
	// SIMPLIFIED WRAPPERS
	// =========================================================================

	// These methods provide the old API signature while delegating to the
	// SDK's AuthenticatedHTTPClient. Integrations can override these to add
	// service-specific headers (e.g., Notion-Version, Stripe-Version).

	/**
	 * GET request with optional additional headers
	 */
	get(path: string, additionalHeaders: Record<string, string> = {}): Promise<Response> {
		return super.get(path, { headers: additionalHeaders });
	}

	/**
	 * POST request with JSON body and optional additional headers
	 */
	post(path: string, body?: unknown, additionalHeaders: Record<string, string> = {}): Promise<Response> {
		return super.post(path, { body, headers: additionalHeaders });
	}

	/**
	 * PATCH request with JSON body and optional additional headers
	 */
	patch(path: string, body?: unknown, additionalHeaders: Record<string, string> = {}): Promise<Response> {
		return super.patch(path, { body, headers: additionalHeaders });
	}

	/**
	 * PUT request with JSON body and optional additional headers
	 */
	put(path: string, body?: unknown, additionalHeaders: Record<string, string> = {}): Promise<Response> {
		return super.put(path, { body, headers: additionalHeaders });
	}

	/**
	 * DELETE request with optional additional headers
	 */
	delete(path: string, additionalHeaders: Record<string, string> = {}): Promise<Response> {
		return super.delete(path, { headers: additionalHeaders });
	}

	// =========================================================================
	// JSON HELPERS (delegated to SDK)
	// =========================================================================

	// These preserve the old API signature while using the SDK's implementations.

	/**
	 * GET request with automatic JSON parsing
	 */
	async getJson<T = unknown>(path: string, additionalHeaders: Record<string, string> = {}): Promise<T> {
		return super.getJson<T>(path, { headers: additionalHeaders });
	}

	/**
	 * POST request with automatic JSON parsing
	 */
	async postJson<T = unknown>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.postJson<T>(path, { body, headers: additionalHeaders });
	}

	/**
	 * PATCH request with automatic JSON parsing
	 */
	async patchJson<T = unknown>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.patchJson<T>(path, { body, headers: additionalHeaders });
	}

	/**
	 * PUT request with automatic JSON parsing
	 */
	async putJson<T = unknown>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.putJson<T>(path, { body, headers: additionalHeaders });
	}

	/**
	 * DELETE request with automatic JSON parsing
	 */
	async deleteJson<T = unknown>(path: string, additionalHeaders: Record<string, string> = {}): Promise<T> {
		return super.deleteJson<T>(path, { headers: additionalHeaders });
	}

	/**
	 * Assert response is OK, throw if not
	 *
	 * Alias for SDK's assertResponseOk for backwards compatibility.
	 */
	async assertOk(response: Response): Promise<void> {
		return this.assertResponseOk(response);
	}
}

// Re-export SDK utilities for convenience
export { buildQueryString };
