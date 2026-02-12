/**
 * Converts demo tool results into the shape MCPSandbox expects.
 * response.type: 'list' | 'summary' | 'action'
 * response.data: normalized for ResponseDisplay
 */

import type { AgentOutput } from './agent';

export interface SandboxResponse {
	toolCall: { name: string; params: Record<string, unknown> };
	response: {
		type: 'list' | 'summary' | 'action';
		data: unknown;
		timeSaved: string;
	};
	/** Short label for compatibility (e.g. "Found 2 RFI(s).") */
	summary?: string;
	/** Natural-language agent reply, like Claude/Cursor would respond before showing cards */
	agentMessage?: string;
}

function inferTimeSaved(toolName: string, count?: number): string {
	if (toolName === 'get_project_summary') return '~20 min';
	if (toolName === 'create_daily_log') return '~5 min';
	if (toolName === 'list_projects') return '~2 min';
	if (count !== undefined && count > 0) return '~15 min';
	return '~10 min';
}

export function buildSandboxResponse(
	agentOutput: AgentOutput,
	toolResult: { success: boolean; data?: unknown; error?: string }
): SandboxResponse {
	const { tool: name, arguments: params } = agentOutput;
	const timeSaved = inferTimeSaved(name, Array.isArray((toolResult.data as any)?.rfis) ? (toolResult.data as any).rfis?.length : (toolResult.data as any)?.submittals?.length ?? (toolResult.data as any)?.count);

	if (!toolResult.success) {
		return {
			toolCall: { name, params },
			response: {
				type: 'list',
				data: [],
				timeSaved: '~0 min',
			},
			summary: toolResult.error ?? 'No results.',
			agentMessage: `I tried to look that up, but something went wrong: ${toolResult.error ?? 'no results'}. You can try rephrasing or ask for something else.`,
		};
	}

	const data = toolResult.data as Record<string, unknown>;

	switch (name) {
		case 'list_projects': {
			const projects = (data?.projects as Array<Record<string, unknown>>) ?? [];
			const agentMessage =
				projects.length === 0
					? "I don't see any projects in the system yet. If you're setting up, you can add one from the project list."
					: `I pulled the project list. You have ${projects.length} project${projects.length !== 1 ? 's' : ''} — here they are:`;
			return {
				toolCall: { name, params },
				response: {
					type: 'list',
					data: projects.map((p) => ({
						id: p.id,
						title: p.name,
						project: p.name,
						status: p.status,
						completion: p.completion,
					})),
					timeSaved,
				},
				summary: `Found ${projects.length} project(s).`,
				agentMessage,
			};
		}
		case 'list_rfis': {
			const rfis = (data?.rfis as Array<Record<string, unknown>>) ?? [];
			const statusFilter = (params?.status as string) ?? 'all';
			const agentMessage =
				rfis.length === 0
					? statusFilter === 'overdue'
						? "I checked for overdue RFIs and there aren't any right now — good news."
						: "I didn't find any RFIs matching that. Try a different project or status."
					: statusFilter === 'overdue'
						? `I found ${rfis.length} overdue RFI${rfis.length !== 1 ? 's' : ''} that need attention. Here they are:`
						: `I looked up the RFIs and found ${rfis.length}. Here they are:`;
			return {
				toolCall: { name, params },
				response: {
					type: 'list',
					data: rfis.map((r) => ({
						id: r.id,
						subject: r.subject,
						project: r.project ?? (r.project_id as string),
						status: r.status,
						daysOverdue: r.days_overdue,
					})),
					timeSaved,
				},
				summary: `Found ${rfis.length} RFI(s).`,
				agentMessage,
			};
		}
		case 'get_rfi': {
			const rfi = data?.rfi as Record<string, unknown> | undefined;
			const list = rfi ? [{
				id: rfi.id,
				subject: rfi.subject,
				project: rfi.project ?? rfi.project_id,
				status: rfi.status,
				daysOverdue: rfi.days_overdue,
			}] : [];
			const agentMessage = rfi
				? `I pulled the details for ${rfi.id}. Here's what we have:`
				: "I couldn't find that RFI. Double-check the ID or project.";
			return {
				toolCall: { name, params },
				response: { type: 'list', data: list, timeSaved },
				summary: rfi ? `RFI ${rfi.id}: ${rfi.subject}` : 'RFI not found.',
				agentMessage,
			};
		}
		case 'list_submittals': {
			const submittals = (data?.submittals as Array<Record<string, unknown>>) ?? [];
			const agentMessage =
				submittals.length === 0
					? "I didn't find any submittals matching that. Try a different project or status."
					: `I found ${submittals.length} submittal${submittals.length !== 1 ? 's' : ''}. Here they are:`;
			return {
				toolCall: { name, params },
				response: {
					type: 'list',
					data: submittals.map((s) => ({
						id: s.id,
						title: s.title,
						project: s.project ?? s.project_id,
						status: s.status,
						daysPending: s.days_pending,
					})),
					timeSaved,
				},
				summary: `Found ${submittals.length} submittal(s).`,
				agentMessage,
			};
		}
		case 'get_submittal': {
			const sub = data?.submittal as Record<string, unknown> | undefined;
			const list = sub ? [{
				id: sub.id,
				title: sub.title,
				project: sub.project ?? sub.project_id,
				status: sub.status,
				daysPending: sub.days_pending,
			}] : [];
			const agentMessage = sub
				? `I pulled the details for submittal ${sub.id}. Here's what we have:`
				: "I couldn't find that submittal. Double-check the ID or project.";
			return {
				toolCall: { name, params },
				response: { type: 'list', data: list, timeSaved },
				summary: sub ? `Submittal ${sub.id}: ${sub.title}` : 'Submittal not found.',
				agentMessage,
			};
		}
		case 'get_project_summary': {
			const summary = data as { project?: Record<string, unknown>; openRfis?: number; pendingSubmittals?: number; upcomingDeadlines?: number };
			const projectName = (summary?.project as { name?: string } | undefined)?.name;
			const agentMessage = projectName
				? `Here’s the latest for ${projectName}: open RFIs, pending submittals, and upcoming deadlines below.`
				: "I couldn't find that project. Try listing projects first.";
			return {
				toolCall: { name, params },
				response: {
					type: 'summary',
					data: {
						project: summary?.project ?? {},
						openRfis: summary?.openRfis ?? 0,
						pendingSubmittals: summary?.pendingSubmittals ?? 0,
						upcomingDeadlines: summary?.upcomingDeadlines ?? 0,
					},
					timeSaved,
				},
				summary: summary?.project ? `Summary for ${(summary.project as any).name}.` : 'Project not found.',
				agentMessage,
			};
		}
		case 'list_daily_logs': {
			const logs = (data?.daily_logs as Array<Record<string, unknown>>) ?? [];
			const agentMessage =
				logs.length === 0
					? "I didn't find any daily logs for that project yet. You can create one if you'd like."
					: `I found ${logs.length} daily log${logs.length !== 1 ? 's' : ''}. Here they are:`;
			return {
				toolCall: { name, params },
				response: {
					type: 'list',
					data: logs.map((l) => ({
						id: l.id,
						title: `${l.log_date} - ${l.weather ?? 'N/A'}`,
						project: l.project_id,
						status: l.status,
						notes: l.notes,
					})),
					timeSaved,
				},
				summary: `Found ${logs.length} daily log(s).`,
				agentMessage,
			};
		}
		case 'create_daily_log': {
			const result = data as { id?: string; log_date?: string; message?: string };
			const agentMessage = `I created the daily log${result?.id ? ` (${result.id})` : ''}. ${result?.message ?? 'You can add manpower and notes next.'}`;
			return {
				toolCall: { name, params },
				response: {
					type: 'action',
					data: {
						success: true,
						logId: result?.id ?? 'DL-unknown',
						message: result?.message ?? 'Daily log created.',
					},
					timeSaved,
				},
				summary: result?.message ?? 'Daily log created.',
				agentMessage,
			};
		}
		default:
			return {
				toolCall: { name, params },
				response: { type: 'list', data: [], timeSaved: '~0 min' },
				summary: 'Done.',
				agentMessage: "I'm not sure how to do that yet. Try asking for projects, RFIs, submittals, or daily logs.",
			};
	}
}
