/**
 * Edge Cache Tests
 *
 * Tests for edge cache logic. The Cache API is only available in Workers runtime,
 * so we test the logic patterns rather than mocking the full API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// CACHE KEY GENERATION TESTS
// =============================================================================

describe('Cache Key Generation', () => {
	// Test the URL pattern used for cache keys
	function getCacheKeyUrl(namespace: string, key: string): string {
		return `https://cache.workway.internal/${namespace}/${key}`;
	}

	it('should generate correct cache key URL', () => {
		const url = getCacheKeyUrl('workflows', 'workflow:123');
		expect(url).toBe('https://cache.workway.internal/workflows/workflow:123');
	});

	it('should handle default namespace', () => {
		const url = getCacheKeyUrl('default', 'key');
		expect(url).toBe('https://cache.workway.internal/default/key');
	});

	it('should handle special characters in key', () => {
		const url = getCacheKeyUrl('api', 'user:123:profile');
		expect(url).toBe('https://cache.workway.internal/api/user:123:profile');
	});

	it('should handle namespace with hyphens', () => {
		const url = getCacheKeyUrl('workflow-metadata', 'wf-123');
		expect(url).toBe('https://cache.workway.internal/workflow-metadata/wf-123');
	});
});

// =============================================================================
// CACHE CONTROL HEADER TESTS
// =============================================================================

describe('Cache Control Headers', () => {
	function buildCacheControl(ttlSeconds: number, staleWhileRevalidate?: number): string {
		const parts = [`s-maxage=${ttlSeconds}`];
		if (staleWhileRevalidate) {
			parts.push(`stale-while-revalidate=${staleWhileRevalidate}`);
		}
		return parts.join(', ');
	}

	it('should generate s-maxage header', () => {
		const header = buildCacheControl(3600);
		expect(header).toBe('s-maxage=3600');
	});

	it('should include stale-while-revalidate when specified', () => {
		const header = buildCacheControl(300, 60);
		expect(header).toBe('s-maxage=300, stale-while-revalidate=60');
	});

	it('should handle short TTL', () => {
		const header = buildCacheControl(60);
		expect(header).toBe('s-maxage=60');
	});

	it('should handle long TTL', () => {
		const header = buildCacheControl(86400); // 1 day
		expect(header).toBe('s-maxage=86400');
	});
});

// =============================================================================
// CACHE METADATA TESTS
// =============================================================================

describe('Cache Metadata', () => {
	interface EdgeCacheMetadata {
		cachedAt: number;
		ttlSeconds: number;
		tags?: string[];
	}

	function createMetadata(ttlSeconds: number, tags?: string[]): EdgeCacheMetadata {
		return {
			cachedAt: Date.now(),
			ttlSeconds,
			tags,
		};
	}

	it('should create metadata with timestamp', () => {
		const now = Date.now();
		const metadata = createMetadata(300);

		expect(metadata.cachedAt).toBeGreaterThanOrEqual(now);
		expect(metadata.ttlSeconds).toBe(300);
	});

	it('should include tags when provided', () => {
		const metadata = createMetadata(300, ['workflow', 'user:123']);

		expect(metadata.tags).toEqual(['workflow', 'user:123']);
	});

	it('should serialize to valid JSON', () => {
		const metadata = createMetadata(300, ['test']);
		const json = JSON.stringify(metadata);
		const parsed = JSON.parse(json);

		expect(parsed.ttlSeconds).toBe(300);
		expect(parsed.tags).toEqual(['test']);
	});

	it('should parse metadata from header', () => {
		const headerValue = JSON.stringify({
			cachedAt: 1704067200000,
			ttlSeconds: 300,
			tags: ['test'],
		});

		const metadata = JSON.parse(headerValue) as EdgeCacheMetadata;

		expect(metadata.cachedAt).toBe(1704067200000);
		expect(metadata.ttlSeconds).toBe(300);
	});
});

// =============================================================================
// GET OR SET PATTERN TESTS
// =============================================================================

describe('Get Or Set Pattern', () => {
	// Simulate the getOrSet logic
	async function getOrSet<T>(
		cache: Map<string, T>,
		key: string,
		factory: () => Promise<T>
	): Promise<{ value: T; fromCache: boolean }> {
		const cached = cache.get(key);
		if (cached !== undefined) {
			return { value: cached, fromCache: true };
		}

		const value = await factory();
		cache.set(key, value);
		return { value, fromCache: false };
	}

	it('should return cached value without calling factory', async () => {
		const cache = new Map<string, object>();
		cache.set('key', { cached: true });

		const factory = vi.fn().mockResolvedValue({ fresh: true });
		const result = await getOrSet(cache, 'key', factory);

		expect(result.value).toEqual({ cached: true });
		expect(result.fromCache).toBe(true);
		expect(factory).not.toHaveBeenCalled();
	});

	it('should call factory and cache on miss', async () => {
		const cache = new Map<string, object>();
		const factory = vi.fn().mockResolvedValue({ fresh: true });

		const result = await getOrSet(cache, 'key', factory);

		expect(result.value).toEqual({ fresh: true });
		expect(result.fromCache).toBe(false);
		expect(factory).toHaveBeenCalledTimes(1);
		expect(cache.get('key')).toEqual({ fresh: true });
	});

	it('should handle async factory', async () => {
		const cache = new Map<string, string>();
		const factory = async () => {
			await new Promise((r) => setTimeout(r, 10));
			return 'async-result';
		};

		const result = await getOrSet(cache, 'key', factory);

		expect(result.value).toBe('async-result');
	});
});

// =============================================================================
// INVALIDATE MANY TESTS
// =============================================================================

describe('Invalidate Many', () => {
	async function invalidateMany(
		cache: Map<string, unknown>,
		keys: string[]
	): Promise<number> {
		let deleted = 0;
		for (const key of keys) {
			if (cache.delete(key)) {
				deleted++;
			}
		}
		return deleted;
	}

	it('should delete all existing keys', async () => {
		const cache = new Map<string, string>();
		cache.set('key1', 'value1');
		cache.set('key2', 'value2');
		cache.set('key3', 'value3');

		const deleted = await invalidateMany(cache, ['key1', 'key2', 'key3']);

		expect(deleted).toBe(3);
		expect(cache.size).toBe(0);
	});

	it('should return count of deleted keys', async () => {
		const cache = new Map<string, string>();
		cache.set('key1', 'value1');
		cache.set('key3', 'value3');

		const deleted = await invalidateMany(cache, ['key1', 'key2', 'key3']);

		expect(deleted).toBe(2); // key2 didn't exist
	});

	it('should return 0 for empty array', async () => {
		const cache = new Map<string, string>();
		cache.set('key1', 'value1');

		const deleted = await invalidateMany(cache, []);

		expect(deleted).toBe(0);
		expect(cache.size).toBe(1);
	});
});

// =============================================================================
// PREFIX INVALIDATION TESTS
// =============================================================================

describe('Prefix Invalidation', () => {
	function filterByPrefix(keys: string[], prefix: string): string[] {
		return keys.filter((k) => k.startsWith(prefix));
	}

	it('should filter keys by prefix', () => {
		const keys = ['user:1:profile', 'user:1:settings', 'user:2:profile', 'workflow:123'];
		const matching = filterByPrefix(keys, 'user:1:');

		expect(matching).toEqual(['user:1:profile', 'user:1:settings']);
	});

	it('should return empty array for no matches', () => {
		const keys = ['user:1:profile', 'user:2:profile'];
		const matching = filterByPrefix(keys, 'workflow:');

		expect(matching).toEqual([]);
	});

	it('should match exact prefix', () => {
		const keys = ['user', 'user:1', 'users:list'];
		const matching = filterByPrefix(keys, 'user:');

		expect(matching).toEqual(['user:1']);
	});
});

// =============================================================================
// JSON SERIALIZATION TESTS
// =============================================================================

describe('JSON Serialization for Cache', () => {
	it('should serialize complex objects', () => {
		const data = {
			id: 123,
			name: 'Test',
			nested: { a: 1, b: [1, 2, 3] },
			date: '2024-01-15T00:00:00Z',
		};

		const json = JSON.stringify(data);
		const parsed = JSON.parse(json);

		expect(parsed).toEqual(data);
	});

	it('should handle null values', () => {
		const data = { value: null };
		const json = JSON.stringify(data);
		const parsed = JSON.parse(json);

		expect(parsed.value).toBeNull();
	});

	it('should handle arrays', () => {
		const data = [1, 'two', { three: 3 }];
		const json = JSON.stringify(data);
		const parsed = JSON.parse(json);

		expect(parsed).toEqual(data);
	});

	it('should not include undefined values', () => {
		const data = { a: 1, b: undefined };
		const json = JSON.stringify(data);
		const parsed = JSON.parse(json);

		expect(parsed).toEqual({ a: 1 });
		expect('b' in parsed).toBe(false);
	});
});
