/**
 * Priority - Graph-based prioritization for multi-agent coordination.
 *
 * Calculates weighted priority scores for issues based on:
 * - Base priority (user-assigned)
 * - Impact (how many issues unblocked)
 * - Age (how long issue has been open)
 * - Connectivity (graph centrality)
 * - Project alignment
 */

import type {
  CoordinatedIssue,
  Dependency,
  PriorityScore,
  PriorityWeights,
  DEFAULT_PRIORITY_WEIGHTS,
} from './types.js';
import type { Tracker } from './tracker.js';

// Re-export default weights
export { DEFAULT_PRIORITY_WEIGHTS } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Priority Calculator
// ─────────────────────────────────────────────────────────────────────────────

export interface PriorityCalculatorOptions {
  weights?: Partial<PriorityWeights>;
  /** Project IDs to boost in scoring */
  priorityProjects?: string[];
  /** Maximum age in days for age scoring (older = max score) */
  maxAgeDays?: number;
}

export class PriorityCalculator {
  private weights: PriorityWeights;
  private priorityProjects: Set<string>;
  private maxAgeDays: number;

  constructor(options: PriorityCalculatorOptions = {}) {
    this.weights = {
      priority: options.weights?.priority ?? 0.3,
      impact: options.weights?.impact ?? 0.35,
      age: options.weights?.age ?? 0.1,
      connectivity: options.weights?.connectivity ?? 0.15,
      project: options.weights?.project ?? 0.1,
    };
    this.priorityProjects = new Set(options.priorityProjects || []);
    this.maxAgeDays = options.maxAgeDays ?? 30;
  }

  /**
   * Calculate priority scores for all open issues.
   */
  async calculateScores(tracker: Tracker): Promise<PriorityScore[]> {
    const allIssues = await tracker.getAllIssues();
    const openIssues = allIssues.filter((i) => i.status === 'open');

    // Build dependency graph for impact calculation
    const impactMap = await this.calculateImpactScores(tracker, openIssues);

    // Build connectivity scores
    const connectivityMap = await this.calculateConnectivityScores(
      tracker,
      openIssues
    );

    const scores: PriorityScore[] = [];

    for (const issue of openIssues) {
      const components = {
        priority: this.normalizePriority(issue.priority),
        impact: impactMap.get(issue.id) || 0,
        age: this.calculateAgeScore(issue),
        connectivity: connectivityMap.get(issue.id) || 0,
        project: this.calculateProjectScore(issue),
      };

      const score =
        components.priority * this.weights.priority +
        components.impact * this.weights.impact +
        components.age * this.weights.age +
        components.connectivity * this.weights.connectivity +
        components.project * this.weights.project;

      scores.push({
        issueId: issue.id,
        score,
        components,
      });
    }

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Get top N issues by priority score.
   */
  async getTopIssues(tracker: Tracker, limit: number): Promise<PriorityScore[]> {
    const scores = await this.calculateScores(tracker);
    return scores.slice(0, limit);
  }

  /**
   * Get issues that would unblock the most work when completed.
   * These are high-value bottlenecks.
   */
  async getBottlenecks(
    tracker: Tracker,
    limit = 5
  ): Promise<Array<{ issue: CoordinatedIssue; score: PriorityScore; unblocks: number }>> {
    const bottlenecks = await tracker.getBottlenecks(limit);
    const scores = await this.calculateScores(tracker);
    const scoreMap = new Map(scores.map((s) => [s.issueId, s]));

    return bottlenecks.map((b) => ({
      issue: b.issue,
      score: scoreMap.get(b.issue.id) || {
        issueId: b.issue.id,
        score: 0,
        components: { priority: 0, impact: 0, age: 0, connectivity: 0, project: 0 },
      },
      unblocks: b.unblocks,
    }));
  }

  /**
   * Suggest optimal issue for an agent to work on next.
   * Considers priority score and capability match.
   */
  async suggestNextIssue(
    tracker: Tracker,
    agentCapabilities: string[],
    excludeIssueIds: string[] = []
  ): Promise<PriorityScore | null> {
    const scores = await this.calculateScores(tracker);
    const excludeSet = new Set(excludeIssueIds);

    // Get ready issues (not blocked)
    const readyIssues = await tracker.getReadyIssues();
    const readySet = new Set(readyIssues.map((i) => i.id));

    // Filter to ready issues that match capabilities
    for (const score of scores) {
      if (excludeSet.has(score.issueId)) continue;
      if (!readySet.has(score.issueId)) continue;

      const issue = readyIssues.find((i) => i.id === score.issueId);
      if (!issue) continue;

      // Check capability match
      if (issue.capabilities.length === 0) {
        // No specific capabilities required
        return score;
      }

      const hasCapability = issue.capabilities.some((cap) =>
        agentCapabilities.includes(cap)
      );

      if (hasCapability) {
        return score;
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Component Calculations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Normalize priority (0-4) to 0-1 scale.
   * Higher priority = higher score.
   */
  private normalizePriority(priority: number): number {
    // Priority 0 = lowest, 4 = highest
    return priority / 4;
  }

  /**
   * Calculate impact score based on how many issues would be unblocked.
   * Returns normalized 0-1 score.
   */
  private async calculateImpactScores(
    tracker: Tracker,
    openIssues: CoordinatedIssue[]
  ): Promise<Map<string, number>> {
    const impactMap = new Map<string, number>();
    const openIssueIds = new Set(openIssues.map((i) => i.id));

    // Count direct dependents for each issue
    let maxImpact = 0;

    for (const issue of openIssues) {
      const dependents = await tracker.getDependents(issue.id);
      const blockingDependents = dependents.filter(
        (d) => d.type === 'blocks' && openIssueIds.has(d.issueId)
      );

      const impact = blockingDependents.length;
      impactMap.set(issue.id, impact);

      if (impact > maxImpact) {
        maxImpact = impact;
      }
    }

    // Normalize to 0-1
    if (maxImpact > 0) {
      for (const [id, impact] of impactMap.entries()) {
        impactMap.set(id, impact / maxImpact);
      }
    }

    return impactMap;
  }

  /**
   * Calculate connectivity score based on graph centrality.
   * Issues with more connections (both directions) score higher.
   */
  private async calculateConnectivityScores(
    tracker: Tracker,
    openIssues: CoordinatedIssue[]
  ): Promise<Map<string, number>> {
    const connectivityMap = new Map<string, number>();
    const openIssueIds = new Set(openIssues.map((i) => i.id));

    let maxConnectivity = 0;

    for (const issue of openIssues) {
      const dependencies = await tracker.getDependencies(issue.id);
      const dependents = await tracker.getDependents(issue.id);

      // Count connections to other open issues
      const openDependencies = dependencies.filter((d) =>
        openIssueIds.has(d.dependsOnId)
      );
      const openDependents = dependents.filter((d) =>
        openIssueIds.has(d.issueId)
      );

      const connectivity = openDependencies.length + openDependents.length;
      connectivityMap.set(issue.id, connectivity);

      if (connectivity > maxConnectivity) {
        maxConnectivity = connectivity;
      }
    }

    // Normalize to 0-1
    if (maxConnectivity > 0) {
      for (const [id, connectivity] of connectivityMap.entries()) {
        connectivityMap.set(id, connectivity / maxConnectivity);
      }
    }

    return connectivityMap;
  }

  /**
   * Calculate age score based on how long issue has been open.
   * Older issues score higher to prevent staleness.
   */
  private calculateAgeScore(issue: CoordinatedIssue): number {
    const createdAt = new Date(issue.createdAt).getTime();
    const now = Date.now();
    const ageMs = now - createdAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Normalize: maxAgeDays or older = 1.0
    return Math.min(ageDays / this.maxAgeDays, 1);
  }

  /**
   * Calculate project alignment score.
   * Issues in priority projects get a boost.
   */
  private calculateProjectScore(issue: CoordinatedIssue): number {
    if (!issue.projectId) {
      return 0; // No project = no boost
    }

    if (this.priorityProjects.has(issue.projectId)) {
      return 1; // Priority project = max boost
    }

    return 0.5; // Has project but not priority = moderate
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  setWeights(weights: Partial<PriorityWeights>): void {
    this.weights = {
      ...this.weights,
      ...weights,
    };
  }

  getWeights(): PriorityWeights {
    return { ...this.weights };
  }

  setPriorityProjects(projectIds: string[]): void {
    this.priorityProjects = new Set(projectIds);
  }

  addPriorityProject(projectId: string): void {
    this.priorityProjects.add(projectId);
  }

  removePriorityProject(projectId: string): void {
    this.priorityProjects.delete(projectId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a priority score for human-readable display.
 */
export function formatPriorityScore(score: PriorityScore): string {
  const { components } = score;
  return [
    `Issue: ${score.issueId}`,
    `Total Score: ${score.score.toFixed(3)}`,
    `Components:`,
    `  Priority: ${(components.priority * 100).toFixed(1)}%`,
    `  Impact:   ${(components.impact * 100).toFixed(1)}%`,
    `  Age:      ${(components.age * 100).toFixed(1)}%`,
    `  Connect:  ${(components.connectivity * 100).toFixed(1)}%`,
    `  Project:  ${(components.project * 100).toFixed(1)}%`,
  ].join('\n');
}

/**
 * Compare two priority scores for sorting.
 */
export function comparePriorityScores(
  a: PriorityScore,
  b: PriorityScore
): number {
  return b.score - a.score;
}
