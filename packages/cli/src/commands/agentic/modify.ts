/**
 * Agentic Modify Command
 *
 * Modify workflows using natural language descriptions.
 * Zuhandenheit: Describe what you want changed, the code follows.
 *
 * @example
 * ```bash
 * workway modify workflow.ts "Add email fallback for non-Slack users"
 * workway modify workflow.ts "Change trigger to daily schedule"
 * ```
 */

import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger.js';

/**
 * Common modification patterns
 */
const MODIFICATION_PATTERNS: Record<string, (code: string, args: string[]) => string | null> = {
	// Add integration
	'add\\s+(slack|notion|linear|github|gmail|stripe|zoom|sheets|airtable)': (code, args) => {
		const integration = args[1];
		const integrationLine = `    { service: '${integration}', scopes: ['read', 'write'] },`;

		// Find integrations array and add
		if (code.includes(`service: '${integration}'`)) {
			return null; // Already has this integration
		}

		return code.replace(
			/(integrations:\s*\[)/,
			`$1\n${integrationLine}`
		);
	},

	// Change trigger to schedule
	'change.*trigger.*(?:to\\s+)?(daily|hourly|weekly)': (code, args) => {
		const frequency = args[1];
		const cronMap: Record<string, string> = {
			daily: '0 9 * * *',
			hourly: '0 * * * *',
			weekly: '0 9 * * 1',
		};

		// Replace trigger
		let modified = code.replace(
			/trigger:\s*(?:webhook\([^)]+\)|manual\(\)|schedule\([^)]+\))/,
			`trigger: schedule('${cronMap[frequency]}')`
		);

		// Update import
		if (!modified.includes('schedule')) {
			modified = modified.replace(
				/from\s+['"]@workway\/sdk['"]/,
				"from '@workway/sdk'"
			);
			modified = modified.replace(
				/import\s*\{([^}]+)\}\s*from\s*['"]@workway\/sdk['"]/,
				(match, imports) => {
					if (!imports.includes('schedule')) {
						return `import { ${imports.trim()}, schedule } from '@workway/sdk'`;
					}
					return match;
				}
			);
		}

		return modified;
	},

	// Change trigger to webhook
	'change.*trigger.*(?:to\\s+)?webhook': (code, _args) => {
		return code.replace(
			/trigger:\s*(?:webhook\([^)]+\)|manual\(\)|schedule\([^)]+\))/,
			`trigger: webhook({ service: 'SERVICE', event: 'EVENT' })`
		);
	},

	// Change trigger to manual
	'change.*trigger.*(?:to\\s+)?manual': (code, _args) => {
		return code.replace(
			/trigger:\s*(?:webhook\([^)]+\)|manual\(\)|schedule\([^)]+\))/,
			'trigger: manual()'
		);
	},

	// Add Slack notification
	'add.*slack.*notif': (code, _args) => {
		// Check if slack integration exists
		if (!code.includes("service: 'slack'")) {
			code = code.replace(
				/(integrations:\s*\[)/,
				`$1\n    { service: 'slack', scopes: ['send_messages'] },`
			);
		}

		// Add slack input if not exists
		if (!code.includes('slackChannel')) {
			code = code.replace(
				/(inputs:\s*\{)/,
				`$1\n    slackChannel: {\n      type: 'slack_channel_picker',\n      label: 'Notification Channel',\n      required: true\n    },`
			);
		}

		// Add notification before return
		const slackCode = `
    // Send notification
    await integrations.slack.sendMessage({
      channel: inputs.slackChannel,
      text: \`Workflow completed successfully\`
    });
`;

		code = code.replace(
			/(return\s*\{[\s\S]*?success:\s*true)/,
			`${slackCode}\n$1`
		);

		return code;
	},

	// Add error handling
	'add.*error.*handl': (code, _args) => {
		if (code.includes('onError:')) {
			return null; // Already has error handling
		}

		// Add onError handler before closing brace
		const errorHandler = `
  onError: async ({ error, integrations, inputs }) => {
    console.error('Workflow error:', error.message);

    // Notify via Slack if available
    if (integrations.slack) {
      await integrations.slack.sendMessage({
        channel: inputs.slackChannel || inputs.errorChannel,
        text: \`Workflow error: \${error.message}\`
      });
    }
  }
`;

		// Find the last closing of execute function and add onError after it
		return code.replace(
			/(}\s*,?\s*)(}\s*\)\s*;?\s*$)/,
			`$1,${errorHandler}$2`
		);
	},

	// Add AI synthesis
	'add.*ai.*(?:synthesis|analysis)': (code, _args) => {
		// Ensure AI import
		if (!code.includes('createAIClient')) {
			code = code.replace(
				/(import\s*\{[^}]+\}\s*from\s*['"]@workway\/sdk['"];?)/,
				`$1\nimport { createAIClient } from '@workway/sdk/workers-ai';`
			);
		}

		// Add AI client if not exists
		if (!code.includes('createAIClient(env)')) {
			code = code.replace(
				/(async execute\([^)]+\)\s*\{)/,
				`$1\n    const ai = createAIClient(env).for('synthesis', 'standard');`
			);
		}

		return code;
	},

	// Add Linear task creation
	'add.*linear.*task': (code, _args) => {
		// Check if linear integration exists
		if (!code.includes("service: 'linear'")) {
			code = code.replace(
				/(integrations:\s*\[)/,
				`$1\n    { service: 'linear', scopes: ['write_issues'] },`
			);
		}

		// Add linear input if not exists
		if (!code.includes('linearTeamId')) {
			code = code.replace(
				/(inputs:\s*\{)/,
				`$1\n    linearTeamId: {\n      type: 'linear_team_picker',\n      label: 'Linear Team',\n      required: true\n    },`
			);
		}

		return code;
	},
};

/**
 * Apply modification to workflow code
 */
function applyModification(code: string, request: string): { modified: string; applied: string } | null {
	const lowerRequest = request.toLowerCase();

	for (const [pattern, modifier] of Object.entries(MODIFICATION_PATTERNS)) {
		const regex = new RegExp(pattern, 'i');
		const match = lowerRequest.match(regex);

		if (match) {
			const result = modifier(code, Array.from(match));
			if (result && result !== code) {
				return {
					modified: result,
					applied: pattern.replace(/\\s\+/g, ' ').replace(/[\\()?\[\]]/g, ''),
				};
			}
		}
	}

	return null;
}

/**
 * Modify workflow command
 */
export async function modifyCommand(filePath?: string, request?: string): Promise<void> {
	Logger.header('Modify Workflow');
	Logger.blank();

	// Get file path
	let targetPath = filePath;
	if (!targetPath) {
		const pathAnswer = await inquirer.prompt([
			{
				type: 'input',
				name: 'path',
				message: 'Workflow file path:',
				default: 'workflow.ts',
			},
		]);
		targetPath = pathAnswer.path;
	}

	// Read file
	const fullPath = path.resolve(targetPath!);
	let code: string;

	try {
		code = await fs.readFile(fullPath, 'utf-8');
	} catch (error) {
		Logger.error(`Cannot read file: ${fullPath}`);
		process.exit(1);
	}

	// Get modification request
	let modRequest = request;
	if (!modRequest) {
		Logger.info('Describe what you want to change:');
		Logger.log('');
		Logger.log('Examples:');
		Logger.log('  - "Add Slack notification"');
		Logger.log('  - "Change trigger to daily schedule"');
		Logger.log('  - "Add Linear task creation"');
		Logger.log('  - "Add error handling"');
		Logger.blank();

		const requestAnswer = await inquirer.prompt([
			{
				type: 'input',
				name: 'request',
				message: 'Modification:',
				validate: (input: string) => input.length > 5 || 'Please provide more detail',
			},
		]);
		modRequest = requestAnswer.request;
	}

	// Apply modification
	const spinner = Logger.spinner('Analyzing modification request...');

	const result = applyModification(code, modRequest!);

	if (!result) {
		spinner.fail('Could not apply modification');
		Logger.blank();
		Logger.warn('I could not automatically apply this modification.');
		Logger.log('');
		Logger.log('Try being more specific, or manually edit the file.');
		Logger.log('');
		Logger.log('Supported modifications:');
		Logger.log('  - Add integration (slack, notion, linear, github, gmail, etc.)');
		Logger.log('  - Change trigger to daily/hourly/weekly schedule');
		Logger.log('  - Change trigger to webhook or manual');
		Logger.log('  - Add Slack notification');
		Logger.log('  - Add error handling');
		Logger.log('  - Add AI synthesis');
		Logger.log('  - Add Linear task creation');
		process.exit(1);
	}

	spinner.succeed('Modification analyzed');
	Logger.blank();

	// Show diff preview
	Logger.info('Changes to be applied:');
	Logger.log(`  Pattern matched: ${result.applied}`);
	Logger.blank();

	// Confirm
	const confirmAnswer = await inquirer.prompt([
		{
			type: 'confirm',
			name: 'confirm',
			message: 'Apply these changes?',
			default: true,
		},
	]);

	if (!confirmAnswer.confirm) {
		Logger.warn('Modification cancelled');
		return;
	}

	// Create backup
	const backupPath = `${fullPath}.backup`;
	await fs.writeFile(backupPath, code, 'utf-8');

	// Write modified file
	await fs.writeFile(fullPath, result.modified, 'utf-8');

	Logger.blank();
	Logger.success(`Modified: ${fullPath}`);
	Logger.info(`Backup saved: ${backupPath}`);
	Logger.blank();
	Logger.log('Run `workway diff` to review changes (vs backup)');
	Logger.log('Run `workway workflow validate` to check for errors');
}

export default modifyCommand;
