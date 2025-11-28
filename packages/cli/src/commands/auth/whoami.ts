/**
 * Whoami command
 *
 * Display current authenticated user
 */

import { Logger } from '../../utils/logger.js';
import { createAuthenticatedClient } from '../../utils/auth-client.js';
import { APIError } from '../../lib/api-client.js';

export async function whoamiCommand(): Promise<void> {
	try {
		// Get authenticated client (DRY: shared utility)
		const { apiClient, apiUrl } = await createAuthenticatedClient();

		// Show spinner
		const spinner = Logger.spinner('Fetching account info...');

		try {
			// Get user info
			const userInfo = await apiClient.whoami();

			// Try to get developer profile
			let developerProfile = null;
			try {
				developerProfile = await apiClient.getDeveloperProfile();
			} catch (error) {
				// User might not be a developer
			}

			spinner.succeed('Account information');
			Logger.blank();

			// Display user info
			Logger.section('User Information');
			Logger.listItem(`Email: ${userInfo.email}`);
			Logger.listItem(`User ID: ${userInfo.userId}`);
			Logger.listItem(`Role: ${userInfo.role}`);

			// Display developer info if available
			if (developerProfile) {
				Logger.blank();
				Logger.section('Developer Profile');
				Logger.listItem(`Developer ID: ${developerProfile.id}`);
				Logger.listItem(`Status: ${developerProfile.verified ? 'Verified ✓' : 'Not verified'}`);
				Logger.listItem(`Onboarding: ${developerProfile.onboardingStatus}`);

				if (developerProfile.companyName) {
					Logger.listItem(`Company: ${developerProfile.companyName}`);
				}

				if (developerProfile.stripeConnectAccountId) {
					Logger.listItem('Payout: Stripe Connect configured ✓');
				}
			}

			Logger.blank();
			Logger.info('API URL: ' + apiUrl);
		} catch (error) {
			spinner.fail('Failed to fetch account info');

			if (error instanceof APIError) {
				if (error.isUnauthorized()) {
					Logger.error('Session expired. Please log in again.');
					Logger.log('');
					Logger.log('💡 Run `workway login` to authenticate');
				} else {
					Logger.error(error.message);
				}
			} else {
				Logger.error('An unexpected error occurred');
			}

			process.exit(1);
		}
	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}
