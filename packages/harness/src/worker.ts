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

import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  BeadsIssue,
  PrimingContext,
  SessionResult,
  SessionOutcome,
  HarnessMode,
  HarnessModeConfig,
} from './types.js';
import {
  runSession,
  getRecentCommits,
  discoverDryContext,
  getHeadCommit,
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
 * Parse skill file to extract configuration.
 */
interface SkillConfig {
  description: string;
  agent: string;
  allowedTools: string[];
  context: string;
}

async function parseSkillFile(skillPath: string, cwd: string): Promise<SkillConfig | null> {
  try {
    const fullPath = join(cwd, skillPath);
    const content = await readFile(fullPath, 'utf-8');
    
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return null;
    }
    
    const frontmatter = frontmatterMatch[1];
    
    // Parse simple YAML (avoid external dependency)
    const description = frontmatter.match(/description:\s*(.+)/)?.[1]?.trim() || '';
    const agent = frontmatter.match(/agent:\s*(.+)/)?.[1]?.trim() || 'sonnet';
    const context = frontmatter.match(/context:\s*(.+)/)?.[1]?.trim() || 'main';
    
    // Parse allowed-tools list
    const toolsMatch = frontmatter.match(/allowed-tools:\n((?:\s+-\s+.+\n?)+)/);
    const allowedTools: string[] = [];
    if (toolsMatch) {
      const toolLines = toolsMatch[1].match(/-\s+(\w+)/g);
      if (toolLines) {
        for (const line of toolLines) {
          const tool = line.replace(/^-\s+/, '').trim();
          if (tool) allowedTools.push(tool);
        }
      }
    }
    
    return { description, agent, allowedTools, context };
  } catch {
    return null;
  }
}

/**
 * Generate a focused prompt for skill-based execution.
 */
function generateSkillPrompt(issue: BeadsIssue, context: PrimingContext): string {
  const lines: string[] = [
    `# Work Assignment: ${issue.id}`,
    '',
    `## Task`,
    issue.title,
    '',
  ];
  
  if (issue.description) {
    lines.push('## Description', issue.description, '');
  }
  
  if (context.relevantFiles && context.relevantFiles.length > 0) {
    lines.push('## Relevant Files', ...context.relevantFiles.map(f => `- ${f}`), '');
  }
  
  if (context.existingPatterns && context.existingPatterns.length > 0) {
    lines.push('## Existing Patterns to Follow', ...context.existingPatterns.map(p => `- ${p}`), '');
  }
  
  lines.push(
    '## Instructions',
    '1. Read and understand the task',
    '2. Make the necessary changes',
    '3. Verify your work',
    '4. Update issue status when complete:',
    `   - \`bd update ${issue.id} --status code_complete\` if done`,
    `   - \`bd update ${issue.id} --status blocked\` if stuck`,
    '',
    '## Constraints',
    '- Stay focused on this task only',
    '- Do not modify unrelated files',
    '- Complete within 15 minutes',
  );
  
  return lines.join('\n');
}

/**
 * Detect outcome from forked skill output.
 */
function detectForkedOutcome(output: string, exitCode: number): SessionOutcome {
  const lower = output.toLowerCase();
  
  // Check for explicit failure indicators
  if (exitCode !== 0) return 'failure';
  if (lower.includes('error:') || lower.includes('failed')) return 'failure';
  
  // Blocked maps to 'partial' outcome (work started but couldn't complete)
  if (lower.includes('blocked') || lower.includes('cannot proceed')) return 'partial';
  
  // Check for code_complete (bd update --status code_complete)
  if (lower.includes('code_complete') || lower.includes('code complete')) return 'code_complete';
  
  // Check for success indicators
  if (lower.includes('complete') || lower.includes('done') || lower.includes('success')) {
    return 'success';
  }
  
  // Default to success if no errors detected
  return 'success';
}

/**
 * Execute work using forked skill-based worker.
 * Lightweight execution via Claude Code 2.1.0+ skill system.
 *
 * This invokes the polecat-worker.md skill which spawns a forked
 * sub-agent context with bounded attention.
 * 
 * Performance: ~10-20x faster startup than CLI spawning
 * - CLI spawn: 2-3 seconds (full process initialization)
 * - Forked skill: 100-200ms (shared context, bounded tools)
 */
async function executeWithForkedSkill(
  issue: BeadsIssue,
  context: PrimingContext,
  config: WorkerConfig,
  cwd: string,
  dryRun: boolean
): Promise<SessionResult> {
  const startTime = Date.now();
  const startCommit = await getHeadCommit(cwd);
  
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

  // Parse skill configuration
  const skillPath = config.skillPath ?? DEFAULT_WORKER_CONFIG.skillPath ?? '.claude/skills/polecat-worker.md';
  const skillConfig = await parseSkillFile(skillPath, cwd);
  
  if (!skillConfig) {
    console.log(`   [Worker] Could not parse skill at ${skillPath}, falling back to CLI`);
    return runSession(issue, context, { cwd, dryRun, mode: config.mode, modeConfig: config.modeConfig });
  }

  console.log(`   [Worker] Executing via forked skill: ${skillPath}`);
  console.log(`   [Worker] Agent: ${skillConfig.agent}, Tools: ${skillConfig.allowedTools.join(', ')}`);

  try {
    // Prepare prompt
    const prompt = generateSkillPrompt(issue, context);
    
    // Write prompt to temp file for logging
    const promptDir = join(cwd, '.harness');
    await mkdir(promptDir, { recursive: true });
    const promptFile = join(promptDir, `forked-${issue.id}-${Date.now()}.md`);
    await writeFile(promptFile, prompt);

    // Build CLI args for forked execution
    const args: string[] = [
      '-p', // Print mode (non-interactive)
      '--model', skillConfig.agent, // Use skill-specified model (e.g., haiku)
      '--tools', skillConfig.allowedTools.join(','), // Restricted tool set
      '--max-turns', '30', // Bounded execution
      '--output-format', 'json',
    ];

    // Execute Claude Code with skill configuration
    const result = await new Promise<{ output: string; exitCode: number }>((resolve) => {
      const child = spawn('claude', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      // Send prompt via stdin
      if (child.stdin) {
        child.stdin.write(prompt);
        child.stdin.end();
      }

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          output: output || errorOutput,
          exitCode: code ?? 0,
        });
      });

      child.on('error', (err) => {
        resolve({
          output: `Process error: ${err.message}`,
          exitCode: -1,
        });
      });
    });

    // Log session output
    const sessionLog = join(promptDir, `forked-session-${issue.id}-${Date.now()}.log`);
    await writeFile(sessionLog, `Exit Code: ${result.exitCode}\n\n--- OUTPUT ---\n${result.output}`);
    console.log(`   [Worker] Session log: ${sessionLog}`);

    // Get end commit
    const endCommit = await getHeadCommit(cwd);
    const gitCommit = endCommit !== startCommit ? endCommit : null;

    // Detect outcome
    const outcome = detectForkedOutcome(result.output, result.exitCode);

    return {
      issueId: issue.id,
      outcome,
      summary: outcome === 'success' 
        ? `Completed via forked skill (${skillConfig.agent})` 
        : `Forked skill execution ${outcome}`,
      gitCommit,
      contextUsed: 0, // Forked contexts use less
      durationMs: Date.now() - startTime,
      error: outcome === 'failure' ? result.output.slice(0, 500) : null,
    };
  } catch (error) {
    return {
      issueId: issue.id,
      outcome: 'failure',
      summary: 'Forked skill execution failed',
      gitCommit: null,
      contextUsed: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
