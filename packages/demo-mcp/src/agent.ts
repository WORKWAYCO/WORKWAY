/**
 * Demo agent: maps user message to one tool + arguments.
 * Heuristic router first (no LLM); optional LLM fallback can be added later.
 * Inexpensive and reliable: zod validation, project name → project_id map.
 */

import { z } from 'zod';
import { DEMO_TOOL_NAMES, demoTools } from './tools';

// Project name/keyword → project_id
const PROJECT_MAP: Record<string, string> = {
	'main street': 'P-001',
	'main street tower': 'P-001',
	'tower': 'P-001',
	'p-001': 'P-001',
	'harbor': 'P-002',
	'harbor view': 'P-002',
	'harbor view condos': 'P-002',
	'condos': 'P-002',
	'p-002': 'P-002',
	'tech campus': 'P-003',
	'tech': 'P-003',
	'p-003': 'P-003',
};

const defaultProjectId = 'P-001';

function resolveProjectId(message: string): string {
	const lower = message.toLowerCase();
	for (const [key, id] of Object.entries(PROJECT_MAP)) {
		if (lower.includes(key)) return id;
	}
	return defaultProjectId;
}

const toolNamesTuple = [
	'list_projects', 'list_rfis', 'get_rfi', 'list_submittals', 'get_submittal',
	'get_project_summary', 'list_daily_logs', 'create_daily_log',
] as const;

export const agentOutputSchema = z.object({
	tool: z.enum(toolNamesTuple),
	arguments: z.record(z.unknown()),
});

export type AgentOutput = z.infer<typeof agentOutputSchema>;

/**
 * Heuristic router: map message to one tool + arguments.
 * No LLM call. Deterministic and fast.
 */
export function routeMessage(message: string): AgentOutput | null {
	const lower = message.toLowerCase().trim();
	const projectId = resolveProjectId(message);

	// get_project_summary: "what needs my attention", "what needs attention", "what should I look at"
	if (/\b(what\s+needs\s+(my\s+)?attention|what\s+needs\s+attention|what\s+should\s+I\s+look\s+at|what\s+should\s+i\s+focus\s+on)\b/.test(lower) && !/\b(rfi|submittal|daily|log)\b/.test(lower)) {
		return { tool: 'get_project_summary', arguments: { project_id: projectId } };
	}

	// list_projects
	if (/\b(projects|list projects|what projects|which projects)\b/.test(lower) && !/\b(rfi|submittal|daily|log)\b/.test(lower)) {
		return { tool: 'list_projects', arguments: {} };
	}

	// overdue RFIs
	if (/\b(overdue|past due)\b/.test(lower) && /\b(rfi|rfis)\b/.test(lower)) {
		return { tool: 'list_rfis', arguments: { project_id: projectId, status: 'overdue' } };
	}
	if (/\b(overdue|past due)\b/.test(lower) && !/\b(submittal|daily|log)\b/.test(lower)) {
		return { tool: 'list_rfis', arguments: { project_id: projectId, status: 'overdue' } };
	}

	// open RFIs
	if (/\b(open\s+)?rfi(s)?\b/.test(lower) && !/\b(submittal|daily|log)\b/.test(lower)) {
		return { tool: 'list_rfis', arguments: { project_id: projectId, status: 'open' } };
	}

	// single RFI by number (e.g. RFI 2847)
	const rfiNumMatch = lower.match(/\brfi[\s-]?(\d{4,})\b/);
	if (rfiNumMatch) {
		return { tool: 'get_rfi', arguments: { project_id: projectId, rfi_id: rfiNumMatch[1] } };
	}

	// submittals
	if (/\b(submittal(s)?|submittals)\b/.test(lower)) {
		if (/\b(pending|waiting|review|awaiting)\b/.test(lower)) {
			return { tool: 'list_submittals', arguments: { project_id: projectId, status: 'pending_review' } };
		}
		if (/\b(approved|approval)\b/.test(lower)) {
			return { tool: 'list_submittals', arguments: { project_id: projectId, status: 'approved' } };
		}
		return { tool: 'list_submittals', arguments: { project_id: projectId, status: 'all' } };
	}

	// single submittal by number
	const subNumMatch = lower.match(/\bsub(?:mittal)?[\s-]?(\d{4,})\b/);
	if (subNumMatch) {
		return { tool: 'get_submittal', arguments: { project_id: projectId, submittal_id: subNumMatch[1] } };
	}

	// project summary: "what's going on", "tell me about", "how is X project", etc.
	if (/\b(what'?s?\s+going\s+on|going\s+on\s+with|tell\s+me\s+about|how\s+is\s+(the\s+)?(.+)\s+project)\b/.test(lower) && !/\b(rfi|submittal|daily)\b/.test(lower)) {
		return { tool: 'get_project_summary', arguments: { project_id: projectId } };
	}
	if (/\b(summary|overview|status|how (is|are)|project\s+summary)\b/.test(lower) && !/\b(rfi|submittal|daily)\b/.test(lower)) {
		return { tool: 'get_project_summary', arguments: { project_id: projectId } };
	}
	if (/\b(harbor view|main street|tech campus)\b/.test(lower) && (/\b(summary|overview|status)\b/.test(lower) || lower.split(/\s+/).length <= 6)) {
		return { tool: 'get_project_summary', arguments: { project_id: projectId } };
	}

	// daily logs
	if (/\b(daily\s+log(s)?|logs)\b/.test(lower)) {
		if (/\b(create|add|new|write|enter)\b/.test(lower)) {
			const today = new Date().toISOString().split('T')[0];
			return { tool: 'create_daily_log', arguments: { project_id: projectId, date: today, weather: 'Clear', notes: '' } };
		}
		return { tool: 'list_daily_logs', arguments: { project_id: projectId, limit: 10 } };
	}
	if (/\b(create|add|new)\b/.test(lower) && /\b(log|entry)\b/.test(lower)) {
		const today = new Date().toISOString().split('T')[0];
		return { tool: 'create_daily_log', arguments: { project_id: projectId, date: today, weather: 'Clear', notes: '' } };
	}

	return null;
}

/**
 * Resolve agent output: heuristic first, then safe default.
 * Validates with zod; on failure returns list_projects.
 */
export function resolveToolCall(message: string): AgentOutput {
	const heuristic = routeMessage(message);
	if (heuristic) {
		const parsed = agentOutputSchema.safeParse(heuristic);
		if (parsed.success) return parsed.data;
	}
	return { tool: 'list_projects', arguments: {} };
}
