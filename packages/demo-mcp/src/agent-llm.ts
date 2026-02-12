/**
 * Optional LLM step: use gpt-oss-120b to generate the agent message from the user
 * question and tool result. Fall back to template message on failure or if AI unavailable.
 */

const MODEL = '@cf/openai/gpt-oss-120b';
const DATA_MAX_CHARS = 1500;

function serializeData(data: unknown): string {
	if (data == null) return 'No data';
	try {
		const s = JSON.stringify(data);
		return s.length > DATA_MAX_CHARS ? s.slice(0, DATA_MAX_CHARS) + '...' : s;
	} catch {
		return String(data);
	}
}

/** Extract reply text from Workers AI response (model-dependent shape). */
function extractText(response: unknown): string | null {
	if (typeof response === 'string') return response.trim() || null;
	if (response && typeof response === 'object') {
		const r = response as Record<string, unknown>;
		if (typeof r.response === 'string') return r.response.trim() || null;
		if (typeof r.result === 'string') return r.result.trim() || null;
		if (r.choices && Array.isArray(r.choices) && r.choices[0]) {
			const choice = r.choices[0] as Record<string, unknown>;
			if (choice.message && typeof (choice.message as Record<string, unknown>).content === 'string') {
				return ((choice.message as Record<string, unknown>).content as string).trim() || null;
			}
			if (typeof choice.text === 'string') return choice.text.trim() || null;
		}
	}
	return null;
}

export interface GenerateAgentMessageEnv {
	AI: { run: (model: string, options: Record<string, unknown>) => Promise<unknown> };
}

/**
 * Call gpt-oss-120b to answer the user's question using the tool result.
 * Returns the model's reply or null (use fallback in that case).
 */
export async function generateAgentMessage(
	env: GenerateAgentMessageEnv,
	userMessage: string,
	toolName: string,
	toolResult: { success: boolean; data?: unknown; error?: string },
	fallbackMessage: string
): Promise<string | null> {
	if (!env.AI?.run) return null;
	if (!toolResult.success) return null;

	const dataBlob = serializeData(toolResult.data);
	const input = `User asked: "${userMessage}"

Tool used: ${toolName}
Result data: ${dataBlob}

Reply in 1-3 short sentences as a construction project assistant. Answer the user's question using only the data above. No preamble or "Based on...".`;

	try {
		const response = await env.AI.run(MODEL, {
			instructions: 'You are a concise construction project assistant. Answer only from the given data.',
			input,
			reasoning: { effort: 'low', summary: 'concise' },
		} as Record<string, unknown>);
		const text = extractText(response);
		return text && text.length > 0 ? text : null;
	} catch {
		return null;
	}
}
