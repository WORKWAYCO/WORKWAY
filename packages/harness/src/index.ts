/**
 * @workwayco/harness
 *
 * Autonomous agent harness for WORKWAY.
 * Multi-session project execution with checkpoints and human steering.
 *
 * Zuhandenheit: The harness recedes into transparent operation.
 * Humans engage through progress reports—reactive steering rather than proactive management.
 *
 * @example
 * ```typescript
 * import { initializeHarness, runHarness } from '@workwayco/harness';
 *
 * // Initialize from spec file
 * const { harnessState } = await initializeHarness({
 *   specFile: 'specs/my-project.md',
 *   mode: 'workflow',
 *   checkpointEvery: 3,
 *   maxHours: 8,
 * }, process.cwd());
 *
 * // Run the harness loop
 * await runHarness(harnessState, { cwd: process.cwd() });
 * ```
 */

// Core runner functions
export {
  initializeHarness,
  runHarness,
  pauseHarness,
  resumeHarness,
  getHarnessStatus,
} from './runner.js';

// Spec parsing
export {
  parseSpec,
  formatSpecSummary,
  validateSpec,
} from './spec-parser.js';

// Session management
export {
  runSession,
  generatePrimingPrompt,
  discoverDryContext,
  getRecentCommits,
  getHeadCommit,
  createHarnessBranch,
} from './session.js';

// Checkpoint management
export {
  createCheckpointTracker,
  recordSession,
  resetTracker,
  calculateConfidence,
  shouldPauseForConfidence,
  shouldCreateCheckpoint,
  generateCheckpoint,
  formatCheckpointDisplay,
  checkAndCreateCheckpointFromHook,
  DEFAULT_HOOK_CONFIG as DEFAULT_CHECKPOINT_HOOK_CONFIG,
} from './checkpoint.js';
export type { HookCheckpointConfig } from './checkpoint.js';

// Redirect detection
export {
  takeSnapshot,
  checkForRedirects,
  requiresImmediateAction,
  formatRedirectNotes,
  logRedirect,
} from './redirect.js';
export type { BeadsSnapshot, RedirectCheckResult } from './redirect.js';

// GAS TOWN Pattern: Role-based agents
export { Coordinator } from './coordinator.js';
export type { CoordinatorOptions, WorkAssignment } from './coordinator.js';

export { Worker, WorkerPool, DEFAULT_WORKER_CONFIG } from './worker.js';
export type { WorkerState, WorkerResult, WorkerConfig, WorkerExecutionMode } from './worker.js';

export { Observer } from './observer.js';
export type { ProgressSnapshot, HealthCheck } from './observer.js';

// Merge queue (Refinery pattern)
export {
  MergeQueue,
  createMergeQueue,
  createMergeRequest,
} from './merge-queue.js';

// Hook Queue (crash-resilient work distribution)
export {
  HookQueue,
  createHookQueue,
} from './hook-queue.js';

// Convoy System (cross-project work grouping)
export {
  ConvoySystem,
  createConvoySystem,
  createConvoy,
  getConvoy,
  displayConvoy,
} from './convoy.js';

// Molecular Workflows (step-level state tracking)
export {
  MoleculeManager,
  createMoleculeManager,
} from './molecule.js';

// Scale Management (Phase 2: 20-30 concurrent agents)
export {
  ScaleManager,
  createScaleManager,
} from './scale-manager.js';
export type { ScaleMetrics } from './scale-manager.js';

// Model Routing (Cost Optimization)
export {
  getModelFromConfig,
  escalateModel,
  estimateModelCost,
  calculateCostSavings,
  formatModelSelection,
  DEFAULT_MODEL_ROUTING,
} from './model-routing.js';
export type { ModelRoutingConfig } from './model-routing.js';

// Reviewer System (Specialized Reviews)
export {
  getReviewerModel,
  getReviewerFocusAreas,
  estimateReviewCost,
  calculateReviewPipelineCost,
  calculateReviewerSavings,
  formatReviewer,
  isBlockingFinding,
  getBlockingFindings,
  groupFindingsByFile,
  formatFindings,
  DEFAULT_REVIEWER_CONFIG,
} from './reviewer.js';
export type {
  ReviewerType,
  FindingSeverity,
  ReviewFinding,
  ReviewResult,
  ReviewerConfig,
} from './reviewer.js';

// Types
export type {
  HarnessMode,
  HarnessModeConfig,
  Feature,
  ParsedSpec,
  HarnessStatus,
  CheckpointPolicy,
  HarnessState,
  Checkpoint,
  SessionOutcome,
  SessionResult,
  RedirectType,
  Redirect,
  PrimingContext,
  StartOptions,
  ResumeOptions,
  PauseOptions,
  CheckpointTracker,
  MergeRequest,
  MergeResult,
  MergeConflictType,
  MergeQueueState,
  HookState,
  HookClaim,
  HookQueueConfig,
  ClaimResult,
  ClaudeModelFamily,
  DetectedModel,
  Convoy,
  ConvoyCreateOptions,
  ConvoyProgress,
  Molecule,
  MoleculeStep,
  MoleculeStepState,
  MoleculeState,
  MoleculeStepCheckpoint,
  MoleculeAdvanceResult,
  MoleculeExecutionConfig,
  MoleculeMetadata,
  ScaleConfig,
} from './types.js';

export { DEFAULT_CHECKPOINT_POLICY, DEFAULT_HOOK_CONFIG, DEFAULT_MOLECULE_CONFIG, DEFAULT_SCALE_CONFIG, DEFAULT_MODE_CONFIGS } from './types.js';
