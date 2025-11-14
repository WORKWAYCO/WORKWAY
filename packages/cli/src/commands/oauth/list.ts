/**
 * OAuth List Command
 *
 * List connected OAuth accounts
 */

import { Logger } from '../../utils/logger.js';
import { loadOAuthTokens } from '../../lib/config.js';

export async function oauthListCommand(): Promise<void> {
	try {
		Logger.header('Connected OAuth Accounts');

		// Load OAuth tokens
		const tokens = await loadOAuthTokens();
		const providers = Object.keys(tokens);

		if (providers.length === 0) {
			Logger.warn('No OAuth accounts connected');
			Logger.blank();
			Logger.log('💡 Connect an account with:');
			Logger.code('workway oauth connect <provider>');
			Logger.blank();
			Logger.log('Supported providers:');
			Logger.listItem('gmail');
			Logger.listItem('slack');
			Logger.listItem('notion');
			Logger.listItem('stripe');
			Logger.listItem('salesforce');
			return;
		}

		Logger.section(`${providers.length} account${providers.length === 1 ? '' : 's'} connected`);
		Logger.blank();

		// Display each connection
		for (const provider of providers) {
			const token = tokens[provider];

			Logger.log(`📱 ${provider.toUpperCase()}`);

			if (token.email) {
				Logger.listItem(`Account: ${token.email}`);
			}

			if (token.scope) {
				const scopes = typeof token.scope === 'string' ? token.scope.split(' ') : token.scope;
				Logger.listItem(`Scopes: ${scopes.length} granted`);
			}

			if (token.expiresAt) {
				const expiresDate = new Date(token.expiresAt);
				const now = Date.now();

				if (token.expiresAt > now) {
					const hoursLeft = Math.floor((token.expiresAt - now) / (1000 * 60 * 60));
					Logger.listItem(`Expires: ${expiresDate.toLocaleString()} (in ${hoursLeft}h)`);
				} else {
					Logger.listItem(`Status: ⚠️  Expired`);
				}
			} else {
				Logger.listItem(`Status: ✓ Active`);
			}

			if (token.connectedAt) {
				const connectedDate = new Date(token.connectedAt);
				Logger.listItem(`Connected: ${connectedDate.toLocaleString()}`);
			}

			Logger.blank();
		}

		Logger.info('Use these accounts for live workflow testing');
		Logger.code('workway workflow test --live');
	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}
