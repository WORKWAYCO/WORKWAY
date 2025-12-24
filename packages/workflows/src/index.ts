/**
 * WORKWAY Marketplace Workflows
 *
 * Pre-built workflow templates for common automation scenarios.
 * Each workflow uses the @workwayco/sdk patterns and integrations.
 *
 * ## Pathway Model
 *
 * Workflows are organized by **integration pairs**, not categories.
 * One integration pair = one canonical workflow.
 *
 * See: docs/MARKETPLACE_CURATION.md
 * See: docs/OUTCOME_TAXONOMY.md
 *
 * @example
 * ```typescript
 * import { meetingIntelligence } from '@workwayco/workflows';
 * import { getWorkflowForPair, integrationPairs } from '@workwayco/workflows';
 *
 * // Get the canonical workflow for zoom → notion
 * const workflow = getWorkflowForPair('zoom', 'notion');
 * ```
 */

// ============================================================================
// WORKFLOW EXPORTS
// ============================================================================

// Finance & Payments
export { default as paymentsTracked } from './payments-tracked/index.js';
// paymentReminders - DEPRECATED: Requires Gmail (app verification not completed)
export { default as invoiceGenerator } from './invoice-generator/index.js';

// Meetings & Productivity
export { default as meetingIntelligence } from './meeting-intelligence/index.js';
export { default as meetingIntelligenceWorkaround } from './meeting-intelligence-private/index.js';
export { default as meetingSummarizer } from './meeting-summarizer/index.js';
export { default as meetingFollowupEngine } from './meeting-followup-engine/index.js';
export { default as weeklyProductivityDigest } from './weekly-productivity-digest/index.js';
export { default as calendarMeetingPrep } from './calendar-meeting-prep/index.js';
export { default as meetingToAction } from './meeting-to-action/index.js';

// Team & Communication
export { default as teamDigest } from './team-digest/index.js';
export { default as standupBot } from './standup-bot/index.js';
export { default as supportTicketRouter } from './support-ticket-router/index.js';

// Sales & Onboarding
export { default as salesLeadPipeline } from './sales-lead-pipeline/index.js';
export { default as clientOnboarding } from './client-onboarding/index.js';
export { default as onboardingAutomation } from './onboarding/index.js';

// Content & Analytics
// aiNewsletter - DEPRECATED: Requires Gmail (app verification not completed)
// feedbackAnalyzer - DEPRECATED: Requires Gmail (app verification not completed)

// Email Sync (Private - BYOO)
export { default as privateEmailsDocumented } from './private-emails-documented/index.js';

// Dev Team & Data
export { default as sprintProgressTracker } from './sprint-progress-tracker/index.js';
export { default as dataStaysConsistent } from './data-stays-consistent/index.js';
export { default as contentCalendar } from './content-calendar/index.js';

// Error Tracking & Incidents (WORKWAY Dogfooding!)
export { default as errorIncidentManager } from './error-incident-manager/index.js';
// sentry-performance-monitor - ON HOLD: Sentry app requires review before public use
// sentry-alert-digest - ON HOLD: Sentry app requires review before public use

// Design & Creative
export { default as designPortfolioSync } from './design-portfolio-sync/index.js';

// Scheduling & Meetings
export { default as schedulingAutopilot } from './scheduling-autopilot/index.js';

// Revenue & Payments
export { default as revenueRadar } from './revenue-radar/index.js';

// Forms & Responses
export { default as formResponseHub } from './form-response-hub/index.js';

// Sales & Deals
export { default as dealTracker } from './deal-tracker/index.js';

// Task Management
export { default as taskSyncBridge } from './task-sync-bridge/index.js';

// Cross-Workspace Sync
export { default as databasesMirrored } from './databases-mirrored/index.js';

// Developer Tools
export { default as issuesSyncedToSprint } from './issues-synced-to-sprint/index.js';
export { default as prReviewNotifier } from './pr-review-notifier/index.js';

// Team Collaboration
export { default as discordStandupBot } from './discord-standup-bot/index.js';

// Google Drive
export { default as documentsOrganized } from './documents-organized/index.js';
export { default as documentApprovalFlow } from './document-approval-flow/index.js';

// Calendar & Status
export { default as calendarAvailabilitySync } from './calendar-availability-sync/index.js';

// Billing & Time Tracking
export { default as meetingExpenseTracker } from './meeting-expense-tracker/index.js';
export { default as projectTimeTracker } from './project-time-tracker/index.js';

// Dental / Healthcare
export { default as dentalAppointmentAutopilot } from './dental-appointment-autopilot/index.js';
export { default as dentalReviewBooster } from './dental-review-booster/index.js';

// Construction
export { default as constructionRFITracker } from './construction-rfi-tracker/index.js';
export { default as constructionDailyLog } from './construction-daily-log/index.js';
export { default as constructionProjectDigest } from './construction-project-digest/index.js';

// ============================================================================
// INTEGRATION PAIR REGISTRY
// ============================================================================

/**
 * Integration Pair Registry
 *
 * Maps integration pairs to their canonical workflow.
 * One pair = one workflow. No comparison shopping.
 *
 * This is the core of the pathway model: users don't browse categories,
 * they have integrations connected, and we surface the right workflow.
 */
export const integrationPairs = {
	// Meetings
	'zoom:notion': {
		workflowId: 'meeting-intelligence',
		outcome: 'Zoom meetings that write their own notes',
		outcomeFrame: 'after_meetings',
	},
	// Browser Workaround (when OAuth not available - NOT typical)
	'zoom-browser:notion': {
		workflowId: 'meeting-intelligence-private',
		outcome: 'Meetings that document themselves (browser workaround)',
		outcomeFrame: 'after_meetings',
		experimental: true,
		requiresCustomInfrastructure: true,
	},
	'zoom:slack': {
		workflowId: 'meeting-intelligence',
		outcome: 'Meeting summaries in Slack',
		outcomeFrame: 'after_meetings',
	},
	'notion:slack': {
		workflowId: 'team-digest',
		outcome: 'Team activity digest',
		outcomeFrame: 'every_morning',
	},
	'calendly:todoist': {
		workflowId: 'meeting-followup-engine',
		outcome: 'Meetings that create their own tasks',
		outcomeFrame: 'after_calls',
	},

	// Calendar Prep (Google Calendar)
	'google-calendar:notion': {
		workflowId: 'calendar-meeting-prep',
		outcome: 'Meetings that brief themselves',
		outcomeFrame: 'before_meetings',
	},
	'google-calendar:slack': {
		workflowId: 'calendar-meeting-prep',
		outcome: 'Meeting briefs in Slack',
		outcomeFrame: 'before_meetings',
	},

	// Meeting Action Items
	'zoom:todoist': {
		workflowId: 'meeting-to-action',
		outcome: 'Meetings that assign themselves',
		outcomeFrame: 'after_meetings',
	},
	'zoom:linear': {
		workflowId: 'meeting-to-action',
		outcome: 'Meeting action items in Linear',
		outcomeFrame: 'after_meetings',
	},

	// Email Sync (BYOO - Private)
	'gmail:notion': {
		workflowId: 'private-emails-documented',
		outcome: 'Important emails that become searchable knowledge',
		outcomeFrame: 'when_emails_arrive',
		experimental: true,
		requiresBYOO: true,
	},

	// Payments
	'stripe:notion': {
		workflowId: 'payments-tracked',
		outcome: 'Payments tracked automatically',
		outcomeFrame: 'when_payments_arrive',
	},
	'notion:stripe': {
		workflowId: 'invoice-generator',
		outcome: 'Projects that invoice themselves',
		outcomeFrame: 'when_payments_arrive',
	},

	// Sales & Leads
	'typeform:hubspot': {
		workflowId: 'sales-lead-pipeline',
		outcome: 'Leads that route themselves',
		outcomeFrame: 'when_leads_come_in',
	},
	'typeform:slack': {
		workflowId: 'sales-lead-pipeline',
		outcome: 'Lead alerts in Slack',
		outcomeFrame: 'when_leads_come_in',
	},

	// Support
	'slack:slack': {
		workflowId: 'support-ticket-router',
		outcome: 'Tickets routed to the right team',
		outcomeFrame: 'when_tickets_arrive',
	},

	// Onboarding
	'stripe:todoist': {
		workflowId: 'client-onboarding',
		outcome: 'Clients onboarded automatically',
		outcomeFrame: 'when_clients_onboard',
	},

	// Productivity
	'todoist:slack': {
		workflowId: 'weekly-productivity-digest',
		outcome: 'Productivity insights weekly',
		outcomeFrame: 'weekly_automatically',
	},

	// Dev Team
	'linear:slack': {
		workflowId: 'sprint-progress-tracker',
		outcome: 'Sprint updates every morning',
		outcomeFrame: 'every_morning',
	},
	'linear:notion': {
		workflowId: 'sprint-progress-tracker',
		outcome: 'Sprint history in Notion',
		outcomeFrame: 'every_morning',
	},

	// Data Sync
	'google-sheets:airtable': {
		workflowId: 'data-stays-consistent',
		outcome: 'Spreadsheets synced to Airtable',
		outcomeFrame: 'when_data_changes',
	},

	// Content
	'airtable:slack': {
		workflowId: 'content-calendar',
		outcome: 'Content reminders in Slack',
		outcomeFrame: 'every_morning',
	},

	// Design & Creative
	'dribbble:notion': {
		workflowId: 'design-portfolio-sync',
		outcome: 'Portfolio that updates itself',
		outcomeFrame: 'after_publishing',
	},
	'dribbble:slack': {
		workflowId: 'design-portfolio-sync',
		outcome: 'New work announced in Slack',
		outcomeFrame: 'after_publishing',
	},

	// Scheduling
	'calendly:notion': {
		workflowId: 'scheduling-autopilot',
		outcome: 'Meetings logged automatically',
		outcomeFrame: 'when_meetings_booked',
	},
	'calendly:slack': {
		workflowId: 'scheduling-autopilot',
		outcome: 'Booking alerts in Slack',
		outcomeFrame: 'when_meetings_booked',
	},

	// Revenue
	'stripe:slack': {
		workflowId: 'revenue-radar',
		outcome: 'Payment alerts in Slack',
		outcomeFrame: 'when_payments_arrive',
	},
	'stripe:hubspot': {
		workflowId: 'revenue-radar',
		outcome: 'Deals update on payment',
		outcomeFrame: 'when_payments_arrive',
	},

	// Forms
	'typeform:notion': {
		workflowId: 'form-response-hub',
		outcome: 'Responses logged to Notion',
		outcomeFrame: 'when_forms_submitted',
	},
	'typeform:airtable': {
		workflowId: 'form-response-hub',
		outcome: 'Responses in Airtable',
		outcomeFrame: 'when_forms_submitted',
	},

	// CRM
	'hubspot:slack': {
		workflowId: 'deal-tracker',
		outcome: 'Deal alerts in Slack',
		outcomeFrame: 'when_deals_progress',
	},
	'hubspot:notion': {
		workflowId: 'deal-tracker',
		outcome: 'Deal history in Notion',
		outcomeFrame: 'when_deals_progress',
	},

	// Tasks
	'todoist:notion': {
		workflowId: 'task-sync-bridge',
		outcome: 'Completed tasks logged to Notion',
		outcomeFrame: 'when_tasks_complete',
	},

	// Cross-Workspace Sync (Notion to Notion)
	'notion:notion': {
		workflowId: 'databases-mirrored',
		outcome: 'Support tickets that sync across workspaces',
		outcomeFrame: 'when_tickets_arrive',
	},
	'notion:notion:support': {
		workflowId: 'databases-mirrored',
		outcome: 'Client tickets that manage themselves',
		outcomeFrame: 'when_tickets_arrive',
	},
	'notion:notion:updates': {
		workflowId: 'databases-mirrored',
		outcome: 'Agentic updates between workspaces',
		outcomeFrame: 'when_data_changes',
	},

	// Error Tracking & Incidents (WORKWAY Dogfooding!)
	'sentry:notion': {
		workflowId: 'error-incident-manager',
		outcome: 'Errors that document themselves',
		outcomeFrame: 'when_errors_happen',
	},
	'sentry:slack': {
		workflowId: 'error-incident-manager',
		outcome: 'Error alerts in Slack',
		outcomeFrame: 'when_errors_happen',
	},

	// Developer Tools
	'github:linear': {
		workflowId: 'issues-synced-to-sprint',
		outcome: 'Issues synced to Linear',
		outcomeFrame: 'when_issues_arrive',
	},
	'github:slack': {
		workflowId: 'pr-review-notifier',
		outcome: 'PR alerts in Slack',
		outcomeFrame: 'when_code_changes',
	},
	'github:discord': {
		workflowId: 'pr-review-notifier',
		outcome: 'PR alerts in Discord',
		outcomeFrame: 'when_code_changes',
	},

	// Team Collaboration
	'discord:notion': {
		workflowId: 'discord-standup-bot',
		outcome: 'Standups archived to Notion',
		outcomeFrame: 'every_morning',
	},

	// Google Drive
	'google-drive:notion': {
		workflowId: 'documents-organized',
		outcome: 'Documents that organize themselves',
		outcomeFrame: 'when_files_change',
	},
	'google-drive:slack': {
		workflowId: 'documents-organized',
		outcome: 'File updates in Slack',
		outcomeFrame: 'when_files_change',
	},

	// Document Approval
	'google-drive:slack:approval': {
		workflowId: 'document-approval-flow',
		outcome: 'Documents that approve themselves',
		outcomeFrame: 'when_approval_needed',
	},

	// Calendar Status Sync
	'google-calendar:slack:status': {
		workflowId: 'calendar-availability-sync',
		outcome: 'Status that updates itself',
		outcomeFrame: 'always_current',
	},

	// Meeting Billing
	'zoom:stripe': {
		workflowId: 'meeting-expense-tracker',
		outcome: 'Meetings that invoice themselves',
		outcomeFrame: 'after_meetings',
	},
	'zoom:notion:billing': {
		workflowId: 'meeting-expense-tracker',
		outcome: 'Meeting time logged to Notion',
		outcomeFrame: 'after_meetings',
	},

	// Project Time Tracking
	'linear:google-sheets': {
		workflowId: 'project-time-tracker',
		outcome: 'Time that tracks itself',
		outcomeFrame: 'when_work_completes',
	},
	'linear:slack:time': {
		workflowId: 'project-time-tracker',
		outcome: 'Time reports in Slack',
		outcomeFrame: 'when_work_completes',
	},

	// Dental / Healthcare
	'sikka:slack': {
		workflowId: 'dental-appointment-autopilot',
		outcome: 'No-shows that prevent themselves',
		outcomeFrame: 'when_appointments_scheduled',
	},
	'sikka:twilio': {
		workflowId: 'dental-appointment-autopilot',
		outcome: 'Smart appointment reminders',
		outcomeFrame: 'when_appointments_scheduled',
	},
	'sikka:google-business': {
		workflowId: 'dental-review-booster',
		outcome: 'Visits become Google reviews',
		outcomeFrame: 'after_appointments',
	},
	'sikka:yelp': {
		workflowId: 'dental-review-booster',
		outcome: 'Visits become Yelp reviews',
		outcomeFrame: 'after_appointments',
	},

	// Construction
	'procore:slack': {
		workflowId: 'construction-rfi-tracker',
		outcome: 'RFIs that get answered',
		outcomeFrame: 'when_rfis_need_answers',
	},
	'procore:notion': {
		workflowId: 'construction-rfi-tracker',
		outcome: 'RFI history documented automatically',
		outcomeFrame: 'when_rfis_need_answers',
	},
	'procore:slack:dailylog': {
		workflowId: 'construction-daily-log',
		outcome: 'Daily logs that write themselves',
		outcomeFrame: 'end_of_day',
	},
	'procore:notion:dailylog': {
		workflowId: 'construction-daily-log',
		outcome: 'Daily logs archived to Notion',
		outcomeFrame: 'end_of_day',
	},
	'procore:slack:digest': {
		workflowId: 'construction-project-digest',
		outcome: 'Projects that report themselves',
		outcomeFrame: 'weekly_automatically',
	},
	'procore:notion:digest': {
		workflowId: 'construction-project-digest',
		outcome: 'Weekly reports archived to Notion',
		outcomeFrame: 'weekly_automatically',
	},
} as const;

export type IntegrationPairKey = keyof typeof integrationPairs;

/**
 * Get the canonical workflow for an integration pair
 *
 * @example
 * const workflow = getWorkflowForPair('zoom', 'notion');
 * // Returns: { workflowId: 'meeting-intelligence', outcome: '...', outcomeFrame: '...' }
 */
export function getWorkflowForPair(from: string, to: string) {
	const key = `${from.toLowerCase()}:${to.toLowerCase()}` as IntegrationPairKey;
	return integrationPairs[key] || null;
}

/**
 * Get all integration pairs for a specific outcome frame
 *
 * @example
 * const meetingPairs = getPairsForOutcome('after_meetings');
 * // Returns: [{ from: 'zoom', to: 'notion', ... }, { from: 'zoom', to: 'slack', ... }]
 */
export function getPairsForOutcome(outcomeFrame: string) {
	return Object.entries(integrationPairs)
		.filter(([, value]) => value.outcomeFrame === outcomeFrame)
		.map(([key, value]) => {
			const [from, to] = key.split(':');
			return { from, to, ...value };
		});
}

/**
 * Get all integration pairs that include a specific integration
 *
 * @example
 * const zoomPairs = getPairsForIntegration('zoom');
 * // Returns all pairs where zoom is either source or destination
 */
export function getPairsForIntegration(integration: string) {
	const normalized = integration.toLowerCase();
	return Object.entries(integrationPairs)
		.filter(([key]) => {
			const [from, to] = key.split(':');
			return from === normalized || to === normalized;
		})
		.map(([key, value]) => {
			const [from, to] = key.split(':');
			return { from, to, ...value };
		});
}

// ============================================================================
// OUTCOME FRAMES
// ============================================================================

/**
 * Outcome frames - verb-driven discovery taxonomy
 *
 * Users don't think in categories ("productivity", "finance").
 * They think in situations: "After meetings...", "When payments arrive..."
 */
export const outcomeFrames = {
	before_meetings: {
		label: 'Before meetings...',
		description: 'Prepare context and talking points automatically',
	},
	after_meetings: {
		label: 'After meetings...',
		description: 'Automate what happens when meetings end',
	},
	when_payments_arrive: {
		label: 'When payments arrive...',
		description: 'Track, invoice, and follow up on payments',
	},
	when_leads_come_in: {
		label: 'When leads come in...',
		description: 'Route leads to your CRM and team',
	},
	weekly_automatically: {
		label: 'Weekly, automatically...',
		description: 'Digests, reports, and summaries',
	},
	when_tickets_arrive: {
		label: 'When tickets arrive...',
		description: 'Route and analyze support requests',
	},
	every_morning: {
		label: 'Every morning...',
		description: 'Daily standups, digests, briefings',
	},
	when_clients_onboard: {
		label: 'When clients onboard...',
		description: 'Automate client and team onboarding',
	},
	after_calls: {
		label: 'After calls...',
		description: 'Follow-ups and task creation',
	},
	when_data_changes: {
		label: 'When data changes...',
		description: 'Sync and transform data automatically',
	},
	after_publishing: {
		label: 'After publishing...',
		description: 'Sync creative work across platforms',
	},
	when_meetings_booked: {
		label: 'When meetings are booked...',
		description: 'Log bookings and notify your team',
	},
	when_forms_submitted: {
		label: 'When forms are submitted...',
		description: 'Route responses to your databases',
	},
	when_deals_progress: {
		label: 'When deals progress...',
		description: 'Track deal movement and celebrate wins',
	},
	when_tasks_complete: {
		label: 'When tasks complete...',
		description: 'Build a productivity journal automatically',
	},
	when_emails_arrive: {
		label: 'When important emails arrive...',
		description: 'Sync emails to your knowledge base',
	},
	when_errors_happen: {
		label: 'When errors happen...',
		description: 'Document incidents and alert your team',
	},
	when_issues_arrive: {
		label: 'When issues arrive...',
		description: 'Sync issues across platforms automatically',
	},
	when_code_changes: {
		label: 'When code changes...',
		description: 'PR notifications and code review reminders',
	},
	when_files_change: {
		label: 'When files change...',
		description: 'Sync documents and notify your team',
	},
	when_approval_needed: {
		label: 'When approval is needed...',
		description: 'Request approvals and track decisions',
	},
	always_current: {
		label: 'Always current...',
		description: 'Keep status and availability in sync',
	},
	when_work_completes: {
		label: 'When work completes...',
		description: 'Track time and sync to reports',
	},

	// Dental / Healthcare
	when_appointments_scheduled: {
		label: 'When appointments are scheduled...',
		description: 'Reduce no-shows with smart reminders',
	},
	after_appointments: {
		label: 'After patient visits...',
		description: 'Turn happy patients into reviews',
	},

	// Construction
	when_rfis_need_answers: {
		label: 'When RFIs need answers...',
		description: 'Track and escalate open RFIs automatically',
	},
	end_of_day: {
		label: 'At end of day...',
		description: 'Daily logs and site reports',
	},
} as const;

export type OutcomeFrameId = keyof typeof outcomeFrames;

// ============================================================================
// LEGACY EXPORTS (Deprecated)
// ============================================================================

/**
 * @deprecated Use integrationPairs and getWorkflowForPair() instead.
 * Category-based organization is being replaced by the pathway model.
 */
export const workflows = {
	'payments-tracked': { id: 'payments-tracked', outcomeFrame: 'when_payments_arrive' },
	'support-ticket-router': { id: 'support-ticket-router', outcomeFrame: 'when_tickets_arrive' },
	'team-digest': { id: 'team-digest', outcomeFrame: 'every_morning' },
	// 'ai-newsletter' - DEPRECATED: Requires Gmail
	'meeting-summarizer': { id: 'meeting-summarizer', outcomeFrame: 'after_meetings' },
	// 'feedback-analyzer' - DEPRECATED: Requires Gmail
	'invoice-generator': { id: 'invoice-generator', outcomeFrame: 'when_payments_arrive' },
	// 'payment-reminders' - DEPRECATED: Requires Gmail
	'onboarding': { id: 'onboarding', outcomeFrame: 'when_clients_onboard' },
	'standup-bot': { id: 'standup-bot', outcomeFrame: 'every_morning' },
	'meeting-intelligence': { id: 'meeting-intelligence', outcomeFrame: 'after_meetings' },
	'meeting-intelligence-private': { id: 'meeting-intelligence-private', outcomeFrame: 'after_meetings', experimental: true },
	'sales-lead-pipeline': { id: 'sales-lead-pipeline', outcomeFrame: 'when_leads_come_in' },
	'client-onboarding': { id: 'client-onboarding', outcomeFrame: 'when_clients_onboard' },
	'meeting-followup-engine': { id: 'meeting-followup-engine', outcomeFrame: 'after_calls' },
	'weekly-productivity-digest': { id: 'weekly-productivity-digest', outcomeFrame: 'weekly_automatically' },
	'sprint-progress-tracker': { id: 'sprint-progress-tracker', outcomeFrame: 'every_morning' },
	'data-stays-consistent': { id: 'data-stays-consistent', outcomeFrame: 'when_data_changes' },
	'content-calendar': { id: 'content-calendar', outcomeFrame: 'every_morning' },
	'design-portfolio-sync': { id: 'design-portfolio-sync', outcomeFrame: 'after_publishing' },
	'scheduling-autopilot': { id: 'scheduling-autopilot', outcomeFrame: 'when_meetings_booked' },
	'revenue-radar': { id: 'revenue-radar', outcomeFrame: 'when_payments_arrive' },
	'form-response-hub': { id: 'form-response-hub', outcomeFrame: 'when_forms_submitted' },
	'deal-tracker': { id: 'deal-tracker', outcomeFrame: 'when_deals_progress' },
	'task-sync-bridge': { id: 'task-sync-bridge', outcomeFrame: 'when_tasks_complete' },
	// Email Sync (Private - BYOO)
	'private-emails-documented': { id: 'private-emails-documented', outcomeFrame: 'when_emails_arrive', experimental: true },
	// Cross-Workspace Sync
	'databases-mirrored': { id: 'databases-mirrored', outcomeFrame: 'when_tickets_arrive' },
	'error-incident-manager': { id: 'error-incident-manager', outcomeFrame: 'when_errors_happen' },
	'issues-synced-to-sprint': { id: 'issues-synced-to-sprint', outcomeFrame: 'when_issues_arrive' },
	'pr-review-notifier': { id: 'pr-review-notifier', outcomeFrame: 'when_code_changes' },
	'discord-standup-bot': { id: 'discord-standup-bot', outcomeFrame: 'every_morning' },
	'calendar-meeting-prep': { id: 'calendar-meeting-prep', outcomeFrame: 'before_meetings' },
	'meeting-to-action': { id: 'meeting-to-action', outcomeFrame: 'after_meetings' },
	'documents-organized': { id: 'documents-organized', outcomeFrame: 'when_files_change' },
	'document-approval-flow': { id: 'document-approval-flow', outcomeFrame: 'when_approval_needed' },
	'calendar-availability-sync': { id: 'calendar-availability-sync', outcomeFrame: 'always_current' },
	'meeting-expense-tracker': { id: 'meeting-expense-tracker', outcomeFrame: 'after_meetings' },
	'project-time-tracker': { id: 'project-time-tracker', outcomeFrame: 'when_work_completes' },
	// Dental / Healthcare
	'dental-appointment-autopilot': { id: 'dental-appointment-autopilot', outcomeFrame: 'when_appointments_scheduled' },
	'dental-review-booster': { id: 'dental-review-booster', outcomeFrame: 'after_appointments' },
	// Construction
	'construction-rfi-tracker': { id: 'construction-rfi-tracker', outcomeFrame: 'when_rfis_need_answers' },
	'construction-daily-log': { id: 'construction-daily-log', outcomeFrame: 'end_of_day' },
	'construction-project-digest': { id: 'construction-project-digest', outcomeFrame: 'weekly_automatically' },
} as const;

export type WorkflowId = keyof typeof workflows;
