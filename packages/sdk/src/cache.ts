/**
 * Cache Module
 *
 * Simple caching utilities that wrap Cloudflare KV.
 * Provides a clean API for workflow developers.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CacheOptions {
	/** Time to live in seconds */
	ttl?: number;
	/** Tags for bulk invalidation */
	tags?: string[];
}

export interface CacheEntry<T = any> {
	value: T;
	tags?: string[];
	expiresAt?: number;
}

// ============================================================================
// CACHE CLASS
// ============================================================================

/**
 * Cache wrapper for Cloudflare KV
 *
 * @example
 * ```typescript
 * const cache = createCache(env.CACHE)
 *
 * // Set with TTL
 * await cache.set('user:123', userData, { ttl: 3600 })
 *
 * // Get
 * const user = await cache.get('user:123')
 *
 * // Delete
 * await cache.delete('user:123')
 * ```
 */
export class Cache {
	private kv: KVNamespace;
	private prefix: string;

	constructor(kv: KVNamespace, prefix: string = '') {
		this.kv = kv;
		this.prefix = prefix;
	}

	/**
	 * Get a cached value
	 */
	async get<T = any>(key: string): Promise<T | null> {
		const fullKey = this.prefix + key;
		const entry = await this.kv.get<CacheEntry<T>>(fullKey, 'json');

		if (!entry) return null;

		// Check expiration (KV handles TTL, but we double-check for tags)
		if (entry.expiresAt && entry.expiresAt < Date.now()) {
			await this.delete(key);
			return null;
		}

		return entry.value;
	}

	/**
	 * Set a cached value
	 */
	async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
		const fullKey = this.prefix + key;
		const { ttl, tags } = options;

		const entry: CacheEntry<T> = {
			value,
			tags,
			expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
		};

		const kvOptions: KVNamespacePutOptions = {};
		if (ttl) {
			kvOptions.expirationTtl = ttl;
		}

		await this.kv.put(fullKey, JSON.stringify(entry), kvOptions);

		// Store tag mappings for bulk invalidation
		if (tags && tags.length > 0) {
			for (const tag of tags) {
				const tagKey = `__tag:${tag}`;
				const taggedKeys = await this.kv.get<string[]>(tagKey, 'json') || [];
				if (!taggedKeys.includes(fullKey)) {
					taggedKeys.push(fullKey);
					await this.kv.put(tagKey, JSON.stringify(taggedKeys));
				}
			}
		}
	}

	/**
	 * Delete a cached value
	 */
	async delete(key: string): Promise<void> {
		const fullKey = this.prefix + key;
		await this.kv.delete(fullKey);
	}

	/**
	 * Check if a key exists
	 */
	async has(key: string): Promise<boolean> {
		const value = await this.get(key);
		return value !== null;
	}

	/**
	 * Get or set pattern
	 */
	async getOrSet<T = any>(
		key: string,
		factory: () => Promise<T>,
		options: CacheOptions = {}
	): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		const value = await factory();
		await this.set(key, value, options);
		return value;
	}

	/**
	 * Invalidate all entries with a specific tag
	 */
	async invalidateByTag(tag: string): Promise<number> {
		const tagKey = `__tag:${tag}`;
		const taggedKeys = await this.kv.get<string[]>(tagKey, 'json') || [];

		let deleted = 0;
		for (const key of taggedKeys) {
			await this.kv.delete(key);
			deleted++;
		}

		await this.kv.delete(tagKey);
		return deleted;
	}

	/**
	 * Invalidate all entries with any of the specified tags
	 */
	async invalidateByTags(tags: string[]): Promise<number> {
		let deleted = 0;
		for (const tag of tags) {
			deleted += await this.invalidateByTag(tag);
		}
		return deleted;
	}
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a cache instance
 *
 * @param kv - Cloudflare KV namespace binding
 * @param prefix - Optional key prefix for namespacing
 */
export function createCache(kv: KVNamespace, prefix: string = ''): Cache {
	return new Cache(kv, prefix);
}

export default { Cache, createCache };
