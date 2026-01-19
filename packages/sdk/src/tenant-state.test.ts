/**
 * Rate Limiting Algorithm Tests
 *
 * Focus: Edge cases in sliding window rate limiter.
 * Pruned: Quota tier constants, trivial routing, usage tracking.
 */

import { describe, it, expect } from 'vitest';

/**
 * Sliding window rate limiter - extracted for testing
 */
function checkRateLimit(
	rateLimits: Map<string, { count: number; windowStart: number }>,
	key: string,
	limit: number,
	windowMs: number,
	now: number
): { allowed: boolean; remaining: number; resetAt: number } {
	let window = rateLimits.get(key);
	if (!window || now - window.windowStart >= windowMs) {
		window = { count: 0, windowStart: now };
	}

	window.count++;
	rateLimits.set(key, window);

	return {
		allowed: window.count <= limit,
		remaining: Math.max(0, limit - window.count),
		resetAt: window.windowStart + windowMs,
	};
}

describe('Rate Limiting Algorithm', () => {
	describe('basic behavior', () => {
		it('should allow requests under the limit', () => {
			const rateLimits = new Map();
			const result = checkRateLimit(rateLimits, 'api', 100, 60000, Date.now());

			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(99);
		});

		it('should block requests over the limit', () => {
			const rateLimits = new Map();
			const now = Date.now();

			// Exhaust the limit
			for (let i = 0; i < 100; i++) {
				checkRateLimit(rateLimits, 'api', 100, 60000, now);
			}

			// 101st request should be blocked
			const result = checkRateLimit(rateLimits, 'api', 100, 60000, now);
			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
		});
	});

	describe('window expiration', () => {
		it('should reset count when window expires', () => {
			const rateLimits = new Map();
			const windowMs = 60000;
			const startTime = Date.now();

			// Exhaust limit
			for (let i = 0; i < 100; i++) {
				checkRateLimit(rateLimits, 'api', 100, windowMs, startTime);
			}
			expect(checkRateLimit(rateLimits, 'api', 100, windowMs, startTime).allowed).toBe(false);

			// After window expires, should be allowed again
			const afterWindow = startTime + windowMs + 1;
			const result = checkRateLimit(rateLimits, 'api', 100, windowMs, afterWindow);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(99);
		});

		it('should handle exact window boundary (off-by-one)', () => {
			const rateLimits = new Map();
			const windowMs = 60000;
			const startTime = 1704067200000;

			checkRateLimit(rateLimits, 'api', 100, windowMs, startTime);

			// At boundary - 1ms: still same window
			const atBoundary = checkRateLimit(rateLimits, 'api', 100, windowMs, startTime + windowMs - 1);
			expect(atBoundary.remaining).toBe(98);

			// Exactly at boundary: NEW window
			const pastBoundary = checkRateLimit(rateLimits, 'api', 100, windowMs, startTime + windowMs);
			expect(pastBoundary.remaining).toBe(99);
		});
	});

	describe('edge cases', () => {
		it('should handle limit of 1 (single request allowed)', () => {
			const rateLimits = new Map();
			const now = Date.now();

			const first = checkRateLimit(rateLimits, 'api', 1, 60000, now);
			expect(first.allowed).toBe(true);
			expect(first.remaining).toBe(0);

			const second = checkRateLimit(rateLimits, 'api', 1, 60000, now);
			expect(second.allowed).toBe(false);
		});

		it('should handle limit of 0 (all requests blocked)', () => {
			const rateLimits = new Map();
			const result = checkRateLimit(rateLimits, 'api', 0, 60000, Date.now());

			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it('should track limits independently per key', () => {
			const rateLimits = new Map();
			const now = Date.now();

			// Exhaust 'api' limit
			for (let i = 0; i < 100; i++) {
				checkRateLimit(rateLimits, 'api', 100, 60000, now);
			}

			// 'ai' should still be available
			expect(checkRateLimit(rateLimits, 'ai', 100, 60000, now).allowed).toBe(true);
			// 'api' should be blocked
			expect(checkRateLimit(rateLimits, 'api', 100, 60000, now).allowed).toBe(false);
		});
	});
});
