/**
 * OAuth Connect Command
 *
 * Connect an OAuth account for testing workflows
 */

import crypto from 'crypto';
import { Logger } from '../../utils/logger.js';
import { loadConfig, setOAuthToken } from '../../lib/config.js';
import { createAPIClient, APIError } from '../../lib/api-client.js';
import { startOAuthFlow } from '../../lib/oauth-flow.js';

const SUPPORTED_PROVIDERS = ['gmail', 'slack', 'notion', 'stripe', 'salesforce'];

export async function oauthConnectCommand(provider?: string): Promise<void> {
	try {
		// Check if provider specified
		if (!provider) {
			Logger.error('Provider is required');
			Logger.log('');
			Logger.log('Usage: workway oauth connect <provider>');
			Logger.log('');
			Logger.log('Supported providers:');
			SUPPORTED_PROVIDERS.forEach((p) => Logger.listItem(p));
			process.exit(1);
		}

		// Validate provider
		if (!SUPPORTED_PROVIDERS.includes(provider.toLowerCase())) {
			Logger.error(`Unsupported provider: ${provider}`);
			Logger.log('');
			Logger.log('Supported providers:');
			SUPPORTED_PROVIDERS.forEach((p) => Logger.listItem(p));
			process.exit(1);
		}

		Logger.header(`Connect ${provider.toUpperCase()} Account`);

		// Load config
		const config = await loadConfig();
		const callbackPort = config.oauth?.callbackPort || 3456;
		const callbackUrl = `http://localhost:${callbackPort}/callback`;

		// Create API client
		const apiClient = createAPIClient(config.apiUrl, config.credentials?.token);

		// Generate state for CSRF protection
		const state = crypto.randomBytes(16).toString('hex');

		// Get OAuth authorization URL
		const authUrl = apiClient.getOAuthAuthUrl(provider, callbackUrl, state);

		Logger.section('OAuth Flow');
		Logger.listItem(`Provider: ${provider}`);
		Logger.listItem(`Callback: ${callbackUrl}`);
		Logger.blank();

		// Start local server and open browser
		const spinner = Logger.spinner('Waiting for authorization...');

		try {
			// Start OAuth flow
			const result = await startOAuthFlow({
				provider,
				authUrl,
				callbackPort,
				state,
			});

			spinner.text = 'Exchanging authorization code...';

			// Exchange code for tokens
			const tokens = await apiClient.exchangeOAuthCode(provider, result.code, callbackUrl);

			// Save tokens locally
			await setOAuthToken(provider, {
				...tokens,
				connectedAt: Date.now(),
			});

			spinner.succeed('OAuth connection successful!');
			Logger.blank();

			// Display connection info
			Logger.section('Connection Details');
			Logger.listItem(`Provider: ${provider}`);

			if (tokens.email) {
				Logger.listItem(`Account: ${tokens.email}`);
			}

			if (tokens.scope) {
				Logger.listItem(`Scopes: ${tokens.scope}`);
			}

			if (tokens.expiresAt) {
				const expiresDate = new Date(tokens.expiresAt);
				Logger.listItem(`Expires: ${expiresDate.toLocaleString()}`);
			}

			Logger.blank();
			Logger.success(`${provider} account connected successfully!`);
			Logger.blank();
			Logger.log('💡 You can now use --live mode for workflow testing');
			Logger.code('workway workflow test --live');
		} catch (error: any) {
			spinner.fail('OAuth connection failed');
			Logger.blank();

			if (error instanceof APIError) {
				Logger.error(error.message);

				if (error.isUnauthorized()) {
					Logger.log('');
					Logger.log('💡 Please log in first:');
					Logger.code('workway login');
				}
			} else {
				Logger.error(error.message);

				// Common error hints
				if (error.message.includes('EADDRINUSE')) {
					Logger.log('');
					Logger.log('💡 Port is already in use. Try:');
					Logger.log('  1. Close other applications using port ' + callbackPort);
					Logger.log('  2. Wait a moment and try again');
				} else if (error.message.includes('timeout')) {
					Logger.log('');
					Logger.log('💡 Authorization timed out. Please:');
					Logger.log('  1. Complete the authorization in your browser');
					Logger.log('  2. Ensure the callback URL is correct');
				}
			}

			process.exit(1);
		}
	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}
