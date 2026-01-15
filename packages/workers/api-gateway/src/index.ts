/**
 * WORKWAY API Gateway
 *
 * Public API for triggering WORKWAY workflows from external consumers.
 *
 * Endpoints:
 * - POST /workflows/{workflowId}/trigger - Execute a workflow
 * - GET /health - Health check
 *
 * Authentication: Bearer token (API key)
 *
 * Philosophy: Fast response, minimal latency. Workflow execution happens inline
 * for synchronous results (spec-intake pattern) or can be queued for async.
 */

import conversationalIntakeAgent from '../../../workflows/src/conversational-intake-agent/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface Env {
	/** KV namespace for API keys: key -> { orgId, name, created, rateLimit } */
	API_KEYS: KVNamespace;
	/** KV namespace for idempotency: idempotencyKey -> { result, timestamp } */
	IDEMPOTENCY: KVNamespace;
	/** KV namespace for workflow storage (passed to workflows) */
	WORKFLOW_STORAGE: KVNamespace;
	/** Workers AI binding */
	AI: Ai;
}

interface APIKeyData {
	orgId: string;
	name: string;
	created: string;
	rateLimit?: number;
	enabled: boolean;
}

interface TriggerRequest {
	event: string;
	data: Record<string, unknown>;
	timestamp?: string;
}

interface TriggerResponse {
	success: boolean;
	executionId?: string;
	message?: string;
	error?: string;
	// Workflow-specific response fields spread here
	[key: string]: unknown;
}

// =============================================================================
// WORKFLOW REGISTRY
// =============================================================================

/**
 * Registry of available workflows
 *
 * Maps workflow ID to its execute function.
 * In production, this could be dynamic (loaded from D1/KV).
 */
const WORKFLOW_REGISTRY: Record<string, typeof conversationalIntakeAgent> = {
	'conversational-intake-agent': conversationalIntakeAgent,
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * CORS headers for cross-origin requests
 */
function corsHeaders(origin?: string): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': origin || '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Organization-ID',
		'Access-Control-Max-Age': '86400',
	};
}

/**
 * JSON response helper
 */
function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
	});
}

/**
 * Validate API key and return key data
 */
async function validateAPIKey(
	authHeader: string | null,
	env: Env
): Promise<{ valid: false; error: string } | { valid: true; keyData: APIKeyData }> {
	if (!authHeader) {
		return { valid: false, error: 'Missing Authorization header' };
	}

	if (!authHeader.startsWith('Bearer ')) {
		return { valid: false, error: 'Invalid Authorization format. Expected: Bearer {token}' };
	}

	const token = authHeader.slice(7);
	if (!token) {
		return { valid: false, error: 'Empty API token' };
	}

	// Look up API key in KV
	const keyData = await env.API_KEYS.get<APIKeyData>(token, 'json');

	if (!keyData) {
		return { valid: false, error: 'Invalid API key' };
	}

	if (!keyData.enabled) {
		return { valid: false, error: 'API key is disabled' };
	}

	return { valid: true, keyData };
}

/**
 * Check idempotency key and return cached result if exists
 */
async function checkIdempotency(
	key: string | null,
	env: Env
): Promise<TriggerResponse | null> {
	if (!key) return null;

	const cached = await env.IDEMPOTENCY.get<TriggerResponse>(key, 'json');
	return cached;
}

/**
 * Store idempotency result (expires after 24 hours)
 */
async function storeIdempotency(
	key: string | null,
	result: TriggerResponse,
	env: Env
): Promise<void> {
	if (!key) return;

	await env.IDEMPOTENCY.put(key, JSON.stringify(result), {
		expirationTtl: 86400, // 24 hours
	});
}

/**
 * Create a mock storage interface for workflows
 */
function createWorkflowStorage(env: Env, executionId: string) {
	const prefix = `exec:${executionId}:`;

	return {
		async get<T = unknown>(key: string): Promise<T | null> {
			return env.WORKFLOW_STORAGE.get<T>(`${prefix}${key}`, 'json');
		},
		async set(key: string, value: unknown): Promise<void> {
			await env.WORKFLOW_STORAGE.put(`${prefix}${key}`, JSON.stringify(value));
		},
		async put(key: string, value: unknown): Promise<void> {
			// Deprecated alias for set
			await this.set(key, value);
		},
		async delete(key: string): Promise<void> {
			await env.WORKFLOW_STORAGE.delete(`${prefix}${key}`);
		},
		async keys(): Promise<string[]> {
			const list = await env.WORKFLOW_STORAGE.list({ prefix });
			return list.keys.map((k) => k.name.slice(prefix.length));
		},
	};
}

/**
 * Create mock integrations object with Workers AI
 */
function createIntegrations(env: Env) {
	return {
		ai: {
			async generateText(options: {
				model: string;
				system?: string;
				prompt: string;
				temperature?: number;
				max_tokens?: number;
			}) {
				try {
					const messages = [];

					if (options.system) {
						messages.push({ role: 'system', content: options.system });
					}
					messages.push({ role: 'user', content: options.prompt });

					const response = await env.AI.run(options.model as BaseAiTextGenerationModels, {
						messages,
						temperature: options.temperature,
						max_tokens: options.max_tokens,
					});

					// Handle response format
					const responseText =
						typeof response === 'object' && response !== null && 'response' in response
							? (response as { response: string }).response
							: String(response);

					return {
						success: true,
						data: { response: responseText },
					};
				} catch (error) {
					console.error('AI generation error:', error);
					return {
						success: false,
						error: error instanceof Error ? error.message : 'AI generation failed',
						data: { response: '' },
					};
				}
			},
		},
	};
}

// =============================================================================
// INPUT NORMALIZATION
// =============================================================================

/**
 * Convert snake_case keys to camelCase
 * API consumers send snake_case, workflows expect camelCase
 */
function snakeToCamel(str: string): string {
	return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Normalize input data from snake_case to camelCase
 */
function normalizeInputs(data: Record<string, unknown>): Record<string, unknown> {
	const normalized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		const camelKey = snakeToCamel(key);
		normalized[camelKey] = value;
	}
	return normalized;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * Health check endpoint
 */
function handleHealth(): Response {
	return jsonResponse({
		status: 'healthy',
		timestamp: new Date().toISOString(),
		version: '1.0.0',
	});
}

/**
 * Workflow trigger endpoint
 */
async function handleTrigger(
	request: Request,
	workflowId: string,
	env: Env,
	origin?: string
): Promise<Response> {
	const headers = corsHeaders(origin);

	// 1. Validate API key
	const authResult = await validateAPIKey(request.headers.get('Authorization'), env);
	if (!authResult.valid) {
		return jsonResponse({ success: false, error: authResult.error }, 401, headers);
	}

	// 2. Check organization access (optional)
	const requestOrgId = request.headers.get('X-Organization-ID');
	if (requestOrgId && requestOrgId !== authResult.keyData.orgId) {
		return jsonResponse(
			{ success: false, error: 'Organization ID mismatch' },
			403,
			headers
		);
	}

	// 3. Check idempotency
	const idempotencyKey = request.headers.get('Idempotency-Key');
	const cachedResult = await checkIdempotency(idempotencyKey, env);
	if (cachedResult) {
		return jsonResponse({ ...cachedResult, cached: true }, 200, headers);
	}

	// 4. Find workflow
	const workflow = WORKFLOW_REGISTRY[workflowId];
	if (!workflow) {
		return jsonResponse(
			{ success: false, error: `Workflow '${workflowId}' not found` },
			404,
			headers
		);
	}

	// 5. Parse request body
	let body: TriggerRequest;
	try {
		body = await request.json();
	} catch {
		return jsonResponse(
			{ success: false, error: 'Invalid JSON body' },
			400,
			headers
		);
	}

	// 6. Generate execution ID
	const executionId = crypto.randomUUID();

	// 7. Execute workflow
	try {
		// Normalize inputs from snake_case to camelCase
		const normalizedInputs = normalizeInputs(body.data);

		// Build execution context
		const context = {
			trigger: {
				type: 'manual',
				data: body.data,
				payload: body.data,
				timestamp: Date.now(),
			},
			inputs: normalizedInputs,
			config: normalizedInputs,
			integrations: createIntegrations(env),
			env,
			storage: createWorkflowStorage(env, executionId),
			runId: executionId,
			userId: authResult.keyData.orgId,
			installationId: authResult.keyData.orgId,
			actions: {} as any,
		};

		// Execute the workflow
		const result = await workflow.execute(context);

		// Build response
		const response: TriggerResponse = {
			success: true,
			executionId,
			message: 'Workflow executed successfully',
			...result,
		};

		// Store idempotency
		await storeIdempotency(idempotencyKey, response, env);

		return jsonResponse(response, 200, headers);
	} catch (error) {
		console.error(`Workflow execution error (${workflowId}):`, error);

		const errorResponse: TriggerResponse = {
			success: false,
			executionId,
			error: error instanceof Error ? error.message : 'Workflow execution failed',
		};

		return jsonResponse(errorResponse, 500, headers);
	}
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const origin = request.headers.get('Origin') || undefined;

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(origin),
			});
		}

		// Route: GET /health
		if (path === '/health' && request.method === 'GET') {
			return handleHealth();
		}

		// Route: POST /workflows/{workflowId}/trigger
		const triggerMatch = path.match(/^\/workflows\/([^/]+)\/trigger$/);
		if (triggerMatch && request.method === 'POST') {
			const workflowId = triggerMatch[1];
			return handleTrigger(request, workflowId, env, origin);
		}

		// 404 for unknown routes
		return jsonResponse(
			{ error: 'Not found', path },
			404,
			corsHeaders(origin)
		);
	},
};
