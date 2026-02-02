/**
 * Workflow Request Commands
 *
 * Enterprise workflow request management for developers
 *
 * Commands:
 * - workway requests list       - List requests (assigned to me, available)
 * - workway requests show       - Show request details
 * - workway requests claim      - Claim an unassigned request
 * - workway requests start      - Mark request as in progress
 * - workway requests complete   - Complete request and link workflow
 * - workway requests comment    - Add comment to request
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { Logger } from '../utils/logger.js';
import { createAuthenticatedClient } from '../utils/auth-client.js';

interface RequestsOptions {
	// For list command
	status?: string;
	assignedToMe?: boolean;
	available?: boolean;
	// For complete command
	integrationId?: string;
	versionId?: string;
	// For comment command
	content?: string;
	isQuestion?: boolean;
}

interface WorkflowRequest {
	id: string;
	title: string;
	description: string;
	priority: 'low' | 'medium' | 'high' | 'critical';
	status: string;
	category?: string;
	requestedBy: string;
	assignedTo?: string;
	createdAt?: number;
	dueDate?: number;
	requester?: { displayName: string; email: string };
	assignee?: { displayName: string; email: string };
}

interface RequestComment {
	id: string;
	authorName: string;
	content: string;
	commentType: string;
	createdAt: number;
	oldStatus?: string;
	newStatus?: string;
}

const PRIORITY_COLORS: Record<string, typeof chalk.red> = {
	critical: chalk.red,
	high: chalk.yellow,
	medium: chalk.white,
	low: chalk.gray,
};

const STATUS_COLORS: Record<string, typeof chalk.green> = {
	submitted: chalk.cyan,
	under_review: chalk.yellow,
	approved: chalk.green,
	rejected: chalk.red,
	in_progress: chalk.blue,
	completed: chalk.green,
	cancelled: chalk.gray,
};

const STATUS_LABELS: Record<string, string> = {
	submitted: 'Submitted',
	under_review: 'Under Review',
	approved: 'Approved',
	rejected: 'Rejected',
	in_progress: 'In Progress',
	completed: 'Completed',
	cancelled: 'Cancelled',
};

export async function requestsCommand(action: string, requestId?: string, options: RequestsOptions = {}): Promise<void> {
	switch (action) {
		case 'list':
			return requestsListCommand(options);
		case 'show':
			return requestsShowCommand(requestId);
		case 'claim':
			return requestsClaimCommand(requestId);
		case 'start':
			return requestsStartCommand(requestId);
		case 'complete':
			return requestsCompleteCommand(requestId, options);
		case 'comment':
			return requestsCommentCommand(requestId, options);
		default:
			Logger.error(`Unknown requests command: ${action}`);
			Logger.log('');
			Logger.log('Available commands:');
			Logger.listItem('workway requests list              - List requests');
			Logger.listItem('workway requests show <id>         - Show request details');
			Logger.listItem('workway requests claim <id>        - Claim an unassigned request');
			Logger.listItem('workway requests start <id>        - Mark request as in progress');
			Logger.listItem('workway requests complete <id>     - Complete request');
			Logger.listItem('workway requests comment <id>      - Add comment');
			process.exit(1);
	}
}

/**
 * List workflow requests
 */
async function requestsListCommand(options: RequestsOptions): Promise<void> {
	Logger.header('Workflow Requests');

	try {
		const { apiClient } = await createAuthenticatedClient();
		
		// Build query params
		const params = new URLSearchParams();
		if (options.status) params.set('status', options.status);
		if (options.assignedToMe) params.set('assignedToMe', 'true');
		if (options.available) {
			params.set('status', 'approved');
			// Available means approved but not assigned
		}
		
		const queryString = params.toString();
		const url = `/requests${queryString ? `?${queryString}` : ''}`;
		
		const response = (await apiClient.getJson(url)) as { 
			success: boolean; 
			requests: WorkflowRequest[];
			error?: string;
		};

		if (!response.success) {
			Logger.error(response.error || 'Failed to list requests');
			process.exit(1);
		}

		const requests = response.requests || [];

		if (requests.length === 0) {
			Logger.info('No requests found');
			if (options.assignedToMe) {
				Logger.log('Use --available to see requests you can claim');
			}
			return;
		}

		// Group by status
		const groupedRequests: Record<string, WorkflowRequest[]> = {};
		for (const request of requests) {
			const status = request.status;
			if (!groupedRequests[status]) groupedRequests[status] = [];
			groupedRequests[status].push(request);
		}

		// Display by status
		for (const [status, statusRequests] of Object.entries(groupedRequests)) {
			const statusColor = STATUS_COLORS[status] || chalk.white;
			Logger.log('');
			Logger.log(statusColor(`── ${STATUS_LABELS[status] || status} (${statusRequests.length}) ──`));
			Logger.log('');

			for (const request of statusRequests) {
				const priorityColor = PRIORITY_COLORS[request.priority] || chalk.white;
				const priorityLabel = request.priority.charAt(0).toUpperCase() + request.priority.slice(1);
				
				Logger.log(`  ${chalk.white(request.id)} ${priorityColor(`[${priorityLabel}]`)}`);
				Logger.log(`  ${chalk.bold(request.title)}`);
				
				if (request.assignee?.displayName) {
					Logger.log(`  ${chalk.gray('Assigned:')} ${request.assignee.displayName}`);
				} else if (status === 'approved') {
					Logger.log(`  ${chalk.yellow('Unassigned - available to claim')}`);
				}
				
				if (request.dueDate) {
					const dueDate = new Date(request.dueDate * 1000);
					const now = new Date();
					const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
					const dueDateStr = dueDate.toLocaleDateString();
					
					if (daysUntil < 0) {
						Logger.log(`  ${chalk.red(`Due: ${dueDateStr} (${Math.abs(daysUntil)} days overdue)`)}`);
					} else if (daysUntil <= 3) {
						Logger.log(`  ${chalk.yellow(`Due: ${dueDateStr} (${daysUntil} days)`)}`);
					} else {
						Logger.log(`  ${chalk.gray(`Due: ${dueDateStr}`)}`);
					}
				}
				
				Logger.log('');
			}
		}

		Logger.log(chalk.gray(`Total: ${requests.length} request(s)`));

	} catch (error) {
		Logger.error(`Failed to list requests: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

/**
 * Show request details
 */
async function requestsShowCommand(requestId?: string): Promise<void> {
	try {
		const { apiClient } = await createAuthenticatedClient();

		// If no ID provided, let user select from list
		if (!requestId) {
			const listResponse = (await apiClient.getJson('/requests?assignedToMe=true')) as {
				success: boolean;
				requests: WorkflowRequest[];
			};

			if (!listResponse.success || listResponse.requests.length === 0) {
				Logger.error('No requests found. Provide a request ID.');
				process.exit(1);
			}

			const { selectedId } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedId',
					message: 'Select a request:',
					choices: listResponse.requests.map((r: WorkflowRequest) => ({
						name: `${r.id} - ${r.title} [${STATUS_LABELS[r.status]}]`,
						value: r.id,
					})),
				},
			]);
			requestId = selectedId;
		}

		Logger.header(`Request: ${requestId}`);

		const response = (await apiClient.getJson(`/requests/${requestId}`)) as {
			success: boolean;
			request: WorkflowRequest & {
				businessJustification?: string;
				requester?: { displayName: string; email: string };
				assignee?: { displayName: string; email: string };
				linkedWorkflow?: { id: string; name: string };
				watcherCount: number;
				isWatching: boolean;
			};
			error?: string;
		};

		if (!response.success) {
			Logger.error(response.error || 'Failed to get request');
			process.exit(1);
		}

		const request = response.request;
		const statusColor = STATUS_COLORS[request.status] || chalk.white;
		const priorityColor = PRIORITY_COLORS[request.priority] || chalk.white;

		// Header
		Logger.log('');
		Logger.log(chalk.bold(request.title));
		Logger.log(`${chalk.gray('ID:')} ${request.id}`);
		Logger.log('');

		// Status & Priority
		Logger.log(`${chalk.gray('Status:')} ${statusColor(STATUS_LABELS[request.status] || request.status)}`);
		Logger.log(`${chalk.gray('Priority:')} ${priorityColor(request.priority.charAt(0).toUpperCase() + request.priority.slice(1))}`);
		if (request.category) {
			Logger.log(`${chalk.gray('Category:')} ${request.category}`);
		}
		Logger.log('');

		// People
		if (request.requester) {
			Logger.log(`${chalk.gray('Requested by:')} ${request.requester.displayName}`);
		}
		if (request.assignee) {
			Logger.log(`${chalk.gray('Assigned to:')} ${request.assignee.displayName}`);
		} else {
			Logger.log(`${chalk.gray('Assigned to:')} ${chalk.yellow('Unassigned')}`);
		}
		Logger.log(`${chalk.gray('Watchers:')} ${request.watcherCount} ${request.isWatching ? chalk.green('(you)') : ''}`);
		Logger.log('');

		// Description
		Logger.log(chalk.gray('Description:'));
		Logger.log(request.description);
		Logger.log('');

		if (request.businessJustification) {
			Logger.log(chalk.gray('Business Justification:'));
			Logger.log(request.businessJustification);
			Logger.log('');
		}

		// Linked workflow
		if (request.linkedWorkflow) {
			Logger.log(chalk.gray('Linked Workflow:'));
			Logger.log(`  ${request.linkedWorkflow.name} (${request.linkedWorkflow.id})`);
			Logger.log('');
		}

		// Get comments
		const commentsResponse = (await apiClient.getJson(`/requests/${requestId}/comments`)) as {
			success: boolean;
			comments: RequestComment[];
		};

		if (commentsResponse.success && commentsResponse.comments.length > 0) {
			Logger.log(chalk.gray('Activity:'));
			Logger.log('');
			
			for (const comment of commentsResponse.comments) {
				const time = new Date(comment.createdAt * 1000).toLocaleString();
				
				if (comment.commentType === 'status_change') {
					Logger.log(`  ${chalk.blue('↳')} ${chalk.gray(time)}`);
					Logger.log(`    ${chalk.gray('Status changed:')} ${comment.oldStatus} → ${comment.newStatus}`);
				} else if (comment.commentType === 'system') {
					Logger.log(`  ${chalk.blue('↳')} ${chalk.gray(time)}`);
					Logger.log(`    ${chalk.gray(comment.content)}`);
				} else {
					const icon = comment.commentType === 'question' ? '❓' : '💬';
					Logger.log(`  ${icon} ${chalk.bold(comment.authorName)} ${chalk.gray(`• ${time}`)}`);
					Logger.log(`    ${comment.content}`);
				}
				Logger.log('');
			}
		}

		// Actions hint
		if (!request.assignee && request.status === 'approved') {
			Logger.log(chalk.yellow('→ This request is available. Run `workway requests claim ' + requestId + '` to claim it.'));
		} else if (request.assignee && request.status === 'approved') {
			Logger.log(chalk.yellow('→ Run `workway requests start ' + requestId + '` to begin work.'));
		} else if (request.status === 'in_progress') {
			Logger.log(chalk.yellow('→ Run `workway requests complete ' + requestId + '` when done.'));
		}

	} catch (error) {
		Logger.error(`Failed to get request: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

/**
 * Claim an unassigned request
 */
async function requestsClaimCommand(requestId?: string): Promise<void> {
	try {
		const { apiClient } = await createAuthenticatedClient();

		// If no ID, show available requests
		if (!requestId) {
			const listResponse = (await apiClient.getJson('/requests?status=approved')) as {
				success: boolean;
				requests: WorkflowRequest[];
			};

			if (!listResponse.success) {
				Logger.error('Failed to list available requests');
				process.exit(1);
			}

			// Filter to unassigned only
			const available = listResponse.requests.filter((r: WorkflowRequest) => !r.assignedTo);

			if (available.length === 0) {
				Logger.info('No unassigned requests available to claim');
				return;
			}

			const { selectedId } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedId',
					message: 'Select a request to claim:',
					choices: available.map((r: WorkflowRequest) => {
						const priorityColor = PRIORITY_COLORS[r.priority] || chalk.white;
						return {
							name: `${r.id} ${priorityColor(`[${r.priority}]`)} - ${r.title}`,
							value: r.id,
						};
					}),
				},
			]);
			requestId = selectedId;
		}

		Logger.log(`Claiming request ${requestId}...`);

		const response = (await apiClient.postJson(`/requests/${requestId}/claim`, { body: {} })) as {
			success: boolean;
			message?: string;
			error?: string;
		};

		if (!response.success) {
			Logger.error(response.error || 'Failed to claim request');
			process.exit(1);
		}

		Logger.success('Request claimed successfully!');
		Logger.log('');
		Logger.log('Next steps:');
		Logger.listItem(`Run ${chalk.cyan(`workway requests start ${requestId}`)} to begin work`);
		Logger.listItem(`Run ${chalk.cyan(`workway requests show ${requestId}`)} to view details`);

	} catch (error) {
		Logger.error(`Failed to claim request: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

/**
 * Start work on a request
 */
async function requestsStartCommand(requestId?: string): Promise<void> {
	try {
		const { apiClient } = await createAuthenticatedClient();

		// If no ID, show assigned requests
		if (!requestId) {
			const listResponse = (await apiClient.getJson('/requests?assignedToMe=true&status=approved')) as {
				success: boolean;
				requests: WorkflowRequest[];
			};

			if (!listResponse.success || listResponse.requests.length === 0) {
				Logger.info('No requests ready to start');
				return;
			}

			const { selectedId } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedId',
					message: 'Select a request to start:',
					choices: listResponse.requests.map((r: WorkflowRequest) => ({
						name: `${r.id} - ${r.title}`,
						value: r.id,
					})),
				},
			]);
			requestId = selectedId;
		}

		Logger.log(`Starting work on ${requestId}...`);

		const response = (await apiClient.postJson(`/requests/${requestId}/start`, { body: {} })) as {
			success: boolean;
			message?: string;
			error?: string;
		};

		if (!response.success) {
			Logger.error(response.error || 'Failed to start request');
			process.exit(1);
		}

		Logger.success('Work started!');
		Logger.log('');
		Logger.log('The request is now In Progress.');
		Logger.log(`Run ${chalk.cyan(`workway requests complete ${requestId}`)} when done.`);

	} catch (error) {
		Logger.error(`Failed to start request: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

/**
 * Complete a request
 */
async function requestsCompleteCommand(requestId?: string, options: RequestsOptions = {}): Promise<void> {
	try {
		const { apiClient } = await createAuthenticatedClient();

		// If no ID, show in-progress requests
		if (!requestId) {
			const listResponse = (await apiClient.getJson('/requests?assignedToMe=true&status=in_progress')) as {
				success: boolean;
				requests: WorkflowRequest[];
			};

			if (!listResponse.success || listResponse.requests.length === 0) {
				Logger.info('No in-progress requests to complete');
				return;
			}

			const { selectedId } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedId',
					message: 'Select a request to complete:',
					choices: listResponse.requests.map((r: WorkflowRequest) => ({
						name: `${r.id} - ${r.title}`,
						value: r.id,
					})),
				},
			]);
			requestId = selectedId;
		}

		// Prompt for completion details
		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'integrationId',
				message: 'Linked workflow ID (optional):',
				default: options.integrationId,
			},
			{
				type: 'input',
				name: 'notes',
				message: 'Completion notes (optional):',
			},
			{
				type: 'number',
				name: 'actualEffortHours',
				message: 'Actual effort (hours, optional):',
			},
		]);

		Logger.log(`Completing request ${requestId}...`);

		const response = (await apiClient.postJson(`/requests/${requestId}/complete`, {
			body: {
				integrationId: answers.integrationId || undefined,
				notes: answers.notes || undefined,
				actualEffortHours: answers.actualEffortHours || undefined,
			},
		})) as {
			success: boolean;
			message?: string;
			error?: string;
		};

		if (!response.success) {
			Logger.error(response.error || 'Failed to complete request');
			process.exit(1);
		}

		Logger.success('Request completed!');
		if (answers.integrationId) {
			Logger.log(`Linked to workflow: ${answers.integrationId}`);
		}

	} catch (error) {
		Logger.error(`Failed to complete request: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

/**
 * Add comment to a request
 */
async function requestsCommentCommand(requestId?: string, options: RequestsOptions = {}): Promise<void> {
	try {
		const { apiClient } = await createAuthenticatedClient();

		// If no ID, show recent requests
		if (!requestId) {
			const listResponse = (await apiClient.getJson('/requests?assignedToMe=true')) as {
				success: boolean;
				requests: WorkflowRequest[];
			};

			if (!listResponse.success || listResponse.requests.length === 0) {
				Logger.error('No requests found. Provide a request ID.');
				process.exit(1);
			}

			const { selectedId } = await inquirer.prompt([
				{
					type: 'list',
					name: 'selectedId',
					message: 'Select a request to comment on:',
					choices: listResponse.requests.map((r: WorkflowRequest) => ({
						name: `${r.id} - ${r.title}`,
						value: r.id,
					})),
				},
			]);
			requestId = selectedId;
		}

		// Prompt for comment
		const answers = await inquirer.prompt([
			{
				type: 'list',
				name: 'commentType',
				message: 'Comment type:',
				choices: [
					{ name: 'Comment', value: 'comment' },
					{ name: 'Question (will notify watchers)', value: 'question' },
				],
				default: options.isQuestion ? 'question' : 'comment',
			},
			{
				type: 'input',
				name: 'content',
				message: 'Your comment:',
				default: options.content,
				validate: (input: string) => input.trim().length > 0 || 'Comment cannot be empty',
			},
		]);

		Logger.log('Adding comment...');

		const response = (await apiClient.postJson(`/requests/${requestId}/comments`, {
			body: {
				content: answers.content,
				commentType: answers.commentType,
			},
		})) as {
			success: boolean;
			comment?: { id: string };
			error?: string;
		};

		if (!response.success) {
			Logger.error(response.error || 'Failed to add comment');
			process.exit(1);
		}

		Logger.success('Comment added!');
		if (answers.commentType === 'question') {
			Logger.log(chalk.gray('Watchers have been notified'));
		}

	} catch (error) {
		Logger.error(`Failed to add comment: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(1);
	}
}

export default requestsCommand;
