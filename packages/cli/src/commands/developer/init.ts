/**
 * Developer Init Command
 *
 * Create a developer profile for the WORKWAY Marketplace.
 * Your profile serves two purposes:
 * 1. Waitlist application for marketplace publishing
 * 2. Professional presence for generating client work
 *
 * WORKWAY helps developers build workflows AND find work.
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import {
	loadDeveloperProfile,
	saveDeveloperProfile,
	getDeveloperProfilePath,
} from '../../lib/config.js';
import type { DeveloperWaitlistProfile } from '../../types/index.js';

// Available integrations for workflow ideas
const AVAILABLE_INTEGRATIONS = [
	'zoom',
	'notion',
	'slack',
	'stripe',
	'hubspot',
	'calendly',
	'todoist',
	'linear',
	'airtable',
	'typeform',
	'google-sheets',
	'dribbble',
];

export async function developerInitCommand(): Promise<void> {
	Logger.header('Developer Profile');

	// Check if profile already exists
	const existingProfile = await loadDeveloperProfile();

	if (existingProfile) {
		Logger.log('Profile exists.');
		Logger.blank();

		const { action } = await inquirer.prompt([
			{
				type: 'list',
				name: 'action',
				message: 'What would you like to do?',
				choices: [
					{ name: 'Edit profile', value: 'edit' },
					{ name: 'View profile', value: 'view' },
					{ name: 'Start fresh', value: 'reset' },
					{ name: 'Cancel', value: 'cancel' },
				],
			},
		]);

		if (action === 'cancel') {
			return;
		}

		if (action === 'view') {
			displayProfile(existingProfile);
			return;
		}

		if (action === 'reset') {
			const { confirm } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'confirm',
					message: 'This will delete your current profile. Continue?',
					default: false,
				},
			]);

			if (!confirm) {
				Logger.log('Cancelled.');
				return;
			}
		}

		// Continue to edit/reset
		if (action === 'edit') {
			await editProfile(existingProfile);
			return;
		}
	}

	// Create new profile
	await createProfile();
}

/**
 * Create a new developer profile
 */
async function createProfile(): Promise<void> {
	Logger.blank();
	Logger.log('Your profile serves two purposes:');
	Logger.listItem('Marketplace access (publish workflows, earn revenue)');
	Logger.listItem('Professional presence (attract client work)');
	Logger.blank();
	Logger.log('WORKWAY helps developers build workflows AND find work.');
	Logger.blank();

	// Identity
	Logger.section('Identity');
	const identity = await inquirer.prompt([
		{
			type: 'input',
			name: 'name',
			message: 'Your name:',
			validate: (input: string) => input.length > 0 || 'Name is required',
		},
		{
			type: 'input',
			name: 'email',
			message: 'Email:',
			validate: (input: string) => {
				if (!input) return 'Email is required';
				if (!input.includes('@')) return 'Please enter a valid email';
				return true;
			},
		},
		{
			type: 'input',
			name: 'companyName',
			message: 'Company/Studio name (optional):',
		},
	]);

	// Professional background - what makes you valuable
	Logger.section('Professional Background');
	Logger.log('This helps clients understand what you bring to the table.');
	Logger.blank();

	const background = await inquirer.prompt([
		{
			type: 'input',
			name: 'technicalBackground',
			message: 'What do you build? (systems, integrations, automations):',
			validate: (input: string) =>
				input.length > 10 || 'Describe your expertise',
		},
		{
			type: 'input',
			name: 'githubUrl',
			message: 'GitHub (optional):',
			validate: validateOptionalUrl,
		},
		{
			type: 'input',
			name: 'portfolioUrl',
			message: 'Portfolio/Website (optional):',
			validate: validateOptionalUrl,
		},
	]);

	// Workflow focus - what you want to build
	Logger.section('Workflow Focus');
	Logger.log('What systems do you want to connect?');
	Logger.blank();

	const focus = await inquirer.prompt([
		{
			type: 'checkbox',
			name: 'targetIntegrations',
			message: 'Integrations you work with:',
			choices: AVAILABLE_INTEGRATIONS.map((i) => ({ name: i, value: i })),
			validate: (input: string[]) =>
				input.length > 0 || 'Select at least one',
		},
		{
			type: 'input',
			name: 'workflowIdeas',
			message: 'Workflows you want to build:',
			validate: (input: string) =>
				input.length > 10 || 'Describe what you want to create',
		},
	]);

	// Why WORKWAY
	Logger.section('Why WORKWAY');
	const why = await inquirer.prompt([
		{
			type: 'input',
			name: 'whyWorkway',
			message: 'What brought you here?',
			validate: (input: string) =>
				input.length > 10 || 'Share your motivation',
		},
	]);

	const now = new Date().toISOString();
	const profile: DeveloperWaitlistProfile = {
		name: identity.name,
		email: identity.email,
		companyName: identity.companyName || undefined,
		technicalBackground: background.technicalBackground.trim(),
		githubUrl: background.githubUrl || undefined,
		portfolioUrl: background.portfolioUrl || undefined,
		targetIntegrations: focus.targetIntegrations,
		workflowIdeas: focus.workflowIdeas.trim(),
		whyWorkway: why.whyWorkway.trim(),
		createdAt: now,
		updatedAt: now,
	};

	await saveDeveloperProfile(profile);

	Logger.blank();
	Logger.success('Profile created');
	Logger.blank();
	Logger.log(`Saved to: ${getDeveloperProfilePath()}`);
	Logger.blank();

	Logger.section('Next Steps');
	Logger.listItem('Review: workway developer init');
	Logger.listItem('Submit for marketplace access: workway developer submit');
	Logger.blank();

	Logger.section('Build While You Wait');
	Logger.listItem('SDK: npm install @workwayco/sdk');
	Logger.listItem('Create workflow: workway workflow init');
	Logger.listItem('Contribute to SDK/CLI');
	Logger.blank();

	Logger.log('Good contributions demonstrate capability better than any application.');
}

/**
 * Edit an existing profile
 */
async function editProfile(profile: DeveloperWaitlistProfile): Promise<void> {
	Logger.blank();
	Logger.log('Edit your profile (press Enter to keep current value)');
	Logger.blank();

	const answers = await inquirer.prompt([
		{
			type: 'input',
			name: 'name',
			message: 'Your name:',
			default: profile.name,
			validate: (input: string) => input.length > 0 || 'Name is required',
		},
		{
			type: 'input',
			name: 'email',
			message: 'Email:',
			default: profile.email,
			validate: (input: string) => {
				if (!input) return 'Email is required';
				if (!input.includes('@')) return 'Please enter a valid email';
				return true;
			},
		},
		{
			type: 'input',
			name: 'companyName',
			message: 'Company name:',
			default: profile.companyName || '',
		},
		{
			type: 'confirm',
			name: 'editBackground',
			message: 'Edit technical background?',
			default: false,
		},
	]);

	let technicalBackground = profile.technicalBackground;
	if (answers.editBackground) {
		const bgAnswer = await inquirer.prompt([
			{
				type: 'input',
				name: 'technicalBackground',
				message: 'Technical background:',
				default: profile.technicalBackground,
			},
		]);
		technicalBackground = bgAnswer.technicalBackground.trim();
	}

	const moreAnswers = await inquirer.prompt([
		{
			type: 'input',
			name: 'githubUrl',
			message: 'GitHub URL:',
			default: profile.githubUrl || '',
			validate: validateOptionalUrl,
		},
		{
			type: 'input',
			name: 'portfolioUrl',
			message: 'Portfolio/Website URL:',
			default: profile.portfolioUrl || '',
			validate: validateOptionalUrl,
		},
		{
			type: 'checkbox',
			name: 'targetIntegrations',
			message: 'Which integrations interest you?',
			choices: AVAILABLE_INTEGRATIONS.map((i) => ({
				name: i,
				value: i,
				checked: profile.targetIntegrations.includes(i),
			})),
			validate: (input: string[]) =>
				input.length > 0 || 'Select at least one integration',
		},
		{
			type: 'confirm',
			name: 'editIdeas',
			message: 'Edit workflow ideas?',
			default: false,
		},
	]);

	let workflowIdeas = profile.workflowIdeas;
	if (moreAnswers.editIdeas) {
		const ideaAnswer = await inquirer.prompt([
			{
				type: 'input',
				name: 'workflowIdeas',
				message: 'Workflow ideas:',
				default: profile.workflowIdeas,
			},
		]);
		workflowIdeas = ideaAnswer.workflowIdeas.trim();
	}

	const whyAnswer = await inquirer.prompt([
		{
			type: 'confirm',
			name: 'editWhy',
			message: 'Edit "Why WORKWAY"?',
			default: false,
		},
	]);

	let whyWorkway = profile.whyWorkway;
	if (whyAnswer.editWhy) {
		const whyPrompt = await inquirer.prompt([
			{
				type: 'input',
				name: 'whyWorkway',
				message: 'Why WORKWAY?',
				default: profile.whyWorkway,
			},
		]);
		whyWorkway = whyPrompt.whyWorkway.trim();
	}

	const { confirm } = await inquirer.prompt([
		{
			type: 'confirm',
			name: 'confirm',
			message: 'Save changes?',
			default: true,
		},
	]);

	if (!confirm) {
		Logger.log('Changes cancelled.');
		return;
	}

	const updatedProfile: DeveloperWaitlistProfile = {
		...profile,
		name: answers.name,
		email: answers.email,
		companyName: answers.companyName || undefined,
		technicalBackground,
		githubUrl: moreAnswers.githubUrl || undefined,
		portfolioUrl: moreAnswers.portfolioUrl || undefined,
		targetIntegrations: moreAnswers.targetIntegrations,
		workflowIdeas,
		whyWorkway,
		updatedAt: new Date().toISOString(),
	};

	await saveDeveloperProfile(updatedProfile);

	Logger.blank();
	Logger.success('Profile updated!');
}

/**
 * Display profile
 */
function displayProfile(profile: DeveloperWaitlistProfile): void {
	Logger.blank();

	Logger.section('Identity');
	Logger.listItem(`Name: ${profile.name}`);
	Logger.listItem(`Email: ${profile.email}`);
	if (profile.companyName) {
		Logger.listItem(`Company: ${profile.companyName}`);
	}
	Logger.blank();

	Logger.section('Professional Background');
	Logger.log(profile.technicalBackground);
	Logger.blank();

	if (profile.githubUrl || profile.portfolioUrl) {
		Logger.section('Links');
		if (profile.githubUrl) Logger.listItem(`GitHub: ${profile.githubUrl}`);
		if (profile.portfolioUrl) Logger.listItem(`Portfolio: ${profile.portfolioUrl}`);
		Logger.blank();
	}

	Logger.section('Workflow Focus');
	Logger.log(profile.targetIntegrations.join(', '));
	Logger.blank();

	Logger.section('What You Build');
	Logger.log(profile.workflowIdeas);
	Logger.blank();

	Logger.section('Why WORKWAY');
	Logger.log(profile.whyWorkway);
	Logger.blank();

	if (profile.submittedAt) {
		Logger.section('Status');
		Logger.listItem(`Submitted: ${new Date(profile.submittedAt).toLocaleDateString()}`);
		Logger.blank();
		Logger.log('Check status: workway developer status');
	} else {
		Logger.section('Status');
		Logger.listItem('Not yet submitted');
		Logger.blank();
		Logger.log('Submit for review: workway developer submit');
	}
}

/**
 * Validate optional URL
 */
function validateOptionalUrl(input: string): boolean | string {
	if (!input) return true;
	try {
		new URL(input);
		return true;
	} catch {
		return 'Please enter a valid URL';
	}
}
