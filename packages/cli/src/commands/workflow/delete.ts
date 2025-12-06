/**
 * Workflow Delete Command
 *
 * Permanently deletes an inactive/uninstalled workflow.
 * Performs final cleanup including stored data, webhooks, and configurations.
 *
 * Heideggerian note: Deletion is the ultimate tool recession.
 * The workflow disappears entirely from the user's world.
 *
 * @example
 * ```bash
 * # Delete a workflow by ID
 * workway workflow delete meeting-intelligence
 *
 * # Delete with force (skip confirmation)
 * workway workflow delete meeting-intelligence --force
 *
 * # Delete from a specific path
 * workway workflow delete --path ./workflows/meeting-intelligence
 * ```
 */

import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { WorkflowRuntime, loadWorkflow } from '../../lib/workflow-runtime.js';
import { loadProjectConfig } from '../../lib/config.js';

interface DeleteOptions {
	force?: boolean;
	path?: string;
	keepData?: boolean;
}

/**
 * SECURITY: Validate that a path is within the allowed directory
 * Prevents path traversal attacks (e.g., --path ../../../etc/passwd)
 */
function isPathWithinDirectory(filePath: string, allowedDir: string): boolean {
	const resolvedPath = path.resolve(filePath);
	const resolvedAllowedDir = path.resolve(allowedDir);

	// Normalize paths and check if the file path starts with the allowed directory
	return resolvedPath.startsWith(resolvedAllowedDir + path.sep) ||
		resolvedPath === resolvedAllowedDir;
}

/**
 * SECURITY: Validate that a file is a valid workflow file
 */
function isValidWorkflowFile(filePath: string): boolean {
	const ext = path.extname(filePath).toLowerCase();
	const validExtensions = ['.ts', '.js', '.mts', '.mjs'];

	if (!validExtensions.includes(ext)) {
		return false;
	}

	// Additional safety: ensure filename contains 'workflow' or is in a workflows directory
	const basename = path.basename(filePath, ext);
	const dirname = path.dirname(filePath);

	return basename.includes('workflow') ||
		dirname.includes('workflow') ||
		basename === 'index';
}

export async function workflowDeleteCommand(
	workflowId?: string,
	options: DeleteOptions = {}
): Promise<void> {
	try {
		Logger.header('Delete Workflow');

		// Determine workflow path
		let workflowPath: string;
		const cwd = process.cwd();

		if (options.path) {
			workflowPath = path.resolve(cwd, options.path);

			// SECURITY: Validate path is within current working directory
			if (!isPathWithinDirectory(workflowPath, cwd)) {
				Logger.error('Security error: Path must be within the current working directory');
				Logger.log('');
				Logger.log('The specified path attempts to access files outside the project.');
				Logger.log('This is not allowed for security reasons.');
				process.exit(1);
			}

			// SECURITY: Validate this looks like a workflow file
			if (!isValidWorkflowFile(workflowPath)) {
				Logger.error('Security error: File does not appear to be a workflow file');
				Logger.log('');
				Logger.log('Valid workflow files must:');
				Logger.log('  - Have a .ts, .js, .mts, or .mjs extension');
				Logger.log('  - Be named workflow.* or be in a workflows directory');
				process.exit(1);
			}
		} else if (workflowId) {
			// Try to find workflow by ID in common locations
			const possiblePaths = [
				path.join(process.cwd(), 'workflow.ts'),
				path.join(process.cwd(), 'src', 'workflow.ts'),
				path.join(process.cwd(), workflowId, 'workflow.ts'),
				path.join(process.cwd(), 'workflows', workflowId, 'workflow.ts'),
			];

			workflowPath = possiblePaths.find((p) => fs.existsSync(p)) || '';

			if (!workflowPath) {
				Logger.error(`Could not find workflow: ${workflowId}`);
				Logger.log('');
				Logger.log('Try specifying the path directly:');
				Logger.log(`  workway workflow delete --path ./path/to/workflow.ts`);
				process.exit(1);
			}
		} else {
			// Default to current directory
			workflowPath = path.join(process.cwd(), 'workflow.ts');
		}

		// Check if workflow exists
		if (!await fs.pathExists(workflowPath)) {
			Logger.error(`Workflow file not found: ${workflowPath}`);
			process.exit(1);
		}

		// Load the workflow
		Logger.listItem(`Path: ${workflowPath}`);
		const spinner = Logger.spinner('Loading workflow...');

		let workflow;
		try {
			workflow = await loadWorkflow(workflowPath);
			spinner.succeed('Workflow loaded');
		} catch (error: any) {
			spinner.fail('Failed to load workflow');
			Logger.error(error.message);
			process.exit(1);
		}

		const workflowName = workflow.metadata?.name || workflow.metadata?.id || 'Unknown';
		const workflowIdResolved = workflow.metadata?.id || 'unknown';

		Logger.blank();
		Logger.section('Workflow Details');
		Logger.listItem(`Name: ${workflowName}`);
		Logger.listItem(`ID: ${workflowIdResolved}`);
		if (workflow.integrations?.length) {
			Logger.listItem(`Integrations: ${workflow.integrations.join(', ')}`);
		}
		Logger.blank();

		// Confirmation (unless --force)
		if (!options.force) {
			Logger.warn('This action is irreversible!');
			Logger.log('');
			Logger.log('Deleting this workflow will:');
			Logger.log('  - Remove all stored configuration');
			Logger.log('  - Clean up any webhooks or subscriptions');
			Logger.log('  - Delete execution history');
			if (!options.keepData) {
				Logger.log('  - Remove all stored data');
			}
			Logger.blank();

			const { confirm } = await inquirer.prompt([
				{
					type: 'confirm',
					name: 'confirm',
					message: `Are you sure you want to delete "${workflowName}"?`,
					default: false,
				},
			]);

			if (!confirm) {
				Logger.log('');
				Logger.log('Delete cancelled.');
				return;
			}
		}

		// Initialize runtime and perform deletion
		Logger.blank();
		const deleteSpinner = Logger.spinner('Deleting workflow...');

		const runtime = new WorkflowRuntime();
		await runtime.initialize();

		// Load existing config if available
		const projectConfig = await loadProjectConfig();
		const config = (projectConfig as any)?.config || {};

		try {
			const result = await runtime.delete(workflow, config, { force: options.force });

			if (!result.success) {
				deleteSpinner.fail('Delete failed');
				Logger.error(result.error || 'Unknown error during deletion');
				process.exit(1);
			}

			deleteSpinner.succeed('Workflow deleted');

			// Show cleanup summary
			if (result.cleanedUp && result.cleanedUp.length > 0) {
				Logger.blank();
				Logger.section('Cleanup Summary');
				for (const item of result.cleanedUp) {
					Logger.listItem(item);
				}
			}

			Logger.blank();
			Logger.success(`"${workflowName}" has been permanently deleted.`);

		} catch (error: any) {
			deleteSpinner.fail('Delete failed');
			Logger.error(error.message);
			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

export default workflowDeleteCommand;
