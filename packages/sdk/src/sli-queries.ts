/**
 * SLI Queries for Analytics Engine
 *
 * Pre-built GraphQL queries for monitoring Service Level Indicators.
 * Use with Cloudflare GraphQL API to query workway_metrics dataset.
 *
 * @see docs/SLI_DEFINITIONS.md for SLI targets and thresholds
 *
 * @example
 * ```typescript
 * import { SLI_QUERIES } from '@workwayco/sdk';
 *
 * const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${apiToken}`,
 *     'Content-Type': 'application/json',
 *   },
 *   body: JSON.stringify({
 *     query: SLI_QUERIES.latencyPercentiles,
 *     variables: { accountTag, start, end },
 *   }),
 * });
 * ```
 */

// =============================================================================
// LATENCY QUERIES
// =============================================================================

/**
 * Query latency percentiles (P50, P95, P99)
 *
 * Returns percentile values for request duration in milliseconds.
 * Field: double1 (durationMs)
 *
 * SLO Targets:
 * - P50 < 100ms
 * - P95 < 300ms
 * - P99 < 500ms
 */
export const latencyPercentiles = `
query LatencyPercentiles($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        limit: 1
      ) {
        p50: percentiles(field: "double1", points: [0.5])
        p95: percentiles(field: "double1", points: [0.95])
        p99: percentiles(field: "double1", points: [0.99])
      }
    }
  }
}
`;

/**
 * Query latency by tenant
 *
 * Returns P95 latency grouped by tenant for multi-tenant attribution.
 */
export const latencyByTenant = `
query LatencyByTenant($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        orderBy: [avg_DESC]
        limit: 100
      ) {
        dimensions {
          tenantId: blob1
        }
        p95: percentiles(field: "double1", points: [0.95])
        avg: avg(field: "double1")
        count
      }
    }
  }
}
`;

/**
 * Query latency by operation (endpoint)
 *
 * Returns latency metrics grouped by API operation.
 */
export const latencyByOperation = `
query LatencyByOperation($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        orderBy: [avg_DESC]
        limit: 50
      ) {
        dimensions {
          operation: blob3
        }
        p50: percentiles(field: "double1", points: [0.5])
        p95: percentiles(field: "double1", points: [0.95])
        p99: percentiles(field: "double1", points: [0.99])
        avg: avg(field: "double1")
        count
      }
    }
  }
}
`;

// =============================================================================
// AVAILABILITY QUERIES
// =============================================================================

/**
 * Query overall availability
 *
 * Returns success rate as percentage.
 * Compares blob4='success' vs all requests.
 *
 * SLO Target: > 99.9%
 */
export const availability = `
query Availability($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      success: analyticsEngineAdaptiveGroups(
        filter: {
          datetime_geq: $start,
          datetime_leq: $end,
          blob4: "success"
        }
        limit: 1
      ) {
        count
      }
      total: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        limit: 1
      ) {
        count
      }
    }
  }
}
`;

/**
 * Query availability by tenant
 *
 * Returns per-tenant success rates for SLA reporting.
 */
export const availabilityByTenant = `
query AvailabilityByTenant($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        orderBy: [count_DESC]
        limit: 100
      ) {
        dimensions {
          tenantId: blob1
          status: blob4
        }
        count
      }
    }
  }
}
`;

// =============================================================================
// ERROR RATE QUERIES
// =============================================================================

/**
 * Query error rate
 *
 * Returns error percentage.
 * Compares blob4='error' vs all requests.
 *
 * SLO Target: < 0.1%
 */
export const errorRate = `
query ErrorRate($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      errors: analyticsEngineAdaptiveGroups(
        filter: {
          datetime_geq: $start,
          datetime_leq: $end,
          blob4: "error"
        }
        limit: 1
      ) {
        count
      }
      total: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        limit: 1
      ) {
        count
      }
    }
  }
}
`;

/**
 * Query errors by operation
 *
 * Returns error count grouped by operation for debugging.
 */
export const errorsByOperation = `
query ErrorsByOperation($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: {
          datetime_geq: $start,
          datetime_leq: $end,
          blob4: "error"
        }
        orderBy: [count_DESC]
        limit: 50
      ) {
        dimensions {
          operation: blob3
        }
        count
      }
    }
  }
}
`;

/**
 * Query errors by tenant
 *
 * Returns error count grouped by tenant for incident investigation.
 */
export const errorsByTenant = `
query ErrorsByTenant($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: {
          datetime_geq: $start,
          datetime_leq: $end,
          blob4: "error"
        }
        orderBy: [count_DESC]
        limit: 100
      ) {
        dimensions {
          tenantId: blob1
        }
        count
      }
    }
  }
}
`;

// =============================================================================
// WORKFLOW SUCCESS QUERIES
// =============================================================================

/**
 * Query workflow execution success rate
 *
 * Returns success rate for workflow executions.
 * Grouped by workflowId (blob2).
 */
export const workflowSuccess = `
query WorkflowSuccess($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        orderBy: [count_DESC]
        limit: 100
      ) {
        dimensions {
          workflowId: blob2
          status: blob4
        }
        count
      }
    }
  }
}
`;

/**
 * Query workflow performance
 *
 * Returns latency and success metrics per workflow.
 */
export const workflowPerformance = `
query WorkflowPerformance($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        orderBy: [count_DESC]
        limit: 100
      ) {
        dimensions {
          workflowId: blob2
        }
        p95: percentiles(field: "double1", points: [0.95])
        avg: avg(field: "double1")
        count
      }
    }
  }
}
`;

// =============================================================================
// TOKEN USAGE QUERIES
// =============================================================================

/**
 * Query token usage
 *
 * Returns AI token consumption for billing and capacity planning.
 * Field: double2 (tokensUsed)
 */
export const tokenUsage = `
query TokenUsage($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        limit: 1
      ) {
        total: sum(field: "double2")
        avg: avg(field: "double2")
      }
    }
  }
}
`;

/**
 * Query token usage by tenant
 *
 * Returns per-tenant token consumption for cost attribution.
 */
export const tokenUsageByTenant = `
query TokenUsageByTenant($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        orderBy: [sum_DESC]
        limit: 100
      ) {
        dimensions {
          tenantId: blob1
        }
        total: sum(field: "double2")
        avg: avg(field: "double2")
        count
      }
    }
  }
}
`;

// =============================================================================
// THROUGHPUT QUERIES
// =============================================================================

/**
 * Query request throughput
 *
 * Returns request count over time for capacity planning.
 */
export const throughput = `
query Throughput($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        limit: 1
      ) {
        count
      }
    }
  }
}
`;

/**
 * Query throughput by operation
 *
 * Returns request count grouped by operation.
 */
export const throughputByOperation = `
query ThroughputByOperation($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
        orderBy: [count_DESC]
        limit: 50
      ) {
        dimensions {
          operation: blob3
        }
        count
      }
    }
  }
}
`;

// =============================================================================
// EXPORT ALL QUERIES
// =============================================================================

export const SLI_QUERIES = {
	// Latency
	latencyPercentiles,
	latencyByTenant,
	latencyByOperation,

	// Availability
	availability,
	availabilityByTenant,

	// Error Rate
	errorRate,
	errorsByOperation,
	errorsByTenant,

	// Workflow Success
	workflowSuccess,
	workflowPerformance,

	// Token Usage
	tokenUsage,
	tokenUsageByTenant,

	// Throughput
	throughput,
	throughputByOperation,
} as const;

export default SLI_QUERIES;
