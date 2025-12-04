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
// TEMPLATE CATEGORIES
// ============================================================================

/**
 * Template category definitions
 * Maps to the UI "Templates by Category" section
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

	/** Category ID */
	category: TemplateCategoryId;

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
	// Productivity
	{
		id: 'stripe-to-notion-invoice',
		name: 'Stripe to Notion Invoice Tracker',
		description: 'Automatically log all Stripe payments to your Notion database',
		category: 'productivity',
		integrations: ['Stripe', 'Notion'],
		stats: { rating: 4.9, users: 1247, reviews: 89 },
		featured: true,
		status: 'active',
		developerId: 'workway-official',
		publishedAt: '2024-06-15',
		pricing: { model: 'freemium', price: 9, trialDays: 14 },
	},
	{
		id: 'linear-to-notion-sync',
		name: 'Linear to Notion Sync',
		description: 'Keep your Linear issues in sync with Notion',
		category: 'productivity',
		integrations: ['Linear', 'Notion'],
		stats: { rating: 4.9, users: 1134, reviews: 67 },
		featured: true,
		status: 'active',
		developerId: 'workway-official',
		publishedAt: '2024-07-01',
		pricing: { model: 'freemium', price: 9, trialDays: 14 },
	},
	{
		id: 'calendar-to-task-manager',
		name: 'Calendar to Task Manager',
		description: 'Convert calendar events into actionable tasks automatically',
		category: 'productivity',
		integrations: ['Google Calendar', 'Notion'],
		stats: { rating: 4.7, users: 892, reviews: 45 },
		featured: false,
		status: 'active',
		developerId: 'workway-official',
		publishedAt: '2024-08-10',
		pricing: { model: 'freemium', price: 5, trialDays: 7 },
	},

	// Communication
	{
		id: 'github-to-slack-notifier',
		name: 'GitHub to Slack Notifier',
		description: 'Get instant Slack notifications for GitHub events',
		category: 'communication',
		integrations: ['GitHub', 'Slack'],
		stats: { rating: 4.9, users: 1589, reviews: 112 },
		featured: true,
		status: 'active',
		developerId: 'workway-official',
		publishedAt: '2024-05-20',
		pricing: { model: 'free' },
	},
	{
		id: 'smart-support-ticket-router',
		name: 'Smart Support Ticket Router',
		description: 'AI categorizes support tickets and routes them automatically',
		category: 'communication',
		integrations: ['Slack', 'AI'],
		stats: { rating: 4.7, users: 678, reviews: 34 },
		featured: false,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-09-05',
		pricing: { model: 'paid', price: 19, trialDays: 7 },
	},
	{
		id: 'team-digest-generator',
		name: 'Team Digest Generator',
		description: 'Daily digest of team activity across all tools',
		category: 'communication',
		integrations: ['Slack', 'Gmail', 'Notion'],
		stats: { rating: 4.6, users: 543, reviews: 28 },
		featured: false,
		status: 'active',
		developerId: 'productivity-labs',
		publishedAt: '2024-09-15',
		pricing: { model: 'freemium', price: 12, trialDays: 14 },
	},

	// Content Creation
	{
		id: 'daily-ai-newsletter',
		name: 'Daily AI Newsletter',
		description: 'Generate personalized newsletters based on your interests',
		category: 'content-creation',
		integrations: ['Gmail', 'AI'],
		stats: { rating: 4.8, users: 892, reviews: 56 },
		featured: true,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-08-01',
		pricing: { model: 'paid', price: 15, trialDays: 7 },
	},
	{
		id: 'social-media-content-generator',
		name: 'Social Media Content Generator',
		description: 'AI creates social media posts from your blog articles',
		category: 'content-creation',
		integrations: ['AI', 'Twitter', 'LinkedIn'],
		stats: { rating: 4.7, users: 756, reviews: 41 },
		featured: false,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-08-20',
		pricing: { model: 'paid', price: 19, trialDays: 7 },
	},
	{
		id: 'meeting-notes-summarizer',
		name: 'Meeting Notes Summarizer',
		description: 'AI-generated summaries with action items',
		category: 'content-creation',
		integrations: ['AI', 'Notion', 'Slack'],
		stats: { rating: 4.8, users: 743, reviews: 38 },
		featured: false,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-09-01',
		pricing: { model: 'paid', price: 12, trialDays: 14 },
	},

	// Data & Analytics
	{
		id: 'sales-dashboard-auto-update',
		name: 'Sales Dashboard Auto-Update',
		description: 'Real-time sales metrics in your Notion dashboard',
		category: 'data-analytics',
		integrations: ['Stripe', 'Notion', 'Airtable'],
		stats: { rating: 4.8, users: 621, reviews: 32 },
		featured: false,
		status: 'active',
		developerId: 'analytics-pro',
		publishedAt: '2024-07-15',
		pricing: { model: 'paid', price: 19, trialDays: 14 },
	},
	{
		id: 'customer-feedback-analyzer',
		name: 'Customer Feedback Analyzer',
		description: 'AI analyzes customer feedback and extracts insights',
		category: 'data-analytics',
		integrations: ['AI', 'Gmail', 'Notion'],
		stats: { rating: 4.6, users: 478, reviews: 24 },
		featured: false,
		status: 'active',
		developerId: 'ai-workflows',
		publishedAt: '2024-09-10',
		pricing: { model: 'paid', price: 15, trialDays: 7 },
	},
	{
		id: 'weekly-metrics-report',
		name: 'Weekly Metrics Report',
		description: 'Automated weekly report sent to your inbox',
		category: 'data-analytics',
		integrations: ['Airtable', 'Gmail'],
		stats: { rating: 4.7, users: 534, reviews: 27 },
		featured: false,
		status: 'active',
		developerId: 'analytics-pro',
		publishedAt: '2024-08-25',
		pricing: { model: 'freemium', price: 9, trialDays: 14 },
	},

	// Finance & Billing
	{
		id: 'invoice-generator',
		name: 'Invoice Generator',
		description: 'Create and send invoices from project completion',
		category: 'finance-billing',
		integrations: ['Stripe', 'Gmail', 'Notion'],
		stats: { rating: 4.9, users: 983, reviews: 67 },
		featured: false,
		status: 'active',
		developerId: 'finance-tools',
		publishedAt: '2024-06-01',
		pricing: { model: 'paid', price: 15, trialDays: 14 },
	},
	{
		id: 'expense-tracker',
		name: 'Expense Tracker',
		description: 'Automatically categorize and track expenses',
		category: 'finance-billing',
		integrations: ['Gmail', 'Airtable'],
		stats: { rating: 4.6, users: 687, reviews: 35 },
		featured: false,
		status: 'active',
		developerId: 'finance-tools',
		publishedAt: '2024-07-20',
		pricing: { model: 'freemium', price: 9, trialDays: 14 },
	},
	{
		id: 'payment-reminder-system',
		name: 'Payment Reminder System',
		description: 'Send automated payment reminders to clients',
		category: 'finance-billing',
		integrations: ['Stripe', 'Gmail'],
		stats: { rating: 4.7, users: 812, reviews: 42 },
		featured: false,
		status: 'active',
		developerId: 'finance-tools',
		publishedAt: '2024-08-05',
		pricing: { model: 'paid', price: 12, trialDays: 7 },
	},

	// Team Management
	{
		id: 'onboarding-automation',
		name: 'Onboarding Automation',
		description: 'Automate new team member onboarding process',
		category: 'team-management',
		integrations: ['Notion', 'Slack', 'Gmail'],
		stats: { rating: 4.8, users: 456, reviews: 23 },
		featured: false,
		status: 'active',
		developerId: 'hr-tools',
		publishedAt: '2024-09-01',
		pricing: { model: 'paid', price: 19, trialDays: 14 },
	},
	{
		id: 'standup-reminder-bot',
		name: 'Standup Reminder Bot',
		description: 'Collect and share daily standups in Slack',
		category: 'team-management',
		integrations: ['Slack', 'Notion'],
		stats: { rating: 4.7, users: 892, reviews: 48 },
		featured: false,
		status: 'active',
		developerId: 'productivity-labs',
		publishedAt: '2024-07-10',
		pricing: { model: 'free' },
	},
	{
		id: 'time-off-request-handler',
		name: 'Time Off Request Handler',
		description: 'Streamline PTO requests and approvals',
		category: 'team-management',
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
	 * Get templates by category
	 */
	getByCategory(category: TemplateCategoryId): MarketplaceTemplate[] {
		return this.getAll().filter((t) => t.category === category);
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
