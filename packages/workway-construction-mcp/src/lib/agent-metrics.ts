/**
 * Agent Observability Metrics
 *
 * Tracks MCP tool calls, AI usage, and agent performance using
 * Cloudflare Analytics Engine.
 *
 * Features:
 * - Per-tenant metrics (indexed for fast queries)
 * - Tool execution tracking (latency, success/error rates)
 * - AI/Skill token usage and cost attribution
 * - Rate limiting detection
 *
 * Data can be queried via Cloudflare dashboard or GraphQL API.
 *
 * @example
 * ```typescript
 * const metrics = createAgentMetrics(env.AGENT_METRICS);
 *
 * // Track a tool execution
 * const result = await trackToolExecution(
 *   metrics,
 *   'tenant_123',
 *   'workway_list_procore_projects',
 *   'procore',
 *   () => procoreClient.listProjects()
 * );
 *
 * // Track AI/Skill usage
 * trackAIExecution(metrics, 'tenant_123', 'workway_skill_draft_rfi', {
 *   model: 'llama-3.1-8b-instant',
 *   latencyMs: 1500,
 *   usage: { promptTokens: 150, completionTokens: 200, totalTokens: 350 },
 *   cost: { totalCost: 0.0001 },
 * });
 * ```
 */

import { ErrorCode } from './errors';

// ============================================================================
// Types
// ============================================================================

/**
 * Tool categories for MCP server
 *
 * Categories match the toolCategories in src/tools/index.ts:
 * - procore: Procore API integration tools
 * - workflow: Workflow lifecycle tools
 * - skill: AI-powered Intelligence Layer Skills
 * - debug: Debugging and observability tools
 * - notification: Email and Slack notification tools
 */
export type ToolCategory =
	| 'procore'
	| 'workflow'
	| 'skill'
	| 'debug'
	| 'notification'
	| 'template'
	| 'seeder'
	| 'other';

/**
 * Execution outcome for a tool call
 */
export type ExecutionOutcome = 'success' | 'error' | 'rate_limited';

/**
 * Data point for Analytics Engine
 *
 * Analytics Engine uses:
 * - blobs: String fields (max 20) for filtering/grouping
 * - doubles: Numeric fields (max 20) for aggregation
 * - indexes: Primary indexes for fast tenant queries
 */
export interface AgentDataPoint {
	/** Indexed fields for filtering/grouping */
	indexes: {
		/** Tenant/user identifier for attribution */
		tenantId: string;
		/** Tool name (e.g., 'workway_list_procore_projects') */
		toolName: string;
		/** Tool category for grouping */
		toolCategory: ToolCategory;
		/** Execution outcome */
		outcome: ExecutionOutcome;
		/** AI model used (for skill executions) */
		model?: string;
		/** Error code if outcome is error */
		errorCode?: ErrorCode | string;
	};
	/** Numeric fields for aggregation */
	doubles: {
		/** Execution duration in milliseconds */
		durationMs: number;
		/** Prompt tokens used (AI/Skill calls) */
		promptTokens?: number;
		/** Completion tokens used (AI/Skill calls) */
		completionTokens?: number;
		/** Total tokens used (AI/Skill calls) */
		totalTokens?: number;
		/** Estimated cost in USD (AI/Skill calls) */
		costUsd?: number;
	};
}

/**
 * AI Gateway response shape (from Workers AI or external providers)
 */
export interface AIGatewayResponse {
	/** Model identifier */
	model: string;
	/** Latency in milliseconds */
	latencyMs: number;
	/** Token usage */
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	/** Cost breakdown (optional) */
	cost?: {
		promptCost?: number;
		completionCost?: number;
		totalCost: number;
	};
}

/**
 * Agent metrics interface
 */
export interface AgentMetrics {
	/**
	 * Write a data point to Analytics Engine
	 */
	writeDataPoint(point: AgentDataPoint): void;
}

// ============================================================================
// Blob Index Constants
// ============================================================================

/**
 * Blob indices for Analytics Engine (order matters for querying!)
 * Must match the order in writeDataPoint
 */
export enum AgentBlobIndex {
	TenantId = 0,
	ToolName = 1,
	ToolCategory = 2,
	Outcome = 3,
	Model = 4,
	ErrorCode = 5,
}

/**
 * Double indices for Analytics Engine (order matters for querying!)
 * Must match the order in writeDataPoint
 */
export enum AgentDoubleIndex {
	DurationMs = 0,
	PromptTokens = 1,
	CompletionTokens = 2,
	TotalTokens = 3,
	CostUsd = 4,
	Timestamp = 5,
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an agent metrics instance
 *
 * @param analyticsEngine - Analytics Engine dataset binding from env
 *
 * @example
 * ```typescript
 * // In a Worker
 * const metrics = createAgentMetrics(env.AGENT_METRICS);
 * ```
 */
export function createAgentMetrics(analyticsEngine?: AnalyticsEngineDataset): AgentMetrics {
	return {
		writeDataPoint(point: AgentDataPoint): void {
			// If Analytics Engine is not configured, log to console in development
			if (!analyticsEngine) {
				console.debug('[AgentMetrics] Analytics Engine not configured, skipping:', {
					tool: point.indexes.toolName,
					outcome: point.indexes.outcome,
					durationMs: point.doubles.durationMs,
				});
				return;
			}

			// Build blob array (order matches AgentBlobIndex enum)
			const blobs: string[] = [];
			blobs[AgentBlobIndex.TenantId] = point.indexes.tenantId;
			blobs[AgentBlobIndex.ToolName] = point.indexes.toolName;
			blobs[AgentBlobIndex.ToolCategory] = point.indexes.toolCategory;
			blobs[AgentBlobIndex.Outcome] = point.indexes.outcome;
			blobs[AgentBlobIndex.Model] = point.indexes.model || '';
			blobs[AgentBlobIndex.ErrorCode] = point.indexes.errorCode || '';

			// Build doubles array (order matches AgentDoubleIndex enum)
			const doubles: number[] = [];
			doubles[AgentDoubleIndex.DurationMs] = point.doubles.durationMs;
			doubles[AgentDoubleIndex.PromptTokens] = point.doubles.promptTokens || 0;
			doubles[AgentDoubleIndex.CompletionTokens] = point.doubles.completionTokens || 0;
			doubles[AgentDoubleIndex.TotalTokens] = point.doubles.totalTokens || 0;
			doubles[AgentDoubleIndex.CostUsd] = point.doubles.costUsd || 0;
			doubles[AgentDoubleIndex.Timestamp] = Date.now();

			analyticsEngine.writeDataPoint({
				blobs,
				doubles,
				indexes: [point.indexes.tenantId], // Primary index for tenant queries
			});
		},
	};
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine tool category from tool name
 *
 * Maps tool names to categories based on naming convention:
 * - workway_{action}_{provider}_{resource}
 */
export function getToolCategory(toolName: string): ToolCategory {
	// Check for known prefixes
	if (toolName.includes('procore')) return 'procore';
	if (toolName.includes('skill')) return 'skill';
	if (toolName.includes('workflow')) return 'workflow';
	if (toolName.includes('diagnose') || toolName.includes('guidance') || toolName.includes('observe'))
		return 'debug';
	if (toolName.includes('notification') || toolName.includes('send') || toolName.includes('alert'))
		return 'notification';
	if (toolName.includes('template')) return 'template';
	if (toolName.includes('seed') || toolName.includes('test_sample')) return 'seeder';

	return 'other';
}

/**
 * Extract tenant ID from tool input
 *
 * Looks for common tenant identifier fields in the input
 */
export function extractTenantId(input: Record<string, unknown>): string {
	// Try common tenant identifier fields
	if (typeof input.connection_id === 'string') return input.connection_id;
	if (typeof input.user_id === 'string') return input.user_id;
	if (typeof input.tenant_id === 'string') return input.tenant_id;

	// Default to anonymous
	return 'anonymous';
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
	if (error instanceof Error) {
		// Check error message
		if (error.message.toLowerCase().includes('rate limit')) return true;
		if (error.message.includes('429')) return true;

		// Check for error code property
		if ('code' in error) {
			const code = (error as { code: unknown }).code;
			if (code === ErrorCode.PROCORE_RATE_LIMITED) return true;
			if (code === 'PROCORE_RATE_LIMITED') return true;
		}
	}

	return false;
}

/**
 * Extract error code from an error
 */
export function extractErrorCode(error: unknown): string {
	if (error instanceof Error && 'code' in error) {
		return String((error as { code: unknown }).code);
	}
	return 'UNKNOWN_ERROR';
}

/**
 * Track tool execution with automatic metrics recording
 *
 * Wraps a tool execution function and records:
 * - Execution duration
 * - Success/error/rate_limited outcome
 * - Error codes on failure
 *
 * @example
 * ```typescript
 * const result = await trackToolExecution(
 *   metrics,
 *   'tenant_123',
 *   'workway_list_procore_projects',
 *   'procore',
 *   () => procoreClient.listProjects()
 * );
 * ```
 */
export async function trackToolExecution<T>(
	metrics: AgentMetrics,
	tenantId: string,
	toolName: string,
	toolCategory: ToolCategory,
	fn: () => Promise<T>
): Promise<T> {
	const startTime = Date.now();
	let outcome: ExecutionOutcome = 'success';
	let errorCode: string | undefined;

	try {
		return await fn();
	} catch (error) {
		if (isRateLimitError(error)) {
			outcome = 'rate_limited';
			errorCode = ErrorCode.PROCORE_RATE_LIMITED;
		} else {
			outcome = 'error';
			errorCode = extractErrorCode(error);
		}
		throw error;
	} finally {
		metrics.writeDataPoint({
			indexes: {
				tenantId,
				toolName,
				toolCategory,
				outcome,
				errorCode,
			},
			doubles: {
				durationMs: Date.now() - startTime,
			},
		});
	}
}

/**
 * Track AI/Skill execution with token usage metrics
 *
 * Records AI-specific metrics including:
 * - Model identifier
 * - Token usage (prompt, completion, total)
 * - Cost attribution
 *
 * @example
 * ```typescript
 * trackAIExecution(metrics, 'tenant_123', 'workway_skill_draft_rfi', {
 *   model: 'llama-3.1-8b-instant',
 *   latencyMs: 1500,
 *   usage: { promptTokens: 150, completionTokens: 200, totalTokens: 350 },
 *   cost: { totalCost: 0.0001 },
 * });
 * ```
 */
export function trackAIExecution(
	metrics: AgentMetrics,
	tenantId: string,
	toolName: string,
	aiResponse: AIGatewayResponse
): void {
	metrics.writeDataPoint({
		indexes: {
			tenantId,
			toolName,
			toolCategory: 'skill',
			outcome: 'success',
			model: aiResponse.model,
		},
		doubles: {
			durationMs: aiResponse.latencyMs,
			promptTokens: aiResponse.usage.promptTokens,
			completionTokens: aiResponse.usage.completionTokens,
			totalTokens: aiResponse.usage.totalTokens,
			costUsd: aiResponse.cost?.totalCost || 0,
		},
	});
}

/**
 * Track AI/Skill execution failure
 *
 * Records failed AI calls with error information
 */
export function trackAIExecutionError(
	metrics: AgentMetrics,
	tenantId: string,
	toolName: string,
	durationMs: number,
	error: unknown
): void {
	const errorCode = extractErrorCode(error);
	const outcome: ExecutionOutcome = isRateLimitError(error) ? 'rate_limited' : 'error';

	metrics.writeDataPoint({
		indexes: {
			tenantId,
			toolName,
			toolCategory: 'skill',
			outcome,
			errorCode,
		},
		doubles: {
			durationMs,
		},
	});
}

// ============================================================================
// Aggregated Metrics Helpers
// ============================================================================

/**
 * Batch metrics for efficient recording
 *
 * Use when you need to record multiple related data points
 */
export interface MetricsBatch {
	add(point: AgentDataPoint): void;
	flush(): void;
}

/**
 * Create a metrics batch for efficient recording
 *
 * Batches multiple data points and writes them together
 *
 * @example
 * ```typescript
 * const batch = createMetricsBatch(metrics);
 * batch.add({ ... });
 * batch.add({ ... });
 * batch.flush();
 * ```
 */
export function createMetricsBatch(metrics: AgentMetrics): MetricsBatch {
	const points: AgentDataPoint[] = [];

	return {
		add(point: AgentDataPoint): void {
			points.push(point);
		},
		flush(): void {
			for (const point of points) {
				metrics.writeDataPoint(point);
			}
			points.length = 0;
		},
	};
}
