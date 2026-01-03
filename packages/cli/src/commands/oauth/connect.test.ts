/**
 * Tests for oauth/connect.ts - OAuth flow for connecting accounts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { oauthConnectCommand } from './connect.js';

// Mock dependencies
vi.mock('../../utils/logger.js', () => ({
	Logger: {
		header: vi.fn(),
		section: vi.fn(),
		listItem: vi.fn(),
		blank: vi.fn(),
		log: vi.fn(),
		code: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		spinner: vi.fn(() => ({
			succeed: vi.fn(),
			fail: vi.fn(),
			text: '',
		})),
	},
}));
vi.mock('../../lib/config.js');
vi.mock('../../lib/api-client.js');
vi.mock('../../lib/oauth-flow.js');

describe('oauth/connect.ts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Provider Listing', () => {
		it('should list available providers when no provider specified', async () => {
			const { loadConfig } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{
						id: 'gmail',
						name: 'Gmail',
						category: 'google',
						configured: true,
						scope: '',
					},
					{
						id: 'slack',
						name: 'Slack',
						category: 'communication',
						configured: true,
						scope: '',
					},
				]),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);

			await oauthConnectCommand();

			expect(mockApiClient.listOAuthProviders).toHaveBeenCalled();
			expect(process.exit).toHaveBeenCalledWith(0);
		});

		it('should use fallback providers list when API is unavailable', async () => {
			const { loadConfig } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockRejectedValue(new Error('API Error')),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);

			await oauthConnectCommand();

			expect(process.exit).toHaveBeenCalledWith(0);
		});

		it('should group providers by category', async () => {
			const { loadConfig } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'google-sheets', name: 'Google Sheets', category: 'google', configured: true, scope: '' },
					{ id: 'slack', name: 'Slack', category: 'communication', configured: true, scope: '' },
					{ id: 'google-calendar', name: 'Google Calendar', category: 'google', configured: true, scope: '' },
				]),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);

			await oauthConnectCommand();

			expect(process.exit).toHaveBeenCalledWith(0);
		});
	});

	describe('Provider Validation', () => {
		it('should error when unknown provider is specified', async () => {
			const { loadConfig } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'gmail', name: 'Gmail', category: 'google', configured: true, scope: '' },
				]),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);

			await oauthConnectCommand('unknown-provider');

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should error when provider is not configured', async () => {
			const { loadConfig } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{
						id: 'gmail',
						name: 'Gmail',
						category: 'google',
						configured: false,
						scope: '',
					},
				]),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);

			await oauthConnectCommand('gmail');

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should accept valid configured provider', async () => {
			const { loadConfig, setOAuthToken } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{
						id: 'gmail',
						name: 'Gmail',
						category: 'google',
						configured: true,
						scope: 'email',
					},
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
				exchangeOAuthCode: vi.fn().mockResolvedValue({
					access_token: 'token123',
					refresh_token: 'refresh123',
					email: 'user@example.com',
					scope: 'email',
					expiresAt: Date.now() + 3600000,
				}),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);
			vi.mocked(startOAuthFlow).mockResolvedValue({
				code: 'auth-code-123',
			});
			vi.mocked(setOAuthToken).mockResolvedValue(undefined);

			await oauthConnectCommand('gmail');

			expect(mockApiClient.getOAuthAuthUrl).toHaveBeenCalled();
			expect(startOAuthFlow).toHaveBeenCalled();
		});
	});

	describe('OAuth Flow', () => {
		it('should generate state for CSRF protection', async () => {
			const { loadConfig, setOAuthToken } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'gmail', name: 'Gmail', category: 'google', configured: true, scope: '' },
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
				exchangeOAuthCode: vi.fn().mockResolvedValue({
					access_token: 'token123',
				}),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);
			vi.mocked(startOAuthFlow).mockResolvedValue({ code: 'code123' });
			vi.mocked(setOAuthToken).mockResolvedValue(undefined);

			// Spy on crypto.randomBytes to verify state generation
			const randomBytesSpy = vi.spyOn(crypto, 'randomBytes');

			await oauthConnectCommand('gmail');

			expect(randomBytesSpy).toHaveBeenCalledWith(16);
		});

		it('should use correct callback URL', async () => {
			const { loadConfig, setOAuthToken } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'slack', name: 'Slack', category: 'communication', configured: true, scope: '' },
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
				exchangeOAuthCode: vi.fn().mockResolvedValue({
					access_token: 'token123',
				}),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);
			vi.mocked(startOAuthFlow).mockResolvedValue({ code: 'code123' });
			vi.mocked(setOAuthToken).mockResolvedValue(undefined);

			await oauthConnectCommand('slack');

			expect(mockApiClient.getOAuthAuthUrl).toHaveBeenCalledWith(
				'slack',
				'http://localhost:3456/callback',
				expect.any(String)
			);
		});

		it('should exchange authorization code for tokens', async () => {
			const { loadConfig, setOAuthToken } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'github', name: 'GitHub', category: 'developer', configured: true, scope: '' },
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
				exchangeOAuthCode: vi.fn().mockResolvedValue({
					access_token: 'ghp_token123',
					refresh_token: 'refresh123',
					scope: 'repo user',
				}),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);
			vi.mocked(startOAuthFlow).mockResolvedValue({ code: 'auth-code-456' });
			vi.mocked(setOAuthToken).mockResolvedValue(undefined);

			await oauthConnectCommand('github');

			expect(mockApiClient.exchangeOAuthCode).toHaveBeenCalledWith(
				'github',
				'auth-code-456',
				'http://localhost:3456/callback'
			);
		});

		it('should save tokens locally with connectedAt timestamp', async () => {
			const { loadConfig, setOAuthToken } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockTokens = {
				access_token: 'token123',
				refresh_token: 'refresh123',
				email: 'user@example.com',
				scope: 'email',
				expiresAt: Date.now() + 3600000,
			};

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'notion', name: 'Notion', category: 'productivity', configured: true, scope: '' },
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
				exchangeOAuthCode: vi.fn().mockResolvedValue(mockTokens),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);
			vi.mocked(startOAuthFlow).mockResolvedValue({ code: 'code789' });
			vi.mocked(setOAuthToken).mockResolvedValue(undefined);

			await oauthConnectCommand('notion');

			expect(setOAuthToken).toHaveBeenCalledWith(
				'notion',
				expect.objectContaining({
					...mockTokens,
					connectedAt: expect.any(Number),
				})
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle OAuth flow errors', async () => {
			const { loadConfig } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'zoom', name: 'Zoom', category: 'meetings', configured: true, scope: '' },
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);
			vi.mocked(startOAuthFlow).mockRejectedValue(new Error('User cancelled'));

			await oauthConnectCommand('zoom');

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should handle API errors during token exchange', async () => {
			const { loadConfig } = await import('../../lib/config.js');
			const { createAPIClient, APIError } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const apiError = new Error('Unauthorized') as any;
			apiError.isUnauthorized = () => true;

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'linear', name: 'Linear', category: 'productivity', configured: true, scope: '' },
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
				exchangeOAuthCode: vi.fn().mockRejectedValue(apiError),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);
			vi.mocked(startOAuthFlow).mockResolvedValue({ code: 'code123' });

			await oauthConnectCommand('linear');

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should handle port already in use error', async () => {
			const { loadConfig } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'hubspot', name: 'HubSpot', category: 'crm', configured: true, scope: '' },
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);

			const portError = new Error('EADDRINUSE: Port is already in use');
			vi.mocked(startOAuthFlow).mockRejectedValue(portError);

			await oauthConnectCommand('hubspot');

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should handle timeout errors', async () => {
			const { loadConfig } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'stripe', name: 'Stripe', category: 'payments', configured: true, scope: '' },
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);

			const timeoutError = new Error('Authorization timeout');
			vi.mocked(startOAuthFlow).mockRejectedValue(timeoutError);

			await oauthConnectCommand('stripe');

			expect(process.exit).toHaveBeenCalledWith(1);
		});
	});

	describe('Connection Display', () => {
		it('should display connection details after successful connection', async () => {
			const { loadConfig, setOAuthToken } = await import('../../lib/config.js');
			const { createAPIClient } = await import('../../lib/api-client.js');
			const { startOAuthFlow } = await import('../../lib/oauth-flow.js');

			vi.mocked(loadConfig).mockResolvedValue({
				apiUrl: 'https://api.workway.co',
				oauth: { callbackPort: 3456 },
				editor: 'code',
			});

			const mockTokens = {
				access_token: 'token123',
				refresh_token: 'refresh123',
				email: 'user@gmail.com',
				scope: 'email calendar',
				expiresAt: Date.now() + 3600000,
			};

			const mockApiClient = {
				listOAuthProviders: vi.fn().mockResolvedValue([
					{ id: 'gmail', name: 'Gmail', category: 'google', configured: true, scope: '' },
				]),
				getOAuthAuthUrl: vi.fn().mockReturnValue('https://auth.example.com'),
				exchangeOAuthCode: vi.fn().mockResolvedValue(mockTokens),
			};

			vi.mocked(createAPIClient).mockReturnValue(mockApiClient as any);
			vi.mocked(startOAuthFlow).mockResolvedValue({ code: 'code123' });
			vi.mocked(setOAuthToken).mockResolvedValue(undefined);

			await oauthConnectCommand('gmail');

			// Verify success (not exit with error)
			expect(process.exit).not.toHaveBeenCalledWith(1);
		});
	});
});
