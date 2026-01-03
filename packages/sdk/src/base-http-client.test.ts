/**
 * BaseHTTPClient Tests
 *
 * Tests for the unified HTTP client with token refresh support and request tracing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	BaseHTTPClient,
	AuthenticatedHTTPClient,
	type TokenRefreshHandler,
	type AuthenticatedHTTPClientConfig,
	type TracingConfig,
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

		// Verify onTokenRefreshed callback was called (third arg is expires_in, undefined in this case)
		expect(onTokenRefreshed).toHaveBeenCalledWith('new-token', 'new-refresh-token', undefined);

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

// ============================================================================
// PROACTIVE TOKEN REFRESH TESTS
// ============================================================================

describe('AuthenticatedHTTPClient proactive token refresh', () => {
	it('should detect token expiring soon', () => {
		const now = Date.now();
		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'test-token',
			tokenExpiresAt: now + 2 * 60 * 1000, // Expires in 2 minutes
			proactiveRefreshThreshold: 5 * 60 * 1000, // 5 minute threshold
		});

		// Token expires in 2 minutes, threshold is 5 minutes -> should be expiring soon
		expect(client.isTokenExpiringSoon()).toBe(true);
	});

	it('should detect token not expiring soon', () => {
		const now = Date.now();
		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'test-token',
			tokenExpiresAt: now + 10 * 60 * 1000, // Expires in 10 minutes
			proactiveRefreshThreshold: 5 * 60 * 1000, // 5 minute threshold
		});

		// Token expires in 10 minutes, threshold is 5 minutes -> not expiring soon
		expect(client.isTokenExpiringSoon()).toBe(false);
	});

	it('should detect expired token', () => {
		const now = Date.now();
		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'test-token',
			tokenExpiresAt: now - 1000, // Expired 1 second ago
		});

		expect(client.isTokenExpired()).toBe(true);
		expect(client.isTokenExpiringSoon()).toBe(true);
	});

	it('should return null for time until expiry when no expiration set', () => {
		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'test-token',
		});

		expect(client.getTimeUntilExpiry()).toBeNull();
		expect(client.isTokenExpired()).toBe(false);
		expect(client.isTokenExpiringSoon()).toBe(false);
	});

	it('should proactively refresh token before request when expiring soon', async () => {
		const onTokenRefreshed = vi.fn();
		const now = Date.now();

		// Token refresh succeeds
		const tokenRefreshResponse = new Response(
			JSON.stringify({
				access_token: 'new-token',
				refresh_token: 'new-refresh-token',
				expires_in: 3600,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);

		// API request succeeds
		const successResponse = new Response(JSON.stringify({ data: 'success' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi
			.fn()
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
			tokenExpiresAt: now + 2 * 60 * 1000, // Expires in 2 minutes
			proactiveRefreshThreshold: 5 * 60 * 1000, // 5 minute threshold
			tokenRefresh,
		});

		const data = await client.getJson<{ data: string }>('/protected');

		// Should have made 2 fetch calls: token refresh FIRST, then API request
		expect(global.fetch).toHaveBeenCalledTimes(2);

		// First call should be token refresh
		expect(global.fetch).toHaveBeenNthCalledWith(
			1,
			'https://auth.example.com/token',
			expect.objectContaining({
				method: 'POST',
			})
		);

		// Second call should be the actual API request
		expect(global.fetch).toHaveBeenNthCalledWith(
			2,
			'https://api.example.com/protected',
			expect.objectContaining({
				method: 'GET',
			})
		);

		// Callback should have been called with expires_in
		expect(onTokenRefreshed).toHaveBeenCalledWith('new-token', 'new-refresh-token', 3600);

		// Verify final response
		expect(data).toEqual({ data: 'success' });
	});

	it('should not proactively refresh when token has plenty of time left', async () => {
		const onTokenRefreshed = vi.fn();
		const now = Date.now();

		// API request succeeds
		const successResponse = new Response(JSON.stringify({ data: 'success' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(successResponse);

		const tokenRefresh: TokenRefreshHandler = {
			refreshToken: 'old-refresh-token',
			tokenEndpoint: 'https://auth.example.com/token',
			clientId: 'test-client-id',
			clientSecret: 'test-client-secret',
			onTokenRefreshed,
		};

		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'valid-token',
			tokenExpiresAt: now + 30 * 60 * 1000, // Expires in 30 minutes
			proactiveRefreshThreshold: 5 * 60 * 1000, // 5 minute threshold
			tokenRefresh,
		});

		await client.getJson('/protected');

		// Should have made only 1 fetch call (no refresh needed)
		expect(global.fetch).toHaveBeenCalledTimes(1);

		// Callback should NOT have been called
		expect(onTokenRefreshed).not.toHaveBeenCalled();
	});

	it('should deduplicate concurrent refresh requests', async () => {
		const onTokenRefreshed = vi.fn();
		const now = Date.now();

		// Token refresh succeeds (add delay to simulate network latency)
		const tokenRefreshResponse = new Response(
			JSON.stringify({
				access_token: 'new-token',
				refresh_token: 'new-refresh-token',
				expires_in: 3600,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);

		// API requests succeed
		const successResponse = new Response(JSON.stringify({ data: 'success' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		let refreshCallCount = 0;
		global.fetch = vi.fn().mockImplementation((url: string) => {
			if (url.includes('/token')) {
				refreshCallCount++;
				return Promise.resolve(tokenRefreshResponse.clone());
			}
			return Promise.resolve(successResponse.clone());
		});

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
			tokenExpiresAt: now + 2 * 60 * 1000, // Expires in 2 minutes
			proactiveRefreshThreshold: 5 * 60 * 1000, // 5 minute threshold
			tokenRefresh,
		});

		// Make 3 concurrent requests
		const [result1, result2, result3] = await Promise.all([
			client.getJson<{ data: string }>('/protected1'),
			client.getJson<{ data: string }>('/protected2'),
			client.getJson<{ data: string }>('/protected3'),
		]);

		// All requests should succeed
		expect(result1).toEqual({ data: 'success' });
		expect(result2).toEqual({ data: 'success' });
		expect(result3).toEqual({ data: 'success' });

		// Token refresh should only be called ONCE (deduplicated)
		expect(refreshCallCount).toBe(1);
		expect(onTokenRefreshed).toHaveBeenCalledTimes(1);
	});

	it('should update tokenExpiresAt after refresh', async () => {
		const onTokenRefreshed = vi.fn();
		const now = Date.now();

		// Token refresh succeeds with expires_in
		const tokenRefreshResponse = new Response(
			JSON.stringify({
				access_token: 'new-token',
				refresh_token: 'new-refresh-token',
				expires_in: 3600, // 1 hour
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);

		// API request succeeds
		const successResponse = new Response(JSON.stringify({ data: 'success' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi
			.fn()
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
			tokenExpiresAt: now + 2 * 60 * 1000, // Expires in 2 minutes
			proactiveRefreshThreshold: 5 * 60 * 1000,
			tokenRefresh,
		});

		await client.getJson('/protected');

		// After refresh, getTokenExpiresAt should return a future time (~1 hour from now)
		const newExpiresAt = client.getTokenExpiresAt();
		expect(newExpiresAt).toBeDefined();
		expect(newExpiresAt).toBeGreaterThan(now + 3500 * 1000); // At least ~58 minutes from now
		expect(newExpiresAt).toBeLessThan(now + 3700 * 1000); // At most ~62 minutes from now
	});

	it('should use custom proactiveRefreshThreshold', () => {
		const now = Date.now();

		// With 1 minute threshold
		const client1 = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'test-token',
			tokenExpiresAt: now + 2 * 60 * 1000, // Expires in 2 minutes
			proactiveRefreshThreshold: 1 * 60 * 1000, // 1 minute threshold
		});

		// Token expires in 2 min, threshold is 1 min -> NOT expiring soon
		expect(client1.isTokenExpiringSoon()).toBe(false);

		// With 10 minute threshold
		const client2 = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'test-token',
			tokenExpiresAt: now + 2 * 60 * 1000, // Expires in 2 minutes
			proactiveRefreshThreshold: 10 * 60 * 1000, // 10 minute threshold
		});

		// Token expires in 2 min, threshold is 10 min -> IS expiring soon
		expect(client2.isTokenExpiringSoon()).toBe(true);
	});

	it('should use default 5 minute threshold when not specified', () => {
		const now = Date.now();

		const client = new AuthenticatedHTTPClient({
			baseUrl: 'https://api.example.com',
			accessToken: 'test-token',
			tokenExpiresAt: now + 4 * 60 * 1000, // Expires in 4 minutes
			// proactiveRefreshThreshold not specified -> defaults to 5 minutes
		});

		// Token expires in 4 min, default threshold is 5 min -> IS expiring soon
		expect(client.isTokenExpiringSoon()).toBe(true);
	});
});

// ============================================================================
// REQUEST TRACING TESTS
// ============================================================================

describe('BaseHTTPClient request tracing', () => {
	it('should add X-Correlation-ID header by default', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com' });
		await client.get('/test');

		// Check that X-Correlation-ID header was set
		const callArgs = (global.fetch as any).mock.calls[0];
		const headers = callArgs[1].headers as Headers;
		const correlationId = headers.get('X-Correlation-ID');

		expect(correlationId).toBeDefined();
		expect(correlationId).not.toBe('');
		// Should be a UUID format
		expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});

	it('should store correlation ID for debugging', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com' });

		// No correlation ID before request
		expect(client.getLastCorrelationId()).toBeUndefined();

		await client.get('/test');

		// Correlation ID available after request
		const correlationId = client.getLastCorrelationId();
		expect(correlationId).toBeDefined();
		expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});

	it('should propagate provided correlation ID', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com' });
		const incomingId = 'incoming-trace-id-12345';

		await client.get('/test', { correlationId: incomingId });

		// Check that provided ID was used
		const callArgs = (global.fetch as any).mock.calls[0];
		const headers = callArgs[1].headers as Headers;
		expect(headers.get('X-Correlation-ID')).toBe(incomingId);

		// getLastCorrelationId should return the propagated ID
		expect(client.getLastCorrelationId()).toBe(incomingId);
	});

	it('should use custom header name', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({
			baseUrl: 'https://api.example.com',
			tracing: {
				headerName: 'X-Request-ID',
			},
		});

		await client.get('/test');

		const callArgs = (global.fetch as any).mock.calls[0];
		const headers = callArgs[1].headers as Headers;

		// Should use custom header name
		expect(headers.get('X-Request-ID')).toBeDefined();
		expect(headers.get('X-Correlation-ID')).toBeNull();
	});

	it('should use custom ID generator', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		let callCount = 0;
		const customGenerator = () => `custom-id-${++callCount}`;

		const client = new BaseHTTPClient({
			baseUrl: 'https://api.example.com',
			tracing: {
				generateId: customGenerator,
			},
		});

		await client.get('/test1');
		expect(client.getLastCorrelationId()).toBe('custom-id-1');

		await client.get('/test2');
		expect(client.getLastCorrelationId()).toBe('custom-id-2');
	});

	it('should disable tracing when enabled: false', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({
			baseUrl: 'https://api.example.com',
			tracing: {
				enabled: false,
			},
		});

		await client.get('/test');

		// No correlation ID header should be set
		const callArgs = (global.fetch as any).mock.calls[0];
		const headers = callArgs[1].headers as Headers;
		expect(headers.get('X-Correlation-ID')).toBeNull();

		// getLastCorrelationId should be undefined
		expect(client.getLastCorrelationId()).toBeUndefined();
	});

	it('should include correlation ID in error context on timeout', async () => {
		global.fetch = vi.fn().mockImplementation(
			(_url, options) => {
				return new Promise((_, reject) => {
					if (options?.signal) {
						options.signal.addEventListener('abort', () => {
							const error = new Error('The operation was aborted');
							error.name = 'AbortError';
							reject(error);
						});
					}
				});
			}
		);

		const client = new BaseHTTPClient({
			baseUrl: 'https://api.example.com',
			timeout: 10,
		});

		try {
			await client.get('/test');
			expect.fail('Should have thrown IntegrationError');
		} catch (error) {
			expect(error).toBeInstanceOf(IntegrationError);
			const integrationError = error as IntegrationError;
			expect(integrationError.code).toBe(ErrorCode.TIMEOUT);
			// Error context should include correlation ID
			expect(integrationError.context.correlationId).toBeDefined();
		}
	});

	it('should include correlation ID in error context on API error', async () => {
		const mockResponse = new Response(JSON.stringify({ error: 'Not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com' });

		try {
			await client.getJson('/test');
			expect.fail('Should have thrown IntegrationError');
		} catch (error) {
			expect(error).toBeInstanceOf(IntegrationError);
			const integrationError = error as IntegrationError;
			// Error context should include correlation ID
			expect(integrationError.context.correlationId).toBeDefined();
			expect(integrationError.context.correlationId).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			);
		}
	});

	it('should propagate correlation ID from request headers', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({ baseUrl: 'https://api.example.com' });
		const incomingId = 'header-propagated-id';

		await client.get('/test', {
			headers: { 'X-Correlation-ID': incomingId },
		});

		// Should use the ID from headers
		expect(client.getLastCorrelationId()).toBe(incomingId);
	});

	it('should not propagate when propagate: false', async () => {
		const mockResponse = new Response(JSON.stringify({ data: 'test' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi.fn().mockResolvedValue(mockResponse);

		const client = new BaseHTTPClient({
			baseUrl: 'https://api.example.com',
			tracing: {
				propagate: false,
			},
		});

		const providedId = 'provided-id-should-be-ignored';
		await client.get('/test', { correlationId: providedId });

		// Should generate new ID, not use provided one
		const correlationId = client.getLastCorrelationId();
		expect(correlationId).toBeDefined();
		expect(correlationId).not.toBe(providedId);
	});
});

describe('AuthenticatedHTTPClient request tracing', () => {
	it('should include correlation ID in requests with auth', async () => {
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

		// Check both Authorization and X-Correlation-ID headers
		const callArgs = (global.fetch as any).mock.calls[0];
		const headers = callArgs[1].headers as Headers;

		expect(headers.get('Authorization')).toBe('Bearer test-token');
		expect(headers.get('X-Correlation-ID')).toBeDefined();
	});

	it('should include correlation ID in error context after token refresh', async () => {
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
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			}
		);

		// Retry request also fails (for testing error context)
		const notFoundResponse = new Response(JSON.stringify({ error: 'Not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});

		global.fetch = vi
			.fn()
			.mockResolvedValueOnce(unauthorizedResponse)
			.mockResolvedValueOnce(tokenRefreshResponse)
			.mockResolvedValueOnce(notFoundResponse);

		const tokenRefresh: TokenRefreshHandler = {
			refreshToken: 'refresh-token',
			tokenEndpoint: 'https://auth.example.com/token',
			clientId: 'client-id',
			clientSecret: 'client-secret',
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
			const integrationError = error as IntegrationError;
			// Error context should include correlation ID
			expect(integrationError.context.correlationId).toBeDefined();
		}
	});
});
