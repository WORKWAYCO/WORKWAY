/**
 * Developer Earnings Command
 *
 * View earnings and manage Stripe Connect payouts
 */

import open from 'open';
import { Logger } from '../../utils/logger.js';
import { createAuthenticatedClient } from '../../utils/auth-client.js';

interface EarningsOptions {
	setup?: boolean;
	period?: string;
}

export async function developerEarningsCommand(options: EarningsOptions): Promise<void> {
	try {
		Logger.header('Developer Earnings');

		// Get authenticated client (DRY: shared utility)
		const { apiClient: client } = await createAuthenticatedClient({
			errorMessage: 'Not logged in',
			hint: 'Login with: workway login',
		});

		// Check if developer
		const spinner1 = Logger.spinner('Loading developer info...');
		let profile: any;

		try {
			profile = await client.getDeveloperProfile();
			spinner1.succeed('Developer info loaded');
		} catch (error: any) {
			spinner1.fail('Not a developer');
			Logger.log('');
			Logger.log('💡 Register as a developer: workway developer register');
			process.exit(1);
		}

		Logger.blank();

		// Handle Stripe setup
		if (options.setup) {
			await setupStripeConnect(client, profile);
			return;
		}

		// Show earnings
		await displayEarnings(client, profile, options.period);

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Set up Stripe Connect
 */
async function setupStripeConnect(client: any, profile: any): Promise<void> {
	if (profile.stripeConnectAccountId && profile.onboardingStatus === 'complete') {
		Logger.success('Stripe Connect already configured!');
		Logger.blank();
		Logger.log('💡 Manage your account at https://dashboard.stripe.com');
		return;
	}

	Logger.section('Stripe Connect Setup');
	Logger.log('Connect your Stripe account to receive earnings from workflow sales.');
	Logger.blank();

	const spinner = Logger.spinner('Generating setup link...');

	try {
		// This would call an API endpoint to start Stripe Connect onboarding
		// For now, we'll simulate the process

		// In production:
		// const { onboardingUrl } = await client.startStripeOnboarding(profile.id);

		const onboardingUrl = `https://workway.dev/developer/onboard/stripe?dev=${profile.id}`;

		spinner.succeed('Setup link generated');
		Logger.blank();

		Logger.log('Opening Stripe Connect onboarding in your browser...');
		Logger.blank();

		try {
			await open(onboardingUrl);
			Logger.success('Browser opened!');
		} catch (error) {
			Logger.log('Could not open browser automatically.');
			Logger.log('');
			Logger.log('Please visit this URL to complete setup:');
			Logger.log(onboardingUrl);
		}

		Logger.blank();
		Logger.log('After completing setup, run `workway developer earnings` to view your earnings.');

	} catch (error: any) {
		spinner.fail('Failed to start Stripe setup');
		Logger.error(error.message);
	}
}

/**
 * Display earnings summary
 */
async function displayEarnings(client: any, profile: any, period?: string): Promise<void> {
	// Check Stripe status
	if (!profile.stripeConnectAccountId) {
		Logger.warn('Stripe Connect not configured');
		Logger.log('');
		Logger.log('💡 Set up Stripe to receive payments: workway developer earnings --setup');
		Logger.blank();
	}

	const spinner = Logger.spinner('Loading earnings...');

	try {
		const earnings = await client.getEarnings();

		spinner.succeed('Earnings loaded');
		Logger.blank();

		// Calculate totals
		const totalEarnings = earnings.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
		const pendingEarnings = earnings
			.filter((e: any) => e.status === 'pending')
			.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
		const paidEarnings = earnings
			.filter((e: any) => e.status === 'paid')
			.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

		// Summary
		Logger.section('Earnings Summary');
		Logger.listItem(`Total Earnings: $${(totalEarnings / 100).toFixed(2)}`);
		Logger.listItem(`Pending Payout: $${(pendingEarnings / 100).toFixed(2)}`);
		Logger.listItem(`Already Paid: $${(paidEarnings / 100).toFixed(2)}`);
		Logger.blank();

		// Per-workflow breakdown
		Logger.section('By Workflow');
		const workflowEarnings = groupEarningsByWorkflow(earnings);

		if (workflowEarnings.length === 0) {
			Logger.log('  No earnings yet');
			Logger.log('');
			Logger.log('💡 Publish workflows to start earning: workway workflow publish');
		} else {
			for (const wf of workflowEarnings.slice(0, 10)) {
				Logger.log(`  ${wf.name}`);
				Logger.log(`     $${(wf.total / 100).toFixed(2)} from ${wf.count} sales`);
			}
		}
		Logger.blank();

		// Recent transactions
		Logger.section('Recent Transactions');
		const recentEarnings = earnings.slice(0, 5);

		if (recentEarnings.length === 0) {
			Logger.log('  No transactions yet');
		} else {
			for (const earning of recentEarnings) {
				const date = new Date(earning.createdAt * 1000).toLocaleDateString();
				const status = earning.status === 'paid' ? '✅' : '⏳';
				Logger.log(`  ${status} $${(earning.amount / 100).toFixed(2)} - ${earning.workflowName || 'Unknown'}`);
				Logger.log(`     ${date}`);
			}
		}
		Logger.blank();

		// Next payout info
		if (pendingEarnings > 0 && profile.stripeConnectAccountId) {
			Logger.section('Next Payout');
			Logger.log('  Payouts are processed weekly on Fridays.');
			Logger.log(`  Estimated next payout: $${(pendingEarnings / 100).toFixed(2)}`);
		}

	} catch (error: any) {
		spinner.fail('Failed to load earnings');
		Logger.error(error.message);
	}
}

/**
 * Group earnings by workflow
 */
function groupEarningsByWorkflow(earnings: any[]): any[] {
	const groups: Record<string, { name: string; total: number; count: number }> = {};

	for (const earning of earnings) {
		const id = earning.workflowId || 'unknown';
		const name = earning.workflowName || 'Unknown Workflow';

		if (!groups[id]) {
			groups[id] = { name, total: 0, count: 0 };
		}

		groups[id].total += earning.amount || 0;
		groups[id].count += 1;
	}

	return Object.values(groups).sort((a, b) => b.total - a.total);
}
