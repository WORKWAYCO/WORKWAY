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
} from './types.js';

export { DEFAULT_CHECKPOINT_POLICY } from './types.js';
