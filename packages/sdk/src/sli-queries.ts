/**
 * SLI Queries Module
 *
 * GraphQL queries for Service Level Indicators using Cloudflare Analytics Engine.
 * Use with the Cloudflare GraphQL API to build dashboards and alerts.
 *
 * @example
 * ```typescript
 * import { SLIQueries, querySLI } from '@workwayco/sdk';
 *
 * const latency = await querySLI(
 *   apiToken,
 *   accountTag,
 *   SLIQueries.latencyPercentiles,
 *   { start: '2024-01-01T00:00:00Z', end: '2024-01-02T00:00:00Z' }
 * );
 * ```
 */

// =============================================================================
// SLO TARGETS
// =============================================================================

/**
 * Service Level Objective targets
 */
export const SLOTargets = {
	/** P50 latency target in milliseconds */
	LATENCY_P50_MS: 100,
	/** P95 latency target in milliseconds */
	LATENCY_P95_MS: 300,
	/** P99 latency target in milliseconds */
	LATENCY_P99_MS: 500,
	/** Availability target (99.9%) */
	AVAILABILITY_PERCENT: 99.9,
	/** Error rate target (0.1%) */
	ERROR_RATE_PERCENT: 0.1,
} as const;

// =============================================================================
// GRAPHQL QUERIES
// =============================================================================

/**
 * GraphQL queries for Analytics Engine SLIs
 *
 * All queries use the workway_metrics dataset and expect:
 * - $accountTag: Cloudflare account ID
 * - $start: Start time (ISO 8601)
 * - $end: End time (ISO 8601)
 */
export const SLIQueries = {
	/**
	 * Get latency percentiles (P50, P95, P99)
	 */
	latencyPercentiles: `
    query LatencyPercentiles($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
              ]
            }
            limit: 1
          ) {
            percentiles: percentiles(field: "double1", points: [0.5, 0.95, 0.99])
            count
            avg {
              latencyMs: double1
            }
          }
        }
      }
    }
  `,

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
            limit: 1
          ) {
            percentiles: percentiles(field: "double1", points: [0.5, 0.95, 0.99])
            count
          }
        }
      }
    }
  `,

	/**
	 * Get availability (success rate)
	 */
	availability: `
    query Availability($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          success: analyticsEngineAdaptiveGroups(
            dataset: "workway_metrics"
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
                { blob4: "success" }
              ]
            }
          ) {
            count
          }
          total: analyticsEngineAdaptiveGroups(
            dataset: "workway_metrics"
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
              ]
            }
          ) {
            count
          }
        }
      }
    }
  `,

	/**
	 * Get error breakdown by operation
	 */
	errorsByOperation: `
    query ErrorsByOperation($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
                { blob4: "error" }
              ]
            }
            orderBy: [count_DESC]
            limit: 20
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
	 * Get request throughput over time
	 */
	throughput: `
    query Throughput($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
              ]
            }
            orderBy: [datetime_ASC]
            limit: 1000
          ) {
            dimensions {
              datetime
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
            count
          }
        }
      }
    }
  `,

	/**
	 * Get top operations by latency
	 */
	slowestOperations: `
    query SlowestOperations($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
              ]
            }
            orderBy: [avg_DESC]
            limit: 20
          ) {
            dimensions {
              operation: blob3
            }
            avg {
              latencyMs: double1
            }
            percentiles: percentiles(field: "double1", points: [0.99])
            count
          }
        }
      }
    }
  `,
};

// =============================================================================
// QUERY HELPER
// =============================================================================

/**
 * Result from SLI query
 */
export interface SLIQueryResult<T = unknown> {
	data: T | null;
	errors?: Array<{ message: string }>;
}

/**
 * Execute an SLI query against Cloudflare Analytics Engine
 *
 * @param apiToken - Cloudflare API token with analytics read permission
 * @param accountTag - Cloudflare account ID
 * @param query - GraphQL query from SLIQueries
 * @param variables - Query variables
 *
 * @example
 * ```typescript
 * const result = await querySLI(
 *   env.CF_API_TOKEN,
 *   env.CF_ACCOUNT_ID,
 *   SLIQueries.latencyPercentiles,
 *   {
 *     start: new Date(Date.now() - 3600000).toISOString(),
 *     end: new Date().toISOString(),
 *   }
 * );
 *
 * if (result.data) {
 *   console.log('P99 latency:', result.data.viewer.accounts[0].workway_metrics[0].percentiles[2]);
 * }
 * ```
 */
export async function querySLI<T = unknown>(
	apiToken: string,
	accountTag: string,
	query: string,
	variables: Record<string, unknown> = {}
): Promise<SLIQueryResult<T>> {
	const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query,
			variables: {
				accountTag,
				...variables,
			},
		}),
	});

	if (!response.ok) {
		throw new Error(`Analytics API error: ${response.status}`);
	}

	return response.json() as Promise<SLIQueryResult<T>>;
}

// =============================================================================
// SLI CALCULATIONS
// =============================================================================

/**
 * Calculate availability from success/total counts
 */
export function calculateAvailability(
	successCount: number,
	totalCount: number
): number {
	if (totalCount === 0) return 100;
	return (successCount / totalCount) * 100;
}

/**
 * Calculate error rate from error/total counts
 */
export function calculateErrorRate(
	errorCount: number,
	totalCount: number
): number {
	if (totalCount === 0) return 0;
	return (errorCount / totalCount) * 100;
}

/**
 * Check if SLO is being met
 */
export interface SLOStatus {
	name: string;
	target: number;
	actual: number;
	unit: string;
	isMet: boolean;
	margin: number;
}

/**
 * Check latency SLO status
 */
export function checkLatencySLO(
	percentile: 'p50' | 'p95' | 'p99',
	actualMs: number
): SLOStatus {
	const targets = {
		p50: SLOTargets.LATENCY_P50_MS,
		p95: SLOTargets.LATENCY_P95_MS,
		p99: SLOTargets.LATENCY_P99_MS,
	};

	const target = targets[percentile];

	return {
		name: `Latency ${percentile.toUpperCase()}`,
		target,
		actual: actualMs,
		unit: 'ms',
		isMet: actualMs <= target,
		margin: target - actualMs,
	};
}

/**
 * Check availability SLO status
 */
export function checkAvailabilitySLO(actualPercent: number): SLOStatus {
	return {
		name: 'Availability',
		target: SLOTargets.AVAILABILITY_PERCENT,
		actual: actualPercent,
		unit: '%',
		isMet: actualPercent >= SLOTargets.AVAILABILITY_PERCENT,
		margin: actualPercent - SLOTargets.AVAILABILITY_PERCENT,
	};
}

/**
 * Check error rate SLO status
 */
export function checkErrorRateSLO(actualPercent: number): SLOStatus {
	return {
		name: 'Error Rate',
		target: SLOTargets.ERROR_RATE_PERCENT,
		actual: actualPercent,
		unit: '%',
		isMet: actualPercent <= SLOTargets.ERROR_RATE_PERCENT,
		margin: SLOTargets.ERROR_RATE_PERCENT - actualPercent,
	};
}

export default {
	SLOTargets,
	SLIQueries,
	querySLI,
	calculateAvailability,
	calculateErrorRate,
	checkLatencySLO,
	checkAvailabilitySLO,
	checkErrorRateSLO,
};
