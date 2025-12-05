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
export { default as stripeToNotion } from './stripe-to-notion/index.js';
export { default as paymentReminders } from './payment-reminders/index.js';
export { default as invoiceGenerator } from './invoice-generator/index.js';

// Meetings & Productivity
export { default as meetingIntelligence } from './meeting-intelligence/index.js';
export { default as meetingSummarizer } from './meeting-summarizer/index.js';
export { default as meetingFollowupEngine } from './meeting-followup-engine/index.js';
export { default as weeklyProductivityDigest } from './weekly-productivity-digest/index.js';

// Team & Communication
export { default as teamDigest } from './team-digest/index.js';
export { default as standupBot } from './standup-bot/index.js';
export { default as supportTicketRouter } from './support-ticket-router/index.js';

// Sales & Onboarding
export { default as salesLeadPipeline } from './sales-lead-pipeline/index.js';
export { default as clientOnboarding } from './client-onboarding/index.js';
export { default as onboardingAutomation } from './onboarding/index.js';

// Content & Analytics
export { default as aiNewsletter } from './ai-newsletter/index.js';
export { default as feedbackAnalyzer } from './feedback-analyzer/index.js';

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
	'zoom:slack': {
		workflowId: 'meeting-summarizer',
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

	// Payments
	'stripe:notion': {
		workflowId: 'stripe-to-notion',
		outcome: 'Payments tracked automatically',
		outcomeFrame: 'when_payments_arrive',
	},
	'stripe:gmail': {
		workflowId: 'payment-reminders',
		outcome: 'Payment reminders that send themselves',
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
	'gmail:notion': {
		workflowId: 'feedback-analyzer',
		outcome: 'Feedback analyzed with AI',
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
	'stripe-to-notion': { id: 'stripe-to-notion', outcomeFrame: 'when_payments_arrive' },
	'support-ticket-router': { id: 'support-ticket-router', outcomeFrame: 'when_tickets_arrive' },
	'team-digest': { id: 'team-digest', outcomeFrame: 'every_morning' },
	'ai-newsletter': { id: 'ai-newsletter', outcomeFrame: 'every_morning' },
	'meeting-summarizer': { id: 'meeting-summarizer', outcomeFrame: 'after_meetings' },
	'feedback-analyzer': { id: 'feedback-analyzer', outcomeFrame: 'when_tickets_arrive' },
	'invoice-generator': { id: 'invoice-generator', outcomeFrame: 'when_payments_arrive' },
	'payment-reminders': { id: 'payment-reminders', outcomeFrame: 'when_payments_arrive' },
	'onboarding': { id: 'onboarding', outcomeFrame: 'when_clients_onboard' },
	'standup-bot': { id: 'standup-bot', outcomeFrame: 'every_morning' },
	'meeting-intelligence': { id: 'meeting-intelligence', outcomeFrame: 'after_meetings' },
	'sales-lead-pipeline': { id: 'sales-lead-pipeline', outcomeFrame: 'when_leads_come_in' },
	'client-onboarding': { id: 'client-onboarding', outcomeFrame: 'when_clients_onboard' },
	'meeting-followup-engine': { id: 'meeting-followup-engine', outcomeFrame: 'after_calls' },
	'weekly-productivity-digest': { id: 'weekly-productivity-digest', outcomeFrame: 'weekly_automatically' },
} as const;

export type WorkflowId = keyof typeof workflows;
