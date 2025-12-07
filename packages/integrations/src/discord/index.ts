/**
 * Discord Integration for WORKWAY
 *
 * Bot and Webhook integration for Discord servers.
 * Zuhandenheit: Developer thinks "send message" not "POST to /channels/:id/messages"
 *
 * @example
 * ```typescript
 * import { Discord } from '@workwayco/integrations/discord';
 *
 * // Bot integration (OAuth2 with bot scope)
 * const discord = new Discord({ botToken: process.env.DISCORD_BOT_TOKEN });
 *
 * // Send a message
 * const message = await discord.channels.sendMessage({
 *   channelId: '123456789',
 *   content: 'Hello from WORKWAY!'
 * });
 *
 * // Send an embed
 * await discord.channels.sendMessage({
 *   channelId: '123456789',
 *   embeds: [{
 *     title: 'New Issue Created',
 *     description: 'Bug: Login not working',
 *     color: 0xff0000
 *   }]
 * });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	IntegrationError,
	type StandardMessage,
	type StandardList,
} from '@workwayco/sdk';
import { BaseAPIClient, buildQueryString, type BaseClientConfig } from '../core/base-client.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DiscordUser {
	id: string;
	username: string;
	discriminator: string;
	global_name?: string;
	avatar?: string;
	bot?: boolean;
	system?: boolean;
	banner?: string;
	accent_color?: number;
}

export interface DiscordGuild {
	id: string;
	name: string;
	icon?: string;
	owner_id: string;
	permissions?: string;
	features: string[];
	member_count?: number;
	description?: string;
}

export interface DiscordChannel {
	id: string;
	type: number; // 0 = GUILD_TEXT, 2 = GUILD_VOICE, 4 = GUILD_CATEGORY, etc.
	guild_id?: string;
	name?: string;
	topic?: string;
	position?: number;
	parent_id?: string;
	last_message_id?: string;
}

export interface DiscordEmbed {
	title?: string;
	description?: string;
	url?: string;
	timestamp?: string;
	color?: number;
	footer?: {
		text: string;
		icon_url?: string;
	};
	image?: {
		url: string;
	};
	thumbnail?: {
		url: string;
	};
	author?: {
		name: string;
		url?: string;
		icon_url?: string;
	};
	fields?: Array<{
		name: string;
		value: string;
		inline?: boolean;
	}>;
}

export interface DiscordMessage {
	id: string;
	channel_id: string;
	guild_id?: string;
	author: DiscordUser;
	content: string;
	timestamp: string;
	edited_timestamp?: string;
	tts: boolean;
	mention_everyone: boolean;
	mentions: DiscordUser[];
	attachments: Array<{
		id: string;
		filename: string;
		url: string;
		size: number;
	}>;
	embeds: DiscordEmbed[];
	type: number;
}

export interface DiscordRole {
	id: string;
	name: string;
	color: number;
	hoist: boolean;
	position: number;
	permissions: string;
	managed: boolean;
	mentionable: boolean;
}

export interface DiscordMember {
	user: DiscordUser;
	nick?: string;
	avatar?: string;
	roles: string[];
	joined_at: string;
	premium_since?: string;
	pending?: boolean;
}

// Channel types
export const ChannelType = {
	GUILD_TEXT: 0,
	DM: 1,
	GUILD_VOICE: 2,
	GROUP_DM: 3,
	GUILD_CATEGORY: 4,
	GUILD_ANNOUNCEMENT: 5,
	ANNOUNCEMENT_THREAD: 10,
	PUBLIC_THREAD: 11,
	PRIVATE_THREAD: 12,
	GUILD_STAGE_VOICE: 13,
	GUILD_DIRECTORY: 14,
	GUILD_FORUM: 15,
} as const;

// ============================================================================
// CLIENT CONFIG
// ============================================================================

export interface DiscordConfig {
	/** Bot token (from Discord Developer Portal) */
	botToken: string;
	/** Request timeout in ms (default: 30000) */
	timeout?: number;
}

// ============================================================================
// DISCORD CLIENT
// ============================================================================

/**
 * Discord REST API client
 *
 * Zuhandenheit principles:
 * - Namespace-based API (channels, guilds, users)
 * - Consistent ActionResult pattern
 * - Embed helpers for rich messages
 */
export class Discord extends BaseAPIClient {
	constructor(config: DiscordConfig) {
		super({
			accessToken: config.botToken,
			apiUrl: 'https://discord.com/api/v10',
			timeout: config.timeout,
			errorContext: { integration: 'discord' },
		});
	}

	/**
	 * Override request to use Bot authorization
	 */
	protected override async request(
		path: string,
		options: RequestInit = {},
		additionalHeaders: Record<string, string> = {},
		isRetry = false
	): Promise<Response> {
		const url = `${this['apiUrl']}${path}`;
		const headers = new Headers(options.headers);

		// Bot authorization
		headers.set('Authorization', `Bot ${this['accessToken']}`);
		headers.set('Content-Type', 'application/json');

		for (const [key, value] of Object.entries(additionalHeaders)) {
			headers.set(key, value);
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this['timeout']);

		try {
			const response = await fetch(url, {
				...options,
				headers,
				signal: controller.signal,
			});

			return response;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new IntegrationError(ErrorCode.TIMEOUT, `Request timed out after ${this['timeout']}ms`, {
					integration: 'discord',
					retryable: true,
				});
			}
			throw new IntegrationError(ErrorCode.NETWORK_ERROR, `Network request failed: ${error}`, {
				integration: 'discord',
				retryable: true,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	}

	// ============================================================================
	// CHANNELS
	// ============================================================================

	channels = {
		/**
		 * Send a message to a channel
		 */
		sendMessage: async (options: {
			channelId: string;
			content?: string;
			embeds?: DiscordEmbed[];
			tts?: boolean;
		}): Promise<ActionResult<DiscordMessage>> => {
			try {
				const message = await this.postJson<DiscordMessage>(
					`/channels/${options.channelId}/messages`,
					{
						content: options.content,
						embeds: options.embeds,
						tts: options.tts,
					}
				);
				return createActionResult({ success: true, data: message });
			} catch (error) {
				return this.handleError(error, 'channels.sendMessage');
			}
		},

		/**
		 * Get a channel
		 */
		get: async (channelId: string): Promise<ActionResult<DiscordChannel>> => {
			try {
				const channel = await this.getJson<DiscordChannel>(`/channels/${channelId}`);
				return createActionResult({ success: true, data: channel });
			} catch (error) {
				return this.handleError(error, 'channels.get');
			}
		},

		/**
		 * Get messages from a channel
		 */
		getMessages: async (options: {
			channelId: string;
			limit?: number;
			before?: string;
			after?: string;
			around?: string;
		}): Promise<ActionResult<StandardList<DiscordMessage>>> => {
			try {
				const query = buildQueryString({
					limit: options.limit || 50,
					before: options.before,
					after: options.after,
					around: options.around,
				});

				const messages = await this.getJson<DiscordMessage[]>(
					`/channels/${options.channelId}/messages${query}`
				);

				return createActionResult({
					success: true,
					data: {
						items: messages,
						hasMore: messages.length === (options.limit || 50),
					},
				});
			} catch (error) {
				return this.handleError(error, 'channels.getMessages');
			}
		},

		/**
		 * Edit a message
		 */
		editMessage: async (options: {
			channelId: string;
			messageId: string;
			content?: string;
			embeds?: DiscordEmbed[];
		}): Promise<ActionResult<DiscordMessage>> => {
			try {
				const message = await this.patchJson<DiscordMessage>(
					`/channels/${options.channelId}/messages/${options.messageId}`,
					{
						content: options.content,
						embeds: options.embeds,
					}
				);
				return createActionResult({ success: true, data: message });
			} catch (error) {
				return this.handleError(error, 'channels.editMessage');
			}
		},

		/**
		 * Delete a message
		 */
		deleteMessage: async (options: {
			channelId: string;
			messageId: string;
		}): Promise<ActionResult<void>> => {
			try {
				await this.deleteJson(`/channels/${options.channelId}/messages/${options.messageId}`);
				return createActionResult({ success: true, data: undefined });
			} catch (error) {
				return this.handleError(error, 'channels.deleteMessage');
			}
		},

		/**
		 * Create a reaction on a message
		 */
		addReaction: async (options: {
			channelId: string;
			messageId: string;
			emoji: string; // URL-encoded emoji (e.g., "%F0%9F%91%8D" for thumbs up)
		}): Promise<ActionResult<void>> => {
			try {
				const response = await this.put(
					`/channels/${options.channelId}/messages/${options.messageId}/reactions/${options.emoji}/@me`
				);
				if (!response.ok && response.status !== 204) {
					throw new IntegrationError(ErrorCode.API_ERROR, `Failed to add reaction: ${response.status}`);
				}
				return createActionResult({ success: true, data: undefined });
			} catch (error) {
				return this.handleError(error, 'channels.addReaction');
			}
		},
	};

	// ============================================================================
	// GUILDS (Servers)
	// ============================================================================

	guilds = {
		/**
		 * Get a guild
		 */
		get: async (guildId: string): Promise<ActionResult<DiscordGuild>> => {
			try {
				const guild = await this.getJson<DiscordGuild>(`/guilds/${guildId}`);
				return createActionResult({ success: true, data: guild });
			} catch (error) {
				return this.handleError(error, 'guilds.get');
			}
		},

		/**
		 * Get guild channels
		 */
		getChannels: async (guildId: string): Promise<ActionResult<DiscordChannel[]>> => {
			try {
				const channels = await this.getJson<DiscordChannel[]>(`/guilds/${guildId}/channels`);
				return createActionResult({ success: true, data: channels });
			} catch (error) {
				return this.handleError(error, 'guilds.getChannels');
			}
		},

		/**
		 * Get guild members
		 */
		getMembers: async (options: {
			guildId: string;
			limit?: number;
			after?: string;
		}): Promise<ActionResult<StandardList<DiscordMember>>> => {
			try {
				const query = buildQueryString({
					limit: options.limit || 100,
					after: options.after,
				});

				const members = await this.getJson<DiscordMember[]>(
					`/guilds/${options.guildId}/members${query}`
				);

				return createActionResult({
					success: true,
					data: {
						items: members,
						hasMore: members.length === (options.limit || 100),
					},
				});
			} catch (error) {
				return this.handleError(error, 'guilds.getMembers');
			}
		},

		/**
		 * Get guild roles
		 */
		getRoles: async (guildId: string): Promise<ActionResult<DiscordRole[]>> => {
			try {
				const roles = await this.getJson<DiscordRole[]>(`/guilds/${guildId}/roles`);
				return createActionResult({ success: true, data: roles });
			} catch (error) {
				return this.handleError(error, 'guilds.getRoles');
			}
		},
	};

	// ============================================================================
	// USERS
	// ============================================================================

	users = {
		/**
		 * Get the current bot user
		 */
		me: async (): Promise<ActionResult<DiscordUser>> => {
			try {
				const user = await this.getJson<DiscordUser>('/users/@me');
				return createActionResult({ success: true, data: user });
			} catch (error) {
				return this.handleError(error, 'users.me');
			}
		},

		/**
		 * Get the bot's guilds
		 */
		myGuilds: async (options: {
			limit?: number;
			before?: string;
			after?: string;
		} = {}): Promise<ActionResult<StandardList<DiscordGuild>>> => {
			try {
				const query = buildQueryString({
					limit: options.limit || 100,
					before: options.before,
					after: options.after,
				});

				const guilds = await this.getJson<DiscordGuild[]>(`/users/@me/guilds${query}`);

				return createActionResult({
					success: true,
					data: {
						items: guilds,
						hasMore: guilds.length === (options.limit || 100),
					},
				});
			} catch (error) {
				return this.handleError(error, 'users.myGuilds');
			}
		},
	};

	// ============================================================================
	// ERROR HANDLING
	// ============================================================================

	private handleError(error: unknown, operation: string): ActionResult<any> {
		if (error instanceof IntegrationError) {
			return createActionResult({
				success: false,
				error: {
					message: error.message,
					code: error.code,
				},
			});
		}

		return createActionResult({
			success: false,
			error: {
				message: error instanceof Error ? error.message : `Discord ${operation} failed`,
				code: ErrorCode.EXTERNAL_SERVICE_ERROR,
			},
		});
	}
}

// ============================================================================
// WEBHOOK HELPER
// ============================================================================

/**
 * Discord Webhook client for simple message sending without bot authentication
 *
 * @example
 * ```typescript
 * const webhook = new DiscordWebhook({ webhookUrl: 'https://discord.com/api/webhooks/...' });
 * await webhook.send({ content: 'Hello!' });
 * ```
 */
export class DiscordWebhook {
	private readonly webhookUrl: string;

	constructor(options: { webhookUrl: string }) {
		this.webhookUrl = options.webhookUrl;
	}

	/**
	 * Send a message via webhook
	 */
	async send(options: {
		content?: string;
		username?: string;
		avatar_url?: string;
		embeds?: DiscordEmbed[];
	}): Promise<ActionResult<void>> {
		try {
			const response = await fetch(this.webhookUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: options.content,
					username: options.username,
					avatar_url: options.avatar_url,
					embeds: options.embeds,
				}),
			});

			if (!response.ok) {
				throw new IntegrationError(
					ErrorCode.API_ERROR,
					`Webhook failed: ${response.status} ${response.statusText}`,
					{ integration: 'discord' }
				);
			}

			return createActionResult({ success: true, data: undefined });
		} catch (error) {
			if (error instanceof IntegrationError) {
				return createActionResult({
					success: false,
					error: { message: error.message, code: error.code },
				});
			}

			return createActionResult({
				success: false,
				error: {
					message: error instanceof Error ? error.message : 'Webhook send failed',
					code: ErrorCode.EXTERNAL_SERVICE_ERROR,
				},
			});
		}
	}
}

// ============================================================================
// STANDARD DATA CONVERSION
// ============================================================================

/**
 * Convert Discord message to StandardMessage
 */
export function toStandardMessage(message: DiscordMessage): StandardMessage {
	// Use first line as title, rest as body
	const lines = message.content.split('\n');
	const title = lines[0] || `Message from ${message.author.username}`;
	const body = lines.slice(1).join('\n') || undefined;

	return {
		type: 'message' as const,
		id: message.id,
		title,
		body: body || message.content,
		bodyText: message.content,
		from: message.author.username,
		timestamp: Date.parse(message.timestamp),
		attachments: message.attachments.map((att) => ({
			id: att.id,
			name: att.filename,
			mimeType: 'application/octet-stream', // Discord doesn't expose MIME type directly
			size: att.size,
		})),
		metadata: {
			channelId: message.channel_id,
			guildId: message.guild_id,
			authorId: message.author.id,
			hasEmbeds: message.embeds.length > 0,
		},
	};
}

export default Discord;
