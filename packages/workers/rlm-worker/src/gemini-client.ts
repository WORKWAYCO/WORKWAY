/**
 * Gemini API Client for Cloudflare Workers
 *
 * Lightweight client for Google Gemini 2.5 models
 * Optimized for code analysis and reasoning
 */

export interface GeminiRequest {
	contents: Array<{
		role?: 'user' | 'model';
		parts: Array<{ text: string }>;
	}>;
	generationConfig?: {
		temperature?: number;
		maxOutputTokens?: number;
		topP?: number;
		topK?: number;
	};
}

export interface GeminiResponse {
	candidates: Array<{
		content: {
			parts: Array<{ text: string }>;
			role: string;
		};
		finishReason: string;
		safetyRatings: Array<{
			category: string;
			probability: string;
		}>;
	}>;
	usageMetadata: {
		promptTokenCount: number;
		candidatesTokenCount: number;
		totalTokenCount: number;
	};
}

/**
 * Call Gemini API
 */
export async function callGemini(
	apiKey: string,
	model: string,
	prompt: string,
	options: {
		temperature?: number;
		maxOutputTokens?: number;
	} = {},
): Promise<{ response: string; inputTokens: number; outputTokens: number }> {
	// Map model names to Gemini API v1beta models
	// Use -latest suffix for stable access to current generation
	const modelMap: Record<string, string> = {
		'gemini-flash': 'gemini-flash-latest',
		'gemini-pro': 'gemini-pro-latest',
		'flash': 'gemini-flash-latest',
		'pro': 'gemini-pro-latest',
		'gemini-2.5-flash': 'gemini-2.5-flash',
		'gemini-2.5-pro': 'gemini-2.5-pro',
	};

	const geminiModel = modelMap[model] || 'gemini-flash-latest';

	const requestBody: GeminiRequest = {
		contents: [
			{
				parts: [{ text: prompt }],
			},
		],
		generationConfig: {
			temperature: options.temperature ?? 0.1,
			maxOutputTokens: options.maxOutputTokens ?? 8192,
		},
	};

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
		},
	);

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Gemini API error: ${response.status} - ${error}`);
	}

	const data = (await response.json()) as GeminiResponse;

	if (!data.candidates || data.candidates.length === 0) {
		throw new Error('Gemini returned no candidates');
	}

	const text = data.candidates[0].content.parts.map((p) => p.text).join('');

	return {
		response: text,
		inputTokens: data.usageMetadata?.promptTokenCount || 0,
		outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
	};
}

/**
 * Estimate cost for Gemini API calls
 * Gemini 2.0 Flash: $0.15/$0.60 per 1M tokens (input/output)
 * Gemini 2.0 Flash Thinking: $0.15/$0.60 per 1M tokens
 */
export function estimateGeminiCost(inputTokens: number, outputTokens: number): number {
	const inputCost = (inputTokens / 1_000_000) * 0.15;
	const outputCost = (outputTokens / 1_000_000) * 0.6;
	return inputCost + outputCost;
}
