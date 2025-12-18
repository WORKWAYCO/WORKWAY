#!/usr/bin/env node
/**
 * @workwayco/beads
 *
 * CLI for viewing issues in robot-friendly formats.
 * bv - Beads Viewer (queries)
 *
 * Commands:
 *   bv                     Default view (same as bd list)
 *   bv --robot-priority    AI-optimized priority output (JSON)
 *   bv --robot-insights    Graph analysis and bottlenecks (JSON)
 *   bv --robot-plan        Suggested execution sequence (JSON)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { BeadsStore } from './store.js';
import type { Issue, Priority, RobotPriorityOutput, RobotInsightsOutput } from './types.js';

const program = new Command();
const store = new BeadsStore();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function priorityColor(priority: Priority): string {
  const colors: Record<Priority, (s: string) => string> = {
    0: chalk.red.bold,
    1: chalk.red,
    2: chalk.yellow,
    3: chalk.blue,
    4: chalk.gray,
  };
  return colors[priority](`P${priority}`);
}

function statusColor(status: string): string {
  const colors: Record<string, (s: string) => string> = {
    open: chalk.green,
    in_progress: chalk.yellow,
    closed: chalk.gray,
  };
  return (colors[status] || chalk.white)(status);
}

function formatIssue(issue: Issue): string {
  const p = priorityColor(issue.priority);
  const s = statusColor(issue.status);
  return `${chalk.cyan(issue.id)} ${p} ${s} ${issue.title}`;
}

async function ensureInitialized(): Promise<void> {
  const initialized = await store.isInitialized();
  if (!initialized) {
    console.error(chalk.red('Error: .beads not initialized. Run `bd init` first.'));
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Robot Mode Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate priority score for an issue.
 * Higher score = more important.
 */
async function calculatePriorityScore(
  issue: Issue,
  deps: Map<string, string[]>,
  dependents: Map<string, string[]>
): Promise<number> {
  let score = 0;

  // Priority weight (P0=100, P1=80, P2=60, P3=40, P4=20)
  score += (4 - issue.priority) * 20 + 20;

  // Blocking weight (each blocked issue adds 10 points)
  const blocking = dependents.get(issue.id) || [];
  score += blocking.length * 10;

  // Age weight (older issues get slight priority boost)
  const ageMs = Date.now() - new Date(issue.created_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  score += Math.min(ageDays, 30); // Cap at 30 days bonus

  // In-progress issues get a boost to encourage completion
  if (issue.status === 'in_progress') {
    score += 15;
  }

  return score;
}

/**
 * Generate robot-priority output.
 */
async function robotPriority(): Promise<RobotPriorityOutput> {
  const issues = await store.getOpenIssues();
  const allDeps = await store.getAllDependencies();

  // Build dependency maps
  const deps = new Map<string, string[]>(); // issue -> what it depends on
  const dependents = new Map<string, string[]>(); // issue -> what depends on it

  for (const dep of allDeps) {
    if (dep.type === 'blocks') {
      // dep.issue_id depends on dep.depends_on_id
      const existing = deps.get(dep.issue_id) || [];
      deps.set(dep.issue_id, [...existing, dep.depends_on_id]);

      // dep.depends_on_id blocks dep.issue_id
      const blocking = dependents.get(dep.depends_on_id) || [];
      dependents.set(dep.depends_on_id, [...blocking, dep.issue_id]);
    }
  }

  // Calculate scores
  const scored = await Promise.all(
    issues.map(async (issue) => {
      const score = await calculatePriorityScore(issue, deps, dependents);
      const blockedBy = (deps.get(issue.id) || []).filter((depId) => {
        const depIssue = issues.find((i) => i.id === depId);
        return depIssue && depIssue.status !== 'closed';
      });
      const blocking = dependents.get(issue.id) || [];

      return {
        id: issue.id,
        title: issue.title,
        priority: issue.priority,
        score,
        blockedBy,
        blocking,
      };
    })
  );

  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);

  // Calculate stats
  const blocked = await store.getBlockedIssues();

  return {
    issues: scored,
    stats: {
      total: issues.length,
      open: issues.filter((i) => i.status === 'open').length,
      in_progress: issues.filter((i) => i.status === 'in_progress').length,
      blocked: blocked.length,
    },
  };
}

/**
 * Generate robot-insights output.
 */
async function robotInsights(): Promise<RobotInsightsOutput> {
  const issues = await store.getOpenIssues();
  const allIssues = await store.getAllIssues();
  const allDeps = await store.getAllDependencies();

  // Build connectivity map
  const connections = new Map<string, number>();
  const blockingCounts = new Map<string, number>();

  for (const dep of allDeps) {
    // Count total connections
    connections.set(dep.issue_id, (connections.get(dep.issue_id) || 0) + 1);
    connections.set(dep.depends_on_id, (connections.get(dep.depends_on_id) || 0) + 1);

    // Count blocking (only for open blockers)
    if (dep.type === 'blocks') {
      const blocker = issues.find((i) => i.id === dep.depends_on_id);
      if (blocker && blocker.status !== 'closed') {
        blockingCounts.set(dep.depends_on_id, (blockingCounts.get(dep.depends_on_id) || 0) + 1);
      }
    }
  }

  // Find bottlenecks (issues blocking the most work)
  const bottlenecks = issues
    .filter((i) => blockingCounts.has(i.id))
    .map((i) => ({
      id: i.id,
      title: i.title,
      blockingCount: blockingCounts.get(i.id) || 0,
    }))
    .sort((a, b) => b.blockingCount - a.blockingCount)
    .slice(0, 5);

  // Find keystones (most connected issues)
  const keystones = issues
    .filter((i) => connections.has(i.id))
    .map((i) => ({
      id: i.id,
      title: i.title,
      connectionCount: connections.get(i.id) || 0,
    }))
    .sort((a, b) => b.connectionCount - a.connectionCount)
    .slice(0, 5);

  // Calculate health metrics
  const blocked = await store.getBlockedIssues();
  const blockageRatio = issues.length > 0 ? blocked.length / issues.length : 0;

  const ages = issues.map((i) => {
    const ageMs = Date.now() - new Date(i.created_at).getTime();
    return ageMs / (1000 * 60 * 60 * 24);
  });
  const averageAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

  const stalestIssue = issues.length > 0
    ? issues.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0]?.id || null
    : null;

  return {
    bottlenecks,
    keystones,
    health: {
      blockageRatio,
      averageAge,
      stalestIssue,
    },
  };
}

/**
 * Generate robot-plan output.
 * Suggests an execution sequence based on dependencies and priority.
 */
async function robotPlan(): Promise<{ plan: Array<{ step: number; id: string; title: string; reason: string }> }> {
  const priorityOutput = await robotPriority();

  // Filter to ready issues (not blocked)
  const ready = priorityOutput.issues.filter((i) => i.blockedBy.length === 0);

  return {
    plan: ready.slice(0, 10).map((issue, index) => ({
      step: index + 1,
      id: issue.id,
      title: issue.title,
      reason: issue.blocking.length > 0
        ? `Unblocks ${issue.blocking.length} issue(s)`
        : `Priority P${issue.priority}`,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

program
  .name('bv')
  .description('View issues in robot-friendly formats. The tool recedes; the work remains.')
  .version('0.1.0')
  .option('--robot-priority', 'AI-optimized priority output (JSON)')
  .option('--robot-insights', 'Graph analysis and bottlenecks (JSON)')
  .option('--robot-plan', 'Suggested execution sequence (JSON)')
  .action(async (options) => {
    await ensureInitialized();

    if (options.robotPriority) {
      const output = await robotPriority();
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    if (options.robotInsights) {
      const output = await robotInsights();
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    if (options.robotPlan) {
      const output = await robotPlan();
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Default: show open issues sorted by priority
    const issues = await store.getOpenIssues();
    issues.sort((a, b) => a.priority - b.priority);

    if (issues.length === 0) {
      console.log(chalk.gray('No open issues.'));
      return;
    }

    for (const issue of issues) {
      console.log(formatIssue(issue));
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

program.parse();
