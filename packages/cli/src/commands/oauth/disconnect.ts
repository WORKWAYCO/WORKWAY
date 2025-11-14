/**
 * OAuth Disconnect Command
 *
 * Disconnect an OAuth account
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { loadOAuthTokens, removeOAuthToken } from '../../lib/config.js';

export async function oauthDisconnectCommand(provider?: string): Promise<void> {
	try {
		// Load current connections
		const tokens = await loadOAuthTokens();
		const providers = Object.keys(tokens);

		if (providers.length === 0) {
			Logger.warn('No OAuth accounts connected');
			Logger.blank();
			Logger.log('💡 Connect an account with:');
			Logger.code('workway oauth connect <provider>');
			return;
		}

		// If no provider specified, prompt to choose
		if (!provider) {
			const answer = await inquirer.prompt([
				{
					type: 'list',
					name: 'provider',
					message: 'Which account do you want to disconnect?',
					choices: providers,
				},
			]);

			provider = answer.provider;
		}

		// TypeScript check - provider should be defined now
		if (!provider) {
			Logger.error('Provider not specified');
			process.exit(1);
		}

		// Check if provider is connected
		if (!tokens[provider]) {
			Logger.error(`No ${provider} account connected`);
			Logger.blank();
			Logger.log('Connected accounts:');
			providers.forEach((p) => Logger.listItem(p));
			process.exit(1);
		}

		Logger.header(`Disconnect ${provider.toUpperCase()}`);

		// Show current connection info
		const token = tokens[provider];
		if (token.email) {
			Logger.log(`Account: ${token.email}`);
			Logger.blank();
		}

		// Confirm disconnection
		const confirm = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'disconnect',
				message: `Are you sure you want to disconnect ${provider}?`,
				default: false,
			},
		]);

		if (!confirm.disconnect) {
			Logger.info('Cancelled');
			return;
		}

		// Remove token
		await removeOAuthToken(provider);

		Logger.blank();
		Logger.success(`${provider} account disconnected`);
		Logger.blank();
		Logger.log('💡 You can reconnect anytime with:');
		Logger.code(`workway oauth connect ${provider}`);
	} catch (error: any) {
		if (error.isTtyError) {
			Logger.error('Prompt could not be rendered in the current environment');
		} else {
			Logger.error(error.message);
		}
		process.exit(1);
	}
}
