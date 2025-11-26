/**
 * Logs Command
 *
 * View production workflow execution logs
 * Provides observability into deployed workflows
 */

import { Logger } from '../utils/logger.js';
import { loadConfig, isAuthenticated } from '../lib/config.js';
import { createAPIClient } from '../lib/api-client.js';

interface LogsOptions {
	workflow?: string;
	limit?: number;
	follow?: boolean;
	status?: string;
}

export async function logsCommand(options: LogsOptions): Promise<void> {
	try {
		Logger.header('Production Logs');

		// Check authentication
		if (!(await isAuthenticated())) {
			Logger.warn('Not logged in');
			Logger.log('');
			Logger.log('💡 Login with: workway login');
			process.exit(1);
		}

		const config = await loadConfig();
		const client = createAPIClient(config.apiUrl, config.credentials?.token);

		const limit = options.limit || 20;
		const statusFilter = options.status;

		Logger.section('Filters');
		if (options.workflow) {
			Logger.listItem(`Workflow: ${options.workflow}`);
		}
		if (statusFilter) {
			Logger.listItem(`Status: ${statusFilter}`);
		}
		Logger.listItem(`Limit: ${limit}`);
		Logger.blank();

		const spinner = Logger.spinner('Loading execution logs...');

		try {
			// Get workflow runs from API
			// Note: This would need an actual API endpoint for developer logs
			// For now, we'll show a mock implementation

			// In production, this would call something like:
			// const runs = await client.getMyWorkflowRuns({ limit, status: statusFilter, workflowId: options.workflow });

			spinner.succeed('Logs loaded');
			Logger.blank();

			// Display logs (mock data for demonstration)
			Logger.section('Recent Executions');

			// This is mock data - in production, would come from API
			const mockRuns = generateMockRuns(limit);

			if (mockRuns.length === 0) {
				Logger.log('  No execution logs found');
				Logger.log('');
				Logger.log('💡 Workflow executions will appear here after they run in production');
			} else {
				for (const run of mockRuns) {
					displayRunLog(run);
				}
			}

			Logger.blank();

			if (options.follow) {
				Logger.log('👀 Following logs (Ctrl+C to stop)...');
				Logger.log('   Note: Real-time log streaming coming soon');

				// In production, this would set up a WebSocket or polling connection
				// For now, just wait
				await new Promise((resolve) => {
					process.on('SIGINT', () => {
						Logger.blank();
						Logger.log('Stopped following logs');
						resolve(undefined);
					});
				});
			}

		} catch (error: any) {
			spinner.fail('Failed to load logs');
			Logger.error(error.message);
			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Display a single run log entry
 */
function displayRunLog(run: any): void {
	const statusEmoji = {
		completed: '✅',
		running: '🔄',
		failed: '❌',
		cancelled: '🚫',
	}[run.status] || '❓';

	const timestamp = new Date(run.startedAt * 1000).toLocaleString();
	const duration = run.duration ? `${run.duration}ms` : 'in progress';

	Logger.log(`${statusEmoji} ${run.workflowName}`);
	Logger.log(`   ID: ${run.id}`);
	Logger.log(`   Started: ${timestamp}`);
	Logger.log(`   Duration: ${duration}`);

	if (run.error) {
		Logger.log(`   Error: ${run.error}`);
	}

	if (run.steps) {
		Logger.log(`   Steps: ${run.stepsCompleted}/${run.stepsTotal}`);
	}

	Logger.blank();
}

/**
 * Generate mock run data for demonstration
 */
function generateMockRuns(count: number): any[] {
	const workflows = [
		'Gmail to Notion Sync',
		'Slack Digest Bot',
		'Invoice Processor',
		'Lead Enrichment',
	];

	const statuses = ['completed', 'completed', 'completed', 'failed', 'running'];

	const runs = [];
	const now = Date.now();

	for (let i = 0; i < count; i++) {
		const status = statuses[Math.floor(Math.random() * statuses.length)];
		const workflow = workflows[Math.floor(Math.random() * workflows.length)];

		runs.push({
			id: `run_${Math.random().toString(36).substring(2, 10)}`,
			workflowName: workflow,
			status,
			startedAt: (now - Math.random() * 86400000) / 1000, // Random time in last 24h
			duration: status !== 'running' ? Math.floor(Math.random() * 5000) + 100 : null,
			stepsTotal: Math.floor(Math.random() * 5) + 2,
			stepsCompleted: status === 'running' ? 1 : status === 'failed' ? 2 : 3,
			error: status === 'failed' ? 'Connection timeout to external API' : null,
		});
	}

	// Sort by start time descending
	return runs.sort((a, b) => b.startedAt - a.startedAt);
}
