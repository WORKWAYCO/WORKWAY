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
  Redirect,
} from './types.js';
import { getHeadCommit } from './session.js';

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
