/**
 * Cloudflare RLM Client
 *
 * Replaces Python subprocess with direct HTTP calls to Cloudflare Worker
 */

export interface RLMConfig {
	rootModel?: 'claude' | 'llama-3.1-8b' | 'llama-3.1-70b';
	subModel?: 'claude' | 'llama-3.1-8b' | 'llama-3.1-70b';
	maxIterations?: number;
	maxSubCalls?: number;
	chunkSize?: number;
	useCache?: boolean;
}

export interface RLMResult {
	success: boolean;
	answer: string | null;
	iterations: number;
	subCalls: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	costUsd: number;
	durationMs: number;
	cacheHit?: boolean;
	error?: string;
	trajectory?: Array<{
		iteration: number;
		type: 'root' | 'sub';
		model: string;
		inputTokens: number;
		outputTokens: number;
		durationMs: number;
	}>;
}

/**
 * Cloudflare RLM Client
 *
 * Calls the RLM Cloudflare Worker instead of spawning Python subprocess
 */
export class CloudflareRLMClient {
	private workerUrl: string;

	constructor(workerUrl: string = 'https://rlm-worker.workway.workers.dev') {
		this.workerUrl = workerUrl;
	}

	/**
	 * Run RLM analysis using Cloudflare Workers
	 *
	 * @param context - Document(s) to analyze
	 * @param query - Question to answer
	 * @param config - RLM configuration
	 */
	async run(
		context: string | string[],
		query: string,
		config?: RLMConfig,
	): Promise<RLMResult> {
		const startTime = Date.now();

		try {
			const response = await fetch(`${this.workerUrl}/rlm`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					context,
					query,
					config: config || {},
				}),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`RLM Worker failed: ${error}`);
			}

			const result = (await response.json()) as RLMResult;

			// Add client-side duration if missing
			if (!result.durationMs) {
				result.durationMs = Date.now() - startTime;
			}

			return result;
		} catch (error) {
			return {
				success: false,
				answer: null,
				iterations: 0,
				subCalls: 0,
				totalInputTokens: 0,
				totalOutputTokens: 0,
				costUsd: 0,
				durationMs: Date.now() - startTime,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Check if the RLM worker is healthy
	 */
	async health(): Promise<boolean> {
		try {
			const response = await fetch(`${this.workerUrl}/health`);
			return response.ok;
		} catch {
			return false;
		}
	}
}

/**
 * Run RLM analysis (convenience function)
 */
export async function runRLM(
	context: string | string[],
	query: string,
	config?: RLMConfig,
): Promise<RLMResult> {
	const client = new CloudflareRLMClient();
	return client.run(context, query, config);
}

/**
 * Check if RLM is available
 */
export async function checkCloudflareRLM(): Promise<boolean> {
	const client = new CloudflareRLMClient();
	return client.health();
}
