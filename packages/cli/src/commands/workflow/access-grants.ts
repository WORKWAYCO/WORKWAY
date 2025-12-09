/**
 * Workflow Access Grants Command
 *
 * Manage access grants for Private Workflows.
 * Grant access to specific users, email domains, or via access codes.
 *
 * Heideggerian (Zuhandenheit):
 * The CLI is ready-to-hand for developers configuring access.
 * Users see "Your Organization" - developers see the mechanism.
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { createAuthenticatedClient } from '../../utils/auth-client.js';
import type { WorkflowAccessGrant, CreateAccessGrantOptions } from '../../lib/api-client.js';

// Access grant type descriptions
const GRANT_TYPES = [
	{
		name: 'Email Domain - Grant to all users with @domain.com',
		value: 'email_domain',
		description: 'All users with emails matching this domain get access',
		example: 'halfdozen.co',
	},
	{
		name: 'Specific User - Grant to a single user by email',
		value: 'user',
		description: 'Grant access to a specific user by their email address',
		example: 'dm@halfdozen.co',
	},
	{
		name: 'Access Code - Anyone with the code can install',
		value: 'access_code',
		description: 'Generate a shareable code for installation access',
		example: 'AUTO-GENERATED',
	},
];

interface AccessGrantOptions {
	workflowId?: string;
	grantType?: 'user' | 'email_domain' | 'access_code';
	grantValue?: string;
	maxInstalls?: number;
	expires?: string;
	notes?: string;
}

/**
 * List access grants for a workflow
 */
export async function workflowAccessGrantListCommand(
	workflowId?: string,
	options: AccessGrantOptions = {}
): Promise<void> {
	try {
		Logger.header('Workflow Access Grants');

		const { apiClient: client } = await createAuthenticatedClient({
			errorMessage: 'Not logged in',
			hint: 'Login with: workway login',
		});

		// If no workflow ID provided, prompt for it
		let targetWorkflowId = workflowId || options.workflowId;

		if (!targetWorkflowId) {
			// List developer's workflows first
			const spinner = Logger.spinner('Loading your workflows...');
			const workflows = await client.listDeveloperWorkflows();
			spinner.stop();

			if (workflows.length === 0) {
				Logger.warn('No workflows found.');
				Logger.log('Publish a workflow first: workway workflow publish');
				return;
			}

			const { selectedWorkflow } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedWorkflow',
					message: 'Select workflow:',
					choices: workflows.map((w) => ({
						name: `${w.name} (${w.visibility || 'public'})`,
						value: w.id,
					})),
				},
			]);
			targetWorkflowId = selectedWorkflow;
		}

		const spinner = Logger.spinner('Loading access grants...');

		try {
			const grants = await client.listAccessGrants(targetWorkflowId!);

			spinner.succeed('Access grants loaded');
			Logger.blank();

			if (grants.length === 0) {
				Logger.log('No access grants configured.');
				Logger.blank();
				Logger.log('This workflow is either public or has no private access grants.');
				Logger.log('');
				Logger.log('Create a grant: workway workflow access-grants create');
				return;
			}

			// Display grants
			Logger.log(`Found ${grants.length} access grant(s):\n`);

			for (const grant of grants) {
				displayAccessGrant(grant);
			}

			Logger.blank();
			Logger.log('Commands:');
			Logger.log('  workway workflow access-grants create  - Create new access grant');
			Logger.log('  workway workflow access-grants revoke  - Revoke an access grant');
		} catch (error: any) {
			spinner.fail('Failed to load access grants');
			Logger.error(error.message);
			process.exit(1);
		}
	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Create access grant for a workflow
 */
export async function workflowAccessGrantCreateCommand(
	workflowId?: string,
	options: AccessGrantOptions = {}
): Promise<void> {
	try {
		Logger.header('Create Access Grant');
		Logger.log('Grant access to your private workflow.\n');

		const { apiClient: client } = await createAuthenticatedClient({
			errorMessage: 'Not logged in',
			hint: 'Login with: workway login',
		});

		// If no workflow ID provided, prompt for it
		let targetWorkflowId = workflowId || options.workflowId;

		if (!targetWorkflowId) {
			const spinner = Logger.spinner('Loading your workflows...');
			const workflows = await client.listDeveloperWorkflows();
			spinner.stop();

			if (workflows.length === 0) {
				Logger.warn('No workflows found.');
				Logger.log('Publish a workflow first: workway workflow publish');
				return;
			}

			const { selectedWorkflow } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedWorkflow',
					message: 'Select workflow to grant access to:',
					choices: workflows.map((w) => ({
						name: `${w.name} (${w.visibility || 'public'})`,
						value: w.id,
					})),
				},
			]);
			targetWorkflowId = selectedWorkflow;
		}

		// Determine grant type
		let grantType = options.grantType;
		if (!grantType) {
			const { selectedType } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedType',
					message: 'Access grant type:',
					choices: GRANT_TYPES.map((t) => ({
						name: t.name,
						value: t.value,
					})),
				},
			]);
			grantType = selectedType;
		}

		// Get grant value based on type
		let grantValue = options.grantValue;
		if (!grantValue && grantType !== 'access_code') {
			const grantTypeConfig = GRANT_TYPES.find((t) => t.value === grantType);

			const { value } = await inquirer.prompt([
				{
					type: 'input',
					name: 'value',
					message:
						grantType === 'email_domain'
							? 'Email domain (e.g., halfdozen.co):'
							: 'User email:',
					validate: (input: string) => {
						if (!input.trim()) return 'Value is required';
						if (grantType === 'email_domain' && input.includes('@')) {
							return 'Enter domain only, without @ (e.g., halfdozen.co)';
						}
						if (grantType === 'user' && !input.includes('@')) {
							return 'Enter a valid email address';
						}
						return true;
					},
				},
			]);
			grantValue = value;
		}

		// For access_code, generate a random code
		if (grantType === 'access_code' && !grantValue) {
			grantValue = generateAccessCode();
			Logger.log(`Generated access code: ${grantValue}`);
		}

		// Optional: max installs
		let maxInstalls = options.maxInstalls;
		if (maxInstalls === undefined) {
			const { limit } = await inquirer.prompt([
				{
					type: 'input',
					name: 'limit',
					message: 'Max installations (leave empty for unlimited):',
					default: '',
					validate: (input: string) => {
						if (input === '') return true;
						const num = parseInt(input, 10);
						if (isNaN(num) || num < 1) return 'Enter a positive number or leave empty';
						return true;
					},
				},
			]);
			maxInstalls = limit ? parseInt(limit, 10) : undefined;
		}

		// Optional: expiration
		let expiresAt: Date | undefined;
		if (options.expires) {
			expiresAt = new Date(options.expires);
		} else {
			const { setExpiry } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'setExpiry',
					message: 'Set expiration date?',
					default: false,
				},
			]);

			if (setExpiry) {
				const { expiryDate } = await inquirer.prompt([
					{
						type: 'input',
						name: 'expiryDate',
						message: 'Expiration date (YYYY-MM-DD):',
						validate: (input: string) => {
							const date = new Date(input);
							if (isNaN(date.getTime())) return 'Enter a valid date (YYYY-MM-DD)';
							if (date <= new Date()) return 'Date must be in the future';
							return true;
						},
					},
				]);
				expiresAt = new Date(expiryDate);
			}
		}

		// Optional: notes
		let notes = options.notes;
		if (!notes) {
			const { grantNotes } = await inquirer.prompt([
				{
					type: 'input',
					name: 'grantNotes',
					message: 'Internal notes (optional):',
					default: '',
				},
			]);
			notes = grantNotes || undefined;
		}

		// Confirm creation
		Logger.blank();
		Logger.log('Access Grant Summary:');
		Logger.log(`  Type: ${grantType}`);
		Logger.log(`  Value: ${grantValue}`);
		if (maxInstalls) Logger.log(`  Max Installs: ${maxInstalls}`);
		if (expiresAt) Logger.log(`  Expires: ${expiresAt.toISOString().split('T')[0]}`);
		if (notes) Logger.log(`  Notes: ${notes}`);
		Logger.blank();

		const { confirm } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'confirm',
				message: 'Create this access grant?',
				default: true,
			},
		]);

		if (!confirm) {
			Logger.log('Cancelled.');
			return;
		}

		// Create the grant
		const spinner = Logger.spinner('Creating access grant...');

		try {
			const grant = await client.createAccessGrant({
				integrationId: targetWorkflowId!,
				grantType: grantType as 'user' | 'email_domain' | 'access_code',
				grantValue: grantValue!,
				maxInstalls,
				expiresAt,
				notes,
			});

			spinner.succeed('Access grant created!');
			Logger.blank();

			displayAccessGrant(grant);

			// Show usage instructions based on grant type
			Logger.blank();
			Logger.log('Next steps:');
			if (grantType === 'email_domain') {
				Logger.log(`  Users with @${grantValue} emails will see this workflow in their dashboard.`);
			} else if (grantType === 'user') {
				Logger.log(`  ${grantValue} will see this workflow in their dashboard after logging in.`);
			} else if (grantType === 'access_code') {
				Logger.log(`  Share this code with users: ${grantValue}`);
				Logger.log(`  They can install at: workway.co/install?code=${grantValue}`);
			}
		} catch (error: any) {
			spinner.fail('Failed to create access grant');
			Logger.error(error.message);
			process.exit(1);
		}
	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Revoke access grant
 */
export async function workflowAccessGrantRevokeCommand(
	grantId?: string,
	options: { workflowId?: string } = {}
): Promise<void> {
	try {
		Logger.header('Revoke Access Grant');

		const { apiClient: client } = await createAuthenticatedClient({
			errorMessage: 'Not logged in',
			hint: 'Login with: workway login',
		});

		let targetGrantId = grantId;

		if (!targetGrantId) {
			// Need to select a workflow first, then a grant
			const spinner = Logger.spinner('Loading your workflows...');
			const workflows = await client.listDeveloperWorkflows();
			spinner.stop();

			if (workflows.length === 0) {
				Logger.warn('No workflows found.');
				return;
			}

			const { selectedWorkflow } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedWorkflow',
					message: 'Select workflow:',
					choices: workflows.map((w) => ({
						name: `${w.name} (${w.visibility || 'public'})`,
						value: w.id,
					})),
				},
			]);

			// Load grants for this workflow
			const grantsSpinner = Logger.spinner('Loading access grants...');
			const grants = await client.listAccessGrants(selectedWorkflow);
			grantsSpinner.stop();

			if (grants.length === 0) {
				Logger.log('No access grants to revoke.');
				return;
			}

			const activeGrants = grants.filter((g) => !g.revokedAt);
			if (activeGrants.length === 0) {
				Logger.log('All grants have already been revoked.');
				return;
			}

			const { selectedGrant } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedGrant',
					message: 'Select grant to revoke:',
					choices: activeGrants.map((g) => ({
						name: `${g.grantType}: ${g.grantValue} (created ${new Date(g.createdAt).toLocaleDateString()})`,
						value: g.id,
					})),
				},
			]);

			targetGrantId = selectedGrant;
		}

		// Confirm revocation
		const { confirm } = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'confirm',
				message: 'Revoke this access grant? Users will lose access.',
				default: false,
			},
		]);

		if (!confirm) {
			Logger.log('Cancelled.');
			return;
		}

		const spinner = Logger.spinner('Revoking access grant...');

		try {
			await client.revokeAccessGrant(targetGrantId!);
			spinner.succeed('Access grant revoked.');
			Logger.log('Affected users will no longer see this workflow in their dashboard.');
		} catch (error: any) {
			spinner.fail('Failed to revoke access grant');
			Logger.error(error.message);
			process.exit(1);
		}
	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Display a single access grant
 */
function displayAccessGrant(grant: WorkflowAccessGrant): void {
	const statusIcon = grant.revokedAt ? '✗' : '✓';
	const statusColor = grant.revokedAt ? 'red' : 'green';

	Logger.log(`${statusIcon} ${grant.grantType.toUpperCase()}: ${grant.grantValue}`);
	Logger.log(`   ID: ${grant.id}`);
	Logger.log(`   Created: ${new Date(grant.createdAt).toLocaleDateString()}`);

	if (grant.maxInstalls) {
		Logger.log(`   Max Installs: ${grant.maxInstalls}`);
	}

	if (grant.expiresAt) {
		const expires = new Date(grant.expiresAt);
		const isExpired = expires < new Date();
		Logger.log(`   Expires: ${expires.toLocaleDateString()}${isExpired ? ' (EXPIRED)' : ''}`);
	}

	if (grant.notes) {
		Logger.log(`   Notes: ${grant.notes}`);
	}

	if (grant.revokedAt) {
		Logger.log(`   Revoked: ${new Date(grant.revokedAt).toLocaleDateString()}`);
	}

	Logger.blank();
}

/**
 * Generate a random access code
 */
function generateAccessCode(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0/O, 1/I
	let code = '';
	for (let i = 0; i < 8; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return code;
}
