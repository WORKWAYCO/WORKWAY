/**
 * Cloudflare-native RLM Worker
 *
 * Fully serverless RLM using Workers AI, Durable Objects, R2, and KV
 */

import { Env, RLMRequest, RLMResult } from './types';
import { RLMSession } from './session';

export { RLMSession };

/**
 * Generate cache key from request
 */
function getCacheKey(context: string, query: string): string {
	// Use first 100 chars of context + full query for cache key
	const contextPrefix = context.slice(0, 100);
	const combined = `${contextPrefix}:${query}`;

	// Simple hash function
	let hash = 0;
	for (let i = 0; i < combined.length; i++) {
		const char = combined.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	return `rlm:${Math.abs(hash).toString(36)}`;
}

/**
 * Store large context in R2
 */
async function storeContext(
	env: Env,
	context: string,
): Promise<string> {
	const contextId = crypto.randomUUID();
	const key = `contexts/${contextId}.txt`;

	await env.RLM_CONTEXT_STORAGE.put(key, context);

	return contextId;
}

/**
 * Retrieve context from R2
 */
async function getContext(env: Env, contextId: string): Promise<string> {
	const key = `contexts/${contextId}.txt`;
	const object = await env.RLM_CONTEXT_STORAGE.get(key);

	if (!object) {
		throw new Error(`Context ${contextId} not found in R2`);
	}

	return await object.text();
}

/**
 * Main worker handler
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Health check
		if (path === '/health') {
			return Response.json({ status: 'ok', service: 'rlm-worker' });
		}

		// Main RLM endpoint
		if (path === '/rlm' && request.method === 'POST') {
			try {
				const body = (await request.json()) as RLMRequest;

				// Validate request
				if (!body.query) {
					return Response.json({ error: 'Missing query' }, { status: 400 });
				}

				// Normalize context
				const context = Array.isArray(body.context)
					? body.context.join('\n\n')
					: body.context || '';

				const config = body.config || {};

				// Check cache if enabled
				if (config.useCache !== false) {
					const cacheKey = getCacheKey(context, body.query);
					const cached = await env.RLM_CACHE.get<RLMResult>(cacheKey, 'json');

					if (cached) {
						return Response.json({ ...cached, cacheHit: true });
					}
				}

				// For large contexts, store in R2
				let contextToUse = context;
				let storedContextId: string | null = null;

				if (context.length > 100000) {
					storedContextId = await storeContext(env, context);
					contextToUse = `R2:${storedContextId}`;
				}

				// Create Durable Object session
				const sessionIdStr = crypto.randomUUID();
				const sessionId = env.RLM_SESSIONS.idFromName(sessionIdStr);
				const session = env.RLM_SESSIONS.get(sessionId);

				// Initialize and execute via DO's fetch method
				const initRequest = new Request('http://internal/initialize', {
					method: 'POST',
					body: JSON.stringify({ context: contextToUse, query: body.query, config }),
				});
				await session.fetch(initRequest);

				const executeRequest = new Request('http://internal/execute', {
					method: 'POST',
				});
				await session.fetch(executeRequest);

				// Get result
				const resultRequest = new Request('http://internal/result');
				const resultResponse = await session.fetch(resultRequest);
				const result = await resultResponse.json();

				// Cache result if enabled
				if (config.useCache !== false && result.success) {
					const cacheKey = getCacheKey(context, body.query);
					await env.RLM_CACHE.put(cacheKey, JSON.stringify(result), {
						expirationTtl: 3600, // 1 hour cache
					});
				}

				return Response.json(result);
			} catch (error) {
				console.error('RLM execution error:', error);
				return Response.json(
					{
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					},
					{ status: 500 },
				);
			}
		}

		// Session status endpoint
		if (path.startsWith('/session/') && path.endsWith('/status')) {
			const sessionIdStr = path.split('/')[2];
			const sessionId = env.RLM_SESSIONS.idFromName(sessionIdStr);
			const session = env.RLM_SESSIONS.get(sessionId);

			const status = await session.getStatus();
			return Response.json(status);
		}

		// Session result endpoint
		if (path.startsWith('/session/') && path.endsWith('/result')) {
			const sessionIdStr = path.split('/')[2];
			const sessionId = env.RLM_SESSIONS.idFromName(sessionIdStr);
			const session = env.RLM_SESSIONS.get(sessionId);

			const result = await session.getResult();
			return Response.json(result);
		}

		return Response.json({ error: 'Not Found' }, { status: 404 });
	},
};
