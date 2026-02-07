/**
 * Audit Logger
 * 
 * Security compliance logging for all sensitive operations.
 * Logs tool executions, OAuth events, data access, and token refreshes.
 */

import type { Env } from '../types';

// ============================================================================
// Types
// ============================================================================

export type AuditEventType = 
  | 'tool_execution'
  | 'oauth_callback'
  | 'oauth_initiate'
  | 'data_access'
  | 'token_refresh'
  | 'rate_limit_exceeded'
  | 'authentication_failure'
  | 'authorization_failure'
  | 'ai_usage';

export type ResourceType = 
  | 'rfi'
  | 'daily_log'
  | 'submittal'
  | 'project'
  | 'company'
  | 'document'
  | 'photo'
  | 'schedule'
  | 'webhook'
  | 'workflow'
  | 'user'
  | 'token';

export interface AuditEvent {
  eventType: AuditEventType;
  userId: string;
  connectionId?: string;
  toolName?: string;
  resourceType?: ResourceType;
  resourceId?: string;
  projectId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
  responseStatus?: number;
  durationMs?: number;
  details?: Record<string, unknown>;
  errorMessage?: string;
}

export interface AuditLogEntry {
  id: string;
  eventType: AuditEventType;
  userId: string;
  connectionId?: string;
  toolName?: string;
  resourceType?: ResourceType;
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
  // AI usage fields (populated when eventType === 'ai_usage')
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  cached?: boolean;
}

/**
 * AI usage event for tracking LLM calls through AI Gateway
 */
export interface AIUsageEvent {
  /** Tool or skill name that made the AI call */
  toolName: string;
  /** User who initiated the request */
  userId: string;
  /** Connection ID if applicable */
  connectionId?: string;
  /** Project ID for construction context */
  projectId?: string;
  /** AI model used */
  model: string;
  /** Tokens in the prompt */
  promptTokens: number;
  /** Tokens in the completion */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
  /** Estimated cost in USD */
  cost?: number;
  /** Request latency in milliseconds */
  latencyMs: number;
  /** Whether response was served from cache */
  cached: boolean;
  /** Provider (anthropic, openai, workers-ai) */
  provider?: string;
  /** Whether the request was successful */
  success?: boolean;
  /** Error message if failed */
  errorMessage?: string;
}

// ============================================================================
// Main Logger
// ============================================================================

/**
 * Log an audit event to the database
 */
export async function logAuditEvent(env: Env, event: AuditEvent): Promise<string> {
  const id = crypto.randomUUID();
  
  try {
    await env.DB.prepare(`
      INSERT INTO audit_logs (
        id, event_type, user_id, connection_id, tool_name,
        resource_type, resource_id, project_id, ip_address,
        user_agent, request_method, request_path, response_status,
        duration_ms, details, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      event.eventType,
      event.userId,
      event.connectionId || null,
      event.toolName || null,
      event.resourceType || null,
      event.resourceId || null,
      event.projectId || null,
      event.ipAddress || null,
      event.userAgent || null,
      event.requestMethod || null,
      event.requestPath || null,
      event.responseStatus || null,
      event.durationMs || null,
      event.details ? JSON.stringify(event.details) : null,
      event.errorMessage || null
    ).run();
  } catch (error) {
    // Log to console but don't fail the main operation
    console.error('Failed to write audit log:', error, event);
  }
  
  return id;
}

/**
 * Log a tool execution event
 */
export async function logToolExecution(
  env: Env,
  options: {
    toolName: string;
    userId: string;
    connectionId?: string;
    projectId?: string;
    resourceType?: ResourceType;
    resourceId?: string;
    success: boolean;
    durationMs?: number;
    errorMessage?: string;
    details?: Record<string, unknown>;
    request?: Request;
  }
): Promise<string> {
  return logAuditEvent(env, {
    eventType: 'tool_execution',
    userId: options.userId,
    connectionId: options.connectionId,
    toolName: options.toolName,
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    projectId: options.projectId,
    ipAddress: options.request ? getClientIP(options.request) : undefined,
    userAgent: options.request?.headers.get('user-agent') || undefined,
    responseStatus: options.success ? 200 : 500,
    durationMs: options.durationMs,
    errorMessage: options.errorMessage,
    details: options.details,
  });
}

/**
 * Log an OAuth callback event
 */
export async function logOAuthCallback(
  env: Env,
  options: {
    userId: string;
    success: boolean;
    provider: string;
    environment?: string;
    errorMessage?: string;
    request?: Request;
  }
): Promise<string> {
  return logAuditEvent(env, {
    eventType: 'oauth_callback',
    userId: options.userId,
    resourceType: 'token',
    ipAddress: options.request ? getClientIP(options.request) : undefined,
    userAgent: options.request?.headers.get('user-agent') || undefined,
    responseStatus: options.success ? 200 : 400,
    errorMessage: options.errorMessage,
    details: {
      provider: options.provider,
      environment: options.environment,
    },
  });
}

/**
 * Log an OAuth initiation event
 */
export async function logOAuthInitiate(
  env: Env,
  options: {
    userId: string;
    connectionId: string;
    provider: string;
    environment?: string;
    request?: Request;
  }
): Promise<string> {
  return logAuditEvent(env, {
    eventType: 'oauth_initiate',
    userId: options.userId,
    connectionId: options.connectionId,
    resourceType: 'token',
    ipAddress: options.request ? getClientIP(options.request) : undefined,
    userAgent: options.request?.headers.get('user-agent') || undefined,
    details: {
      provider: options.provider,
      environment: options.environment,
    },
  });
}

/**
 * Log a token refresh event
 */
export async function logTokenRefresh(
  env: Env,
  options: {
    userId: string;
    connectionId?: string;
    success: boolean;
    provider: string;
    errorMessage?: string;
  }
): Promise<string> {
  return logAuditEvent(env, {
    eventType: 'token_refresh',
    userId: options.userId,
    connectionId: options.connectionId,
    resourceType: 'token',
    responseStatus: options.success ? 200 : 401,
    errorMessage: options.errorMessage,
    details: {
      provider: options.provider,
    },
  });
}

/**
 * Log a rate limit exceeded event
 */
export async function logRateLimitExceeded(
  env: Env,
  options: {
    userId: string;
    connectionId?: string;
    retryAfter: number;
    remaining: number;
    request?: Request;
  }
): Promise<string> {
  return logAuditEvent(env, {
    eventType: 'rate_limit_exceeded',
    userId: options.userId,
    connectionId: options.connectionId,
    ipAddress: options.request ? getClientIP(options.request) : undefined,
    userAgent: options.request?.headers.get('user-agent') || undefined,
    responseStatus: 429,
    details: {
      retryAfter: options.retryAfter,
      remaining: options.remaining,
    },
  });
}

/**
 * Log data access (for sensitive resources)
 */
export async function logDataAccess(
  env: Env,
  options: {
    userId: string;
    connectionId?: string;
    resourceType: ResourceType;
    resourceId?: string;
    projectId?: string;
    action: 'read' | 'create' | 'update' | 'delete';
    count?: number;
    request?: Request;
  }
): Promise<string> {
  return logAuditEvent(env, {
    eventType: 'data_access',
    userId: options.userId,
    connectionId: options.connectionId,
    resourceType: options.resourceType,
    resourceId: options.resourceId,
    projectId: options.projectId,
    ipAddress: options.request ? getClientIP(options.request) : undefined,
    userAgent: options.request?.headers.get('user-agent') || undefined,
    details: {
      action: options.action,
      count: options.count,
    },
  });
}

/**
 * Log AI/LLM usage for token tracking and cost monitoring
 * 
 * This is used to track:
 * - Token consumption per skill/tool
 * - Cost attribution per user/project
 * - Cache hit rates
 * - Latency metrics
 */
export async function logAIUsage(
  env: Env,
  event: AIUsageEvent
): Promise<string> {
  const id = crypto.randomUUID();
  
  try {
    // Use enhanced insert with AI-specific columns if available
    // Falls back to storing in details JSON if columns don't exist yet
    await env.DB.prepare(`
      INSERT INTO audit_logs (
        id, event_type, user_id, connection_id, tool_name,
        project_id, response_status, duration_ms, details,
        error_message, model, prompt_tokens, completion_tokens,
        total_tokens, cost_usd, cached
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      'ai_usage',
      event.userId,
      event.connectionId || null,
      event.toolName,
      event.projectId || null,
      event.success !== false ? 200 : 500,
      event.latencyMs,
      JSON.stringify({
        provider: event.provider,
        model: event.model,
        promptTokens: event.promptTokens,
        completionTokens: event.completionTokens,
        totalTokens: event.totalTokens,
        cost: event.cost,
        cached: event.cached,
      }),
      event.errorMessage || null,
      event.model,
      event.promptTokens,
      event.completionTokens,
      event.totalTokens,
      event.cost || null,
      event.cached ? 1 : 0
    ).run();
  } catch (error) {
    // If new columns don't exist yet, fall back to basic insert
    // This allows the code to work before migration is applied
    try {
      await env.DB.prepare(`
        INSERT INTO audit_logs (
          id, event_type, user_id, connection_id, tool_name,
          project_id, response_status, duration_ms, details,
          error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        'ai_usage',
        event.userId,
        event.connectionId || null,
        event.toolName,
        event.projectId || null,
        event.success !== false ? 200 : 500,
        event.latencyMs,
        JSON.stringify({
          provider: event.provider,
          model: event.model,
          promptTokens: event.promptTokens,
          completionTokens: event.completionTokens,
          totalTokens: event.totalTokens,
          cost: event.cost,
          cached: event.cached,
        }),
        event.errorMessage || null
      ).run();
    } catch (fallbackError) {
      // Log to console but don't fail the main operation
      console.error('Failed to write AI usage audit log:', fallbackError, event);
    }
  }
  
  return id;
}

/**
 * Query AI usage statistics for a user or project
 */
export async function queryAIUsageStats(
  env: Env,
  filters: {
    userId?: string;
    projectId?: string;
    toolName?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  cachedRequests: number;
  avgLatencyMs: number;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
}> {
  let query = `
    SELECT 
      COUNT(*) as total_requests,
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(cost_usd), 0) as total_cost,
      COALESCE(SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END), 0) as cached_requests,
      COALESCE(AVG(duration_ms), 0) as avg_latency,
      model
    FROM audit_logs 
    WHERE event_type = 'ai_usage'
  `;
  const bindings: any[] = [];

  if (filters.userId) {
    query += ' AND user_id = ?';
    bindings.push(filters.userId);
  }
  if (filters.projectId) {
    query += ' AND project_id = ?';
    bindings.push(filters.projectId);
  }
  if (filters.toolName) {
    query += ' AND tool_name = ?';
    bindings.push(filters.toolName);
  }
  if (filters.startDate) {
    query += ' AND created_at >= ?';
    bindings.push(filters.startDate);
  }
  if (filters.endDate) {
    query += ' AND created_at <= ?';
    bindings.push(filters.endDate);
  }

  query += ' GROUP BY model';

  try {
    const result = await env.DB.prepare(query).bind(...bindings).all<any>();
    
    let totalRequests = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let cachedRequests = 0;
    let totalLatency = 0;
    const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {};

    for (const row of result.results || []) {
      totalRequests += row.total_requests || 0;
      totalTokens += row.total_tokens || 0;
      totalCost += row.total_cost || 0;
      cachedRequests += row.cached_requests || 0;
      totalLatency += (row.avg_latency || 0) * (row.total_requests || 0);
      
      if (row.model) {
        byModel[row.model] = {
          requests: row.total_requests || 0,
          tokens: row.total_tokens || 0,
          cost: row.total_cost || 0,
        };
      }
    }

    return {
      totalRequests,
      totalTokens,
      totalCost: Math.round(totalCost * 1000000) / 1000000,
      cachedRequests,
      avgLatencyMs: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
      byModel,
    };
  } catch {
    // If new columns don't exist, return empty stats
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      cachedRequests: 0,
      avgLatencyMs: 0,
      byModel: {},
    };
  }
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(
  env: Env,
  filters: {
    userId?: string;
    connectionId?: string;
    eventType?: AuditEventType;
    toolName?: string;
    resourceType?: ResourceType;
    projectId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
  const bindings: any[] = [];

  if (filters.userId) {
    query += ' AND user_id = ?';
    countQuery += ' AND user_id = ?';
    bindings.push(filters.userId);
  }

  if (filters.connectionId) {
    query += ' AND connection_id = ?';
    countQuery += ' AND connection_id = ?';
    bindings.push(filters.connectionId);
  }

  if (filters.eventType) {
    query += ' AND event_type = ?';
    countQuery += ' AND event_type = ?';
    bindings.push(filters.eventType);
  }

  if (filters.toolName) {
    query += ' AND tool_name = ?';
    countQuery += ' AND tool_name = ?';
    bindings.push(filters.toolName);
  }

  if (filters.resourceType) {
    query += ' AND resource_type = ?';
    countQuery += ' AND resource_type = ?';
    bindings.push(filters.resourceType);
  }

  if (filters.projectId) {
    query += ' AND project_id = ?';
    countQuery += ' AND project_id = ?';
    bindings.push(filters.projectId);
  }

  if (filters.startDate) {
    query += ' AND created_at >= ?';
    countQuery += ' AND created_at >= ?';
    bindings.push(filters.startDate);
  }

  if (filters.endDate) {
    query += ' AND created_at <= ?';
    countQuery += ' AND created_at <= ?';
    bindings.push(filters.endDate);
  }

  query += ' ORDER BY created_at DESC';
  query += ` LIMIT ${filters.limit || 100} OFFSET ${filters.offset || 0}`;

  // Execute both queries
  const [logsResult, countResult] = await Promise.all([
    env.DB.prepare(query).bind(...bindings).all<any>(),
    env.DB.prepare(countQuery).bind(...bindings).first<{ total: number }>(),
  ]);

  return {
    logs: (logsResult.results || []).map((row: any) => ({
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
    total: countResult?.total || 0,
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Extract client IP from request headers
 */
function getClientIP(request: Request): string | undefined {
  // Cloudflare provides the client IP in CF-Connecting-IP
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP;

  // Fallback to X-Forwarded-For
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to X-Real-IP
  return request.headers.get('x-real-ip') || undefined;
}

/**
 * Create an audit context object for use in tool handlers
 */
export function createAuditContext(request?: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  if (!request) return {};
  
  return {
    ipAddress: getClientIP(request),
    userAgent: request.headers.get('user-agent') || undefined,
  };
}
