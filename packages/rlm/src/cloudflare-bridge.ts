/**
 * Cloudflare RLM Bridge
 *
 * TypeScript client for Cloudflare-native RLM Worker
 * Uses Workers AI, Durable Objects, R2, and KV
 */

import type { RLMConfig, RLMResult } from './types.js';

export interface CloudflareRLMConfig extends RLMConfig {
	/** Cloudflare RLM Worker URL */
	workerUrl?: string;
	/** Use KV cache (default: true) */
	useCache?: boolean;
	/** Chunk size for large contexts (default: 50000) */
	chunkSize?: number;
}

/**
 * Run RLM using Cloudflare Workers backend
 *
 * @param context - Input context (string or array of strings)
 * @param query - Query to answer
 * @param config - Configuration options
 * @returns RLM result with answer, iterations, cost, etc.
 *
 * @example
 * ```typescript
 * const result = await runCloudflareRLM(
 *   documents,
 *   'What are the main DRY violations?',
 *   {
 *     rootModel: 'llama-3.1-70b',
 *     subModel: 'llama-3.1-8b',
 *     workerUrl: 'https://rlm-worker.workway.workers.dev',
 *   }
 * );
 * ```
 */
export async function runCloudflareRLM(
	context: string | string[],
	query: string,
	config: CloudflareRLMConfig = {},
): Promise<RLMResult> {
	const workerUrl =
		config.workerUrl ||
		process.env.RLM_WORKER_URL ||
		'https://rlm-worker.workway.workers.dev';

	// Normalize context
	const contextString = Array.isArray(context) ? context.join('\n\n') : context;

	// Prepare request
	const requestBody = {
		context: contextString,
		query,
		config: {
			rootModel: config.rootModel || 'gemini-pro',
			subModel: config.subModel || 'gemini-flash',
			provider: 'gemini', // Use Gemini for code-specific analysis
			maxIterations: config.maxIterations || 20,
			maxSubCalls: config.maxSubCalls || 100,
			chunkSize: config.chunkSize || 50000,
			useCache: config.useCache !== false,
		},
	};

	// Call Cloudflare Worker
	const response = await fetch(`${workerUrl}/rlm`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: 'Unknown error' }));
		throw new Error(`Cloudflare RLM failed: ${error.error || response.statusText}`);
	}

	const result = await response.json();

	// Convert to standard RLMResult format
	return {
		success: result.success,
		answer: result.answer,
		iterations: result.iterations?.length || 0,
		subCalls: result.subCalls || 0,
		totalInputTokens: result.iterations?.reduce((sum: number, iter: any) => sum + iter.inputTokens, 0) || 0,
		totalOutputTokens: result.iterations?.reduce((sum: number, iter: any) => sum + iter.outputTokens, 0) || 0,
		costUsd: result.costUsd || 0,
		trajectory: result.iterations || [],
		error: result.error || null,
	};
}

/**
 * Check if Cloudflare RLM Worker is available
 */
export async function checkCloudflareRLM(workerUrl?: string): Promise<boolean> {
	const url = workerUrl || process.env.RLM_WORKER_URL || 'https://rlm-worker.workway.workers.dev';

	try {
		const response = await fetch(`${url}/health`);
		const data = await response.json();
		return data.status === 'ok';
	} catch {
		return false;
	}
}
