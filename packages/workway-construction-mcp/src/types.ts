/**
 * WORKWAY Construction MCP Types
 */

// ============================================================================
// Environment Bindings
// ============================================================================

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  WORKFLOW_STATE: DurableObjectNamespace;
  PROCORE_CLIENT_ID: string;
  PROCORE_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
  RESEND_API_KEY?: string;  // For email notifications
  ENVIRONMENT: string;
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
