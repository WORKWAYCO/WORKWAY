/**
 * Base API Client
 *
 * Weniger, aber besser: One HTTP request implementation for all integrations.
 * Eliminates ~120-180 lines of duplicate code across 6 integrations.
 *
 * Now leverages SDK's BaseHTTPClient for unified error handling and JSON helpers.
 */

import {
	IntegrationError,
	ErrorCode,
	createErrorFromResponse,
	type ErrorContext,
} from '@workwayco/sdk';

export interface TokenRefreshHandler {
	/** Refresh token for OAuth token refresh */
	refreshToken: string;
	/** OAuth token endpoint URL */
	tokenEndpoint: string;
	/** Client ID for OAuth token refresh */
	clientId: string;
	/** Client secret for OAuth token refresh */
	clientSecret: string;
	/** Callback to update the access token after refresh */
	onTokenRefreshed: (newAccessToken: string, newRefreshToken?: string) => void | Promise<void>;
}

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
 * Provides both raw Response methods (get, post, etc.) and
 * JSON-parsing methods (getJson, postJson, etc.) for convenience.
 */
export abstract class BaseAPIClient {
	protected accessToken: string;
	protected readonly apiUrl: string;
	protected readonly timeout: number;
	protected readonly errorContext: Partial<ErrorContext>;
	protected readonly tokenRefresh?: TokenRefreshHandler;

	constructor(config: BaseClientConfig) {
		this.accessToken = config.accessToken;
		this.apiUrl = config.apiUrl;
		this.timeout = config.timeout ?? 30000;
		this.errorContext = config.errorContext ?? {};
		this.tokenRefresh = config.tokenRefresh;
	}

	/**
	 * Make an authenticated HTTP request
	 *
	 * @param path - API endpoint path (appended to apiUrl)
	 * @param options - Fetch options
	 * @param additionalHeaders - Extra headers (e.g., API version headers)
	 * @param isRetry - Internal flag to prevent infinite retry loops
	 */
	protected async request(
		path: string,
		options: RequestInit = {},
		additionalHeaders: Record<string, string> = {},
		isRetry = false
	): Promise<Response> {
		const url = `${this.apiUrl}${path}`;
		const headers = new Headers(options.headers);

		// Standard headers
		headers.set('Authorization', `Bearer ${this.accessToken}`);
		headers.set('Content-Type', 'application/json');

		// Integration-specific headers (e.g., Notion-Version, Stripe-Version)
		for (const [key, value] of Object.entries(additionalHeaders)) {
			headers.set(key, value);
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await fetch(url, {
				...options,
				headers,
				signal: controller.signal,
			});

			// Handle 401 Unauthorized - attempt token refresh if configured
			if (response.status === 401 && !isRetry && this.tokenRefresh) {
				clearTimeout(timeoutId);
				await this.refreshAccessToken();
				// Retry the request once with the new token
				return this.request(path, options, additionalHeaders, true);
			}

			return response;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new IntegrationError(ErrorCode.TIMEOUT, `Request timed out after ${this.timeout}ms`, {
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
			};

			if (!data.access_token) {
				throw new IntegrationError(
					ErrorCode.AUTH_EXPIRED,
					'Token refresh response missing access_token',
					this.errorContext
				);
			}

			// Update internal access token
			this.accessToken = data.access_token;

			// Call the callback to persist the new token
			await onTokenRefreshed(data.access_token, data.refresh_token);
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
	 * Make a GET request
	 */
	protected get(
		path: string,
		additionalHeaders: Record<string, string> = {}
	): Promise<Response> {
		return this.request(path, { method: 'GET' }, additionalHeaders);
	}

	/**
	 * Make a POST request with JSON body
	 */
	protected post(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<Response> {
		return this.request(
			path,
			{
				method: 'POST',
				body: body ? JSON.stringify(body) : undefined,
			},
			additionalHeaders
		);
	}

	/**
	 * Make a PATCH request with JSON body
	 */
	protected patch(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<Response> {
		return this.request(
			path,
			{
				method: 'PATCH',
				body: body ? JSON.stringify(body) : undefined,
			},
			additionalHeaders
		);
	}

	/**
	 * Make a PUT request with JSON body
	 */
	protected put(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<Response> {
		return this.request(
			path,
			{
				method: 'PUT',
				body: body ? JSON.stringify(body) : undefined,
			},
			additionalHeaders
		);
	}

	/**
	 * Make a DELETE request
	 */
	protected delete(
		path: string,
		additionalHeaders: Record<string, string> = {}
	): Promise<Response> {
		return this.request(path, { method: 'DELETE' }, additionalHeaders);
	}

	// =========================================================================
	// JSON HELPERS (Weniger, aber besser)
	// =========================================================================
	// These helpers combine request + response parsing + error handling
	// into single calls, eliminating ~100 lines of duplicate code.

	/**
	 * GET request with automatic JSON parsing and error handling
	 *
	 * @example
	 * ```typescript
	 * const channels = await this.getJson<SlackChannel[]>('/conversations.list');
	 * ```
	 */
	protected async getJson<T>(
		path: string,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		const response = await this.get(path, additionalHeaders);
		return this.parseJsonResponse<T>(response);
	}

	/**
	 * POST request with automatic JSON parsing and error handling
	 *
	 * @example
	 * ```typescript
	 * const page = await this.postJson<NotionPage>('/pages', {
	 *   parent: { database_id: 'xxx' },
	 *   properties: { ... }
	 * });
	 * ```
	 */
	protected async postJson<T>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		const response = await this.post(path, body, additionalHeaders);
		return this.parseJsonResponse<T>(response);
	}

	/**
	 * PATCH request with automatic JSON parsing and error handling
	 */
	protected async patchJson<T>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		const response = await this.patch(path, body, additionalHeaders);
		return this.parseJsonResponse<T>(response);
	}

	/**
	 * PUT request with automatic JSON parsing and error handling
	 */
	protected async putJson<T>(
		path: string,
		body?: unknown,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		const response = await this.put(path, body, additionalHeaders);
		return this.parseJsonResponse<T>(response);
	}

	/**
	 * DELETE request with automatic JSON parsing (if response has body)
	 */
	protected async deleteJson<T = void>(
		path: string,
		additionalHeaders: Record<string, string> = {}
	): Promise<T> {
		const response = await this.delete(path, additionalHeaders);

		// Handle empty responses (204 No Content)
		if (response.status === 204) {
			return undefined as T;
		}

		return this.parseJsonResponse<T>(response);
	}

	/**
	 * Parse JSON response with unified error handling
	 *
	 * Throws IntegrationError if response is not OK or parsing fails.
	 * Uses the SDK's createErrorFromResponse for consistent error mapping.
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
	 * Assert response is OK, throw IntegrationError if not
	 *
	 * Use when you need the raw response but want error handling.
	 * This is an alias for compatibility with the existing assertResponseOk pattern.
	 */
	protected async assertOk(response: Response): Promise<void> {
		if (!response.ok) {
			throw await createErrorFromResponse(response, this.errorContext);
		}
	}
}

/**
 * Build a query string from an object, filtering out undefined/null values
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
