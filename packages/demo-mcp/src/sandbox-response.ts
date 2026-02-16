/**
 * Converts demo tool results into the shape MCPSandbox expects.
 * response.type: 'list' | 'summary' | 'action'
 * response.data: normalized for ResponseDisplay
 * When user asks "what are X about?" we reason from the data and put details in agentMessage.
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
	/** Natural-language agent reply; may be a full answer with details from the data */
	agentMessage?: string;
	/** When true, the agent message is the full answer; cards are reference only (UI can collapse or de-emphasize) */
	responseStyle?: 'cards' | 'answer_with_details';
}

function inferTimeSaved(toolName: string, count?: number): string {
	if (toolName === 'get_project_summary') return '~20 min';
	if (toolName === 'create_daily_log') return '~5 min';
	if (toolName === 'list_projects') return '~2 min';
	if (count !== undefined && count > 0) return '~15 min';
	return '~10 min';
}

type TeamMember = { name: string; role: string };

function formatTeam(team: unknown): string {
	if (!Array.isArray(team) || team.length === 0) return 'No staffing assigned yet.';
	const names = team
		.map((member) => {
			if (!member || typeof member !== 'object') return null;
			const m = member as Partial<TeamMember>;
			if (typeof m.name !== 'string' || typeof m.role !== 'string') return null;
			return `${m.name} (${m.role})`;
		})
		.filter((entry): entry is string => Boolean(entry));
	return names.length > 0 ? names.join(', ') : 'No staffing assigned yet.';
}

function isTeamQuestion(message: string | undefined): boolean {
	if (!message) return false;
	const lower = message.toLowerCase();
	return /\b(who\s*('s| is| are)?\s*(is|are)?\s*(working|assigned|on|handling)|who\s+is\s+working\s+on)\b/.test(lower)
		&& /\b(project|projects|team|teams)\b/.test(lower);
}

/** User is asking what/how/about — we should answer in prose from the data, not just "here are the cards". */
function wantsProseAnswer(userMessage: string): boolean {
	const lower = userMessage.toLowerCase();
	return (
		/\b(what are|what's|whats|what is)\s+(the\s+)?(submittals?|rfis?|logs?|projects?)\s+(about|for)\b/.test(lower) ||
		/\b(what are|what is)\s+(they|these|those)\s+about\b/.test(lower) ||
		/\b(tell me about|describe|summarize)\s+(the\s+)?(submittals?|rfis?|logs?)\b/.test(lower) ||
		/\b(what do we have|what have we got)\s+(for|on)\b/.test(lower) ||
		isTeamQuestion(userMessage)
	);
}

export function buildSandboxResponse(
	agentOutput: AgentOutput,
	toolResult: { success: boolean; data?: unknown; error?: string },
	userMessage?: string
): SandboxResponse {
	const { tool: name, arguments: params } = agentOutput;
	const prose = userMessage ? wantsProseAnswer(userMessage) : false;
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
			const mapped = projects.map((p) => ({
				id: p.id,
				title: p.name,
				project: p.name,
				status: p.status,
				completion: p.completion,
				team: p.team,
			}));
			let agentMessage: string;
			let responseStyle: 'cards' | 'answer_with_details' = 'cards';
			if (projects.length === 0) {
				agentMessage = "I don't see any projects in the system yet. If you're setting up, you can add one from the project list.";
			} else if (isTeamQuestion(userMessage)) {
				const projectLines = mapped
					.map((p) => `${p.project}: ${formatTeam(p.team)}`)
					.join('\n');
				agentMessage = `Here\'s who is currently listed as working on the projects:\n${projectLines}`;
				responseStyle = 'answer_with_details';
			} else if (prose) {
				const names = mapped.map((p) => (p.project as string) ?? p.title).join(', ');
				agentMessage = mapped.length === 1
					? `There is 1 project: ${names}.`
					: `There are ${mapped.length} projects: ${names}.`;
				responseStyle = 'answer_with_details';
			} else {
				agentMessage = `I pulled the project list. You have ${projects.length} project${projects.length !== 1 ? 's' : ''} — here they are:`;
			}
			return {
				toolCall: { name, params },
				response: { type: 'list', data: mapped, timeSaved },
				summary: `Found ${projects.length} project(s).`,
				agentMessage,
				responseStyle,
			};
		}
		case 'list_rfis': {
			const rfis = (data?.rfis as Array<Record<string, unknown>>) ?? [];
			const statusFilter = (params?.status as string) ?? 'all';
			const mapped = rfis.map((r) => ({
				id: r.id,
				subject: r.subject,
				project: r.project ?? (r.project_id as string),
				status: r.status,
				daysOverdue: r.days_overdue,
			}));
			let agentMessage: string;
			let responseStyle: 'cards' | 'answer_with_details' = 'cards';
			if (rfis.length === 0) {
				agentMessage =
					statusFilter === 'overdue'
						? "I checked for overdue RFIs and there aren't any right now — good news."
						: "I didn't find any RFIs matching that. Try a different project or status.";
			} else if (prose) {
				const projectName = (mapped[0]?.project as string) ?? 'this project';
				if (mapped.length === 1) {
					const r = mapped[0];
					const subject = (r.subject as string) ?? String(r.id);
					const overdue = r.daysOverdue != null ? `${r.daysOverdue} days overdue` : String(r.status ?? 'open');
					agentMessage = `There is 1 RFI for ${projectName}: ${subject} (${overdue}).`;
				} else {
					const parts = mapped.map((r, i) => {
						const subject = (r.subject as string) ?? String(r.id);
						const overdue = r.daysOverdue != null ? `${r.daysOverdue} days overdue` : String(r.status ?? 'open');
						const which = i === 0 ? 'One' : i === 1 ? 'the other' : 'another';
						return `${which} is ${subject} (${overdue})`;
					});
					agentMessage = `There are ${mapped.length} RFIs for ${projectName}. ${parts.join('; ')}.`;
				}
				responseStyle = 'answer_with_details';
			} else {
				agentMessage =
					statusFilter === 'overdue'
						? `I found ${rfis.length} overdue RFI${rfis.length !== 1 ? 's' : ''} that need attention. Here they are:`
						: `I looked up the RFIs and found ${rfis.length}. Here they are:`;
			}
			return {
				toolCall: { name, params },
				response: { type: 'list', data: mapped, timeSaved },
				summary: `Found ${rfis.length} RFI(s).`,
				agentMessage,
				responseStyle,
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
			const mapped = submittals.map((s) => ({
				id: s.id,
				title: s.title,
				project: s.project ?? s.project_id,
				status: s.status,
				daysPending: s.days_pending,
			}));
			let agentMessage: string;
			let responseStyle: 'cards' | 'answer_with_details' = 'cards';
			if (submittals.length === 0) {
				agentMessage = "I didn't find any submittals matching that. Try a different project or status.";
			} else if (prose) {
				const projectName = (mapped[0]?.project as string) ?? 'this project';
				if (mapped.length === 1) {
					const s = mapped[0];
					const title = (s.title as string) ?? String(s.id);
					const pending = s.daysPending != null ? `${s.daysPending} days pending` : String(s.status ?? 'pending');
					agentMessage = `There is 1 submittal for ${projectName}: ${title} (${pending}).`;
				} else {
					const parts = mapped.map((s, i) => {
						const title = (s.title as string) ?? String(s.id);
						const pending = s.daysPending != null ? `${s.daysPending} days pending` : String(s.status ?? 'pending');
						const which = i === 0 ? 'One' : i === 1 ? 'the other' : 'another';
						return `${which} is ${title} (${pending})`;
					});
					agentMessage = `There are ${mapped.length} submittals for ${projectName}. ${parts.join('; ')}.`;
				}
				responseStyle = 'answer_with_details';
			} else {
				agentMessage = `I found ${submittals.length} submittal${submittals.length !== 1 ? 's' : ''}. Here they are:`;
			}
			return {
				toolCall: { name, params },
				response: { type: 'list', data: mapped, timeSaved },
				summary: `Found ${submittals.length} submittal(s).`,
				agentMessage,
				responseStyle,
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
			const mapped = logs.map((l) => ({
				id: l.id,
				title: `${l.log_date} - ${l.weather ?? 'N/A'}`,
				project: l.project_id,
				status: l.status,
				notes: l.notes,
			}));
			let agentMessage: string;
			let responseStyle: 'cards' | 'answer_with_details' = 'cards';
			if (logs.length === 0) {
				agentMessage = "I didn't find any daily logs for that project yet. You can create one if you'd like.";
			} else if (prose) {
				const parts = mapped.map((l, i) => {
					const title = (l.title as string) ?? String(l.id);
					return i === 0 ? `One is ${title}` : `another is ${title}`;
				});
				agentMessage = mapped.length === 1
					? `There is 1 daily log: ${(mapped[0].title as string) ?? mapped[0].id}.`
					: `There are ${mapped.length} daily logs. ${parts.join('; ')}.`;
				responseStyle = 'answer_with_details';
			} else {
				agentMessage = `I found ${logs.length} daily log${logs.length !== 1 ? 's' : ''}. Here they are:`;
			}
			return {
				toolCall: { name, params },
				response: { type: 'list', data: mapped, timeSaved },
				summary: `Found ${logs.length} daily log(s).`,
				agentMessage,
				responseStyle,
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
