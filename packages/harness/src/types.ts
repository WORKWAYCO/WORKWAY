/**
 * @workwayco/harness
 *
 * Types for the autonomous agent harness.
 * Beads-based human oversight with progress reports and reactive redirection.
 */

import type { Issue } from '@workwayco/beads';

// ─────────────────────────────────────────────────────────────────────────────
// Harness Mode
// ─────────────────────────────────────────────────────────────────────────────

export type HarnessMode = 'workflow' | 'platform';

// ─────────────────────────────────────────────────────────────────────────────
// Spec & Features
// ─────────────────────────────────────────────────────────────────────────────

export interface Feature {
  /** Unique identifier within the spec */
  id: string;
  /** Feature title */
  title: string;
  /** Detailed description */
  description: string;
  /** Priority (0-4, P0=highest) */
  priority: number;
  /** Feature IDs this depends on */
  dependsOn: string[];
  /** Acceptance criteria (checklist items) */
  acceptanceCriteria: string[];
  /** Labels for categorization */
  labels: string[];
  /** Category from spec (e.g., "Email Processing") */
  category: string;
}

export interface ParsedSpec {
  /** Project title */
  title: string;
  /** Project overview */
  overview: string;
  /** List of features */
  features: Feature[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Harness State
// ─────────────────────────────────────────────────────────────────────────────

export type HarnessStatus = 'initializing' | 'running' | 'paused' | 'completed' | 'failed';

export interface CheckpointPolicy {
  /** Create checkpoint every N sessions */
  afterSessions: number;
  /** Create checkpoint every M hours */
  afterHours: number;
  /** Create checkpoint on task failure */
  onError: boolean;
  /** Pause if confidence drops below threshold */
  onConfidenceBelow: number;
  /** Create checkpoint when human redirects */
  onRedirect: boolean;
}

export interface HarnessState {
  /** Harness issue ID */
  id: string;
  /** Current status */
  status: HarnessStatus;
  /** Harness mode */
  mode: HarnessMode;
  /** Path to spec file */
  specFile: string;
  /** Git branch for this harness run */
  gitBranch: string;
  /** Start timestamp */
  startedAt: string;
  /** Current session number */
  currentSession: number;
  /** Completed session count */
  sessionsCompleted: number;
  /** Total features to implement */
  featuresTotal: number;
  /** Features completed */
  featuresCompleted: number;
  /** Features failed */
  featuresFailed: number;
  /** Last checkpoint ID */
  lastCheckpoint: string | null;
  /** Checkpoint policy */
  checkpointPolicy: CheckpointPolicy;
  /** Pause reason if paused */
  pauseReason: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoints
// ─────────────────────────────────────────────────────────────────────────────

export interface Checkpoint {
  /** Checkpoint issue ID */
  id: string;
  /** Parent harness ID */
  harnessId: string;
  /** Session number when created */
  sessionNumber: number;
  /** Creation timestamp */
  timestamp: string;
  /** Human-readable summary */
  summary: string;
  /** Completed issue IDs */
  issuesCompleted: string[];
  /** In-progress issue IDs */
  issuesInProgress: string[];
  /** Failed issue IDs */
  issuesFailed: string[];
  /** Git commit hash */
  gitCommit: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Human redirect notes */
  redirectNotes: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────

export type SessionOutcome = 'success' | 'failure' | 'partial' | 'context_overflow';

export interface SessionResult {
  /** Issue being worked on */
  issueId: string;
  /** Session outcome */
  outcome: SessionOutcome;
  /** Human-readable summary */
  summary: string;
  /** Git commit hash (if any) */
  gitCommit: string | null;
  /** Context tokens used */
  contextUsed: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message if failed */
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redirect Detection
// ─────────────────────────────────────────────────────────────────────────────

export type RedirectType = 'priority_change' | 'new_urgent' | 'issue_closed' | 'pause_requested';

export interface Redirect {
  /** Type of redirect */
  type: RedirectType;
  /** Related issue ID (if any) */
  issueId: string | null;
  /** Human-readable description */
  description: string;
  /** Detection timestamp */
  detectedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Priming Context
// ─────────────────────────────────────────────────────────────────────────────

export interface PrimingContext {
  /** Current issue to work on */
  currentIssue: Issue;
  /** Recent git commits */
  recentCommits: string[];
  /** Last checkpoint summary */
  lastCheckpoint: Checkpoint | null;
  /** Human redirect notes */
  redirectNotes: string[];
  /** Session goal description */
  sessionGoal: string;
  /** Harness mode */
  mode: HarnessMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Options
// ─────────────────────────────────────────────────────────────────────────────

export interface StartOptions {
  /** Path to spec file */
  specFile: string;
  /** Harness mode */
  mode: HarnessMode;
  /** Sessions between checkpoints */
  checkpointEvery?: number;
  /** Max hours before auto-pause */
  maxHours?: number;
  /** Confidence threshold for pause */
  confidenceThreshold?: number;
  /** Dry run (parse spec only) */
  dryRun?: boolean;
}

export interface ResumeOptions {
  /** Harness ID to resume */
  harnessId?: string;
}

export interface PauseOptions {
  /** Pause reason */
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CHECKPOINT_POLICY: CheckpointPolicy = {
  afterSessions: 3,
  afterHours: 4,
  onError: true,
  onConfidenceBelow: 0.7,
  onRedirect: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint Tracker (internal state)
// ─────────────────────────────────────────────────────────────────────────────

export interface CheckpointTracker {
  /** Session results since last checkpoint */
  sessionsResults: SessionResult[];
  /** Timestamp of last checkpoint */
  lastCheckpointTime: string;
  /** Total elapsed time in ms */
  elapsedMs: number;
}
