/**
 * WORKWAY Workflow Operations
 *
 * List workflows, get workflow details, and check execution status.
 * Progressive disclosure: read this file when you need workflow operations.
 *
 * @example
 * ```typescript
 * import { workflows } from './servers/workway';
 *
 * // List all workflows
 * const all = workflows.list();
 * console.log(`Found ${all.length} workflows`);
 *
 * // Filter by integration
 * const zoomWorkflows = workflows.list({ filter: 'zoom' });
 * zoomWorkflows.forEach(w => console.log(`${w.id}: ${w.outcome}`));
 *
 * // Get workflow by integration pair
 * const workflow = workflows.forPair('zoom', 'notion');
 * console.log(`Workflow: ${workflow?.id} - ${workflow?.description}`);
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Workflow {
	id: string;
	pairs: string[];
	outcomeFrame: string;
	description: string;
}

export interface OutcomeFrame {
	id: string;
	label: string;
	description: string;
}

// ============================================================================
// WORKFLOW REGISTRY
// ============================================================================

/**
 * All WORKWAY workflows with their integration pairs and outcome frames
 */
const WORKFLOWS: Record<string, Workflow> = {
	'meeting-intelligence': {
		id: 'meeting-intelligence',
		pairs: ['zoom:notion', 'zoom:slack'],
		outcomeFrame: 'after_meetings',
		description: 'Zoom meetings that write their own notes',
	},
	'stripe-to-notion': {
		id: 'stripe-to-notion',
		pairs: ['stripe:notion'],
		outcomeFrame: 'when_payments_arrive',
		description: 'Payments tracked automatically',
	},
	'sales-lead-pipeline': {
		id: 'sales-lead-pipeline',
		pairs: ['typeform:hubspot', 'typeform:slack'],
		outcomeFrame: 'when_leads_come_in',
		description: 'Leads that route themselves',
	},
	'sprint-progress-tracker': {
		id: 'sprint-progress-tracker',
		pairs: ['linear:slack', 'linear:notion'],
		outcomeFrame: 'every_morning',
		description: 'Sprint updates every morning',
	},
	'error-incident-manager': {
		id: 'error-incident-manager',
		pairs: ['sentry:notion', 'sentry:slack'],
		outcomeFrame: 'when_errors_happen',
		description: 'Errors that document themselves',
	},
	'github-to-linear': {
		id: 'github-to-linear',
		pairs: ['github:linear'],
		outcomeFrame: 'when_issues_arrive',
		description: 'Issues synced to Linear',
	},
	'pr-review-notifier': {
		id: 'pr-review-notifier',
		pairs: ['github:slack', 'github:discord'],
		outcomeFrame: 'when_code_changes',
		description: 'PR alerts in Slack/Discord',
	},
	'discord-standup-bot': {
		id: 'discord-standup-bot',
		pairs: ['discord:notion'],
		outcomeFrame: 'every_morning',
		description: 'Standups archived to Notion',
	},
	'design-portfolio-sync': {
		id: 'design-portfolio-sync',
		pairs: ['dribbble:notion', 'dribbble:slack'],
		outcomeFrame: 'after_publishing',
		description: 'Portfolio that updates itself',
	},
	'scheduling-autopilot': {
		id: 'scheduling-autopilot',
		pairs: ['calendly:notion', 'calendly:slack'],
		outcomeFrame: 'when_meetings_booked',
		description: 'Meetings logged automatically',
	},
	'revenue-radar': {
		id: 'revenue-radar',
		pairs: ['stripe:slack', 'stripe:hubspot'],
		outcomeFrame: 'when_payments_arrive',
		description: 'Payment alerts in Slack',
	},
	'form-response-hub': {
		id: 'form-response-hub',
		pairs: ['typeform:notion', 'typeform:airtable'],
		outcomeFrame: 'when_forms_submitted',
		description: 'Responses logged to Notion/Airtable',
	},
	'deal-tracker': {
		id: 'deal-tracker',
		pairs: ['hubspot:slack', 'hubspot:notion'],
		outcomeFrame: 'when_deals_progress',
		description: 'Deal alerts in Slack',
	},
	'task-sync-bridge': {
		id: 'task-sync-bridge',
		pairs: ['todoist:notion'],
		outcomeFrame: 'when_tasks_complete',
		description: 'Completed tasks logged to Notion',
	},
	'team-digest': {
		id: 'team-digest',
		pairs: ['notion:slack'],
		outcomeFrame: 'every_morning',
		description: 'Team activity digest',
	},
	'spreadsheet-sync': {
		id: 'spreadsheet-sync',
		pairs: ['google-sheets:airtable'],
		outcomeFrame: 'when_data_changes',
		description: 'Spreadsheets synced to Airtable',
	},
	'content-calendar': {
		id: 'content-calendar',
		pairs: ['airtable:slack'],
		outcomeFrame: 'every_morning',
		description: 'Content reminders in Slack',
	},
	'meeting-followup-engine': {
		id: 'meeting-followup-engine',
		pairs: ['calendly:todoist'],
		outcomeFrame: 'after_calls',
		description: 'Meetings that create their own tasks',
	},
	'client-onboarding': {
		id: 'client-onboarding',
		pairs: ['stripe:todoist'],
		outcomeFrame: 'when_clients_onboard',
		description: 'Clients onboarded automatically',
	},
	'weekly-productivity-digest': {
		id: 'weekly-productivity-digest',
		pairs: ['todoist:slack'],
		outcomeFrame: 'weekly_automatically',
		description: 'Productivity insights weekly',
	},
	'support-ticket-router': {
		id: 'support-ticket-router',
		pairs: ['slack:slack'],
		outcomeFrame: 'when_tickets_arrive',
		description: 'Tickets routed to the right team',
	},
	'invoice-generator': {
		id: 'invoice-generator',
		pairs: ['notion:stripe'],
		outcomeFrame: 'when_payments_arrive',
		description: 'Projects that invoice themselves',
	},
	'meeting-summarizer': {
		id: 'meeting-summarizer',
		pairs: ['zoom:slack'],
		outcomeFrame: 'after_meetings',
		description: 'Meeting summaries in Slack',
	},
	'standup-bot': {
		id: 'standup-bot',
		pairs: ['slack:notion'],
		outcomeFrame: 'every_morning',
		description: 'Daily standups collected and archived',
	},
	'calendar-meeting-prep': {
		id: 'calendar-meeting-prep',
		pairs: ['google-calendar:notion', 'google-calendar:slack'],
		outcomeFrame: 'before_meetings',
		description: 'Meetings that brief themselves',
	},
	'meeting-to-action': {
		id: 'meeting-to-action',
		pairs: ['zoom:todoist', 'zoom:linear'],
		outcomeFrame: 'after_meetings',
		description: 'Meetings that assign themselves',
	},
	'drive-document-hub': {
		id: 'drive-document-hub',
		pairs: ['google-drive:notion', 'google-drive:slack'],
		outcomeFrame: 'when_files_change',
		description: 'Documents that organize themselves',
	},
	'document-approval-flow': {
		id: 'document-approval-flow',
		pairs: ['google-drive:slack'],
		outcomeFrame: 'when_approval_needed',
		description: 'Documents that approve themselves',
	},
	'calendar-availability-sync': {
		id: 'calendar-availability-sync',
		pairs: ['google-calendar:slack'],
		outcomeFrame: 'always_current',
		description: 'Status that updates itself',
	},
	'meeting-expense-tracker': {
		id: 'meeting-expense-tracker',
		pairs: ['zoom:stripe', 'zoom:notion'],
		outcomeFrame: 'after_meetings',
		description: 'Meetings that invoice themselves',
	},
	'project-time-tracker': {
		id: 'project-time-tracker',
		pairs: ['linear:google-sheets', 'linear:slack'],
		outcomeFrame: 'when_work_completes',
		description: 'Time that tracks itself',
	},
};

/**
 * Outcome frames - verb-driven discovery taxonomy
 */
const OUTCOME_FRAMES: Record<string, OutcomeFrame> = {
	after_meetings: {
		id: 'after_meetings',
		label: 'After meetings...',
		description: 'Automate what happens when meetings end',
	},
	when_payments_arrive: {
		id: 'when_payments_arrive',
		label: 'When payments arrive...',
		description: 'Track, invoice, and follow up on payments',
	},
	when_leads_come_in: {
		id: 'when_leads_come_in',
		label: 'When leads come in...',
		description: 'Route leads to your CRM and team',
	},
	weekly_automatically: {
		id: 'weekly_automatically',
		label: 'Weekly, automatically...',
		description: 'Digests, reports, and summaries',
	},
	when_tickets_arrive: {
		id: 'when_tickets_arrive',
		label: 'When tickets arrive...',
		description: 'Route and analyze support requests',
	},
	every_morning: {
		id: 'every_morning',
		label: 'Every morning...',
		description: 'Daily standups, digests, briefings',
	},
	when_clients_onboard: {
		id: 'when_clients_onboard',
		label: 'When clients onboard...',
		description: 'Automate client and team onboarding',
	},
	after_calls: {
		id: 'after_calls',
		label: 'After calls...',
		description: 'Follow-ups and task creation',
	},
	when_data_changes: {
		id: 'when_data_changes',
		label: 'When data changes...',
		description: 'Sync and transform data automatically',
	},
	after_publishing: {
		id: 'after_publishing',
		label: 'After publishing...',
		description: 'Sync creative work across platforms',
	},
	when_meetings_booked: {
		id: 'when_meetings_booked',
		label: 'When meetings are booked...',
		description: 'Log bookings and notify your team',
	},
	when_forms_submitted: {
		id: 'when_forms_submitted',
		label: 'When forms are submitted...',
		description: 'Route responses to your databases',
	},
	when_deals_progress: {
		id: 'when_deals_progress',
		label: 'When deals progress...',
		description: 'Track deal movement and celebrate wins',
	},
	when_tasks_complete: {
		id: 'when_tasks_complete',
		label: 'When tasks complete...',
		description: 'Build a productivity journal automatically',
	},
	when_errors_happen: {
		id: 'when_errors_happen',
		label: 'When errors happen...',
		description: 'Document incidents and alert your team',
	},
	when_issues_arrive: {
		id: 'when_issues_arrive',
		label: 'When issues arrive...',
		description: 'Sync issues across platforms automatically',
	},
	when_code_changes: {
		id: 'when_code_changes',
		label: 'When code changes...',
		description: 'PR notifications and code review reminders',
	},
	when_files_change: {
		id: 'when_files_change',
		label: 'When files change...',
		description: 'Sync documents and notify your team',
	},
	when_approval_needed: {
		id: 'when_approval_needed',
		label: 'When approval is needed...',
		description: 'Request approvals and track decisions',
	},
	always_current: {
		id: 'always_current',
		label: 'Always current...',
		description: 'Keep status and availability in sync',
	},
	when_work_completes: {
		id: 'when_work_completes',
		label: 'When work completes...',
		description: 'Track time and sync to reports',
	},
};

// ============================================================================
// OPERATIONS
// ============================================================================

/**
 * List all workflows, optionally filtered by integration
 *
 * @example
 * ```typescript
 * // All workflows
 * const all = workflows.list();
 *
 * // Workflows involving Zoom
 * const zoom = workflows.list({ filter: 'zoom' });
 * zoom.forEach(w => console.log(`${w.id}: ${w.description}`));
 *
 * // Workflows for "after meetings" outcome
 * const meetings = workflows.list({ outcomeFrame: 'after_meetings' });
 * ```
 */
export function list(options?: {
	filter?: string;
	outcomeFrame?: string;
}): Workflow[] {
	let result = Object.values(WORKFLOWS);

	if (options?.filter) {
		const filter = options.filter.toLowerCase();
		result = result.filter(
			w =>
				w.pairs.some(p => p.includes(filter)) ||
				w.description.toLowerCase().includes(filter) ||
				w.id.includes(filter)
		);
	}

	if (options?.outcomeFrame) {
		result = result.filter(w => w.outcomeFrame === options.outcomeFrame);
	}

	return result;
}

/**
 * Get a workflow by ID
 *
 * @example
 * ```typescript
 * const workflow = workflows.get('meeting-intelligence');
 * if (workflow) {
 *   console.log(`Pairs: ${workflow.pairs.join(', ')}`);
 *   console.log(`Frame: ${workflow.outcomeFrame}`);
 * }
 * ```
 */
export function get(id: string): Workflow | null {
	return WORKFLOWS[id] || null;
}

/**
 * Get workflow for an integration pair
 *
 * @example
 * ```typescript
 * const workflow = workflows.forPair('zoom', 'notion');
 * console.log(`Outcome: ${workflow?.description}`);
 * ```
 */
export function forPair(from: string, to: string): Workflow | null {
	const pair = `${from.toLowerCase()}:${to.toLowerCase()}`;
	return Object.values(WORKFLOWS).find(w => w.pairs.includes(pair)) || null;
}

/**
 * List all outcome frames
 *
 * @example
 * ```typescript
 * const frames = workflows.outcomeFrames();
 * frames.forEach(f => console.log(`${f.label}: ${f.description}`));
 * ```
 */
export function outcomeFrames(): OutcomeFrame[] {
	return Object.values(OUTCOME_FRAMES);
}

/**
 * Get workflows grouped by outcome frame
 *
 * @example
 * ```typescript
 * const grouped = workflows.byOutcomeFrame();
 * for (const [frame, workflows] of Object.entries(grouped)) {
 *   console.log(`\n=== ${frame} ===`);
 *   workflows.forEach(w => console.log(`  - ${w.id}`));
 * }
 * ```
 */
export function byOutcomeFrame(): Record<string, Workflow[]> {
	const grouped: Record<string, Workflow[]> = {};

	for (const workflow of Object.values(WORKFLOWS)) {
		if (!grouped[workflow.outcomeFrame]) {
			grouped[workflow.outcomeFrame] = [];
		}
		grouped[workflow.outcomeFrame].push(workflow);
	}

	return grouped;
}

/**
 * Get all integrations used across workflows
 *
 * @example
 * ```typescript
 * const integrations = workflows.integrations();
 * console.log(`${integrations.length} integrations: ${integrations.join(', ')}`);
 * ```
 */
export function integrations(): string[] {
	const set = new Set<string>();

	for (const workflow of Object.values(WORKFLOWS)) {
		for (const pair of workflow.pairs) {
			const [from, to] = pair.split(':');
			set.add(from);
			set.add(to);
		}
	}

	return Array.from(set).sort();
}
