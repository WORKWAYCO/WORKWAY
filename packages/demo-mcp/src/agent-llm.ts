/**
 * Optional LLM steps for the demo agent:
 * 1. selectToolWithLLM – choose which tool (and arguments) to call from the user message.
 * 2. generateAgentMessage – answer the user using the tool result.
 * Fall back to heuristic/template when AI is unavailable or the call fails.
 */

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DATA_MAX_CHARS = 2000;

const TOOL_SELECTION_INSTRUCTIONS = `You are a construction project assistant. You have access to these tools. Choose ONE tool that best answers the user's question. Reply with JSON only, no other text: {"tool": "<name>", "arguments": {...}}.

Project IDs: P-001 = Main Street Tower, P-002 = Harbor View Condos, P-003 = Tech Campus Phase 2. If the user says "our" or doesn't specify a project, use P-001.

Tools:
- list_projects: No arguments. Use for questions about project portfolio, including "what projects", "list projects", "how many projects", and "who's working on the projects". Team assignments are part of the result.
- list_rfis: arguments: project_id (required), status (optional: "overdue"|"open"|"closed"|"all"). Use for RFIs, overdue items, and assignee-related RFI questions.
- get_rfi: arguments: project_id, rfi_id (e.g. "2847" or "RFI-2847"). Use when asking about a specific RFI.
- list_submittals: arguments: project_id (optional), status (optional: "pending_review"|"approved"|"all"). Use for submittals, "tell me about our submittals", and reviewer questions when submittals were just discussed (data includes reviewer).
- get_submittal: arguments: project_id, submittal_id (e.g. "1247" or "SUB-1247"). Use when asking about a specific submittal.
- get_project_summary: arguments: project_id. Use for "what needs my attention", "what needs attention", "what should I look at", "what's going on with X", "project status", "overview". This returns open RFIs count, pending submittals count, and upcoming deadlines—the right tool for attention/priority questions.
- list_daily_logs: arguments: project_id, limit (optional, default 10). Use for daily logs, "recent logs".
- create_daily_log: arguments: project_id, date (YYYY-MM-DD), weather (optional), notes (optional). Use for "create a log", "add daily log".

Do NOT add unsolicited prioritization statements, recommendations, or subjective assessments. Use only evidence from tool output.
`;

const VALID_TOOL_NAMES = new Set([
	'list_projects', 'list_rfis', 'get_rfi', 'list_submittals', 'get_submittal',
	'get_project_summary', 'list_daily_logs', 'create_daily_log',
]);

function serializeData(data: unknown): string {
	if (data == null) return 'No data';
	try {
		const s = JSON.stringify(data);
		return s.length > DATA_MAX_CHARS ? s.slice(0, DATA_MAX_CHARS) + '...' : s;
	} catch {
		return String(data);
	}
}

export interface GenerateAgentMessageEnv {
	OPENAI_API_KEY?: string;
	OPENAI_MODEL?: string;
	OPENAI_BASE_URL?: string;
}

/** SSE event envelope for streaming endpoint */
export type StreamEvent =
	| { type: 'start'; toolCall: Record<string, unknown>; response: Record<string, unknown>; summary?: string; responseStyle?: string }
	| { type: 'content'; content: string }
	| { type: 'done'; timeSaved: string }
	| { type: 'error'; error: string };

export type AgentOutput = { tool: string; arguments: Record<string, unknown> };

function getBaseUrl(env: GenerateAgentMessageEnv): string {
	const raw = typeof env.OPENAI_BASE_URL === 'string' ? env.OPENAI_BASE_URL.trim() : '';
	return (raw || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getModel(env: GenerateAgentMessageEnv): string {
	const raw = typeof env.OPENAI_MODEL === 'string' ? env.OPENAI_MODEL.trim() : '';
	return raw || DEFAULT_MODEL;
}

function getApiKey(env: GenerateAgentMessageEnv): string | null {
	const key = typeof env.OPENAI_API_KEY === 'string' ? env.OPENAI_API_KEY.trim() : '';
	return key.length > 0 ? key : null;
}

function extractTextFromChatCompletionsResponse(response: unknown): string | null {
	if (!response || typeof response !== 'object') return null;
	const r = response as Record<string, unknown>;
	const choices = r.choices;
	if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return null;
	const choice = choices[0] as Record<string, unknown>;

	// Chat Completions: choices[0].message.content
	const message = choice.message;
	if (message && typeof message === 'object') {
		const content = (message as Record<string, unknown>).content;
		if (typeof content === 'string') return content.trim() || null;

		// Some model variants return an array of content parts.
		if (Array.isArray(content)) {
			const text = content
				.map((part) => {
					if (typeof part === 'string') return part;
					if (!part || typeof part !== 'object') return '';
					const p = part as Record<string, unknown>;
					if (typeof p.text === 'string') return p.text;
					if (p.type === 'text' && typeof p.value === 'string') return p.value;
					return '';
				})
				.join('');
			return text.trim() || null;
		}
	}

	// Non-chat legacy: choices[0].text
	if (typeof choice.text === 'string') return choice.text.trim() || null;

	return null;
}

/** Extract JSON object from model response (may be inside markdown code block). */
function extractToolChoice(response: unknown): AgentOutput | null {
	let raw: string | null = null;
	raw = extractTextFromChatCompletionsResponse(response);
	if (!raw || typeof raw !== 'string') return null;
	const trimmed = raw.trim();
	const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
	const jsonStr = jsonMatch ? jsonMatch[0] : trimmed;
	try {
		const parsed = JSON.parse(jsonStr) as { tool?: string; arguments?: Record<string, unknown> };
		if (typeof parsed.tool !== 'string' || !VALID_TOOL_NAMES.has(parsed.tool)) return null;
		const args = parsed.arguments && typeof parsed.arguments === 'object' ? parsed.arguments : {};
		return { tool: parsed.tool, arguments: args };
	} catch {
		return null;
	}
}

/**
 * Use the LLM to choose which tool to call and with what arguments.
 * Returns null on failure or invalid response (caller should use heuristic).
 */
export async function selectToolWithLLM(
	env: GenerateAgentMessageEnv,
	userMessage: string
): Promise<AgentOutput | null> {
	const apiKey = getApiKey(env);
	if (!apiKey) return null;
	try {
		const res = await fetch(`${getBaseUrl(env)}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: getModel(env),
				temperature: 0,
				max_tokens: 250,
				messages: [
					{ role: 'system', content: TOOL_SELECTION_INSTRUCTIONS },
					{ role: 'user', content: `User asked: "${userMessage}"\n\nReply with JSON only: {"tool": "...", "arguments": {...}}` },
				],
			}),
		});

		if (!res.ok) return null;
		const response = await res.json().catch(() => null);
		if (!response) return null;
		return extractToolChoice(response);
	} catch {
		return null;
	}
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
	const apiKey = getApiKey(env);
	if (!apiKey) return null;
	if (!toolResult.success) return null;

	const dataBlob = serializeData(toolResult.data);
	const input = `User asked: "${userMessage}"

Tool used: ${toolName}
Result data: ${dataBlob}

Reply in natural language using the data above. Use only facts present in the tool result data (names, counts, project names, assignees, reviewers, status). Avoid adding extra interpretation or recommendations unless the user explicitly asks for next steps. Keep the tone direct and grounded. Do not add stock phrases like "Here they are" or "I found X items." No preamble like "Based on the data" or "According to the tool result."`;

	try {
		const res = await fetch(`${getBaseUrl(env)}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: getModel(env),
				temperature: 0.2,
				max_tokens: 500,
				messages: [
					{
						role: 'system',
						content:
							`You are a construction project assistant. Answer the user's question using only the tool result data. ` +
							`Cite assignees, reviewers, project names, counts, and status when relevant. ` +
							`Vary tone and length naturally: brief when the answer is simple, a bit more when summarizing attention items or explaining who is working on what. ` +
							`Do not add recommendations, subjective assessments, or priority judgments unless explicitly requested. ` +
							`Never make up data; if something isn't in the result, don't mention it.`,
					},
					{ role: 'user', content: input },
				],
			}),
		});

		if (!res.ok) return null;
		const response = await res.json().catch(() => null);
		if (!response) return null;
		const text = extractTextFromChatCompletionsResponse(response);
		return text && text.length > 0 ? text : null;
	} catch {
		return null;
	}
}

function toSSE(event: StreamEvent): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Stream the agent reply using Workers AI with stream: true.
 * Returns a ReadableStream that yields SSE-formatted events: content chunks then done.
 * Caller should send a "start" event before piping this (toolCall, response, etc.).
 */
export function streamAgentMessage(
	env: GenerateAgentMessageEnv,
	userMessage: string,
	toolName: string,
	toolResult: { success: boolean; data?: unknown; error?: string }
): ReadableStream<Uint8Array> | null {
	const apiKey = getApiKey(env);
	if (!apiKey) return null;
	if (!toolResult.success) return null;

	const dataBlob = serializeData(toolResult.data);
	const input = `User asked: "${userMessage}"

Tool used: ${toolName}
Result data: ${dataBlob}

Reply in natural language using the data above. Use only facts present in the tool result data (names, counts, project names, assignees, reviewers, status). Avoid adding extra interpretation or recommendations unless the user explicitly asks for next steps. Keep the tone direct and grounded. Do not add stock phrases like "Here they are" or "I found X items." No preamble like "Based on the data" or "According to the tool result."`;

	const instructions = `You are a construction project assistant. Answer the user's question using only the tool result data. ` +
		`Cite assignees, reviewers, project names, counts, and status when relevant. ` +
		`Vary tone and length naturally: brief when the answer is simple, a bit more when summarizing attention items or explaining who is working on what. ` +
		`Do not add recommendations, subjective assessments, or priority judgments unless explicitly requested. ` +
		`Never make up data; if something isn't in the result, don't mention it.`;

	const encoder = new TextEncoder();

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				const res = await fetch(`${getBaseUrl(env)}/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${apiKey}`,
					},
					body: JSON.stringify({
						model: getModel(env),
						temperature: 0.2,
						max_tokens: 600,
						stream: true,
						messages: [
							{ role: 'system', content: instructions },
							{ role: 'user', content: input },
						],
					}),
				});

				if (!res.ok || !res.body) {
					const detail = await res.text().catch(() => '');
					const msg = `OpenAI stream error (${res.status}): ${detail.slice(0, 240)}`;
					controller.enqueue(encoder.encode(toSSE({ type: 'error', error: msg })));
					controller.close();
					return;
				}

				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const events = buffer.split('\n\n');
					buffer = events.pop() ?? '';

					for (const event of events) {
						const lines = event.split('\n');
						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed.startsWith('data:')) continue;
							const payload = trimmed.replace(/^data:\s*/, '');
							if (!payload || payload === '[DONE]') continue;

							try {
								const data = JSON.parse(payload) as Record<string, unknown>;
								const choices = data.choices;
								if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') continue;
								const choice = choices[0] as Record<string, unknown>;
								const delta = choice.delta;
								if (!delta || typeof delta !== 'object') continue;
								const content = (delta as Record<string, unknown>).content;

								if (typeof content === 'string' && content.length > 0) {
									controller.enqueue(encoder.encode(toSSE({ type: 'content', content })));
									continue;
								}

								// Some model variants stream content as an array of parts.
								if (Array.isArray(content)) {
									const text = content
										.map((part) => {
											if (typeof part === 'string') return part;
											if (!part || typeof part !== 'object') return '';
											const p = part as Record<string, unknown>;
											if (typeof p.text === 'string') return p.text;
											if (p.type === 'text' && typeof p.value === 'string') return p.value;
											return '';
										})
										.join('');
									if (text) {
										controller.enqueue(encoder.encode(toSSE({ type: 'content', content: text })));
									}
								}
							} catch {
								// skip invalid JSON
							}
						}
					}
				}
			} catch (err) {
				controller.enqueue(encoder.encode(toSSE({
					type: 'error',
					error: err instanceof Error ? err.message : 'Stream failed',
				})));
			}
			controller.close();
		},
	});
}
