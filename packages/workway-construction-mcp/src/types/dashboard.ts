/**
 * Dashboard and Observability Types
 *
 * Type definitions for the observability dashboard API responses.
 */

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded' | 'not_configured';
  latencyMs?: number;
  error?: string;
  connections?: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: HealthCheck;
    procore: HealthCheck;
    aiGateway: HealthCheck;
  };
  timestamp: string;
}

// ============================================================================
// Dashboard Metrics Types
// ============================================================================

export interface DashboardMetrics {
  tools: ToolMetrics;
  latency: LatencyMetrics;
  ai: AIMetrics;
  errors: ErrorMetrics;
}

export interface ToolMetrics {
  totalCalls: number;
  successRate: number;
  errorRate: number;
  byTool: Array<{
    name: string;
    calls: number;
    successRate: number;
  }>;
}

export interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  byTool: Array<{
    name: string;
    p50: number;
    p95: number;
    p99: number;
  }>;
}

export interface AIMetrics {
  totalTokens: number;
  totalCostUsd: number;
  avgTokensPerRequest: number;
  byModel: Array<{
    model: string;
    tokens: number;
    cost: number;
  }>;
  byTenant?: Array<{
    tenantId: string;
    tokens: number;
    cost: number;
  }>;
}

export interface ErrorMetrics {
  totalErrors: number;
  rateLimitCount: number;
  byTool: Array<{
    name: string;
    errors: number;
  }>;
  byErrorType: Array<{
    type: string;
    count: number;
  }>;
}

// ============================================================================
// Audit Log Types
// ============================================================================

export interface AuditLogEntry {
  id: string;
  eventType: string;
  userId: string;
  connectionId?: string;
  toolName?: string;
  resourceType?: string;
  resourceId?: string;
  projectId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  responseStatus?: number;
  durationMs?: number;
  details?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface AuditLogResponse {
  logs: AuditLogEntry[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Real-time Status Types
// ============================================================================

export interface RecentErrors {
  count: number;
  errors: Array<{
    toolName: string;
    errorCode: string;
    lastOccurrence: string;
    count: number;
  }>;
}

export interface ActiveWorkflows {
  count: number;
  workflows: Array<{
    id: string;
    name: string;
    status: string;
    lastExecution?: string;
  }>;
}

export interface RateLimitStatus {
  isLimited: boolean;
  remaining: number;
  resetAt?: string;
}

export interface StatusResponse {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  recentErrors: RecentErrors;
  activeWorkflows: ActiveWorkflows;
  rateLimitStatus: RateLimitStatus;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ToolMetricsResponse {
  timeRange: string;
  metrics: {
    totalCalls: number;
    successRate: number;
    errorRate: number;
    byTool: Array<{
      name: string;
      calls: number;
      successRate: number;
      errorCount: number;
      rateLimitedCount: number;
    }>;
  };
}

export interface LatencyMetricsResponse {
  timeRange: string;
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
  byTool: Array<{
    name: string;
    p50: number;
    p95: number;
    p99: number;
    avgLatency: number;
    maxLatency: number;
    sampleCount: number;
  }>;
}

export interface AIMetricsResponse {
  timeRange: string;
  usage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalCostUsd: number;
    avgTokensPerRequest: number;
    byModel: Array<{
      model: string;
      tokens: number;
      promptTokens: number;
      completionTokens: number;
      cost: number;
      requestCount: number;
    }>;
    byTenant?: Array<{
      tenantId: string;
      tokens: number;
      cost: number;
      requestCount: number;
    }>;
  };
}

export interface ErrorMetricsResponse {
  timeRange: string;
  errors: {
    totalErrors: number;
    rateLimitCount: number;
    byTool: Array<{
      name: string;
      errors: number;
      errorCodes: Array<{
        code: string;
        count: number;
      }>;
    }>;
    byErrorType: Array<{
      type: string;
      count: number;
    }>;
  };
}

// ============================================================================
// Query Options Types
// ============================================================================

export interface QueryOptions {
  timeRange?: string;
  tenantId?: string;
  toolName?: string;
  limit?: number;
  offset?: number;
}

export interface AnalyticsQueryResult<T = unknown> {
  data: T;
  meta: {
    query: string;
    executionTimeMs: number;
    rowCount: number;
  };
}
