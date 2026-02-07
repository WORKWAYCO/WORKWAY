/**
 * Observability Types for WORKWAY Construction MCP
 *
 * Types for agent metrics, SLIs, and observability features.
 */

// ============================================================================
// Re-exports from agent-metrics module
// ============================================================================

export type {
	ToolCategory,
	ExecutionOutcome,
	AgentDataPoint,
	AIGatewayResponse,
	AgentMetrics,
	MetricsBatch,
} from '../lib/agent-metrics';

export { AgentBlobIndex, AgentDoubleIndex } from '../lib/agent-metrics';

// ============================================================================
// Re-exports from sli-queries module
// ============================================================================

export type { AgentSLIs } from '../lib/sli-queries';

export { TIME_RANGES, COLUMN_REFERENCE, AGENT_SLI_QUERIES, AGENT_GRAPHQL_QUERIES } from '../lib/sli-queries';

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Dashboard time range selection
 */
export type DashboardTimeRange = 'last_hour' | 'last_24_hours' | 'last_7_days' | 'last_30_days' | 'custom';

/**
 * Dashboard filter options
 */
export interface DashboardFilters {
	/** Filter by tenant ID */
	tenantId?: string;
	/** Filter by tool category */
	toolCategory?: string;
	/** Filter by outcome */
	outcome?: string;
	/** Filter by model */
	model?: string;
	/** Custom time range start */
	startTime?: string;
	/** Custom time range end */
	endTime?: string;
}

/**
 * Dashboard metric card data
 */
export interface MetricCard {
	/** Metric label */
	label: string;
	/** Current value */
	value: number;
	/** Unit (%, ms, $, etc.) */
	unit: string;
	/** Trend direction */
	trend?: 'up' | 'down' | 'stable';
	/** Percentage change from previous period */
	changePercent?: number;
	/** Status indicator */
	status?: 'good' | 'warning' | 'critical';
}

/**
 * Dashboard summary response
 */
export interface DashboardSummary {
	/** Time range of the data */
	timeRange: {
		start: string;
		end: string;
	};
	/** Key metrics */
	metrics: {
		successRate: MetricCard;
		errorRate: MetricCard;
		p95Latency: MetricCard;
		totalCalls: MetricCard;
		totalTokens?: MetricCard;
		totalCost?: MetricCard;
	};
	/** Tool call distribution by category */
	categoryDistribution: Array<{
		category: string;
		count: number;
		percentage: number;
	}>;
	/** Recent errors */
	recentErrors: Array<{
		toolName: string;
		errorCode: string;
		count: number;
		lastOccurred: string;
	}>;
}

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert condition types
 */
export type AlertConditionType =
	| 'error_rate_threshold'
	| 'latency_threshold'
	| 'rate_limit_spike'
	| 'cost_threshold'
	| 'token_usage_threshold';

/**
 * Alert configuration
 */
export interface AlertConfig {
	/** Alert ID */
	id: string;
	/** Alert name */
	name: string;
	/** Alert description */
	description?: string;
	/** Condition type */
	conditionType: AlertConditionType;
	/** Threshold value */
	threshold: number;
	/** Comparison operator */
	operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
	/** Evaluation window in minutes */
	windowMinutes: number;
	/** Alert severity */
	severity: AlertSeverity;
	/** Notification channels */
	channels: Array<'email' | 'slack' | 'webhook'>;
	/** Whether alert is enabled */
	enabled: boolean;
	/** Optional tenant filter */
	tenantId?: string;
	/** Optional tool filter */
	toolName?: string;
}

/**
 * Alert instance (triggered alert)
 */
export interface AlertInstance {
	/** Alert instance ID */
	id: string;
	/** Alert config ID */
	alertConfigId: string;
	/** Alert name */
	alertName: string;
	/** Alert severity */
	severity: AlertSeverity;
	/** Triggered at timestamp */
	triggeredAt: string;
	/** Resolved at timestamp (if resolved) */
	resolvedAt?: string;
	/** Current value that triggered the alert */
	currentValue: number;
	/** Threshold that was exceeded */
	threshold: number;
	/** Additional context */
	context?: Record<string, unknown>;
}

// ============================================================================
// Trace Types
// ============================================================================

/**
 * Tool execution trace
 */
export interface ToolTrace {
	/** Trace ID */
	traceId: string;
	/** Parent trace ID (for nested calls) */
	parentTraceId?: string;
	/** Span ID */
	spanId: string;
	/** Tenant ID */
	tenantId: string;
	/** Tool name */
	toolName: string;
	/** Tool category */
	toolCategory: string;
	/** Start timestamp */
	startTime: string;
	/** End timestamp */
	endTime?: string;
	/** Duration in milliseconds */
	durationMs?: number;
	/** Execution outcome */
	outcome: 'success' | 'error' | 'rate_limited' | 'in_progress';
	/** Error details (if failed) */
	error?: {
		code: string;
		message: string;
		stack?: string;
	};
	/** Input parameters (sanitized) */
	input?: Record<string, unknown>;
	/** Output summary (sanitized) */
	output?: Record<string, unknown>;
	/** AI/Skill metadata */
	ai?: {
		model: string;
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
		costUsd: number;
	};
}

/**
 * Trace query options
 */
export interface TraceQueryOptions {
	/** Filter by tenant */
	tenantId?: string;
	/** Filter by trace ID */
	traceId?: string;
	/** Filter by tool name */
	toolName?: string;
	/** Filter by outcome */
	outcome?: string;
	/** Minimum duration filter */
	minDurationMs?: number;
	/** Maximum duration filter */
	maxDurationMs?: number;
	/** Start time filter */
	startTime?: string;
	/** End time filter */
	endTime?: string;
	/** Result limit */
	limit?: number;
	/** Result offset */
	offset?: number;
	/** Sort field */
	sortBy?: 'startTime' | 'durationMs' | 'toolName';
	/** Sort direction */
	sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Component health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component health check result
 */
export interface ComponentHealth {
	/** Component name */
	name: string;
	/** Health status */
	status: HealthStatus;
	/** Latency in milliseconds */
	latencyMs?: number;
	/** Last check timestamp */
	lastCheck: string;
	/** Error message (if unhealthy) */
	error?: string;
	/** Additional details */
	details?: Record<string, unknown>;
}

/**
 * Overall system health
 */
export interface SystemHealth {
	/** Overall status */
	status: HealthStatus;
	/** Timestamp */
	timestamp: string;
	/** Component health checks */
	components: {
		database: ComponentHealth;
		kv: ComponentHealth;
		procore?: ComponentHealth;
		ai?: ComponentHealth;
		analyticsEngine?: ComponentHealth;
	};
	/** SLI summary */
	slis?: {
		successRate: number;
		p95Latency: number;
		errorRate: number;
	};
}
