/**
 * Optional LLM steps for the demo agent:
 * 1. selectToolWithLLM – choose which tool (and arguments) to call from the user message.
 * 2. generateAgentMessage – answer the user using the tool result.
 * Fall back to heuristic/template when AI is unavailable or the call fails.
 */

const MODEL = '@cf/openai/gpt-oss-120b';
const DATA_MAX_CHARS = 1500;

const TOOL_SELECTION_INSTRUCTIONS = `You are a construction project assistant. You have access to these tools. Choose ONE tool that best answers the user's question. Reply with JSON only, no other text: {"tool": "<name>", "arguments": {...}}.

Project IDs: P-001 = Main Street Tower, P-002 = Harbor View Condos, P-003 = Tech Campus Phase 2. If the user says "our" or doesn't specify a project, use P-001.

Tools:
- list_projects: No arguments. Use for "what projects", "list projects", "what about our projects".
- list_rfis: arguments: project_id (required), status (optional: "overdue"|"open"|"closed"|"all"). Use for RFIs, overdue items, "who's working on RFIs" (data includes assignee).
- get_rfi: arguments: project_id, rfi_id (e.g. "2847" or "RFI-2847"). Use when asking about a specific RFI.
- list_submittals: arguments: project_id (optional), status (optional: "pending_review"|"approved"|"all"). Use for submittals, "tell me about our submittals", "who's working these" when submittals were just discussed (data includes reviewer).
- get_submittal: arguments: project_id, submittal_id (e.g. "1247" or "SUB-1247"). Use when asking about a specific submittal.
- get_project_summary: arguments: project_id. Use for "what's going on with X", "project status", "overview".
- list_daily_logs: arguments: project_id, limit (optional, default 10). Use for daily logs, "recent logs".
- create_daily_log: arguments: project_id, date (YYYY-MM-DD), weather (optional), notes (optional). Use for "create a log", "add daily log".`;

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

export type AgentOutput = { tool: string; arguments: Record<string, unknown> };

/** Extract JSON object from model response (may be inside markdown code block). */
function extractToolChoice(response: unknown): AgentOutput | null {
	let raw: string | null = null;
	if (typeof response === 'string') raw = response;
	else if (response && typeof response === 'object') {
		const r = response as Record<string, unknown>;
		if (typeof r.response === 'string') raw = r.response;
		else if (typeof r.result === 'string') raw = r.result;
	}
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
	if (!env.AI?.run) return null;
	try {
		const response = await env.AI.run(MODEL, {
			instructions: TOOL_SELECTION_INSTRUCTIONS,
			input: `User asked: "${userMessage}"\n\nReply with JSON only: {"tool": "...", "arguments": {...}}`,
			reasoning: { effort: 'low', summary: 'concise' },
		} as Record<string, unknown>);
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
	if (!env.AI?.run) return null;
	if (!toolResult.success) return null;

	const dataBlob = serializeData(toolResult.data);
	const input = `User asked: "${userMessage}"

Tool used: ${toolName}
Result data: ${dataBlob}

Answer the user's question using the data above. Use any relevant fields (assignees, reviewers, project names, titles, status, counts). Be direct and concise; 1-4 sentences. No preamble like "Based on the data".`;

	try {
		const response = await env.AI.run(MODEL, {
			instructions: 'You are a construction project assistant. Use the tool result data to answer the user. You have full freedom to cite assignees, reviewers, project names, and specifics from the data as needed.',
			input,
			reasoning: { effort: 'low', summary: 'concise' },
		} as Record<string, unknown>);
		const text = extractText(response);
		return text && text.length > 0 ? text : null;
	} catch {
		return null;
	}
}
