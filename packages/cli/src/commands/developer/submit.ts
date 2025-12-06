/**
 * Developer Submit Command
 *
 * Submit developer profile to the WORKWAY waitlist.
 * No authentication required - this is the entry point.
 */

import inquirer from 'inquirer';
import axios from 'axios';
import { Logger } from '../../utils/logger.js';
import {
	loadDeveloperProfile,
	saveDeveloperProfile,
} from '../../lib/config.js';
import { API_BASE_URL } from '../../constants.js';

export async function developerSubmitCommand(): Promise<void> {
	Logger.header('Join the Waitlist');

	// Load local profile
	const profile = await loadDeveloperProfile();

	if (!profile) {
		Logger.error('No developer profile found.');
		Logger.blank();
		Logger.log('Create your profile first:');
		Logger.log('  workway developer init');
		process.exit(1);
	}

	// Check if already submitted
	if (profile.submittedAt) {
		Logger.log('Already on the waitlist.');
		Logger.blank();
		Logger.listItem(`Submitted: ${new Date(profile.submittedAt).toLocaleDateString()}`);
		Logger.blank();
		Logger.log('Check status: workway developer status');
		return;
	}

	// Show profile summary
	Logger.blank();
	Logger.section('Profile Summary');
	Logger.listItem(`Name: ${profile.name}`);
	Logger.listItem(`Email: ${profile.email}`);
	if (profile.companyName) Logger.listItem(`Company: ${profile.companyName}`);
	Logger.listItem(`Integrations: ${profile.targetIntegrations.join(', ')}`);
	Logger.blank();

	// Confirm submission
	const { confirm } = await inquirer.prompt([
		{
			type: 'confirm',
			name: 'confirm',
			message: 'Join the waitlist?',
			default: true,
		},
	]);

	if (!confirm) {
		Logger.log('Cancelled.');
		Logger.blank();
		Logger.log('Edit your profile: workway developer init');
		return;
	}

	const spinner = Logger.spinner('Joining waitlist...');

	try {
		// Submit to public waitlist endpoint (no auth required)
		const response = await axios.post(`${API_BASE_URL}/waitlist/signup`, {
			email: profile.email,
			name: profile.name,
		});

		const data = response.data;

		// Update local profile with submission timestamp
		const updatedProfile = {
			...profile,
			submittedAt: new Date().toISOString(),
			waitlistId: data.id,
		};
		await saveDeveloperProfile(updatedProfile);

		if (data.alreadyOnWaitlist) {
			spinner.succeed('Already on the waitlist');
		} else if (data.alreadyInvited) {
			spinner.succeed('You have been invited!');
			Logger.blank();
			Logger.log('Check your email for the invitation link.');
		} else if (data.alreadyRegistered) {
			spinner.succeed('Already registered');
			Logger.blank();
			Logger.log('Login with: workway login');
		} else {
			spinner.succeed(`You're #${data.position} on the waitlist`);
		}

		Logger.blank();

		Logger.section('What Happens Next');
		Logger.listItem('We invite developers in batches of 10');
		Logger.listItem('Check status: workway developer status');
		Logger.blank();

		Logger.section('While You Wait');
		Logger.listItem('Explore the SDK: npm install @workwayco/sdk');
		Logger.listItem('Build locally: workway workflow init');
		Logger.listItem('Contribute to the SDK/CLI on GitHub');
		Logger.blank();

		Logger.log('Contributions demonstrate capability better than any application.');

	} catch (error: any) {
		spinner.fail('Failed to join waitlist');

		if (error.response?.data?.error) {
			Logger.error(error.response.data.error);
		} else {
			Logger.error(error.message || 'Unknown error');
		}

		process.exit(1);
	}
}
