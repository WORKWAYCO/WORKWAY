/**
 * OAuth Connect Command
 *
 * Connect an OAuth account for testing workflows
 */

import crypto from 'crypto';
import chalk from 'chalk';
import { Logger } from '../../utils/logger.js';
import { loadConfig, setOAuthToken } from '../../lib/config.js';
import { createAPIClient, APIError, type OAuthProvider } from '../../lib/api-client.js';
import { startOAuthFlow } from '../../lib/oauth-flow.js';

export async function oauthConnectCommand(provider?: string): Promise<void> {
	try {
		// Load config
		const config = await loadConfig();
		const apiClient = createAPIClient(config.apiUrl, config.credentials?.token);

		// Fetch available providers from API
		let availableProviders: OAuthProvider[] = [];
		try {
			availableProviders = await apiClient.listOAuthProviders();
		} catch (error) {
			// Fallback to basic list if API unavailable
			availableProviders = [
				// Google
				{ id: 'google-sheets', name: 'Google Sheets', category: 'google', configured: false, scope: '' },
				{ id: 'google-calendar', name: 'Google Calendar', category: 'google', configured: false, scope: '' },
				{ id: 'google-drive', name: 'Google Drive', category: 'google', configured: false, scope: '' },
				// Communication
				{ id: 'slack', name: 'Slack', category: 'communication', configured: false, scope: '' },
				{ id: 'discord', name: 'Discord', category: 'communication', configured: false, scope: '' },
				// Productivity
				{ id: 'notion', name: 'Notion', category: 'productivity', configured: false, scope: '' },
				{ id: 'linear', name: 'Linear', category: 'productivity', configured: false, scope: '' },
				{ id: 'airtable', name: 'Airtable', category: 'productivity', configured: false, scope: '' },
				{ id: 'todoist', name: 'Todoist', category: 'productivity', configured: false, scope: '' },
				// Meetings & Scheduling
				{ id: 'zoom', name: 'Zoom', category: 'meetings', configured: false, scope: '' },
				{ id: 'calendly', name: 'Calendly', category: 'meetings', configured: false, scope: '' },
				// Developer
				{ id: 'github', name: 'GitHub', category: 'developer', configured: false, scope: '' },
				// CRM & Sales
				{ id: 'hubspot', name: 'HubSpot', category: 'crm', configured: false, scope: '' },
				// Forms
				{ id: 'typeform', name: 'Typeform', category: 'forms', configured: false, scope: '' },
				// Design
				{ id: 'dribbble', name: 'Dribbble', category: 'design', configured: false, scope: '' },
				// Payments
				{ id: 'stripe', name: 'Stripe', category: 'payments', configured: false, scope: '' },
				// Construction
				{ id: 'procore', name: 'Procore', category: 'construction', configured: false, scope: '' },
			];
		}

		// Check if provider specified
		if (!provider) {
			Logger.header('Available OAuth Providers');
			Logger.blank();

			// Group by category
			const byCategory: Record<string, OAuthProvider[]> = {};
			for (const p of availableProviders) {
				if (!byCategory[p.category]) byCategory[p.category] = [];
				byCategory[p.category].push(p);
			}

			for (const [category, providers] of Object.entries(byCategory)) {
				Logger.section(category.charAt(0).toUpperCase() + category.slice(1));
				for (const p of providers) {
					const status = p.configured ? chalk.green('(ready)') : chalk.dim('(needs setup)');
					Logger.listItem(`${p.id} ${status}`);
				}
				Logger.blank();
			}

			Logger.log('Usage: workway oauth connect <provider>');
			Logger.log('');
			Logger.log('Example:');
			Logger.code('workway oauth connect gmail');
			process.exit(0);
		}

		// Validate provider
		const providerConfig = availableProviders.find(p => p.id === provider.toLowerCase());
		if (!providerConfig) {
			Logger.error(`Unknown provider: ${provider}`);
			Logger.log('');
			Logger.log('Run `workway oauth connect` to see available providers');
			process.exit(1);
		}

		if (!providerConfig.configured) {
			Logger.warn(`Provider '${provider}' is not configured on this WORKWAY instance.`);
			Logger.log('');
			Logger.log('Contact your administrator to configure OAuth credentials for this provider.');
			process.exit(1);
		}

		Logger.header(`Connect ${provider.toUpperCase()} Account`);

		const callbackPort = config.oauth?.callbackPort || 3456;
		const callbackUrl = `http://localhost:${callbackPort}/callback`;

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

			spinner.succeed(`${provider} connected`);
			Logger.blank();

			// Display connection info
			Logger.section('Connection');
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
			Logger.log('Test with live OAuth: workway workflow test --live');
		} catch (error: any) {
			spinner.fail('Connection failed');
			Logger.blank();

			if (error instanceof APIError) {
				Logger.error(error.message);

				if (error.isUnauthorized()) {
					Logger.log('');
					Logger.log('Run `workway login` first');
				}
			} else {
				Logger.error(error.message);

				// Common error hints
				if (error.message.includes('EADDRINUSE')) {
					Logger.log('');
					Logger.log(`Port ${callbackPort} in use. Close other apps or wait and retry.`);
				} else if (error.message.includes('timeout')) {
					Logger.log('');
					Logger.log('Authorization timed out. Complete auth in browser and retry.');
				}
			}

			process.exit(1);
		}
	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}
