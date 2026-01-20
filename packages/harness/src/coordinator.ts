/**
 * @workwayco/harness - Coordinator (Mayor)
 *
 * GAS TOWN Pattern: Mayor coordinates work distribution.
 * Delegates to workers, monitors via observer, never executes directly.
 *
 * Key principles:
 * - Assigns work to workers (delegates, doesn't execute)
 * - Monitors progress via observer (non-blocking)
 * - Handles redirects and checkpoints
 * - Prevents context sprawl (one issue per worker)
 */

import type {
  HarnessState,
  PrimingContext,
  Checkpoint,
  CheckpointPolicy,
  ScaleConfig,
} from './types.js';
import type { BeadsIssue } from './types.js';
import type { WorkerResult } from './worker.js';
import { Worker, WorkerPool } from './worker.js';
import { Observer } from './observer.js';
import { ConvoySystem } from './convoy.js';
import { ScaleManager } from './scale-manager.js';
import {
  getHarnessReadyIssues,
  updateIssueStatus,
} from './beads.js';
import {
  createCheckpointTracker,
  recordSession,
  shouldCreateCheckpoint,
  shouldPauseForConfidence,
  generateCheckpoint,
  resetTracker,
  formatCheckpointDisplay,
  calculateConfidence,
} from './checkpoint.js';
import {
  takeSnapshot,
  checkForRedirects,
  requiresImmediateAction,
  formatRedirectNotes,
} from './redirect.js';
import { getRecentCommits } from './session.js';
import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────────────────
// Coordinator Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CoordinatorOptions {
  /** Working directory */
  cwd: string;
  /** Maximum concurrent workers */
  maxWorkers?: number;
  /** Dry run mode */
  dryRun?: boolean;
  /** Optional convoy name for convoy-aware work distribution */
  convoy?: string;
  /** Enable scale management (auto-scaling, health checks) */
  enableScaleManager?: boolean;
  /** Scale configuration override */
  scaleConfig?: Partial<ScaleConfig>;
}

export interface WorkAssignment {
  /** Worker ID */
  workerId: string;
  /** Issue assigned */
  issueId: string;
  /** Assignment timestamp */
  assignedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinator Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coordinator (Mayor Pattern)
 *
 * Distributes work to workers. Never executes work directly.
 * Monitors progress via observer without blocking.
 *
 * Zuhandenheit: The coordinator recedes - you see work getting done,
 * not the coordination machinery.
 */
export class Coordinator {
  private harnessState: HarnessState;
  private workerPool: WorkerPool;
  private observer: Observer;
  private convoySystem: ConvoySystem | null;
  private convoyName: string | null;
  private scaleManager: ScaleManager | null;
  private checkpointTracker: ReturnType<typeof createCheckpointTracker>;
  private cwd: string;
  private dryRun: boolean;
  private activeAssignments: Map<string, WorkAssignment>;
  private beadsSnapshot: Awaited<ReturnType<typeof takeSnapshot>>;
  private lastCheckpoint: Checkpoint | null;
  private redirectNotes: string[];

  constructor(
    harnessState: HarnessState,
    options: CoordinatorOptions
  ) {
    this.harnessState = harnessState;
    this.cwd = options.cwd;
    this.dryRun = options.dryRun || false;
    this.convoyName = options.convoy || null;
    this.convoySystem = this.convoyName ? new ConvoySystem(this.cwd) : null;

    // Initialize worker pool with maxWorkers (default: 1 for single-agent mode)
    const maxWorkers = options.maxWorkers || 1;
    this.workerPool = new WorkerPool(this.cwd, this.dryRun, { mode: harnessState.mode });
    for (let i = 1; i <= maxWorkers; i++) {
      this.workerPool.addWorker(`worker-${i}`);
    }

    // Initialize observer
    this.observer = new Observer(this.cwd);

    // Initialize scale manager if enabled
    this.scaleManager = options.enableScaleManager
      ? new ScaleManager(this.workerPool, this.cwd, null, options.scaleConfig)
      : null;

    // Initialize checkpoint tracker
    this.checkpointTracker = createCheckpointTracker();

    // Initialize state
    this.activeAssignments = new Map();
    this.beadsSnapshot = null as any; // Will be set in initialize()
    this.lastCheckpoint = null;
    this.redirectNotes = [];
  }

  /**
   * Initialize coordinator.
   * Must be called before run().
   */
  async initialize(): Promise<void> {
    // Take initial beads snapshot for redirect detection
    this.beadsSnapshot = await takeSnapshot(this.cwd);

    // Start scale manager if enabled
    if (this.scaleManager) {
      await this.scaleManager.start();
    }
  }

  /**
   * Run the coordination loop.
   * Delegates work to workers, monitors progress, handles redirects.
   */
  async run(): Promise<void> {
    const startTime = new Date();

    console.log(`\n${'═'.repeat(63)}`);
    console.log(`  COORDINATOR RUNNING: ${this.harnessState.id}`);
    console.log(`  Mode: ${this.harnessState.mode}`);
    console.log(`  Workers: ${this.workerPool.getMetrics().totalWorkers}`);
    console.log(`  Features: ${this.harnessState.featuresTotal}`);
    if (this.scaleManager) {
      console.log(`  Scale: Enabled (${this.scaleManager.getMetrics().currentWorkers} workers)`);
    }
    console.log(`${'═'.repeat(63)}\n`);

    while (this.harnessState.status === 'running') {
      // Apply backpressure if queue is too deep
      if (this.scaleManager?.shouldApplyBackpressure()) {
        console.log(chalk.yellow('⏸ Backpressure: Queue depth exceeded, throttling...'));
        await this.sleep(2000);
        continue;
      }
      // 1. Check for redirects
      const redirectCheck = await checkForRedirects(
        this.beadsSnapshot,
        this.harnessState.id,
        this.cwd
      );

      this.beadsSnapshot = redirectCheck.newSnapshot;

      if (redirectCheck.redirects.length > 0) {
        console.log('\n📢 Redirects detected:');
        for (const redirect of redirectCheck.redirects) {
          console.log(`  ${redirect.description}`);
        }
        this.redirectNotes.push(...redirectCheck.redirects.map(r => r.description));
      }

      // Check for pause request
      if (redirectCheck.shouldPause) {
        this.harnessState.status = 'paused';
        this.harnessState.pauseReason = redirectCheck.pauseReason;
        console.log(`\n⏸ Harness paused: ${redirectCheck.pauseReason}`);
        break;
      }

      // Create checkpoint if redirects require immediate action
      if (requiresImmediateAction(redirectCheck.redirects)) {
        if (this.checkpointTracker.sessionsResults.length > 0) {
          await this.createCheckpoint(formatRedirectNotes(redirectCheck.redirects));
        }
      }

      // 2. Get next work item
      const nextIssue = await this.getNextIssue();
      if (!nextIssue) {
        // No more work - check if all workers are idle
        const metrics = this.workerPool.getMetrics();
        if (metrics.workingWorkers === 0) {
          // All workers idle and no work remaining - completed
          this.harnessState.status = 'completed';
          this.displaySuccessFeedback(startTime);
          break;
        } else {
          // Workers still working - wait for them to finish
          await this.waitForWorker();
          continue;
        }
      }

      // 3. Get available worker
      const worker = this.workerPool.getAvailableWorker();
      if (!worker) {
        // No workers available - wait for one to finish
        await this.waitForWorker();
        continue;
      }

      // 4. Assign work to worker
      await this.assignWork(worker, nextIssue);

      // 5. Take progress snapshot (observer pattern)
      const workerStates = this.workerPool.getAllWorkers().map(w => w.getState());
      await this.observer.takeSnapshot(this.harnessState, workerStates);

      // 6. Small delay to avoid tight loop
      if (!this.dryRun) {
        await this.sleep(1000);
      }
    }

    // Final summary
    if (this.harnessState.status !== 'completed') {
      console.log(`\n${'═'.repeat(63)}`);
      console.log(`  HARNESS ${this.harnessState.status.toUpperCase()}`);
      console.log(`  Sessions: ${this.harnessState.sessionsCompleted}`);
      console.log(`  Features: ${this.harnessState.featuresCompleted}/${this.harnessState.featuresTotal}`);
      console.log(`  Failed: ${this.harnessState.featuresFailed}`);
      if (this.harnessState.pauseReason) {
        console.log(`  Pause Reason: ${this.harnessState.pauseReason}`);
      }
      console.log(`${'═'.repeat(63)}\n`);
    }

    // Stop scale manager
    if (this.scaleManager) {
      await this.scaleManager.stop();
      this.scaleManager.displayMetrics();
    }
  }

  /**
   * Get next issue from queue.
   * Non-blocking delegation - coordinator doesn't execute.
   * Convoy-aware: If convoy is set, prioritize convoy issues.
   */
  private async getNextIssue(): Promise<BeadsIssue | null> {
    // If convoy mode is enabled, get next issue from convoy
    if (this.convoySystem && this.convoyName) {
      const convoyIssue = await this.convoySystem.getNextIssue(this.convoyName, this.cwd);
      if (convoyIssue) {
        return convoyIssue;
      }
    }

    // Fall back to harness-scoped issues
    const harnessIssues = await getHarnessReadyIssues(this.harnessState.id, this.cwd);
    return harnessIssues.length > 0 ? harnessIssues[0] : null;
  }

  /**
   * Assign work to a worker.
   * Worker executes in isolation.
   */
  private async assignWork(worker: Worker, issue: BeadsIssue): Promise<void> {
    console.log(`\n📋 Assigning to ${worker.getState().id}: ${issue.id} - ${issue.title}`);

    // Mark issue as in progress
    await updateIssueStatus(issue.id, 'in_progress', this.cwd);

    // Record assignment
    this.activeAssignments.set(worker.getState().id, {
      workerId: worker.getState().id,
      issueId: issue.id,
      assignedAt: new Date().toISOString(),
    });

    // Claim work
    const claimed = await worker.claimWork(issue);
    if (!claimed) {
      console.log(chalk.red(`  Failed to claim work for ${worker.getState().id}`));
      return;
    }

    // Build priming context
    const recentCommits = await getRecentCommits(this.cwd, 10);
    const primingContext: PrimingContext = {
      currentIssue: issue,
      recentCommits,
      lastCheckpoint: this.lastCheckpoint,
      redirectNotes: this.redirectNotes,
      sessionGoal: `Complete: ${issue.title}\n\n${issue.description || ''}`,
      mode: this.harnessState.mode,
    };

    // Clear redirect notes for next iteration
    this.redirectNotes = [];

    // Execute work (non-blocking from coordinator perspective)
    this.harnessState.currentSession++;
    console.log(`🤖 ${worker.getState().id} starting session #${this.harnessState.currentSession}...`);

    // Record session start for scale metrics
    if (this.scaleManager) {
      this.scaleManager.recordSessionStart(worker.getState().id, issue.id);
    }

    try {
      const result = await worker.execute(primingContext);
      await this.handleWorkerResult(result);
    } catch (error) {
      console.log(chalk.red(`  Worker ${worker.getState().id} failed: ${error}`));
      worker.reset();

      // Record failed session
      if (this.scaleManager) {
        this.scaleManager.recordSessionComplete(worker.getState().id, issue.id, false);
      }
    }

    // Clear assignment
    this.activeAssignments.delete(worker.getState().id);
  }

  /**
   * Handle worker result.
   * Coordinator processes completion but doesn't execute.
   */
  private async handleWorkerResult(result: WorkerResult): Promise<void> {
    const { sessionResult, workerId } = result;

    // Record session in checkpoint tracker
    recordSession(this.checkpointTracker, sessionResult);

    // Record session completion for scale metrics
    const success = sessionResult.outcome === 'success' || sessionResult.outcome === 'code_complete';
    if (this.scaleManager) {
      this.scaleManager.recordSessionComplete(workerId, sessionResult.issueId, success);
    }

    // Handle outcome (Two-Stage Verification)
    if (sessionResult.outcome === 'success') {
      await updateIssueStatus(sessionResult.issueId, 'closed', this.cwd);
      this.harnessState.featuresCompleted++;
      this.harnessState.sessionsCompleted++;
      console.log(chalk.green(`✅ Task verified and completed: ${sessionResult.issueId}`));
    } else if (sessionResult.outcome === 'code_complete') {
      this.harnessState.sessionsCompleted++;
      console.log(chalk.cyan(`◑ Code complete (awaiting verification): ${sessionResult.issueId}`));
    } else if (sessionResult.outcome === 'failure') {
      this.harnessState.featuresFailed++;
      this.harnessState.sessionsCompleted++;
      console.log(chalk.red(`❌ Task failed: ${sessionResult.issueId}`));
      if (sessionResult.error) {
        console.log(chalk.red(`   Error: ${sessionResult.error}`));
      }
    } else if (sessionResult.outcome === 'partial') {
      this.harnessState.sessionsCompleted++;
      console.log(chalk.yellow(`◐ Task partially completed: ${sessionResult.issueId}`));
    } else if (sessionResult.outcome === 'context_overflow') {
      this.harnessState.sessionsCompleted++;
      console.log(chalk.yellow(`⚠ Context overflow: ${sessionResult.issueId}`));
    }

    // Display scale metrics periodically
    if (this.scaleManager && this.harnessState.sessionsCompleted % 5 === 0) {
      this.scaleManager.displayMetrics();
    }

    // Check checkpoint policy
    const checkpointCheck = shouldCreateCheckpoint(
      this.checkpointTracker,
      this.harnessState.checkpointPolicy,
      sessionResult,
      false
    );

    if (checkpointCheck.create) {
      await this.createCheckpoint(checkpointCheck.reason);
    }

    // Check confidence threshold
    if (shouldPauseForConfidence(
      this.checkpointTracker.sessionsResults,
      this.harnessState.checkpointPolicy.onConfidenceBelow
    )) {
      const confidence = calculateConfidence(this.checkpointTracker.sessionsResults);
      this.harnessState.status = 'paused';
      this.harnessState.pauseReason = `Confidence dropped to ${(confidence * 100).toFixed(0)}%`;
      console.log(`\n⏸ Harness paused: ${this.harnessState.pauseReason}`);

      if (this.checkpointTracker.sessionsResults.length > 0) {
        await this.createCheckpoint('Low confidence pause');
      }
    }
  }

  /**
   * Create a checkpoint.
   */
  private async createCheckpoint(reason: string): Promise<void> {
    console.log(`\n📊 Creating checkpoint: ${reason}`);
    this.lastCheckpoint = await generateCheckpoint(
      this.checkpointTracker,
      this.harnessState,
      reason,
      this.cwd
    );
    console.log('\n' + formatCheckpointDisplay(this.lastCheckpoint));
    resetTracker(this.checkpointTracker);
    this.harnessState.lastCheckpoint = this.lastCheckpoint.id;
  }

  /**
   * Wait for a worker to become available.
   */
  private async waitForWorker(): Promise<void> {
    // In current implementation, workers execute synchronously
    // This is a placeholder for future async worker execution
    await this.sleep(2000);
  }

  /**
   * Display success feedback.
   */
  private displaySuccessFeedback(startTime: Date): void {
    const duration = Date.now() - startTime.getTime();
    const successRate = this.harnessState.featuresTotal > 0
      ? ((this.harnessState.featuresCompleted / this.harnessState.featuresTotal) * 100).toFixed(0)
      : '100';

    console.log('');
    console.log(chalk.green.bold('╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.green.bold('║                                                                ║'));
    console.log(chalk.green.bold('║                    🎉 HARNESS COMPLETE 🎉                      ║'));
    console.log(chalk.green.bold('║                                                                ║'));
    console.log(chalk.green.bold('╚════════════════════════════════════════════════════════════════╝'));
    console.log('');
    console.log(chalk.green(`  ✅ All ${this.harnessState.featuresCompleted} tasks completed successfully!`));
    console.log('');
    console.log(chalk.white('  Summary:'));
    console.log(chalk.white(`    • Features completed: ${this.harnessState.featuresCompleted}/${this.harnessState.featuresTotal}`));
    console.log(chalk.white(`    • Sessions run: ${this.harnessState.sessionsCompleted}`));
    console.log(chalk.white(`    • Success rate: ${successRate}%`));
    console.log(chalk.white(`    • Duration: ${this.formatDuration(duration)}`));
    console.log(chalk.white(`    • Branch: ${this.harnessState.gitBranch}`));
    console.log('');
    console.log(chalk.cyan('  Next steps:'));
    console.log(chalk.cyan('    1. Review changes: git diff main'));
    console.log(chalk.cyan('    2. Run tests: pnpm test'));
    console.log(chalk.cyan('    3. Merge to main: git checkout main && git merge ' + this.harnessState.gitBranch));
    console.log('');
  }

  /**
   * Format duration in human-readable form.
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get coordinator metrics.
   */
  getMetrics(): {
    harnessId: string;
    status: string;
    workers: ReturnType<WorkerPool['getMetrics']>;
    featuresCompleted: number;
    featuresTotal: number;
    sessionsCompleted: number;
    convoy?: string;
  } {
    return {
      harnessId: this.harnessState.id,
      status: this.harnessState.status,
      workers: this.workerPool.getMetrics(),
      featuresCompleted: this.harnessState.featuresCompleted,
      featuresTotal: this.harnessState.featuresTotal,
      sessionsCompleted: this.harnessState.sessionsCompleted,
      convoy: this.convoyName || undefined,
    };
  }

  /**
   * Get convoy progress (if convoy mode enabled).
   */
  async getConvoyProgress() {
    if (!this.convoySystem || !this.convoyName) {
      return null;
    }
    return this.convoySystem.getProgress(this.convoyName, this.cwd);
  }

  /**
   * Get observer for external monitoring.
   */
  getObserver(): Observer {
    return this.observer;
  }
}
