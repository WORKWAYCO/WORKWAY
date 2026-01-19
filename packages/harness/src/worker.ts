/**
 * @workwayco/harness - Worker (Polecat)
 *
 * GAS TOWN Pattern: Worker executes work in isolation.
 * Mayor delegates, Polecat executes, Witness observes.
 *
 * Key principles:
 * - Claims work from queue (one issue at a time)
 * - Executes in isolated session
 * - Reports completion to coordinator
 * - Never coordinates other workers
 *
 * Claude Code 2.1.0+: Supports two execution modes:
 * - CLI spawning (traditional - full Claude Code CLI process)
 * - Forked skills (lightweight - forked sub-agent contexts)
 */

import type {
  BeadsIssue,
  PrimingContext,
  SessionResult,
  HarnessMode,
  HarnessModeConfig,
} from './types.js';
import {
  runSession,
  getRecentCommits,
  discoverDryContext,
} from './session.js';
import { DEFAULT_MODE_CONFIGS } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Worker Execution Modes (Claude Code 2.1.0+)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Worker execution mode.
 *
 * - cli: Spawn full Claude Code CLI process (traditional, heavy-weight)
 * - forked-skill: Use Claude Code 2.1.0+ forked sub-agent contexts (lightweight)
 */
export type WorkerExecutionMode = 'cli' | 'forked-skill';

/**
 * Worker configuration.
 */
export interface WorkerConfig {
  /** Execution mode */
  executionMode: WorkerExecutionMode;
  /** Path to polecat-worker.md skill (for forked-skill mode) */
  skillPath?: string;
  /** Harness mode */
  mode?: HarnessMode;
  /** Mode configuration */
  modeConfig?: HarnessModeConfig;
}

/**
 * Default worker configuration.
 */
export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  executionMode: 'cli', // Default to CLI for backward compatibility
  skillPath: '.claude/skills/polecat-worker.md',
};

/**
 * Execute work using forked skill-based worker.
 * Lightweight execution via Claude Code 2.1.0+ skill system.
 *
 * This invokes the polecat-worker.md skill which spawns a forked
 * sub-agent context with bounded attention.
 */
async function executeWithForkedSkill(
  issue: BeadsIssue,
  context: PrimingContext,
  config: WorkerConfig,
  cwd: string,
  dryRun: boolean
): Promise<SessionResult> {
  if (dryRun) {
    return {
      issueId: issue.id,
      outcome: 'success',
      summary: '[DRY RUN] Would execute via forked skill',
      gitCommit: null,
      contextUsed: 0,
      durationMs: 0,
      error: null,
    };
  }

  // TODO: Implement skill invocation
  // This will use the Skill tool to invoke polecat-worker.md
  // with the issue context. For now, fall back to CLI.
  console.log(`   [Worker] Forked skill mode not yet implemented, falling back to CLI`);
  return runSession(issue, context, { cwd, dryRun, mode: config.mode, modeConfig: config.modeConfig });
}

/**
 * Execute work assignment.
 * Routes to appropriate execution mode.
 */
async function executeWork(
  issue: BeadsIssue,
  context: PrimingContext,
  config: WorkerConfig,
  cwd: string,
  dryRun: boolean
): Promise<SessionResult> {
  if (config.executionMode === 'forked-skill') {
    return executeWithForkedSkill(issue, context, config, cwd, dryRun);
  } else {
    return runSession(issue, context, { cwd, dryRun, mode: config.mode, modeConfig: config.modeConfig });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker State
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkerState {
  /** Unique worker ID */
  id: string;
  /** Current status */
  status: 'idle' | 'working' | 'blocked' | 'failed';
  /** Issue currently being worked on */
  currentIssue: BeadsIssue | null;
  /** Session start time */
  sessionStartedAt: string | null;
  /** Sessions completed by this worker */
  sessionsCompleted: number;
  /** Last error encountered */
  lastError: string | null;
}

export interface WorkerResult {
  /** Worker ID */
  workerId: string;
  /** Issue worked on */
  issueId: string;
  /** Session result */
  sessionResult: SessionResult;
  /** Worker state after completion */
  state: WorkerState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Worker (Polecat Pattern)
 *
 * Executes work in isolation. Does not coordinate with other workers.
 * Reports completion to coordinator.
 *
 * Zuhandenheit: The worker recedes - you see progress, not execution details.
 */
export class Worker {
  private state: WorkerState;
  private cwd: string;
  private dryRun: boolean;
  private config: WorkerConfig;

  constructor(id: string, cwd: string, dryRun = false, config?: Partial<WorkerConfig>) {
    this.state = {
      id,
      status: 'idle',
      currentIssue: null,
      sessionStartedAt: null,
      sessionsCompleted: 0,
      lastError: null,
    };
    this.cwd = cwd;
    this.dryRun = dryRun;
    this.config = {
      ...DEFAULT_WORKER_CONFIG,
      ...config,
      modeConfig: config?.modeConfig || (config?.mode ? DEFAULT_MODE_CONFIGS[config.mode] : undefined),
    };
  }

  /**
   * Get current worker state.
   */
  getState(): WorkerState {
    return { ...this.state };
  }

  /**
   * Check if worker is available for work.
   */
  isAvailable(): boolean {
    return this.state.status === 'idle';
  }

  /**
   * Claim work from the queue.
   * Returns true if work was claimed successfully.
   */
  async claimWork(issue: BeadsIssue): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    this.state.status = 'working';
    this.state.currentIssue = issue;
    this.state.sessionStartedAt = new Date().toISOString();
    this.state.lastError = null;

    return true;
  }

  /**
   * Execute claimed work.
   * Returns session result when complete.
   */
  async execute(
    primingContext: PrimingContext
  ): Promise<WorkerResult> {
    if (this.state.status !== 'working' || !this.state.currentIssue) {
      throw new Error(`Worker ${this.state.id} not in working state`);
    }

    const issue = this.state.currentIssue;

    try {
      // Discover DRY context for this issue
      const dryContext = await discoverDryContext(issue.title, this.cwd);

      // Enhance priming context with DRY findings
      const enhancedContext: PrimingContext = {
        ...primingContext,
        existingPatterns: [
          ...(primingContext.existingPatterns || []),
          ...dryContext.existingPatterns,
        ],
        relevantFiles: [
          ...(primingContext.relevantFiles || []),
          ...dryContext.relevantFiles,
        ],
      };

      // Execute work using configured execution mode
      const sessionResult = await executeWork(
        issue,
        enhancedContext,
        this.config,
        this.cwd,
        this.dryRun
      );

      // Update worker state
      this.state.sessionsCompleted++;
      this.state.status = 'idle';
      this.state.currentIssue = null;
      this.state.sessionStartedAt = null;

      return {
        workerId: this.state.id,
        issueId: issue.id,
        sessionResult,
        state: this.getState(),
      };
    } catch (error) {
      // Handle execution failure
      this.state.status = 'failed';
      this.state.lastError = error instanceof Error ? error.message : 'Unknown error';

      throw error;
    }
  }

  /**
   * Reset worker to idle state.
   * Used for recovery after failures.
   */
  reset(): void {
    this.state.status = 'idle';
    this.state.currentIssue = null;
    this.state.sessionStartedAt = null;
  }

  /**
   * Get worker metrics.
   */
  getMetrics(): {
    id: string;
    sessionsCompleted: number;
    status: string;
    uptime: number | null;
  } {
    const uptime = this.state.sessionStartedAt
      ? Date.now() - new Date(this.state.sessionStartedAt).getTime()
      : null;

    return {
      id: this.state.id,
      sessionsCompleted: this.state.sessionsCompleted,
      status: this.state.status,
      uptime,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker Pool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Worker Pool
 *
 * Manages multiple workers for parallel execution.
 * Coordinator uses this to distribute work.
 */
export class WorkerPool {
  private workers: Map<string, Worker>;
  private cwd: string;
  private dryRun: boolean;
  private config: Partial<WorkerConfig>;

  constructor(cwd: string, dryRun = false, config?: Partial<WorkerConfig>) {
    this.workers = new Map();
    this.cwd = cwd;
    this.dryRun = dryRun;
    this.config = config || {};
  }

  /**
   * Add a worker to the pool.
   */
  addWorker(id: string, workerConfig?: Partial<WorkerConfig>): Worker {
    const mergedConfig = { ...this.config, ...workerConfig };
    const worker = new Worker(id, this.cwd, this.dryRun, mergedConfig);
    this.workers.set(id, worker);
    return worker;
  }

  /**
   * Get worker by ID.
   */
  getWorker(id: string): Worker | undefined {
    return this.workers.get(id);
  }

  /**
   * Get all workers.
   */
  getAllWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get next available worker.
   */
  getAvailableWorker(): Worker | null {
    for (const worker of this.workers.values()) {
      if (worker.isAvailable()) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Get pool metrics.
   */
  getMetrics(): {
    totalWorkers: number;
    availableWorkers: number;
    workingWorkers: number;
    totalSessionsCompleted: number;
  } {
    let available = 0;
    let working = 0;
    let totalSessions = 0;

    for (const worker of this.workers.values()) {
      const state = worker.getState();
      if (state.status === 'idle') available++;
      if (state.status === 'working') working++;
      totalSessions += state.sessionsCompleted;
    }

    return {
      totalWorkers: this.workers.size,
      availableWorkers: available,
      workingWorkers: working,
      totalSessionsCompleted: totalSessions,
    };
  }
}
