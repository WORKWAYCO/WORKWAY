/**
 * Cloudflare-native RLM Engine
 *
 * Recursive Language Model implementation using Workers AI, Gemini, or Anthropic
 */

import { Env, RLMConfig, RLMIteration, ChunkResult, SubCallRequest } from './types';
import { callGemini, estimateGeminiCost } from './gemini-client';
import { callAnthropic, estimateAnthropicCost } from './anthropic-client';

/**
 * Chunk large context into manageable pieces
 */
export function chunkContext(context: string, chunkSize: number): string[] {
	const chunks: string[] = [];
	let start = 0;

	while (start < context.length) {
		chunks.push(context.slice(start, start + chunkSize));
		start += chunkSize;
	}

	return chunks;
}

/**
 * Call LLM (Workers AI, Gemini, or Anthropic) with a prompt
 */
export async function callLLM(
	env: Env,
	model: string,
	prompt: string,
	provider: 'workers-ai' | 'gemini' | 'anthropic' = 'workers-ai',
): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
	if (provider === 'gemini') {
		if (!env.GOOGLE_API_KEY) {
			throw new Error('GOOGLE_API_KEY not configured for Gemini');
		}
		return await callGemini(env.GOOGLE_API_KEY, model, prompt);
	}

	if (provider === 'anthropic') {
		if (!env.ANTHROPIC_API_KEY) {
			throw new Error('ANTHROPIC_API_KEY not configured for Anthropic');
		}
		return await callAnthropic(env.ANTHROPIC_API_KEY, model, prompt);
	}

	// Workers AI fallback
	const modelMap: Record<string, string> = {
		claude: '@cf/meta/llama-3.1-8b-instruct',
		'llama-3.1-8b': '@cf/meta/llama-3.1-8b-instruct',
		'llama-3.1-70b': '@cf/meta/llama-3.1-70b-instruct',
	};

	const aiModel = modelMap[model] || modelMap['llama-3.1-8b'];

	try {
		const response = await env.AI.run(aiModel, {
			messages: [{ role: 'user', content: prompt }],
			stream: false,
		});

		const text = response.response || '';
		const inputTokens = Math.ceil(prompt.length / 4);
		const outputTokens = Math.ceil(text.length / 4);

		return {
			response: text,
			inputTokens,
			outputTokens,
		};
	} catch (error) {
		throw new Error(`Workers AI call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Process a single chunk with sub-model
 */
export async function processChunk(
	env: Env,
	request: SubCallRequest,
	provider: 'workers-ai' | 'gemini' | 'anthropic' = 'workers-ai',
): Promise<ChunkResult> {
	const prompt = `Analyze this code chunk and answer the query.

Chunk ${request.chunkIndex + 1}:
${request.content}

Query: ${request.query}

Provide a concise analysis focusing on relevant information for the query.`;

	const result = await callLLM(env, request.model, prompt, provider);

	return {
		chunkIndex: request.chunkIndex,
		content: request.content,
		analysis: result.response,
	};
}

/**
 * Synthesize chunk results with root model
 */
export async function synthesizeResults(
	env: Env,
	query: string,
	chunkResults: ChunkResult[],
	rootModel: string,
	provider: 'workers-ai' | 'gemini' | 'anthropic' = 'workers-ai',
): Promise<string> {
	// Build synthesis prompt
	let prompt = `You are synthesizing code analysis from ${chunkResults.length} chunks.

Original Query: ${query}

Chunk Analyses:\n\n`;

	for (const result of chunkResults) {
		prompt += `--- Chunk ${result.chunkIndex + 1} ---\n`;
		prompt += `${result.analysis}\n\n`;
	}

	prompt += `\nBased on ALL chunk analyses above, provide a comprehensive answer to the query.
Output your final answer in this format:

FINAL_ANSWER: [your answer here]`;

	const aiResult = await callLLM(env, rootModel, prompt, provider);

	// Extract FINAL_ANSWER
	const match = aiResult.response.match(/FINAL_ANSWER:\s*(.+)/s);
	if (match) {
		return match[1].trim();
	}

	return aiResult.response;
}

/**
 * Execute RLM process with recursive decomposition
 */
export async function executeRLM(
	env: Env,
	context: string,
	query: string,
	config: RLMConfig,
	iterations: RLMIteration[],
): Promise<{ answer: string; iterations: RLMIteration[]; subCalls: number }> {
	const rootModel = config.rootModel || 'gemini-pro';
	const subModel = config.subModel || 'gemini-flash';
	const chunkSize = config.chunkSize || 50000;
	const maxSubCalls = config.maxSubCalls || 100;
	const provider = config.provider || 'gemini';

	// Check if context needs chunking
	if (context.length <= chunkSize) {
		// Small context - process directly with root model
		const startTime = Date.now();
		const result = await callLLM(env, rootModel, `${context}\n\nQuery: ${query}`, provider);

		iterations.push({
			iteration: iterations.length + 1,
			type: 'root',
			model: rootModel,
			prompt: `Context + Query (${context.length} chars)`,
			response: result.response,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
			durationMs: Date.now() - startTime,
		});

		return {
			answer: result.response,
			iterations,
			subCalls: 0,
		};
	}

	// Large context - chunk and process recursively
	const chunks = chunkContext(context, chunkSize);
	const subCalls = Math.min(chunks.length, maxSubCalls);

	// Process chunks in parallel with sub-model
	const chunkPromises = chunks.slice(0, subCalls).map((chunk, index) =>
		processChunk(
			env,
			{
				chunkIndex: index,
				content: chunk,
				query,
				model: subModel,
			},
			provider,
		),
	);

	const startTime = Date.now();
	const chunkResults = await Promise.all(chunkPromises);

	// Record sub-call iterations
	for (let i = 0; i < chunkResults.length; i++) {
		iterations.push({
			iteration: iterations.length + 1,
			type: 'sub',
			model: subModel,
			prompt: `Chunk ${i + 1}/${chunks.length}`,
			response: chunkResults[i].analysis,
			inputTokens: Math.ceil(chunkResults[i].content.length / 4),
			outputTokens: Math.ceil(chunkResults[i].analysis.length / 4),
			durationMs: Date.now() - startTime,
			chunkIndex: i,
		});
	}

	// Synthesize with root model
	const synthStartTime = Date.now();
	const finalAnswer = await synthesizeResults(env, query, chunkResults, rootModel, provider);

	iterations.push({
		iteration: iterations.length + 1,
		type: 'root',
		model: rootModel,
		prompt: `Synthesis of ${chunkResults.length} chunks`,
		response: finalAnswer,
		inputTokens: chunkResults.reduce((sum, r) => sum + Math.ceil(r.analysis.length / 4), 0),
		outputTokens: Math.ceil(finalAnswer.length / 4),
		durationMs: Date.now() - synthStartTime,
	});

	return {
		answer: finalAnswer,
		iterations,
		subCalls: chunkResults.length,
	};
}

/**
 * Estimate cost based on token usage
 * Anthropic: $3/$15 per 1M tokens (Sonnet), $15/$75 (Opus), $0.80/$4 (Haiku)
 * Gemini 2.0: $0.15/$0.60 per 1M tokens (input/output)
 * Workers AI: Free for up to 10k neurons/day, then $0.011 per 1k neurons
 */
export function estimateCost(
	iterations: RLMIteration[],
	provider: 'workers-ai' | 'gemini' | 'anthropic' = 'gemini',
	model?: string,
): number {
	const totalInputTokens = iterations.reduce((sum, iter) => sum + iter.inputTokens, 0);
	const totalOutputTokens = iterations.reduce((sum, iter) => sum + iter.outputTokens, 0);

	if (provider === 'anthropic') {
		return estimateAnthropicCost(totalInputTokens, totalOutputTokens, model || 'claude-sonnet-4-20250514');
	}

	if (provider === 'gemini') {
		return estimateGeminiCost(totalInputTokens, totalOutputTokens);
	}

	// Workers AI fallback
	const totalTokens = totalInputTokens + totalOutputTokens;
	const billableNeurons = Math.max(0, totalTokens - 10000);
	return (billableNeurons / 1000) * 0.011;
}
