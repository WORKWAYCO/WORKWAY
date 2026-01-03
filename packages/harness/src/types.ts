/**
 * @workwayco/harness
 *
 * Types for the autonomous agent harness.
 * Beads-based human oversight with progress reports and reactive redirection.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Beads Issue (from bd CLI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Issue type from bd CLI.
 * Matches the structure returned by `bd list --json`.
 */
export interface BeadsIssue {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'closed';
  priority?: number;
  issue_type?: string;
  labels?: string[];
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
}

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

/**
 * Session outcome with two-stage verification support.
 * - success: Feature fully verified and working
 * - code_complete: Code written and compiles, but not yet verified end-to-end
 * - failure: Session failed with errors
 * - partial: Some progress made but blocked
 * - context_overflow: Ran out of context tokens
 */
export type SessionOutcome = 'success' | 'code_complete' | 'failure' | 'partial' | 'context_overflow';

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
  currentIssue: BeadsIssue;
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
  /** Existing patterns to reuse (DRY) */
  existingPatterns?: string[];
  /** Relevant files to reference (DRY) */
  relevantFiles?: string[];
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

// ─────────────────────────────────────────────────────────────────────────────
// Hook System (GAS TOWN-inspired crash recovery)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook state labels used in Beads for work lifecycle tracking.
 *
 * State transitions:
 * - hook:ready → hook:in-progress (agent claims work)
 * - hook:in-progress → hook:ready (agent crashes/releases)
 * - hook:in-progress → closed (work completed)
 * - hook:in-progress → hook:failed (work failed after retries)
 */
export type HookState = 'hook:ready' | 'hook:in-progress' | 'hook:failed';

/**
 * Hook claim represents an agent's active work on an issue.
 * Stored in the issue's labels and metadata.
 */
export interface HookClaim {
  /** Issue ID */
  issueId: string;
  /** Agent identifier (e.g., process PID, session ID) */
  agentId: string;
  /** When the claim was made */
  claimedAt: string;
  /** Last heartbeat timestamp */
  lastHeartbeat: string;
  /** Issue title for logging */
  title: string;
}

/**
 * Configuration for hook queue behavior.
 */
export interface HookQueueConfig {
  /** How long (ms) before a claim is considered stale and auto-released */
  claimTimeoutMs: number;
  /** How often (ms) to send heartbeats to keep claim alive */
  heartbeatIntervalMs: number;
  /** Maximum retry attempts for failed work */
  maxRetries: number;
}

/**
 * Default hook queue configuration.
 */
export const DEFAULT_HOOK_CONFIG: HookQueueConfig = {
  claimTimeoutMs: 10 * 60 * 1000, // 10 minutes
  heartbeatIntervalMs: 60 * 1000, // 1 minute
  maxRetries: 2,
};

/**
 * Result of attempting to claim work from the hook queue.
 */
export interface ClaimResult {
  /** Whether claim was successful */
  success: boolean;
  /** Claimed issue (if successful) */
  issue?: BeadsIssue;
  /** Reason for failure (if unsuccessful) */
  reason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge Queue (Refinery Pattern from GAS TOWN)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merge conflict type.
 * - none: No conflicts detected
 * - overlapping_files: Same files modified (auto-mergeable if non-overlapping hunks)
 * - complex: Requires manual resolution
 */
export type MergeConflictType = 'none' | 'overlapping_files' | 'complex';

/**
 * Merge request from a worker session.
 */
export interface MergeRequest {
  /** Worker/session ID making the request */
  workerId: string;
  /** Issue ID being merged */
  issueId: string;
  /** Git commit hash to merge */
  commitHash: string;
  /** Files modified in this commit */
  filesModified: string[];
  /** Branch name (if using branches) */
  branchName?: string;
  /** Request timestamp */
  requestedAt: string;
}

/**
 * Result of merge validation.
 */
export interface MergeResult {
  /** Whether merge is allowed */
  allowed: boolean;
  /** Conflict type detected */
  conflictType: MergeConflictType;
  /** Conflicting files (if any) */
  conflictingFiles: string[];
  /** Conflicting worker IDs (if any) */
  conflictsWith: string[];
  /** Human-readable reason */
  reason: string;
  /** Whether this can be auto-merged despite conflicts */
  autoMergeable: boolean;
}

/**
 * Merge queue state for coordinating concurrent workers.
 */
export interface MergeQueueState {
  /** Pending merge requests */
  pending: MergeRequest[];
  /** Currently merging request (lock) */
  merging: MergeRequest | null;
  /** Completed merge requests */
  completed: MergeRequest[];
  /** Failed merge requests */
  failed: Array<{ request: MergeRequest; reason: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Detection (for adaptive behavior)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Claude model family.
 */
export type ClaudeModelFamily = 'opus' | 'sonnet' | 'haiku' | 'unknown';

/**
 * Detected model information from Claude Code output.
 */
export interface DetectedModel {
  /** Normalized model ID */
  modelId: string;
  /** Raw model ID string */
  raw: string;
  /** Model family (opus, sonnet, haiku) */
  family: ClaudeModelFamily;
  /** Version date (YYYYMMDD) if present */
  versionDate: string | null;
  /** Whether this is a "latest" alias (e.g., "opus", "sonnet") */
  isLatest: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Molecular Workflows (GAS TOWN-inspired step-level state tracking)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step state within a molecule.
 * Maps to GAS TOWN's crash-resilient step tracking.
 */
export type MoleculeStepState = 'pending' | 'in_progress' | 'complete' | 'failed' | 'skipped';

/**
 * A single step within a molecular workflow.
 * Steps are atomic units of work with crash-resilient state tracking.
 */
export interface MoleculeStep {
  /** Unique step ID within the molecule */
  id: string;
  /** Human-readable step title */
  title: string;
  /** Step description */
  description?: string;
  /** Current state */
  state: MoleculeStepState;
  /** Step IDs this depends on */
  dependsOn: string[];
  /** Beads issue ID for this step (if created) */
  issueId?: string;
  /** Start timestamp (when moved to in_progress) */
  startedAt?: string;
  /** Completion timestamp (when moved to complete) */
  completedAt?: string;
  /** Failure reason (if failed) */
  failureReason?: string;
  /** Retry count */
  retryCount: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Checkpoint data for resume */
  checkpoint?: MoleculeStepCheckpoint;
}

/**
 * Checkpoint data stored in a molecule step for crash recovery.
 * Enables auto-resume from last successful step.
 */
export interface MoleculeStepCheckpoint {
  /** Files modified during this step */
  filesModified: string[];
  /** Git commit hash (if committed) */
  gitCommit?: string;
  /** Test results */
  testsPassed: boolean;
  /** Context notes from agent */
  notes: string;
  /** Timestamp when checkpoint was captured */
  capturedAt: string;
}

/**
 * A molecule represents a multi-step workflow with crash-resilient execution.
 * Inspired by GAS TOWN's molecular formulas with step-level state tracking.
 */
export interface Molecule {
  /** Unique molecule ID */
  id: string;
  /** Molecule title */
  title: string;
  /** Molecule description */
  description?: string;
  /** Parent Beads issue ID (epic/molecule container) */
  parentIssueId: string;
  /** All steps in this molecule */
  steps: MoleculeStep[];
  /** Overall molecule state (derived from steps) */
  state: MoleculeState;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Metadata for molecule execution */
  metadata: MoleculeMetadata;
}

/**
 * Overall molecule state (derived from step states).
 */
export type MoleculeState = 'pending' | 'in_progress' | 'complete' | 'failed' | 'paused';

/**
 * Metadata for molecule execution.
 */
export interface MoleculeMetadata {
  /** Template ID if spawned from proto */
  templateId?: string;
  /** Variables used during spawn */
  variables?: Record<string, string>;
  /** Agent that created this molecule */
  createdBy: string;
  /** Labels for categorization */
  labels: string[];
}

/**
 * Result of advancing a molecule to the next step.
 */
export interface MoleculeAdvanceResult {
  /** Whether advance was successful */
  success: boolean;
  /** Next step to execute (if successful) */
  nextStep?: MoleculeStep;
  /** Reason for failure (if unsuccessful) */
  reason?: string;
  /** Completed step (if this was a step completion) */
  completedStep?: MoleculeStep;
}

/**
 * Configuration for molecule execution.
 */
export interface MoleculeExecutionConfig {
  /** Auto-commit after each step */
  autoCommit: boolean;
  /** Auto-create Beads issues for each step */
  createStepIssues: boolean;
  /** Capture checkpoints after each step */
  captureCheckpoints: boolean;
  /** Max retries per step (default from step config) */
  defaultMaxRetries: number;
}

/**
 * Default molecule execution configuration.
 */
export const DEFAULT_MOLECULE_CONFIG: MoleculeExecutionConfig = {
  autoCommit: false,
  createStepIssues: true,
  captureCheckpoints: true,
  defaultMaxRetries: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// Convoy System (GAS TOWN Pattern - cross-project work grouping)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convoy metadata for grouping related work across projects.
 */
export interface Convoy {
  /** Convoy name (from convoy:<name> label) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Description of the convoy's purpose */
  description: string;
  /** Total issues in convoy */
  totalIssues: number;
  /** Completed issues */
  completedIssues: number;
  /** In-progress issues */
  inProgressIssues: number;
  /** Failed issues */
  failedIssues: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Issue IDs in convoy */
  issueIds: string[];
  /** Repository paths participating in convoy */
  repos: string[];
  /** Creation timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Convoy creation options.
 */
export interface ConvoyCreateOptions {
  /** Convoy name (will be prefixed with convoy:) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Description of the convoy's purpose */
  description?: string;
  /** Initial issue IDs to add to convoy */
  issueIds?: string[];
  /** Working directory */
  cwd?: string;
}

/**
 * Convoy progress snapshot.
 */
export interface ConvoyProgress {
  /** Convoy name */
  name: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Total issues */
  total: number;
  /** Completed issues */
  completed: number;
  /** In-progress issues */
  inProgress: number;
  /** Failed issues */
  failed: number;
  /** Timestamp */
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scale Management (Phase 2 GAS TOWN - 20-30 concurrent agents)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scale configuration for managing 20-30 concurrent agents.
 */
export interface ScaleConfig {
  /** Minimum workers in pool */
  minWorkers: number;
  /** Maximum workers in pool */
  maxWorkers: number;
  /** Target queue depth to maintain */
  targetQueueDepth: number;
  /** Maximum queue depth before applying backpressure */
  maxQueueDepth: number;
  /** Worker stall timeout (ms) */
  workerStallTimeoutMs: number;
  /** Health check interval (ms) */
  healthCheckIntervalMs: number;
  /** Scale up threshold (queue/workers ratio) */
  scaleUpThreshold: number;
  /** Scale down threshold (queue/workers ratio) */
  scaleDownThreshold: number;
  /** Cooldown period (ms) between scale operations */
  scaleCooldownMs: number;
  /** Maximum sessions per worker (resource quota) */
  maxSessionsPerWorker: number;
}

/**
 * Scale metrics for monitoring and capacity planning.
 */
export interface ScaleMetrics {
  /** Current worker count */
  currentWorkers: number;
  /** Active (working) workers */
  activeWorkers: number;
  /** Idle workers */
  idleWorkers: number;
  /** Stalled workers detected */
  stalledWorkers: number;
  /** Current queue depth */
  queueDepth: number;
  /** Throughput (sessions completed / minute) */
  throughputPerMinute: number;
  /** Average session duration (ms) */
  avgSessionDurationMs: number;
  /** P95 session duration (ms) */
  p95SessionDurationMs: number;
  /** Total sessions completed */
  totalSessionsCompleted: number;
  /** Total sessions failed */
  totalSessionsFailed: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Backpressure active */
  backpressureActive: boolean;
  /** Last scale operation timestamp */
  lastScaleAt: string | null;
  /** Scale operations count */
  scaleOperations: number;
  /** Merge queue depth */
  mergeQueueDepth: number;
  /** Health status */
  health: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * Default scale configuration (Phase 2: 20-30 agents).
 */
export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  minWorkers: 4,
  maxWorkers: 30,
  targetQueueDepth: 10,
  maxQueueDepth: 100,
  workerStallTimeoutMs: 10 * 60 * 1000, // 10 minutes
  healthCheckIntervalMs: 30 * 1000, // 30 seconds
  scaleUpThreshold: 2.0,
  scaleDownThreshold: 0.5,
  scaleCooldownMs: 60 * 1000, // 1 minute
  maxSessionsPerWorker: 50,
};
