/**
 * Status Command
 *
 * Developer dashboard showing position in the marketplace
 * The "hermeneutic clearing" - understanding your position in the system
 */

import { Logger } from '../utils/logger.js';
import { loadConfig, isAuthenticated, loadOAuthTokens } from '../lib/config.js';
import { createAPIClient } from '../lib/api-client.js';

export async function statusCommand(): Promise<void> {
	try {
		Logger.header('WORKWAY Status');

		// Check authentication
		if (!(await isAuthenticated())) {
			Logger.warn('Not logged in');
			Logger.log('');
			Logger.log('💡 Login with: workway login');
			process.exit(1);
		}

		const config = await loadConfig();
		const client = createAPIClient(config.apiUrl, config.credentials?.token);

		const spinner = Logger.spinner('Loading developer status...');

		try {
			// Get developer profile
			const profile = await client.getDeveloperProfile();

			spinner.succeed('Status loaded');
			Logger.blank();

			// Developer Info
			Logger.section('Developer Profile');
			Logger.listItem(`Company: ${profile.companyName || 'Not set'}`);
			Logger.listItem(`Email: ${config.credentials?.email || 'Unknown'}`);
			if (profile.bio) {
				Logger.listItem(`Bio: ${profile.bio.substring(0, 50)}...`);
			}
			Logger.blank();

			// Workflows
			Logger.section('Your Workflows');
			try {
				const workflows = await client.listMyWorkflows();

				if (workflows.length === 0) {
					Logger.log('  No workflows published yet');
					Logger.log('  💡 Create one with: workway workflow init');
				} else {
					for (const workflow of workflows.slice(0, 5)) {
						const status = workflow.status === 'published' ? '🟢' : '🟡';
						Logger.log(`  ${status} ${workflow.name}`);
						Logger.log(`     ⭐ ${workflow.average_rating || 0} • ${workflow.install_count || 0} installs`);
					}
					if (workflows.length > 5) {
						Logger.log(`  ... and ${workflows.length - 5} more`);
					}
				}
			} catch (error: any) {
				Logger.log('  No workflows found');
			}
			Logger.blank();

			// Earnings Summary
			Logger.section('Earnings');
			try {
				const earnings = await client.getEarnings();

				if (earnings.length === 0) {
					Logger.log('  No earnings yet');
				} else {
					const totalEarnings = earnings.reduce((sum, e) => sum + (e.revenue || 0), 0);
					const pendingEarnings = earnings
						.filter(e => e.status === 'pending')
						.reduce((sum, e) => sum + (e.revenue || 0), 0);

					Logger.listItem(`Total: $${(totalEarnings / 100).toFixed(2)}`);
					Logger.listItem(`Pending: $${(pendingEarnings / 100).toFixed(2)}`);
				}
			} catch (error: any) {
				Logger.log('  Unable to load earnings');
			}
			Logger.blank();

			// OAuth Connections
			Logger.section('OAuth Connections');
			const oauthTokens = await loadOAuthTokens();
			const providers = Object.keys(oauthTokens);

			if (providers.length === 0) {
				Logger.log('  No OAuth accounts connected');
				Logger.log('  💡 Connect with: workway oauth connect <provider>');
			} else {
				for (const provider of providers) {
					const token = oauthTokens[provider];
					const expiry = token.expiresAt ? new Date(token.expiresAt * 1000) : null;
					const isExpired = expiry && expiry < new Date();

					const status = isExpired ? '🔴 Expired' : '🟢 Connected';
					Logger.log(`  ${status} ${provider}`);
				}
			}
			Logger.blank();

			// Quick Actions
			Logger.section('Quick Actions');
			Logger.log('  workway workflow init    Create new workflow');
			Logger.log('  workway workflow dev     Start dev server');
			Logger.log('  workway workflow test    Test workflow');
			Logger.log('  workway workflow publish Publish to marketplace');
			Logger.log('  workway logs             View production logs');

		} catch (error: any) {
			spinner.fail('Failed to load status');

			if (error.isUnauthorized?.()) {
				Logger.error('Session expired. Please login again.');
				Logger.log('');
				Logger.log('💡 Login with: workway login');
			} else {
				Logger.error(error.message);
			}
			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}
