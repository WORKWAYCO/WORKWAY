/**
 * Base API Client
 *
 * Weniger, aber besser: One HTTP request implementation for all integrations.
 * Eliminates ~120-180 lines of duplicate code across 6 integrations.
 */

export interface BaseClientConfig {
	/** OAuth access token */
	accessToken: string;
	/** Base API URL */
	apiUrl: string;
	/** Request timeout in ms (default: 30000) */
	timeout?: number;
}

/**
 * Base API client with standardized HTTP request handling
 */
export abstract class BaseAPIClient {
	protected readonly accessToken: string;
	protected readonly apiUrl: string;
	protected readonly timeout: number;

	constructor(config: BaseClientConfig) {
		this.accessToken = config.accessToken;
		this.apiUrl = config.apiUrl;
		this.timeout = config.timeout ?? 30000;
	}

	/**
	 * Make an authenticated HTTP request
	 *
	 * @param path - API endpoint path (appended to apiUrl)
	 * @param options - Fetch options
	 * @param additionalHeaders - Extra headers (e.g., API version headers)
	 */
	protected async request(
		path: string,
		options: RequestInit = {},
		additionalHeaders: Record<string, string> = {}
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
			return await fetch(url, {
				...options,
				headers,
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeoutId);
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
	 * Make a DELETE request
	 */
	protected delete(
		path: string,
		additionalHeaders: Record<string, string> = {}
	): Promise<Response> {
		return this.request(path, { method: 'DELETE' }, additionalHeaders);
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
