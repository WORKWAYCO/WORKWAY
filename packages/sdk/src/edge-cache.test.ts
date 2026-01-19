/**
 * Edge Cache Tests
 *
 * Focus: Cache-aside pattern behavior.
 * Pruned: URL generation, header formatting, JSON serialization.
 */

import { describe, it, expect, vi } from 'vitest';

/**
 * Get-or-set pattern - the core cache behavior
 */
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

describe('Cache Get-Or-Set Pattern', () => {
	it('should NOT call factory when cache hits', async () => {
		const cache = new Map<string, object>();
		cache.set('key', { cached: true });

		const factory = vi.fn().mockResolvedValue({ fresh: true });
		const result = await getOrSet(cache, 'key', factory);

		expect(result.fromCache).toBe(true);
		expect(result.value).toEqual({ cached: true });
		expect(factory).not.toHaveBeenCalled();
	});

	it('should call factory and cache result on miss', async () => {
		const cache = new Map<string, object>();
		const factory = vi.fn().mockResolvedValue({ fresh: true });

		const result = await getOrSet(cache, 'key', factory);

		expect(result.fromCache).toBe(false);
		expect(result.value).toEqual({ fresh: true });
		expect(factory).toHaveBeenCalledTimes(1);
		expect(cache.has('key')).toBe(true);
	});
});

describe('Cache Invalidation', () => {
	async function invalidateMany(
		cache: Map<string, unknown>,
		keys: string[]
	): Promise<number> {
		let deleted = 0;
		for (const key of keys) {
			if (cache.delete(key)) deleted++;
		}
		return deleted;
	}

	it('should return count of actually deleted keys', async () => {
		const cache = new Map<string, string>();
		cache.set('key1', 'value1');
		cache.set('key3', 'value3');

		// key2 doesn't exist
		const deleted = await invalidateMany(cache, ['key1', 'key2', 'key3']);

		expect(deleted).toBe(2);
	});
});

describe('Prefix-based Invalidation', () => {
	function filterByPrefix(keys: string[], prefix: string): string[] {
		return keys.filter((k) => k.startsWith(prefix));
	}

	it('should filter keys matching prefix', () => {
		const keys = ['user:1:profile', 'user:1:settings', 'user:2:profile', 'workflow:123'];
		
		expect(filterByPrefix(keys, 'user:1:')).toEqual(['user:1:profile', 'user:1:settings']);
		expect(filterByPrefix(keys, 'workflow:')).toEqual(['workflow:123']);
		expect(filterByPrefix(keys, 'missing:')).toEqual([]);
	});
});
