/**
 * Slack Integration Tests
 *
 * Tests for the Slack integration client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Slack } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Slack', () => {
	const testConfig = {
		accessToken: 'xoxb-test-access-token',
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
		it('should throw error if access token is missing', () => {
			expect(() => new Slack({ accessToken: '' })).toThrow();
		});

		it('should create instance with valid config', () => {
			const client = new Slack(testConfig);
			expect(client).toBeInstanceOf(Slack);
		});

		it('should use custom API URL if provided', () => {
			const client = new Slack({
				accessToken: 'test-token',
				apiUrl: 'https://custom.slack.com/api',
			});
			expect(client).toBeInstanceOf(Slack);
		});
	});

	// ============================================================================
	// LIST CHANNELS TESTS
	// ============================================================================

	describe('listChannels', () => {
		it('should fetch channels successfully', async () => {
			const mockChannels = {
				ok: true,
				channels: [
					{
						id: 'C123456',
						name: 'general',
						is_channel: true,
						is_group: false,
						is_im: false,
						is_mpim: false,
						is_private: false,
						is_archived: false,
						is_member: true,
						topic: { value: 'General discussion' },
						purpose: { value: 'Team updates' },
						num_members: 50,
					},
					{
						id: 'C789012',
						name: 'engineering',
						is_channel: true,
						is_group: false,
						is_im: false,
						is_mpim: false,
						is_private: false,
						is_archived: false,
						is_member: true,
						num_members: 20,
					},
				],
				response_metadata: {},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockChannels),
			});

			const client = new Slack(testConfig);
			const result = await client.listChannels();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
			expect(result.data[0].name).toBe('general');
			expect(result.data[1].name).toBe('engineering');
		});

		it('should handle pagination cursor', async () => {
			const mockChannels = {
				ok: true,
				channels: [],
				response_metadata: { next_cursor: 'dGVhbTpDMDYxRkE1UEI=' },
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockChannels),
			});

			const client = new Slack(testConfig);
			const result = await client.listChannels({ cursor: 'prev-cursor' });

			expect(result.success).toBe(true);
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('cursor=prev-cursor'),
				expect.any(Object)
			);
		});

		it('should exclude archived channels by default', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: true, channels: [] }),
			});

			const client = new Slack(testConfig);
			await client.listChannels();

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('exclude_archived=true'),
				expect.any(Object)
			);
		});

		it('should handle Slack API errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: false, error: 'not_authed' }),
			});

			const client = new Slack(testConfig);
			const result = await client.listChannels();

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('auth_missing');
		});

		it('should respect limit parameter', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: true, channels: [] }),
			});

			const client = new Slack(testConfig);
			await client.listChannels({ limit: 50 });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('limit=50'),
				expect.any(Object)
			);
		});

		it('should cap limit at 1000', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: true, channels: [] }),
			});

			const client = new Slack(testConfig);
			await client.listChannels({ limit: 2000 });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('limit=1000'),
				expect.any(Object)
			);
		});
	});

	// ============================================================================
	// GET MESSAGES TESTS
	// ============================================================================

	describe('getMessages', () => {
		it('should fetch messages successfully', async () => {
			const mockMessages = {
				ok: true,
				messages: [
					{
						type: 'message',
						ts: '1699900000.000100',
						user: 'U123456',
						text: 'Hello everyone!',
					},
					{
						type: 'message',
						ts: '1699900001.000200',
						user: 'U789012',
						text: 'Hi there!',
						thread_ts: '1699900000.000100',
					},
				],
				has_more: false,
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMessages),
			});

			const client = new Slack(testConfig);
			const result = await client.getMessages({ channel: 'C123456' });

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
			expect(result.data[0].text).toBe('Hello everyone!');
		});

		it('should require channel ID', async () => {
			const client = new Slack(testConfig);
			const result = await client.getMessages({ channel: '' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('missing_required_field');
		});

		it('should filter to human messages when humanOnly is true', async () => {
			const mockMessages = {
				ok: true,
				messages: [
					{
						type: 'message',
						ts: '1699900000.000100',
						user: 'U123456',
						text: 'Human message',
					},
					{
						type: 'message',
						ts: '1699900001.000200',
						bot_id: 'B123456',
						text: 'Bot message',
					},
					{
						type: 'message',
						ts: '1699900002.000300',
						user: 'U123456',
						subtype: 'channel_join',
						text: 'U123456 joined the channel',
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMessages),
			});

			const client = new Slack(testConfig);
			const result = await client.getMessages({ channel: 'C123456', humanOnly: true });

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(1);
			expect(result.data[0].text).toBe('Human message');
		});

		it('should handle since parameter with duration string', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: true, messages: [] }),
			});

			const client = new Slack(testConfig);
			await client.getMessages({ channel: 'C123456', since: '24h' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('oldest='),
				expect.any(Object)
			);
		});

		it('should handle since parameter with Date object', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: true, messages: [] }),
			});

			const client = new Slack(testConfig);
			const date = new Date('2024-01-15T10:00:00Z');
			await client.getMessages({ channel: 'C123456', since: date });

			const expectedTs = Math.floor(date.getTime() / 1000).toString();
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining(`oldest=${expectedTs}`),
				expect.any(Object)
			);
		});

		it('should handle channel_not_found error', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: false, error: 'channel_not_found' }),
			});

			const client = new Slack(testConfig);
			const result = await client.getMessages({ channel: 'C000000' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('not_found');
		});
	});

	// ============================================================================
	// GET MESSAGE (SINGLE) TESTS
	// ============================================================================

	describe('getMessage', () => {
		it('should fetch a single message', async () => {
			const mockMessages = {
				ok: true,
				messages: [
					{
						type: 'message',
						ts: '1699900000.000100',
						user: 'U123456',
						text: 'Specific message',
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockMessages),
			});

			const client = new Slack(testConfig);
			const result = await client.getMessage('C123456', '1699900000.000100');

			expect(result.success).toBe(true);
			expect(result.data.text).toBe('Specific message');
		});

		it('should require channel ID and timestamp', async () => {
			const client = new Slack(testConfig);

			const result1 = await client.getMessage('', '1699900000.000100');
			expect(result1.success).toBe(false);

			const result2 = await client.getMessage('C123456', '');
			expect(result2.success).toBe(false);
		});

		it('should return not found for missing message', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: true, messages: [] }),
			});

			const client = new Slack(testConfig);
			const result = await client.getMessage('C123456', '9999999999.000000');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('not_found');
		});
	});

	// ============================================================================
	// SEND MESSAGE TESTS
	// ============================================================================

	describe('sendMessage', () => {
		it('should send message successfully', async () => {
			const mockResponse = {
				ok: true,
				channel: 'C123456',
				ts: '1699900000.000100',
				message: {
					type: 'message',
					ts: '1699900000.000100',
					user: 'U123456',
					text: 'Hello from WORKWAY!',
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const client = new Slack(testConfig);
			const result = await client.sendMessage({
				channel: 'C123456',
				text: 'Hello from WORKWAY!',
			});

			expect(result.success).toBe(true);
			expect(result.data.channel).toBe('C123456');
			expect(result.data.ts).toBe('1699900000.000100');
		});

		it('should require channel ID', async () => {
			const client = new Slack(testConfig);
			const result = await client.sendMessage({ channel: '', text: 'Test' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('missing_required_field');
		});

		it('should require message text', async () => {
			const client = new Slack(testConfig);
			const result = await client.sendMessage({ channel: 'C123456', text: '' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('missing_required_field');
		});

		it('should send threaded reply', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						ok: true,
						channel: 'C123456',
						ts: '1699900001.000200',
					}),
			});

			const client = new Slack(testConfig);
			await client.sendMessage({
				channel: 'C123456',
				text: 'Reply in thread',
				thread_ts: '1699900000.000100',
			});

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					body: expect.stringContaining('"thread_ts":"1699900000.000100"'),
				})
			);
		});

		it('should handle rate limiting', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: false, error: 'ratelimited' }),
			});

			const client = new Slack(testConfig);
			const result = await client.sendMessage({
				channel: 'C123456',
				text: 'Test',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('rate_limited');
		});

		it('should handle permission denied', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: false, error: 'not_in_channel' }),
			});

			const client = new Slack(testConfig);
			const result = await client.sendMessage({
				channel: 'C123456',
				text: 'Test',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('permission_denied');
		});
	});

	// ============================================================================
	// GET USER TESTS
	// ============================================================================

	describe('getUser', () => {
		it('should fetch user information', async () => {
			const mockUser = {
				ok: true,
				user: {
					id: 'U123456',
					name: 'john.doe',
					real_name: 'John Doe',
					profile: {
						email: 'john.doe@example.com',
						display_name: 'John',
						image_72: 'https://avatars.slack.com/user.png',
					},
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockUser),
			});

			const client = new Slack(testConfig);
			const result = await client.getUser({ user: 'U123456' });

			expect(result.success).toBe(true);
			expect(result.data.name).toBe('john.doe');
			expect(result.data.real_name).toBe('John Doe');
			expect(result.data.profile?.email).toBe('john.doe@example.com');
		});

		it('should require user ID', async () => {
			const client = new Slack(testConfig);
			const result = await client.getUser({ user: '' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('missing_required_field');
		});

		it('should handle user not found', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: false, error: 'user_not_found' }),
			});

			const client = new Slack(testConfig);
			const result = await client.getUser({ user: 'U000000' });

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('not_found');
		});
	});

	// ============================================================================
	// SEARCH MESSAGES TESTS
	// ============================================================================

	describe('searchMessages', () => {
		it('should search messages successfully', async () => {
			const mockSearch = {
				ok: true,
				messages: {
					matches: [
						{
							type: 'message',
							ts: '1699900000.000100',
							user: 'U123456',
							text: 'Meeting notes from today',
						},
						{
							type: 'message',
							ts: '1699900001.000200',
							user: 'U789012',
							text: 'Updated meeting agenda',
						},
					],
					total: 2,
				},
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockSearch),
			});

			const client = new Slack(testConfig);
			const result = await client.searchMessages('meeting');

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
			expect(result.data[0].text).toContain('Meeting notes');
		});

		it('should require search query', async () => {
			const client = new Slack(testConfig);
			const result = await client.searchMessages('');

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('missing_required_field');
		});

		it('should support count parameter', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: true, messages: { matches: [], total: 0 } }),
			});

			const client = new Slack(testConfig);
			await client.searchMessages('test', { count: 50 });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('count=50'),
				expect.any(Object)
			);
		});

		it('should support sort parameter', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: true, messages: { matches: [], total: 0 } }),
			});

			const client = new Slack(testConfig);
			await client.searchMessages('test', { sort: 'timestamp' });

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('sort=timestamp'),
				expect.any(Object)
			);
		});
	});

	// ============================================================================
	// ERROR HANDLING TESTS
	// ============================================================================

	describe('error handling', () => {
		it('should handle auth errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: false, error: 'invalid_auth' }),
			});

			const client = new Slack(testConfig);
			const result = await client.listChannels();

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('auth_invalid');
		});

		it('should handle token expired', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: false, error: 'token_expired' }),
			});

			const client = new Slack(testConfig);
			const result = await client.listChannels();

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('auth_expired');
		});

		it('should handle missing scope', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ ok: false, error: 'missing_scope' }),
			});

			const client = new Slack(testConfig);
			const result = await client.listChannels();

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('auth_insufficient_scope');
		});

		it('should handle HTTP errors', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			});

			const client = new Slack(testConfig);
			const result = await client.listChannels();

			expect(result.success).toBe(false);
		});

		it('should handle network errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const client = new Slack(testConfig);
			const result = await client.listChannels();

			expect(result.success).toBe(false);
		});
	});

	// ============================================================================
	// STANDARD FORMAT TESTS
	// ============================================================================

	describe('standard format', () => {
		it('should include standard list format in listChannels response', async () => {
			const mockChannels = {
				ok: true,
				channels: [
					{
						id: 'C123456',
						name: 'general',
						is_channel: true,
						is_group: false,
						is_im: false,
						is_mpim: false,
						is_private: false,
						is_archived: false,
						is_member: true,
						purpose: { value: 'General updates' },
					},
				],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockChannels),
			});

			const client = new Slack(testConfig);
			const result = await client.listChannels();

			expect(result.success).toBe(true);
			expect(result.standard).toBeDefined();
			expect(result.standard?.type).toBe('list');
			const list = result.standard as { type: 'list'; items: Array<{ id: string; title: string }> };
			expect(list.items).toHaveLength(1);
			expect(list.items[0].id).toBe('C123456');
			expect(list.items[0].title).toBe('general');
		});

		it('should include capabilities in response', async () => {
			const mockChannels = {
				ok: true,
				channels: [],
			};

			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockChannels),
			});

			const client = new Slack(testConfig);
			const result = await client.listChannels();

			expect(result.success).toBe(true);
			expect(result.capabilities?.supportsPagination).toBe(true);
			expect(result.capabilities?.canHandleText).toBe(true);
		});
	});
});
