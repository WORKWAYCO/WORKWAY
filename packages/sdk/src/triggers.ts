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
 * Workflow Triggers
 *
 * Trigger helpers for defining how workflows are activated.
 * These create type-safe trigger configurations that the workflow engine interprets.
 *
 * @example Webhook trigger
 * ```typescript
 * import { webhook } from '@workway/sdk';
 *
 * export default defineWorkflow({
 *   trigger: webhook({
 *     service: 'stripe',
 *     event: 'payment.succeeded'
 *   }),
 *   // ...
 * });
 * ```
 *
 * @example Schedule trigger
 * ```typescript
 * import { schedule } from '@workway/sdk';
 *
 * export default defineWorkflow({
 *   trigger: schedule('0 9 * * 1'), // Every Monday at 9am
 *   // ...
 * });
 * ```
 */

// ============================================================================
// TRIGGER TYPES
// ============================================================================

/**
 * Base trigger configuration
 */
export interface TriggerConfig {
	type: 'webhook' | 'schedule' | 'manual' | 'poll';
}

/**
 * Webhook trigger configuration
 */
export interface WebhookTriggerConfig extends TriggerConfig {
	type: 'webhook';
	service: string;
	event: string;
	filter?: Record<string, unknown>;
	secret?: string;
}

/**
 * Schedule trigger configuration (cron-based)
 */
export interface ScheduleTriggerConfig extends TriggerConfig {
	type: 'schedule';
	cron: string;
	timezone?: string;
}

/**
 * Manual trigger configuration (API or UI initiated)
 */
export interface ManualTriggerConfig extends TriggerConfig {
	type: 'manual';
	description?: string;
}

/**
 * Poll trigger configuration (periodic API checks)
 */
export interface PollTriggerConfig extends TriggerConfig {
	type: 'poll';
	service: string;
	endpoint: string;
	interval: number; // seconds
	filter?: Record<string, unknown>;
}

/**
 * Union of all trigger types
 */
export type Trigger =
	| WebhookTriggerConfig
	| ScheduleTriggerConfig
	| ManualTriggerConfig
	| PollTriggerConfig;

// ============================================================================
// TRIGGER HELPERS
// ============================================================================

/**
 * Create a webhook trigger
 *
 * Webhooks are the most common trigger type - they're activated when
 * an external service sends an HTTP request to WORKWAY.
 *
 * @param options - Webhook configuration
 * @returns Webhook trigger configuration
 *
 * @example
 * ```typescript
 * // Stripe payment received
 * trigger: webhook({
 *   service: 'stripe',
 *   event: 'payment_intent.succeeded'
 * })
 *
 * // GitHub PR opened
 * trigger: webhook({
 *   service: 'github',
 *   event: 'pull_request.opened',
 *   filter: { base: 'main' }
 * })
 *
 * // Zendesk ticket created
 * trigger: webhook({
 *   service: 'zendesk',
 *   event: 'ticket.created'
 * })
 * ```
 */
export function webhook(options: {
	service: string;
	event: string;
	filter?: Record<string, unknown>;
	secret?: string;
}): WebhookTriggerConfig {
	return {
		type: 'webhook',
		service: options.service,
		event: options.event,
		filter: options.filter,
		secret: options.secret,
	};
}

/**
 * Create a schedule trigger (cron-based)
 *
 * Schedule triggers run workflows on a time-based schedule using cron syntax.
 * Powered by Cloudflare Workers Cron Triggers.
 *
 * @param cron - Cron expression (5-part: minute hour day month weekday)
 * @param options - Optional timezone configuration
 * @returns Schedule trigger configuration
 *
 * @example
 * ```typescript
 * // Every day at 9am UTC
 * trigger: schedule('0 9 * * *')
 *
 * // Every Monday at 9am Eastern
 * trigger: schedule('0 9 * * 1', { timezone: 'America/New_York' })
 *
 * // Every 15 minutes
 * trigger: schedule('*\/15 * * * *')
 *
 * // First day of every month at midnight
 * trigger: schedule('0 0 1 * *')
 * ```
 */
export function schedule(
	cron: string,
	options?: { timezone?: string }
): ScheduleTriggerConfig {
	// Validate cron expression
	const parts = cron.trim().split(/\s+/);
	if (parts.length !== 5) {
		throw new Error(
			`Invalid cron expression: "${cron}". Expected 5 parts (minute hour day month weekday), got ${parts.length}.`
		);
	}

	return {
		type: 'schedule',
		cron,
		timezone: options?.timezone,
	};
}

/**
 * Create a manual trigger
 *
 * Manual triggers are activated via API call or dashboard button.
 * Useful for on-demand workflows or testing.
 *
 * @param options - Optional description
 * @returns Manual trigger configuration
 *
 * @example
 * ```typescript
 * // Simple manual trigger
 * trigger: manual()
 *
 * // With description
 * trigger: manual({ description: 'Run monthly report generation' })
 * ```
 */
export function manual(options?: { description?: string }): ManualTriggerConfig {
	return {
		type: 'manual',
		description: options?.description,
	};
}

/**
 * Create a poll trigger
 *
 * Poll triggers periodically check an API for new data.
 * Use when webhooks aren't available from the source service.
 *
 * @param options - Poll configuration
 * @returns Poll trigger configuration
 *
 * @example
 * ```typescript
 * // Check for new emails every 5 minutes
 * trigger: poll({
 *   service: 'gmail',
 *   endpoint: 'messages.list',
 *   interval: 300, // 5 minutes
 *   filter: { q: 'is:unread' }
 * })
 *
 * // Check RSS feed every hour
 * trigger: poll({
 *   service: 'rss',
 *   endpoint: 'https://example.com/feed.xml',
 *   interval: 3600
 * })
 * ```
 */
export function poll(options: {
	service: string;
	endpoint: string;
	interval: number;
	filter?: Record<string, unknown>;
}): PollTriggerConfig {
	if (options.interval < 60) {
		throw new Error(
			`Poll interval must be at least 60 seconds, got ${options.interval}.`
		);
	}

	return {
		type: 'poll',
		service: options.service,
		endpoint: options.endpoint,
		interval: options.interval,
		filter: options.filter,
	};
}

// ============================================================================
// TRIGGER UTILITIES
// ============================================================================

/**
 * Type guard to check if a value is a webhook trigger
 */
export function isWebhookTrigger(trigger: Trigger): trigger is WebhookTriggerConfig {
	return trigger.type === 'webhook';
}

/**
 * Type guard to check if a value is a schedule trigger
 */
export function isScheduleTrigger(trigger: Trigger): trigger is ScheduleTriggerConfig {
	return trigger.type === 'schedule';
}

/**
 * Type guard to check if a value is a manual trigger
 */
export function isManualTrigger(trigger: Trigger): trigger is ManualTriggerConfig {
	return trigger.type === 'manual';
}

/**
 * Type guard to check if a value is a poll trigger
 */
export function isPollTrigger(trigger: Trigger): trigger is PollTriggerConfig {
	return trigger.type === 'poll';
}

/**
 * Get human-readable description of a trigger
 */
export function describeTrigger(trigger: Trigger): string {
	switch (trigger.type) {
		case 'webhook':
			return `Webhook: ${trigger.service}.${trigger.event}`;
		case 'schedule':
			return `Schedule: ${trigger.cron}${trigger.timezone ? ` (${trigger.timezone})` : ''}`;
		case 'manual':
			return trigger.description || 'Manual trigger';
		case 'poll':
			return `Poll: ${trigger.service}/${trigger.endpoint} every ${trigger.interval}s`;
	}
}
