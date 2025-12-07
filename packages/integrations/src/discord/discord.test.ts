/**
 * Discord Integration Tests
 *
 * Tests for the Discord integration client (Bot and Webhook).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Discord, DiscordWebhook, toStandardMessage } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Discord', () => {
	const testConfig = {
		botToken: 'test_bot_token_123',
	};

	beforeEach(() => {
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	// ============================================================================
	// CONSTRUCTOR TESTS
	// ============================================================================

	describe('constructor', () => {
		it('should create instance with valid config', () => {
			const client = new Discord(testConfig);
			expect(client).toBeInstanceOf(Discord);
		});

		it('should create instance even with empty token (validation happens on request)', () => {
			// BaseAPIClient doesn't validate token in constructor
			// Validation happens when making requests
			const client = new Discord({ botToken: '' });
			expect(client).toBeInstanceOf(Discord);
		});
	});

	// ============================================================================
	// CHANNELS TESTS
	// ============================================================================

	describe('channels', () => {
		describe('sendMessage', () => {
			it('should send a message successfully', async () => {
				const mockMessage = {
					id: '1234567890',
					channel_id: '9876543210',
					guild_id: '1111111111',
					author: {
						id: '222222222',
						username: 'testbot',
						discriminator: '0000',
					},
					content: 'Hello from WORKWAY!',
					timestamp: '2024-01-15T10:00:00Z',
					tts: false,
					mention_everyone: false,
					mentions: [],
					attachments: [],
					embeds: [],
					type: 0,
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockMessage),
				});

				const client = new Discord(testConfig);
				const result = await client.channels.sendMessage({
					channelId: '9876543210',
					content: 'Hello from WORKWAY!',
				});

				expect(result.success).toBe(true);
				expect(result.data?.content).toBe('Hello from WORKWAY!');
				expect(mockFetch).toHaveBeenCalledWith(
					expect.stringContaining('/channels/9876543210/messages'),
					expect.objectContaining({
						method: 'POST',
					})
				);
			});

			it('should send a message with embeds', async () => {
				const mockMessage = {
					id: '1234567890',
					channel_id: '9876543210',
					author: { id: '222', username: 'testbot', discriminator: '0000' },
					content: '',
					timestamp: '2024-01-15T10:00:00Z',
					tts: false,
					mention_everyone: false,
					mentions: [],
					attachments: [],
					embeds: [
						{
							title: 'New Issue',
							description: 'Bug report',
							color: 0xff0000,
						},
					],
					type: 0,
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockMessage),
				});

				const client = new Discord(testConfig);
				const result = await client.channels.sendMessage({
					channelId: '9876543210',
					embeds: [
						{
							title: 'New Issue',
							description: 'Bug report',
							color: 0xff0000,
						},
					],
				});

				expect(result.success).toBe(true);
				expect(result.data?.embeds).toHaveLength(1);
				expect(result.data?.embeds[0].title).toBe('New Issue');
			});
		});

		describe('get', () => {
			it('should get a channel', async () => {
				const mockChannel = {
					id: '9876543210',
					type: 0,
					guild_id: '1111111111',
					name: 'general',
					topic: 'General discussion',
					position: 0,
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockChannel),
				});

				const client = new Discord(testConfig);
				const result = await client.channels.get('9876543210');

				expect(result.success).toBe(true);
				expect(result.data?.name).toBe('general');
			});
		});

		describe('getMessages', () => {
			it('should get messages from a channel', async () => {
				const mockMessages = [
					{
						id: '111',
						channel_id: '9876543210',
						author: { id: '222', username: 'user1', discriminator: '1234' },
						content: 'Hello!',
						timestamp: '2024-01-15T10:00:00Z',
						tts: false,
						mention_everyone: false,
						mentions: [],
						attachments: [],
						embeds: [],
						type: 0,
					},
					{
						id: '112',
						channel_id: '9876543210',
						author: { id: '333', username: 'user2', discriminator: '5678' },
						content: 'Hi there!',
						timestamp: '2024-01-15T10:01:00Z',
						tts: false,
						mention_everyone: false,
						mentions: [],
						attachments: [],
						embeds: [],
						type: 0,
					},
				];

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockMessages),
				});

				const client = new Discord(testConfig);
				const result = await client.channels.getMessages({
					channelId: '9876543210',
					limit: 50,
				});

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(2);
			});
		});

		describe('editMessage', () => {
			it('should edit a message', async () => {
				const mockMessage = {
					id: '1234567890',
					channel_id: '9876543210',
					author: { id: '222', username: 'testbot', discriminator: '0000' },
					content: 'Updated content',
					timestamp: '2024-01-15T10:00:00Z',
					edited_timestamp: '2024-01-15T10:05:00Z',
					tts: false,
					mention_everyone: false,
					mentions: [],
					attachments: [],
					embeds: [],
					type: 0,
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockMessage),
				});

				const client = new Discord(testConfig);
				const result = await client.channels.editMessage({
					channelId: '9876543210',
					messageId: '1234567890',
					content: 'Updated content',
				});

				expect(result.success).toBe(true);
				expect(result.data?.content).toBe('Updated content');
			});
		});

		describe('deleteMessage', () => {
			it('should delete a message', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 204,
					json: () => Promise.resolve(undefined),
				});

				const client = new Discord(testConfig);
				const result = await client.channels.deleteMessage({
					channelId: '9876543210',
					messageId: '1234567890',
				});

				expect(result.success).toBe(true);
			});
		});

		describe('addReaction', () => {
			it('should add a reaction to a message', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 204,
				});

				const client = new Discord(testConfig);
				const result = await client.channels.addReaction({
					channelId: '9876543210',
					messageId: '1234567890',
					emoji: '%F0%9F%91%8D', // thumbs up
				});

				expect(result.success).toBe(true);
			});
		});
	});

	// ============================================================================
	// GUILDS TESTS
	// ============================================================================

	describe('guilds', () => {
		describe('get', () => {
			it('should get a guild', async () => {
				const mockGuild = {
					id: '1111111111',
					name: 'Test Server',
					icon: 'icon_hash',
					owner_id: '222222222',
					features: ['COMMUNITY'],
					member_count: 150,
					description: 'A test server',
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockGuild),
				});

				const client = new Discord(testConfig);
				const result = await client.guilds.get('1111111111');

				expect(result.success).toBe(true);
				expect(result.data?.name).toBe('Test Server');
			});
		});

		describe('getChannels', () => {
			it('should get guild channels', async () => {
				const mockChannels = [
					{ id: '111', type: 0, name: 'general', position: 0 },
					{ id: '112', type: 2, name: 'Voice Chat', position: 1 },
				];

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockChannels),
				});

				const client = new Discord(testConfig);
				const result = await client.guilds.getChannels('1111111111');

				expect(result.success).toBe(true);
				expect(result.data).toHaveLength(2);
			});
		});

		describe('getMembers', () => {
			it('should get guild members', async () => {
				const mockMembers = [
					{
						user: { id: '111', username: 'user1', discriminator: '1234' },
						roles: ['role1'],
						joined_at: '2024-01-01T00:00:00Z',
					},
					{
						user: { id: '222', username: 'user2', discriminator: '5678' },
						nick: 'Nickname',
						roles: ['role1', 'role2'],
						joined_at: '2024-01-02T00:00:00Z',
					},
				];

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockMembers),
				});

				const client = new Discord(testConfig);
				const result = await client.guilds.getMembers({ guildId: '1111111111' });

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(2);
			});
		});

		describe('getRoles', () => {
			it('should get guild roles', async () => {
				const mockRoles = [
					{
						id: 'role1',
						name: 'Admin',
						color: 0xff0000,
						hoist: true,
						position: 10,
						permissions: '8',
						managed: false,
						mentionable: true,
					},
					{
						id: 'role2',
						name: 'Member',
						color: 0x00ff00,
						hoist: false,
						position: 1,
						permissions: '0',
						managed: false,
						mentionable: false,
					},
				];

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockRoles),
				});

				const client = new Discord(testConfig);
				const result = await client.guilds.getRoles('1111111111');

				expect(result.success).toBe(true);
				expect(result.data).toHaveLength(2);
				expect(result.data?.[0].name).toBe('Admin');
			});
		});
	});

	// ============================================================================
	// USERS TESTS
	// ============================================================================

	describe('users', () => {
		describe('me', () => {
			it('should get the bot user', async () => {
				const mockUser = {
					id: '123456789',
					username: 'TestBot',
					discriminator: '0000',
					global_name: 'Test Bot',
					avatar: 'avatar_hash',
					bot: true,
				};

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockUser),
				});

				const client = new Discord(testConfig);
				const result = await client.users.me();

				expect(result.success).toBe(true);
				expect(result.data?.username).toBe('TestBot');
				expect(result.data?.bot).toBe(true);
			});
		});

		describe('myGuilds', () => {
			it("should get the bot's guilds", async () => {
				const mockGuilds = [
					{ id: '111', name: 'Server 1', features: [] },
					{ id: '222', name: 'Server 2', features: ['COMMUNITY'] },
				];

				mockFetch.mockResolvedValueOnce({
					ok: true,
					json: () => Promise.resolve(mockGuilds),
				});

				const client = new Discord(testConfig);
				const result = await client.users.myGuilds();

				expect(result.success).toBe(true);
				expect(result.data?.items).toHaveLength(2);
			});
		});
	});

	// ============================================================================
	// ERROR HANDLING TESTS
	// ============================================================================

	describe('error handling', () => {
		it('should handle 401 unauthorized', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				json: () => Promise.resolve({ message: 'Invalid token' }),
			});

			const client = new Discord(testConfig);
			const result = await client.users.me();

			expect(result.success).toBe(false);
		});

		it('should handle 403 forbidden', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 403,
				statusText: 'Forbidden',
				json: () => Promise.resolve({ message: 'Missing permissions' }),
			});

			const client = new Discord(testConfig);
			const result = await client.channels.sendMessage({
				channelId: '123',
				content: 'Test',
			});

			expect(result.success).toBe(false);
		});

		it('should handle 404 not found', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 404,
				statusText: 'Not Found',
				json: () => Promise.resolve({ message: 'Unknown Channel' }),
			});

			const client = new Discord(testConfig);
			const result = await client.channels.get('999999999');

			expect(result.success).toBe(false);
		});

		it('should handle rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 429,
				statusText: 'Too Many Requests',
				json: () =>
					Promise.resolve({
						message: 'You are being rate limited.',
						retry_after: 1.5,
					}),
			});

			const client = new Discord(testConfig);
			const result = await client.channels.sendMessage({
				channelId: '123',
				content: 'Test',
			});

			expect(result.success).toBe(false);
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const client = new Discord(testConfig);
			const result = await client.users.me();

			expect(result.success).toBe(false);
		});
	});
});

// ============================================================================
// WEBHOOK TESTS
// ============================================================================

describe('DiscordWebhook', () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should send a message via webhook', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 204,
		});

		const webhook = new DiscordWebhook({
			webhookUrl: 'https://discord.com/api/webhooks/123/abc',
		});

		const result = await webhook.send({
			content: 'Hello from webhook!',
		});

		expect(result.success).toBe(true);
		expect(mockFetch).toHaveBeenCalledWith(
			'https://discord.com/api/webhooks/123/abc',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
		);
	});

	it('should send a message with custom username and avatar', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 204,
		});

		const webhook = new DiscordWebhook({
			webhookUrl: 'https://discord.com/api/webhooks/123/abc',
		});

		const result = await webhook.send({
			content: 'Custom message',
			username: 'WORKWAY Bot',
			avatar_url: 'https://example.com/avatar.png',
		});

		expect(result.success).toBe(true);
	});

	it('should send embeds via webhook', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 204,
		});

		const webhook = new DiscordWebhook({
			webhookUrl: 'https://discord.com/api/webhooks/123/abc',
		});

		const result = await webhook.send({
			embeds: [
				{
					title: 'Alert',
					description: 'Something happened',
					color: 0xff0000,
				},
			],
		});

		expect(result.success).toBe(true);
	});

	it('should handle webhook errors', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			statusText: 'Not Found',
		});

		const webhook = new DiscordWebhook({
			webhookUrl: 'https://discord.com/api/webhooks/invalid/invalid',
		});

		const result = await webhook.send({ content: 'Test' });

		expect(result.success).toBe(false);
	});
});

// ============================================================================
// STANDARD CONVERSION TESTS
// ============================================================================

describe('toStandardMessage', () => {
	it('should convert Discord message to StandardMessage', () => {
		const discordMessage = {
			id: '1234567890',
			channel_id: '9876543210',
			guild_id: '1111111111',
			author: {
				id: '222222222',
				username: 'testuser',
				discriminator: '1234',
			},
			content: 'Hello World\nThis is a test message',
			timestamp: '2024-01-15T10:00:00.000Z',
			tts: false,
			mention_everyone: false,
			mentions: [],
			attachments: [
				{
					id: 'att1',
					filename: 'image.png',
					url: 'https://cdn.discord.com/attachments/...',
					size: 1024,
				},
			],
			embeds: [],
			type: 0,
		};

		const standard = toStandardMessage(discordMessage);

		expect(standard.type).toBe('message');
		expect(standard.id).toBe('1234567890');
		expect(standard.title).toBe('Hello World');
		expect(standard.from).toBe('testuser');
		expect(standard.attachments).toHaveLength(1);
		expect(standard.attachments?.[0].name).toBe('image.png');
		expect(standard.metadata?.channelId).toBe('9876543210');
		expect(standard.metadata?.guildId).toBe('1111111111');
	});

	it('should handle message without newlines', () => {
		const discordMessage = {
			id: '1234567890',
			channel_id: '9876543210',
			author: {
				id: '222222222',
				username: 'testuser',
				discriminator: '1234',
			},
			content: 'Single line message',
			timestamp: '2024-01-15T10:00:00.000Z',
			tts: false,
			mention_everyone: false,
			mentions: [],
			attachments: [],
			embeds: [],
			type: 0,
		};

		const standard = toStandardMessage(discordMessage);

		expect(standard.title).toBe('Single line message');
		expect(standard.body).toBe('Single line message');
	});

	it('should handle message with embeds', () => {
		const discordMessage = {
			id: '1234567890',
			channel_id: '9876543210',
			author: {
				id: '222222222',
				username: 'testuser',
				discriminator: '1234',
			},
			content: 'Check this out',
			timestamp: '2024-01-15T10:00:00.000Z',
			tts: false,
			mention_everyone: false,
			mentions: [],
			attachments: [],
			embeds: [{ title: 'Embed Title', description: 'Embed description' }],
			type: 0,
		};

		const standard = toStandardMessage(discordMessage);

		expect(standard.metadata?.hasEmbeds).toBe(true);
	});
});
