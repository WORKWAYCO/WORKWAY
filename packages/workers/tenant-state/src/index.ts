/**
 * WORKWAY Tenant State Durable Object
 *
 * Provides per-tenant state isolation for:
 * - Rate limiting (noisy neighbor protection)
 * - Resource quotas
 * - Usage tracking
 *
 * Each tenant gets their own Durable Object instance, ensuring
 * complete isolation and consistent state across edge locations.
 *
 * @example
 * ```typescript
 * // In another worker
 * const tenantId = getTenantFromRequest(request);
 * const id = env.TENANT_STATE.idFromName(tenantId);
 * const tenant = env.TENANT_STATE.get(id);
 *
 * const { allowed, remaining } = await tenant.checkRateLimit('api', 1000);
 * if (!allowed) {
 *   return new Response('Rate limit exceeded', { status: 429 });
 * }
 * ```
 */

import { DurableObject } from 'cloudflare:workers';

// =============================================================================
// TYPES
// =============================================================================

export interface Env {
	TENANT_STATE: DurableObjectNamespace;
	TENANT_METADATA: KVNamespace;
	DEFAULT_RATE_LIMIT: string;
	DEFAULT_RATE_WINDOW_SECONDS: string;
}

interface RateLimitWindow {
	count: number;
	windowStart: number;
}

interface TenantUsage {
	requests: number;
	tokensUsed: number;
	lastActivity: number;
}

interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
	limit: number;
}

interface TenantQuota {
	tier: 'free' | 'pro' | 'enterprise';
	rateLimit: number;
	rateLimitWindow: number;
	maxTokensPerMonth: number;
}

// =============================================================================
// DEFAULT QUOTAS
// =============================================================================

const DEFAULT_QUOTAS: Record<string, TenantQuota> = {
	free: {
		tier: 'free',
		rateLimit: 100,
		rateLimitWindow: 60,
		maxTokensPerMonth: 10000,
	},
	pro: {
		tier: 'pro',
		rateLimit: 1000,
		rateLimitWindow: 60,
		maxTokensPerMonth: 100000,
	},
	enterprise: {
		tier: 'enterprise',
		rateLimit: 10000,
		rateLimitWindow: 60,
		maxTokensPerMonth: 1000000,
	},
};

// =============================================================================
// TENANT STATE DURABLE OBJECT
// =============================================================================

/**
 * Durable Object for per-tenant state management
 *
 * State is automatically persisted and consistent across
 * all edge locations.
 */
export class TenantState extends DurableObject {
	private rateLimits: Map<string, RateLimitWindow> = new Map();
	private usage: TenantUsage = {
		requests: 0,
		tokensUsed: 0,
		lastActivity: Date.now(),
	};
	private quota: TenantQuota = DEFAULT_QUOTAS.free;
	private initialized = false;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	/**
	 * Initialize state from storage
	 */
	private async init(): Promise<void> {
		if (this.initialized) return;

		// Load persisted state
		const [usage, quota, rateLimits] = await Promise.all([
			this.ctx.storage.get<TenantUsage>('usage'),
			this.ctx.storage.get<TenantQuota>('quota'),
			this.ctx.storage.get<Array<[string, RateLimitWindow]>>('rateLimits'),
		]);

		if (usage) this.usage = usage;
		if (quota) this.quota = quota;
		if (rateLimits) this.rateLimits = new Map(rateLimits);

		this.initialized = true;
	}

	/**
	 * Save state to storage
	 */
	private async persist(): Promise<void> {
		await this.ctx.storage.put({
			usage: this.usage,
			quota: this.quota,
			rateLimits: Array.from(this.rateLimits.entries()),
		});
	}

	/**
	 * Check rate limit for a specific key (e.g., 'api', 'ai')
	 *
	 * Uses sliding window algorithm with per-key tracking.
	 */
	async checkRateLimit(
		key: string,
		customLimit?: number
	): Promise<RateLimitResult> {
		await this.init();

		const limit = customLimit ?? this.quota.rateLimit;
		const windowMs = this.quota.rateLimitWindow * 1000;
		const now = Date.now();

		// Get or create window for this key
		let window = this.rateLimits.get(key);
		if (!window || now - window.windowStart >= windowMs) {
			window = { count: 0, windowStart: now };
		}

		// Increment count
		window.count++;
		this.rateLimits.set(key, window);

		// Update usage
		this.usage.requests++;
		this.usage.lastActivity = now;

		// Persist asynchronously (don't block response)
		this.ctx.waitUntil(this.persist());

		return {
			allowed: window.count <= limit,
			remaining: Math.max(0, limit - window.count),
			resetAt: window.windowStart + windowMs,
			limit,
		};
	}

	/**
	 * Record token usage (for AI operations)
	 */
	async recordTokens(tokens: number): Promise<void> {
		await this.init();

		this.usage.tokensUsed += tokens;
		this.usage.lastActivity = Date.now();

		await this.persist();
	}

	/**
	 * Get current usage stats
	 */
	async getUsage(): Promise<TenantUsage> {
		await this.init();
		return { ...this.usage };
	}

	/**
	 * Get current quota
	 */
	async getQuota(): Promise<TenantQuota> {
		await this.init();
		return { ...this.quota };
	}

	/**
	 * Update tenant quota (tier change)
	 */
	async setQuota(tier: 'free' | 'pro' | 'enterprise'): Promise<void> {
		await this.init();

		this.quota = DEFAULT_QUOTAS[tier] ?? DEFAULT_QUOTAS.free;
		await this.persist();
	}

	/**
	 * Reset usage (e.g., at start of billing period)
	 */
	async resetUsage(): Promise<void> {
		await this.init();

		this.usage = {
			requests: 0,
			tokensUsed: 0,
			lastActivity: Date.now(),
		};

		await this.persist();
	}

	/**
	 * Handle HTTP requests to this Durable Object
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			// POST /rate-limit/:key
			if (request.method === 'POST' && path.startsWith('/rate-limit/')) {
				const key = path.slice('/rate-limit/'.length);
				const body = await request.json().catch(() => ({})) as { limit?: number };
				const result = await this.checkRateLimit(key, body.limit);
				return Response.json(result);
			}

			// POST /tokens
			if (request.method === 'POST' && path === '/tokens') {
				const body = await request.json() as { tokens: number };
				await this.recordTokens(body.tokens);
				return Response.json({ success: true });
			}

			// GET /usage
			if (request.method === 'GET' && path === '/usage') {
				const usage = await this.getUsage();
				return Response.json(usage);
			}

			// GET /quota
			if (request.method === 'GET' && path === '/quota') {
				const quota = await this.getQuota();
				return Response.json(quota);
			}

			// PUT /quota
			if (request.method === 'PUT' && path === '/quota') {
				const body = await request.json() as { tier: 'free' | 'pro' | 'enterprise' };
				await this.setQuota(body.tier);
				return Response.json({ success: true });
			}

			// POST /reset
			if (request.method === 'POST' && path === '/reset') {
				await this.resetUsage();
				return Response.json({ success: true });
			}

			return Response.json({ error: 'Not found' }, { status: 404 });
		} catch (error) {
			console.error('TenantState error:', error);
			return Response.json(
				{ error: error instanceof Error ? error.message : 'Internal error' },
				{ status: 500 }
			);
		}
	}
}

// =============================================================================
// WORKER ENTRY POINT
// =============================================================================

export default {
	/**
	 * Route requests to the appropriate tenant's Durable Object
	 */
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Extract tenant ID from path: /tenant/:id/...
		const match = url.pathname.match(/^\/tenant\/([^/]+)(\/.*)?$/);
		if (!match) {
			return Response.json(
				{ error: 'Invalid path. Use /tenant/:tenantId/...' },
				{ status: 400 }
			);
		}

		const tenantId = match[1];
		const subPath = match[2] || '/';

		// Get the Durable Object for this tenant
		const id = env.TENANT_STATE.idFromName(tenantId);
		const stub = env.TENANT_STATE.get(id);

		// Forward the request to the Durable Object
		const doUrl = new URL(subPath, url.origin);
		const doRequest = new Request(doUrl, request);

		return stub.fetch(doRequest);
	},
};
