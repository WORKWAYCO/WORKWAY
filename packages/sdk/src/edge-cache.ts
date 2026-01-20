/**
 * Edge Cache Module
 *
 * Uses Cloudflare's Cache API for HTTP-level caching at the edge.
 * Unlike KV cache, this is optimized for high-read, low-write scenarios
 * and doesn't count against KV operations limits.
 *
 * Best for:
 * - API response caching
 * - Computed data that's expensive to generate
 * - Data that's read frequently but updated rarely
 *
 * @example
 * ```typescript
 * const cache = new EdgeCache('workflow-metadata');
 *
 * // Get or set pattern
 * const workflow = await cache.getOrSet(
 *   `workflow:${id}`,
 *   () => fetchWorkflowFromDB(id),
 *   { ttlSeconds: 300 }
 * );
 *
 * // Invalidate on update
 * await cache.invalidate(`workflow:${id}`);
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EdgeCacheOptions {
	/** Time to live in seconds (default: 3600 = 1 hour) */
	ttlSeconds?: number;
	/** Whether to serve stale content while revalidating (default: false) */
	staleWhileRevalidate?: number;
	/** Tags for bulk invalidation tracking (stored in metadata) */
	tags?: string[];
}

export interface EdgeCacheMetadata {
	cachedAt: number;
	ttlSeconds: number;
	tags?: string[];
}

// ============================================================================
// EDGE CACHE CLASS
// ============================================================================

/**
 * Edge Cache wrapper for Cloudflare Cache API
 *
 * Uses a virtual URL namespace to store cached data at the edge.
 * This provides CDN-level caching without external dependencies.
 */
export class EdgeCache {
	private cache!: Cache; // Lazy initialized via getCache()
	private namespace: string;
	private _cacheInitialized = false;

	/**
	 * Create an edge cache instance
	 * @param namespace - Namespace for cache keys (e.g., 'workflow-metadata')
	 */
	constructor(namespace: string = 'default') {
		this.namespace = namespace;
		// Lazy initialization - only access caches when actually used
		// This allows the SDK to be imported in Node.js without errors
	}

	/**
	 * Get the cache instance (lazy initialization for Workers runtime)
	 */
	private getCache(): Cache {
		if (!this._cacheInitialized) {
			if (typeof caches === 'undefined') {
				throw new Error('EdgeCache requires Cloudflare Workers runtime (caches API not available)');
			}
			this.cache = caches.default;
			this._cacheInitialized = true;
		}
		return this.cache;
	}

	/**
	 * Generate a cache key URL
	 */
	private getCacheKey(key: string): Request {
		// Use a virtual URL that won't conflict with real routes
		return new Request(`https://cache.workway.internal/${this.namespace}/${key}`);
	}

	/**
	 * Get a cached value
	 *
	 * @example
	 * ```typescript
	 * const workflow = await cache.get<Workflow>('workflow:123');
	 * if (workflow) {
	 *   return workflow;
	 * }
	 * ```
	 */
	async get<T>(key: string): Promise<T | null> {
		const cacheKey = this.getCacheKey(key);
		const response = await this.getCache().match(cacheKey);

		if (!response) {
			return null;
		}

		try {
			return await response.json() as T;
		} catch {
			// Invalid JSON, treat as cache miss
			await this.invalidate(key);
			return null;
		}
	}

	/**
	 * Set a cached value
	 *
	 * @example
	 * ```typescript
	 * await cache.set('workflow:123', workflowData, { ttlSeconds: 300 });
	 * ```
	 */
	async set<T>(key: string, value: T, options: EdgeCacheOptions = {}): Promise<void> {
		const { ttlSeconds = 3600, staleWhileRevalidate, tags } = options;

		const cacheKey = this.getCacheKey(key);

		// Build Cache-Control header
		const cacheControlParts = [`s-maxage=${ttlSeconds}`];
		if (staleWhileRevalidate) {
			cacheControlParts.push(`stale-while-revalidate=${staleWhileRevalidate}`);
		}

		// Store metadata in a custom header
		const metadata: EdgeCacheMetadata = {
			cachedAt: Date.now(),
			ttlSeconds,
			tags,
		};

		const response = new Response(JSON.stringify(value), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': cacheControlParts.join(', '),
				'X-Cache-Metadata': JSON.stringify(metadata),
			},
		});

		await this.getCache().put(cacheKey, response);
	}

	/**
	 * Invalidate a cached value
	 *
	 * @example
	 * ```typescript
	 * // After updating a workflow
	 * await cache.invalidate('workflow:123');
	 * ```
	 */
	async invalidate(key: string): Promise<boolean> {
		const cacheKey = this.getCacheKey(key);
		return this.getCache().delete(cacheKey);
	}

	/**
	 * Get or set pattern - fetch from cache or compute and cache
	 *
	 * This is the recommended pattern for most use cases.
	 *
	 * @example
	 * ```typescript
	 * const workflow = await cache.getOrSet(
	 *   `workflow:${id}`,
	 *   async () => {
	 *     const result = await db.query('SELECT * FROM workflows WHERE id = ?', [id]);
	 *     return result;
	 *   },
	 *   { ttlSeconds: 300 }
	 * );
	 * ```
	 */
	async getOrSet<T>(
		key: string,
		factory: () => Promise<T>,
		options: EdgeCacheOptions = {}
	): Promise<T> {
		// Try cache first
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		// Compute value
		const value = await factory();

		// Cache for next time
		await this.set(key, value, options);

		return value;
	}

	/**
	 * Check if a key is cached
	 */
	async has(key: string): Promise<boolean> {
		const cacheKey = this.getCacheKey(key);
		const response = await this.getCache().match(cacheKey);
		return response !== undefined;
	}

	/**
	 * Get cache metadata for a key
	 */
	async getMetadata(key: string): Promise<EdgeCacheMetadata | null> {
		const cacheKey = this.getCacheKey(key);
		const response = await this.getCache().match(cacheKey);

		if (!response) {
			return null;
		}

		const metadataHeader = response.headers.get('X-Cache-Metadata');
		if (!metadataHeader) {
			return null;
		}

		try {
			return JSON.parse(metadataHeader) as EdgeCacheMetadata;
		} catch {
			return null;
		}
	}

	/**
	 * Invalidate multiple keys at once
	 *
	 * @example
	 * ```typescript
	 * await cache.invalidateMany(['workflow:1', 'workflow:2', 'workflow:3']);
	 * ```
	 */
	async invalidateMany(keys: string[]): Promise<number> {
		let deleted = 0;
		for (const key of keys) {
			const wasDeleted = await this.invalidate(key);
			if (wasDeleted) deleted++;
		}
		return deleted;
	}

	/**
	 * Invalidate all keys matching a prefix
	 *
	 * Note: This requires tracking keys externally since Cache API
	 * doesn't support listing. Consider using KV for key tracking
	 * if you need pattern-based invalidation.
	 */
	async invalidatePrefix(prefix: string, knownKeys: string[]): Promise<number> {
		const matchingKeys = knownKeys.filter(k => k.startsWith(prefix));
		return this.invalidateMany(matchingKeys);
	}
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an edge cache instance
 *
 * @param namespace - Namespace for cache keys
 * @example
 * ```typescript
 * const workflowCache = createEdgeCache('workflows');
 * const integrationCache = createEdgeCache('integrations');
 * ```
 */
export function createEdgeCache(namespace: string = 'default'): EdgeCache {
	return new EdgeCache(namespace);
}

// ============================================================================
// COMMON CACHE NAMESPACES
// ============================================================================

/**
 * Pre-configured cache instances for common use cases
 */
export const edgeCaches = {
	/** Workflow metadata cache (TTL: 5 min) */
	workflows: new EdgeCache('workflows'),
	/** Integration config cache (TTL: 10 min) */
	integrations: new EdgeCache('integrations'),
	/** User preferences cache (TTL: 15 min) */
	users: new EdgeCache('users'),
	/** API response cache (TTL: 1 min) */
	api: new EdgeCache('api'),
};

export default { EdgeCache, createEdgeCache, edgeCaches };
