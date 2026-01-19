/**
 * WORKWAY Durable Executor
 *
 * Uses Cloudflare Workflows for durable, resumable execution.
 * Steps are automatically retried on failure and state persists
 * across executions.
 *
 * Benefits over regular Workers:
 * - Automatic retry with exponential backoff
 * - Steps can sleep for minutes, hours, or days
 * - State survives worker restarts
 * - Progress is tracked via instance status
 *
 * @example
 * ```typescript
 * // Trigger a workflow
 * const instance = await env.WORKFLOW.create({
 *   params: { workflowId: 'meeting-sync', tenantId: 'tenant_123', config: {} }
 * });
 *
 * // Check status
 * const status = await env.WORKFLOW.get(instance.id);
 * console.log(status.status, status.output);
 * ```
 */

import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

// =============================================================================
// TYPES
// =============================================================================

export interface Env {
	WORKFLOW: Workflow;
	ANALYTICS: AnalyticsEngineDataset;
	WORKFLOW_META: KVNamespace;
	ENVIRONMENT: string;
}

/**
 * Parameters passed to workflow execution
 */
export interface WorkflowParams {
	/** Workflow identifier (e.g., 'meeting-sync', 'data-export') */
	workflowId: string;
	/** Tenant/user identifier */
	tenantId: string;
	/** Workflow-specific configuration */
	config: Record<string, unknown>;
	/** Optional delay before starting (in minutes) */
	delayMinutes?: number;
	/** Optional webhook URL to call on completion */
	webhookUrl?: string;
}

/**
 * Result from workflow execution
 */
export interface WorkflowResult {
	success: boolean;
	data?: Record<string, unknown>;
	error?: string;
	steps: string[];
	durationMs: number;
}

// =============================================================================
// WORKFLOW EXECUTOR
// =============================================================================

/**
 * Cloudflare Workflow for durable execution
 *
 * Each step is:
 * - Automatically retried on failure (3 times by default)
 * - Persisted to storage (survives restarts)
 * - Logged for debugging
 */
export class WorkflowExecutor extends WorkflowEntrypoint<Env, WorkflowParams> {
	/**
	 * Main workflow execution
	 */
	async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep): Promise<WorkflowResult> {
		const { workflowId, tenantId, config, delayMinutes, webhookUrl } = event.payload;
		const startTime = Date.now();
		const completedSteps: string[] = [];

		try {
			// Step 1: Initial delay if requested
			if (delayMinutes && delayMinutes > 0) {
				await step.sleep('initial-delay', `${delayMinutes} minutes`);
			}

			// Step 2: Validate configuration
			const validated = await step.do('validate', async () => {
				completedSteps.push('validate');

				// Validate required fields
				if (!workflowId) throw new Error('workflowId is required');
				if (!tenantId) throw new Error('tenantId is required');

				// Normalize config
				return {
					valid: true,
					normalizedConfig: {
						...config,
						tenantId,
						startedAt: new Date().toISOString(),
					},
				};
			});

			if (!validated.valid) {
				throw new Error('Validation failed');
			}

			// Step 3: Execute main workflow logic
			const result = await step.do('execute', async () => {
				completedSteps.push('execute');

				// This is where workflow-specific logic goes
				// For now, we return a placeholder
				return {
					workflowId,
					tenantId,
					processedAt: new Date().toISOString(),
					config: validated.normalizedConfig,
				};
			});

			// Step 4: Record success metrics
			await step.do('record-metrics', async () => {
				completedSteps.push('record-metrics');

				this.env.ANALYTICS?.writeDataPoint({
					blobs: [tenantId, workflowId, 'workflow.complete', 'success', ''],
					doubles: [Date.now() - startTime, 0, 200, Date.now()],
					indexes: [tenantId],
				});
			});

			// Step 5: Call webhook if provided
			if (webhookUrl) {
				await step.do('webhook', async () => {
					completedSteps.push('webhook');

					await fetch(webhookUrl, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							event: 'workflow.completed',
							workflowId,
							tenantId,
							result,
							durationMs: Date.now() - startTime,
						}),
					});
				});
			}

			return {
				success: true,
				data: result,
				steps: completedSteps,
				durationMs: Date.now() - startTime,
			};
		} catch (error) {
			// Record failure metrics
			this.env.ANALYTICS?.writeDataPoint({
				blobs: [tenantId, workflowId, 'workflow.complete', 'error', error instanceof Error ? error.message : ''],
				doubles: [Date.now() - startTime, 0, 500, Date.now()],
				indexes: [tenantId],
			});

			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				steps: completedSteps,
				durationMs: Date.now() - startTime,
			};
		}
	}
}

// =============================================================================
// HTTP HANDLER
// =============================================================================

export default {
	/**
	 * HTTP interface for triggering and managing workflows
	 */
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// CORS headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		try {
			// POST /trigger - Start a new workflow
			if (request.method === 'POST' && path === '/trigger') {
				const params = await request.json() as WorkflowParams;

				// Validate required fields
				if (!params.workflowId || !params.tenantId) {
					return Response.json(
						{ error: 'workflowId and tenantId are required' },
						{ status: 400, headers: corsHeaders }
					);
				}

				// Create workflow instance
				const instance = await env.WORKFLOW.create({
					params,
				});

				// Store metadata for lookup
				await env.WORKFLOW_META.put(
					`instance:${instance.id}`,
					JSON.stringify({
						workflowId: params.workflowId,
						tenantId: params.tenantId,
						createdAt: new Date().toISOString(),
					}),
					{ expirationTtl: 86400 * 7 } // 7 days
				);

				return Response.json(
					{
						instanceId: instance.id,
						workflowId: params.workflowId,
						status: 'running',
					},
					{ status: 201, headers: corsHeaders }
				);
			}

			// GET /status/:instanceId - Get workflow status
			if (request.method === 'GET' && path.startsWith('/status/')) {
				const instanceId = path.slice('/status/'.length);

				if (!instanceId) {
					return Response.json(
						{ error: 'instanceId is required' },
						{ status: 400, headers: corsHeaders }
					);
				}

				const instance = await env.WORKFLOW.get(instanceId);
				const metadata = await env.WORKFLOW_META.get(`instance:${instanceId}`, 'json');

				return Response.json(
					{
						instanceId,
						status: instance.status,
						output: instance.output,
						error: instance.error,
						metadata,
					},
					{ headers: corsHeaders }
				);
			}

			// GET /health - Health check
			if (request.method === 'GET' && path === '/health') {
				return Response.json(
					{
						status: 'healthy',
						worker: 'durable-executor',
						environment: env.ENVIRONMENT,
					},
					{ headers: corsHeaders }
				);
			}

			return Response.json(
				{ error: 'Not found' },
				{ status: 404, headers: corsHeaders }
			);
		} catch (error) {
			console.error('Durable executor error:', error);
			return Response.json(
				{ error: error instanceof Error ? error.message : 'Internal error' },
				{ status: 500, headers: corsHeaders }
			);
		}
	},
};
