/**
 * @workwayco/harness
 *
 * Checkpoint: Progress reporting and confidence scoring.
 * Creates structured oversight opportunities without requiring constant management.
 */

import chalk from 'chalk';
import { BeadsStore } from '@workwayco/beads';
import type {
  Checkpoint,
  CheckpointPolicy,
  CheckpointTracker,
  SessionResult,
  SessionOutcome,
  HarnessState,
} from './types.js';
import { getHeadCommit } from './session.js';
import {
  checkForRedirects,
  formatRedirectNotes,
  takeSnapshot,
} from './redirect.js';
import type { BeadsSnapshot } from './redirect.js';

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint Tracker
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new checkpoint tracker.
 */
export function createCheckpointTracker(): CheckpointTracker {
  return {
    sessionsResults: [],
    lastCheckpointTime: new Date().toISOString(),
    elapsedMs: 0,
  };
}

/**
 * Record a session result.
 */
export function recordSession(tracker: CheckpointTracker, result: SessionResult): void {
  tracker.sessionsResults.push(result);
  tracker.elapsedMs += result.durationMs;
}

/**
 * Reset tracker after checkpoint.
 */
export function resetTracker(tracker: CheckpointTracker): void {
  tracker.sessionsResults = [];
  tracker.lastCheckpointTime = new Date().toISOString();
  tracker.elapsedMs = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outcome weights for confidence calculation.
 */
const OUTCOME_WEIGHTS: Record<SessionOutcome, number> = {
  success: 1.0,
  code_complete: 0.8, // Code done, needs verification
  partial: 0.5,
  failure: 0.0,
  context_overflow: 0.3, // Not a failure, but not ideal
};

/**
 * Calculate confidence score from session results.
 * Recent failures are weighted more heavily.
 */
export function calculateConfidence(results: SessionResult[]): number {
  if (results.length === 0) return 1.0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < results.length; i++) {
    // More recent results have higher weight
    const recencyWeight = 1 + (i / results.length);
    const outcomeScore = OUTCOME_WEIGHTS[results[i].outcome];

    weightedSum += outcomeScore * recencyWeight;
    totalWeight += recencyWeight;
  }

  // Apply penalty for consecutive recent failures
  const recentResults = results.slice(-3);
  const recentFailures = recentResults.filter((r) => r.outcome === 'failure').length;
  const failurePenalty = recentFailures * 0.1;

  const confidence = Math.max(0, (weightedSum / totalWeight) - failurePenalty);
  return Math.min(1, confidence);
}

/**
 * Check if confidence is below threshold.
 */
export function shouldPauseForConfidence(
  results: SessionResult[],
  threshold: number
): boolean {
  if (results.length < 3) return false; // Need enough data
  return calculateConfidence(results) < threshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint Policy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a checkpoint should be created.
 */
export function shouldCreateCheckpoint(
  tracker: CheckpointTracker,
  policy: CheckpointPolicy,
  lastResult: SessionResult,
  hasRedirects: boolean
): { create: boolean; reason: string } {
  // On error
  if (policy.onError && lastResult.outcome === 'failure') {
    return { create: true, reason: 'Task failure' };
  }

  // On redirect
  if (policy.onRedirect && hasRedirects) {
    return { create: true, reason: 'Human redirect' };
  }

  // After N sessions
  if (tracker.sessionsResults.length >= policy.afterSessions) {
    return { create: true, reason: `${policy.afterSessions} sessions completed` };
  }

  // After M hours
  const hoursElapsed = tracker.elapsedMs / (1000 * 60 * 60);
  if (hoursElapsed >= policy.afterHours) {
    return { create: true, reason: `${policy.afterHours} hours elapsed` };
  }

  return { create: false, reason: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a checkpoint from current state.
 */
export async function generateCheckpoint(
  tracker: CheckpointTracker,
  state: HarnessState,
  redirectNotes: string,
  cwd: string
): Promise<Checkpoint> {
  const store = new BeadsStore(cwd);
  const gitCommit = await getHeadCommit(cwd) || 'unknown';

  // Categorize issues from session results
  const issuesCompleted: string[] = [];
  const issuesInProgress: string[] = [];
  const issuesFailed: string[] = [];

  for (const result of tracker.sessionsResults) {
    if (result.outcome === 'success') {
      issuesCompleted.push(result.issueId);
    } else if (result.outcome === 'failure') {
      issuesFailed.push(result.issueId);
    } else {
      issuesInProgress.push(result.issueId);
    }
  }

  const confidence = calculateConfidence(tracker.sessionsResults);

  // Generate summary
  const summary = generateSummary(tracker.sessionsResults, confidence);

  // Create checkpoint issue in Beads
  const checkpointIssue = await store.createIssue({
    title: `Checkpoint #${state.currentSession}: ${summary.slice(0, 50)}`,
    description: formatCheckpointDescription({
      harnessId: state.id,
      sessionNumber: state.currentSession,
      summary,
      issuesCompleted,
      issuesInProgress,
      issuesFailed,
      confidence,
      gitCommit,
      redirectNotes,
    }),
    type: 'task',
    priority: 2,
    labels: ['checkpoint', `harness:${state.id}`],
  });

  return {
    id: checkpointIssue.id,
    harnessId: state.id,
    sessionNumber: state.currentSession,
    timestamp: new Date().toISOString(),
    summary,
    issuesCompleted,
    issuesInProgress,
    issuesFailed,
    gitCommit,
    confidence,
    redirectNotes: redirectNotes || null,
  };
}

/**
 * Generate a human-readable summary.
 */
function generateSummary(results: SessionResult[], confidence: number): string {
  const completed = results.filter((r) => r.outcome === 'success').length;
  const failed = results.filter((r) => r.outcome === 'failure').length;
  const partial = results.filter((r) => r.outcome === 'partial' || r.outcome === 'context_overflow').length;

  const parts: string[] = [];

  if (completed > 0) parts.push(`${completed} completed`);
  if (partial > 0) parts.push(`${partial} in progress`);
  if (failed > 0) parts.push(`${failed} failed`);

  const confPercent = (confidence * 100).toFixed(0);

  return parts.length > 0
    ? `${parts.join(', ')} (${confPercent}% confidence)`
    : `No progress (${confPercent}% confidence)`;
}

/**
 * Format checkpoint as description.
 */
function formatCheckpointDescription(checkpoint: Omit<Checkpoint, 'id' | 'timestamp'>): string {
  const lines: string[] = [];

  lines.push(`## Summary`);
  lines.push(checkpoint.summary);
  lines.push('');

  if (checkpoint.issuesCompleted.length > 0) {
    lines.push(`## Completed`);
    for (const id of checkpoint.issuesCompleted) {
      lines.push(`- ${id}`);
    }
    lines.push('');
  }

  if (checkpoint.issuesInProgress.length > 0) {
    lines.push(`## In Progress`);
    for (const id of checkpoint.issuesInProgress) {
      lines.push(`- ${id}`);
    }
    lines.push('');
  }

  if (checkpoint.issuesFailed.length > 0) {
    lines.push(`## Failed`);
    for (const id of checkpoint.issuesFailed) {
      lines.push(`- ${id}`);
    }
    lines.push('');
  }

  lines.push(`## Confidence: ${(checkpoint.confidence * 100).toFixed(0)}%`);
  lines.push('');

  if (checkpoint.redirectNotes) {
    lines.push(`## Redirect Notes`);
    lines.push(checkpoint.redirectNotes);
    lines.push('');
  }

  lines.push(`## Metadata`);
  lines.push(`- Session: ${checkpoint.sessionNumber}`);
  lines.push(`- Git Commit: ${checkpoint.gitCommit}`);
  lines.push(`- Harness: ${checkpoint.harnessId}`);

  return lines.join('\n');
}

interface SerializedBeadsSnapshot {
  timestamp: string;
  issues: Array<{
    id: string;
    priority: number;
    status: string;
  }>;
  urgentIds: string[];
}

function serializeSnapshot(snapshot: BeadsSnapshot): SerializedBeadsSnapshot {
  return {
    timestamp: snapshot.timestamp,
    issues: Array.from(snapshot.issues.entries()).map(([id, state]) => ({
      id,
      priority: state.priority,
      status: state.status,
    })),
    urgentIds: Array.from(snapshot.urgentIds),
  };
}

function deserializeSnapshot(serialized: SerializedBeadsSnapshot): BeadsSnapshot {
  return {
    timestamp: serialized.timestamp,
    issues: new Map(
      serialized.issues.map((issue) => [
        issue.id,
        { priority: issue.priority, status: issue.status },
      ])
    ),
    urgentIds: new Set(serialized.urgentIds),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook-Based Checkpoint Triggering (Claude Code 2.1.0+)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check and potentially create checkpoint from PostToolUse hook.
 * This is called automatically by the harness-checkpoint.md skill.
 *
 * @returns true if checkpoint was created, false otherwise
 */
export async function checkAndCreateCheckpointFromHook(
  cwd: string
): Promise<{ created: boolean; reason: string }> {
  try {
    // Read harness state from .harness/state.json
    const { readFile, writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const statePath = join(cwd, '.harness/state.json');
    const stateContent = await readFile(statePath, 'utf-8');
    const state: HarnessState = JSON.parse(stateContent);

    // Read tracker state
    const trackerPath = join(cwd, '.harness/tracker.json');
    const trackerContent = await readFile(trackerPath, 'utf-8');
    const tracker: CheckpointTracker = JSON.parse(trackerContent);

    if (tracker.sessionsResults.length === 0) {
      return { created: false, reason: 'No completed sessions to evaluate' };
    }

    // Detect redirects by diffing the current Beads snapshot against the last hook snapshot.
    const redirectSnapshotPath = join(cwd, '.harness/redirect-snapshot.json');
    let previousSnapshot: BeadsSnapshot;

    try {
      const redirectSnapshotContent = await readFile(redirectSnapshotPath, 'utf-8');
      previousSnapshot = deserializeSnapshot(JSON.parse(redirectSnapshotContent) as SerializedBeadsSnapshot);
    } catch {
      previousSnapshot = await takeSnapshot(cwd);
    }

    const redirectCheck = await checkForRedirects(previousSnapshot, state.id, cwd);
    const hasRedirects = redirectCheck.redirects.length > 0;
    const redirectNotes = formatRedirectNotes(redirectCheck.redirects);

    // Check if we need a checkpoint
    const lastResult = tracker.sessionsResults[tracker.sessionsResults.length - 1];

    const decision = shouldCreateCheckpoint(
      tracker,
      state.checkpointPolicy,
      lastResult,
      hasRedirects
    );

    if (!decision.create) {
      await writeFile(
        redirectSnapshotPath,
        JSON.stringify(serializeSnapshot(redirectCheck.newSnapshot), null, 2)
      );
      return { created: false, reason: 'Checkpoint criteria not met' };
    }

    // Create checkpoint
    const checkpoint = await generateCheckpoint(
      tracker,
      state,
      redirectNotes,
      cwd
    );

    // Reset tracker
    resetTracker(tracker);

    // Update state
    state.lastCheckpoint = checkpoint.id;

    // Write updated state, tracker, and redirect snapshot baseline.
    await writeFile(statePath, JSON.stringify(state, null, 2));
    await writeFile(trackerPath, JSON.stringify(tracker, null, 2));
    await writeFile(
      redirectSnapshotPath,
      JSON.stringify(serializeSnapshot(redirectCheck.newSnapshot), null, 2)
    );

    return { created: true, reason: decision.reason };
  } catch (error) {
    // Hook failures should not crash the session
    console.error('Checkpoint hook error:', error);
    return { created: false, reason: 'Hook error' };
  }
}

/**
 * Enable or disable hook-based checkpoints via harness configuration.
 */
export interface HookCheckpointConfig {
  /** Enable hook-based checkpoint monitoring */
  enabled: boolean;
  /** Check interval (every N tool uses) to avoid overhead */
  checkInterval: number;
}

/**
 * Default hook checkpoint configuration.
 */
export const DEFAULT_HOOK_CONFIG: HookCheckpointConfig = {
  enabled: true,
  checkInterval: 5, // Check every 5 tool uses
};

// ─────────────────────────────────────────────────────────────────────────────
// Display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format checkpoint for console display.
 */
export function formatCheckpointDisplay(checkpoint: Checkpoint): string {
  const lines: string[] = [];

  lines.push(chalk.bold('═'.repeat(60)));
  lines.push(chalk.bold(`  📊 CHECKPOINT #${checkpoint.sessionNumber}`));
  lines.push(chalk.bold('═'.repeat(60)));
  lines.push('');
  lines.push(`  ${checkpoint.summary}`);
  lines.push('');

  if (checkpoint.issuesCompleted.length > 0) {
    lines.push(chalk.green(`  ✅ Completed: ${checkpoint.issuesCompleted.length}`));
  }
  if (checkpoint.issuesInProgress.length > 0) {
    lines.push(chalk.yellow(`  ◐ In Progress: ${checkpoint.issuesInProgress.length}`));
  }
  if (checkpoint.issuesFailed.length > 0) {
    lines.push(chalk.red(`  ❌ Failed: ${checkpoint.issuesFailed.length}`));
  }

  lines.push('');

  const confColor = checkpoint.confidence >= 0.7 ? chalk.green :
                   checkpoint.confidence >= 0.5 ? chalk.yellow : chalk.red;
  lines.push(`  Confidence: ${confColor((checkpoint.confidence * 100).toFixed(0) + '%')}`);

  if (checkpoint.redirectNotes) {
    lines.push('');
    lines.push(chalk.gray(`  Redirect: ${checkpoint.redirectNotes}`));
  }

  lines.push('');
  lines.push(chalk.gray(`  Git: ${checkpoint.gitCommit.slice(0, 7)}`));
  lines.push(chalk.bold('═'.repeat(60)));

  return lines.join('\n');
}
