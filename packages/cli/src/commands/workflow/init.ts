/**
 * Workflow Init Command
 *
 * Creates a new workflow project with all necessary files.
 * Supports both integration workflows and AI-first workflows.
 */

import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../../utils/logger.js';
import {
	basicWorkflowTemplate,
	testDataTemplate,
	readmeTemplate,
	packageJsonTemplate,
	gitignoreTemplate,
	workwayConfigTemplate,
} from '../../templates/workflow/basic.js';
import {
	aiWorkflowTemplate,
	aiTestDataTemplate,
	aiReadmeTemplate,
	aiPackageJsonTemplate,
} from '../../templates/workflow/ai.js';

const CATEGORIES = [
	'productivity',
	'finance',
	'sales',
	'marketing',
	'customer-support',
	'hr',
	'operations',
	'development',
	'other',
];

interface InitOptions {
	ai?: boolean;
	name?: string;
}

export async function workflowInitCommand(nameArg?: string, options?: InitOptions): Promise<void> {
	const isAI = options?.ai || false;

	Logger.header(isAI ? 'Create AI Workflow' : 'Create New Workflow');

	if (isAI) {
		Logger.info('Using Cloudflare Workers AI (no external API keys required)');
		Logger.blank();
	}

	try {
		// Different prompts for AI vs integration workflows
		const prompts = isAI
			? [
					{
						type: 'input',
						name: 'name',
						message: 'Workflow name:',
						default: nameArg || 'AI Assistant',
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
						name: 'aiTask',
						message: 'What will this AI do?',
						default: 'Summarize and analyze text',
						validate: (input: string) => {
							if (!input || input.trim().length === 0) {
								return 'AI task description is required';
							}
							return true;
						},
					},
					{
						type: 'list',
						name: 'category',
						message: 'Category:',
						choices: CATEGORIES,
						default: 'productivity',
					},
					{
						type: 'number',
						name: 'price',
						message: 'Monthly price (USD):',
						default: 5,
						validate: (input: number) => {
							if (input < 0) return 'Price must be 0 or greater';
							if (input > 1000) return 'Price must be 1000 or less';
							return true;
						},
					},
				]
			: [
					{
						type: 'input',
						name: 'name',
						message: 'Workflow name:',
						default: nameArg || 'My Workflow',
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
						type: 'list',
						name: 'category',
						message: 'Category:',
						choices: CATEGORIES,
						default: 'productivity',
					},
					{
						type: 'input',
						name: 'description',
						message: 'Description (optional):',
						default: '',
					},
					{
						type: 'number',
						name: 'price',
						message: 'Monthly price (USD):',
						default: 8,
						validate: (input: number) => {
							if (input < 0) return 'Price must be 0 or greater';
							if (input > 1000) return 'Price must be 1000 or less';
							return true;
						},
					},
					{
						type: 'number',
						name: 'trialDays',
						message: 'Free trial days:',
						default: 7,
						validate: (input: number) => {
							if (input < 0) return 'Trial days must be 0 or greater';
							if (input > 365) return 'Trial days must be 365 or less';
							return true;
						},
					},
				];

		const answers = await inquirer.prompt(prompts);

		// Create project directory
		const projectName = answers.name.toLowerCase().replace(/\s+/g, '-');
		const projectPath = path.join(process.cwd(), projectName);

		// Check if directory already exists
		if (await fs.pathExists(projectPath)) {
			Logger.error(`Directory "${projectName}" already exists`);
			Logger.blank();
			Logger.log('Choose a different name or remove the existing directory');
			process.exit(1);
		}

		const spinner = Logger.spinner(`Creating ${isAI ? 'AI ' : ''}workflow project "${projectName}"...`);

		try {
			// Create directory
			await fs.ensureDir(projectPath);

			if (isAI) {
				// AI workflow files
				const workflowContent = aiWorkflowTemplate(
					answers.name,
					answers.category,
					answers.price,
					answers.aiTask
				);
				await fs.writeFile(path.join(projectPath, 'workflow.ts'), workflowContent);

				const testDataContent = aiTestDataTemplate();
				await fs.writeFile(path.join(projectPath, 'test-data.json'), testDataContent);

				const readmeContent = aiReadmeTemplate(answers.name);
				await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);

				const packageJsonContent = aiPackageJsonTemplate(answers.name);
				await fs.writeFile(path.join(projectPath, 'package.json'), packageJsonContent);
			} else {
				// Standard integration workflow files
				const workflowContent = basicWorkflowTemplate(answers.name, answers.category, answers.price);
				await fs.writeFile(path.join(projectPath, 'workflow.ts'), workflowContent);

				const testDataContent = testDataTemplate();
				await fs.writeFile(path.join(projectPath, 'test-data.json'), testDataContent);

				const readmeContent = readmeTemplate(answers.name);
				await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);

				const packageJsonContent = packageJsonTemplate(answers.name);
				await fs.writeFile(path.join(projectPath, 'package.json'), packageJsonContent);
			}

			// Common files
			const gitignoreContent = gitignoreTemplate();
			await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);

			const configContent = workwayConfigTemplate();
			await fs.writeFile(path.join(projectPath, 'workway.config.json'), configContent);

			spinner.succeed(`Created ${isAI ? 'AI ' : ''}workflow project "${projectName}"`);

			// Show success message
			Logger.blank();
			Logger.success('Workflow project created successfully!');
			Logger.blank();

			Logger.section('Project Details');
			Logger.listItem(`Name: ${answers.name}`);
			if (isAI) {
				Logger.listItem(`AI Task: ${answers.aiTask}`);
			}
			Logger.listItem(`Category: ${answers.category}`);
			Logger.listItem(`Price: $${answers.price}/month`);
			if (!isAI) {
				Logger.listItem(`Trial: ${answers.trialDays} days`);
			}
			Logger.listItem(`Location: ./${projectName}/`);

			Logger.blank();
			Logger.section('Next Steps');
			Logger.log('1. Navigate to your project:');
			Logger.code(`cd ${projectName}`);

			Logger.log('2. Install dependencies:');
			Logger.code('npm install');

			Logger.log('3. Edit workflow.ts to customize your workflow');
			Logger.blank();

			if (isAI) {
				Logger.log('4. Explore available AI models:');
				Logger.code('workway ai models');

				Logger.log('5. Test your AI workflow:');
				Logger.code('workway workflow test --mock');

				Logger.log('6. When ready, publish to marketplace:');
				Logger.code('workway workflow publish');

				Logger.blank();
				Logger.section('AI Cost Estimate');
				Logger.listItem('Llama 2 (fast): ~$0.005 per 1M tokens');
				Logger.listItem('Llama 3 (balanced): ~$0.01 per 1M tokens');
				Logger.listItem('Mistral (quality): ~$0.02 per 1M tokens');
			} else {
				Logger.log('4. Test your workflow:');
				Logger.code('npm test');

				Logger.log('5. When ready, publish to marketplace:');
				Logger.code('npm run publish');
			}

			Logger.blank();
			Logger.info('Documentation: https://docs.workway.dev/workflows');
		} catch (error: any) {
			spinner.fail('Failed to create project');
			Logger.error(error.message);

			// Clean up on failure
			try {
				await fs.remove(projectPath);
			} catch {}

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
