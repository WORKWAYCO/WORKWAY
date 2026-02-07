/**
 * Observability Dashboard API
 *
 * Provides endpoints for querying agent metrics, health status, and audit logs.
 * These endpoints are protected by admin API key authentication.
 *
 * Endpoints:
 * - GET /observability/health - System health check
 * - GET /observability/metrics/tools - Tool execution metrics
 * - GET /observability/metrics/latency - Latency percentiles
 * - GET /observability/metrics/ai - AI/Token usage metrics
 * - GET /observability/metrics/errors - Error breakdown
 * - GET /observability/audit-logs - Recent audit logs
 * - GET /observability/status - Real-time status for dashboard polling
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import type {
  HealthCheck,
  HealthCheckResponse,
  ToolMetricsResponse,
  LatencyMetricsResponse,
  AIMetricsResponse,
  ErrorMetricsResponse,
  AuditLogResponse,
  StatusResponse,
  RecentErrors,
  ActiveWorkflows,
  RateLimitStatus,
} from '../types/dashboard';
import { AGENT_SLI_QUERIES, getTimeBoundaries, buildQuery } from '../lib/sli-queries';

const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// Authentication Middleware
// ============================================================================

/**
 * Admin-only authentication for observability routes
 */
app.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');

  // Check for admin API key
  if (!c.env.OBSERVABILITY_API_KEY) {
    // If no key is configured, allow access in development
    if (c.env.ENVIRONMENT === 'development') {
      await next();
      return;
    }
    return c.json({ error: 'Observability API key not configured' }, 500);
  }

  if (authHeader !== `Bearer ${c.env.OBSERVABILITY_API_KEY}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
});

// ============================================================================
// Health Check Endpoint
// ============================================================================

/**
 * GET /health
 *
 * System health check endpoint that verifies connectivity to all dependencies.
 */
app.get('/health', async (c) => {
  const checks = {
    database: await checkDatabase(c.env),
    procore: await checkProcoreConnection(c.env),
    aiGateway: await checkAIGateway(c.env),
  };

  const healthy = Object.values(checks).every(
    (check) => check.status === 'healthy' || check.status === 'not_configured'
  );

  const response: HealthCheckResponse = {
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  };

  return c.json(response, healthy ? 200 : 503);
});

// ============================================================================
// Metrics Endpoints
// ============================================================================

/**
 * GET /metrics/tools
 *
 * Tool execution metrics including success rate and error breakdown.
 */
app.get('/metrics/tools', async (c) => {
  const timeRange = c.req.query('range') || '1h';
  const tenantId = c.req.query('tenant');

  const { startTime, endTime } = getTimeBoundaries(timeRange);

  // Query Analytics Engine for tool metrics
  const metrics = await queryAnalyticsEngine(c.env, {
    query: AGENT_SLI_QUERIES.toolSuccessRate,
    params: {
      startTime,
      endTime,
      tenantId,
    },
  });

  // Transform results
  const byTool = (metrics.data || []).map((row: any) => ({
    name: row.toolName || 'unknown',
    calls: Number(row.total) || 0,
    successRate: Number(row.successRate) || 0,
    errorCount: Number(row.errorCount) || 0,
    rateLimitedCount: Number(row.rateLimitedCount) || 0,
  }));

  const totalCalls = byTool.reduce((sum: number, t: any) => sum + t.calls, 0);
  const totalSuccess = byTool.reduce(
    (sum: number, t: any) => sum + Math.round((t.calls * t.successRate) / 100),
    0
  );

  const response: ToolMetricsResponse = {
    timeRange,
    metrics: {
      totalCalls,
      successRate: totalCalls > 0 ? (totalSuccess / totalCalls) * 100 : 100,
      errorRate: totalCalls > 0 ? 100 - (totalSuccess / totalCalls) * 100 : 0,
      byTool,
    },
  };

  return c.json(response);
});

/**
 * GET /metrics/latency
 *
 * Latency percentiles (p50, p95, p99) for tool executions.
 */
app.get('/metrics/latency', async (c) => {
  const timeRange = c.req.query('range') || '1h';
  const toolName = c.req.query('tool');

  const { startTime, endTime } = getTimeBoundaries(timeRange);

  const metrics = await queryAnalyticsEngine(c.env, {
    query: AGENT_SLI_QUERIES.toolLatencyPercentiles,
    params: {
      startTime,
      endTime,
      toolName,
    },
  });

  // Transform results
  const byTool = (metrics.data || []).map((row: any) => ({
    name: row.toolName || 'unknown',
    p50: Number(row.p50) || 0,
    p95: Number(row.p95) || 0,
    p99: Number(row.p99) || 0,
    avgLatency: Number(row.avgLatency) || 0,
    maxLatency: Number(row.maxLatency) || 0,
    sampleCount: Number(row.sampleCount) || 0,
  }));

  // Calculate aggregate percentiles
  const allP50 = byTool.map((t: any) => t.p50).filter((v: number) => v > 0);
  const allP95 = byTool.map((t: any) => t.p95).filter((v: number) => v > 0);
  const allP99 = byTool.map((t: any) => t.p99).filter((v: number) => v > 0);

  const response: LatencyMetricsResponse = {
    timeRange,
    percentiles: {
      p50: allP50.length > 0 ? Math.round(allP50.reduce((a: number, b: number) => a + b) / allP50.length) : 0,
      p95: allP95.length > 0 ? Math.max(...allP95) : 0,
      p99: allP99.length > 0 ? Math.max(...allP99) : 0,
    },
    byTool,
  };

  return c.json(response);
});

/**
 * GET /metrics/ai
 *
 * AI/Token usage metrics including cost attribution.
 */
app.get('/metrics/ai', async (c) => {
  const timeRange = c.req.query('range') || '24h';
  const tenantId = c.req.query('tenant');

  const { startTime, endTime } = getTimeBoundaries(timeRange);

  const metrics = await queryAnalyticsEngine(c.env, {
    query: AGENT_SLI_QUERIES.tokenUsageByTenant,
    params: {
      startTime,
      endTime,
      tenantId,
    },
  });

  // Group by model and tenant
  const byModel = new Map<string, { tokens: number; promptTokens: number; completionTokens: number; cost: number; requestCount: number }>();
  const byTenant = new Map<string, { tokens: number; cost: number; requestCount: number }>();

  let totalTokens = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostUsd = 0;
  let totalRequests = 0;

  for (const row of metrics.data || []) {
    const model = row.model || 'unknown';
    const tenant = row.tenantId || 'anonymous';
    const tokens = Number(row.totalTokens) || 0;
    const promptTokens = Number(row.promptTokens) || 0;
    const completionTokens = Number(row.completionTokens) || 0;
    const cost = Number(row.totalCostUsd) || 0;
    const requests = Number(row.requestCount) || 0;

    totalTokens += tokens;
    totalPromptTokens += promptTokens;
    totalCompletionTokens += completionTokens;
    totalCostUsd += cost;
    totalRequests += requests;

    // Group by model
    const modelStats = byModel.get(model) || { tokens: 0, promptTokens: 0, completionTokens: 0, cost: 0, requestCount: 0 };
    modelStats.tokens += tokens;
    modelStats.promptTokens += promptTokens;
    modelStats.completionTokens += completionTokens;
    modelStats.cost += cost;
    modelStats.requestCount += requests;
    byModel.set(model, modelStats);

    // Group by tenant
    const tenantStats = byTenant.get(tenant) || { tokens: 0, cost: 0, requestCount: 0 };
    tenantStats.tokens += tokens;
    tenantStats.cost += cost;
    tenantStats.requestCount += requests;
    byTenant.set(tenant, tenantStats);
  }

  const response: AIMetricsResponse = {
    timeRange,
    usage: {
      totalTokens,
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      totalCostUsd,
      avgTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
      byModel: Array.from(byModel.entries()).map(([model, stats]) => ({
        model,
        tokens: stats.tokens,
        promptTokens: stats.promptTokens,
        completionTokens: stats.completionTokens,
        cost: stats.cost,
        requestCount: stats.requestCount,
      })),
      byTenant: Array.from(byTenant.entries()).map(([tenantId, stats]) => ({
        tenantId,
        tokens: stats.tokens,
        cost: stats.cost,
        requestCount: stats.requestCount,
      })),
    },
  };

  return c.json(response);
});

/**
 * GET /metrics/errors
 *
 * Error breakdown by tool and error type.
 */
app.get('/metrics/errors', async (c) => {
  const timeRange = c.req.query('range') || '1h';

  const { startTime, endTime } = getTimeBoundaries(timeRange);

  const metrics = await queryAnalyticsEngine(c.env, {
    query: AGENT_SLI_QUERIES.errorBreakdown,
    params: {
      startTime,
      endTime,
    },
  });

  // Group errors by tool and error type
  const byTool = new Map<string, { errors: number; errorCodes: Map<string, number> }>();
  const byErrorType = new Map<string, number>();
  let totalErrors = 0;
  let rateLimitCount = 0;

  for (const row of metrics.data || []) {
    const toolName = row.toolName || 'unknown';
    const errorCode = row.errorCode || 'UNKNOWN';
    const outcome = row.outcome || 'error';
    const count = Number(row.errorCount) || 0;

    totalErrors += count;

    if (outcome === 'rate_limited') {
      rateLimitCount += count;
    }

    // Group by tool
    const toolStats = byTool.get(toolName) || { errors: 0, errorCodes: new Map() };
    toolStats.errors += count;
    toolStats.errorCodes.set(errorCode, (toolStats.errorCodes.get(errorCode) || 0) + count);
    byTool.set(toolName, toolStats);

    // Group by error type
    byErrorType.set(errorCode, (byErrorType.get(errorCode) || 0) + count);
  }

  const response: ErrorMetricsResponse = {
    timeRange,
    errors: {
      totalErrors,
      rateLimitCount,
      byTool: Array.from(byTool.entries()).map(([name, stats]) => ({
        name,
        errors: stats.errors,
        errorCodes: Array.from(stats.errorCodes.entries()).map(([code, count]) => ({
          code,
          count,
        })),
      })),
      byErrorType: Array.from(byErrorType.entries()).map(([type, count]) => ({
        type,
        count,
      })),
    },
  };

  return c.json(response);
});

// ============================================================================
// Audit Logs Endpoint
// ============================================================================

/**
 * GET /audit-logs
 *
 * Query audit logs with optional filters.
 */
app.get('/audit-logs', async (c) => {
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');
  const eventType = c.req.query('event_type');
  const userId = c.req.query('user_id');
  const toolName = c.req.query('tool_name');

  let query = `
    SELECT * FROM audit_logs
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (eventType) {
    query += ` AND event_type = ?`;
    params.push(eventType);
  }
  if (userId) {
    query += ` AND user_id = ?`;
    params.push(userId);
  }
  if (toolName) {
    query += ` AND tool_name = ?`;
    params.push(toolName);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await c.env.DB.prepare(query).bind(...params).all();

  // Get total count for pagination
  let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`;
  const countParams: string[] = [];

  if (eventType) {
    countQuery += ` AND event_type = ?`;
    countParams.push(eventType);
  }
  if (userId) {
    countQuery += ` AND user_id = ?`;
    countParams.push(userId);
  }
  if (toolName) {
    countQuery += ` AND tool_name = ?`;
    countParams.push(toolName);
  }

  const countResult = await c.env.DB.prepare(countQuery)
    .bind(...countParams)
    .first<{ total: number }>();

  const response: AuditLogResponse = {
    logs: (result.results || []).map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      userId: row.user_id,
      connectionId: row.connection_id,
      toolName: row.tool_name,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      projectId: row.project_id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      requestMethod: row.request_method,
      requestPath: row.request_path,
      responseStatus: row.response_status,
      durationMs: row.duration_ms,
      details: row.details,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    })),
    pagination: {
      limit,
      offset,
      total: countResult?.total || 0,
      hasMore: offset + (result.results?.length || 0) < (countResult?.total || 0),
    },
  };

  return c.json(response);
});

// ============================================================================
// Real-time Status Endpoint
// ============================================================================

/**
 * GET /status
 *
 * Real-time status endpoint for dashboard polling.
 */
app.get('/status', async (c) => {
  const [recentErrors, activeWorkflows, rateLimitStatus] = await Promise.all([
    getRecentErrors(c.env),
    getActiveWorkflows(c.env),
    getRateLimitStatus(c.env),
  ]);

  const status: 'healthy' | 'warning' | 'critical' =
    recentErrors.count > 50 ? 'critical' : recentErrors.count > 10 ? 'warning' : 'healthy';

  const response: StatusResponse = {
    timestamp: new Date().toISOString(),
    status,
    recentErrors,
    activeWorkflows,
    rateLimitStatus,
  };

  return c.json(response);
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check database connectivity
 */
async function checkDatabase(env: Env): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    await env.DB.prepare('SELECT 1').first();
    return {
      status: 'healthy',
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: String(error),
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Check Procore connection status
 */
async function checkProcoreConnection(env: Env): Promise<HealthCheck> {
  try {
    const token = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM oauth_tokens WHERE provider = 'procore'`
    ).first<{ count: number }>();

    return {
      status: (token?.count || 0) > 0 ? 'healthy' : 'not_configured',
      connections: token?.count || 0,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: String(error),
    };
  }
}

/**
 * Check AI Gateway configuration
 */
async function checkAIGateway(env: Env): Promise<HealthCheck> {
  // Check if AI binding is configured
  if (!env.AI) {
    return { status: 'not_configured' };
  }
  return { status: 'healthy' };
}

/**
 * Query Analytics Engine
 *
 * Note: This is a placeholder implementation. In production, this would use
 * the Cloudflare Analytics Engine GraphQL API or SQL API.
 */
async function queryAnalyticsEngine(
  env: Env,
  options: {
    query: string;
    params: {
      startTime: number;
      endTime: number;
      tenantId?: string;
      toolName?: string;
    };
  }
): Promise<{ data: any[] }> {
  // Build the query with parameters
  const _query = buildQuery(options.query, options.params);

  // In a real implementation, this would query Analytics Engine
  // For now, return empty data
  // TODO: Implement Analytics Engine GraphQL API integration
  // See: https://developers.cloudflare.com/analytics/analytics-engine/sql-api/

  // Check if AGENT_METRICS binding exists (Analytics Engine dataset)
  if (!('AGENT_METRICS' in env)) {
    console.debug('[Observability] Analytics Engine not configured, returning empty data');
    return { data: [] };
  }

  // Placeholder: In production, use the Analytics Engine SQL API
  return { data: [] };
}

/**
 * Get recent errors from audit logs
 */
async function getRecentErrors(env: Env): Promise<RecentErrors> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const result = await env.DB.prepare(`
      SELECT 
        tool_name as toolName,
        COALESCE(
          json_extract(details, '$.errorCode'),
          'UNKNOWN'
        ) as errorCode,
        COUNT(*) as count,
        MAX(created_at) as lastOccurrence
      FROM audit_logs
      WHERE created_at >= ?
        AND response_status >= 400
      GROUP BY tool_name, errorCode
      ORDER BY count DESC
      LIMIT 10
    `)
      .bind(oneHourAgo)
      .all();

    const errors = (result.results || []).map((row: any) => ({
      toolName: row.toolName || 'unknown',
      errorCode: row.errorCode || 'UNKNOWN',
      lastOccurrence: row.lastOccurrence || '',
      count: Number(row.count) || 0,
    }));

    return {
      count: errors.reduce((sum, e) => sum + e.count, 0),
      errors,
    };
  } catch (error) {
    console.error('Failed to get recent errors:', error);
    return { count: 0, errors: [] };
  }
}

/**
 * Get active workflows
 */
async function getActiveWorkflows(env: Env): Promise<ActiveWorkflows> {
  try {
    const result = await env.DB.prepare(`
      SELECT 
        w.id,
        w.name,
        w.status,
        (SELECT MAX(started_at) FROM executions WHERE workflow_id = w.id) as lastExecution
      FROM workflows w
      WHERE w.status = 'active'
      ORDER BY w.updated_at DESC
      LIMIT 20
    `).all();

    const workflows = (result.results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      lastExecution: row.lastExecution,
    }));

    return {
      count: workflows.length,
      workflows,
    };
  } catch (error) {
    console.error('Failed to get active workflows:', error);
    return { count: 0, workflows: [] };
  }
}

/**
 * Get rate limit status
 */
async function getRateLimitStatus(env: Env): Promise<RateLimitStatus> {
  // Check rate limiter Durable Object if available
  try {
    // Get rate limit status from the rate limiter DO
    // For now, return default healthy status
    return {
      isLimited: false,
      remaining: 3600, // Procore rate limit
    };
  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    return {
      isLimited: false,
      remaining: 0,
    };
  }
}

export default app;
