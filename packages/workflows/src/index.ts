/**
 * WORKWAY Marketplace Workflows
 *
 * Pre-built workflow templates for common automation scenarios.
 * Each workflow uses the @workwayco/sdk patterns and integrations.
 *
 * @example
 * ```typescript
 * import { stripeToNotion, metadata as stripeToNotionMeta } from '@workwayco/workflows/stripe-to-notion';
 * import { supportTicketRouter } from '@workwayco/workflows/support-ticket-router';
 * ```
 */

// Re-export all workflows for convenience
export { default as stripeToNotion, metadata as stripeToNotionMetadata } from './stripe-to-notion/index.js';
export { default as supportTicketRouter, metadata as supportTicketRouterMetadata } from './support-ticket-router/index.js';
export { default as teamDigest, metadata as teamDigestMetadata } from './team-digest/index.js';
export { default as aiNewsletter, metadata as aiNewsletterMetadata } from './ai-newsletter/index.js';
export { default as meetingSummarizer, metadata as meetingSummarizerMetadata } from './meeting-summarizer/index.js';
export { default as feedbackAnalyzer, metadata as feedbackAnalyzerMetadata } from './feedback-analyzer/index.js';
export { default as invoiceGenerator, metadata as invoiceGeneratorMetadata } from './invoice-generator/index.js';
export { default as paymentReminders, metadata as paymentRemindersMetadata } from './payment-reminders/index.js';
export { default as onboardingAutomation, metadata as onboardingMetadata } from './onboarding/index.js';
export { default as standupBot, standupSummary, metadata as standupMetadata } from './standup-bot/index.js';
export { default as meetingIntelligence, metadata as meetingIntelligenceMetadata } from './meeting-intelligence/index.js';

/**
 * All available workflows with their metadata
 */
export const workflows = {
	'stripe-to-notion': {
		id: 'stripe-to-notion-invoice',
		category: 'finance-billing',
		featured: true,
	},
	'support-ticket-router': {
		id: 'smart-support-ticket-router',
		category: 'customer-support',
		featured: true,
	},
	'team-digest': {
		id: 'team-digest-generator',
		category: 'team-management',
		featured: true,
	},
	'ai-newsletter': {
		id: 'daily-ai-newsletter',
		category: 'marketing-social',
		featured: false,
	},
	'meeting-summarizer': {
		id: 'meeting-notes-summarizer',
		category: 'productivity',
		featured: true,
	},
	'feedback-analyzer': {
		id: 'customer-feedback-analyzer',
		category: 'data-analytics',
		featured: false,
	},
	'invoice-generator': {
		id: 'invoice-generator',
		category: 'finance-billing',
		featured: false,
	},
	'payment-reminders': {
		id: 'payment-reminder-system',
		category: 'finance-billing',
		featured: false,
	},
	'onboarding': {
		id: 'onboarding-automation',
		category: 'team-management',
		featured: false,
	},
	'standup-bot': {
		id: 'standup-reminder-bot',
		category: 'team-management',
		featured: false,
	},
	'meeting-intelligence': {
		id: 'meeting-intelligence',
		category: 'productivity',
		featured: true,
	},
} as const;

export type WorkflowId = keyof typeof workflows;
