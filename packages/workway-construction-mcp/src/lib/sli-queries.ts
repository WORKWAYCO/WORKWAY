/**
 * SLI Queries for Agent Observability
 *
 * Provides GraphQL queries and SQL templates for querying agent metrics
 * from Cloudflare Analytics Engine.
 *
 * Query Methods:
 * 1. GraphQL API: https://api.cloudflare.com/client/v4/graphql
 * 2. Analytics Engine SQL: Direct SQL via Cloudflare dashboard
 *
 * @example
 * ```typescript
 * // Using GraphQL API
 * const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${CF_API_TOKEN}`,
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({
 *     query: AGENT_GRAPHQL_QUERIES.toolSuccessRateByTenant,
 *     variables: { accountTag, start, end, tenantId },
 *   }),
 * });
 * ```
 */

import { AgentBlobIndex, AgentDoubleIndex } from './agent-metrics';

// ============================================================================
// SLI Types
// ============================================================================

/**
 * Agent Service Level Indicators
 *
 * Key metrics for monitoring agent health and performance
 */
export interface AgentSLIs {
	// === Tool Performance ===
	/** Percentage of successful tool calls (target: >99%) */
	toolSuccessRate: number;
	/** Median tool latency in milliseconds */
	toolP50Latency: number;
	/** 95th percentile latency (target: <1000ms for most tools) */
	toolP95Latency: number;
	/** 99th percentile latency */
	toolP99Latency: number;
	/** Total tool calls in the period */
	totalToolCalls: number;

	// === AI/Skill Performance ===
	/** Total tokens used across all skill executions */
	totalTokensUsed: number;
	/** Total estimated cost in USD */
	totalCostUsd: number;
	/** Average tokens per skill request */
	avgTokensPerRequest: number;
	/** Skill success rate */
	skillSuccessRate: number;

	// === Error Tracking ===
	/** Overall error rate (target: <1%) */
	errorRate: number;
	/** Rate limit hit rate */
	rateLimitRate: number;
	/** Top tools by error count */
	topErrorTools: Array<{ toolName: string; errorCount: number }>;
	/** Error breakdown by code */
	errorsByCode: Array<{ errorCode: string; count: number }>;

	// === Tenant Attribution ===
	/** Active tenants in the period */
	activeTenants: number;
	/** Top tenants by usage */
	topTenantsByUsage: Array<{ tenantId: string; callCount: number }>;
}

// ============================================================================
// SQL Query Templates
// ============================================================================

/**
 * SQL query templates for Analytics Engine
 *
 * These queries use the workway_agent_metrics dataset.
 * Blob indices (blob1, blob2, etc.) correspond to AgentBlobIndex enum.
 * Double indices (double1, double2, etc.) correspond to AgentDoubleIndex enum.
 *
 * Blob mapping:
 * - blob1: tenantId
 * - blob2: toolName
 * - blob3: toolCategory
 * - blob4: outcome
 * - blob5: model
 * - blob6: errorCode
 *
 * Double mapping:
 * - double1: durationMs
 * - double2: promptTokens
 * - double3: completionTokens
 * - double4: totalTokens
 * - double5: costUsd
 * - double6: timestamp
 */
export const AGENT_SLI_QUERIES = {
	/**
	 * Tool success rate by tenant
	 *
	 * Returns success rate percentage for each tenant in the last hour
	 */
	toolSuccessRateByTenant: `
    SELECT 
      blob1 as tenantId,
      COUNT(*) as total,
      SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) as successes,
      ROUND(SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as successRate
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '1' HOUR
    GROUP BY blob1
    ORDER BY total DESC
  `,

	/**
	 * Overall tool success rate
	 *
	 * Returns aggregate success rate across all tenants
	 */
	overallToolSuccessRate: `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN blob4 = 'error' THEN 1 ELSE 0 END) as errors,
      SUM(CASE WHEN blob4 = 'rate_limited' THEN 1 ELSE 0 END) as rateLimited,
      ROUND(SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as successRate,
      ROUND(SUM(CASE WHEN blob4 = 'error' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as errorRate,
      ROUND(SUM(CASE WHEN blob4 = 'rate_limited' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as rateLimitRate
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '1' HOUR
  `,

	/**
	 * Latency percentiles by tool
	 *
	 * Returns P50, P95, P99 latency for each tool
	 */
	toolLatencyPercentiles: `
    SELECT 
      blob2 as toolName,
      COUNT(*) as callCount,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY double1), 2) as p50Ms,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY double1), 2) as p95Ms,
      ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY double1), 2) as p99Ms,
      ROUND(AVG(double1), 2) as avgMs
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '1' HOUR
      AND blob4 = 'success'
    GROUP BY blob2
    ORDER BY callCount DESC
  `,

	/**
	 * Latency percentiles by category
	 *
	 * Returns P50, P95, P99 latency for each tool category
	 */
	categoryLatencyPercentiles: `
    SELECT 
      blob3 as toolCategory,
      COUNT(*) as callCount,
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY double1), 2) as p50Ms,
      ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY double1), 2) as p95Ms,
      ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY double1), 2) as p99Ms
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '1' HOUR
      AND blob4 = 'success'
    GROUP BY blob3
    ORDER BY callCount DESC
  `,

	/**
	 * Token usage by tenant (last 24 hours)
	 *
	 * Returns total tokens and cost for AI/Skill calls by tenant
	 */
	tokenUsageByTenant: `
    SELECT 
      blob1 as tenantId,
      COUNT(*) as skillCalls,
      ROUND(SUM(double4), 0) as totalTokens,
      ROUND(SUM(double2), 0) as promptTokens,
      ROUND(SUM(double3), 0) as completionTokens,
      ROUND(SUM(double5), 4) as totalCostUsd,
      ROUND(AVG(double4), 2) as avgTokensPerRequest
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '24' HOUR
      AND blob3 = 'skill'
    GROUP BY blob1
    ORDER BY totalTokens DESC
  `,

	/**
	 * Token usage by model
	 *
	 * Returns token usage breakdown by AI model
	 */
	tokenUsageByModel: `
    SELECT 
      blob5 as model,
      COUNT(*) as callCount,
      ROUND(SUM(double4), 0) as totalTokens,
      ROUND(SUM(double5), 4) as totalCostUsd,
      ROUND(AVG(double4), 2) as avgTokensPerRequest,
      ROUND(AVG(double1), 2) as avgLatencyMs
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '24' HOUR
      AND blob3 = 'skill'
      AND blob5 != ''
    GROUP BY blob5
    ORDER BY totalTokens DESC
  `,

	/**
	 * Error breakdown by tool
	 *
	 * Returns error count and codes for each tool
	 */
	errorBreakdownByTool: `
    SELECT 
      blob2 as toolName,
      blob4 as outcome,
      blob6 as errorCode,
      COUNT(*) as count
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '1' HOUR
      AND blob4 != 'success'
    GROUP BY blob2, blob4, blob6
    ORDER BY count DESC
    LIMIT 20
  `,

	/**
	 * Top errors by code
	 *
	 * Returns most common error codes
	 */
	topErrorsByCode: `
    SELECT 
      blob6 as errorCode,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM workway_agent_metrics WHERE timestamp > NOW() - INTERVAL '1' HOUR), 2) as percentageOfTotal
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '1' HOUR
      AND blob4 != 'success'
      AND blob6 != ''
    GROUP BY blob6
    ORDER BY count DESC
    LIMIT 10
  `,

	/**
	 * Tool usage by category
	 *
	 * Returns call counts grouped by tool category
	 */
	toolUsageByCategory: `
    SELECT 
      blob3 as toolCategory,
      COUNT(*) as total,
      SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN blob4 = 'error' THEN 1 ELSE 0 END) as errors,
      ROUND(SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as successRate
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '1' HOUR
    GROUP BY blob3
    ORDER BY total DESC
  `,

	/**
	 * Hourly tool calls trend
	 *
	 * Returns tool call counts per hour for trending
	 */
	hourlyToolCallsTrend: `
    SELECT 
      DATE_TRUNC('hour', timestamp) as hour,
      COUNT(*) as total,
      SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN blob4 != 'success' THEN 1 ELSE 0 END) as failures
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '24' HOUR
    GROUP BY DATE_TRUNC('hour', timestamp)
    ORDER BY hour DESC
  `,

	/**
	 * Active tenants
	 *
	 * Returns count of unique tenants with activity
	 */
	activeTenants: `
    SELECT 
      COUNT(DISTINCT blob1) as activeTenants,
      COUNT(*) as totalCalls
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '24' HOUR
      AND blob1 != 'anonymous'
  `,

	/**
	 * Top tenants by usage
	 *
	 * Returns top 10 tenants by tool call count
	 */
	topTenantsByUsage: `
    SELECT 
      blob1 as tenantId,
      COUNT(*) as callCount,
      ROUND(SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as successRate,
      ROUND(SUM(double5), 4) as totalCostUsd
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '24' HOUR
      AND blob1 != 'anonymous'
    GROUP BY blob1
    ORDER BY callCount DESC
    LIMIT 10
  `,

	/**
	 * Skill performance
	 *
	 * Returns performance metrics for AI/Skill calls
	 */
	skillPerformance: `
    SELECT 
      blob2 as skillName,
      COUNT(*) as callCount,
      ROUND(SUM(CASE WHEN blob4 = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as successRate,
      ROUND(AVG(double1), 2) as avgLatencyMs,
      ROUND(AVG(double4), 2) as avgTokens,
      ROUND(SUM(double5), 4) as totalCostUsd
    FROM workway_agent_metrics
    WHERE timestamp > NOW() - INTERVAL '24' HOUR
      AND blob3 = 'skill'
    GROUP BY blob2
    ORDER BY callCount DESC
  `,
} as const;

// ============================================================================
// GraphQL Queries
// ============================================================================

/**
 * GraphQL queries for Cloudflare Analytics Engine API
 *
 * Use with: https://api.cloudflare.com/client/v4/graphql
 */
export const AGENT_GRAPHQL_QUERIES = {
	/**
	 * Tool success rate by tenant using Analytics Engine adaptive groups
	 */
	toolSuccessRateByTenant: `
    query ToolSuccessRateByTenant($accountTag: String!, $start: Time!, $end: Time!, $tenantId: String!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_agent_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
                { index1: $tenantId }
              ]
            }
            limit: 1000
          ) {
            dimensions {
              outcome: blob4
            }
            count
          }
        }
      }
    }
  `,

	/**
	 * Latency percentiles by tool
	 */
	latencyPercentilesByTool: `
    query LatencyPercentilesByTool($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_agent_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
                { blob4: "success" }
              ]
            }
            orderBy: [count_DESC]
            limit: 100
          ) {
            dimensions {
              toolName: blob2
              toolCategory: blob3
            }
            count
            quantiles: percentiles(field: "double1", points: [0.5, 0.95, 0.99])
          }
        }
      }
    }
  `,

	/**
	 * Token usage summary
	 */
	tokenUsageSummary: `
    query TokenUsageSummary($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_agent_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
                { blob3: "skill" }
              ]
            }
            orderBy: [sum_DESC]
            limit: 100
          ) {
            dimensions {
              tenantId: blob1
              model: blob5
            }
            count
            sum {
              totalTokens: double4
              costUsd: double5
            }
            avg {
              tokensPerRequest: double4
              latencyMs: double1
            }
          }
        }
      }
    }
  `,

	/**
	 * Error breakdown
	 */
	errorBreakdown: `
    query ErrorBreakdown($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_agent_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
                { NOT: { blob4: "success" } }
              ]
            }
            orderBy: [count_DESC]
            limit: 50
          ) {
            dimensions {
              toolName: blob2
              outcome: blob4
              errorCode: blob6
            }
            count
          }
        }
      }
    }
  `,

	/**
	 * Tool calls over time
	 */
	toolCallsOverTime: `
    query ToolCallsOverTime($accountTag: String!, $start: Time!, $end: Time!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workway_agent_metrics: analyticsEngineAdaptiveGroups(
            filter: {
              AND: [
                { datetime_geq: $start }
                { datetime_leq: $end }
              ]
            }
            orderBy: [datetimeHour_ASC]
            limit: 100
          ) {
            dimensions {
              hour: datetimeHour
              outcome: blob4
            }
            count
          }
        }
      }
    }
  `,
} as const;

// ============================================================================
// Query Builder Helpers
// ============================================================================

/**
 * Time range presets for queries
 */
export const TIME_RANGES = {
	LAST_HOUR: () => ({
		start: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
		end: new Date().toISOString(),
	}),
	LAST_24_HOURS: () => ({
		start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
		end: new Date().toISOString(),
	}),
	LAST_7_DAYS: () => ({
		start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
		end: new Date().toISOString(),
	}),
	LAST_30_DAYS: () => ({
		start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
		end: new Date().toISOString(),
	}),
} as const;

/**
 * Build GraphQL query variables
 */
export function buildQueryVariables(
	accountTag: string,
	timeRange: { start: string; end: string },
	additionalVars?: Record<string, unknown>
): Record<string, unknown> {
	return {
		accountTag,
		start: timeRange.start,
		end: timeRange.end,
		...additionalVars,
	};
}

/**
 * Documentation reference for blob/double indices
 *
 * This maps human-readable names to Analytics Engine column names
 * for use in SQL queries.
 */
export const COLUMN_REFERENCE = {
	blobs: {
		tenantId: `blob${AgentBlobIndex.TenantId + 1}`, // blob1
		toolName: `blob${AgentBlobIndex.ToolName + 1}`, // blob2
		toolCategory: `blob${AgentBlobIndex.ToolCategory + 1}`, // blob3
		outcome: `blob${AgentBlobIndex.Outcome + 1}`, // blob4
		model: `blob${AgentBlobIndex.Model + 1}`, // blob5
		errorCode: `blob${AgentBlobIndex.ErrorCode + 1}`, // blob6
	},
	doubles: {
		durationMs: `double${AgentDoubleIndex.DurationMs + 1}`, // double1
		promptTokens: `double${AgentDoubleIndex.PromptTokens + 1}`, // double2
		completionTokens: `double${AgentDoubleIndex.CompletionTokens + 1}`, // double3
		totalTokens: `double${AgentDoubleIndex.TotalTokens + 1}`, // double4
		costUsd: `double${AgentDoubleIndex.CostUsd + 1}`, // double5
		timestamp: `double${AgentDoubleIndex.Timestamp + 1}`, // double6
	},
} as const;
