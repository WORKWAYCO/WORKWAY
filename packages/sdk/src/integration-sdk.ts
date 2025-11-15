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
 * WORKWAY Integration SDK
 *
 * This SDK provides the foundation for building integrations (Gmail, Slack, Notion, etc.)
 * Integrations are the BUILDING BLOCKS that workflows compose together.
 *
 * @example
 * ```typescript
 * // Integration developers use this to build connectors
 * export const sendEmailAction: ActionDefinition = {
 *   id: 'gmail.send-email',
 *   integration: 'gmail',
 *   async execute(input, context) {
 *     // Implementation
 *   }
 * }
 * ```
 */

import { ZodSchema } from 'zod';
import type { DurableObjectStorage } from '@cloudflare/workers-types';
import {
	ActionResult,
	ActionCapabilities,
	StandardData,
} from './action-result';
import { ErrorCode, ErrorContext } from './integration-error';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Context provided to actions during execution
 * Contains everything an action needs to run
 */
export interface ActionContext {
	/** User who triggered the workflow */
	userId: string;

	/** OAuth token manager */
	oauth: OAuthManager;

	/** Durable Object storage for state */
	storage: DurableObjectStorage;

	/** Data from the workflow trigger */
	triggerData: any;

	/** Results from previous steps */
	stepResults: Record<string, any>;

	/** Environment variables and secrets */
	env: any;

	/**
	 * Helper: Create an ActionResult with proper structure
	 *
	 * Usage:
	 * ```typescript
	 * return context.createResult({
	 *   data: { id: '123', subject: 'Hello' },
	 *   schema: 'gmail.email.v1',
	 *   capabilities: { canHandleText: true }
	 * });
	 * ```
	 */
	createResult?<T>(params: {
		data: T;
		schema: string;
		capabilities: ActionCapabilities;
		standard?: StandardData;
	}): ActionResult<T>;

	/**
	 * Helper: Throw a structured IntegrationError
	 *
	 * Usage:
	 * ```typescript
	 * if (!tokens) {
	 *   context.throwError(ErrorCode.AUTH_MISSING, 'Gmail not connected');
	 * }
	 * ```
	 */
	throwError?(code: ErrorCode, message: string, context?: Partial<ErrorContext>): never;
}

/**
 * OAuth manager interface for getting tokens
 */
export interface OAuthManager {
	/**
	 * Get OAuth tokens for a provider
	 * @param userId - User ID
	 * @param provider - OAuth provider (gmail, notion, slack, etc.)
	 * @returns OAuth tokens or null if not connected
	 */
	getTokens(userId: string, provider: string): Promise<OAuthTokens | null>;

	/**
	 * Refresh expired tokens
	 * @param userId - User ID
	 * @param provider - OAuth provider
	 * @returns Refreshed tokens
	 */
	refreshTokens(userId: string, provider: string): Promise<OAuthTokens>;
}

/**
 * OAuth tokens structure
 */
export interface OAuthTokens {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
	scope: string;
	tokenType: string;
}

// ============================================================================
// ACTION DEFINITION
// ============================================================================

/**
 * Definition of an action that an integration provides
 *
 * Actions are the fundamental building blocks of workflows.
 * Each integration provides multiple actions (e.g., Gmail provides send-email, fetch-emails, add-label)
 *
 * @example
 * ```typescript
 * const addLabelAction: ActionDefinition = {
 *   id: 'gmail.add-label',
 *   name: 'Add Label to Email',
 *   description: 'Adds a label to a Gmail message',
 *   integration: 'gmail',
 *   requiredAuth: ['gmail'],
 *   inputSchema: z.object({
 *     messageId: z.string(),
 *     label: z.string(),
 *   }),
 *   capabilities: {
 *     canHandleText: true,
 *     supportsMetadata: true
 *   },
 *   async execute(input, context) {
 *     // Implementation
 *     return context.createResult({
 *       data: result,
 *       schema: 'gmail.email.v1',
 *       capabilities: this.capabilities
 *     });
 *   }
 * }
 * ```
 */
export interface ActionDefinition<TInput = any, TOutput = any> {
	/** Unique identifier (e.g., 'gmail.send-email') */
	id: string;

	/** Human-readable name */
	name: string;

	/** Description of what this action does */
	description: string;

	/** Which integration this belongs to */
	integration: string;

	/** Zod schema for input validation */
	inputSchema: ZodSchema<TInput>;

	/** OAuth providers required (e.g., ['gmail']) */
	requiredAuth?: string[];

	/**
	 * Capabilities: What this action can consume/produce
	 * Enables intelligent routing and compatibility checking
	 */
	capabilities: ActionCapabilities;

	/**
	 * Execute the action
	 * MUST return ActionResult<TOutput> (narrow waist!)
	 */
	execute(input: TInput, context: ActionContext): Promise<ActionResult<TOutput>>;

	/** Optional: Validate before execution (beyond schema validation) */
	validate?(input: TInput, context: ActionContext): Promise<boolean>;

	/**
	 * Optional: Transform functions for standard data interop
	 * Enables integrations to work together without M×N glue code
	 */
	transforms?: {
		/**
		 * Convert action output to standard format
		 * Example: Gmail email → StandardMessage
		 */
		toStandardFormat?(data: TOutput): StandardData;

		/**
		 * Convert standard format to action input
		 * Example: StandardMessage → Notion page properties
		 */
		fromStandardFormat?(data: StandardData): Partial<TInput>;
	};
}

// ============================================================================
// TRIGGER DEFINITION
// ============================================================================

/**
 * Definition of a trigger that starts workflows
 *
 * Triggers watch for events and start workflow execution
 *
 * @example
 * ```typescript
 * const newEmailTrigger: TriggerDefinition = {
 *   id: 'gmail.new-email',
 *   name: 'New Email Received',
 *   type: 'webhook',
 *   integration: 'gmail',
 *   async setup(config, context) {
 *     // Register webhook with Gmail
 *   }
 * }
 * ```
 */
export interface TriggerDefinition<TConfig = any, TData = any> {
	/** Unique identifier (e.g., 'gmail.new-email') */
	id: string;

	/** Human-readable name */
	name: string;

	/** Description */
	description: string;

	/** Type of trigger */
	type: 'webhook' | 'polling' | 'schedule' | 'manual';

	/** Which integration this belongs to */
	integration: string;

	/** Configuration schema */
	configSchema: ZodSchema<TConfig>;

	/** OAuth providers required */
	requiredAuth?: string[];

	/**
	 * Setup the trigger (register webhooks, etc.)
	 * Called when a workflow is enabled
	 */
	setup(config: TConfig, context: ActionContext): Promise<void>;

	/**
	 * Cleanup the trigger (unregister webhooks, etc.)
	 * Called when a workflow is disabled
	 */
	cleanup(config: TConfig, context: ActionContext): Promise<void>;

	/**
	 * For polling triggers: check for new events
	 */
	poll?(config: TConfig, context: ActionContext): Promise<TData[]>;
}

// ============================================================================
// INTEGRATION DEFINITION
// ============================================================================

/**
 * Complete integration definition
 *
 * An integration bundles actions, triggers, and metadata together
 *
 * @example
 * ```typescript
 * export const gmailIntegration: IntegrationDefinition = {
 *   id: 'gmail',
 *   name: 'Gmail',
 *   description: 'Gmail integration for WORKWAY',
 *   version: '1.0.0',
 *   oauth: {
 *     provider: 'gmail',
 *     scopes: [
 *       'https://www.googleapis.com/auth/gmail.readonly',
 *       'https://www.googleapis.com/auth/gmail.send',
 *       'https://www.googleapis.com/auth/gmail.labels',
 *       'https://www.googleapis.com/auth/gmail.modify'
 *     ]
 *   },
 *   actions: [sendEmailAction, fetchEmailsAction, addLabelAction],
 *   triggers: [newEmailTrigger]
 * }
 * ```
 */
export interface IntegrationDefinition {
	/** Unique identifier (e.g., 'gmail') */
	id: string;

	/** Human-readable name */
	name: string;

	/** Description */
	description: string;

	/** Version (semver) */
	version: string;

	/** Integration author/maintainer */
	author?: string;

	/** Icon URL */
	icon?: string;

	/** Documentation URL */
	docsUrl?: string;

	/** OAuth configuration */
	oauth?: {
		provider: string;
		scopes: string[];
	};

	/** Actions this integration provides */
	actions: ActionDefinition[];

	/** Triggers this integration provides */
	triggers?: TriggerDefinition[];

	/**
	 * Optional: Initialize the integration
	 * Called once when integration is first loaded
	 */
	initialize?(env: any): Promise<void>;
}

// ============================================================================
// ACTION REGISTRY
// ============================================================================

/**
 * Registry for managing all available actions
 *
 * The ActionRegistry is the central hub that:
 * - Registers all integrations and their actions
 * - Provides lookup by action ID
 * - Validates actions exist before execution
 *
 * @example
 * ```typescript
 * const registry = new ActionRegistry();
 * registry.registerIntegration(gmailIntegration);
 *
 * const action = registry.getAction('gmail.send-email');
 * await action.execute(input, context);
 * ```
 */
export class ActionRegistry {
	private actions = new Map<string, ActionDefinition>();
	private triggers = new Map<string, TriggerDefinition>();
	private integrations = new Map<string, IntegrationDefinition>();

	/**
	 * Register an integration and all its actions/triggers
	 */
	registerIntegration(integration: IntegrationDefinition): void {
		this.integrations.set(integration.id, integration);

		// Register all actions
		for (const action of integration.actions) {
			this.actions.set(action.id, action);
		}

		// Register all triggers
		if (integration.triggers) {
			for (const trigger of integration.triggers) {
				this.triggers.set(trigger.id, trigger);
			}
		}
	}

	/**
	 * Get an action by ID
	 */
	getAction(id: string): ActionDefinition | undefined {
		return this.actions.get(id);
	}

	/**
	 * Get a trigger by ID
	 */
	getTrigger(id: string): TriggerDefinition | undefined {
		return this.triggers.get(id);
	}

	/**
	 * Get an integration by ID
	 */
	getIntegration(id: string): IntegrationDefinition | undefined {
		return this.integrations.get(id);
	}

	/**
	 * Get all actions for an integration
	 */
	getActionsByIntegration(integrationId: string): ActionDefinition[] {
		return Array.from(this.actions.values()).filter((action) => action.integration === integrationId);
	}

	/**
	 * Get all registered integrations
	 */
	getAllIntegrations(): IntegrationDefinition[] {
		return Array.from(this.integrations.values());
	}

	/**
	 * Get all registered actions
	 */
	getAllActions(): ActionDefinition[] {
		return Array.from(this.actions.values());
	}

	/**
	 * Check if action exists
	 */
	hasAction(id: string): boolean {
		return this.actions.has(id);
	}

	/**
	 * Unregister an integration and all its actions/triggers
	 * Useful for hot reload in development
	 */
	unregisterIntegration(integrationId: string): void {
		const integration = this.integrations.get(integrationId);
		if (!integration) return;

		// Remove all actions for this integration
		for (const action of integration.actions) {
			this.actions.delete(action.id);
		}

		// Remove all triggers for this integration
		if (integration.triggers) {
			for (const trigger of integration.triggers) {
				this.triggers.delete(trigger.id);
			}
		}

		// Remove the integration itself
		this.integrations.delete(integrationId);
	}

	/**
	 * Reload an integration (unregister and register again)
	 * Only available in development mode
	 *
	 * @param integration - The updated integration definition
	 * @throws Error if called in production
	 *
	 * @example
	 * ```typescript
	 * // In development
	 * const updatedGmail = await import('./integrations/gmail?t=' + Date.now());
	 * registry.reloadIntegration(updatedGmail.default);
	 * ```
	 */
	reloadIntegration(integration: IntegrationDefinition): void {
		this.unregisterIntegration(integration.id);
		this.registerIntegration(integration);
		console.log(`🔄 Reloaded integration: ${integration.id}`);
	}

	/**
	 * Check if integration exists
	 */
	hasIntegration(id: string): boolean {
		return this.integrations.has(id);
	}
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Extract input type from an ActionDefinition
 */
export type ActionInput<T extends ActionDefinition<any, any>> = T extends ActionDefinition<infer I, any> ? I : never;

/**
 * Extract output type from an ActionDefinition
 */
export type ActionOutput<T extends ActionDefinition<any, any>> = T extends ActionDefinition<any, infer O> ? O : never;
