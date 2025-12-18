/**
 * @workwayco/beads
 *
 * Types for agent-native task management.
 * The tool recedes; the work remains.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Issue Types
// ─────────────────────────────────────────────────────────────────────────────

export type IssueStatus = 'open' | 'in_progress' | 'closed';

export type IssueType = 'bug' | 'feature' | 'task' | 'epic' | 'chore';

export type Priority = 0 | 1 | 2 | 3 | 4;

export interface Issue {
  /** Unique identifier (e.g., "workway-a1b2c3") */
  id: string;
  /** Issue title */
  title: string;
  /** Detailed description */
  description: string;
  /** Current status */
  status: IssueStatus;
  /** Priority level (P0=urgent, P4=low) */
  priority: Priority;
  /** Issue type */
  issue_type: IssueType;
  /** Labels for categorization */
  labels: string[];
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  /** Last update timestamp (ISO 8601) */
  updated_at: string;
  /** Closure timestamp (ISO 8601) or null */
  closed_at: string | null;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dependencies
// ─────────────────────────────────────────────────────────────────────────────

export type DependencyType = 'blocks' | 'parent-child' | 'related' | 'discovered-from' | 'any-of';

export interface Dependency {
  /** The issue that has the dependency */
  issue_id: string;
  /** The issue it depends on */
  depends_on_id: string;
  /** Type of dependency relationship */
  type: DependencyType;
  /** Creation timestamp */
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface BeadsConfig {
  /** Project name for ID prefixes */
  project: string;
  /** Default priority for new issues */
  default_priority: Priority;
  /** Default labels for new issues */
  default_labels: string[];
}

export const DEFAULT_CONFIG: BeadsConfig = {
  project: 'workway',
  default_priority: 2,
  default_labels: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Robot Mode Output
// ─────────────────────────────────────────────────────────────────────────────

export interface RobotPriorityOutput {
  /** Issues sorted by priority score */
  issues: Array<{
    id: string;
    title: string;
    priority: Priority;
    score: number;
    blockedBy: string[];
    blocking: string[];
  }>;
  /** Summary statistics */
  stats: {
    total: number;
    open: number;
    in_progress: number;
    blocked: number;
  };
}

export interface RobotInsightsOutput {
  /** Bottleneck issues (blocking the most work) */
  bottlenecks: Array<{
    id: string;
    title: string;
    blockingCount: number;
  }>;
  /** Keystone issues (most connected) */
  keystones: Array<{
    id: string;
    title: string;
    connectionCount: number;
  }>;
  /** Health metrics */
  health: {
    blockageRatio: number;
    averageAge: number;
    stalestIssue: string | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Store Events (for append-only JSONL)
// ─────────────────────────────────────────────────────────────────────────────

export type StoreEventType =
  | 'issue_created'
  | 'issue_updated'
  | 'issue_closed'
  | 'dependency_added'
  | 'dependency_removed'
  | 'label_added'
  | 'label_removed';

export interface StoreEvent {
  type: StoreEventType;
  timestamp: string;
  data: Record<string, unknown>;
}
