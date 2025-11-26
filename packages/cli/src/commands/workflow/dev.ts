/**
 * Workflow Dev Command
 *
 * Starts a development server with hot reload for workflow development
 * Watches for file changes and re-executes the workflow
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { watch, type FSWatcher } from 'chokidar';
import { Logger } from '../../utils/logger.js';
import { loadProjectConfig, loadOAuthTokens } from '../../lib/config.js';

interface DevOptions {
	port?: number;
	mock?: boolean;
}

let watcher: FSWatcher | null = null;
let currentProcess: ChildProcess | null = null;

export async function workflowDevCommand(options: DevOptions): Promise<void> {
	try {
		Logger.header('Development Server');

		// Check if we're in a workflow project
		const workflowPath = path.join(process.cwd(), 'workflow.ts');
		if (!(await fs.pathExists(workflowPath))) {
			Logger.error('No workflow.ts found in current directory');
			Logger.log('');
			Logger.log('💡 Run this command from a workflow project directory');
			Logger.log('💡 Or create a new workflow with: workway workflow init');
			process.exit(1);
		}

		// Load project config
		const projectConfig = await loadProjectConfig();
		const port = options.port || projectConfig?.dev?.port || 3000;
		const mockMode = options.mock ?? projectConfig?.dev?.mockMode ?? true;

		// Load OAuth tokens
		const oauthTokens = await loadOAuthTokens();
		const hasOAuth = Object.keys(oauthTokens).length > 0;

		Logger.section('Configuration');
		Logger.listItem(`Port: ${port}`);
		Logger.listItem(`Mode: ${mockMode ? 'Mock' : 'Live'}`);
		Logger.listItem(`OAuth: ${hasOAuth ? Object.keys(oauthTokens).join(', ') : 'None'}`);
		Logger.listItem(`Hot Reload: enabled`);
		Logger.blank();

		// Start watching for changes
		Logger.log('👀 Watching for changes...');
		Logger.blank();

		// Initial run
		await runWorkflow(workflowPath, mockMode, oauthTokens);

		// Set up file watcher
		watcher = watch([
			path.join(process.cwd(), '**/*.ts'),
			path.join(process.cwd(), '**/*.json'),
		], {
			ignored: [
				/node_modules/,
				/\.git/,
				/dist/,
				/\.workway-runner/,
			],
			persistent: true,
			ignoreInitial: true,
		});

		watcher.on('change', async (changedPath) => {
			Logger.blank();
			Logger.log(`📝 File changed: ${path.relative(process.cwd(), changedPath)}`);
			Logger.blank();

			// Kill any running process
			if (currentProcess) {
				currentProcess.kill('SIGTERM');
				currentProcess = null;
			}

			// Re-run workflow
			await runWorkflow(workflowPath, mockMode, oauthTokens);
		});

		watcher.on('error', (error) => {
			Logger.error(`Watcher error: ${error.message}`);
		});

		// Handle cleanup
		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);

		Logger.blank();
		Logger.log('Press Ctrl+C to stop the development server');

	} catch (error: any) {
		Logger.error(error.message);
		cleanup();
		process.exit(1);
	}
}

/**
 * Run the workflow
 */
async function runWorkflow(
	workflowPath: string,
	mockMode: boolean,
	oauthTokens: Record<string, any>
): Promise<void> {
	Logger.log('🔄 Running workflow...');
	Logger.blank();

	const startTime = Date.now();

	try {
		// Create a temporary runner script
		const runnerScript = `
import { pathToFileURL } from 'url';

const workflowPath = '${workflowPath.replace(/\\/g, '\\\\')}';

async function run() {
	try {
		// Clear module cache for hot reload
		const url = pathToFileURL(workflowPath).href;
		
		const workflow = await import(url + '?t=' + Date.now());
		
		const context = {
			input: {},
			oauth: ${JSON.stringify(oauthTokens)},
			env: 'development',
			mock: ${mockMode},
			log: (msg) => console.log('[LOG]', msg),
			error: (msg) => console.error('[ERROR]', msg),
		};

		if (typeof workflow.default?.run === 'function') {
			const result = await workflow.default.run(context);
			console.log('[RESULT]', JSON.stringify(result, null, 2));
		} else if (typeof workflow.run === 'function') {
			const result = await workflow.run(context);
			console.log('[RESULT]', JSON.stringify(result, null, 2));
		} else {
			console.log('[INFO] Workflow loaded');
			console.log('[INFO] Exports:', Object.keys(workflow).join(', '));
		}
	} catch (error) {
		console.error('[ERROR]', error.message);
		console.error('[STACK]', error.stack);
	}
}

run();
`;

		const runnerPath = path.join(process.cwd(), '.workway-runner.mjs');
		await fs.writeFile(runnerPath, runnerScript);

		// Execute
		currentProcess = spawn('npx', ['tsx', runnerPath], {
			stdio: 'pipe',
			shell: true,
		});

		currentProcess.stdout?.on('data', (data) => {
			const lines = data.toString().split('\n');
			for (const line of lines) {
				if (line.startsWith('[LOG]')) {
					Logger.log(`  📝 ${line.replace('[LOG]', '').trim()}`);
				} else if (line.startsWith('[RESULT]')) {
					Logger.success('  ✅ Result:');
					try {
						const result = JSON.parse(line.replace('[RESULT]', '').trim());
						console.log(JSON.stringify(result, null, 2));
					} catch {
						console.log(line.replace('[RESULT]', '').trim());
					}
				} else if (line.startsWith('[INFO]')) {
					Logger.log(`  ℹ️  ${line.replace('[INFO]', '').trim()}`);
				} else if (line.trim()) {
					Logger.log(`  ${line}`);
				}
			}
		});

		currentProcess.stderr?.on('data', (data) => {
			const lines = data.toString().split('\n');
			for (const line of lines) {
				if (line.startsWith('[ERROR]')) {
					Logger.error(`  ${line.replace('[ERROR]', '').trim()}`);
				} else if (line.startsWith('[STACK]')) {
					Logger.debug(line.replace('[STACK]', '').trim());
				} else if (line.trim() && !line.includes('ExperimentalWarning')) {
					Logger.log(`  ${line}`);
				}
			}
		});

		currentProcess.on('close', async (code) => {
			const duration = Date.now() - startTime;
			await fs.remove(runnerPath);

			if (code === 0) {
				Logger.log(`  ⏱️  Completed in ${duration}ms`);
			} else {
				Logger.warn(`  ⚠️  Exited with code ${code} (${duration}ms)`);
			}
			Logger.blank();
			Logger.log('👀 Watching for changes...');
		});

	} catch (error: any) {
		Logger.error(`Execution failed: ${error.message}`);
	}
}

/**
 * Cleanup resources
 */
function cleanup(): void {
	Logger.blank();
	Logger.log('🛑 Shutting down development server...');

	if (watcher) {
		watcher.close();
		watcher = null;
	}

	if (currentProcess) {
		currentProcess.kill('SIGTERM');
		currentProcess = null;
	}

	// Clean up runner file
	const runnerPath = path.join(process.cwd(), '.workway-runner.mjs');
	fs.removeSync(runnerPath);

	Logger.success('Goodbye!');
	process.exit(0);
}
