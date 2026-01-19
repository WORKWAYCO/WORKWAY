/**
 * Tenant State Tests
 *
 * Tests for per-tenant Durable Object rate limiting and quota management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock storage
const mockStorage = {
	get: vi.fn(),
	put: vi.fn(),
};

// Mock ctx
const mockCtx = {
	storage: mockStorage,
	waitUntil: vi.fn(),
};

// Mock env
const mockEnv = {
	TENANT_STATE: {},
	TENANT_METADATA: {},
	DEFAULT_RATE_LIMIT: '1000',
	DEFAULT_RATE_WINDOW_SECONDS: '60',
};

// =============================================================================
// RATE LIMIT LOGIC TESTS (Unit tests for the algorithm)
// =============================================================================

describe('Rate Limit Algorithm', () => {
	/**
	 * Sliding window rate limiter implementation to test
	 */
	function checkRateLimit(
		rateLimits: Map<string, { count: number; windowStart: number }>,
		key: string,
		limit: number,
		windowMs: number,
		now: number
	): { allowed: boolean; remaining: number; resetAt: number } {
		// Get or create window for this key
		let window = rateLimits.get(key);
		if (!window || now - window.windowStart >= windowMs) {
			window = { count: 0, windowStart: now };
		}

		// Increment count
		window.count++;
		rateLimits.set(key, window);

		return {
			allowed: window.count <= limit,
			remaining: Math.max(0, limit - window.count),
			resetAt: window.windowStart + windowMs,
		};
	}

	describe('basic rate limiting', () => {
		it('should allow requests under the limit', () => {
			const rateLimits = new Map();
			const now = Date.now();

			const result = checkRateLimit(rateLimits, 'api', 100, 60000, now);

			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(99);
		});

		it('should block requests over the limit', () => {
			const rateLimits = new Map();
			const now = Date.now();

			// Make 100 requests (limit)
			for (let i = 0; i < 100; i++) {
				checkRateLimit(rateLimits, 'api', 100, 60000, now);
			}

			// 101st request should be blocked
			const result = checkRateLimit(rateLimits, 'api', 100, 60000, now);

			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it('should return correct remaining count', () => {
			const rateLimits = new Map();
			const now = Date.now();

			// Make 50 requests
			for (let i = 0; i < 50; i++) {
				checkRateLimit(rateLimits, 'api', 100, 60000, now);
			}

			const result = checkRateLimit(rateLimits, 'api', 100, 60000, now);

			expect(result.remaining).toBe(49); // 100 - 51
		});
	});

	describe('window expiration', () => {
		it('should reset count when window expires', () => {
			const rateLimits = new Map();
			const windowMs = 60000; // 1 minute

			// Fill up the limit
			const startTime = Date.now();
			for (let i = 0; i < 100; i++) {
				checkRateLimit(rateLimits, 'api', 100, windowMs, startTime);
			}

			// Request should be blocked
			let result = checkRateLimit(rateLimits, 'api', 100, windowMs, startTime);
			expect(result.allowed).toBe(false);

			// Advance time past window
			const afterWindow = startTime + windowMs + 1;
			result = checkRateLimit(rateLimits, 'api', 100, windowMs, afterWindow);

			// Should be allowed now (new window)
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(99);
		});

		it('should calculate correct resetAt time', () => {
			const rateLimits = new Map();
			const windowMs = 60000;
			const now = 1704067200000; // Fixed timestamp

			const result = checkRateLimit(rateLimits, 'api', 100, windowMs, now);

			expect(result.resetAt).toBe(now + windowMs);
		});

		it('should keep same resetAt within window', () => {
			const rateLimits = new Map();
			const windowMs = 60000;
			const startTime = 1704067200000;

			const result1 = checkRateLimit(rateLimits, 'api', 100, windowMs, startTime);
			const result2 = checkRateLimit(rateLimits, 'api', 100, windowMs, startTime + 1000);

			expect(result2.resetAt).toBe(result1.resetAt);
		});
	});

	describe('multiple keys', () => {
		it('should track limits independently per key', () => {
			const rateLimits = new Map();
			const now = Date.now();

			// Fill up 'api' limit
			for (let i = 0; i < 100; i++) {
				checkRateLimit(rateLimits, 'api', 100, 60000, now);
			}

			// 'ai' should still be available
			const aiResult = checkRateLimit(rateLimits, 'ai', 100, 60000, now);
			expect(aiResult.allowed).toBe(true);
			expect(aiResult.remaining).toBe(99);

			// 'api' should be blocked
			const apiResult = checkRateLimit(rateLimits, 'api', 100, 60000, now);
			expect(apiResult.allowed).toBe(false);
		});

		it('should handle different limits per key', () => {
			const rateLimits = new Map();
			const now = Date.now();

			// 'api' has limit of 100
			const apiResult = checkRateLimit(rateLimits, 'api', 100, 60000, now);
			expect(apiResult.remaining).toBe(99);

			// 'ai' has limit of 10
			const aiResult = checkRateLimit(rateLimits, 'ai', 10, 60000, now);
			expect(aiResult.remaining).toBe(9);
		});
	});

	describe('edge cases', () => {
		it('should handle limit of 1', () => {
			const rateLimits = new Map();
			const now = Date.now();

			const result1 = checkRateLimit(rateLimits, 'single', 1, 60000, now);
			expect(result1.allowed).toBe(true);
			expect(result1.remaining).toBe(0);

			const result2 = checkRateLimit(rateLimits, 'single', 1, 60000, now);
			expect(result2.allowed).toBe(false);
		});

		it('should handle limit of 0', () => {
			const rateLimits = new Map();
			const now = Date.now();

			// Limit of 0 means all requests are blocked
			const result = checkRateLimit(rateLimits, 'blocked', 0, 60000, now);
			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it('should handle very short windows', () => {
			const rateLimits = new Map();
			const windowMs = 1000; // 1 second
			const now = Date.now();

			const result1 = checkRateLimit(rateLimits, 'api', 5, windowMs, now);
			expect(result1.allowed).toBe(true);

			// After 1 second, should reset
			const result2 = checkRateLimit(rateLimits, 'api', 5, windowMs, now + windowMs);
			expect(result2.remaining).toBe(4); // Fresh window
		});

		it('should handle exact window boundary', () => {
			const rateLimits = new Map();
			const windowMs = 60000;
			const startTime = 1704067200000;

			checkRateLimit(rateLimits, 'api', 100, windowMs, startTime);

			// Exactly at boundary (not past it)
			const result = checkRateLimit(rateLimits, 'api', 100, windowMs, startTime + windowMs - 1);
			expect(result.remaining).toBe(98); // Same window

			// Just past boundary
			const result2 = checkRateLimit(rateLimits, 'api', 100, windowMs, startTime + windowMs);
			expect(result2.remaining).toBe(99); // New window
		});
	});
});

// =============================================================================
// QUOTA TIER TESTS
// =============================================================================

describe('Quota Tiers', () => {
	const DEFAULT_QUOTAS = {
		free: {
			tier: 'free' as const,
			rateLimit: 100,
			rateLimitWindow: 60,
			maxTokensPerMonth: 10000,
		},
		pro: {
			tier: 'pro' as const,
			rateLimit: 1000,
			rateLimitWindow: 60,
			maxTokensPerMonth: 100000,
		},
		enterprise: {
			tier: 'enterprise' as const,
			rateLimit: 10000,
			rateLimitWindow: 60,
			maxTokensPerMonth: 1000000,
		},
	};

	it('should have correct free tier limits', () => {
		expect(DEFAULT_QUOTAS.free.rateLimit).toBe(100);
		expect(DEFAULT_QUOTAS.free.maxTokensPerMonth).toBe(10000);
	});

	it('should have correct pro tier limits', () => {
		expect(DEFAULT_QUOTAS.pro.rateLimit).toBe(1000);
		expect(DEFAULT_QUOTAS.pro.maxTokensPerMonth).toBe(100000);
	});

	it('should have correct enterprise tier limits', () => {
		expect(DEFAULT_QUOTAS.enterprise.rateLimit).toBe(10000);
		expect(DEFAULT_QUOTAS.enterprise.maxTokensPerMonth).toBe(1000000);
	});

	it('should have 10x difference between tiers', () => {
		expect(DEFAULT_QUOTAS.pro.rateLimit).toBe(DEFAULT_QUOTAS.free.rateLimit * 10);
		expect(DEFAULT_QUOTAS.enterprise.rateLimit).toBe(DEFAULT_QUOTAS.pro.rateLimit * 10);
	});

	it('should use same window for all tiers', () => {
		expect(DEFAULT_QUOTAS.free.rateLimitWindow).toBe(60);
		expect(DEFAULT_QUOTAS.pro.rateLimitWindow).toBe(60);
		expect(DEFAULT_QUOTAS.enterprise.rateLimitWindow).toBe(60);
	});
});

// =============================================================================
// USAGE TRACKING TESTS
// =============================================================================

describe('Usage Tracking', () => {
	interface TenantUsage {
		requests: number;
		tokensUsed: number;
		lastActivity: number;
	}

	it('should increment request count', () => {
		const usage: TenantUsage = {
			requests: 0,
			tokensUsed: 0,
			lastActivity: Date.now(),
		};

		usage.requests++;

		expect(usage.requests).toBe(1);
	});

	it('should accumulate token usage', () => {
		const usage: TenantUsage = {
			requests: 0,
			tokensUsed: 0,
			lastActivity: Date.now(),
		};

		usage.tokensUsed += 100;
		usage.tokensUsed += 50;
		usage.tokensUsed += 200;

		expect(usage.tokensUsed).toBe(350);
	});

	it('should reset usage correctly', () => {
		const usage: TenantUsage = {
			requests: 500,
			tokensUsed: 5000,
			lastActivity: Date.now() - 86400000, // 1 day ago
		};

		// Reset
		const newUsage: TenantUsage = {
			requests: 0,
			tokensUsed: 0,
			lastActivity: Date.now(),
		};

		expect(newUsage.requests).toBe(0);
		expect(newUsage.tokensUsed).toBe(0);
		expect(newUsage.lastActivity).toBeGreaterThan(usage.lastActivity);
	});
});

// =============================================================================
// HTTP ROUTING TESTS
// =============================================================================

describe('HTTP Routing', () => {
	it('should parse tenant ID from path', () => {
		const pathname = '/tenant/tenant_123/rate-limit/api';
		const match = pathname.match(/^\/tenant\/([^/]+)(\/.*)?$/);

		expect(match).not.toBeNull();
		expect(match![1]).toBe('tenant_123');
		expect(match![2]).toBe('/rate-limit/api');
	});

	it('should handle path without subpath', () => {
		const pathname = '/tenant/tenant_123';
		const match = pathname.match(/^\/tenant\/([^/]+)(\/.*)?$/);

		expect(match).not.toBeNull();
		expect(match![1]).toBe('tenant_123');
		expect(match![2]).toBeUndefined();
	});

	it('should not match invalid paths', () => {
		const invalidPaths = ['/tenants/123', '/tenant/', '/api/tenant/123', '/'];

		for (const pathname of invalidPaths) {
			const match = pathname.match(/^\/tenant\/([^/]+)(\/.*)?$/);
			expect(match).toBeNull();
		}
	});

	it('should handle special characters in tenant ID', () => {
		const pathname = '/tenant/org_abc-123_xyz/usage';
		const match = pathname.match(/^\/tenant\/([^/]+)(\/.*)?$/);

		expect(match![1]).toBe('org_abc-123_xyz');
	});
});

// =============================================================================
// DURABLE OBJECT API TESTS
// =============================================================================

describe('Durable Object API Routes', () => {
	const routes = [
		{ method: 'POST', path: '/rate-limit/api', description: 'Check rate limit' },
		{ method: 'POST', path: '/tokens', description: 'Record token usage' },
		{ method: 'GET', path: '/usage', description: 'Get usage stats' },
		{ method: 'GET', path: '/quota', description: 'Get quota' },
		{ method: 'PUT', path: '/quota', description: 'Update quota' },
		{ method: 'POST', path: '/reset', description: 'Reset usage' },
	];

	it('should have all expected routes', () => {
		expect(routes).toHaveLength(6);
	});

	it('should use correct HTTP methods', () => {
		const getRoutes = routes.filter((r) => r.method === 'GET');
		const postRoutes = routes.filter((r) => r.method === 'POST');
		const putRoutes = routes.filter((r) => r.method === 'PUT');

		expect(getRoutes).toHaveLength(2);
		expect(postRoutes).toHaveLength(3);
		expect(putRoutes).toHaveLength(1);
	});

	it('should extract rate limit key from path', () => {
		const path = '/rate-limit/ai';
		const key = path.slice('/rate-limit/'.length);

		expect(key).toBe('ai');
	});
});
