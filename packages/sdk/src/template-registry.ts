/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Template Registry
 *
 * Manages marketplace templates - the pre-built workflows
 * that users can browse and install.
 *
 * This bridges the UI display with actual template data,
 * replacing hardcoded mock data with queryable structures.
 */

// ============================================================================
// OUTCOME FRAMES (Heideggerian Pathway Model)
// ============================================================================

/**
 * Outcome frame IDs - verb-driven discovery taxonomy
 *
 * Users don't think in categories ("productivity", "finance").
 * They think in situations: "After meetings...", "When payments arrive..."
 *
 * For full definitions, see: @workwayco/workflows.outcomeFrames
 */
export type OutcomeFrameId =
	| 'after_meetings'
	| 'when_payments_arrive'
	| 'when_leads_come_in'
	| 'weekly_automatically'
	| 'when_tickets_arrive'
	| 'every_morning'
	| 'when_clients_onboard'
	| 'after_calls'
	| 'when_data_changes'
	| 'after_publishing'
	| 'when_meetings_booked'
	| 'when_forms_submitted'
	| 'when_deals_progress'
	| 'when_tasks_complete';

/**
 * Outcome frame definitions (re-exported for convenience)
 *
 * Primary source: @workwayco/workflows.outcomeFrames
 */
export const OUTCOME_FRAMES: Record<OutcomeFrameId, { label: string; description: string }> = {
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
};

// ============================================================================
// TEMPLATE CATEGORIES (DEPRECATED)
// ============================================================================

/**
 * @deprecated Use outcomeFrames from @workwayco/workflows instead.
 *
 * Legacy category taxonomy violates Zuhandenheit:
 * - "Productivity" is vague (violates "specificity over generality")
 * - Categories make the tool visible (Vorhandenheit)
 * - Users think in situations, not categories
 *
 * Migration:
 * ```typescript
 * // Before (legacy)
 * import { TEMPLATE_CATEGORIES } from '@workwayco/sdk';
 *
 * // After (Heideggerian pathway model)
 * import { outcomeFrames } from '@workwayco/workflows';
 * // or
 * import { OUTCOME_FRAMES } from '@workwayco/sdk';
 * ```
 *
 * See: docs/OUTCOME_TAXONOMY.md
 */
export const TEMPLATE_CATEGORIES = [
	{
		id: 'productivity',
		name: 'Productivity',
		description: 'Automate repetitive tasks and streamline your workflow',
		icon: 'FileText',
	},
	{
		id: 'communication',
		name: 'Communication',
		description: 'Stay connected and informed across all your platforms',
		icon: 'MessageSquare',
	},
	{
		id: 'content-creation',
		name: 'Content Creation',
		description: 'AI-powered content generation and management',
		icon: 'Bot',
	},
	{
		id: 'data-analytics',
		name: 'Data & Analytics',
		description: 'Track metrics and visualize data automatically',
		icon: 'ChartNoAxesColumnIncreasing',
	},
	{
		id: 'finance-billing',
		name: 'Finance & Billing',
		description: 'Automate invoicing, payments, and financial tracking',
		icon: 'CreditCard',
	},
	{
		id: 'team-management',
		name: 'Team Management',
		description: 'Coordinate teams and manage projects effortlessly',
		icon: 'Users',
	},
] as const;

export type TemplateCategoryId = (typeof TEMPLATE_CATEGORIES)[number]['id'];

// ============================================================================
// MARKETPLACE TEMPLATE TYPE
// ============================================================================

/**
 * A marketplace template - what users see when browsing
 *
 * This type matches the UI display requirements:
 * - Name, description, tags
 * - Integrations used
 * - Popularity metrics (rating, users)
 * - Featured status
 */
export interface MarketplaceTemplate {
	/** Unique identifier */
	id: string;

	/** Display name */
	name: string;

	/** Short description */
	description: string;

	/** @deprecated Use outcomeFrame instead */
	category: TemplateCategoryId;

	/** Outcome frame (Heideggerian pathway model) */
	outcomeFrame?: OutcomeFrameId;

	/** Integration tags (e.g., ['Stripe', 'Notion']) */
	integrations: string[];

	/** Popularity metrics */
	stats: {
		/** Average rating (1-5) */
		rating: number;
		/** Number of active users */
		users: number;
		/** Number of reviews */
		reviews: number;
	};

	/** Featured/popular status */
	featured: boolean;

	/** Template status */
	status: 'active' | 'coming_soon' | 'deprecated';

	/** Developer who created it */
	developerId: string;

	/** When the template was published */
	publishedAt: string;

	/** Pricing model */
	pricing: {
		model: 'free' | 'paid' | 'freemium';
		price?: number;
		trialDays?: number;
	};

	/** The workflow definition ID (links to actual workflow) */
	workflowId?: string;
}

// ============================================================================
// SEED TEMPLATES (Replace with D1/KV in production)
// ============================================================================

/**
 * Seed templates matching the UI display
 *
 * In production, these would come from:
 * - D1 database (templates table)
 * - KV store (for caching)
 * - R2 (for template source code)
 */
export const SEED_TEMPLATES: MarketplaceTemplate[] = [
	// When payments arrive...
	{
		id: 'stripe-to-notion-invoice',
		name: 'Stripe to Notion Invoice Tracker',
		description: 'Automatically log all Stripe payments to your Notion database',
		category: 'productivity',
		outcomeFrame: 'when_payments_arrive',
		integrations: ['Stripe', 'Notion'],
		stats: { rating: 4.9, users: 1247, reviews: 89 },
		featured: true,
		status: 'active',
		developerId: 'workway-official',
		publishedAt: '2024-06-15',
		pricing: { model: 'freemium', price: 9, trialDays: 14 },
	},
	// When data changes...
	{
		id: 'linear-to-notion-sync',
		name: 'Linear to Notion Sync',
		description: 'Keep your Linear issues in sync with Notion',
		category: 'productivity',
		outcomeFrame: 'when_data_changes',
		integrations: ['Linear', 'Notion'],
		stats: { rating: 4.9, users: 1134, reviews: 67 },
		featured: true,
		status: 'active',
		developerId: 'workway-official',
		publishedAt: '2024-07-01',
		pricing: { model: 'freemium', price: 9, trialDays: 14 },
	},
	// When meetings are booked...
	{
		id: 'calendar-to-task-manager',
		name: 'Calendar to Task Manager',
		description: 'Convert calendar events into actionable tasks automatically',
		category: 'productivity',
		outcomeFrame: 'when_meetings_booked',
		integrations: ['Google Calendar', 'Notion'],
		stats: { rating: 4.7, users: 892, reviews: 45 },
		featured: false,
		status: 'active',
		developerId: 'workway-official',
		publishedAt: '2024-08-10',
		pricing: { model: 'freemium', price: 5, trialDays: 7 },
	},

	// When data changes...
	{
		id: 'github-to-slack-notifier',
		name: 'GitHub to Slack Notifier',
		description: 'Get instant Slack notifications for GitHub events',
		category: 'communication',
		outcomeFrame: 'when_data_changes',
		integrations: ['GitHub', 'Slack'],
		stats: { rating: 4.9, users: 1589, reviews: 112 },
		featured: true,
		status: 'active',
		developerId: 'workway-official',
		publishedAt: '2024-05-20',
		pricing: { model: 'free' },
	},
	// When tickets arrive...
	{
		id: 'smart-support-ticket-router',
		name: 'Smart Support Ticket Router',
		description: 'AI categorizes support tickets and routes them automatically',
		category: 'communication',
		outcomeFrame: 'when_tickets_arrive',
		integrations: ['Slack', 'AI'],
		stats: { rating: 4.7, users: 678, reviews: 34 },
		featured: false,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-09-05',
		pricing: { model: 'paid', price: 19, trialDays: 7 },
	},
	// Every morning...
	{
		id: 'team-digest-generator',
		name: 'Team Digest Generator',
		description: 'Daily digest of team activity across all tools',
		category: 'communication',
		outcomeFrame: 'every_morning',
		integrations: ['Slack', 'Gmail', 'Notion'],
		stats: { rating: 4.6, users: 543, reviews: 28 },
		featured: false,
		status: 'active',
		developerId: 'productivity-labs',
		publishedAt: '2024-09-15',
		pricing: { model: 'freemium', price: 12, trialDays: 14 },
	},

	// Every morning...
	{
		id: 'daily-ai-newsletter',
		name: 'Daily AI Newsletter',
		description: 'Generate personalized newsletters based on your interests',
		category: 'content-creation',
		outcomeFrame: 'every_morning',
		integrations: ['Gmail', 'AI'],
		stats: { rating: 4.8, users: 892, reviews: 56 },
		featured: true,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-08-01',
		pricing: { model: 'paid', price: 15, trialDays: 7 },
	},
	// After publishing...
	{
		id: 'social-media-content-generator',
		name: 'Social Media Content Generator',
		description: 'AI creates social media posts from your blog articles',
		category: 'content-creation',
		outcomeFrame: 'after_publishing',
		integrations: ['AI', 'Twitter', 'LinkedIn'],
		stats: { rating: 4.7, users: 756, reviews: 41 },
		featured: false,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-08-20',
		pricing: { model: 'paid', price: 19, trialDays: 7 },
	},
	// After meetings...
	{
		id: 'meeting-notes-summarizer',
		name: 'Meeting Notes Summarizer',
		description: 'AI-generated summaries with action items',
		category: 'content-creation',
		outcomeFrame: 'after_meetings',
		integrations: ['AI', 'Notion', 'Slack'],
		stats: { rating: 4.8, users: 743, reviews: 38 },
		featured: false,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-09-01',
		pricing: { model: 'paid', price: 12, trialDays: 14 },
	},

	// When payments arrive...
	{
		id: 'sales-dashboard-auto-update',
		name: 'Sales Dashboard Auto-Update',
		description: 'Real-time sales metrics in your Notion dashboard',
		category: 'data-analytics',
		outcomeFrame: 'when_payments_arrive',
		integrations: ['Stripe', 'Notion', 'Airtable'],
		stats: { rating: 4.8, users: 621, reviews: 32 },
		featured: false,
		status: 'active',
		developerId: 'analytics-pro',
		publishedAt: '2024-07-15',
		pricing: { model: 'paid', price: 19, trialDays: 14 },
	},
	// When forms submitted...
	{
		id: 'customer-feedback-analyzer',
		name: 'Customer Feedback Analyzer',
		description: 'AI analyzes customer feedback and extracts insights',
		category: 'data-analytics',
		outcomeFrame: 'when_forms_submitted',
		integrations: ['AI', 'Gmail', 'Notion'],
		stats: { rating: 4.6, users: 478, reviews: 24 },
		featured: false,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-09-10',
		pricing: { model: 'paid', price: 15, trialDays: 7 },
	},
	// Weekly, automatically...
	{
		id: 'weekly-metrics-report',
		name: 'Weekly Metrics Report',
		description: 'Automated weekly report sent to your inbox',
		category: 'data-analytics',
		outcomeFrame: 'weekly_automatically',
		integrations: ['Airtable', 'Gmail'],
		stats: { rating: 4.7, users: 534, reviews: 27 },
		featured: false,
		status: 'active',
		developerId: 'analytics-pro',
		publishedAt: '2024-08-25',
		pricing: { model: 'freemium', price: 9, trialDays: 14 },
	},

	// When payments arrive...
	{
		id: 'invoice-generator',
		name: 'Invoice Generator',
		description: 'Create and send invoices from project completion',
		category: 'finance-billing',
		outcomeFrame: 'when_payments_arrive',
		integrations: ['Stripe', 'Gmail', 'Notion'],
		stats: { rating: 4.9, users: 983, reviews: 67 },
		featured: false,
		status: 'active',
		developerId: 'finance-tools',
		publishedAt: '2024-06-01',
		pricing: { model: 'paid', price: 15, trialDays: 14 },
	},
	// When payments arrive...
	{
		id: 'expense-tracker',
		name: 'Expense Tracker',
		description: 'Automatically categorize and track expenses',
		category: 'finance-billing',
		outcomeFrame: 'when_payments_arrive',
		integrations: ['Gmail', 'Airtable'],
		stats: { rating: 4.6, users: 687, reviews: 35 },
		featured: false,
		status: 'active',
		developerId: 'finance-tools',
		publishedAt: '2024-07-20',
		pricing: { model: 'freemium', price: 9, trialDays: 14 },
	},
	// When payments arrive...
	{
		id: 'payment-reminder-system',
		name: 'Payment Reminder System',
		description: 'Send automated payment reminders to clients',
		category: 'finance-billing',
		outcomeFrame: 'when_payments_arrive',
		integrations: ['Stripe', 'Gmail'],
		stats: { rating: 4.7, users: 812, reviews: 42 },
		featured: false,
		status: 'active',
		developerId: 'finance-tools',
		publishedAt: '2024-08-05',
		pricing: { model: 'paid', price: 12, trialDays: 7 },
	},

	// When clients onboard...
	{
		id: 'onboarding-automation',
		name: 'Onboarding Automation',
		description: 'Automate new team member onboarding process',
		category: 'team-management',
		outcomeFrame: 'when_clients_onboard',
		integrations: ['Notion', 'Slack', 'Gmail'],
		stats: { rating: 4.8, users: 456, reviews: 23 },
		featured: false,
		status: 'active',
		developerId: 'hr-tools',
		publishedAt: '2024-09-01',
		pricing: { model: 'paid', price: 19, trialDays: 14 },
	},
	// Every morning...
	{
		id: 'standup-reminder-bot',
		name: 'Standup Reminder Bot',
		description: 'Collect and share daily standups in Slack',
		category: 'team-management',
		outcomeFrame: 'every_morning',
		integrations: ['Slack', 'Notion'],
		stats: { rating: 4.7, users: 892, reviews: 48 },
		featured: false,
		status: 'active',
		developerId: 'productivity-labs',
		publishedAt: '2024-07-10',
		pricing: { model: 'free' },
	},
	// When forms submitted...
	{
		id: 'time-off-request-handler',
		name: 'Time Off Request Handler',
		description: 'Streamline PTO requests and approvals',
		category: 'team-management',
		outcomeFrame: 'when_forms_submitted',
		integrations: ['Slack', 'Google Calendar', 'Notion'],
		stats: { rating: 4.6, users: 534, reviews: 27 },
		featured: false,
		status: 'active',
		developerId: 'hr-tools',
		publishedAt: '2024-09-20',
		pricing: { model: 'freemium', price: 9, trialDays: 14 },
	},
];

// ============================================================================
// TEMPLATE REGISTRY CLASS
// ============================================================================

/**
 * Template Registry
 *
 * In production, this would be backed by D1/KV.
 * For now, it uses the seed data.
 */
export class TemplateRegistry {
	private templates: Map<string, MarketplaceTemplate>;

	constructor(templates: MarketplaceTemplate[] = SEED_TEMPLATES) {
		this.templates = new Map(templates.map((t) => [t.id, t]));
	}

	/**
	 * Get all templates
	 */
	getAll(): MarketplaceTemplate[] {
		return Array.from(this.templates.values());
	}

	/**
	 * Get template by ID
	 */
	get(id: string): MarketplaceTemplate | undefined {
		return this.templates.get(id);
	}

	/**
	 * @deprecated Use getByOutcomeFrame() instead.
	 * Get templates by category
	 */
	getByCategory(category: TemplateCategoryId): MarketplaceTemplate[] {
		return this.getAll().filter((t) => t.category === category);
	}

	/**
	 * Get templates by outcome frame (Heideggerian pathway model)
	 *
	 * @example
	 * ```typescript
	 * const afterMeetingWorkflows = registry.getByOutcomeFrame('after_meetings');
	 * ```
	 */
	getByOutcomeFrame(frame: OutcomeFrameId): MarketplaceTemplate[] {
		return this.getAll().filter((t) => t.outcomeFrame === frame);
	}

	/**
	 * Get all outcome frames with their templates
	 *
	 * Replaces getAllCategoriesWithTemplates() for the pathway model.
	 */
	getAllOutcomeFramesWithTemplates() {
		return (Object.keys(OUTCOME_FRAMES) as OutcomeFrameId[]).map((frameId) => ({
			id: frameId,
			...OUTCOME_FRAMES[frameId],
			templates: this.getByOutcomeFrame(frameId),
		}));
	}

	/**
	 * Get available outcome frames (only those with templates)
	 */
	getAvailableOutcomeFrames(): Array<{ id: OutcomeFrameId; label: string; description: string; count: number }> {
		return this.getAllOutcomeFramesWithTemplates()
			.filter((frame) => frame.templates.length > 0)
			.map((frame) => ({
				id: frame.id,
				label: frame.label,
				description: frame.description,
				count: frame.templates.length,
			}));
	}

	/**
	 * Get featured templates
	 */
	getFeatured(): MarketplaceTemplate[] {
		return this.getAll().filter((t) => t.featured);
	}

	/**
	 * Get popular templates (sorted by users)
	 */
	getPopular(limit: number = 10): MarketplaceTemplate[] {
		return this.getAll()
			.sort((a, b) => b.stats.users - a.stats.users)
			.slice(0, limit);
	}

	/**
	 * Search templates
	 */
	search(query: string): MarketplaceTemplate[] {
		const lowerQuery = query.toLowerCase();
		return this.getAll().filter(
			(t) =>
				t.name.toLowerCase().includes(lowerQuery) ||
				t.description.toLowerCase().includes(lowerQuery) ||
				t.integrations.some((i) => i.toLowerCase().includes(lowerQuery))
		);
	}

	/**
	 * Get templates by integration
	 */
	getByIntegration(integration: string): MarketplaceTemplate[] {
		return this.getAll().filter((t) =>
			t.integrations.some((i) => i.toLowerCase() === integration.toLowerCase())
		);
	}

	/**
	 * Get category with its templates
	 */
	getCategoryWithTemplates(categoryId: TemplateCategoryId) {
		const category = TEMPLATE_CATEGORIES.find((c) => c.id === categoryId);
		if (!category) return null;

		return {
			...category,
			templates: this.getByCategory(categoryId),
		};
	}

	/**
	 * Get all categories with their templates
	 */
	getAllCategoriesWithTemplates() {
		return TEMPLATE_CATEGORIES.map((category) => ({
			...category,
			templates: this.getByCategory(category.id),
		}));
	}

	/**
	 * Register a new template
	 */
	register(template: MarketplaceTemplate): void {
		this.templates.set(template.id, template);
	}

	/**
	 * Update a template
	 */
	update(id: string, updates: Partial<MarketplaceTemplate>): boolean {
		const existing = this.templates.get(id);
		if (!existing) return false;

		this.templates.set(id, { ...existing, ...updates });
		return true;
	}

	/**
	 * Delete a template
	 */
	delete(id: string): boolean {
		return this.templates.delete(id);
	}
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Default template registry instance
 */
export const templateRegistry = new TemplateRegistry();
