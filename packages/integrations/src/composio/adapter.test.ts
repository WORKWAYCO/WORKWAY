/**
 * ComposioAdapter Tests
 *
 * Tests the Composio adapter against the BaseAPIClient + ActionResult contract.
 * Uses mocked fetch() to verify behavior without needing a Composio API key.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComposioAdapter } from './adapter.js';
import type { ComposioAdapterConfig } from './adapter.js';

// ============================================================================
// TEST SETUP
// ============================================================================

let adapter: ComposioAdapter;
let mockFetch: ReturnType<typeof vi.fn>;

const defaultConfig: ComposioAdapterConfig = {
	composioApiKey: 'test_composio_key_123',
	appName: 'slack',
};

beforeEach(() => {
	adapter = new ComposioAdapter(defaultConfig);
	mockFetch = vi.fn();
	vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ============================================================================
// HELPER: Mock successful JSON response
// ============================================================================

function mockJsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('ComposioAdapter constructor', () => {
	it('should throw when composioApiKey is missing', () => {
		expect(
			() => new ComposioAdapter({ composioApiKey: '', appName: 'slack' })
		).toThrow('Composio API key is required');
	});

	it('should throw when appName is missing', () => {
		expect(
			() => new ComposioAdapter({ composioApiKey: 'key', appName: '' })
		).toThrow('Composio app name is required');
	});

	it('should create adapter with valid config', () => {
		const adapter = new ComposioAdapter(defaultConfig);
		expect(adapter).toBeDefined();
	});

	it('should accept custom API URL', () => {
		const adapter = new ComposioAdapter({
			...defaultConfig,
			apiUrl: 'https://custom.composio.dev/api/v2',
		});
		expect(adapter).toBeDefined();
	});
});

// ============================================================================
// ACTION DISCOVERY TESTS
// ============================================================================

describe('ComposioAdapter.listActions', () => {
	it('should list actions and return ActionResult', async () => {
		const mockActions = [
			{
				name: 'SLACK_SEND_MESSAGE',
				display_name: 'Send Message',
				description: 'Send a message to a Slack channel',
				parameters: {
					properties: {
						channel: { name: 'channel', type: 'string' },
						text: { name: 'text', type: 'string' },
					},
					required: ['channel', 'text'],
				},
			},
			{
				name: 'SLACK_LIST_CHANNELS',
				display_name: 'List Channels',
				description: 'List Slack channels',
			},
		];

		mockFetch.mockResolvedValueOnce(mockJsonResponse(mockActions));

		const result = await adapter.listActions({ limit: 10 });

		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(2);
		expect(result.metadata.source.integration).toBe('composio:slack');
		expect(result.metadata.source.action).toBe('list-actions');
		expect(result.metadata.schema).toBe('composio.slack.action-list.v1');
		expect(result.capabilities).toBeDefined();
	});

	it('should pass useCase filter', async () => {
		mockFetch.mockResolvedValueOnce(mockJsonResponse([]));

		await adapter.listActions({ useCase: 'send a message' });

		const fetchUrl = mockFetch.mock.calls[0][0] as string;
		expect(fetchUrl).toContain('useCase=send+a+message');
	});

	it('should handle API errors gracefully', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response('Unauthorized', { status: 401 })
		);

		const result = await adapter.listActions();

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.metadata.source.integration).toBe('composio:slack');
	});
});

// ============================================================================
// ACTION EXECUTION TESTS
// ============================================================================

describe('ComposioAdapter.executeAction', () => {
	it('should execute action and return ActionResult', async () => {
		const mockResult = {
			successfull: true,
			execution_output: {
				ok: true,
				channel: 'C123',
				ts: '1234567890.123456',
				message: { text: 'Hello from WORKWAY' },
			},
		};

		mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResult));

		const result = await adapter.executeAction('SLACK_SEND_MESSAGE', {
			channel: '#general',
			text: 'Hello from WORKWAY',
		});

		expect(result.success).toBe(true);
		expect(result.data).toEqual(mockResult.execution_output);
		expect(result.metadata.source.integration).toBe('composio:slack');
		expect(result.metadata.source.action).toBe('SLACK_SEND_MESSAGE');
		expect(result.metadata.schema).toBe('composio.slack.send-message.v1');
	});

	it('should handle Composio execution failure', async () => {
		const mockResult = {
			successfull: false,
			error: 'Channel not found',
		};

		mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResult));

		const result = await adapter.executeAction('SLACK_SEND_MESSAGE', {
			channel: '#nonexistent',
			text: 'Hello',
		});

		expect(result.success).toBe(false);
		expect(result.error?.message).toBe('Channel not found');
	});

	it('should return error when action name is empty', async () => {
		const result = await adapter.executeAction('', {});

		expect(result.success).toBe(false);
		expect(result.error?.message).toBe('Action name is required');
	});

	it('should include connectedAccountId when configured', async () => {
		const adapterWithAccount = new ComposioAdapter({
			...defaultConfig,
			connectedAccountId: 'acc_123',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({ successfull: true, execution_output: {} })
		);

		await adapterWithAccount.executeAction('SLACK_SEND_MESSAGE', {
			channel: '#general',
			text: 'test',
		});

		// The SDK passes body through fetch — inspect however it arrives
		const fetchCall = mockFetch.mock.calls[0];
		const fetchInit = fetchCall[1] as RequestInit;
		// Body could be string, ReadableStream, or other
		let bodyStr: string;
		if (typeof fetchInit.body === 'string') {
			bodyStr = fetchInit.body;
		} else if (fetchInit.body instanceof ReadableStream) {
			bodyStr = await new Response(fetchInit.body).text();
		} else {
			bodyStr = String(fetchInit.body);
		}
		const requestBody = JSON.parse(bodyStr);
		// Debug: see what the SDK actually sends
		expect(JSON.stringify(requestBody)).toContain('acc_123');
	});

	it('should include entityId when configured', async () => {
		const adapterWithEntity = new ComposioAdapter({
			...defaultConfig,
			entityId: 'entity_456',
		});

		mockFetch.mockResolvedValueOnce(
			mockJsonResponse({ successfull: true, execution_output: {} })
		);

		await adapterWithEntity.executeAction('SLACK_SEND_MESSAGE', {
			channel: '#general',
			text: 'test',
		});

		// Inspect the body in whatever format the SDK sends it
		const fetchCall = mockFetch.mock.calls[0];
		const fetchInit = fetchCall[1] as RequestInit;
		let bodyStr: string;
		if (typeof fetchInit.body === 'string') {
			bodyStr = fetchInit.body;
		} else if (fetchInit.body instanceof ReadableStream) {
			bodyStr = await new Response(fetchInit.body).text();
		} else {
			bodyStr = String(fetchInit.body);
		}
		const requestBody = JSON.parse(bodyStr);
		// Verify entityId is somewhere in the serialized body
		expect(JSON.stringify(requestBody)).toContain('entity_456');
	});

	it('should handle network errors', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Network error'));

		const result = await adapter.executeAction('SLACK_SEND_MESSAGE', {});

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain('Network error');
	});

	it('should handle 429 rate limiting', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response('Rate limited', { status: 429 })
		);

		const result = await adapter.executeAction('SLACK_SEND_MESSAGE', {});

		expect(result.success).toBe(false);
	});
});

// ============================================================================
// APP INFO TESTS
// ============================================================================

describe('ComposioAdapter.getAppInfo', () => {
	it('should return app info as ActionResult', async () => {
		const mockApp = {
			name: 'Slack',
			key: 'slack',
			description: 'Team messaging platform',
			categories: ['communication'],
			auth_schemes: ['oauth2'],
		};

		mockFetch.mockResolvedValueOnce(mockJsonResponse(mockApp));

		const result = await adapter.getAppInfo();

		expect(result.success).toBe(true);
		expect(result.data.name).toBe('Slack');
		expect(result.data.auth_schemes).toContain('oauth2');
		expect(result.metadata.schema).toBe('composio.app-info.v1');
	});
});

// ============================================================================
// CONNECTION CHECK TESTS
// ============================================================================

describe('ComposioAdapter.checkConnection', () => {
	it('should require entityId', async () => {
		// Adapter without entityId
		const result = await adapter.checkConnection();

		expect(result.success).toBe(false);
		expect(result.error?.message).toContain('Entity ID required');
	});

	it('should find active connection', async () => {
		const adapterWithEntity = new ComposioAdapter({
			...defaultConfig,
			entityId: 'user_123',
		});

		const mockAccounts = [
			{ id: 'ca_1', appName: 'slack', status: 'active' },
			{ id: 'ca_2', appName: 'github', status: 'active' },
		];

		mockFetch.mockResolvedValueOnce(mockJsonResponse(mockAccounts));

		const result = await adapterWithEntity.checkConnection();

		expect(result.success).toBe(true);
		expect(result.data.connected).toBe(true);
		expect(result.data.accountId).toBe('ca_1');
	});

	it('should report no connection when none exists', async () => {
		const adapterWithEntity = new ComposioAdapter({
			...defaultConfig,
			entityId: 'user_123',
		});

		mockFetch.mockResolvedValueOnce(mockJsonResponse([]));

		const result = await adapterWithEntity.checkConnection();

		expect(result.success).toBe(true);
		expect(result.data.connected).toBe(false);
		expect(result.data.accountId).toBeUndefined();
	});
});

// ============================================================================
// OAUTH INITIATION TESTS
// ============================================================================

describe('ComposioAdapter.initiateConnection', () => {
	it('should return redirect URL', async () => {
		const mockResponse = {
			redirectUrl: 'https://slack.com/oauth/v2/authorize?...',
			connectedAccountId: 'ca_new_123',
		};

		mockFetch.mockResolvedValueOnce(mockJsonResponse(mockResponse));

		const result = await adapter.initiateConnection({
			entityId: 'user_123',
			redirectUrl: 'https://workway.co/oauth/callback',
		});

		expect(result.success).toBe(true);
		expect(result.data.redirectUrl).toContain('slack.com/oauth');
		expect(result.data.connectionId).toBe('ca_new_123');
	});
});

// ============================================================================
// ACTIONRESULT CONTRACT TESTS
// ============================================================================

describe('ActionResult contract compliance', () => {
	it('should always include metadata.source', async () => {
		mockFetch.mockResolvedValueOnce(mockJsonResponse([]));

		const result = await adapter.listActions();

		expect(result.metadata).toBeDefined();
		expect(result.metadata.source).toBeDefined();
		expect(result.metadata.source.integration).toBe('composio:slack');
		expect(result.metadata.source.action).toBe('list-actions');
	});

	it('should always include metadata.schema', async () => {
		mockFetch.mockResolvedValueOnce(mockJsonResponse([]));

		const result = await adapter.listActions();

		expect(result.metadata.schema).toMatch(/^composio\./);
	});

	it('should always include metadata.timestamp', async () => {
		mockFetch.mockResolvedValueOnce(mockJsonResponse([]));

		const result = await adapter.listActions();

		expect(result.metadata.timestamp).toBeDefined();
		expect(typeof result.metadata.timestamp).toBe('number');
	});

	it('should always include capabilities', async () => {
		mockFetch.mockResolvedValueOnce(mockJsonResponse([]));

		const result = await adapter.listActions();

		expect(result.capabilities).toBeDefined();
		expect(result.capabilities.canHandleText).toBe(true);
		expect(result.capabilities.canHandleRichText).toBe(false);
	});

	it('error results should include error object', async () => {
		mockFetch.mockResolvedValueOnce(
			new Response('Server error', { status: 500 })
		);

		const result = await adapter.listActions();

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.error?.message).toBeDefined();
		expect(result.error?.code).toBeDefined();
	});
});
