/**
 * Workflow Fork Command
 *
 * Fork a workflow from the marketplace to customize.
 * Zuhandenheit: Continuation of understanding, not duplication.
 *
 * @example
 * ```bash
 * workway workflow fork meeting-intelligence
 * workway workflow fork meeting-intelligence --name "sales-analyzer"
 * ```
 */

import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger.js';

/**
 * Mock workflow data (replace with API calls in production)
 */
interface MarketplaceWorkflow {
	id: string;
	name: string;
	description: string;
	developer: {
		id: string;
		name: string;
	};
	activeInstalls: number;
	rating: number;
	reviewCount: number;
	code: string;
	lineage?: {
		originalId: string | null;
		originalName: string | null;
		parentId: string | null;
		parentName: string | null;
		forkDepth: number;
	};
	allowForks: boolean;
}

/**
 * Fork revenue split - matches platform constants
 * Platform takes 20%, remaining 80% is split between creators
 */
const FORK_REVENUE = {
	forkCreator: 68,     // Fork creator keeps 68%
	originalCreator: 12, // Original creator gets 12%
	platform: 20,        // Platform takes 20%
} as const;

/**
 * Calculate revenue attribution for fork depth
 * Simplified: Single-level attribution matching platform
 */
function calculateAttribution(_depth: number): { ancestors: number; creator: number } {
	// Platform split: 68% fork creator, 12% original, 20% platform
	return { ancestors: FORK_REVENUE.originalCreator, creator: FORK_REVENUE.forkCreator };
}

/**
 * Format attribution display
 * Uses platform-standard 68/12/20 split
 */
function formatAttribution(
	workflow: MarketplaceWorkflow,
	_newDepth: number
): { lines: string[]; breakdown: { name: string; percent: number }[] } {
	const breakdown: { name: string; percent: number }[] = [];
	const lines: string[] = [];

	// Platform-standard split: 68% fork creator, 12% original, 20% platform
	breakdown.push({ name: 'You (fork creator)', percent: FORK_REVENUE.forkCreator });
	breakdown.push({ name: workflow.developer.name, percent: FORK_REVENUE.originalCreator });
	breakdown.push({ name: 'Platform', percent: FORK_REVENUE.platform });

	lines.push(`  You: ${FORK_REVENUE.forkCreator}%`);
	lines.push(`  ${workflow.developer.name}: ${FORK_REVENUE.originalCreator}%`);
	lines.push(`  Platform: ${FORK_REVENUE.platform}%`);

	return { lines, breakdown };
}

/**
 * Generate forked workflow code with attribution header
 */
function generateForkedCode(
	originalCode: string,
	originalWorkflow: MarketplaceWorkflow,
	newName: string,
	reason: string
): string {
	// Add fork attribution header
	const header = `/**
 * ${newName}
 *
 * Forked from: ${originalWorkflow.name}
 * Original by: ${originalWorkflow.developer.name}
 * Fork reason: ${reason || 'Customization'}
 *
 * Attribution: Revenue shared with original creator per WORKWAY lineage policy.
 */

`;

	// Update workflow name in code
	let code = originalCode;

	// Replace name
	code = code.replace(/name:\s*['"`]([^'"`]+)['"`]/, `name: '${newName}'`);

	// Add forked metadata if defineWorkflow exists
	if (code.includes('defineWorkflow(')) {
		// Add forkedFrom metadata
		code = code.replace(
			/(defineWorkflow\(\{)/,
			`$1\n  // Fork metadata\n  forkedFrom: '${originalWorkflow.id}',`
		);
	}

	return header + code;
}

/**
 * Fork workflow command
 */
export async function workflowForkCommand(workflowIdentifier?: string): Promise<void> {
	Logger.header('Fork Workflow');
	Logger.blank();

	// Get workflow to fork
	let targetId = workflowIdentifier;
	if (!targetId) {
		Logger.info('Fork a workflow from the marketplace to customize it.');
		Logger.log('');
		Logger.log('You can search by:');
		Logger.log('  - Workflow name (e.g., "meeting-intelligence")');
		Logger.log('  - Workflow ID (e.g., "wf_abc123")');
		Logger.log('  - Developer/workflow (e.g., "alexchen/meeting-intelligence")');
		Logger.blank();

		const answer = await inquirer.prompt([
			{
				type: 'input',
				name: 'workflow',
				message: 'Workflow to fork:',
				validate: (input: string) => input.length > 0 || 'Please enter a workflow name or ID',
			},
		]);
		targetId = answer.workflow;
	}

	// Fetch workflow details (mock for now)
	const spinner = Logger.spinner('Fetching workflow from marketplace...');

	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 800));

	// Mock workflow data - in production this would call the API
	const workflow: MarketplaceWorkflow = {
		id: 'wf_' + targetId?.replace(/[^a-z0-9]/gi, '').substring(0, 8),
		name: targetId?.includes('/') ? targetId.split('/')[1] : targetId || 'Unknown',
		description: 'A workflow from the WORKWAY marketplace',
		developer: {
			id: 'dev_example',
			name: targetId?.includes('/') ? targetId.split('/')[0] : 'WORKWAY Developer',
		},
		activeInstalls: Math.floor(Math.random() * 500) + 50,
		rating: 4.0 + Math.random(),
		reviewCount: Math.floor(Math.random() * 100) + 10,
		code: `import { defineWorkflow, webhook } from '@workway/sdk';
import { createAIClient } from '@workway/sdk/workers-ai';

export default defineWorkflow({
  name: '${targetId || 'Workflow'}',
  description: 'Description here',
  version: '1.0.0',

  integrations: [
    { service: 'slack', scopes: ['send_messages'] },
    { service: 'notion', scopes: ['write_pages'] },
  ],

  trigger: webhook({ service: 'custom', event: 'trigger' }),

  inputs: {
    notificationChannel: {
      type: 'slack_channel_picker',
      label: 'Notification Channel',
      required: true,
    },
  },

  async execute({ trigger, inputs, integrations, env }) {
    const ai = createAIClient(env).for('synthesis', 'standard');

    // Your workflow logic here

    return { success: true };
  },
});
`,
		lineage: undefined,
		allowForks: true,
	};

	spinner.succeed(`Found: ${workflow.name}`);
	Logger.blank();

	// Check if forking is allowed
	if (!workflow.allowForks) {
		Logger.error('This workflow does not allow forking.');
		Logger.log('');
		Logger.log('The developer has disabled forks for this workflow.');
		Logger.log('Contact the developer if you need a customized version.');
		process.exit(1);
	}

	// Show workflow info
	Logger.info('Original Workflow:');
	Logger.log(`  Name: ${workflow.name}`);
	Logger.log(`  Developer: ${workflow.developer.name}`);
	Logger.log(`  Installations: ${workflow.activeInstalls.toLocaleString()}`);
	Logger.log(`  Rating: ${workflow.rating.toFixed(1)} (${workflow.reviewCount} reviews)`);

	// Check if already forked
	const currentDepth = workflow.lineage?.forkDepth || 0;
	const newDepth = currentDepth + 1;

	if (currentDepth > 0) {
		Logger.blank();
		Logger.warn('Note: This is already a fork');
		Logger.log(`  Original: ${workflow.lineage?.originalName || 'Unknown'}`);
		Logger.log(`  Fork depth: ${currentDepth} -> ${newDepth}`);
	}
	Logger.blank();

	// Get fork options
	const options = await inquirer.prompt([
		{
			type: 'input',
			name: 'name',
			message: 'Name for your fork:',
			default: `${workflow.name}-custom`,
			validate: (input: string) => {
				if (input.length < 3) return 'Name must be at least 3 characters';
				if (!/^[a-z0-9-]+$/i.test(input)) return 'Name can only contain letters, numbers, and hyphens';
				return true;
			},
		},
		{
			type: 'input',
			name: 'reason',
			message: 'Why are you forking? (helps the community):',
			default: '',
		},
		{
			type: 'list',
			name: 'visibility',
			message: 'Initial visibility:',
			choices: [
				{ name: 'Private - Only you can see/use', value: 'private' },
				{ name: 'Unlisted - Anyone with link can use', value: 'unlisted' },
				{ name: 'Public - Listed in marketplace', value: 'public' },
			],
			default: 'private',
		},
	]);

	// Show attribution info
	Logger.blank();
	Logger.info('Revenue Attribution:');
	const attribution = formatAttribution(workflow, newDepth);
	for (const line of attribution.lines) {
		Logger.log(line);
	}
	Logger.blank();

	Logger.log('  (Attribution is automatic and cannot be removed)');
	Logger.blank();

	// Confirm
	const confirm = await inquirer.prompt([
		{
			type: 'confirm',
			name: 'proceed',
			message: 'Create this fork?',
			default: true,
		},
	]);

	if (!confirm.proceed) {
		Logger.warn('Fork cancelled');
		return;
	}

	// Create fork locally
	const createSpinner = Logger.spinner('Creating fork...');

	// Generate forked code
	const forkedCode = generateForkedCode(workflow.code, workflow, options.name, options.reason);

	// Determine output directory
	const outputDir = path.resolve(options.name);

	try {
		// Create directory
		await fs.mkdir(outputDir, { recursive: true });

		// Write workflow file
		await fs.writeFile(path.join(outputDir, 'workflow.ts'), forkedCode, 'utf-8');

		// Create package.json
		const packageJson = {
			name: options.name,
			version: '1.0.0',
			description: `Forked from ${workflow.name} by ${workflow.developer.name}`,
			type: 'module',
			main: 'workflow.ts',
			scripts: {
				dev: 'workway workflow dev',
				test: 'workway workflow test',
				build: 'workway workflow build',
				publish: 'workway workflow publish',
			},
			dependencies: {
				'@workway/sdk': '^0.3.0',
			},
			workway: {
				forkedFrom: workflow.id,
				originalDeveloper: workflow.developer.name,
				forkDepth: newDepth,
				visibility: options.visibility,
			},
		};

		await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');

		// Create .workwayrc
		const workwayrc = {
			name: options.name,
			forkedFrom: workflow.id,
			visibility: options.visibility,
			attribution: attribution.breakdown,
		};

		await fs.writeFile(path.join(outputDir, '.workwayrc'), JSON.stringify(workwayrc, null, 2), 'utf-8');

		createSpinner.succeed('Fork created!');
	} catch (error: any) {
		createSpinner.fail('Failed to create fork');
		Logger.error(error.message);
		process.exit(1);
	}

	Logger.blank();
	Logger.success(`Forked to: ./${options.name}/`);
	Logger.blank();

	// Show next steps
	Logger.info('Files created:');
	Logger.log(`  ./${options.name}/workflow.ts    - Your workflow code`);
	Logger.log(`  ./${options.name}/package.json   - Project manifest`);
	Logger.log(`  ./${options.name}/.workwayrc     - Fork metadata`);
	Logger.blank();

	Logger.info('Next steps:');
	Logger.log(`  1. cd ${options.name}`);
	Logger.log(`  2. Edit workflow.ts to customize`);
	Logger.log(`  3. Run \`workway workflow test\` to verify`);
	Logger.log(`  4. Run \`workway workflow publish\` when ready`);
	Logger.blank();

	if (options.reason) {
		Logger.log(`Fork reason recorded: "${options.reason}"`);
		Logger.log('This helps the community understand your customization.');
	}
}

export default workflowForkCommand;
