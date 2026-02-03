/**
 * Workflow Publish Command
 *
 * Publishes a workflow to the WORKWAY marketplace
 */

import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../../utils/logger.js';
import { createAuthenticatedClient } from '../../utils/auth-client.js';
import { WORKFLOW_CATEGORIES } from '../../constants.js';
import { validateWorkflowProject, getWorkflowPath } from '../../utils/workflow-validation.js';
import { DEFAULT_PRICING, formatCents, getPriceForTier, type ComplexityTier } from '../../pricing-constants.js';

interface PublishOptions {
	draft?: boolean;
	notes?: string;
}

export async function workflowPublishCommand(options: PublishOptions): Promise<void> {
	Logger.header('Publish Workflow to Marketplace');

	try {
		// Get authenticated client (DRY: shared utility)
		const { apiClient } = await createAuthenticatedClient({
			errorMessage: 'You must be logged in to publish workflows',
			hint: 'Run: workway login',
		});

		// Check for workway.config.json
		const configPath = path.join(process.cwd(), 'workway.config.json');
		if (!(await fs.pathExists(configPath))) {
			Logger.error('No workway.config.json found in current directory');
			Logger.log('');
			Logger.log('💡 Run "workway workflow init" to create a new workflow project');
			process.exit(1);
		}

		// Validate workflow project (DRY: shared utility)
		await validateWorkflowProject({
			createHint: '💡 Create a workflow.ts file with your workflow definition',
		});
		const workflowPath = getWorkflowPath();

		Logger.blank();
		Logger.section('Configuration');
		Logger.blank();

		// Get workflow details from user
		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'name',
				message: 'Workflow name:',
				validate: (input: string) => {
					if (!input || input.trim().length === 0) {
						return 'Workflow name is required';
					}
					if (input.length > 50) {
						return 'Workflow name must be 50 characters or less';
					}
					return true;
				},
			},
			{
				type: 'input',
				name: 'tagline',
				message: 'Short tagline (one-liner description):',
				validate: (input: string) => {
					if (input.length > 100) {
						return 'Tagline must be 100 characters or less';
					}
					return true;
				},
			},
			{
				type: 'input',
				name: 'description',
				message: 'Full description:',
				validate: (input: string) => {
					if (!input || input.trim().length === 0) {
						return 'Description is required';
					}
					if (input.length > 500) {
						return 'Description must be 500 characters or less';
					}
					return true;
				},
			},
			{
				type: 'list',
				name: 'category',
				message: 'Category:',
				choices: [...WORKFLOW_CATEGORIES],
				default: 'productivity',
			},
			{
				type: 'list',
				name: 'pricingModel',
				message: 'Pricing model:',
				choices: [
					{ name: 'Free (no upfront cost)', value: 'free' },
					{ name: 'One-time payment', value: 'one_time' },
				],
				default: 'one_time',
			},
		]);

		// If not free, ask for upfront price
		let upfrontPrice = 0;
		if (answers.pricingModel !== 'free') {
			const priceAnswer = await inquirer.prompt([
				{
					type: 'number',
					name: 'price',
					message: 'One-time price (USD):',
					default: 29,
					validate: (input: number) => {
						if (input < 1) {
							return 'Price must be at least $1';
						}
						if (input > 1000) {
							return 'Price must be $1000 or less';
						}
						return true;
					},
				},
			]);
			upfrontPrice = Math.round(priceAnswer.price * 100); // Convert to cents
		}

		Logger.blank();
		Logger.section('Workflow Complexity');
		Logger.log('Complexity tier determines usage pricing after trial:');
		Logger.listItem(`Light: ${formatCents(DEFAULT_PRICING.light)} per execution (simple workflows, 1-3 API calls, <5s)`);
		Logger.listItem(`Heavy: ${formatCents(DEFAULT_PRICING.heavy)} per execution (AI processing, 4+ API calls, complex logic)`);
		Logger.blank();

		const complexityAnswer = await inquirer.prompt([
			{
				type: 'list',
				name: 'complexityTier',
				message: 'Complexity tier:',
				choices: [
					{
						name: `Light (${formatCents(DEFAULT_PRICING.light)}/run after trial) - Simple integrations, data syncs`,
						value: 'light',
					},
					{
						name: `Heavy (${formatCents(DEFAULT_PRICING.heavy)}/run after trial) - AI-powered, multi-step automations`,
						value: 'heavy',
					},
				],
				default: 'light',
			},
		]);

		// Confirm pricing details
		const usagePricePerRun = getPriceForTier(complexityAnswer.complexityTier as ComplexityTier);

		Logger.blank();
		Logger.section('Pricing Summary');
		if (upfrontPrice > 0) {
			Logger.listItem(`Upfront: $${(upfrontPrice / 100).toFixed(2)} one-time`);
		} else {
			Logger.listItem('Upfront: Free');
		}
		Logger.listItem(`Trial: ${DEFAULT_PRICING.freeTrialRuns} free executions`);
		Logger.listItem(`After trial: ${formatCents(usagePricePerRun)} per execution`);
		Logger.blank();

		// Ask for version notes
		let versionNotes = options.notes || '';
		if (!versionNotes) {
			const notesAnswer = await inquirer.prompt([
				{
					type: 'input',
					name: 'notes',
					message: 'Version notes (optional, helps track changes):',
					default: '',
				},
			]);
			versionNotes = notesAnswer.notes;
		}

		const confirmAnswer = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'confirm',
				message: 'Publish workflow with these settings?',
				default: true,
			},
		]);

		if (!confirmAnswer.confirm) {
			Logger.warn('Publish cancelled');
			process.exit(0);
		}

		// Read workflow file
		const workflowContent = await fs.readFile(workflowPath, 'utf-8');

		// =====================================================================
		// DUPLICATE DETECTION CHECK
		// =====================================================================
		Logger.blank();
		const similaritySpinner = Logger.spinner('Checking for similar workflows...');

		try {
			const similarityResult = await apiClient.checkSimilarity({
				name: answers.name,
				description: answers.description,
				code: workflowContent,
			});

			if (similarityResult.action === 'block') {
				similaritySpinner.fail('Similar workflow detected');
				Logger.blank();
				Logger.error(similarityResult.message);
				Logger.blank();

				if (similarityResult.similarWorkflows.length > 0) {
					const similar = similarityResult.similarWorkflows[0];
					Logger.info('Most similar workflow:');
					Logger.log(`  ${similar.developerName}/${similar.name}`);
					Logger.log(`  ${similar.installCount.toLocaleString()} installs`);
					Logger.log(`  Similarity: ${Math.round(similar.overallSimilarity * 100)}%`);
					Logger.blank();

					if (similar.allowForks) {
						Logger.info('Consider forking instead:');
						Logger.code(`workway workflow fork ${similar.developerName}/${similar.name}`);
						Logger.blank();
						Logger.log('Forking gives attribution to the original creator and');
						Logger.log('shares revenue (68% you / 12% original / 20% platform).');
					}
				}
				process.exit(1);
			}

			if (similarityResult.action === 'suggest_fork') {
				similaritySpinner.warn('Similar workflows found');
				Logger.blank();
				Logger.warn(similarityResult.message);
				Logger.blank();

				// Show similar workflows
				for (const similar of similarityResult.similarWorkflows.slice(0, 3)) {
					Logger.log(`  ${similar.developerName}/${similar.name} (${Math.round(similar.overallSimilarity * 100)}% similar)`);
				}
				Logger.blank();

				const forkAnswer = await inquirer.prompt([
					{
						type: 'list',
						name: 'action',
						message: 'How would you like to proceed?',
						choices: [
							{
								name: `🔀 Fork "${similarityResult.similarWorkflows[0].name}" (recommended)`,
								value: 'fork',
							},
							{
								name: '📝 Continue publishing as original (I have a unique approach)',
								value: 'continue',
							},
							{
								name: '✕ Cancel',
								value: 'cancel',
							},
						],
					},
				]);

				if (forkAnswer.action === 'fork') {
					const similar = similarityResult.similarWorkflows[0];
					Logger.blank();
					Logger.info('To fork this workflow, run:');
					Logger.code(`workway workflow fork ${similar.developerName}/${similar.name}`);
					process.exit(0);
				}

				if (forkAnswer.action === 'cancel') {
					Logger.warn('Publish cancelled');
					process.exit(0);
				}

				// Continue with publish - user acknowledged similarity
				Logger.blank();
				Logger.info('Continuing with original publish...');
			} else if (similarityResult.action === 'review') {
				similaritySpinner.info('Some similar workflows exist');
				Logger.log(`  ${similarityResult.message}`);
			} else {
				similaritySpinner.succeed('No similar workflows found');
			}
		} catch (error: any) {
			// If similarity check fails, log warning but allow publish to continue
			similaritySpinner.warn('Could not check for similar workflows');
			Logger.log('  Continuing with publish...');
		}

		// Build pricing details
		const pricingDetails = {
			upfront_price: upfrontPrice,
			trial_executions: 20,
			usage_price_per_run: usagePricePerRun,
			pricing_model_type: answers.pricingModel,
		};

		// Prepare integration data
		const integrationData = {
			name: answers.name,
			tagline: answers.tagline,
			description: answers.description,
			category: answers.category,
			pricingModel: answers.pricingModel === 'free' ? 'free' : 'paid',
			basePrice: upfrontPrice,
			complexityTier: complexityAnswer.complexityTier,
			pricingDetails,
			workflowDefinition: {
				source: workflowContent,
				language: 'typescript',
			},
			status: options.draft ? 'draft' : 'published',
		};

		const spinner = Logger.spinner('Publishing workflow to marketplace...');

		try {
			// Check if user is a developer
			let profileResponse = null;
			try {
				profileResponse = await apiClient.getDeveloperProfile();
			} catch (error: any) {
				if (error.isNotFound?.()) {
					spinner.fail('You must be registered as a developer');
					Logger.blank();
					Logger.log('Run: workway developer register');
					process.exit(1);
				}
				throw error;
			}

			// Create/update integration
			const response = await apiClient.createIntegration(integrationData);

			if (response.success) {
				spinner.succeed('Workflow published');
				
				// Save integration ID to config for version tracking
				const existingConfig = await fs.readJson(configPath);
				existingConfig.integrationId = response.integration.id;
				await fs.writeJson(configPath, existingConfig, { spaces: 2 });
				
				Logger.blank();

				// Try to create a version record
				try {
					const versionResponse = await apiClient.postJson(`/integrations/${response.integration.id}/versions`, {
						body: {
							workflowDefinition: {
								source: workflowContent,
								language: 'typescript',
							},
							notes: versionNotes || 'Initial version',
						}
					}) as {
						success: boolean;
						version: { id: string; versionNumber: number };
					};
					
					if (versionResponse.success && versionResponse.version) {
						// Auto-publish the version
						await apiClient.postJson(
							`/integrations/${response.integration.id}/versions/${versionResponse.version.id}/publish`,
							{ body: { notes: versionNotes } }
						);
						Logger.log(`Version ${versionResponse.version.versionNumber} created`);
					}
				} catch (versionError) {
					// Version creation is optional - don't fail the publish
					// This happens if versioning API isn't deployed yet
				}

				if (options.draft) {
					Logger.log('Published as draft');
					Logger.log('');
					Logger.log('To make public:');
					Logger.log(`  workway workflow publish --id ${response.integration.id}`);
				} else {
					Logger.log(`View at: https://marketplace.workway.dev/workflow/${response.integration.id}`);
				}

				Logger.blank();
				Logger.log('Manage versions: workway workflow version');
			} else {
				spinner.fail('Failed to publish workflow');
				Logger.error(response.error || 'Unknown error');
				process.exit(1);
			}
		} catch (error: any) {
			spinner.fail('Failed to publish workflow');
			Logger.error(error.message);

			if (error.response?.data?.error) {
				Logger.log('');
				Logger.log('Error details:');
				Logger.error(error.response.data.error);
			}

			process.exit(1);
		}
	} catch (error: any) {
		if (error.isTtyError) {
			Logger.error('Prompt could not be rendered in the current environment');
		} else {
			Logger.error(error.message);
		}
		process.exit(1);
	}
}
