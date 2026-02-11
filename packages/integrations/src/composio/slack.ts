/**
 * Composio-backed Slack Integration
 *
 * Typed wrapper around ComposioAdapter for Slack operations.
 * This is the "Standard Integration" tier — commodity CRUD backed by Composio,
 * with the same ActionResult contract as our custom Slack integration.
 *
 * When to use this vs the custom Slack integration:
 * - Use ComposioSlack for basic operations (send messages, list channels)
 * - Use the custom Slack integration for deep workflows (thread management,
 *   file uploads, Slack Connect, custom blocks, etc.)
 *
 * @example
 * ```typescript
 * import { ComposioSlack } from '@workwayco/integrations/composio';
 *
 * const slack = new ComposioSlack({
 *   composioApiKey: env.COMPOSIO_API_KEY,
 *   connectedAccountId: 'user_slack_account_id',
 * });
 *
 * const result = await slack.sendMessage('#general', 'Hello from WORKWAY');
 * ```
 */

import type { ActionResult } from '@workwayco/sdk';
import { ComposioAdapter, type ComposioAdapterConfig } from './adapter.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ComposioSlackMessage {
	ok: boolean;
	channel?: string;
	ts?: string;
	message?: {
		text: string;
		user?: string;
		ts?: string;
	};
}

export interface ComposioSlackChannel {
	id: string;
	name: string;
	is_channel?: boolean;
	is_private?: boolean;
	topic?: { value: string };
	purpose?: { value: string };
	num_members?: number;
}

export interface ComposioSlackConfig {
	composioApiKey: string;
	connectedAccountId?: string;
	entityId?: string;
	apiUrl?: string;
	timeout?: number;
}

// ============================================================================
// COMPOSIO SLACK
// ============================================================================

export class ComposioSlack extends ComposioAdapter {
	constructor(config: ComposioSlackConfig) {
		super({
			...config,
			appName: 'slack',
		});
	}

	/**
	 * Send a message to a Slack channel
	 */
	async sendMessage(
		channel: string,
		text: string
	): Promise<ActionResult<ComposioSlackMessage>> {
		return this.executeAction<ComposioSlackMessage>('SLACK_SEND_MESSAGE', {
			channel,
			text,
		});
	}

	/**
	 * List Slack channels
	 */
	async listChannels(options: {
		limit?: number;
		excludeArchived?: boolean;
	} = {}): Promise<ActionResult<ComposioSlackChannel[]>> {
		return this.executeAction<ComposioSlackChannel[]>('SLACK_LIST_CHANNELS', {
			limit: options.limit || 100,
			exclude_archived: options.excludeArchived ?? true,
		});
	}

	/**
	 * Get channel history (messages)
	 */
	async getChannelHistory(
		channel: string,
		options: { limit?: number } = {}
	): Promise<ActionResult<unknown>> {
		return this.executeAction('SLACK_GET_CHANNEL_HISTORY', {
			channel,
			limit: options.limit || 20,
		});
	}

	/**
	 * Post a message with blocks (rich formatting)
	 */
	async postBlocks(
		channel: string,
		blocks: unknown[],
		text?: string
	): Promise<ActionResult<ComposioSlackMessage>> {
		return this.executeAction<ComposioSlackMessage>('SLACK_SEND_MESSAGE', {
			channel,
			text: text || '',
			blocks: JSON.stringify(blocks),
		});
	}
}
