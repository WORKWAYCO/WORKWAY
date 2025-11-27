/**
 * HTTP Module
 *
 * Simplified HTTP client for workflow development.
 * Wraps native fetch with retry logic, timeout handling, and error normalization.
 */

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

export class HttpError extends Error {
	constructor(
		message: string,
		public status: number,
		public response?: any
	) {
		super(message);
		this.name = 'HttpError';
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

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export default http;
