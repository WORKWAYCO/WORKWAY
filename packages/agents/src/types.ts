/**
 * @workwayco/agents
 *
 * Types for multi-agent coordination.
 * Hierarchical telos: ethos creates context for specific directives.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Projects & Issues
// ─────────────────────────────────────────────────────────────────────────────

export interface Project {
  /** Project ID */
  id: string;
  /** Project name */
  name: string;
  /** Project description */
  description: string;
  /** Project status */
  status: 'active' | 'paused' | 'completed';
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

export interface CoordinatedIssue {
  /** Issue ID (from Beads) */
  id: string;
  /** Parent project ID */
  projectId: string | null;
  /** Issue title */
  title: string;
  /** Current status */
  status: 'open' | 'claimed' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  /** Priority (0-4) */
  priority: number;
  /** Required capabilities */
  capabilities: string[];
  /** Labels */
  labels: string[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────────────────────────────────────

export type DependencyType =
  | 'blocks'          // Y cannot start until X completes
  | 'informs'         // Y should know about X
  | 'discovered_from' // Y was discovered while working on X
  | 'any_of';         // Speculative parallelism - first to complete wins

export interface Dependency {
  /** Source issue ID */
  issueId: string;
  /** Target issue ID */
  dependsOnId: string;
  /** Dependency type */
  type: DependencyType;
  /** Creation timestamp */
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcomes
// ─────────────────────────────────────────────────────────────────────────────

export type OutcomeType = 'success' | 'failure' | 'partial' | 'cancelled';

export interface Outcome {
  /** Issue ID */
  issueId: string;
  /** Outcome type */
  outcome: OutcomeType;
  /** Summary */
  summary: string;
  /** Agent that completed the work */
  agentId: string;
  /** Completion timestamp */
  completedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agents
// ─────────────────────────────────────────────────────────────────────────────

export interface Agent {
  /** Agent ID */
  id: string;
  /** Agent name */
  name: string;
  /** Capabilities this agent can handle */
  capabilities: string[];
  /** Maximum concurrent claims */
  maxConcurrent: number;
  /** Current status */
  status: 'active' | 'inactive' | 'busy';
  /** Last heartbeat timestamp */
  lastHeartbeat: string;
  /** Registration timestamp */
  registeredAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Claims
// ─────────────────────────────────────────────────────────────────────────────

export interface Claim {
  /** Claim ID */
  id: string;
  /** Issue being claimed */
  issueId: string;
  /** Agent that holds the claim */
  agentId: string;
  /** Claim creation timestamp */
  claimedAt: string;
  /** Claim expiration timestamp */
  expiresAt: string;
  /** Whether claim is still active */
  active: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority Scoring
// ─────────────────────────────────────────────────────────────────────────────

export interface PriorityScore {
  /** Issue ID */
  issueId: string;
  /** Total priority score */
  score: number;
  /** Component scores */
  components: {
    /** Base priority weight */
    priority: number;
    /** Impact weight (how many issues unblocked) */
    impact: number;
    /** Age weight */
    age: number;
    /** Connectivity weight */
    connectivity: number;
    /** Project alignment weight */
    project: number;
  };
}

export interface PriorityWeights {
  priority: number;
  impact: number;
  age: number;
  connectivity: number;
  project: number;
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  priority: 0.3,
  impact: 0.35,
  age: 0.1,
  connectivity: 0.15,
  project: 0.1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

export interface Assignment {
  /** Issue ID */
  issueId: string;
  /** Assigned agent ID */
  agentId: string;
  /** Assignment score */
  score: number;
  /** Score components */
  components: {
    /** Capability match */
    capability: number;
    /** Current workload */
    workload: number;
    /** Recency of last assignment */
    recency: number;
    /** Past experience with similar issues */
    experience: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ethos (Health Monitoring)
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthMetrics {
  /** Ratio of issues linked to projects (target: >= 0.7) */
  coherence: number;
  /** Issues completed per hour (24h rolling) */
  velocity: number;
  /** Ratio of blocked to open issues (target: <= 0.3) */
  blockage: number;
  /** Average age of open issues in days (target: <= 7) */
  staleness: number;
  /** Ratio of active claims to open issues (target: >= 0.3) */
  claimHealth: number;
  /** Ratio of active agents to registered agents (target: >= 0.5) */
  agentHealth: number;
}

export interface HealthThresholds {
  /** Minimum coherence ratio */
  minCoherence: number;
  /** Maximum blockage ratio */
  maxBlockage: number;
  /** Maximum staleness in days */
  maxStaleness: number;
  /** Minimum claim health ratio */
  minClaimHealth: number;
  /** Minimum agent health ratio */
  minAgentHealth: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  minCoherence: 0.7,
  maxBlockage: 0.3,
  maxStaleness: 7,
  minClaimHealth: 0.3,
  minAgentHealth: 0.5,
};

export interface HealthViolation {
  /** Metric that violated threshold */
  metric: keyof HealthMetrics;
  /** Current value */
  value: number;
  /** Threshold that was violated */
  threshold: number;
  /** Suggested remediation */
  remediation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinator API
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkRequest {
  /** Agent requesting work */
  agentId: string;
  /** Agent's capabilities */
  capabilities: string[];
}

export interface WorkResult {
  /** Whether work was claimed */
  claimed: boolean;
  /** Claim ID if claimed */
  claimId: string | null;
  /** Issue if claimed */
  issue: CoordinatedIssue | null;
}

export interface CompletionResult {
  /** Whether completion was recorded */
  recorded: boolean;
  /** Any issues unblocked by this completion */
  unblockedIssues: string[];
  /** Any cancelled issues (speculative parallelism) */
  cancelledIssues: string[];
}
