/**
 * Router - Capability-based agent assignment for multi-agent coordination.
 *
 * Matches issues to the best available agents based on:
 * - Capability match (required capabilities vs agent capabilities)
 * - Current workload (claims held)
 * - Recency (time since last assignment)
 * - Experience (past performance on similar issues)
 */

import type {
  Agent,
  CoordinatedIssue,
  Assignment,
  Outcome,
} from './types.js';
import type { ClaimsManager } from './claims.js';

// ─────────────────────────────────────────────────────────────────────────────
// Router Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface RouterWeights {
  /** Weight for capability match (0-1) */
  capability: number;
  /** Weight for workload consideration (0-1) */
  workload: number;
  /** Weight for recency (0-1) */
  recency: number;
  /** Weight for past experience (0-1) */
  experience: number;
}

export const DEFAULT_ROUTER_WEIGHTS: RouterWeights = {
  capability: 0.4,
  workload: 0.3,
  recency: 0.15,
  experience: 0.15,
};

export interface RouterOptions {
  weights?: Partial<RouterWeights>;
  /** Maximum time in ms to consider for recency scoring */
  maxRecencyMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Experience Tracker
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentExperience {
  agentId: string;
  /** Count of successful completions by capability */
  successByCapability: Map<string, number>;
  /** Count of successful completions by label */
  successByLabel: Map<string, number>;
  /** Total successful completions */
  totalSuccess: number;
  /** Total failures */
  totalFailure: number;
  /** Last assignment timestamp */
  lastAssignment: string | null;
}

export class ExperienceTracker {
  private experiences = new Map<string, AgentExperience>();

  /**
   * Record an outcome for an agent.
   */
  recordOutcome(
    agentId: string,
    outcome: Outcome,
    issue: CoordinatedIssue
  ): void {
    let exp = this.experiences.get(agentId);

    if (!exp) {
      exp = {
        agentId,
        successByCapability: new Map(),
        successByLabel: new Map(),
        totalSuccess: 0,
        totalFailure: 0,
        lastAssignment: null,
      };
      this.experiences.set(agentId, exp);
    }

    if (outcome.outcome === 'success') {
      exp.totalSuccess++;

      // Track by capability
      for (const cap of issue.capabilities) {
        const count = exp.successByCapability.get(cap) || 0;
        exp.successByCapability.set(cap, count + 1);
      }

      // Track by label
      for (const label of issue.labels) {
        const count = exp.successByLabel.get(label) || 0;
        exp.successByLabel.set(label, count + 1);
      }
    } else if (outcome.outcome === 'failure') {
      exp.totalFailure++;
    }
  }

  /**
   * Record an assignment (for recency tracking).
   */
  recordAssignment(agentId: string): void {
    let exp = this.experiences.get(agentId);

    if (!exp) {
      exp = {
        agentId,
        successByCapability: new Map(),
        successByLabel: new Map(),
        totalSuccess: 0,
        totalFailure: 0,
        lastAssignment: null,
      };
      this.experiences.set(agentId, exp);
    }

    exp.lastAssignment = new Date().toISOString();
  }

  /**
   * Get experience for an agent.
   */
  getExperience(agentId: string): AgentExperience | null {
    return this.experiences.get(agentId) || null;
  }

  /**
   * Get all experiences.
   */
  getAllExperiences(): AgentExperience[] {
    return Array.from(this.experiences.values());
  }

  /**
   * Calculate experience score for an agent on a specific issue.
   * Returns 0-1 based on past success with similar capabilities/labels.
   */
  calculateExperienceScore(agentId: string, issue: CoordinatedIssue): number {
    const exp = this.experiences.get(agentId);
    if (!exp) return 0.5; // No history = neutral score

    let score = 0;
    let factors = 0;

    // Score based on capability experience
    if (issue.capabilities.length > 0) {
      let capScore = 0;
      for (const cap of issue.capabilities) {
        const count = exp.successByCapability.get(cap) || 0;
        capScore += Math.min(count / 5, 1); // Cap at 5 successes = max score
      }
      score += capScore / issue.capabilities.length;
      factors++;
    }

    // Score based on label experience
    if (issue.labels.length > 0) {
      let labelScore = 0;
      for (const label of issue.labels) {
        const count = exp.successByLabel.get(label) || 0;
        labelScore += Math.min(count / 5, 1);
      }
      score += labelScore / issue.labels.length;
      factors++;
    }

    // Factor in success rate
    const totalTasks = exp.totalSuccess + exp.totalFailure;
    if (totalTasks > 0) {
      const successRate = exp.totalSuccess / totalTasks;
      score += successRate;
      factors++;
    }

    return factors > 0 ? score / factors : 0.5;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

export class Router {
  private weights: RouterWeights;
  private maxRecencyMs: number;
  private experienceTracker = new ExperienceTracker();

  constructor(
    private claimsManager: ClaimsManager,
    options: RouterOptions = {}
  ) {
    this.weights = {
      ...DEFAULT_ROUTER_WEIGHTS,
      ...options.weights,
    };
    this.maxRecencyMs = options.maxRecencyMs ?? 60 * 60 * 1000; // 1 hour default
  }

  /**
   * Find the best agent for an issue.
   */
  async findBestAgent(issue: CoordinatedIssue): Promise<Assignment | null> {
    const agents = await this.claimsManager.getActiveAgents();

    if (agents.length === 0) {
      return null;
    }

    const assignments: Assignment[] = [];

    for (const agent of agents) {
      const components = await this.scoreAgent(agent, issue);

      // Skip agents with no capability match if issue requires capabilities
      if (issue.capabilities.length > 0 && components.capability === 0) {
        continue;
      }

      const score =
        components.capability * this.weights.capability +
        components.workload * this.weights.workload +
        components.recency * this.weights.recency +
        components.experience * this.weights.experience;

      assignments.push({
        issueId: issue.id,
        agentId: agent.id,
        score,
        components,
      });
    }

    if (assignments.length === 0) {
      return null;
    }

    // Sort by score descending
    assignments.sort((a, b) => b.score - a.score);

    return assignments[0];
  }

  /**
   * Find assignments for multiple issues.
   * Returns optimal assignment mapping.
   */
  async findAssignments(
    issues: CoordinatedIssue[]
  ): Promise<Map<string, Assignment>> {
    const assignments = new Map<string, Assignment>();
    const assignedAgents = new Set<string>();

    // Sort issues by priority (higher first)
    const sortedIssues = [...issues].sort((a, b) => b.priority - a.priority);

    for (const issue of sortedIssues) {
      const agents = await this.claimsManager.getActiveAgents();

      // Filter out already-assigned agents (for this batch)
      const availableAgents = agents.filter(
        (a) => !assignedAgents.has(a.id) && a.status === 'active'
      );

      if (availableAgents.length === 0) {
        continue;
      }

      let bestAssignment: Assignment | null = null;

      for (const agent of availableAgents) {
        const components = await this.scoreAgent(agent, issue);

        if (issue.capabilities.length > 0 && components.capability === 0) {
          continue;
        }

        const score =
          components.capability * this.weights.capability +
          components.workload * this.weights.workload +
          components.recency * this.weights.recency +
          components.experience * this.weights.experience;

        if (!bestAssignment || score > bestAssignment.score) {
          bestAssignment = {
            issueId: issue.id,
            agentId: agent.id,
            score,
            components,
          };
        }
      }

      if (bestAssignment) {
        assignments.set(issue.id, bestAssignment);
        assignedAgents.add(bestAssignment.agentId);
      }
    }

    return assignments;
  }

  /**
   * Score an agent for a specific issue.
   */
  private async scoreAgent(
    agent: Agent,
    issue: CoordinatedIssue
  ): Promise<Assignment['components']> {
    return {
      capability: this.calculateCapabilityScore(agent, issue),
      workload: await this.calculateWorkloadScore(agent),
      recency: this.calculateRecencyScore(agent),
      experience: this.experienceTracker.calculateExperienceScore(
        agent.id,
        issue
      ),
    };
  }

  /**
   * Calculate capability match score (0-1).
   */
  private calculateCapabilityScore(
    agent: Agent,
    issue: CoordinatedIssue
  ): number {
    if (issue.capabilities.length === 0) {
      // No specific capabilities required
      return 1;
    }

    const agentCaps = new Set(agent.capabilities);
    let matches = 0;

    for (const cap of issue.capabilities) {
      if (agentCaps.has(cap)) {
        matches++;
      }
    }

    return matches / issue.capabilities.length;
  }

  /**
   * Calculate workload score (0-1).
   * Lower workload = higher score.
   */
  private async calculateWorkloadScore(agent: Agent): Promise<number> {
    const claims = await this.claimsManager.getClaimsByAgent(agent.id);
    const activeClaims = claims.filter((c) => c.active);

    if (agent.maxConcurrent === 0) {
      return 0;
    }

    const utilization = activeClaims.length / agent.maxConcurrent;

    // Invert: low utilization = high score
    return 1 - utilization;
  }

  /**
   * Calculate recency score (0-1).
   * Agents who haven't been assigned recently get higher scores.
   */
  private calculateRecencyScore(agent: Agent): number {
    const exp = this.experienceTracker.getExperience(agent.id);

    if (!exp || !exp.lastAssignment) {
      return 1; // Never assigned = highest recency score
    }

    const lastAssignment = new Date(exp.lastAssignment).getTime();
    const now = Date.now();
    const elapsed = now - lastAssignment;

    // Normalize: maxRecencyMs or more = 1.0
    return Math.min(elapsed / this.maxRecencyMs, 1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Experience Integration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Record an outcome for experience tracking.
   */
  recordOutcome(
    agentId: string,
    outcome: Outcome,
    issue: CoordinatedIssue
  ): void {
    this.experienceTracker.recordOutcome(agentId, outcome, issue);
  }

  /**
   * Record an assignment for recency tracking.
   */
  recordAssignment(agentId: string): void {
    this.experienceTracker.recordAssignment(agentId);
  }

  /**
   * Get experience tracker for external access.
   */
  getExperienceTracker(): ExperienceTracker {
    return this.experienceTracker;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  setWeights(weights: Partial<RouterWeights>): void {
    this.weights = {
      ...this.weights,
      ...weights,
    };
  }

  getWeights(): RouterWeights {
    return { ...this.weights };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format an assignment for human-readable display.
 */
export function formatAssignment(assignment: Assignment): string {
  const { components } = assignment;
  return [
    `Issue: ${assignment.issueId}`,
    `Agent: ${assignment.agentId}`,
    `Total Score: ${assignment.score.toFixed(3)}`,
    `Components:`,
    `  Capability: ${(components.capability * 100).toFixed(1)}%`,
    `  Workload:   ${(components.workload * 100).toFixed(1)}%`,
    `  Recency:    ${(components.recency * 100).toFixed(1)}%`,
    `  Experience: ${(components.experience * 100).toFixed(1)}%`,
  ].join('\n');
}
