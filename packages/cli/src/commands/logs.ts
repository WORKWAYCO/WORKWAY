/**
 * Logs Command
 *
 * View production workflow execution logs
 * Provides real observability into deployed workflows
 */

import { Logger } from '../utils/logger.js';
import { loadConfig, isAuthenticated } from '../lib/config.js';
import { createAPIClient, type WorkflowLog } from '../lib/api-client.js';

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
			Logger.log('Login with: workway login');
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
			const { logs, pagination } = await client.getLogs({
				limit,
				status: statusFilter,
				integrationId: options.workflow,
			});

			spinner.succeed(`Loaded ${logs.length} logs (${pagination.total} total)`);
			Logger.blank();

			// Display logs
			Logger.section('Recent Executions');

			if (logs.length === 0) {
				Logger.log('  No execution logs found');
				Logger.log('');
				Logger.log('Workflow executions will appear here after they run in production');
			} else {
				for (const log of logs) {
					displayRunLog(log);
				}

				// Show pagination info
				if (pagination.totalPages > 1) {
					Logger.blank();
					Logger.log(`Page ${pagination.page} of ${pagination.totalPages}`);
				}
			}

			Logger.blank();

			if (options.follow) {
				Logger.log('Following logs (Ctrl+C to stop)...');
				Logger.blank();

				// Poll for new logs every 5 seconds
				let lastLogId = logs.length > 0 ? logs[0].id : null;

				const pollInterval = setInterval(async () => {
					try {
						const { logs: newLogs } = await client.getLogs({
							limit: 10,
							status: statusFilter,
							integrationId: options.workflow,
						});

						// Find new logs since last check
						const newEntries = [];
						for (const log of newLogs) {
							if (log.id === lastLogId) break;
							newEntries.push(log);
						}

						if (newEntries.length > 0) {
							lastLogId = newEntries[0].id;
							for (const log of newEntries.reverse()) {
								displayRunLog(log);
							}
						}
					} catch (error) {
						// Silently continue polling
					}
				}, 5000);

				// Wait for SIGINT
				await new Promise<void>((resolve) => {
					process.on('SIGINT', () => {
						clearInterval(pollInterval);
						Logger.blank();
						Logger.log('Stopped following logs');
						resolve();
					});
				});
			}
		} catch (error: any) {
			spinner.fail('Failed to load logs');

			if (error.statusCode === 404) {
				Logger.log('');
				Logger.log('Developer profile not found.');
				Logger.log('Register as a developer first: workway developer register');
			} else {
				Logger.error(error.message);
			}
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
function displayRunLog(log: WorkflowLog): void {
	const statusEmoji: Record<string, string> = {
		completed: '[OK]',
		running: '[..]',
		failed: '[!!]',
		cancelled: '[--]',
	};

	const emoji = statusEmoji[log.status] || '[??]';
	const timestamp = new Date(log.startedAt).toLocaleString();
	const duration = log.durationMs ? `${log.durationMs}ms` : 'in progress';

	Logger.log(`${emoji} ${log.integrationName}`);
	Logger.log(`   ID: ${log.id}`);
	Logger.log(`   User: ${log.userEmail}`);
	Logger.log(`   Trigger: ${log.triggerType}`);
	Logger.log(`   Started: ${timestamp}`);
	Logger.log(`   Duration: ${duration}`);
	Logger.log(`   Steps: ${log.stepsCompleted}/${log.stepsTotal}${log.stepsFailed > 0 ? ` (${log.stepsFailed} failed)` : ''}`);

	if (log.error) {
		Logger.log(`   Error: ${log.error}`);
	}

	Logger.blank();
}
