/**
 * @workwayco/agents
 *
 * Multi-agent coordination layer for WORKWAY.
 * Work stealing, priority management, and health monitoring.
 *
 * @example
 * ```typescript
 * import { Coordinator, InMemoryStorage, InMemoryClaimsStorage } from '@workwayco/agents';
 *
 * // Create coordinator with in-memory storage
 * const coordinator = new Coordinator({
 *   trackerStorage: new InMemoryStorage(),
 *   claimsStorage: new InMemoryClaimsStorage(),
 * });
 *
 * // Register an agent
 * const agent = await coordinator.registerAgent({
 *   name: 'worker-1',
 *   capabilities: ['typescript', 'testing'],
 * });
 *
 * // Work stealing loop
 * while (true) {
 *   const work = await coordinator.getNextWork(agent.id, agent.capabilities);
 *   if (work.claimed) {
 *     const result = await doWork(work.issue);
 *     await coordinator.completeWork(work.claimId!, agent.id, result);
 *   }
 * }
 * ```
 */

// Types
export type {
  Project,
  CoordinatedIssue,
  Dependency,
  DependencyType,
  Outcome,
  OutcomeType,
  Agent,
  Claim,
  PriorityScore,
  PriorityWeights,
  HealthMetrics,
  HealthThresholds,
  HealthViolation,
  Assignment,
  WorkRequest,
  WorkResult,
  CompletionResult,
} from './types.js';

export { DEFAULT_PRIORITY_WEIGHTS, DEFAULT_HEALTH_THRESHOLDS } from './types.js';

// Tracker
export {
  Tracker,
  InMemoryStorage,
  type TrackerStorage,
  type CreateProjectInput,
  type CreateIssueInput,
  type AddDependencyInput,
  type RecordOutcomeInput,
} from './tracker.js';

// Claims
export {
  ClaimsManager,
  InMemoryClaimsStorage,
  DEFAULT_CLAIM_TTL_MS,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  AGENT_TIMEOUT_MS,
  type ClaimsStorage,
  type RegisterAgentInput,
  type ClaimIssueInput,
  type ClaimResult,
} from './claims.js';

// Priority
export {
  PriorityCalculator,
  formatPriorityScore,
  comparePriorityScores,
  type PriorityCalculatorOptions,
} from './priority.js';

// Router
export {
  Router,
  ExperienceTracker,
  formatAssignment,
  DEFAULT_ROUTER_WEIGHTS,
  type RouterWeights,
  type RouterOptions,
  type AgentExperience,
} from './router.js';

// Ethos (Health Monitoring)
export {
  HealthMonitor,
  formatHealthMetrics,
  formatViolations,
  getHealthStatus,
  type HealthMonitorOptions,
  type RemediationSuggestion,
} from './ethos.js';

// ─────────────────────────────────────────────────────────────────────────────
// Coordinator - Unified API
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Agent,
  CoordinatedIssue,
  Outcome,
  OutcomeType,
  WorkResult,
  CompletionResult,
  HealthMetrics,
  HealthViolation,
  PriorityScore,
  Assignment,
} from './types.js';

import { Tracker, InMemoryStorage, type TrackerStorage } from './tracker.js';
import {
  ClaimsManager,
  InMemoryClaimsStorage,
  type ClaimsStorage,
} from './claims.js';
import { PriorityCalculator, type PriorityCalculatorOptions } from './priority.js';
import { Router, type RouterOptions } from './router.js';
import { HealthMonitor, type HealthMonitorOptions, type RemediationSuggestion } from './ethos.js';

export interface CoordinatorOptions {
  trackerStorage?: TrackerStorage;
  claimsStorage?: ClaimsStorage;
  priority?: PriorityCalculatorOptions;
  router?: RouterOptions;
  health?: HealthMonitorOptions;
  claimTtlMs?: number;
}

/**
 * Coordinator - Unified API for multi-agent coordination.
 *
 * Combines Tracker, Claims, Priority, Router, and Ethos into a single interface.
 */
export class Coordinator {
  readonly tracker: Tracker;
  readonly claims: ClaimsManager;
  readonly priority: PriorityCalculator;
  readonly router: Router;
  readonly health: HealthMonitor;

  constructor(options: CoordinatorOptions = {}) {
    const trackerStorage = options.trackerStorage || new InMemoryStorage();
    const claimsStorage = options.claimsStorage || new InMemoryClaimsStorage();

    this.tracker = new Tracker(trackerStorage);
    this.claims = new ClaimsManager(claimsStorage, options.claimTtlMs);
    this.priority = new PriorityCalculator(options.priority);
    this.router = new Router(this.claims, options.router);
    this.health = new HealthMonitor(options.health);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Agent Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a new agent.
   */
  async registerAgent(input: {
    id?: string;
    name: string;
    capabilities: string[];
    maxConcurrent?: number;
  }): Promise<Agent> {
    return this.claims.registerAgent(input);
  }

  /**
   * Unregister an agent and release all its claims.
   */
  async unregisterAgent(agentId: string): Promise<void> {
    return this.claims.unregisterAgent(agentId);
  }

  /**
   * Send a heartbeat for an agent.
   */
  async heartbeat(agentId: string): Promise<Agent | null> {
    return this.claims.heartbeat(agentId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Work Stealing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the next piece of work for an agent.
   * Uses priority scoring and capability matching.
   */
  async getNextWork(
    agentId: string,
    capabilities: string[]
  ): Promise<WorkResult> {
    // Get ready issues (not blocked)
    const readyIssues = await this.tracker.getReadyIssues();

    if (readyIssues.length === 0) {
      return { claimed: false, claimId: null, issue: null };
    }

    // Get priority-ranked suggestion
    const suggestion = await this.priority.suggestNextIssue(
      this.tracker,
      capabilities,
      [] // Could pass already-claimed issues here
    );

    if (!suggestion) {
      return { claimed: false, claimId: null, issue: null };
    }

    // Try to claim the issue
    const claimResult = await this.claims.claimIssue({
      agentId,
      issueId: suggestion.issueId,
    });

    if (!claimResult.success) {
      // Issue was claimed by another agent, try the next one
      return this.getNextWork(agentId, capabilities);
    }

    const issue = await this.tracker.getIssue(suggestion.issueId);

    if (!issue) {
      // Issue disappeared, release claim and try again
      if (claimResult.claim) {
        await this.claims.releaseClaim(claimResult.claim.id, agentId);
      }
      return this.getNextWork(agentId, capabilities);
    }

    // Update issue status
    await this.tracker.updateIssueStatus(issue.id, 'claimed');

    // Record assignment for router experience
    this.router.recordAssignment(agentId);

    return {
      claimed: true,
      claimId: claimResult.claim!.id,
      issue,
    };
  }

  /**
   * Complete work on an issue.
   */
  async completeWork(
    claimId: string,
    agentId: string,
    result: {
      outcome: OutcomeType;
      summary: string;
    }
  ): Promise<CompletionResult> {
    const claim = await this.claims.getClaim(claimId);

    if (!claim || claim.agentId !== agentId) {
      return { recorded: false, unblockedIssues: [], cancelledIssues: [] };
    }

    const issue = await this.tracker.getIssue(claim.issueId);

    if (!issue) {
      return { recorded: false, unblockedIssues: [], cancelledIssues: [] };
    }

    // Record the outcome
    const outcome = await this.tracker.recordOutcome({
      issueId: claim.issueId,
      outcome: result.outcome,
      summary: result.summary,
      agentId,
    });

    // Record for router experience
    this.router.recordOutcome(agentId, outcome, issue);

    // Release the claim
    await this.claims.releaseClaim(claimId, agentId);

    // Find newly unblocked issues
    const unblockedIssues: string[] = [];
    const dependents = await this.tracker.getDependents(claim.issueId);

    for (const dep of dependents) {
      if (dep.type === 'blocks') {
        const dependent = await this.tracker.getIssue(dep.issueId);
        if (dependent && dependent.status === 'open') {
          // Check if all blockers are now resolved
          const blockers = await this.tracker.getDependencies(dep.issueId);
          const blockingDeps = blockers.filter((d) => d.type === 'blocks');

          let allResolved = true;
          for (const blocker of blockingDeps) {
            const blockerOutcome = await this.tracker.getOutcome(blocker.dependsOnId);
            if (!blockerOutcome || blockerOutcome.outcome !== 'success') {
              allResolved = false;
              break;
            }
          }

          if (allResolved) {
            unblockedIssues.push(dep.issueId);
          }
        }
      }
    }

    // Find cancelled issues (from speculative parallelism)
    const cancelledIssues: string[] = [];
    if (result.outcome === 'success') {
      const allIssues = await this.tracker.getAllIssues();
      for (const i of allIssues) {
        if (i.status === 'cancelled') {
          const o = await this.tracker.getOutcome(i.id);
          if (o && o.summary.includes(claim.issueId)) {
            cancelledIssues.push(i.id);
          }
        }
      }
    }

    return {
      recorded: true,
      unblockedIssues,
      cancelledIssues,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Health & Monitoring
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current health metrics.
   */
  async getHealthMetrics(): Promise<HealthMetrics> {
    return this.health.calculateMetrics(this.tracker, this.claims);
  }

  /**
   * Check for health violations.
   */
  async checkHealth(): Promise<HealthViolation[]> {
    return this.health.checkHealth(this.tracker, this.claims);
  }

  /**
   * Get remediation suggestions for health issues.
   */
  async getRemediations(): Promise<RemediationSuggestion[]> {
    return this.health.generateRemediations(this.tracker, this.claims);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Priority & Routing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get priority scores for all open issues.
   */
  async getPriorityScores(): Promise<PriorityScore[]> {
    return this.priority.calculateScores(this.tracker);
  }

  /**
   * Find the best agent for an issue.
   */
  async findBestAgent(issue: CoordinatedIssue): Promise<Assignment | null> {
    return this.router.findBestAgent(issue);
  }

  /**
   * Get system bottlenecks.
   */
  async getBottlenecks(
    limit = 5
  ): Promise<Array<{ issue: CoordinatedIssue; score: PriorityScore; unblocks: number }>> {
    return this.priority.getBottlenecks(this.tracker, limit);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Clean up expired claims.
   */
  async cleanupExpiredClaims(): Promise<number> {
    return this.claims.cleanupExpiredClaims();
  }

  /**
   * Clean up dead agents.
   */
  async cleanupDeadAgents(): Promise<string[]> {
    return this.claims.cleanupDeadAgents();
  }

  /**
   * Run all cleanup operations.
   */
  async cleanup(): Promise<{
    expiredClaims: number;
    deadAgents: string[];
  }> {
    const [expiredClaims, deadAgents] = await Promise.all([
      this.cleanupExpiredClaims(),
      this.cleanupDeadAgents(),
    ]);

    return { expiredClaims, deadAgents };
  }
}
