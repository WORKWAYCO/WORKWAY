/**
 * BaseHTTPClient Tests
 *
 * Tests for the unified HTTP client with token refresh support.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	BaseHTTPClient,
	AuthenticatedHTTPClient,
	type TokenRefreshHandler,
	type AuthenticatedHTTPClientConfig,
} from './base-http-client.js';
import { IntegrationError, ErrorCode } from './integration-error.js';

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock fetch globally
const originalFetch = global.fetch;

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	global.fetch = originalFetch;
});

// ============================================================================
// BASE HTTP CLIENT TESTS
// ============================================================================

describe('BaseHTTPClient', () => {
	it('should make GET request', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com' });
		const response = await client.get('/test');

		expect(global.fetch).toHaveBeenCalledWith(
			'https://api.example.com/test',
			expect.objectContaining({
				method: 'GET',
			})
		);
		expect(response.status).toBe(200);
	});

	it('should make POST request with body', async () => {
		const mockResponse = new Response(JSON.stringify({ id: '123' }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com' });
		await client.post('/users', { body: { name: 'John' } });

		expect(global.fetch).toHaveBeenCalledWith(
			'https://api.example.com/users',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ name: 'John' }),
			})
		);
	});

	it('should handle timeout', async () => {
		global.fetch = vi.fn().mockImplementation(
			(_url, options) => {
				// Simulate a fetch that gets aborted by timeout
				return new Promise((_, reject) => {
					if (options?.signal) {
						options.signal.addEventListener('abort', () => {
							const error = new Error('The operation was aborted');
							error.name = 'AbortError';
							reject(error);
						});
					}
					// Keep promise pending until abort
				});
			}
		);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com', timeout: 10 });

		await expect(client.get('/test')).rejects.toThrow(IntegrationError);
		await expect(client.get('/test')).rejects.toMatchObject({
			code: ErrorCode.TIMEOUT,
		});
	});

	it('should parse JSON response', async () => {
		const mockData = { id: '123', name: 'Test' };
		const mockResponse = new Response(JSON.stringify(mockData), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com' });
		const data = await client.getJson<typeof mockData>('/test');

		expect(data).toEqual(mockData);
	});

	it('should throw IntegrationError on non-OK response', async () => {
		const mockResponse = new Response(JSON.stringify({ error: 'Not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com' });

		await expect(client.getJson('/test')).rejects.toThrow(IntegrationError);
	});
});

// ============================================================================
// AUTHENTICATED HTTP CLIENT TESTS
// ============================================================================

describe('AuthenticatedHTTPClient', () => {
	it('should include Authorization header', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'test-token',
		});

		await client.get('/protected');

		expect(global.fetch).toHaveBeenCalledWith(
			'https://api.example.com/protected',
			expect.objectContaining({
				headers: expect.objectContaining({
					get: expect.any(Function),
				}),
			})
		);

		// Check that Authorization header was set
		const callArgs = (global.fetch as any).mock.calls[0];
		const headers = callArgs[1].headers as Headers;
		expect(headers.get('Authorization')).toBe('Bearer test-token');
	});
});

// ============================================================================
// TOKEN REFRESH TESTS
// ============================================================================

describe('AuthenticatedHTTPClient with token refresh', () => {
	it('should refresh token on 401 and retry request', async () => {
		const onTokenRefreshed = vi.fn();

		// First request returns 401
		const unauthorizedResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});

		// Token refresh succeeds
		const tokenRefreshResponse = new Response(
			JSON.stringify({
				access_token: 'new-token',
				refresh_token: 'new-refresh-token',
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);

		// Retry request succeeds
		const successResponse = new Response(JSON.stringify({ data: 'success' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi
			.fn()
			.mockResolvedValueOnce(unauthorizedResponse)
			.mockResolvedValueOnce(tokenRefreshResponse)
			.mockResolvedValueOnce(successResponse);

		const tokenRefresh: TokenRefreshHandler = {
			refreshToken: 'old-refresh-token',
			tokenEndpoint: 'https://auth.example.com/token',
			clientId: 'test-client-id',
			clientSecret: 'test-client-secret',
			onTokenRefreshed,
		};

		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'old-token',
			tokenRefresh,
		});

		const data = await client.getJson<{ data: string }>('/protected');

		// Should have made 3 fetch calls: initial request, token refresh, retry
		expect(global.fetch).toHaveBeenCalledTimes(3);

		// Verify token refresh was called with correct params
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			'https://auth.example.com/token',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'Content-Type': 'application/x-www-form-urlencoded',
				}),
			})
		);

		// Verify onTokenRefreshed callback was called
		expect(onTokenRefreshed).toHaveBeenCalledWith('new-token', 'new-refresh-token');

		// Verify final response
		expect(data).toEqual({ data: 'success' });
	});

	it('should throw AUTH_EXPIRED if token refresh fails', async () => {
		const onTokenRefreshed = vi.fn();

		// First request returns 401
		const unauthorizedResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});

		// Token refresh fails
		const tokenRefreshFailure = new Response(JSON.stringify({ error: 'Invalid refresh token' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi
			.fn()
			.mockResolvedValueOnce(unauthorizedResponse)
			.mockResolvedValueOnce(tokenRefreshFailure);

		const tokenRefresh: TokenRefreshHandler = {
			refreshToken: 'invalid-refresh-token',
			tokenEndpoint: 'https://auth.example.com/token',
			clientId: 'test-client-id',
			clientSecret: 'test-client-secret',
			onTokenRefreshed,
		};

		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'old-token',
			tokenRefresh,
		});

		try {
			await client.getJson('/protected');
			expect.fail('Should have thrown IntegrationError');
		} catch (error) {
			expect(error).toBeInstanceOf(IntegrationError);
			expect((error as IntegrationError).code).toBe(ErrorCode.AUTH_EXPIRED);
		}

		// Callback should NOT have been called
		expect(onTokenRefreshed).not.toHaveBeenCalled();
	});

	it('should not retry more than once on 401', async () => {
		const onTokenRefreshed = vi.fn();

		// Both requests return 401
		const unauthorizedResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});

		// Token refresh succeeds
		const tokenRefreshResponse = new Response(
			JSON.stringify({
				access_token: 'new-token',
				refresh_token: 'new-refresh-token',
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);

		global.fetch = vi
			.fn()
			.mockResolvedValueOnce(unauthorizedResponse)
			.mockResolvedValueOnce(tokenRefreshResponse)
			.mockResolvedValueOnce(unauthorizedResponse); // Retry also returns 401

		const tokenRefresh: TokenRefreshHandler = {
			refreshToken: 'old-refresh-token',
			tokenEndpoint: 'https://auth.example.com/token',
			clientId: 'test-client-id',
			clientSecret: 'test-client-secret',
			onTokenRefreshed,
		};

		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'old-token',
			tokenRefresh,
		});

		// Should throw error from the final 401 response
		await expect(client.getJson('/protected')).rejects.toThrow(IntegrationError);

		// Should have made 3 fetch calls: initial request, token refresh, retry (no second retry)
		expect(global.fetch).toHaveBeenCalledTimes(3);

		// Callback should have been called once
		expect(onTokenRefreshed).toHaveBeenCalledTimes(1);
	});

	it('should work without token refresh config (no automatic refresh)', async () => {
		// Request returns 401
		const unauthorizedResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(unauthorizedResponse);

		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'old-token',
			// No tokenRefresh config
		});

		// Should throw error immediately without attempting refresh
		await expect(client.getJson('/protected')).rejects.toThrow(IntegrationError);

		// Should have made only 1 fetch call (no refresh attempt)
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});
