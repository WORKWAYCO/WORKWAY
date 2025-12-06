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
 *
 * Supports three patterns:
 * 1. Service + single event: { service: 'stripe', event: 'payment.succeeded' }
 * 2. Service + multiple events: { service: 'stripe', events: ['event1', 'event2'] }
 * 3. Path-based webhook: { path: '/typeform', events: ['form_response'] }
 */
export interface WebhookTriggerConfig extends TriggerConfig {
	type: 'webhook';
	/** Service name (e.g., 'stripe', 'github') */
	service?: string;
	/** Webhook path (alternative to service) */
	path?: string;
	/** Single event type (use event OR events, not both) */
	event?: string;
	/** Multiple event types */
	events?: string[];
	/** Filter conditions */
	filter?: Record<string, unknown>;
	/** Webhook secret for verification */
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
	service?: string;
	endpoint?: string;
	interval: number | string; // seconds (string for template interpolation)
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
 * Webhook trigger options - supports multiple patterns
 */
export type WebhookOptions =
	| {
			/** Service name */
			service: string;
			/** Single event type */
			event: string;
			/** Multiple event types (alternative to event) */
			events?: never;
			/** Path (not used with service) */
			path?: never;
			filter?: Record<string, unknown>;
			secret?: string;
	  }
	| {
			/** Service name */
			service: string;
			/** Single event type (alternative to events) */
			event?: never;
			/** Multiple event types */
			events: string[];
			/** Path (not used with service) */
			path?: never;
			filter?: Record<string, unknown>;
			secret?: string;
	  }
	| {
			/** Path-based webhook (alternative to service) */
			path: string;
			/** Service (not used with path) */
			service?: never;
			/** Single event type (alternative to events) */
			event?: string;
			/** Multiple event types */
			events?: string[];
			filter?: Record<string, unknown>;
			secret?: string;
	  };

/**
 * Create a webhook trigger
 *
 * Webhooks are the most common trigger type - they're activated when
 * an external service sends an HTTP request to WORKWAY.
 *
 * Supports three patterns:
 * 1. Service + single event: `webhook({ service: 'stripe', event: 'payment.succeeded' })`
 * 2. Service + multiple events: `webhook({ service: 'stripe', events: ['event1', 'event2'] })`
 * 3. Path-based: `webhook({ path: '/typeform', events: ['form_response'] })`
 *
 * @param options - Webhook configuration
 * @returns Webhook trigger configuration
 *
 * @example
 * ```typescript
 * // Stripe payment received (single event)
 * trigger: webhook({
 *   service: 'stripe',
 *   event: 'payment_intent.succeeded'
 * })
 *
 * // Stripe multiple events
 * trigger: webhook({
 *   service: 'stripe',
 *   events: ['payment_intent.succeeded', 'charge.refunded']
 * })
 *
 * // Path-based webhook (e.g., Typeform)
 * trigger: webhook({
 *   path: '/typeform',
 *   events: ['form_response']
 * })
 *
 * // GitHub PR opened with filter
 * trigger: webhook({
 *   service: 'github',
 *   event: 'pull_request.opened',
 *   filter: { base: 'main' }
 * })
 * ```
 */
export function webhook(options: WebhookOptions): WebhookTriggerConfig {
	return {
		type: 'webhook',
		service: options.service,
		path: options.path,
		event: options.event,
		events: options.events,
		filter: options.filter,
		secret: options.secret,
	};
}

/**
 * Schedule trigger options
 */
export interface ScheduleOptions {
	/** Cron expression (5-part: minute hour day month weekday) */
	cron?: string;
	/** Alias for cron */
	schedule?: string;
	/** Timezone (e.g., 'America/New_York', 'UTC') */
	timezone?: string;
}

/**
 * Create a schedule trigger (cron-based)
 *
 * Schedule triggers run workflows on a time-based schedule using cron syntax.
 * Powered by Cloudflare Workers Cron Triggers.
 *
 * Supports two patterns:
 * 1. Positional: `schedule('0 9 * * *', { timezone: 'UTC' })`
 * 2. Object-based: `schedule({ cron: '0 9 * * *', timezone: 'UTC' })`
 *
 * @param cronOrOptions - Cron expression string OR options object
 * @param options - Optional timezone configuration (only for positional pattern)
 * @returns Schedule trigger configuration
 *
 * @example
 * ```typescript
 * // Positional pattern - every day at 9am UTC
 * trigger: schedule('0 9 * * *')
 *
 * // Positional pattern with timezone
 * trigger: schedule('0 9 * * 1', { timezone: 'America/New_York' })
 *
 * // Object pattern (preferred for workflows)
 * trigger: schedule({
 *   cron: '0 9 * * 1-5', // Weekdays at 9am
 *   timezone: 'America/New_York'
 * })
 *
 * // Dynamic cron with template interpolation
 * trigger: schedule({
 *   cron: '0 {{inputs.hour}} * * *',
 *   timezone: '{{inputs.timezone}}'
 * })
 * ```
 */
export function schedule(
	cronOrOptions: string | ScheduleOptions,
	options?: { timezone?: string }
): ScheduleTriggerConfig {
	// Handle object-based pattern
	if (typeof cronOrOptions === 'object') {
		// Support both `cron` and `schedule` property names
		const cronExpr = cronOrOptions.cron || cronOrOptions.schedule;
		if (!cronExpr) {
			throw new Error('Schedule trigger requires either "cron" or "schedule" property');
		}
		validateCron(cronExpr);
		return {
			type: 'schedule',
			cron: cronExpr,
			timezone: cronOrOptions.timezone,
		};
	}

	// Handle positional pattern
	const cron = cronOrOptions;
	validateCron(cron);
	return {
		type: 'schedule',
		cron,
		timezone: options?.timezone,
	};
}

/**
 * Validate cron expression (allows template variables)
 */
function validateCron(cron: string): void {
	// Skip validation if cron contains template variables
	if (cron.includes('{{')) {
		return;
	}

	const parts = cron.trim().split(/\s+/);
	if (parts.length !== 5) {
		throw new Error(
			`Invalid cron expression: "${cron}". Expected 5 parts (minute hour day month weekday), got ${parts.length}.`
		);
	}
}

/**
 * Alias for schedule() - create a cron-based trigger
 *
 * @deprecated Use schedule() instead
 */
export const cron = schedule;

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
	service?: string;
	endpoint?: string;
	interval: number | string;
	filter?: Record<string, unknown>;
}): PollTriggerConfig {
	// Skip validation if interval is a template string
	if (typeof options.interval === 'number' && options.interval < 60) {
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
		case 'webhook': {
			// Handle different webhook patterns
			const source = trigger.service || trigger.path || 'custom';
			const eventInfo = trigger.event
				? trigger.event
				: trigger.events?.join(', ') || 'all events';
			return `Webhook: ${source} → ${eventInfo}`;
		}
		case 'schedule':
			return `Schedule: ${trigger.cron}${trigger.timezone ? ` (${trigger.timezone})` : ''}`;
		case 'manual':
			return trigger.description || 'Manual trigger';
		case 'poll':
			return `Poll: ${trigger.service}/${trigger.endpoint} every ${trigger.interval}s`;
	}
}
