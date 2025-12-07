/**
 * Debug Workflow Skill
 *
 * A reusable skill for debugging WORKWAY workflow executions.
 * Tests a workflow end-to-end by sending a webhook and checking results.
 *
 * SKILL.md:
 * # Debug Workflow
 * Use this skill to test and debug a complete workflow execution.
 * It sends a test event, checks for execution in D1, and reports results.
 *
 * @example
 * ```typescript
 * import { debugWorkflow } from './skills/debug-workflow';
 *
 * // Debug the error-incident-manager workflow
 * const result = await debugWorkflow({
 *   workflow: 'error-incident-manager',
 *   testEvent: {
 *     type: 'sentry',
 *     payload: {
 *       action: 'created',
 *       issue: { id: 'test', title: 'Test Error', level: 'error' }
 *     }
 *   },
 *   database: 'your-d1-database-id'
 * });
 *
 * console.log(`Status: ${result.status}`);
 * console.log(`Duration: ${result.duration}ms`);
 * if (result.error) console.log(`Error: ${result.error}`);
 * ```
 */

import * as cloudflare from '../servers/cloudflare/index.js';
import * as workway from '../servers/workway/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DebugWorkflowInput {
	/** Workflow ID to debug */
	workflow: string;
	/** Test event to send */
	testEvent: {
		type: 'sentry' | 'stripe' | 'github' | 'typeform' | 'calendly' | 'custom';
		payload: unknown;
		endpoint?: string;
	};
	/** D1 database ID to check for execution logs */
	database?: string;
	/** Timeout in milliseconds (default: 10000) */
	timeout?: number;
}

export interface DebugWorkflowResult {
	status: 'success' | 'failed' | 'timeout' | 'no_execution_found';
	duration: number;
	webhookResponse?: {
		success: boolean;
		status: number;
	};
	execution?: {
		id: string;
		status: string;
		createdAt: string;
		completedAt?: string;
		error?: string;
	};
	error?: string;
}

// ============================================================================
// SKILL
// ============================================================================

/**
 * Debug a workflow by sending a test event and checking execution
 */
export async function debugWorkflow(input: DebugWorkflowInput): Promise<DebugWorkflowResult> {
	const startTime = Date.now();
	const timeout = input.timeout || 10000;

	// Step 1: Get workflow info
	const workflow = workway.workflows.get(input.workflow);
	if (!workflow) {
		return {
			status: 'failed',
			duration: Date.now() - startTime,
			error: `Workflow not found: ${input.workflow}`,
		};
	}

	// Step 2: Send test webhook
	let webhookResult: workway.webhooks.WebhookResult;

	switch (input.testEvent.type) {
		case 'sentry':
			webhookResult = await workway.webhooks.sentry(
				input.testEvent.payload as Parameters<typeof workway.webhooks.sentry>[0]
			);
			break;
		case 'stripe':
			webhookResult = await workway.webhooks.stripe(
				input.testEvent.payload as Parameters<typeof workway.webhooks.stripe>[0]
			);
			break;
		case 'github':
			webhookResult = await workway.webhooks.github(
				input.testEvent.payload as Parameters<typeof workway.webhooks.github>[0]
			);
			break;
		case 'typeform':
			webhookResult = await workway.webhooks.typeform(
				input.testEvent.payload as Parameters<typeof workway.webhooks.typeform>[0]
			);
			break;
		case 'calendly':
			webhookResult = await workway.webhooks.calendly(
				input.testEvent.payload as Parameters<typeof workway.webhooks.calendly>[0]
			);
			break;
		case 'custom':
			webhookResult = await workway.webhooks.send({
				endpoint: input.testEvent.endpoint || '/webhooks/custom',
				payload: input.testEvent.payload,
			});
			break;
		default:
			return {
				status: 'failed',
				duration: Date.now() - startTime,
				error: `Unknown event type: ${input.testEvent.type}`,
			};
	}

	if (!webhookResult.success) {
		return {
			status: 'failed',
			duration: Date.now() - startTime,
			webhookResponse: {
				success: webhookResult.success,
				status: webhookResult.status,
			},
			error: `Webhook failed: ${webhookResult.status} ${webhookResult.statusText}`,
		};
	}

	// Step 3: Check for execution in D1 (if database provided)
	if (input.database) {
		const pollInterval = 1000;
		const maxAttempts = Math.ceil(timeout / pollInterval);

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				const executions = await cloudflare.d1.query<{
					id: string;
					workflow_id: string;
					status: string;
					created_at: string;
					completed_at: string | null;
					error: string | null;
				}>({
					database: input.database,
					query: `
						SELECT id, workflow_id, status, created_at, completed_at, error
						FROM workflow_runs
						WHERE workflow_id = ?
						AND created_at > datetime('now', '-1 minute')
						ORDER BY created_at DESC
						LIMIT 1
					`,
					params: [input.workflow],
				});

				if (executions.length > 0) {
					const exec = executions[0];

					if (exec.status === 'completed') {
						return {
							status: 'success',
							duration: Date.now() - startTime,
							webhookResponse: {
								success: webhookResult.success,
								status: webhookResult.status,
							},
							execution: {
								id: exec.id,
								status: exec.status,
								createdAt: exec.created_at,
								completedAt: exec.completed_at || undefined,
							},
						};
					}

					if (exec.status === 'failed') {
						return {
							status: 'failed',
							duration: Date.now() - startTime,
							webhookResponse: {
								success: webhookResult.success,
								status: webhookResult.status,
							},
							execution: {
								id: exec.id,
								status: exec.status,
								createdAt: exec.created_at,
								error: exec.error || undefined,
							},
							error: exec.error || 'Workflow execution failed',
						};
					}
				}
			} catch {
				// D1 query failed, continue polling
			}

			await new Promise(resolve => setTimeout(resolve, pollInterval));
		}

		return {
			status: 'timeout',
			duration: Date.now() - startTime,
			webhookResponse: {
				success: webhookResult.success,
				status: webhookResult.status,
			},
			error: `No execution found within ${timeout}ms`,
		};
	}

	// No database to check, return webhook success
	return {
		status: 'success',
		duration: Date.now() - startTime,
		webhookResponse: {
			success: webhookResult.success,
			status: webhookResult.status,
		},
	};
}
