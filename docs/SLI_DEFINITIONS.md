# WORKWAY Service Level Indicators

This document defines the Service Level Indicators (SLIs) and Service Level Objectives (SLOs) for WORKWAY.

## Overview

SLIs measure the quality of service delivery. SLOs define the target levels for those measurements.

## Latency

**Definition**: Time from request received to response sent.

| Percentile | Target | Measurement |
|------------|--------|-------------|
| P50 | < 100ms | 50% of requests complete within 100ms |
| P95 | < 300ms | 95% of requests complete within 300ms |
| P99 | < 500ms | 99% of requests complete within 500ms |

**Query**: Analytics Engine `double1` (durationMs)

```graphql
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
```

## Availability

**Definition**: Percentage of requests that complete successfully.

| Metric | Target | Formula |
|--------|--------|---------|
| Availability | 99.9% | successful_requests / total_requests × 100 |

**Calculation**:
- Success: `blob4 = 'success'` (status field)
- Total: All recorded metrics

```graphql
query Availability($accountTag: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      success: workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { 
          datetime_geq: $start, 
          datetime_leq: $end,
          blob4: "success"
        }
      ) {
        count
      }
      total: workway_metrics: analyticsEngineAdaptiveGroups(
        filter: { datetime_geq: $start, datetime_leq: $end }
      ) {
        count
      }
    }
  }
}
```

## Error Rate

**Definition**: Percentage of requests that result in errors.

| Metric | Target | Formula |
|--------|--------|---------|
| Error Rate | < 0.1% | error_requests / total_requests × 100 |

**Error Types**:
- `status: 'error'` - Application errors
- HTTP 5xx - Server errors
- HTTP 4xx - Client errors (not counted in error rate)

## Throughput

**Definition**: Number of requests processed per time period.

| Metric | Measurement |
|--------|-------------|
| Requests/minute | Count of metrics in 1-minute windows |
| Requests/hour | Count of metrics in 1-hour windows |

## Token Usage (AI Operations)

**Definition**: AI tokens consumed for billing and capacity planning.

| Metric | Field |
|--------|-------|
| Total Tokens | `double2` (tokensUsed) sum |
| Tokens per Tenant | `double2` sum grouped by `blob1` (tenantId) |

```graphql
query TokenUsage($accountTag: String!, $start: Time!, $end: Time!) {
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
        sum {
          tokens: double2
        }
      }
    }
  }
}
```

## SLO Targets Summary

| SLI | SLO Target | Burn Rate Alert |
|-----|------------|-----------------|
| P99 Latency | < 500ms | > 600ms for 5 min |
| Availability | 99.9% | < 99.5% for 5 min |
| Error Rate | < 0.1% | > 1% for 5 min |

## Alerting

Alerts should fire when:
1. **Fast burn**: SLO exhausted in < 1 hour (high severity)
2. **Slow burn**: SLO exhausted in < 1 day (medium severity)

Example alert thresholds:
- Latency P99 > 600ms for 5 consecutive minutes
- Error rate > 1% for 5 consecutive minutes
- Availability < 99.5% over 1 hour window

## Dashboard Views

### Executive View
- Overall availability (last 24h)
- P99 latency trend
- Error rate trend
- Total requests

### Operational View
- Real-time latency percentiles
- Error breakdown by type
- Request rate (req/s)
- Top errors

### Tenant View (per customer)
- Per-tenant latency
- Per-tenant error rate
- Token usage
- Cost attribution

## Data Retention

Analytics Engine retains data for 90 days. For longer retention:
1. Export to R2 (daily/weekly)
2. Use Logpush to external storage
3. Aggregate metrics to summary tables

## Query Examples

See `packages/sdk/src/analytics-engine.ts` for ready-to-use GraphQL queries:

```typescript
import { AnalyticsQueries } from '@workwayco/sdk';

// Use with Cloudflare GraphQL API
const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: AnalyticsQueries.latencyByTenant,
    variables: { accountTag, start, end, tenantId },
  }),
});
```
