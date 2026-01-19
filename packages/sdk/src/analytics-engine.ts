/**
 * Analytics Engine Module
 *
 * Uses Cloudflare Analytics Engine for custom metrics, tenant attribution,
 * and business KPIs. Serverless, no external dependencies.
 *
 * Features:
 * - Per-tenant metrics (indexed for fast queries)
 * - Latency tracking (P50/P95/P99)
 * - Error rate monitoring
 * - Token usage attribution
 *
 * Query data via Cloudflare dashboard or GraphQL API.
 *
 * @example
 * ```typescript
 * const analytics = new WorkwayAnalytics(env.ANALYTICS);
 *
 * // Record a successful operation
 * await analytics.recordMetric({
 *   tenantId: 'tenant_123',
 *   workflowId: 'workflow_456',
 *   operation: 'workflow.trigger',
 *   durationMs: 234,
 *   status: 'success',
 * });
 *
 * // Record with token usage
 * await analytics.recordMetric({
 *   tenantId: 'tenant_123',
 *   operation: 'ai.generate',
 *   durationMs: 1500,
 *   status: 'success',
 *   tokensUsed: 150,
 * });
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Metric point to record
 */
export interface MetricPoint {
	/** Tenant identifier (required for attribution) */
	tenantId: string;
	/** Workflow ID if applicable */
	workflowId?: string;
	/** Operation name (e.g., 'workflow.trigger', 'api.health', 'ai.generate') */
	operation: string;
	/** Duration in milliseconds */
	durationMs: number;
	/** Operation status */
	status: 'success' | 'error';
	/** AI tokens used (if applicable) */
	tokensUsed?: number;
	/** HTTP status code (if applicable) */
	statusCode?: number;
	/** Additional string metadata */
	metadata?: string;
}

/**
 * Blob indices for Analytics Engine (max 20 blobs)
 * Order matters for querying!
 */
enum BlobIndex {
	TenantId = 0,
	WorkflowId = 1,
	Operation = 2,
	Status = 3,
	Metadata = 4,
}

/**
 * Double indices for Analytics Engine (max 20 doubles)
 * Order matters for querying!
 */
enum DoubleIndex {
	DurationMs = 0,
	TokensUsed = 1,
	StatusCode = 2,
	Timestamp = 3,
}

/**
 * Common operation names for consistency
 */
export const Operations = {
	// API operations
	API_HEALTH: 'api.health',
	API_TRIGGER: 'api.trigger',
	API_AUTH: 'api.auth',

	// Workflow operations
	WORKFLOW_TRIGGER: 'workflow.trigger',
	WORKFLOW_EXECUTE: 'workflow.execute',
	WORKFLOW_COMPLETE: 'workflow.complete',
	WORKFLOW_ERROR: 'workflow.error',

	// AI operations
	AI_GENERATE: 'ai.generate',
	AI_EMBED: 'ai.embed',

	// Integration operations
	INTEGRATION_CALL: 'integration.call',
	OAUTH_REFRESH: 'oauth.refresh',
} as const;

export type OperationType = (typeof Operations)[keyof typeof Operations];

// ============================================================================
// ANALYTICS CLASS
// ============================================================================

/**
 * Cloudflare Analytics Engine wrapper
 *
 * Provides a typed interface for recording metrics with proper indexing
 * for efficient querying by tenant, operation, and time.
 */
export class WorkwayAnalytics {
	constructor(private analytics: AnalyticsEngineDataset) {}

	/**
	 * Record a metric point
	 *
	 * @example
	 * ```typescript
	 * await analytics.recordMetric({
	 *   tenantId: user.orgId,
	 *   operation: Operations.WORKFLOW_TRIGGER,
	 *   durationMs: Date.now() - startTime,
	 *   status: 'success',
	 * });
	 * ```
	 */
	async recordMetric(metric: MetricPoint): Promise<void> {
		const blobs: string[] = [];
		blobs[BlobIndex.TenantId] = metric.tenantId;
		blobs[BlobIndex.WorkflowId] = metric.workflowId ?? '';
		blobs[BlobIndex.Operation] = metric.operation;
		blobs[BlobIndex.Status] = metric.status;
		blobs[BlobIndex.Metadata] = metric.metadata ?? '';

		const doubles: number[] = [];
		doubles[DoubleIndex.DurationMs] = metric.durationMs;
		doubles[DoubleIndex.TokensUsed] = metric.tokensUsed ?? 0;
		doubles[DoubleIndex.StatusCode] = metric.statusCode ?? 0;
		doubles[DoubleIndex.Timestamp] = Date.now();

		this.analytics.writeDataPoint({
			blobs,
			doubles,
			indexes: [metric.tenantId], // Primary index for tenant queries
		});
	}

	/**
	 * Record a successful operation with timing
	 *
	 * @example
	 * ```typescript
	 * const startTime = Date.now();
	 * const result = await doWork();
	 * await analytics.recordSuccess(tenantId, 'workflow.execute', startTime);
	 * ```
	 */
	async recordSuccess(
		tenantId: string,
		operation: string,
		startTime: number,
		options?: { workflowId?: string; tokensUsed?: number; statusCode?: number }
	): Promise<void> {
		await this.recordMetric({
			tenantId,
			operation,
			durationMs: Date.now() - startTime,
			status: 'success',
			...options,
		});
	}

	/**
	 * Record a failed operation with timing
	 *
	 * @example
	 * ```typescript
	 * const startTime = Date.now();
	 * try {
	 *   await doWork();
	 * } catch (error) {
	 *   await analytics.recordError(tenantId, 'workflow.execute', startTime, error);
	 *   throw error;
	 * }
	 * ```
	 */
	async recordError(
		tenantId: string,
		operation: string,
		startTime: number,
		error?: Error | unknown,
		options?: { workflowId?: string; statusCode?: number }
	): Promise<void> {
		const metadata = error instanceof Error ? error.message.slice(0, 100) : undefined;

		await this.recordMetric({
			tenantId,
			operation,
			durationMs: Date.now() - startTime,
			status: 'error',
			metadata,
			...options,
		});
	}

	/**
	 * Create a timing helper for wrapping async operations
	 *
	 * @example
	 * ```typescript
	 * const result = await analytics.timed(
	 *   tenantId,
	 *   'workflow.execute',
	 *   () => executeWorkflow(params)
	 * );
	 * ```
	 */
	async timed<T>(
		tenantId: string,
		operation: string,
		fn: () => Promise<T>,
		options?: { workflowId?: string }
	): Promise<T> {
		const startTime = Date.now();
		try {
			const result = await fn();
			await this.recordSuccess(tenantId, operation, startTime, options);
			return result;
		} catch (error) {
			await this.recordError(tenantId, operation, startTime, error, options);
			throw error;
		}
	}
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an analytics instance
 *
 * @param analytics - Analytics Engine dataset binding from env
 *
 * @example
 * ```typescript
 * // In a Worker
 * const analytics = createAnalytics(env.ANALYTICS);
 * ```
 */
export function createAnalytics(analytics: AnalyticsEngineDataset): WorkwayAnalytics {
	return new WorkwayAnalytics(analytics);
}

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

/**
 * Example GraphQL queries for Analytics Engine
 *
 * Use these with the Cloudflare GraphQL API:
 * https://api.cloudflare.com/client/v4/graphql
 */
export const AnalyticsQueries = {
	/**
	 * Get latency percentiles by tenant
	 */
	latencyByTenant: `
    query LatencyByTenant($accountTag: String!, $start: Time!, $end: Time!, $tenantId: String!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
                { index1: $tenantId }
              ]
            }
            limit: 1000
          ) {
            quantiles: percentiles(field: "double1", points: [0.5, 0.95, 0.99])
            count
          }
        }
      }
    }
  `,

	/**
	 * Get error rate by operation
	 */
	errorRateByOperation: `
    query ErrorRateByOperation($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
              ]
            }
            orderBy: [count_DESC]
            limit: 100
          ) {
            dimensions {
              operation: blob3
              status: blob4
            }
            count
          }
        }
      }
    }
  `,

	/**
	 * Get token usage by tenant (for billing)
	 */
	tokenUsageByTenant: `
    query TokenUsageByTenant($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
              ]
            }
            orderBy: [sum_DESC]
            limit: 100
          ) {
            dimensions {
              tenantId: blob1
            }
            sum {
              tokensUsed: double2
            }
          }
        }
      }
    }
  `,
};

export default { WorkwayAnalytics, createAnalytics, Operations, AnalyticsQueries };
