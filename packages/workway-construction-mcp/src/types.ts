/**
 * WORKWAY Construction MCP Types
 */

import type { BaseMCPEnv } from '@workway/mcp-core';

// ============================================================================
// Environment Bindings
// ============================================================================

export interface Env extends BaseMCPEnv {
  WORKFLOW_STATE: DurableObjectNamespace;
  PROCORE_RATE_LIMITER: DurableObjectNamespace;  // Rate limiter for Procore API
  // Production Procore credentials
  PROCORE_CLIENT_ID: string;
  PROCORE_CLIENT_SECRET: string;
  // Sandbox Procore credentials (separate app registration required)
  PROCORE_SANDBOX_CLIENT_ID?: string;
  PROCORE_SANDBOX_CLIENT_SECRET?: string;
  COOKIE_ENCRYPTION_KEY: string;
  RESEND_API_KEY?: string;  // For email notifications
  ENVIRONMENT: string;
  // Intelligence Layer: Workers AI for Skills
  AI?: Ai;  // Cloudflare Workers AI binding
  // Agent Observability: Analytics Engine for metrics
  AGENT_METRICS?: AnalyticsEngineDataset;  // Agent metrics dataset
  // Observability dashboard API key (for admin access)
  OBSERVABILITY_API_KEY?: string;
  
  // Distributed Tracing Configuration
  /** OpenTelemetry exporter URL (e.g., https://otel-collector.example.com/v1/traces) */
  OTEL_EXPORTER_URL?: string;
  /** Trace sampling rate (0.0 to 1.0, default 0.1 = 10%) */
  TRACE_SAMPLING_RATE?: string;
  /** Langfuse host URL */
  LANGFUSE_HOST?: string;
  /** Langfuse public key */
  LANGFUSE_PUBLIC_KEY?: string;
  /** Langfuse secret key */
  LANGFUSE_SECRET_KEY?: string;
  
  // AI Gateway Configuration (for LLM observability)
  /** Cloudflare Account ID (required for AI Gateway routing) */
  CLOUDFLARE_ACCOUNT_ID?: string;
  /** AI Gateway name (default: workway-mcp) */
  AI_GATEWAY_ID?: string;
  /** Composio API key for hub toolkit routing */
  COMPOSIO_API_KEY?: string;
  /** Optional Composio base URL override */
  COMPOSIO_BASE_URL?: string;
  /** Optional MCP base URL override (defaults to https://mcp.workway.co) */
  MCP_BASE_URL?: string;
  /** Optional legacy base URL toggle (true/false) */
  MCP_USE_LEGACY_BASE_URL?: string;
  /** R2 bucket for immutable decision/evidence artifacts */
  JUDGMENT_EVIDENCE?: R2Bucket;
  /** Optional Braintrust API key for MCP invocation tracing */
  BRAINTRUST_API_KEY?: string;
  /** Optional Braintrust project name (default: WORKWAY) */
  BRAINTRUST_PROJECT_NAME?: string;
  /** Optional Braintrust toggle (true/false) */
  BRAINTRUST_ENABLED?: string;
}

// ============================================================================
// Workflow Types
// ============================================================================

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'error';
export type TriggerType = 'webhook' | 'cron' | 'manual';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  projectId?: string; // Procore project ID
  triggerType: TriggerType;
  triggerConfig?: TriggerConfig;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerConfig {
  // Webhook trigger
  source?: string; // procore, slack, etc.
  eventTypes?: string[]; // rfi.created, daily_log.submitted, etc.
  webhookSecret?: string;
  
  // Cron trigger
  cronSchedule?: string; // "0 9 * * 1-5" (weekdays at 9am)
  timezone?: string;
}

export interface WorkflowAction {
  id: string;
  workflowId: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  sequence: number;
  condition?: string; // Optional condition expression
}

export interface Execution {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  error?: string;
  steps: ExecutionStep[];
}

export interface ExecutionStep {
  actionId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  output?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// Procore Types
// ============================================================================

export interface ProcoreProject {
  id: number;
  name: string;
  displayName: string;
  projectNumber?: string;
  address?: string;
  city?: string;
  stateCode?: string;
  active: boolean;
}

export interface ProcoreRFI {
  id: number;
  projectId: number;
  number: number;
  subject: string;
  status: string;
  questionBody?: string;
  answerBody?: string;
  assigneeId?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  responseTime?: number; // days
}

export interface ProcoreDailyLog {
  id: number;
  projectId: number;
  logDate: string;
  status: string;
  weatherConditions?: string;
  temperatureHigh?: number;
  temperatureLow?: number;
  notes?: string;
  manpowerLogs?: ManpowerEntry[];
  createdAt: string;
}

export interface ManpowerEntry {
  id: number;
  companyName: string;
  workerCount: number;
  hoursWorked: number;
  workDescription?: string;
}

export interface ProcoreSubmittal {
  id: number;
  projectId: number;
  number: number;
  title: string;
  status: string;
  specSection?: string;
  dueDate?: string;
  ballInCourt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// MCP Tool Types
// ============================================================================

/**
 * Loose tool set type that works with the varying tool definitions
 * The actual type checking happens at runtime via zod schemas
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MCPToolSet = Record<string, any>;

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime?: number;
    cached?: boolean;
  };
}

export interface DiagnosisResult {
  diagnosis: string;
  rootCause: string;
  affectedComponent: string;
  suggestedFix: string;
  fixTool?: string;
  fixParams?: Record<string, unknown>;
  confidence: number;
  logs: LogEntry[];
  severity?: 'low' | 'medium' | 'high';
  atlasAnalysis?: {
    aiTasksInvolved: string[];
    humanTasksRequired?: string[];
    failurePoint: string;
  };
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

export interface UnstuckGuidance {
  guidance: string;
  nextSteps: {
    step: number;
    tool: string;
    params: Record<string, unknown>;
    explanation: string;
  }[];
  example?: string;
  documentationUrl?: string;
  atlasContext?: {
    aiTasks: string[];
    humanTasks: string[];
    constraints: string[];
    touchpoints: string[];
  };
}

// ============================================================================
// OAuth Types
// ============================================================================

export interface OAuthToken {
  id: string;
  provider: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  createdAt: string;
}

// ============================================================================
// Usage Metering Types
// ============================================================================

export type UserTier = 'anonymous' | 'free' | 'pro' | 'enterprise';

export interface User {
  id: string;
  email?: string;
  tier: UserTier;
  runs_this_month: number;
  monthly_run_limit: number;
  billing_cycle_start: string;
  created_at: string;
  updated_at: string;
}

export interface UsageResult {
  exceeded: boolean;
  runs: number;
  limit: number;
  tier: UserTier;
  cycleStart?: string;
  daysUntilReset?: number;
  userId?: string;
}

export interface AnonymousUsage {
  runs: number;
  first_seen: string;
}

// Tier limits
export const TIER_LIMITS: Record<UserTier, number> = {
  anonymous: 50,      // Total lifetime runs
  free: 500,          // Per month
  pro: 5000,          // Per month
  enterprise: -1,     // Unlimited (-1 means no limit)
};

// ============================================================================
// RFI Outcome Types (for learning)
// ============================================================================

export interface RFIOutcome {
  id: string;
  rfiId: string;
  projectId: string;
  questionEmbedding?: number[];
  responseEmbedding?: number[];
  responseTimeDays: number;
  wasAccepted: boolean;
  createdAt: string;
}

// ============================================================================
// Hub + Judgment Axis Types
// ============================================================================

export type JudgmentDecisionStatus =
  | 'approved'
  | 'pending_approval'
  | 'denied'
  | 'executed'
  | 'failed'
  | 'expired';

export type JudgmentAction = 'allow' | 'require_approval' | 'deny';

export type ApprovalStatus = 'approved' | 'rejected' | 'commented';

export type ApprovalTier =
  | 'none'
  | 'superintendent'
  | 'project_manager'
  | 'director'
  | 'compliance';

export interface JudgmentPolicy {
  id: string;
  tenantId: string;
  name: string;
  policyType: string;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyVersion {
  id: string;
  policyId: string;
  tenantId: string;
  version: number;
  policyJson: string;
  trustProfileJson?: string | null;
  status: 'draft' | 'active' | 'deprecated';
  effectiveAt: string;
  createdBy: string;
  createdAt: string;
}

export interface PolicyRuleMatch {
  toolkit_slugs?: string[];
  tool_slugs?: string[];
  tool_slug_prefixes?: string[];
  operation_types?: Array<'read' | 'write' | 'admin'>;
  min_risk?: number;
  max_risk?: number;
}

export interface PolicyRule {
  id: string;
  action: JudgmentAction;
  reason?: string;
  required_approval_tier?: ApprovalTier;
  match: PolicyRuleMatch;
}

export interface PolicyDefinition {
  default_action?: JudgmentAction;
  default_required_approval_tier?: ApprovalTier;
  rules?: PolicyRule[];
}

export interface DecisionRecord {
  id: string;
  tenantId: string;
  policyId?: string | null;
  policyVersionId?: string | null;
  userId: string;
  projectId?: string | null;
  toolkitSlug?: string | null;
  toolSlug: string;
  provider: string;
  argumentsJson?: string | null;
  riskScore: number;
  requiredApprovalTier?: ApprovalTier | null;
  status: JudgmentDecisionStatus;
  reason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  evidenceR2Key?: string | null;
  executionResultJson?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  decisionId: string;
  tenantId: string;
  approverUserId: string;
  approvalTier: ApprovalTier;
  status: ApprovalStatus;
  note?: string | null;
  createdAt: string;
}

export interface ToolAccessPack {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string | null;
  status: 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolAccessRule {
  id: string;
  packId: string;
  tenantId: string;
  toolkitSlug: string;
  toolSlug?: string | null;
  ruleType: 'allow' | 'deny';
  createdAt: string;
}

export interface ProviderExecutionRequest {
  tenantId: string;
  userId: string;
  projectId?: string;
  toolkitSlug?: string;
  toolSlug: string;
  args: Record<string, unknown>;
  connectedAccountId?: string;
}

export interface ProviderExecutionResult {
  provider: 'first_party' | 'composio';
  toolkitSlug?: string;
  toolSlug: string;
  result: unknown;
}

export type HubExecutionResponse =
  | {
      status: 'executed';
      decision_id: string;
      provider: 'first_party' | 'composio';
      result: unknown;
    }
  | {
      status: 'requires_approval';
      decision_id: string;
      required_approval_tier?: ApprovalTier | null;
      reason: string;
    }
  | {
      status: 'denied';
      decision_id: string;
      reason: string;
    };
