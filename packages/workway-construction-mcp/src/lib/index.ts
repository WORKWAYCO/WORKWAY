/**
 * WORKWAY Construction MCP Library
 */

export { ProcoreClient } from './procore-client';
// Note: ProcoreError from procore-client.ts is deprecated, use ProcoreError from errors.ts
export { generateId } from './db';
export { encrypt, decrypt } from './crypto';
export * from './config';
export * from './audit-logger';
export * from './errors';
export * from './pagination';
export * from './ai-gateway';

// Agent Observability
export {
  AgentBlobIndex,
  AgentDoubleIndex,
  createAgentMetrics,
  getToolCategory,
  extractTenantId,
  isRateLimitError,
  extractErrorCode,
  trackToolExecution,
  trackAIExecution,
  trackAIExecutionError,
  createMetricsBatch,
} from './agent-metrics';
export type {
  ToolCategory,
  ExecutionOutcome,
  AgentDataPoint,
  AgentMetrics,
  MetricsBatch,
  AIGatewayResponse as AgentMetricsAIGatewayResponse,
} from './agent-metrics';
export * from './sli-queries';

// Distributed Tracing
export * from './tracing';
export * from './otel-exporter';
