/**
 * Developer Stripe Connect Command
 *
 * Manage Stripe Connect onboarding for receiving payments
 */

import open from 'open';
import { Logger } from '../../utils/logger.js';
import { loadConfig, isAuthenticated } from '../../lib/config.js';
import { createAPIClient } from '../../lib/api-client.js';

interface StripeOptions {
	action: 'setup' | 'status' | 'refresh';
}

export async function developerStripeCommand(options: StripeOptions): Promise<void> {
	try {
		// Check authentication
		if (!(await isAuthenticated())) {
			Logger.warn('Not logged in');
			Logger.log('');
			Logger.log('Login with: workway login');
			process.exit(1);
		}

		const config = await loadConfig();
		const client = createAPIClient(config.apiUrl, config.credentials?.token);

		// Get developer profile first
		const spinner = Logger.spinner('Loading developer profile...');

		let profile: any;
		try {
			profile = await client.getDeveloperProfile();
			spinner.succeed('Developer profile loaded');
		} catch (error: any) {
			spinner.fail('Failed to load developer profile');

			if (error.isNotFound?.()) {
				Logger.log('');
				Logger.log('Not registered as a developer yet');
				Logger.log('Register with: workway developer register');
			} else {
				Logger.error(error.message);
			}
			process.exit(1);
		}

		switch (options.action) {
			case 'setup':
				await handleSetup(client, profile);
				break;
			case 'status':
				await handleStatus(client, profile);
				break;
			case 'refresh':
				await handleRefresh(client, profile);
				break;
			default:
				await handleStatus(client, profile);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Handle Stripe Connect setup (start onboarding)
 */
async function handleSetup(client: any, profile: any): Promise<void> {
	Logger.header('Stripe Connect Setup');
	Logger.blank();

	// Check if already onboarded
	const statusSpinner = Logger.spinner('Checking current status...');

	try {
		const status = await client.getStripeStatus(profile.id);
		statusSpinner.stop();

		if (status.hasStripeAccount && status.accountStatus?.chargesEnabled && status.accountStatus?.payoutsEnabled) {
			Logger.success('Your Stripe account is already set up and active!');
			Logger.blank();
			displayStatus(status);
			return;
		}

		if (status.hasStripeAccount && status.onboardingStatus === 'in_progress') {
			Logger.warn('You have an onboarding in progress');
			Logger.log('');
			Logger.log('Use "workway developer stripe refresh" to get a new onboarding link');
			Logger.log('Or "workway developer stripe status" to check your current status');
			return;
		}
	} catch (error) {
		statusSpinner.stop();
		// Continue with setup if status check fails
	}

	Logger.log('Stripe Connect allows you to receive payments for your workflows.');
	Logger.log('You\'ll be redirected to Stripe to complete the onboarding process.');
	Logger.blank();

	Logger.section('What You\'ll Need');
	Logger.listItem('Business information (name, type, tax ID)');
	Logger.listItem('Personal details for identity verification');
	Logger.listItem('Bank account for receiving payouts');
	Logger.blank();

	const onboardingSpinner = Logger.spinner('Starting Stripe onboarding...');

	try {
		const result = await client.startStripeOnboarding(profile.id);
		onboardingSpinner.succeed('Onboarding initialized');

		Logger.blank();
		Logger.success('Opening Stripe in your browser...');
		Logger.blank();

		// Open browser
		await open(result.onboardingUrl);

		Logger.log('If the browser didn\'t open, visit this URL:');
		Logger.log(result.onboardingUrl);
		Logger.blank();

		Logger.section('After Completing Stripe Onboarding');
		Logger.listItem('Return to this terminal');
		Logger.listItem('Run: workway developer stripe status');
		Logger.blank();

	} catch (error: any) {
		onboardingSpinner.fail('Failed to start onboarding');
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Handle checking Stripe status
 */
async function handleStatus(client: any, profile: any): Promise<void> {
	Logger.header('Stripe Connect Status');
	Logger.blank();

	const spinner = Logger.spinner('Checking Stripe status...');

	try {
		const status = await client.getStripeStatus(profile.id);
		spinner.succeed('Status retrieved');
		Logger.blank();

		displayStatus(status);

		// Provide helpful next steps
		if (!status.hasStripeAccount) {
			Logger.blank();
			Logger.log('Get started with: workway developer stripe setup');
		} else if (status.accountStatus?.requiresAction) {
			Logger.blank();
			Logger.log('Complete your setup with: workway developer stripe refresh');
		}

	} catch (error: any) {
		spinner.fail('Failed to get status');
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Handle refreshing expired onboarding link
 */
async function handleRefresh(client: any, profile: any): Promise<void> {
	Logger.header('Refresh Stripe Onboarding');
	Logger.blank();

	// Check if they have an account first
	const statusSpinner = Logger.spinner('Checking current status...');

	try {
		const status = await client.getStripeStatus(profile.id);
		statusSpinner.stop();

		if (!status.hasStripeAccount) {
			Logger.warn('No Stripe account found');
			Logger.log('');
			Logger.log('Start fresh with: workway developer stripe setup');
			return;
		}

		if (status.accountStatus?.chargesEnabled && status.accountStatus?.payoutsEnabled) {
			Logger.success('Your Stripe account is already fully set up!');
			Logger.blank();
			displayStatus(status);
			return;
		}
	} catch (error) {
		statusSpinner.stop();
	}

	const refreshSpinner = Logger.spinner('Generating new onboarding link...');

	try {
		const result = await client.refreshStripeOnboarding(profile.id);
		refreshSpinner.succeed('New onboarding link generated');

		Logger.blank();
		Logger.success('Opening Stripe in your browser...');
		Logger.blank();

		// Open browser
		await open(result.onboardingUrl);

		Logger.log('If the browser didn\'t open, visit this URL:');
		Logger.log(result.onboardingUrl);
		Logger.blank();

	} catch (error: any) {
		refreshSpinner.fail('Failed to refresh onboarding link');
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Display Stripe status in a formatted way
 */
function displayStatus(status: any): void {
	Logger.section('Account Status');

	if (!status.hasStripeAccount) {
		Logger.listItem('Stripe Account: Not connected');
		return;
	}

	// Account exists
	const onboardingStatus = status.onboardingStatus || 'unknown';
	const statusEmoji = onboardingStatus === 'completed' ? '🟢' :
	                   onboardingStatus === 'in_progress' ? '🟡' : '🔴';

	Logger.listItem(`Onboarding: ${statusEmoji} ${formatStatus(onboardingStatus)}`);

	if (status.accountStatus) {
		Logger.blank();
		Logger.section('Capabilities');

		const chargesIcon = status.accountStatus.chargesEnabled ? '✓' : '✗';
		const payoutsIcon = status.accountStatus.payoutsEnabled ? '✓' : '✗';
		const detailsIcon = status.accountStatus.detailsSubmitted ? '✓' : '✗';

		Logger.listItem(`Charges: ${chargesIcon} ${status.accountStatus.chargesEnabled ? 'Enabled' : 'Disabled'}`);
		Logger.listItem(`Payouts: ${payoutsIcon} ${status.accountStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}`);
		Logger.listItem(`Details Submitted: ${detailsIcon} ${status.accountStatus.detailsSubmitted ? 'Yes' : 'No'}`);

		if (status.accountStatus.requiresAction) {
			Logger.blank();
			Logger.warn('Action Required: Additional information needed to complete setup');
		}
	}

	// Summary message
	Logger.blank();
	if (status.accountStatus?.chargesEnabled && status.accountStatus?.payoutsEnabled) {
		Logger.success('Your account is fully active and ready to receive payments!');
	} else if (status.accountStatus?.detailsSubmitted) {
		Logger.log('Your details have been submitted. Stripe is reviewing your account.');
	} else {
		Logger.log('Complete your Stripe onboarding to start receiving payments.');
	}
}

/**
 * Format status string for display
 */
function formatStatus(status: string): string {
	const statusMap: Record<string, string> = {
		'completed': 'Completed',
		'in_progress': 'In Progress',
		'incomplete': 'Incomplete',
		'pending_verification': 'Pending Verification',
		'unknown': 'Unknown',
	};
	return statusMap[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
