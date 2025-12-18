/**
 * Ethos - Health monitoring and remediation for multi-agent coordination.
 *
 * Monitors system health metrics and suggests/creates remediation tasks
 * when thresholds are violated.
 *
 * Health metrics:
 * - coherence: ratio of issues linked to projects
 * - velocity: issues completed per hour (24h rolling)
 * - blockage: ratio of blocked to open issues
 * - staleness: average age of open issues in days
 * - claimHealth: ratio of active claims to open issues
 * - agentHealth: ratio of active agents to registered agents
 */

import type {
  HealthMetrics,
  HealthThresholds,
  HealthViolation,
  DEFAULT_HEALTH_THRESHOLDS,
} from './types.js';
import type { Tracker } from './tracker.js';
import type { ClaimsManager } from './claims.js';

// Re-export default thresholds
export { DEFAULT_HEALTH_THRESHOLDS } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Remediation
// ─────────────────────────────────────────────────────────────────────────────

export interface RemediationSuggestion {
  /** Metric that triggered this suggestion */
  metric: keyof HealthMetrics;
  /** Severity: 'warning' (threshold approached) or 'critical' (threshold exceeded) */
  severity: 'warning' | 'critical';
  /** Human-readable description */
  description: string;
  /** Suggested actions */
  actions: string[];
  /** Whether to auto-create a remediation project */
  createProject: boolean;
  /** Suggested project details if createProject is true */
  project?: {
    name: string;
    description: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Monitor
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthMonitorOptions {
  thresholds?: Partial<HealthThresholds>;
  /** Rolling window for velocity calculation in hours */
  velocityWindowHours?: number;
  /** Warning threshold multiplier (e.g., 0.8 means warn at 80% of threshold) */
  warningMultiplier?: number;
}

export class HealthMonitor {
  private thresholds: HealthThresholds;
  private velocityWindowHours: number;
  private warningMultiplier: number;

  constructor(options: HealthMonitorOptions = {}) {
    this.thresholds = {
      minCoherence: options.thresholds?.minCoherence ?? 0.7,
      maxBlockage: options.thresholds?.maxBlockage ?? 0.3,
      maxStaleness: options.thresholds?.maxStaleness ?? 7,
      minClaimHealth: options.thresholds?.minClaimHealth ?? 0.3,
      minAgentHealth: options.thresholds?.minAgentHealth ?? 0.5,
    };
    this.velocityWindowHours = options.velocityWindowHours ?? 24;
    this.warningMultiplier = options.warningMultiplier ?? 0.8;
  }

  /**
   * Calculate all health metrics.
   */
  async calculateMetrics(
    tracker: Tracker,
    claimsManager: ClaimsManager
  ): Promise<HealthMetrics> {
    const [
      coherence,
      velocity,
      blockage,
      staleness,
      claimHealth,
      agentHealth,
    ] = await Promise.all([
      this.calculateCoherence(tracker),
      this.calculateVelocity(tracker),
      this.calculateBlockage(tracker),
      this.calculateStaleness(tracker),
      this.calculateClaimHealth(tracker, claimsManager),
      this.calculateAgentHealth(claimsManager),
    ]);

    return {
      coherence,
      velocity,
      blockage,
      staleness,
      claimHealth,
      agentHealth,
    };
  }

  /**
   * Check metrics against thresholds and return violations.
   */
  async checkHealth(
    tracker: Tracker,
    claimsManager: ClaimsManager
  ): Promise<HealthViolation[]> {
    const metrics = await this.calculateMetrics(tracker, claimsManager);
    const violations: HealthViolation[] = [];

    // Coherence (min threshold)
    if (metrics.coherence < this.thresholds.minCoherence) {
      violations.push({
        metric: 'coherence',
        value: metrics.coherence,
        threshold: this.thresholds.minCoherence,
        remediation:
          'Link orphan issues to projects or create a project to group related work',
      });
    }

    // Blockage (max threshold)
    if (metrics.blockage > this.thresholds.maxBlockage) {
      violations.push({
        metric: 'blockage',
        value: metrics.blockage,
        threshold: this.thresholds.maxBlockage,
        remediation:
          'Focus on completing blocking issues or parallelize with any_of dependencies',
      });
    }

    // Staleness (max threshold)
    if (metrics.staleness > this.thresholds.maxStaleness) {
      violations.push({
        metric: 'staleness',
        value: metrics.staleness,
        threshold: this.thresholds.maxStaleness,
        remediation:
          'Prioritize oldest issues or close stale issues that are no longer relevant',
      });
    }

    // Claim health (min threshold)
    if (metrics.claimHealth < this.thresholds.minClaimHealth) {
      violations.push({
        metric: 'claimHealth',
        value: metrics.claimHealth,
        threshold: this.thresholds.minClaimHealth,
        remediation:
          'Agents may be idle or blocked; check agent availability and issue readiness',
      });
    }

    // Agent health (min threshold)
    if (metrics.agentHealth < this.thresholds.minAgentHealth) {
      violations.push({
        metric: 'agentHealth',
        value: metrics.agentHealth,
        threshold: this.thresholds.minAgentHealth,
        remediation:
          'Too many agents are inactive; check agent heartbeats and restart dead agents',
      });
    }

    return violations;
  }

  /**
   * Generate remediation suggestions based on violations.
   */
  async generateRemediations(
    tracker: Tracker,
    claimsManager: ClaimsManager
  ): Promise<RemediationSuggestion[]> {
    const metrics = await this.calculateMetrics(tracker, claimsManager);
    const suggestions: RemediationSuggestion[] = [];

    // Coherence
    if (metrics.coherence < this.thresholds.minCoherence) {
      const severity = metrics.coherence < this.thresholds.minCoherence * 0.5
        ? 'critical'
        : 'warning';

      suggestions.push({
        metric: 'coherence',
        severity,
        description: `Only ${(metrics.coherence * 100).toFixed(0)}% of issues are linked to projects (target: ${(this.thresholds.minCoherence * 100).toFixed(0)}%)`,
        actions: [
          'Audit orphan issues and link them to existing projects',
          'Create new projects to group related orphan issues',
          'Archive or close issues that no longer fit any project',
        ],
        createProject: severity === 'critical',
        project: {
          name: 'Coherence Remediation',
          description: 'Group orphan issues into projects to improve system coherence',
        },
      });
    }

    // Blockage
    if (metrics.blockage > this.thresholds.maxBlockage) {
      const severity = metrics.blockage > this.thresholds.maxBlockage * 1.5
        ? 'critical'
        : 'warning';

      const bottlenecks = await tracker.getBottlenecks(3);
      const bottleneckTitles = bottlenecks.map(
        (b) => `- ${b.issue.title} (blocks ${b.unblocks} issues)`
      );

      suggestions.push({
        metric: 'blockage',
        severity,
        description: `${(metrics.blockage * 100).toFixed(0)}% of issues are blocked (target: <${(this.thresholds.maxBlockage * 100).toFixed(0)}%)`,
        actions: [
          'Focus on completing these high-impact blockers:',
          ...bottleneckTitles,
          'Consider using any_of dependencies for speculative parallelism',
          'Review if all blocking dependencies are truly necessary',
        ],
        createProject: severity === 'critical',
        project: {
          name: 'Unblock Critical Path',
          description: 'Complete blocking issues to unblock downstream work',
        },
      });
    }

    // Staleness
    if (metrics.staleness > this.thresholds.maxStaleness) {
      const severity = metrics.staleness > this.thresholds.maxStaleness * 2
        ? 'critical'
        : 'warning';

      suggestions.push({
        metric: 'staleness',
        severity,
        description: `Average issue age is ${metrics.staleness.toFixed(1)} days (target: <${this.thresholds.maxStaleness} days)`,
        actions: [
          'Review and prioritize oldest open issues',
          'Close issues that are no longer relevant',
          'Split large issues into smaller, actionable tasks',
          'Check if stale issues are blocked and need help',
        ],
        createProject: severity === 'critical',
        project: {
          name: 'Staleness Cleanup',
          description: 'Address old issues to reduce average issue age',
        },
      });
    }

    // Claim health
    if (metrics.claimHealth < this.thresholds.minClaimHealth) {
      const severity = metrics.claimHealth < this.thresholds.minClaimHealth * 0.5
        ? 'critical'
        : 'warning';

      suggestions.push({
        metric: 'claimHealth',
        severity,
        description: `Only ${(metrics.claimHealth * 100).toFixed(0)}% of open issues are being worked on (target: >${(this.thresholds.minClaimHealth * 100).toFixed(0)}%)`,
        actions: [
          'Check if agents are available and active',
          'Verify issues are ready (not blocked)',
          'Ensure capability requirements match available agents',
          'Consider registering more agents',
        ],
        createProject: false,
      });
    }

    // Agent health
    if (metrics.agentHealth < this.thresholds.minAgentHealth) {
      const severity = metrics.agentHealth < this.thresholds.minAgentHealth * 0.5
        ? 'critical'
        : 'warning';

      suggestions.push({
        metric: 'agentHealth',
        severity,
        description: `Only ${(metrics.agentHealth * 100).toFixed(0)}% of agents are active (target: >${(this.thresholds.minAgentHealth * 100).toFixed(0)}%)`,
        actions: [
          'Check agent heartbeats and restart dead agents',
          'Investigate why agents are going inactive',
          'Remove permanently dead agents from the registry',
          'Consider scaling up agent count',
        ],
        createProject: false,
      });
    }

    return suggestions;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Metric Calculations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Coherence: ratio of issues linked to projects.
   */
  private async calculateCoherence(tracker: Tracker): Promise<number> {
    const allIssues = await tracker.getAllIssues();

    if (allIssues.length === 0) {
      return 1; // No issues = perfect coherence
    }

    const linkedIssues = allIssues.filter((i) => i.projectId !== null);
    return linkedIssues.length / allIssues.length;
  }

  /**
   * Velocity: issues completed per hour (rolling window).
   */
  private async calculateVelocity(tracker: Tracker): Promise<number> {
    const allIssues = await tracker.getAllIssues();
    const now = Date.now();
    const windowMs = this.velocityWindowHours * 60 * 60 * 1000;
    const windowStart = now - windowMs;

    const completedInWindow = allIssues.filter((issue) => {
      if (issue.status !== 'completed') return false;
      const updatedAt = new Date(issue.updatedAt).getTime();
      return updatedAt >= windowStart;
    });

    return completedInWindow.length / this.velocityWindowHours;
  }

  /**
   * Blockage: ratio of blocked to open issues.
   */
  private async calculateBlockage(tracker: Tracker): Promise<number> {
    const allIssues = await tracker.getAllIssues();
    const openIssues = allIssues.filter((i) => i.status === 'open');

    if (openIssues.length === 0) {
      return 0; // No open issues = no blockage
    }

    const blockedIssues = await tracker.getBlockedIssues();
    return blockedIssues.length / openIssues.length;
  }

  /**
   * Staleness: average age of open issues in days.
   */
  private async calculateStaleness(tracker: Tracker): Promise<number> {
    const allIssues = await tracker.getAllIssues();
    const openIssues = allIssues.filter((i) => i.status === 'open');

    if (openIssues.length === 0) {
      return 0; // No open issues = no staleness
    }

    const now = Date.now();
    let totalAgeDays = 0;

    for (const issue of openIssues) {
      const createdAt = new Date(issue.createdAt).getTime();
      const ageMs = now - createdAt;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      totalAgeDays += ageDays;
    }

    return totalAgeDays / openIssues.length;
  }

  /**
   * Claim health: ratio of active claims to open issues.
   */
  private async calculateClaimHealth(
    tracker: Tracker,
    claimsManager: ClaimsManager
  ): Promise<number> {
    const allIssues = await tracker.getAllIssues();
    const openIssues = allIssues.filter((i) => i.status === 'open');

    if (openIssues.length === 0) {
      return 1; // No open issues = perfect claim health
    }

    const activeClaims = await claimsManager.getActiveClaims();
    return activeClaims.length / openIssues.length;
  }

  /**
   * Agent health: ratio of active agents to registered agents.
   */
  private async calculateAgentHealth(
    claimsManager: ClaimsManager
  ): Promise<number> {
    const allAgents = await claimsManager.getAllAgents();

    if (allAgents.length === 0) {
      return 0; // No agents = bad health
    }

    const activeAgents = await claimsManager.getActiveAgents();
    return activeAgents.length / allAgents.length;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────

  setThresholds(thresholds: Partial<HealthThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  getThresholds(): HealthThresholds {
    return { ...this.thresholds };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format health metrics for human-readable display.
 */
export function formatHealthMetrics(metrics: HealthMetrics): string {
  return [
    'System Health:',
    `  Coherence:    ${(metrics.coherence * 100).toFixed(1)}% of issues linked to projects`,
    `  Velocity:     ${metrics.velocity.toFixed(2)} issues/hour`,
    `  Blockage:     ${(metrics.blockage * 100).toFixed(1)}% of issues blocked`,
    `  Staleness:    ${metrics.staleness.toFixed(1)} days average issue age`,
    `  Claim Health: ${(metrics.claimHealth * 100).toFixed(1)}% of issues being worked on`,
    `  Agent Health: ${(metrics.agentHealth * 100).toFixed(1)}% of agents active`,
  ].join('\n');
}

/**
 * Format health violations for display.
 */
export function formatViolations(violations: HealthViolation[]): string {
  if (violations.length === 0) {
    return 'No health violations detected.';
  }

  const lines = ['Health Violations:', ''];

  for (const v of violations) {
    lines.push(`[${v.metric.toUpperCase()}]`);
    lines.push(`  Value:     ${v.value.toFixed(2)}`);
    lines.push(`  Threshold: ${v.threshold.toFixed(2)}`);
    lines.push(`  Action:    ${v.remediation}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get overall health status from metrics.
 */
export function getHealthStatus(
  metrics: HealthMetrics,
  thresholds: HealthThresholds = {
    minCoherence: 0.7,
    maxBlockage: 0.3,
    maxStaleness: 7,
    minClaimHealth: 0.3,
    minAgentHealth: 0.5,
  }
): 'healthy' | 'degraded' | 'critical' {
  let violations = 0;
  let criticalViolations = 0;

  if (metrics.coherence < thresholds.minCoherence) {
    violations++;
    if (metrics.coherence < thresholds.minCoherence * 0.5) criticalViolations++;
  }

  if (metrics.blockage > thresholds.maxBlockage) {
    violations++;
    if (metrics.blockage > thresholds.maxBlockage * 1.5) criticalViolations++;
  }

  if (metrics.staleness > thresholds.maxStaleness) {
    violations++;
    if (metrics.staleness > thresholds.maxStaleness * 2) criticalViolations++;
  }

  if (metrics.claimHealth < thresholds.minClaimHealth) {
    violations++;
    if (metrics.claimHealth < thresholds.minClaimHealth * 0.5) criticalViolations++;
  }

  if (metrics.agentHealth < thresholds.minAgentHealth) {
    violations++;
    if (metrics.agentHealth < thresholds.minAgentHealth * 0.5) criticalViolations++;
  }

  if (criticalViolations > 0) return 'critical';
  if (violations > 0) return 'degraded';
  return 'healthy';
}
