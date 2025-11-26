/**
 * Developer Profile Command
 *
 * View and edit developer profile
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { loadConfig, isAuthenticated } from '../../lib/config.js';
import { createAPIClient } from '../../lib/api-client.js';

interface ProfileOptions {
	edit?: boolean;
}

export async function developerProfileCommand(options: ProfileOptions): Promise<void> {
	try {
		Logger.header('Developer Profile');

		// Check authentication
		if (!(await isAuthenticated())) {
			Logger.warn('Not logged in');
			Logger.log('');
			Logger.log('💡 Login with: workway login');
			process.exit(1);
		}

		const config = await loadConfig();
		const client = createAPIClient(config.apiUrl, config.credentials?.token);

		const spinner = Logger.spinner('Loading profile...');

		try {
			const profile = await client.getDeveloperProfile();

			spinner.succeed('Profile loaded');
			Logger.blank();

			if (options.edit) {
				// Edit mode
				await editProfile(client, profile);
			} else {
				// Display mode
				displayProfile(profile);
			}

		} catch (error: any) {
			spinner.fail('Failed to load profile');

			if (error.isNotFound?.()) {
				Logger.log('Not registered as a developer yet');
				Logger.log('');
				Logger.log('💡 Register with: workway developer register');
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

/**
 * Display developer profile
 */
function displayProfile(profile: any): void {
	Logger.section('Profile Information');
	Logger.listItem(`Company: ${profile.companyName || 'Not set'}`);
	Logger.listItem(`Bio: ${profile.bio || 'Not set'}`);
	Logger.listItem(`Website: ${profile.websiteUrl || 'Not set'}`);
	Logger.listItem(`GitHub: ${profile.githubUrl || 'Not set'}`);
	Logger.listItem(`Twitter: ${profile.twitterUrl || 'Not set'}`);
	Logger.blank();

	Logger.section('Statistics');
	Logger.listItem(`Total Integrations: ${profile.totalIntegrations || 0}`);
	Logger.listItem(`Published: ${profile.publishedIntegrations || 0}`);
	Logger.listItem(`Total Installs: ${profile.totalInstalls || 0}`);
	Logger.listItem(`Average Rating: ${profile.averageRating?.toFixed(1) || 'N/A'} ⭐`);
	Logger.blank();

	Logger.section('Stripe Connect');
	if (profile.stripeConnectAccountId) {
		const status = profile.onboardingStatus === 'complete' ? '🟢 Active' : '🟡 Pending';
		Logger.listItem(`Status: ${status}`);
		Logger.listItem(`Account: ${profile.stripeConnectAccountId.substring(0, 10)}...`);
	} else {
		Logger.listItem('Status: 🔴 Not connected');
		Logger.log('');
		Logger.log('💡 Set up Stripe to receive payments: workway developer earnings --setup');
	}
	Logger.blank();

	Logger.log('💡 Edit profile with: workway developer profile --edit');
}

/**
 * Edit developer profile
 */
async function editProfile(client: any, currentProfile: any): Promise<void> {
	Logger.log('Edit your profile (press Enter to keep current value)');
	Logger.blank();

	const answers = await inquirer.prompt([
		{
			type: 'input',
			name: 'companyName',
			message: 'Company name:',
			default: currentProfile.companyName,
		},
		{
			type: 'input',
			name: 'bio',
			message: 'Bio:',
			default: currentProfile.bio,
		},
		{
			type: 'input',
			name: 'websiteUrl',
			message: 'Website URL:',
			default: currentProfile.websiteUrl,
			validate: (input: string) => {
				if (!input) return true;
				try {
					new URL(input);
					return true;
				} catch {
					return 'Please enter a valid URL';
				}
			},
		},
		{
			type: 'input',
			name: 'githubUrl',
			message: 'GitHub URL:',
			default: currentProfile.githubUrl,
		},
		{
			type: 'input',
			name: 'twitterUrl',
			message: 'Twitter URL:',
			default: currentProfile.twitterUrl,
		},
		{
			type: 'confirm',
			name: 'confirm',
			message: 'Save changes?',
			default: true,
		},
	]);

	if (!answers.confirm) {
		Logger.log('Changes cancelled');
		return;
	}

	const spinner = Logger.spinner('Updating profile...');

	try {
		// Build updates object
		const updates: any = {};
		if (answers.companyName !== currentProfile.companyName) {
			updates.companyName = answers.companyName;
		}
		if (answers.bio !== currentProfile.bio) {
			updates.bio = answers.bio;
		}
		if (answers.websiteUrl !== currentProfile.websiteUrl) {
			updates.websiteUrl = answers.websiteUrl;
		}
		if (answers.githubUrl !== currentProfile.githubUrl) {
			updates.githubUrl = answers.githubUrl;
		}
		if (answers.twitterUrl !== currentProfile.twitterUrl) {
			updates.twitterUrl = answers.twitterUrl;
		}

		if (Object.keys(updates).length === 0) {
			spinner.succeed('No changes to save');
			return;
		}

		await client.updateDeveloperProfile(updates);

		spinner.succeed('Profile updated!');

	} catch (error: any) {
		spinner.fail('Failed to update profile');
		Logger.error(error.message);
	}
}
