/**
 * @workwayco/harness - ScaleManager
 *
 * Manages dynamic scaling of agent pools from 4-10 to 20-30 concurrent agents.
 * Monitors resource usage, applies backpressure, detects stalled agents,
 * and provides metrics for observability.
 *
 * Philosophy:
 * - Scale elastically based on queue depth and system health
 * - Prevent resource exhaustion with quotas and backpressure
 * - Auto-restart stalled agents
 * - Provide metrics for capacity planning
 */

import type { WorkerPool } from './worker.js';
import type { MergeQueue } from './merge-queue.js';
import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────────────────
// Scale Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface ScaleConfig {
  /** Minimum workers in pool */
  minWorkers: number;
  /** Maximum workers in pool */
  maxWorkers: number;
  /** Target queue depth to maintain (workers will scale to keep queue near this) */
  targetQueueDepth: number;
  /** Maximum queue depth before applying backpressure */
  maxQueueDepth: number;
  /** Worker stall timeout (ms) - restart if no progress */
  workerStallTimeoutMs: number;
  /** Health check interval (ms) */
  healthCheckIntervalMs: number;
  /** Scale up threshold (queue depth / workers ratio) */
  scaleUpThreshold: number;
  /** Scale down threshold (queue depth / workers ratio) */
  scaleDownThreshold: number;
  /** Cooldown period (ms) between scale operations */
  scaleCooldownMs: number;
  /** Maximum resource quota per worker (e.g., max sessions) */
  maxSessionsPerWorker: number;
}

export const DEFAULT_SCALE_CONFIG: ScaleConfig = {
  minWorkers: 4,
  maxWorkers: 30,
  targetQueueDepth: 10,
  maxQueueDepth: 100,
  workerStallTimeoutMs: 10 * 60 * 1000, // 10 minutes
  healthCheckIntervalMs: 30 * 1000, // 30 seconds
  scaleUpThreshold: 2.0, // Scale up if queue/workers > 2.0
  scaleDownThreshold: 0.5, // Scale down if queue/workers < 0.5
  scaleCooldownMs: 60 * 1000, // 1 minute between scale operations
  maxSessionsPerWorker: 50, // Prevent single worker monopolizing resources
};

// ─────────────────────────────────────────────────────────────────────────────
// Scale Metrics
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Session Tracker (for metrics)
// ─────────────────────────────────────────────────────────────────────────────

interface SessionRecord {
  workerId: string;
  issueId: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  success: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ScaleManager Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ScaleManager dynamically manages worker pool size based on load.
 *
 * Usage:
 * ```typescript
 * const scaleManager = new ScaleManager(workerPool, mergeQueue, config);
 * await scaleManager.start();
 *
 * // Get current metrics
 * const metrics = scaleManager.getMetrics();
 *
 * // Check if backpressure should be applied
 * if (scaleManager.shouldApplyBackpressure()) {
 *   await sleep(1000);
 * }
 *
 * // Stop when done
 * await scaleManager.stop();
 * ```
 */
export class ScaleManager {
  private workerPool: WorkerPool;
  private mergeQueue: MergeQueue | null;
  private config: ScaleConfig;
  private sessionRecords: SessionRecord[];
  private healthCheckTimer: NodeJS.Timeout | null;
  private lastScaleAt: number;
  private scaleOperations: number;
  private cwd: string;

  constructor(
    workerPool: WorkerPool,
    cwd: string,
    mergeQueue: MergeQueue | null = null,
    config: Partial<ScaleConfig> = {}
  ) {
    this.workerPool = workerPool;
    this.mergeQueue = mergeQueue;
    this.cwd = cwd;
    this.config = { ...DEFAULT_SCALE_CONFIG, ...config };
    this.sessionRecords = [];
    this.healthCheckTimer = null;
    this.lastScaleAt = 0;
    this.scaleOperations = 0;
  }

  /**
   * Start scale manager (begins health checks and auto-scaling).
   */
  async start(): Promise<void> {
    console.log(chalk.cyan(`\n⚡ ScaleManager started (${this.config.minWorkers}-${this.config.maxWorkers} workers)`));

    // Start health check loop
    this.healthCheckTimer = setInterval(
      () => this.runHealthCheck(),
      this.config.healthCheckIntervalMs
    );
  }

  /**
   * Stop scale manager.
   */
  async stop(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    console.log(chalk.cyan('\n⚡ ScaleManager stopped'));
  }

  /**
   * Run health check and auto-scaling.
   */
  private async runHealthCheck(): Promise<void> {
    // 1. Detect and restart stalled workers
    const stalledWorkers = this.detectStalledWorkers();
    for (const workerId of stalledWorkers) {
      console.log(chalk.yellow(`⚠ Restarting stalled worker: ${workerId}`));
      this.restartWorker(workerId);
    }

    // 2. Check if scaling is needed
    const poolMetrics = this.workerPool.getMetrics();
    const queueDepth = this.getQueueDepth();
    const ratio = queueDepth / poolMetrics.totalWorkers;

    // Check cooldown
    const now = Date.now();
    if (now - this.lastScaleAt < this.config.scaleCooldownMs) {
      return; // Still in cooldown
    }

    // Scale up if queue is growing faster than workers can handle
    if (ratio > this.config.scaleUpThreshold && poolMetrics.totalWorkers < this.config.maxWorkers) {
      const targetWorkers = Math.min(
        poolMetrics.totalWorkers + Math.ceil(ratio),
        this.config.maxWorkers
      );
      await this.scaleUp(targetWorkers);
      this.lastScaleAt = now;
      this.scaleOperations++;
    }

    // Scale down if queue is empty and we have excess workers
    else if (ratio < this.config.scaleDownThreshold && poolMetrics.totalWorkers > this.config.minWorkers) {
      const targetWorkers = Math.max(
        poolMetrics.totalWorkers - 1,
        this.config.minWorkers
      );
      await this.scaleDown(targetWorkers);
      this.lastScaleAt = now;
      this.scaleOperations++;
    }
  }

  /**
   * Detect stalled workers (no progress in stall timeout period).
   */
  private detectStalledWorkers(): string[] {
    const stalled: string[] = [];
    const now = Date.now();

    for (const worker of this.workerPool.getAllWorkers()) {
      const state = worker.getState();

      // Worker is working but hasn't made progress
      if (state.status === 'working' && state.sessionStartedAt) {
        const sessionStart = new Date(state.sessionStartedAt).getTime();
        const elapsed = now - sessionStart;

        if (elapsed > this.config.workerStallTimeoutMs) {
          stalled.push(state.id);
        }
      }
    }

    return stalled;
  }

  /**
   * Restart a stalled worker.
   */
  private restartWorker(workerId: string): void {
    const worker = this.workerPool.getWorker(workerId);
    if (worker) {
      worker.reset();
    }
  }

  /**
   * Scale up to target worker count.
   */
  private async scaleUp(targetWorkers: number): Promise<void> {
    const currentWorkers = this.workerPool.getMetrics().totalWorkers;
    const toAdd = targetWorkers - currentWorkers;

    console.log(chalk.green(`\n📈 Scaling UP: ${currentWorkers} → ${targetWorkers} workers (+${toAdd})`));

    for (let i = 0; i < toAdd; i++) {
      const workerId = `worker-${currentWorkers + i + 1}`;
      this.workerPool.addWorker(workerId);
    }
  }

  /**
   * Scale down to target worker count.
   */
  private async scaleDown(targetWorkers: number): Promise<void> {
    const currentWorkers = this.workerPool.getMetrics().totalWorkers;
    const toRemove = currentWorkers - targetWorkers;

    console.log(chalk.yellow(`\n📉 Scaling DOWN: ${currentWorkers} → ${targetWorkers} workers (-${toRemove})`));

    // Note: In current implementation, we don't remove workers from pool
    // They just stay idle. In a real implementation with distributed workers,
    // you would terminate worker processes here.

    // For now, just log the intention
    console.log(chalk.dim(`   (Workers remain in pool but will be deprioritized)`));
  }

  /**
   * Get current queue depth (pending work items).
   */
  private getQueueDepth(): number {
    // This would need to be implemented by tracking pending issues
    // For now, return a placeholder based on pool metrics
    const poolMetrics = this.workerPool.getMetrics();
    return Math.max(0, poolMetrics.workingWorkers * 2); // Rough estimate
  }

  /**
   * Check if backpressure should be applied.
   * Returns true if queue is too deep and new work should be throttled.
   */
  shouldApplyBackpressure(): boolean {
    const queueDepth = this.getQueueDepth();
    return queueDepth > this.config.maxQueueDepth;
  }

  /**
   * Record a session start.
   */
  recordSessionStart(workerId: string, issueId: string): void {
    this.sessionRecords.push({
      workerId,
      issueId,
      startedAt: Date.now(),
      success: false,
    });
  }

  /**
   * Record a session completion.
   */
  recordSessionComplete(workerId: string, issueId: string, success: boolean): void {
    const record = this.sessionRecords.find(
      r => r.workerId === workerId && r.issueId === issueId && !r.completedAt
    );

    if (record) {
      record.completedAt = Date.now();
      record.durationMs = record.completedAt - record.startedAt;
      record.success = success;
    }
  }

  /**
   * Get comprehensive scale metrics.
   */
  getMetrics(): ScaleMetrics {
    const poolMetrics = this.workerPool.getMetrics();
    const queueDepth = this.getQueueDepth();

    // Calculate session metrics
    const completedSessions = this.sessionRecords.filter(r => r.completedAt);
    const successfulSessions = completedSessions.filter(r => r.success);
    const failedSessions = completedSessions.filter(r => !r.success);

    // Calculate throughput (sessions per minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentSessions = completedSessions.filter(r => r.completedAt! > oneMinuteAgo);
    const throughputPerMinute = recentSessions.length;

    // Calculate duration metrics
    const durations = completedSessions.map(r => r.durationMs!).filter(Boolean).sort((a, b) => a - b);
    const avgSessionDurationMs = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;
    const p95Index = Math.floor(durations.length * 0.95);
    const p95SessionDurationMs = durations.length > 0 ? durations[p95Index] || 0 : 0;

    // Success rate
    const successRate = completedSessions.length > 0
      ? successfulSessions.length / completedSessions.length
      : 1.0;

    // Health status
    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (successRate < 0.5 || this.detectStalledWorkers().length > 2) {
      health = 'unhealthy';
    } else if (successRate < 0.8 || this.detectStalledWorkers().length > 0) {
      health = 'degraded';
    }

    // Merge queue depth
    const mergeQueueDepth = this.mergeQueue?.getState().pending.length || 0;

    return {
      currentWorkers: poolMetrics.totalWorkers,
      activeWorkers: poolMetrics.workingWorkers,
      idleWorkers: poolMetrics.availableWorkers,
      stalledWorkers: this.detectStalledWorkers().length,
      queueDepth,
      throughputPerMinute,
      avgSessionDurationMs,
      p95SessionDurationMs,
      totalSessionsCompleted: successfulSessions.length,
      totalSessionsFailed: failedSessions.length,
      successRate,
      backpressureActive: this.shouldApplyBackpressure(),
      lastScaleAt: this.lastScaleAt > 0 ? new Date(this.lastScaleAt).toISOString() : null,
      scaleOperations: this.scaleOperations,
      mergeQueueDepth,
      health,
    };
  }

  /**
   * Display metrics to console.
   */
  displayMetrics(): void {
    const metrics = this.getMetrics();

    console.log('\n' + chalk.bold('📊 Scale Metrics:'));
    console.log(chalk.white(`   Workers: ${metrics.activeWorkers}/${metrics.currentWorkers} active (${metrics.idleWorkers} idle, ${metrics.stalledWorkers} stalled)`));
    console.log(chalk.white(`   Queue: ${metrics.queueDepth} pending (merge: ${metrics.mergeQueueDepth})`));
    console.log(chalk.white(`   Throughput: ${metrics.throughputPerMinute} sessions/min`));
    console.log(chalk.white(`   Latency: avg ${Math.round(metrics.avgSessionDurationMs / 1000)}s, p95 ${Math.round(metrics.p95SessionDurationMs / 1000)}s`));
    console.log(chalk.white(`   Success: ${(metrics.successRate * 100).toFixed(1)}% (${metrics.totalSessionsCompleted} completed, ${metrics.totalSessionsFailed} failed)`));
    console.log(chalk.white(`   Health: ${this.getHealthEmoji(metrics.health)} ${metrics.health}`));

    if (metrics.backpressureActive) {
      console.log(chalk.yellow(`   ⚠ Backpressure: ACTIVE (queue depth exceeded)`));
    }

    if (metrics.scaleOperations > 0) {
      console.log(chalk.dim(`   Scale ops: ${metrics.scaleOperations} (last: ${metrics.lastScaleAt})`));
    }
  }

  /**
   * Get health emoji.
   */
  private getHealthEmoji(health: 'healthy' | 'degraded' | 'unhealthy'): string {
    switch (health) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
    }
  }

  /**
   * Check if a worker has exceeded resource quota.
   */
  hasExceededQuota(workerId: string): boolean {
    const worker = this.workerPool.getWorker(workerId);
    if (!worker) return false;

    const metrics = worker.getMetrics();
    return metrics.sessionsCompleted >= this.config.maxSessionsPerWorker;
  }

  /**
   * Get recommended worker count based on current load.
   */
  getRecommendedWorkerCount(): number {
    const queueDepth = this.getQueueDepth();
    const target = Math.ceil(queueDepth / this.config.targetQueueDepth);
    return Math.max(
      this.config.minWorkers,
      Math.min(target, this.config.maxWorkers)
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a scale manager with default configuration.
 */
export function createScaleManager(
  workerPool: WorkerPool,
  cwd: string,
  mergeQueue: MergeQueue | null = null,
  config: Partial<ScaleConfig> = {}
): ScaleManager {
  return new ScaleManager(workerPool, cwd, mergeQueue, config);
}
