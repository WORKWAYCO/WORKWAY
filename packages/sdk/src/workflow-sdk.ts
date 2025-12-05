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
 * WORKWAY Workflow SDK
 *
 * This SDK provides the foundation for building WORKFLOWS (marketplace products).
 * Workflows COMPOSE integrations together to solve specific user problems.
 *
 * LAYER 2: Built on top of Integration SDK
 *
 * @example
 * ```typescript
 * // Marketplace developers use this to build sellable products
 * export default defineWorkflow({
 *   metadata: {
 *     name: 'Stripe to Notion Invoice Tracker',
 *     category: 'finance',
 *     icon: '💰'
 *   },
 *   pricing: {
 *     model: 'subscription',
 *     price: 5
 *   },
 *   integrations: ['stripe', 'notion'],
 *
 *   async execute({ trigger, actions }) {
 *     const payment = trigger.data;
 *     await actions.notion.createPage({
 *       database: config.notionDatabase,
 *       properties: {
 *         Amount: payment.amount,
 *         Customer: payment.customer
 *       }
 *     });
 *   }
 * })
 * ```
 */

import { z, ZodSchema } from 'zod';
import type { ActionDefinition, ActionContext } from './integration-sdk';

// ============================================================================
// WORKFLOW METADATA
// ============================================================================

/**
 * Metadata about a workflow (for marketplace listing)
 */
export interface WorkflowMetadata {
	/** Unique identifier */
	id: string;

	/** Display name */
	name: string;

	/** Short tagline */
	tagline?: string;

	/** Full description */
	description: string;

	/**
	 * Category (legacy - prefer pathway.outcomeFrame)
	 * @deprecated Use pathway.outcomeFrame for verb-driven discovery
	 */
	category:
		| 'productivity'
		| 'finance'
		| 'sales'
		| 'marketing'
		| 'customer-support'
		| 'hr'
		| 'operations'
		| 'development'
		| 'other';

	/** Icon (emoji or URL) */
	icon: string;

	/** Tags for searchability */
	tags?: string[];

	/** Version (semver) */
	version: string;

	/** Author/developer */
	author: {
		name: string;
		email?: string;
		url?: string;
	};

	/** Screenshots */
	screenshots?: string[];

	/** Demo video */
	videoUrl?: string;

	/**
	 * Pathway metadata for Heideggerian discovery model
	 *
	 * When present, enables:
	 * - Outcome-based discovery (verb-driven frames)
	 * - Contextual suggestions (integration_connected, event_received)
	 * - One-click activation (smart defaults)
	 * - Zuhandenheit scoring (tool recession metrics)
	 *
	 * See: docs/OUTCOME_TAXONOMY.md
	 */
	pathway?: PathwayMetadata;
}

// ============================================================================
// WORKFLOW PRICING
// ============================================================================

/**
 * Pricing configuration for workflow
 */
export interface WorkflowPricing {
	/** Pricing model */
	model: 'free' | 'freemium' | 'subscription' | 'usage' | 'one-time';

	/** Base price (USD, monthly for subscription) */
	price: number;

	/** Free tier limits (for freemium) */
	freeTier?: {
		executionsPerMonth: number;
	};

	/** Usage pricing (for usage-based) */
	usagePricing?: {
		pricePerExecution: number;
		includedExecutions?: number;
	};

	/** Trial period (days) */
	trialDays?: number;
}

// ============================================================================
// WORKFLOW CONFIGURATION
// ============================================================================

/**
 * User-configurable settings for a workflow
 *
 * @example
 * ```typescript
 * configSchema: z.object({
 *   notionDatabase: z.string().describe('Notion database ID'),
 *   slackChannel: z.string().describe('Slack channel for notifications'),
 *   minimumAmount: z.number().describe('Only track invoices above this amount')
 * })
 * ```
 */
export interface WorkflowConfigField {
	/** Field key */
	key: string;

	/** Display label */
	label: string;

	/** Help text */
	description?: string;

	/** Field type */
	type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'integration';

	/** Required field */
	required: boolean;

	/** Default value */
	default?: any;

	/** For select/multiselect */
	options?: Array<{ label: string; value: string }>;

	/** Validation schema */
	schema: ZodSchema;
}

// ============================================================================
// WORKFLOW CONTEXT
// ============================================================================

/**
 * Context provided to workflow during execution
 */
export interface WorkflowContext {
	/** Workflow run ID */
	runId: string;

	/** User who enabled this workflow */
	userId: string;

	/** Installation ID */
	installationId: string;

	/** Trigger data */
	trigger: {
		type: string;
		data: any;
		timestamp: number;
	};

	/** User's configuration */
	config: Record<string, any>;

	/** Integration action helpers */
	actions: ActionHelpers;

	/** Storage for workflow state */
	storage: WorkflowStorage;

	/** Environment */
	env: any;
}

/**
 * Helper interface for executing integration actions
 */
export interface ActionHelpers {
	/** Execute any action by ID */
	execute<TInput = any, TOutput = any>(actionId: string, input: TInput): Promise<TOutput>;

	/** Integration-specific helpers (auto-generated) */
	[integration: string]: any;
}

/**
 * Storage interface for workflow state
 */
export interface WorkflowStorage {
	/** Get value from storage */
	get<T = any>(key: string): Promise<T | null>;

	/** Set value in storage */
	set(key: string, value: any): Promise<void>;

	/** Delete value from storage */
	delete(key: string): Promise<void>;

	/** List all keys */
	keys(): Promise<string[]>;
}

// ============================================================================
// VORHANDENHEIT (BREAKDOWN) TYPES
// ============================================================================

/**
 * Breakdown Severity - When Zuhandenheit fails
 *
 * Heideggerian principle: Tools become visible (Vorhandenheit) when they break.
 * We minimize visibility and provide paths back to invisibility.
 *
 * See: docs/HEIDEGGER_DESIGN.md
 */
export enum BreakdownSeverity {
	/** Auto-recover, user never knows */
	SILENT = 'silent',

	/** Subtle indicator, no action required */
	AMBIENT = 'ambient',

	/** User informed, action optional */
	NOTIFICATION = 'notification',

	/** User must act to proceed */
	BLOCKING = 'blocking',
}

/**
 * Breakdown Event - When a workflow becomes visible
 *
 * The tool recedes in normal use (Zuhandenheit).
 * Breakdown makes the tool visible (Vorhandenheit).
 */
export interface BreakdownEvent {
	/** Type of breakdown */
	type:
		| 'configuration_required' // Missing config
		| 'integration_disconnected' // OAuth expired
		| 'execution_failed' // Runtime error
		| 'rate_limited' // API throttled
		| 'dependency_unavailable'; // Service down

	/** Affected workflow */
	workflowId: string;

	/** When breakdown occurred */
	timestamp: number;

	/** Severity determines visibility */
	severity: BreakdownSeverity;

	/** Human-readable message (outcome-focused) */
	message: string;

	/** Path back to Zuhandenheit */
	recovery: {
		/** Can we auto-recover? */
		automatic: boolean;

		/** Steps if manual recovery needed */
		steps?: string[];

		/** Estimated time to resolution (minutes) */
		estimatedTime?: number;

		/** Action to trigger recovery */
		action?: string;
	};

	/** Original error (for logging, not display) */
	originalError?: Error;
}

/**
 * Breakdown Response - How to handle visibility
 */
export interface BreakdownResponse {
	/** Chosen severity */
	severity: BreakdownSeverity;

	/** Message to show (if any) */
	message?: string;

	/** Recovery action (if any) */
	recoveryAction?: () => Promise<void>;

	/** Estimated time back to Zuhandenheit */
	estimatedRecoveryTime?: number;
}

/**
 * Tool Visibility State
 *
 * Tracks whether a workflow is in Zuhandenheit (invisible) or
 * Vorhandenheit (visible due to breakdown).
 */
export interface ToolVisibilityState {
	/** Is the tool currently invisible (working properly)? */
	zuhandenheit: boolean;

	/** Current breakdown (if any) */
	breakdown?: BreakdownEvent;

	/** History of breakdowns (for pattern detection) */
	breakdownHistory: Array<{
		event: BreakdownEvent;
		resolvedAt?: number;
		resolutionMethod?: 'automatic' | 'manual';
	}>;

	/** Time since last breakdown */
	timeSinceLastBreakdown?: number;

	/** Disappearance score (higher = more invisible) */
	disappearanceScore: number;
}

/**
 * Create a breakdown event with recovery path
 */
export function createBreakdown(
	type: BreakdownEvent['type'],
	workflowId: string,
	message: string,
	options: Partial<BreakdownEvent> = {}
): BreakdownEvent {
	return {
		type,
		workflowId,
		timestamp: Date.now(),
		severity: options.severity ?? BreakdownSeverity.NOTIFICATION,
		message,
		recovery: options.recovery ?? { automatic: false },
		originalError: options.originalError,
	};
}

/**
 * Determine breakdown severity based on error type
 */
export function classifyBreakdown(error: Error): BreakdownSeverity {
	const message = error.message.toLowerCase();

	// Silent recovery for transient issues
	if (message.includes('timeout') || message.includes('retry')) {
		return BreakdownSeverity.SILENT;
	}

	// Ambient for rate limiting (auto-resolves)
	if (message.includes('rate limit') || message.includes('throttle')) {
		return BreakdownSeverity.AMBIENT;
	}

	// Notification for auth issues
	if (message.includes('unauthorized') || message.includes('token expired')) {
		return BreakdownSeverity.NOTIFICATION;
	}

	// Blocking for configuration issues
	if (message.includes('configuration') || message.includes('missing')) {
		return BreakdownSeverity.BLOCKING;
	}

	// Default to notification
	return BreakdownSeverity.NOTIFICATION;
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

/**
 * Complete workflow definition
 *
 * This is what marketplace developers create and publish
 */
export interface WorkflowDefinition<TConfig = any> {
	/** Metadata for marketplace */
	metadata: WorkflowMetadata;

	/** Pricing information */
	pricing: WorkflowPricing;

	/** Required integrations */
	integrations: string[];

	/** Trigger configuration */
	trigger: {
		/** Trigger ID (e.g., 'stripe.payment-succeeded') */
		type: string;

		/** Trigger-specific config */
		config?: any;
	};

	/** User configuration schema */
	configSchema?: ZodSchema<TConfig>;

	/** Configuration fields (for UI generation) */
	configFields?: WorkflowConfigField[];

	/**
	 * Main workflow execution function
	 * This is where the workflow logic lives
	 */
	execute(context: WorkflowContext): Promise<WorkflowResult>;

	/**
	 * Optional: Validate configuration before enabling
	 */
	validateConfig?(config: TConfig, userId: string): Promise<boolean>;

	/**
	 * Optional: Setup hook (called when workflow is enabled)
	 */
	onEnable?(context: WorkflowContext): Promise<void>;

	/**
	 * Optional: Cleanup hook (called when workflow is disabled)
	 */
	onDisable?(context: WorkflowContext): Promise<void>;

	/**
	 * Optional: Error handler
	 */
	onError?(error: Error, context: WorkflowContext): Promise<void>;
}

/**
 * Result of workflow execution
 */
export interface WorkflowResult {
	/** Success or failure */
	success: boolean;

	/** Output data */
	data?: any;

	/** Error message (if failed) */
	error?: string;

	/** Metadata about execution */
	metadata?: {
		actionsExecuted?: number;
		executionTimeMs?: number;
		[key: string]: any;
	};
}

// ============================================================================
// WORKFLOW REGISTRY
// ============================================================================

/**
 * Registry for managing marketplace workflows
 *
 * Similar to ActionRegistry, but for complete workflow products
 */
export class WorkflowRegistry {
	private workflows = new Map<string, WorkflowDefinition>();

	/**
	 * Register a workflow
	 */
	register(workflow: WorkflowDefinition): void {
		this.workflows.set(workflow.metadata.id, workflow);
	}

	/**
	 * Get a workflow by ID
	 */
	get(id: string): WorkflowDefinition | undefined {
		return this.workflows.get(id);
	}

	/**
	 * Get all workflows
	 */
	getAll(): WorkflowDefinition[] {
		return Array.from(this.workflows.values());
	}

	/**
	 * Search workflows
	 */
	search(query: string): WorkflowDefinition[] {
		const lowerQuery = query.toLowerCase();
		return this.getAll().filter(
			(wf) =>
				wf.metadata.name.toLowerCase().includes(lowerQuery) ||
				wf.metadata.description.toLowerCase().includes(lowerQuery) ||
				wf.metadata.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
		);
	}

	/**
	 * Get workflows by category
	 */
	getByCategory(category: string): WorkflowDefinition[] {
		return this.getAll().filter((wf) => wf.metadata.category === category);
	}

	/**
	 * Get workflows by author
	 */
	getByAuthor(authorName: string): WorkflowDefinition[] {
		return this.getAll().filter((wf) => wf.metadata.author.name === authorName);
	}

	/**
	 * Get workflows using a specific integration
	 */
	getByIntegration(integrationId: string): WorkflowDefinition[] {
		return this.getAll().filter((wf) => wf.integrations.includes(integrationId));
	}

	/**
	 * Check if workflow exists
	 */
	has(id: string): boolean {
		return this.workflows.has(id);
	}
}

// ============================================================================
// WORKFLOW BUILDER HELPERS
// ============================================================================

/**
 * Helper function to define a workflow with type safety
 *
 * @example
 * ```typescript
 * export default defineWorkflow({
 *   metadata: { ... },
 *   pricing: { ... },
 *   async execute(context) {
 *     // Implementation
 *   }
 * })
 * ```
 */
export function defineWorkflow<TConfig = any>(definition: WorkflowDefinition<TConfig>): WorkflowDefinition<TConfig> {
	return definition;
}

/**
 * Helper to create config fields with type safety
 */
export function defineConfigField<T extends ZodSchema>(
	key: string,
	schema: T,
	options: Omit<WorkflowConfigField, 'key' | 'schema'>
): WorkflowConfigField {
	return {
		key,
		schema,
		...options,
	};
}

// ============================================================================
// PATHWAY MODEL TYPES (Heideggerian Discovery)
// ============================================================================

/**
 * Outcome frame - temporal, verb-driven discovery
 *
 * Users don't think in categories ("productivity", "finance").
 * They think in situations: "After meetings...", "When payments arrive..."
 *
 * The outcome frame matches the phenomenology of need.
 */
export type OutcomeFrame =
	| 'after_meetings' // "After meetings..." → Meeting Intelligence
	| 'when_payments_arrive' // "When payments arrive..." → Stripe to Notion
	| 'when_leads_come_in' // "When leads come in..." → Sales Lead Pipeline
	| 'weekly_automatically' // "Weekly, automatically..." → Team Digest
	| 'when_tickets_arrive' // "When tickets arrive..." → Support Router
	| 'every_morning' // "Every morning..." → Daily Standup
	| 'when_clients_onboard' // "When clients onboard..." → Client Onboarding
	| 'after_calls'; // "After calls..." → Call Followup

/**
 * Human-readable outcome statement
 *
 * Not: "Meeting Intelligence Workflow"
 * But: "Zoom meetings that write their own notes"
 *
 * This is what users see in suggestions.
 */
export interface OutcomeStatement {
	/** The question we ask: "Want meeting notes in Notion automatically?" */
	suggestion: string;

	/** Brief explanation: "After Zoom meetings, we'll create a Notion page..." */
	explanation: string;

	/** The outcome achieved: "Meeting notes in Notion" */
	outcome: string;
}

/**
 * Discovery moment - when to surface a workflow suggestion
 *
 * Instead of users visiting a marketplace, workflows surface at moments of relevance.
 * The marketplace dissolves into the user's workflow.
 */
export interface DiscoveryMoment {
	/** When this moment occurs */
	trigger: 'integration_connected' | 'event_received' | 'time_based' | 'pattern_detected';

	/** What integrations are involved */
	integrations: string[];

	/** The workflow to suggest */
	workflowId: string;

	/** Priority (for when multiple moments match) */
	priority: number;

	/** Optional: specific event type that triggers this (e.g., 'zoom.meeting.ended') */
	eventType?: string;

	/** Optional: pattern detection config */
	pattern?: {
		action: string; // "manual_notion_page_creation"
		threshold: number; // 3 times
		period: 'day' | 'week' | 'month';
	};
}

/**
 * Workflow suggestion - the ONE path we show users
 *
 * Not a list. Not options. One path to the outcome.
 * Users don't choose between workflows—they accept or defer.
 */
export interface WorkflowSuggestion {
	/** The suggested workflow */
	workflowId: string;

	/** Outcome-focused text (not workflow name) */
	outcomeStatement: OutcomeStatement;

	/** Pre-computed defaults based on user context */
	inferredConfig: Record<string, unknown>;

	/** What triggered this suggestion */
	triggerContext: {
		moment: DiscoveryMoment;
		timestamp: number;
		relevantIntegrations: string[];
	};

	/** Can this be activated with one click? */
	oneClickReady: boolean;

	/** If not one-click ready, what's required? */
	requiredFields?: Array<{
		key: string;
		label: string;
		type: 'notion_database_picker' | 'slack_channel_picker' | 'text' | 'boolean';
	}>;
}

/**
 * Integration pair - the primary discovery axis
 *
 * Users think: "Zoom and Notion" not "productivity category"
 * One integration pair → One workflow (pre-curated)
 */
export interface IntegrationPair {
	/** Source integration (trigger) */
	from: string;

	/** Destination integration (action) */
	to: string;

	/** The canonical workflow for this pair */
	workflowId: string;

	/** Outcome achieved */
	outcome: string;
}

/**
 * Pathway metadata - extends WorkflowMetadata for the pathway model
 *
 * This is the NEW metadata structure that supports contextual discovery.
 */
export interface PathwayMetadata {
	/** Outcome frame (replaces category) */
	outcomeFrame: OutcomeFrame;

	/** Human-readable outcome statement */
	outcomeStatement: OutcomeStatement;

	/** Primary integration pair */
	primaryPair: IntegrationPair;

	/** Additional integration pairs this workflow supports */
	additionalPairs?: IntegrationPair[];

	/** Discovery moments when this workflow should surface */
	discoveryMoments: DiscoveryMoment[];

	/** Smart defaults - config that can be inferred from context */
	smartDefaults: Record<
		string,
		| { inferFrom: 'connected_integration'; integration: string; field: string }
		| { inferFrom: 'user_timezone' }
		| { inferFrom: 'user_preference'; key: string }
		| { value: unknown }
	>;

	/** Essential fields - the 1-3 fields users MUST configure */
	essentialFields: string[];

	/** Zuhandenheit indicators */
	zuhandenheit: {
		/** Estimated time to first outcome (minutes) */
		timeToValue: number;
		/** Does it work with just essential fields? */
		worksOutOfBox: boolean;
		/** Does it handle missing optional integrations gracefully? */
		gracefulDegradation: boolean;
		/** Is the trigger automatic (webhook) or manual? */
		automaticTrigger: boolean;
	};
}

// ============================================================================
// MARKETPLACE TYPES
// ============================================================================

/**
 * Workflow listing in marketplace
 * (What users see when browsing)
 *
 * @deprecated Prefer PathwayMetadata for the pathway model.
 * Traditional marketplace browsing is being phased out.
 */
export interface WorkflowListing {
	/** From WorkflowDefinition */
	metadata: WorkflowMetadata;
	pricing: WorkflowPricing;
	integrations: string[];

	/** Marketplace stats */
	stats: {
		installs: number;
		activeUsers: number;
		rating: number;
		reviewCount: number;
	};

	/** Publishing info */
	publishing: {
		status: 'draft' | 'published' | 'needs_work' | 'dormant' | 'deprecated';
		publishedAt?: number;
		lastUpdatedAt: number;
	};

	/** Developer info */
	developer: {
		id: string;
		name: string;
		verified: boolean;
		totalWorkflows: number;
	};
}

/**
 * Workflow installation
 * (When a user enables a workflow)
 */
export interface WorkflowInstallation {
	/** Installation ID */
	id: string;

	/** User who installed */
	userId: string;

	/** Workflow ID */
	workflowId: string;

	/** User's configuration */
	config: Record<string, any>;

	/** Status */
	status: 'installed' | 'active' | 'paused' | 'error' | 'uninstalled';

	/** Connected integrations */
	connectedIntegrations: Record<string, boolean>;

	/** Usage stats */
	stats: {
		totalExecutions: number;
		lastExecutedAt?: number;
		successRate: number;
	};

	/** Timestamps */
	installedAt: number;
	activatedAt?: number;
	updatedAt: number;
}

/**
 * Developer earnings from workflow
 */
export interface WorkflowEarnings {
	/** Workflow ID */
	workflowId: string;

	/** Developer ID */
	developerId: string;

	/** Revenue breakdown */
	revenue: {
		total: number;
		thisMonth: number;
		lastMonth: number;
	};

	/** Subscription breakdown */
	subscriptions: {
		active: number;
		churned: number;
		newThisMonth: number;
	};

	/** Payout info */
	payouts: {
		pending: number;
		paid: number;
		nextPayoutDate?: number;
	};
}
