/**
 * Slack Integration for WORKWAY
 *
 * Weniger, aber besser: Extends BaseAPIClient for shared HTTP logic.
 *
 * @example
 * ```typescript
 * import { Slack } from '@workwayco/integrations/slack';
 *
 * const slack = new Slack({ accessToken: tokens.slack.access_token });
 *
 * // List channels
 * const channels = await slack.listChannels({ limit: 20 });
 *
 * // Get messages from a channel
 * const messages = await slack.getMessages({ channel: 'C123456' });
 *
 * // Send a message
 * const sent = await slack.sendMessage({
 *   channel: 'C123456',
 *   text: 'Hello from WORKWAY!'
 * });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	IntegrationError,
	ErrorCode,
	type StandardMessage,
	type StandardList,
	type ActionCapabilities,
} from '@workwayco/sdk';
import {
	BaseAPIClient,
	validateAccessToken,
	createErrorHandler,
	assertResponseOk,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Slack channel object
 */
export interface SlackChannel {
	id: string;
	name: string;
	is_channel: boolean;
	is_group: boolean;
	is_im: boolean;
	is_mpim: boolean;
	is_private: boolean;
	is_archived: boolean;
	is_member: boolean;
	topic?: { value: string };
	purpose?: { value: string };
	num_members?: number;
}

/**
 * Slack message object
 */
export interface SlackMessage {
	type: string;
	ts: string;
	user?: string;
	bot_id?: string;
	subtype?: string; // channel_join, channel_leave, bot_message, etc.
	text: string;
	thread_ts?: string;
	reply_count?: number;
	reactions?: Array<{
		name: string;
		count: number;
		users: string[];
	}>;
	attachments?: Array<{
		id: number;
		fallback?: string;
		title?: string;
		text?: string;
		image_url?: string;
	}>;
	files?: Array<{
		id: string;
		name: string;
		mimetype: string;
		size: number;
		url_private?: string;
	}>;
}

/**
 * Slack user object
 */
export interface SlackUser {
	id: string;
	name: string;
	real_name?: string;
	profile?: {
		email?: string;
		display_name?: string;
		image_72?: string;
	};
}

/**
 * Slack integration configuration
 */
export interface SlackConfig {
	/** OAuth access token (bot or user) */
	accessToken: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Options for listing channels
 */
export interface ListChannelsOptions {
	/** Maximum number of channels to return (default: 100, max: 1000) */
	limit?: number;
	/** Pagination cursor */
	cursor?: string;
	/** Include archived channels (default: false) */
	excludeArchived?: boolean;
	/** Filter by channel type: 'public', 'private', 'mpim', 'im' */
	types?: string;
}

/**
 * Options for getting messages
 */
export interface GetMessagesOptions {
	/** Channel ID */
	channel: string;
	/** Number of messages to fetch (default: 20, max: 1000) */
	limit?: number;
	/** Pagination cursor */
	cursor?: string;
	/**
	 * Only messages after this time. Accepts:
	 * - Duration string: "1h", "24h", "7d" (hours/days ago)
	 * - Date object: new Date('2024-01-01')
	 * - Unix seconds string: "1699900000" (raw Slack format)
	 */
	since?: string | Date;
	/** Only messages after this timestamp (raw Slack format - prefer 'since') */
	oldest?: string;
	/** Only messages before this timestamp */
	latest?: string;
	/** Include all metadata about channels/messages (default: false) */
	inclusive?: boolean;
	/**
	 * Filter to human messages only (excludes bots, system messages, joins/leaves)
	 * Zuhandenheit: You think "get what people said" not "filter by bot_id and type"
	 */
	humanOnly?: boolean;
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
	/** Channel ID to send to */
	channel: string;
	/** Message text (supports Slack markdown) */
	text: string;
	/** Thread timestamp to reply to (for threading) */
	thread_ts?: string;
	/** Send as reply and also to channel (default: false) */
	reply_broadcast?: boolean;
	/** Unfurl links (default: true) */
	unfurl_links?: boolean;
	/** Unfurl media (default: true) */
	unfurl_media?: boolean;
	/** Parse mode: 'full', 'none' (default: 'full') */
	parse?: 'full' | 'none';
}

/**
 * Options for getting user info
 */
export interface GetUserOptions {
	/** User ID */
	user: string;
}

// ============================================================================
// SLACK INTEGRATION CLASS
// ============================================================================

/** Error handler bound to Slack integration */
const handleError = createErrorHandler('slack');

/**
 * Slack Integration
 *
 * Weniger, aber besser: Extends BaseAPIClient for shared HTTP logic.
 */
export class Slack extends BaseAPIClient {
	constructor(config: SlackConfig) {
		validateAccessToken(config.accessToken, 'slack');
		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || 'https://slack.com/api',
			timeout: config.timeout,
		});
	}

	// ==========================================================================
	// ACTIONS
	// ==========================================================================

	/**
	 * List channels the bot/user has access to
	 *
	 * @returns ActionResult with list of channels
	 */
	async listChannels(options: ListChannelsOptions = {}): Promise<ActionResult<SlackChannel[]>> {
		const {
			limit = 100,
			cursor,
			excludeArchived = true,
			types = 'public_channel,private_channel',
		} = options;

		try {
			const params = new URLSearchParams({
				limit: Math.min(limit, 1000).toString(),
				exclude_archived: excludeArchived.toString(),
				types,
			});

			if (cursor) params.set('cursor', cursor);

			const response = await this.get(`/conversations.list?${params}`);
			await assertResponseOk(response, { integration: 'slack', action: 'list-channels' });

			const data = (await response.json()) as {
				ok: boolean;
				error?: string;
				channels?: SlackChannel[];
				response_metadata?: { next_cursor?: string };
			};

			if (!data.ok) {
				throw this.createSlackError(data.error || 'Unknown error', 'list-channels');
			}

			const channels = data.channels || [];

			// Also provide standardized list format
			const standard: StandardList = {
				type: 'list',
				items: channels.map((ch) => ({
					id: ch.id,
					title: ch.name,
					description: ch.purpose?.value || ch.topic?.value,
					metadata: {
						is_private: ch.is_private,
						is_archived: ch.is_archived,
						num_members: ch.num_members,
					},
				})),
				metadata: {
					total: channels.length,
					hasMore: !!data.response_metadata?.next_cursor,
					cursor: data.response_metadata?.next_cursor,
				},
			};

			return createActionResult({
				data: channels,
				integration: 'slack',
				action: 'list-channels',
				schema: 'slack.channel-list.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error) {
			return handleError(error, 'list-channels');
		}
	}

	/**
	 * Get messages from a channel
	 *
	 * @example
	 * ```typescript
	 * // Get last 24 hours of messages (Zuhandenheit - tool recedes)
	 * const messages = await slack.getMessages({
	 *   channel: 'C123456',
	 *   since: '24h'
	 * });
	 *
	 * // Get last 7 days
	 * const weekMessages = await slack.getMessages({
	 *   channel: 'C123456',
	 *   since: '7d'
	 * });
	 *
	 * // Get since specific date
	 * const messages = await slack.getMessages({
	 *   channel: 'C123456',
	 *   since: new Date('2024-01-01')
	 * });
	 * ```
	 *
	 * @returns ActionResult with list of messages
	 */
	async getMessages(options: GetMessagesOptions): Promise<ActionResult<SlackMessage[]>> {
		const { channel, limit = 20, cursor, since, oldest, latest, inclusive = false, humanOnly = false } = options;

		// Parse 'since' into Slack's oldest format (Zuhandenheit: hide the conversion)
		const resolvedOldest = since ? this.parseSince(since) : oldest;

		if (!channel) {
			return ActionResult.error('Channel ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'slack',
				action: 'get-messages',
			});
		}

		try {
			const params = new URLSearchParams({
				channel,
				limit: Math.min(limit, 1000).toString(),
				inclusive: inclusive.toString(),
			});

			if (cursor) params.set('cursor', cursor);
			if (resolvedOldest) params.set('oldest', resolvedOldest);
			if (latest) params.set('latest', latest);

			const response = await this.get(`/conversations.history?${params}`);
			await assertResponseOk(response, { integration: 'slack', action: 'get-messages' });

			const data = (await response.json()) as {
				ok: boolean;
				error?: string;
				messages?: SlackMessage[];
				has_more?: boolean;
				response_metadata?: { next_cursor?: string };
			};

			if (!data.ok) {
				throw this.createSlackError(data.error || 'Unknown error', 'get-messages');
			}

			// Zuhandenheit: Filter to human messages if requested
			// Developer thinks "get what people said" not "filter by bot_id, subtype, type"
			let messages = data.messages || [];
			if (humanOnly) {
				messages = messages.filter((m) =>
					!m.bot_id &&
					m.type === 'message' &&
					!m.subtype && // Excludes channel_join, channel_leave, etc.
					m.text
				);
			}

			return createActionResult({
				data: messages,
				integration: 'slack',
				action: 'get-messages',
				schema: 'slack.message-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-messages');
		}
	}

	/**
	 * Get a single message by timestamp
	 *
	 * @returns ActionResult with message data and StandardMessage format
	 */
	async getMessage(channel: string, ts: string): Promise<ActionResult<SlackMessage>> {
		if (!channel || !ts) {
			return ActionResult.error(
				'Channel ID and message timestamp are required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'slack', action: 'get-message' }
			);
		}

		try {
			const params = new URLSearchParams({
				channel,
				latest: ts,
				oldest: ts,
				inclusive: 'true',
				limit: '1',
			});

			const response = await this.get(`/conversations.history?${params}`);
			await assertResponseOk(response, { integration: 'slack', action: 'get-message' });

			const data = (await response.json()) as {
				ok: boolean;
				error?: string;
				messages?: SlackMessage[];
			};

			if (!data.ok) {
				throw this.createSlackError(data.error || 'Unknown error', 'get-message');
			}

			if (!data.messages || data.messages.length === 0) {
				return ActionResult.error('Message not found', ErrorCode.NOT_FOUND, {
					integration: 'slack',
					action: 'get-message',
				});
			}

			const message = data.messages[0];
			const standard = this.toStandardMessage(message, channel);

			return createActionResult({
				data: message,
				integration: 'slack',
				action: 'get-message',
				schema: 'slack.message.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error) {
			return handleError(error, 'get-message');
		}
	}

	/**
	 * Send a message to a channel
	 *
	 * @returns ActionResult with sent message info
	 */
	async sendMessage(
		options: SendMessageOptions
	): Promise<ActionResult<{ ts: string; channel: string }>> {
		const {
			channel,
			text,
			thread_ts,
			reply_broadcast = false,
			unfurl_links = true,
			unfurl_media = true,
			parse = 'full',
		} = options;

		if (!channel) {
			return ActionResult.error('Channel ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'slack',
				action: 'send-message',
			});
		}

		if (!text) {
			return ActionResult.error('Message text is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'slack',
				action: 'send-message',
			});
		}

		try {
			const body: Record<string, unknown> = {
				channel,
				text,
				unfurl_links,
				unfurl_media,
				parse,
			};

			if (thread_ts) {
				body.thread_ts = thread_ts;
				body.reply_broadcast = reply_broadcast;
			}

			const response = await this.post('/chat.postMessage', body);
			await assertResponseOk(response, { integration: 'slack', action: 'send-message' });

			const data = (await response.json()) as {
				ok: boolean;
				error?: string;
				ts?: string;
				channel?: string;
				message?: SlackMessage;
			};

			if (!data.ok) {
				throw this.createSlackError(data.error || 'Unknown error', 'send-message');
			}

			return ActionResult.success(
				{ ts: data.ts!, channel: data.channel! },
				{
					integration: 'slack',
					action: 'send-message',
					schema: 'slack.send-result.v1',
					capabilities: { canHandleText: true },
				}
			);
		} catch (error) {
			return handleError(error, 'send-message');
		}
	}

	/**
	 * Get user information
	 *
	 * @returns ActionResult with user data
	 */
	async getUser(options: GetUserOptions): Promise<ActionResult<SlackUser>> {
		const { user } = options;

		if (!user) {
			return ActionResult.error('User ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'slack',
				action: 'get-user',
			});
		}

		try {
			const params = new URLSearchParams({ user });
			const response = await this.get(`/users.info?${params}`);
			await assertResponseOk(response, { integration: 'slack', action: 'get-user' });

			const data = (await response.json()) as {
				ok: boolean;
				error?: string;
				user?: SlackUser;
			};

			if (!data.ok) {
				throw this.createSlackError(data.error || 'Unknown error', 'get-user');
			}

			return createActionResult({
				data: data.user!,
				integration: 'slack',
				action: 'get-user',
				schema: 'slack.user.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-user');
		}
	}

	/**
	 * Search messages across channels
	 *
	 * @returns ActionResult with matching messages
	 */
	async searchMessages(
		query: string,
		options: { count?: number; sort?: 'score' | 'timestamp' } = {}
	): Promise<ActionResult<SlackMessage[]>> {
		const { count = 20, sort = 'score' } = options;

		if (!query) {
			return ActionResult.error('Search query is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'slack',
				action: 'search-messages',
			});
		}

		try {
			const params = new URLSearchParams({
				query,
				count: count.toString(),
				sort,
			});

			const response = await this.get(`/search.messages?${params}`);
			await assertResponseOk(response, { integration: 'slack', action: 'search-messages' });

			const data = (await response.json()) as {
				ok: boolean;
				error?: string;
				messages?: {
					matches: SlackMessage[];
					total: number;
				};
			};

			if (!data.ok) {
				throw this.createSlackError(data.error || 'Unknown error', 'search-messages');
			}

			return createActionResult({
				data: data.messages?.matches || [],
				integration: 'slack',
				action: 'search-messages',
				schema: 'slack.message-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'search-messages');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Parse human-friendly 'since' value into Slack's timestamp format
	 *
	 * Zuhandenheit: The developer thinks "get last 24 hours" not
	 * "convert milliseconds to seconds and format as string"
	 *
	 * @param since - Duration string ("1h", "24h", "7d"), Date, or raw timestamp
	 * @returns Slack timestamp string (Unix seconds)
	 */
	private parseSince(since: string | Date): string {
		// If it's a Date object, convert to Unix seconds
		if (since instanceof Date) {
			return Math.floor(since.getTime() / 1000).toString();
		}

		// If it looks like a raw timestamp (all digits), pass through
		if (/^\d+(\.\d+)?$/.test(since)) {
			return since;
		}

		// Parse duration strings: "1h", "24h", "7d", "30d"
		const match = since.match(/^(\d+)(h|d)$/i);
		if (match) {
			const value = parseInt(match[1], 10);
			const unit = match[2].toLowerCase();
			const now = Date.now();

			let ms: number;
			if (unit === 'h') {
				ms = value * 60 * 60 * 1000; // hours to ms
			} else {
				ms = value * 24 * 60 * 60 * 1000; // days to ms
			}

			return Math.floor((now - ms) / 1000).toString();
		}

		// Fallback: try parsing as ISO date string
		const parsed = Date.parse(since);
		if (!isNaN(parsed)) {
			return Math.floor(parsed / 1000).toString();
		}

		// If nothing works, return as-is (let Slack API error if invalid)
		return since;
	}

	/**
	 * Get capabilities for Slack actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: true, // Slack markdown
			canHandleAttachments: true,
			canHandleImages: true,
			supportsSearch: true,
			supportsPagination: true,
			supportsMetadata: true,
		};
	}

	/**
	 * Convert Slack message to StandardMessage format
	 */
	private toStandardMessage(message: SlackMessage, channel: string): StandardMessage {
		// Extract attachments
		const attachments = message.files?.map((f) => ({
			id: f.id,
			name: f.name,
			mimeType: f.mimetype,
			size: f.size,
			url: f.url_private,
		}));

		// Parse timestamp (Slack uses epoch.microseconds format)
		const timestamp = parseFloat(message.ts) * 1000;

		return {
			type: 'message',
			id: message.ts,
			title: message.text.slice(0, 100), // First 100 chars as title
			body: message.text,
			bodyText: message.text,
			from: message.user,
			to: [channel],
			timestamp,
			attachments,
			metadata: {
				thread_ts: message.thread_ts,
				reply_count: message.reply_count,
				reactions: message.reactions,
			},
		};
	}

	/**
	 * Create IntegrationError from Slack API error
	 */
	private createSlackError(error: string, action: string): IntegrationError {
		// Map Slack error codes to our error codes
		const errorMap: Record<string, ErrorCode> = {
			not_authed: ErrorCode.AUTH_MISSING,
			invalid_auth: ErrorCode.AUTH_INVALID,
			token_expired: ErrorCode.AUTH_EXPIRED,
			token_revoked: ErrorCode.AUTH_INVALID,
			missing_scope: ErrorCode.AUTH_INSUFFICIENT_SCOPE,
			ratelimited: ErrorCode.RATE_LIMITED,
			channel_not_found: ErrorCode.NOT_FOUND,
			user_not_found: ErrorCode.NOT_FOUND,
			message_not_found: ErrorCode.NOT_FOUND,
			not_in_channel: ErrorCode.PERMISSION_DENIED,
			is_archived: ErrorCode.PERMISSION_DENIED,
			msg_too_long: ErrorCode.INVALID_INPUT,
			no_text: ErrorCode.MISSING_REQUIRED_FIELD,
			restricted_action: ErrorCode.PERMISSION_DENIED,
		};

		const code = errorMap[error] || ErrorCode.API_ERROR;

		return new IntegrationError(code, `Slack API error: ${error}`, {
			integration: 'slack',
			action,
			providerCode: error,
			retryable: code === ErrorCode.RATE_LIMITED,
		});
	}

}
