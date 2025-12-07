/**
 * Developer OAuth Apps Command (BYOO - Bring Your Own OAuth)
 *
 * Manage your own OAuth credentials for integrations.
 * Heideggerian: CLI is more "ready-to-hand" than web UI for developers.
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { createAuthenticatedClient } from '../../utils/auth-client.js';
import type { DeveloperOAuthApp } from '../../lib/api-client.js';

// Supported OAuth providers for BYOO
const SUPPORTED_PROVIDERS = [
	{ name: 'Zoom', value: 'zoom', docUrl: 'https://developers.zoom.us/docs/integrations/create/' },
	{ name: 'Notion', value: 'notion', docUrl: 'https://developers.notion.com/docs/create-a-notion-integration' },
	{ name: 'Slack', value: 'slack', docUrl: 'https://api.slack.com/apps' },
	{ name: 'Airtable', value: 'airtable', docUrl: 'https://airtable.com/create/oauth' },
	{ name: 'Typeform', value: 'typeform', docUrl: 'https://developer.typeform.com/get-started/' },
	{ name: 'Calendly', value: 'calendly', docUrl: 'https://developer.calendly.com/' },
	{ name: 'Todoist', value: 'todoist', docUrl: 'https://developer.todoist.com/appconsole.html' },
	{ name: 'Linear', value: 'linear', docUrl: 'https://linear.app/settings/api' },
	{ name: 'Google Calendar', value: 'google-calendar', docUrl: 'https://console.cloud.google.com/' },
	{ name: 'Google Drive', value: 'google-drive', docUrl: 'https://console.cloud.google.com/' },
	{ name: 'Stripe', value: 'stripe', docUrl: 'https://dashboard.stripe.com/apikeys' },
];

interface OAuthOptions {
	provider?: string;
	force?: boolean;
}

/**
 * List OAuth apps command
 */
export async function developerOAuthListCommand(): Promise<void> {
	try {
		Logger.header('OAuth Apps');

		const { apiClient: client } = await createAuthenticatedClient({
			errorMessage: 'Not logged in',
			hint: 'Login with: workway login',
		});

		const spinner = Logger.spinner('Loading OAuth apps...');

		try {
			const apps = await client.listOAuthApps();

			spinner.succeed('OAuth apps loaded');
			Logger.blank();

			if (apps.length === 0) {
				Logger.log('No OAuth apps configured yet.');
				Logger.blank();
				Logger.log('Add your own OAuth credentials to use your app branding and API quotas.');
				Logger.log('');
				Logger.log('Add an app: workway developer oauth add');
				return;
			}

			// Display apps
			for (const app of apps) {
				displayOAuthApp(app);
			}

			Logger.blank();
			Logger.log('Commands:');
			Logger.log('  workway developer oauth add     - Add new OAuth app');
			Logger.log('  workway developer oauth test    - Test app credentials');
			Logger.log('  workway developer oauth remove  - Remove an OAuth app');

		} catch (error: any) {
			spinner.fail('Failed to load OAuth apps');
			Logger.error(error.message);
			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Add OAuth app command
 */
export async function developerOAuthAddCommand(options: OAuthOptions): Promise<void> {
	try {
		Logger.header('Add OAuth App');

		const { apiClient: client } = await createAuthenticatedClient({
			errorMessage: 'Not logged in',
			hint: 'Login with: workway login',
		});

		// Check existing apps
		const spinner = Logger.spinner('Checking existing apps...');
		let existingApps: DeveloperOAuthApp[] = [];
		try {
			existingApps = await client.listOAuthApps();
			spinner.succeed('Ready');
		} catch (error: any) {
			spinner.fail('Failed to check existing apps');
			Logger.error(error.message);
			process.exit(1);
		}

		const existingProviders = existingApps.map(app => app.provider);

		// Filter available providers (exclude already configured)
		const availableProviders = SUPPORTED_PROVIDERS.filter(
			p => !existingProviders.includes(p.value)
		);

		if (availableProviders.length === 0) {
			Logger.log('All supported providers already configured!');
			Logger.log('');
			Logger.log('Remove an app to reconfigure: workway developer oauth remove');
			return;
		}

		let selectedProvider: string = options.provider || '';

		// If no provider specified, prompt for selection
		if (!selectedProvider) {
			const { provider } = await inquirer.prompt([
				{
					type: 'list',
					name: 'provider',
					message: 'Select OAuth provider:',
					choices: availableProviders.map(p => ({
						name: p.name,
						value: p.value,
					})),
				},
			]);
			selectedProvider = provider;
		}

		// Validate provider
		const providerInfo = SUPPORTED_PROVIDERS.find(p => p.value === selectedProvider);
		if (!providerInfo) {
			Logger.error(`Unknown provider: ${selectedProvider}`);
			Logger.log('');
			Logger.log('Supported providers:');
			SUPPORTED_PROVIDERS.forEach(p => Logger.log(`  - ${p.value}`));
			process.exit(1);
		}

		// Check if already exists
		if (existingProviders.includes(selectedProvider) && !options.force) {
			Logger.error(`OAuth app for ${providerInfo.name} already exists.`);
			Logger.log('');
			Logger.log('To update, first remove the existing app:');
			Logger.log(`  workway developer oauth remove ${selectedProvider}`);
			process.exit(1);
		}

		Logger.blank();
		Logger.log(`Creating ${providerInfo.name} OAuth app`);
		Logger.log('');
		Logger.log(`Documentation: ${providerInfo.docUrl}`);
		Logger.blank();

		// Prompt for credentials
		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'clientId',
				message: 'Client ID:',
				validate: (input: string) => {
					if (!input.trim()) return 'Client ID is required';
					return true;
				},
			},
			{
				type: 'password',
				name: 'clientSecret',
				message: 'Client Secret:',
				mask: '*',
				validate: (input: string) => {
					if (!input.trim()) return 'Client Secret is required';
					return true;
				},
			},
			{
				type: 'input',
				name: 'redirectUri',
				message: 'Redirect URI (optional, press Enter to use default):',
				default: '',
			},
			{
				type: 'confirm',
				name: 'confirm',
				message: 'Create OAuth app?',
				default: true,
			},
		]);

		if (!answers.confirm) {
			Logger.log('Cancelled.');
			return;
		}

		const createSpinner = Logger.spinner(`Creating ${providerInfo.name} OAuth app...`);

		try {
			const app = await client.createOAuthApp({
				provider: selectedProvider,
				clientId: answers.clientId.trim(),
				clientSecret: answers.clientSecret.trim(),
				redirectUri: answers.redirectUri.trim() || undefined,
			});

			createSpinner.succeed(`${providerInfo.name} OAuth app created!`);
			Logger.blank();
			displayOAuthApp(app);
			Logger.blank();
			Logger.log('Test your credentials: workway developer oauth test ' + selectedProvider);

		} catch (error: any) {
			createSpinner.fail('Failed to create OAuth app');
			Logger.error(error.message);
			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Remove OAuth app command
 */
export async function developerOAuthRemoveCommand(options: OAuthOptions): Promise<void> {
	try {
		Logger.header('Remove OAuth App');

		const { apiClient: client } = await createAuthenticatedClient({
			errorMessage: 'Not logged in',
			hint: 'Login with: workway login',
		});

		// Get existing apps
		const spinner = Logger.spinner('Loading OAuth apps...');
		let apps: DeveloperOAuthApp[] = [];
		try {
			apps = await client.listOAuthApps();
			spinner.succeed('Apps loaded');
		} catch (error: any) {
			spinner.fail('Failed to load apps');
			Logger.error(error.message);
			process.exit(1);
		}

		if (apps.length === 0) {
			Logger.log('No OAuth apps configured.');
			return;
		}

		let selectedProvider: string = options.provider || '';

		// If no provider specified, prompt for selection
		if (!selectedProvider) {
			const { provider } = await inquirer.prompt([
				{
					type: 'list',
					name: 'provider',
					message: 'Select OAuth app to remove:',
					choices: apps.map(app => ({
						name: `${getProviderName(app.provider)} (${app.status})`,
						value: app.provider,
					})),
				},
			]);
			selectedProvider = provider;
		}

		// Validate provider exists
		const app = apps.find(a => a.provider === selectedProvider);
		if (!app) {
			Logger.error(`No OAuth app found for: ${selectedProvider}`);
			process.exit(1);
		}

		// Confirm deletion
		if (!options.force) {
			const { confirm } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'confirm',
					message: `Remove ${getProviderName(app.provider)} OAuth app? This cannot be undone.`,
					default: false,
				},
			]);

			if (!confirm) {
				Logger.log('Cancelled.');
				return;
			}
		}

		const deleteSpinner = Logger.spinner(`Removing ${getProviderName(app.provider)} OAuth app...`);

		try {
			await client.deleteOAuthApp(selectedProvider);
			deleteSpinner.succeed(`${getProviderName(app.provider)} OAuth app removed.`);
			Logger.blank();
			Logger.log('Your workflows will now use WORKWAY system credentials for this provider.');

		} catch (error: any) {
			deleteSpinner.fail('Failed to remove OAuth app');
			Logger.error(error.message);
			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Test OAuth app credentials command
 */
export async function developerOAuthTestCommand(options: OAuthOptions): Promise<void> {
	try {
		Logger.header('Test OAuth App');

		const { apiClient: client } = await createAuthenticatedClient({
			errorMessage: 'Not logged in',
			hint: 'Login with: workway login',
		});

		// Get existing apps
		const spinner = Logger.spinner('Loading OAuth apps...');
		let apps: DeveloperOAuthApp[] = [];
		try {
			apps = await client.listOAuthApps();
			spinner.succeed('Apps loaded');
		} catch (error: any) {
			spinner.fail('Failed to load apps');
			Logger.error(error.message);
			process.exit(1);
		}

		if (apps.length === 0) {
			Logger.log('No OAuth apps configured.');
			Logger.log('');
			Logger.log('Add an app first: workway developer oauth add');
			return;
		}

		let selectedProvider: string = options.provider || '';

		// If no provider specified, prompt for selection
		if (!selectedProvider) {
			const { provider } = await inquirer.prompt([
				{
					type: 'list',
					name: 'provider',
					message: 'Select OAuth app to test:',
					choices: apps.map(app => ({
						name: `${getProviderName(app.provider)} (${app.status})`,
						value: app.provider,
					})),
				},
			]);
			selectedProvider = provider;
		}

		// Validate provider exists
		const app = apps.find(a => a.provider === selectedProvider);
		if (!app) {
			Logger.error(`No OAuth app found for: ${selectedProvider}`);
			process.exit(1);
		}

		const testSpinner = Logger.spinner(`Testing ${getProviderName(app.provider)} credentials...`);

		try {
			const result = await client.testOAuthApp(selectedProvider);

			if (result.success) {
				testSpinner.succeed(`${getProviderName(app.provider)} credentials are valid!`);
				Logger.blank();
				Logger.log(`Latency: ${result.latencyMs}ms`);
				if (result.scopes && result.scopes.length > 0) {
					Logger.log(`Scopes: ${result.scopes.join(', ')}`);
				}

				// Suggest promotion if in development
				if (app.status === 'development') {
					Logger.blank();
					Logger.log('Ready to promote to production?');
					Logger.log(`  workway developer oauth promote ${selectedProvider}`);
				}
			} else {
				testSpinner.fail('Credentials test failed');
				Logger.error(result.error || 'Unknown error');
			}

		} catch (error: any) {
			testSpinner.fail('Failed to test credentials');
			Logger.error(error.message);
			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Promote OAuth app to production command
 */
export async function developerOAuthPromoteCommand(options: OAuthOptions): Promise<void> {
	try {
		Logger.header('Promote OAuth App');

		const { apiClient: client } = await createAuthenticatedClient({
			errorMessage: 'Not logged in',
			hint: 'Login with: workway login',
		});

		// Get existing apps
		const spinner = Logger.spinner('Loading OAuth apps...');
		let apps: DeveloperOAuthApp[] = [];
		try {
			apps = await client.listOAuthApps();
			spinner.succeed('Apps loaded');
		} catch (error: any) {
			spinner.fail('Failed to load apps');
			Logger.error(error.message);
			process.exit(1);
		}

		// Filter to development apps only
		const devApps = apps.filter(a => a.status === 'development');

		if (devApps.length === 0) {
			Logger.log('No OAuth apps in development status.');
			Logger.log('');
			if (apps.length > 0) {
				Logger.log('Existing apps:');
				apps.forEach(app => {
					Logger.log(`  ${getProviderName(app.provider)}: ${app.status}`);
				});
			}
			return;
		}

		let selectedProvider: string = options.provider || '';

		// If no provider specified, prompt for selection
		if (!selectedProvider) {
			const { provider } = await inquirer.prompt([
				{
					type: 'list',
					name: 'provider',
					message: 'Select OAuth app to promote:',
					choices: devApps.map(app => ({
						name: getProviderName(app.provider),
						value: app.provider,
					})),
				},
			]);
			selectedProvider = provider;
		}

		// Validate provider exists in development
		const app = devApps.find(a => a.provider === selectedProvider);
		if (!app) {
			const existingApp = apps.find(a => a.provider === selectedProvider);
			if (existingApp) {
				Logger.error(`OAuth app for ${getProviderName(selectedProvider)} is already ${existingApp.status}`);
			} else {
				Logger.error(`No OAuth app found for: ${selectedProvider}`);
			}
			process.exit(1);
		}

		Logger.blank();
		Logger.log('Promoting to production means:');
		Logger.log('  - Your credentials will be used for all your workflow users');
		Logger.log('  - API usage will count against your OAuth app quotas');
		Logger.log('  - Your app branding will appear in OAuth consent screens');
		Logger.blank();

		const { confirm } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'confirm',
				message: `Promote ${getProviderName(app.provider)} to production?`,
				default: true,
			},
		]);

		if (!confirm) {
			Logger.log('Cancelled.');
			return;
		}

		const promoteSpinner = Logger.spinner(`Promoting ${getProviderName(app.provider)} to production...`);

		try {
			const updatedApp = await client.promoteOAuthApp(selectedProvider);
			promoteSpinner.succeed(`${getProviderName(app.provider)} promoted to production!`);
			Logger.blank();
			displayOAuthApp(updatedApp);

		} catch (error: any) {
			promoteSpinner.fail('Failed to promote OAuth app');
			Logger.error(error.message);
			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Display an OAuth app
 */
function displayOAuthApp(app: DeveloperOAuthApp): void {
	const statusIcon = getStatusIcon(app.status);
	const healthIcon = getHealthIcon(app.healthStatus);

	Logger.section(`${getProviderName(app.provider)}`);
	Logger.listItem(`Status: ${statusIcon} ${app.status}`);
	Logger.listItem(`Health: ${healthIcon} ${app.healthStatus}`);
	Logger.listItem(`Client ID: ${app.clientId.substring(0, 8)}...`);
	Logger.listItem(`Secret: ${app.clientSecretMasked}`);
	if (app.scopes.length > 0) {
		Logger.listItem(`Scopes: ${app.scopes.join(', ')}`);
	}
	if (app.lastHealthCheck) {
		Logger.listItem(`Last Check: ${new Date(app.lastHealthCheck).toLocaleString()}`);
	}
}

/**
 * Get display name for provider
 */
function getProviderName(provider: string): string {
	const providerInfo = SUPPORTED_PROVIDERS.find(p => p.value === provider);
	return providerInfo?.name || provider;
}

/**
 * Get status icon
 */
function getStatusIcon(status: string): string {
	switch (status) {
		case 'production':
			return '🟢';
		case 'development':
			return '🟡';
		case 'pending_review':
			return '🔵';
		case 'suspended':
			return '🔴';
		default:
			return '⚪';
	}
}

/**
 * Get health icon
 */
function getHealthIcon(health: string): string {
	switch (health) {
		case 'healthy':
			return '✓';
		case 'unhealthy':
			return '✗';
		default:
			return '?';
	}
}
