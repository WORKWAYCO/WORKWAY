/**
 * Cloudflare-native RLM Types
 *
 * Built on Cloudflare Workers AI, Durable Objects, R2, and KV
 */

export interface Env {
	AI: Ai;
	RLM_SESSIONS: DurableObjectNamespace;
	RLM_CONTEXT_STORAGE: R2Bucket;
	RLM_CACHE: KVNamespace;
	RLM_ANALYTICS: AnalyticsEngineDataset;
	MAX_ITERATIONS: string;
	MAX_SUB_CALLS: string;
	CONTEXT_CHUNK_SIZE: string;
	GOOGLE_API_KEY?: string; // Gemini API key
}

export interface RLMRequest {
	context: string | string[];
	query: string;
	config?: RLMConfig;
}

export interface RLMConfig {
	rootModel?: 'claude' | 'llama-3.1-8b' | 'llama-3.1-70b' | 'gemini-flash' | 'gemini-pro';
	subModel?: 'claude' | 'llama-3.1-8b' | 'llama-3.1-70b' | 'gemini-flash' | 'gemini-pro';
	maxIterations?: number;
	maxSubCalls?: number;
	chunkSize?: number;
	useCache?: boolean;
	provider?: 'workers-ai' | 'gemini'; // Which LLM provider to use
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
	trajectory?: RLMIteration[];
}

export interface RLMIteration {
	iteration: number;
	type: 'root' | 'sub';
	model: string;
	prompt: string;
	response: string;
	inputTokens: number;
	outputTokens: number;
	durationMs: number;
	chunkIndex?: number;
}

export interface RLMSessionState {
	sessionId: string;
	context: string;
	query: string;
	config: RLMConfig;
	iterations: RLMIteration[];
	subCalls: number;
	startTime: number;
	status: 'running' | 'completed' | 'failed';
	result?: string;
	error?: string;
}

export interface ChunkResult {
	chunkIndex: number;
	content: string;
	analysis: string;
}

export interface SubCallRequest {
	chunkIndex: number;
	content: string;
	query: string;
	model: string;
}
