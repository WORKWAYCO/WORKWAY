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

interface PublishOptions {
	draft?: boolean;
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
		Logger.section('Workflow Configuration');
		Logger.log('Let\'s configure your workflow pricing and details.');
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
					{ name: 'Monthly subscription', value: 'subscription' },
				],
				default: 'subscription',
			},
		]);

		// If not free, ask for upfront price
		let upfrontPrice = 0;
		if (answers.pricingModel !== 'free') {
			const priceAnswer = await inquirer.prompt([
				{
					type: 'number',
					name: 'price',
					message: `${answers.pricingModel === 'subscription' ? 'Monthly' : 'One-time'} price (USD):`,
					default: answers.pricingModel === 'subscription' ? 9 : 49,
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
		Logger.listItem('Light: 5¢ per execution (simple workflows, 1-3 API calls, <5s)');
		Logger.listItem('Heavy: 25¢ per execution (AI processing, 4+ API calls, complex logic)');
		Logger.blank();

		const complexityAnswer = await inquirer.prompt([
			{
				type: 'list',
				name: 'complexityTier',
				message: 'Complexity tier:',
				choices: [
					{
						name: 'Light (5¢/run after trial) - Simple integrations, data syncs',
						value: 'light',
					},
					{
						name: 'Heavy (25¢/run after trial) - AI-powered, multi-step automations',
						value: 'heavy',
					},
				],
				default: 'light',
			},
		]);

		// Confirm pricing details
		const usagePricePerRun = complexityAnswer.complexityTier === 'heavy' ? 25 : 5;

		Logger.blank();
		Logger.section('Pricing Summary');
		if (upfrontPrice > 0) {
			Logger.listItem(
				`Upfront: $${(upfrontPrice / 100).toFixed(2)}${answers.pricingModel === 'subscription' ? '/month' : ' one-time'}`
			);
		} else {
			Logger.listItem('Upfront: Free');
		}
		Logger.listItem('Trial: 20 free executions');
		Logger.listItem(`After trial: ${usagePricePerRun}¢ per execution`);
		Logger.blank();

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
				spinner.succeed('Workflow published successfully!');
				Logger.blank();
				Logger.success(`Workflow "${answers.name}" is now in the marketplace`);
				Logger.blank();

				if (options.draft) {
					Logger.info('📝 Published as draft (not visible to public)');
					Logger.log('');
					Logger.log('To make it public, run:');
					Logger.code(`workway workflow publish --id ${response.integration.id}`);
				} else {
					Logger.info('🎉 Your workflow is now live!');
					Logger.log('');
					Logger.log('View in marketplace:');
					Logger.code(`https://marketplace.workway.dev/workflow/${response.integration.id}`);
				}

				Logger.blank();
				Logger.section('Next Steps');
				Logger.listItem('Monitor your workflow analytics');
				Logger.listItem('Respond to user reviews');
				Logger.listItem('Update pricing or features as needed');
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
