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

	/** Category */
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
// MARKETPLACE TYPES
// ============================================================================

/**
 * Workflow listing in marketplace
 * (What users see when browsing)
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
		status: 'draft' | 'published' | 'unlisted' | 'deprecated';
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
