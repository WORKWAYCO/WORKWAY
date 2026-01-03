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
} from './checkpoint.js';

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

export { Worker, WorkerPool } from './worker.js';
export type { WorkerState, WorkerResult } from './worker.js';

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

// Types
export type {
  HarnessMode,
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
} from './types.js';

export { DEFAULT_CHECKPOINT_POLICY, DEFAULT_HOOK_CONFIG, DEFAULT_MOLECULE_CONFIG } from './types.js';
