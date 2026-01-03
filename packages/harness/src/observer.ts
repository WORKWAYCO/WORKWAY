/**
 * @workwayco/harness - Observer (Witness)
 *
 * GAS TOWN Pattern: Witness observes progress without blocking execution.
 * Provides real-time status to coordinator without interfering with workers.
 *
 * Key principles:
 * - Non-blocking progress monitoring
 * - Read-only access to worker state
 * - Reports to coordinator on demand
 * - Never modifies worker state directly
 */

import type { WorkerState } from './worker.js';
import type { HarnessState, Checkpoint } from './types.js';
import { getHarnessReadyIssues, getHarnessCheckpoints } from './beads.js';

// ─────────────────────────────────────────────────────────────────────────────
// Observer Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressSnapshot {
  /** When snapshot was taken */
  timestamp: string;
  /** Harness state at snapshot time */
  harnessState: HarnessState;
  /** Worker states at snapshot time */
  workerStates: WorkerState[];
  /** Issues remaining in queue */
  queuedIssues: number;
  /** Latest checkpoint (if any) */
  latestCheckpoint: Checkpoint | null;
}

export interface HealthCheck {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Number of healthy workers */
  healthyWorkers: number;
  /** Number of failed workers */
  failedWorkers: number;
  /** Number of blocked workers */
  blockedWorkers: number;
  /** Average session duration (ms) */
  avgSessionDuration: number | null;
  /** Issues diagnosed */
  issues: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Observer Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Observer (Witness Pattern)
 *
 * Non-blocking progress monitoring. Reads state without modifying it.
 * Reports to coordinator on demand.
 *
 * Zuhandenheit: The observer is invisible - you see progress, not observation.
 */
export class Observer {
  private cwd: string;
  private snapshots: ProgressSnapshot[];
  private maxSnapshots: number;

  constructor(cwd: string, maxSnapshots = 100) {
    this.cwd = cwd;
    this.snapshots = [];
    this.maxSnapshots = maxSnapshots;
  }

  /**
   * Take a progress snapshot.
   * Non-blocking - reads current state without modification.
   */
  async takeSnapshot(
    harnessState: HarnessState,
    workerStates: WorkerState[]
  ): Promise<ProgressSnapshot> {
    // Get queued issues count (non-blocking read)
    const queuedIssues = await this.getQueuedIssuesCount(harnessState.id);

    // Get latest checkpoint (non-blocking read)
    const latestCheckpoint = await this.getLatestCheckpoint(harnessState.id);

    const snapshot: ProgressSnapshot = {
      timestamp: new Date().toISOString(),
      harnessState: { ...harnessState },
      workerStates: workerStates.map(s => ({ ...s })),
      queuedIssues,
      latestCheckpoint,
    };

    // Store snapshot (circular buffer)
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Get the most recent snapshot.
   */
  getLatestSnapshot(): ProgressSnapshot | null {
    return this.snapshots.length > 0
      ? this.snapshots[this.snapshots.length - 1]
      : null;
  }

  /**
   * Get all snapshots.
   */
  getAllSnapshots(): ProgressSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get snapshots within a time window.
   */
  getSnapshotsInWindow(startTime: string, endTime: string): ProgressSnapshot[] {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return this.snapshots.filter(s => {
      const time = new Date(s.timestamp).getTime();
      return time >= start && time <= end;
    });
  }

  /**
   * Perform health check on current state.
   * Non-blocking diagnostic analysis.
   */
  async performHealthCheck(workerStates: WorkerState[]): Promise<HealthCheck> {
    const issues: string[] = [];
    let healthyWorkers = 0;
    let failedWorkers = 0;
    let blockedWorkers = 0;

    // Analyze worker states
    for (const state of workerStates) {
      if (state.status === 'idle' || state.status === 'working') {
        healthyWorkers++;
      } else if (state.status === 'failed') {
        failedWorkers++;
        issues.push(`Worker ${state.id} failed: ${state.lastError || 'unknown error'}`);
      } else if (state.status === 'blocked') {
        blockedWorkers++;
        issues.push(`Worker ${state.id} is blocked`);
      }
    }

    // Calculate average session duration from snapshots
    const avgSessionDuration = this.calculateAvgSessionDuration();

    // Determine overall health
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failedWorkers === 0 && blockedWorkers === 0) {
      status = 'healthy';
    } else if (failedWorkers > 0 && healthyWorkers === 0) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    // Check for stuck workers
    const stuckWorkers = this.detectStuckWorkers(workerStates);
    if (stuckWorkers.length > 0) {
      for (const workerId of stuckWorkers) {
        issues.push(`Worker ${workerId} may be stuck (session > 30 minutes)`);
      }
      if (status === 'healthy') {
        status = 'degraded';
      }
    }

    return {
      status,
      healthyWorkers,
      failedWorkers,
      blockedWorkers,
      avgSessionDuration,
      issues,
    };
  }

  /**
   * Generate progress report.
   * Human-readable summary of current state.
   */
  generateProgressReport(snapshot: ProgressSnapshot): string {
    const lines: string[] = [];

    lines.push('╔════════════════════════════════════════════════════════════════╗');
    lines.push('║                    HARNESS PROGRESS REPORT                     ║');
    lines.push('╚════════════════════════════════════════════════════════════════╝');
    lines.push('');

    // Overall progress
    const { harnessState } = snapshot;
    const completionPct = harnessState.featuresTotal > 0
      ? ((harnessState.featuresCompleted / harnessState.featuresTotal) * 100).toFixed(0)
      : '0';

    lines.push(`Harness: ${harnessState.id}`);
    lines.push(`Status: ${harnessState.status}`);
    lines.push(`Progress: ${harnessState.featuresCompleted}/${harnessState.featuresTotal} (${completionPct}%)`);
    lines.push(`Sessions: ${harnessState.sessionsCompleted}`);
    lines.push(`Failed: ${harnessState.featuresFailed}`);
    lines.push('');

    // Worker status
    lines.push('Workers:');
    for (const worker of snapshot.workerStates) {
      const statusIcon = worker.status === 'idle' ? '○'
        : worker.status === 'working' ? '●'
        : worker.status === 'blocked' ? '◐'
        : '✗';
      const issue = worker.currentIssue ? ` (${worker.currentIssue.id})` : '';
      lines.push(`  ${statusIcon} ${worker.id}: ${worker.status}${issue}`);
    }
    lines.push('');

    // Queue status
    lines.push(`Queue: ${snapshot.queuedIssues} issues remaining`);
    lines.push('');

    // Latest checkpoint
    if (snapshot.latestCheckpoint) {
      const cp = snapshot.latestCheckpoint;
      lines.push(`Last Checkpoint: #${cp.sessionNumber}`);
      lines.push(`  Confidence: ${(cp.confidence * 100).toFixed(0)}%`);
      lines.push(`  Summary: ${cp.summary.slice(0, 60)}...`);
    }

    return lines.join('\n');
  }

  /**
   * Clear all snapshots.
   * Used for cleanup or reset.
   */
  clearSnapshots(): void {
    this.snapshots = [];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get count of queued issues (non-blocking).
   */
  private async getQueuedIssuesCount(harnessId: string): Promise<number> {
    try {
      const issues = await getHarnessReadyIssues(harnessId, this.cwd);
      return issues.length;
    } catch {
      return 0;
    }
  }

  /**
   * Get latest checkpoint (non-blocking).
   */
  private async getLatestCheckpoint(harnessId: string): Promise<Checkpoint | null> {
    try {
      const checkpointIssues = await getHarnessCheckpoints(harnessId, this.cwd);
      if (checkpointIssues.length === 0) {
        return null;
      }

      // Convert BeadsIssue to Checkpoint (simplified version for observer)
      const issue = checkpointIssues[0];
      const sessionMatch = issue.title.match(/Checkpoint #(\d+)/);

      return {
        id: issue.id,
        harnessId,
        sessionNumber: sessionMatch ? parseInt(sessionMatch[1], 10) : 0,
        timestamp: issue.created_at,
        summary: issue.description?.slice(0, 200) || 'No summary',
        issuesCompleted: [],
        issuesInProgress: [],
        issuesFailed: [],
        gitCommit: 'unknown',
        confidence: 0.5,
        redirectNotes: null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate average session duration from snapshots.
   */
  private calculateAvgSessionDuration(): number | null {
    if (this.snapshots.length < 2) {
      return null;
    }

    const durations: number[] = [];

    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1];
      const curr = this.snapshots[i];

      const prevTime = new Date(prev.timestamp).getTime();
      const currTime = new Date(curr.timestamp).getTime();

      // If sessions completed increased, record duration
      if (curr.harnessState.sessionsCompleted > prev.harnessState.sessionsCompleted) {
        durations.push(currTime - prevTime);
      }
    }

    if (durations.length === 0) {
      return null;
    }

    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  }

  /**
   * Detect workers that may be stuck.
   */
  private detectStuckWorkers(workerStates: WorkerState[]): string[] {
    const stuck: string[] = [];
    const now = Date.now();
    const STUCK_THRESHOLD = 30 * 60 * 1000; // 30 minutes

    for (const state of workerStates) {
      if (state.status === 'working' && state.sessionStartedAt) {
        const elapsed = now - new Date(state.sessionStartedAt).getTime();
        if (elapsed > STUCK_THRESHOLD) {
          stuck.push(state.id);
        }
      }
    }

    return stuck;
  }
}
