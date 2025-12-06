/**
 * Developer Status Command
 *
 * Check the status of your waitlist application.
 * No authentication required - uses email to check.
 */

import axios from 'axios';
import { Logger } from '../../utils/logger.js';
import { loadDeveloperProfile } from '../../lib/config.js';
import { API_BASE_URL } from '../../constants.js';

export async function developerStatusCommand(): Promise<void> {
	Logger.header('Waitlist Status');

	// Load local profile
	const profile = await loadDeveloperProfile();

	if (!profile) {
		Logger.section('Local Profile');
		Logger.listItem('Status: Not created');
		Logger.blank();
		Logger.log('Create your profile: workway developer init');
		return;
	}

	// Show local profile status
	Logger.section('Local Profile');
	Logger.listItem(`Name: ${profile.name}`);
	Logger.listItem(`Email: ${profile.email}`);

	if (!profile.submittedAt) {
		Logger.listItem('Status: Not submitted');
		Logger.blank();
		Logger.log('Join waitlist: workway developer submit');
		return;
	}

	Logger.listItem(`Submitted: ${new Date(profile.submittedAt).toLocaleDateString()}`);
	Logger.blank();

	const spinner = Logger.spinner('Checking waitlist status...');

	try {
		// Check public waitlist status endpoint (no auth required)
		const response = await axios.get(
			`${API_BASE_URL}/waitlist/status/${encodeURIComponent(profile.email)}`
		);

		const data = response.data;
		spinner.stop();

		if (!data.found) {
			Logger.section('Waitlist Status');
			Logger.listItem('Status: Not found');
			Logger.blank();
			Logger.log('Join waitlist: workway developer submit');
			return;
		}

		Logger.section('Waitlist Status');

		switch (data.status) {
			case 'pending':
				Logger.listItem(`Position: #${data.position}`);
				Logger.listItem('Status: Waiting for invitation');
				Logger.blank();
				Logger.log('We invite developers in batches of 10.');
				Logger.blank();
				Logger.section('While You Wait');
				Logger.listItem('Explore the SDK: npm install @workwayco/sdk');
				Logger.listItem('Build locally: workway workflow init');
				Logger.listItem('Contribute to the SDK/CLI');
				break;

			case 'invited':
				Logger.listItem('Status: Invited!');
				if (data.batchNumber) {
					Logger.listItem(`Batch: #${data.batchNumber}`);
				}
				if (data.invitedAt) {
					Logger.listItem(`Invited: ${new Date(data.invitedAt * 1000).toLocaleDateString()}`);
				}
				Logger.blank();
				Logger.success('Check your email for the invitation link!');
				Logger.blank();
				Logger.log('After registering, login with: workway login');
				break;

			case 'registered':
				Logger.listItem('Status: Registered');
				Logger.blank();
				Logger.success('You have full access to the WORKWAY Marketplace!');
				Logger.blank();
				Logger.section('Get Started');
				Logger.listItem('Login: workway login');
				Logger.listItem('Create workflow: workway workflow init');
				Logger.listItem('Develop and test: workway workflow dev');
				Logger.listItem('Publish: workway workflow publish');
				break;

			default:
				Logger.listItem(`Status: ${data.status}`);
		}

	} catch (error: any) {
		spinner.fail('Failed to check status');

		if (error.response?.data?.error) {
			Logger.error(error.response.data.error);
		} else {
			Logger.error(error.message || 'Unknown error');
		}
	}
}
