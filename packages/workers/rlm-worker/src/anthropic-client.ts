/**
 * Anthropic API Client for Cloudflare Workers
 *
 * Lightweight client for Claude models
 * Optimized for code analysis with high accuracy
 */

export interface AnthropicRequest {
	model: string;
	max_tokens: number;
	messages: Array<{
		role: 'user' | 'assistant';
		content: string;
	}>;
	temperature?: number;
}

export interface AnthropicResponse {
	id: string;
	type: 'message';
	role: 'assistant';
	content: Array<{
		type: 'text';
		text: string;
	}>;
	model: string;
	stop_reason: string;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
}

/**
 * Call Anthropic API
 */
export async function callAnthropic(
	apiKey: string,
	model: string,
	prompt: string,
	options: {
		temperature?: number;
		maxOutputTokens?: number;
	} = {},
): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
	// Map model names to Anthropic API models
	const modelMap: Record<string, string> = {
		'claude-sonnet': 'claude-sonnet-4-20250514',
		'sonnet': 'claude-sonnet-4-20250514',
		'claude-opus': 'claude-opus-4-20250514',
		'opus': 'claude-opus-4-20250514',
		'claude-haiku': 'claude-3-5-haiku-20241022',
		'haiku': 'claude-3-5-haiku-20241022',
	};

	const anthropicModel = modelMap[model] || 'claude-sonnet-4-20250514';

	const requestBody: AnthropicRequest = {
		model: anthropicModel,
		max_tokens: options.maxOutputTokens ?? 8192,
		messages: [
			{
				role: 'user',
				content: prompt,
			},
		],
		temperature: options.temperature ?? 0.1,
	};

	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
		},
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Anthropic API error: ${response.status} - ${error}`);
	}

	const data = (await response.json()) as AnthropicResponse;

	if (!data.content || data.content.length === 0) {
		throw new Error('Anthropic returned no content');
	}

	const text = data.content.map((c) => c.text).join('');

	return {
		response: text,
		inputTokens: data.usage?.input_tokens || 0,
		outputTokens: data.usage?.output_tokens || 0,
	};
}

/**
 * Estimate cost for Anthropic API calls
 * Claude Sonnet 4: $3.00/$15.00 per 1M tokens (input/output)
 * Claude Opus 4: $15.00/$75.00 per 1M tokens (input/output)
 * Claude Haiku 3.5: $0.80/$4.00 per 1M tokens (input/output)
 */
export function estimateAnthropicCost(
	inputTokens: number,
	outputTokens: number,
	model: string,
): number {
	// Cost per 1M tokens
	const costs: Record<string, { input: number; output: number }> = {
		'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
		'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
		'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
	};

	const modelCosts = costs[model] || costs['claude-sonnet-4-20250514'];

	const inputCost = (inputTokens / 1_000_000) * modelCosts.input;
	const outputCost = (outputTokens / 1_000_000) * modelCosts.output;
	return inputCost + outputCost;
}
