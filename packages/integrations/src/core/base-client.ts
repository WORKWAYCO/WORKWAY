/**
 * Base API Client
 *
 * Weniger, aber besser: One HTTP request implementation for all integrations.
 * Eliminates ~120-180 lines of duplicate code across 6 integrations.
 *
 * Now extends SDK's AuthenticatedHTTPClient - eliminates duplicate AbortController logic.
 */

import {
	AuthenticatedHTTPClient,
	type TokenRefreshHandler,
	type ErrorContext,
} from '@workwayco/sdk';

export interface BaseClientConfig {
	/** OAuth access token */
	accessToken: string;
	/** Base API URL */
	apiUrl: string;
	/** Request timeout in ms (default: 30000) */
	timeout?: number;
	/** Error context for better error messages */
	errorContext?: Partial<ErrorContext>;
	/** Optional: OAuth token refresh configuration */
	tokenRefresh?: TokenRefreshHandler;
}

/**
 * Base API client with standardized HTTP request handling
 *
 * Extends AuthenticatedHTTPClient from SDK, providing:
 * - Automatic AbortController timeout handling (no manual fetch)
 * - Automatic token refresh on 401
 * - Unified error handling via IntegrationError
 * - JSON-parsing helpers (getJson, postJson, etc.)
 *
 * Integration-specific behavior (like custom headers) is added via
 * wrapper methods that preserve the simple API.
 */
export abstract class BaseAPIClient extends AuthenticatedHTTPClient {
	constructor(config: BaseClientConfig) {
		super({
			baseUrl: config.apiUrl,
			accessToken: config.accessToken,
			timeout: config.timeout,
			errorContext: config.errorContext,
			tokenRefresh: config.tokenRefresh,
		});
	}

	// =========================================================================
	// COMPATIBILITY GETTERS
	// =========================================================================
	// For backwards compatibility with integrations that access these directly

	/**
	 * Get the API URL (alias for baseUrl from parent)
	 */
	protected get apiUrl(): string {
		return this.baseUrl;
	}

	// =========================================================================
	// BACKWARDS-COMPATIBLE JSON HELPERS
	// =========================================================================
	// These methods preserve the old API signature (path, body, headers)
	// while wrapping the SDK's new signature (path, {body, headers}).
	// This provides a more convenient signature for integrations.

	/**
	 * POST request with automatic JSON parsing
	 * @param path - API endpoint
	 * @param body - Request body (will be JSON-stringified)
	 * @param additionalHeaders - Extra headers to include
	 */
	async postJson<T>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.postJson<T>(path, { body, headers: additionalHeaders });
	}

	/**
	 * PATCH request with automatic JSON parsing
	 */
	async patchJson<T>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.patchJson<T>(path, { body, headers: additionalHeaders });
	}

	/**
	 * PUT request with automatic JSON parsing
	 */
	async putJson<T>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.putJson<T>(path, { body, headers: additionalHeaders });
	}

	/**
	 * GET request with automatic JSON parsing
	 */
	async getJson<T>(
		path: string,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.getJson<T>(path, { headers: additionalHeaders });
	}

	/**
	 * DELETE request with automatic JSON parsing
	 */
	async deleteJson<T = void>(
		path: string,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		return super.deleteJson<T>(path, { headers: additionalHeaders });
	}

	/**
	 * Assert response is OK, throw if not
	 *
	 * Alias for SDK's assertResponseOk for backwards compatibility.
	 */
	protected async assertOk(response: Response): Promise<void> {
		return this.assertResponseOk(response);
	}
}

// Re-export SDK utilities for convenience
export { buildQueryString } from '@workwayco/sdk';
export type { TokenRefreshHandler } from '@workwayco/sdk';
