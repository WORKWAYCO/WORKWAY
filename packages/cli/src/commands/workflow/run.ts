/**
 * Workflow Run Command
 *
 * Executes a workflow locally with actual TypeScript execution
 * Different from 'test' - this runs the actual workflow code
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../utils/logger.js';
import { loadProjectConfig, loadOAuthTokens } from '../../lib/config.js';
import { validateWorkflowProject, getWorkflowPath } from '../../utils/workflow-validation.js';

interface RunOptions {
	input?: string;
	env?: string;
	verbose?: boolean;
	timeout?: number;
}

export async function workflowRunCommand(options: RunOptions): Promise<void> {
	try {
		Logger.header('Run Workflow');

		// Validate workflow project (DRY: shared utility)
		await validateWorkflowProject();
		const workflowPath = getWorkflowPath();

		// Load project config
		const projectConfig = await loadProjectConfig();
		const timeout = options.timeout || projectConfig?.test?.timeout || 30000;

		// Load input data if provided
		let inputData: any = {};
		if (options.input) {
			const inputPath = path.join(process.cwd(), options.input);
			if (await fs.pathExists(inputPath)) {
				inputData = await fs.readJson(inputPath);
				Logger.listItem(`Input: ${options.input}`);
			} else {
				Logger.warn(`Input file not found: ${options.input}`);
			}
		}

		// Load OAuth tokens for runtime
		const oauthTokens = await loadOAuthTokens();
		const hasOAuth = Object.keys(oauthTokens).length > 0;

		Logger.section('Execution Context');
		Logger.listItem(`Workflow: workflow.ts`);
		Logger.listItem(`Timeout: ${timeout}ms`);
		Logger.listItem(`OAuth: ${hasOAuth ? Object.keys(oauthTokens).join(', ') : 'None connected'}`);
		if (options.verbose) {
			Logger.listItem(`Verbose: enabled`);
		}
		Logger.blank();

		// Create a temporary runner script
		const runnerScript = `
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

// Dynamic import of the workflow
const workflowPath = '${workflowPath.replace(/\\/g, '\\\\')}';

async function run() {
	try {
		const workflow = await import(pathToFileURL(workflowPath).href);
		
		// Create mock context
		const context = {
			input: ${JSON.stringify(inputData)},
			oauth: ${JSON.stringify(oauthTokens)},
			env: ${JSON.stringify(options.env || 'development')},
			log: (msg) => console.log('[WORKFLOW]', msg),
			error: (msg) => console.error('[WORKFLOW ERROR]', msg),
		};

		// Check if workflow has a run function
		if (typeof workflow.default?.run === 'function') {
			const result = await workflow.default.run(context);
			console.log('[RESULT]', JSON.stringify(result, null, 2));
		} else if (typeof workflow.run === 'function') {
			const result = await workflow.run(context);
			console.log('[RESULT]', JSON.stringify(result, null, 2));
		} else {
			console.log('[INFO] Workflow loaded successfully');
			console.log('[INFO] Exported:', Object.keys(workflow));
		}
	} catch (error) {
		console.error('[ERROR]', error.message);
		if (${options.verbose || false}) {
			console.error(error.stack);
		}
		process.exit(1);
	}
}

run();
`;

		const runnerPath = path.join(process.cwd(), '.workway-runner.mjs');
		await fs.writeFile(runnerPath, runnerScript);

		const spinner = Logger.spinner('Starting engine...');

		try {
			// Execute with tsx/node
			const result = await executeWithTimeout(runnerPath, timeout, options.verbose);

			spinner.succeed('Workflow execution complete');
			Logger.blank();

			// Parse and display results
			displayExecutionResults(result);

		} catch (error: any) {
			spinner.fail('Engine stalled');
			Logger.blank();
			Logger.error(error.message);
			process.exit(1);
		} finally {
			// Cleanup
			await fs.remove(runnerPath);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Execute script with timeout
 */
async function executeWithTimeout(scriptPath: string, timeout: number, verbose?: boolean): Promise<string> {
	return new Promise((resolve, reject) => {
		let output = '';
		let errorOutput = '';

		// Try tsx first, fall back to node
		const proc = spawn('npx', ['tsx', scriptPath], {
			stdio: ['inherit', 'pipe', 'pipe'],
			timeout,
			shell: true,
		});

		proc.stdout?.on('data', (data) => {
			output += data.toString();
			if (verbose) {
				process.stdout.write(data);
			}
		});

		proc.stderr?.on('data', (data) => {
			errorOutput += data.toString();
			if (verbose) {
				process.stderr.write(data);
			}
		});

		proc.on('error', (error) => {
			reject(new Error(`Failed to execute: ${error.message}`));
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(new Error(errorOutput || `Process exited with code ${code}`));
			}
		});

		// Timeout handling
		setTimeout(() => {
			proc.kill('SIGTERM');
			reject(new Error(`Execution timed out after ${timeout}ms`));
		}, timeout);
	});
}

/**
 * Display execution results
 */
function displayExecutionResults(output: string): void {
	Logger.section('Execution Output');

	const lines = output.split('\n');

	for (const line of lines) {
		if (line.startsWith('[WORKFLOW]')) {
			Logger.log(`  ${line.replace('[WORKFLOW]', '📝')}`);
		} else if (line.startsWith('[RESULT]')) {
			Logger.success('Result:');
			try {
				const result = JSON.parse(line.replace('[RESULT]', '').trim());
				Logger.log(JSON.stringify(result, null, 2));
			} catch {
				Logger.log(line.replace('[RESULT]', '').trim());
			}
		} else if (line.startsWith('[ERROR]')) {
			Logger.error(line.replace('[ERROR]', '').trim());
		} else if (line.startsWith('[INFO]')) {
			Logger.log(`  ℹ️  ${line.replace('[INFO]', '').trim()}`);
		} else if (line.trim()) {
			Logger.log(`  ${line}`);
		}
	}
}
