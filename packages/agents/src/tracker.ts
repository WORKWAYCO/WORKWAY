/**
 * Tracker - Task graph management for multi-agent coordination.
 *
 * Manages projects, issues, dependencies, and outcomes.
 * The graph structure enables parallel work while respecting blocking relationships.
 */

import type {
  Project,
  CoordinatedIssue,
  Dependency,
  DependencyType,
  Outcome,
  OutcomeType,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Storage Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface TrackerStorage {
  // Projects
  getProject(id: string): Promise<Project | null>;
  getAllProjects(): Promise<Project[]>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // Issues
  getIssue(id: string): Promise<CoordinatedIssue | null>;
  getAllIssues(): Promise<CoordinatedIssue[]>;
  getIssuesByProject(projectId: string): Promise<CoordinatedIssue[]>;
  saveIssue(issue: CoordinatedIssue): Promise<void>;
  deleteIssue(id: string): Promise<void>;

  // Dependencies
  getDependencies(issueId: string): Promise<Dependency[]>;
  getDependents(issueId: string): Promise<Dependency[]>;
  getAllDependencies(): Promise<Dependency[]>;
  saveDependency(dep: Dependency): Promise<void>;
  deleteDependency(issueId: string, dependsOnId: string): Promise<void>;

  // Outcomes
  getOutcome(issueId: string): Promise<Outcome | null>;
  getAllOutcomes(): Promise<Outcome[]>;
  saveOutcome(outcome: Outcome): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Storage (for testing and simple use cases)
// ─────────────────────────────────────────────────────────────────────────────

export class InMemoryStorage implements TrackerStorage {
  private projects = new Map<string, Project>();
  private issues = new Map<string, CoordinatedIssue>();
  private dependencies: Dependency[] = [];
  private outcomes = new Map<string, Outcome>();

  async getProject(id: string): Promise<Project | null> {
    return this.projects.get(id) || null;
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async saveProject(project: Project): Promise<void> {
    this.projects.set(project.id, project);
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }

  async getIssue(id: string): Promise<CoordinatedIssue | null> {
    return this.issues.get(id) || null;
  }

  async getAllIssues(): Promise<CoordinatedIssue[]> {
    return Array.from(this.issues.values());
  }

  async getIssuesByProject(projectId: string): Promise<CoordinatedIssue[]> {
    return Array.from(this.issues.values()).filter(
      (issue) => issue.projectId === projectId
    );
  }

  async saveIssue(issue: CoordinatedIssue): Promise<void> {
    this.issues.set(issue.id, issue);
  }

  async deleteIssue(id: string): Promise<void> {
    this.issues.delete(id);
  }

  async getDependencies(issueId: string): Promise<Dependency[]> {
    return this.dependencies.filter((d) => d.issueId === issueId);
  }

  async getDependents(issueId: string): Promise<Dependency[]> {
    return this.dependencies.filter((d) => d.dependsOnId === issueId);
  }

  async getAllDependencies(): Promise<Dependency[]> {
    return [...this.dependencies];
  }

  async saveDependency(dep: Dependency): Promise<void> {
    // Remove existing if present
    this.dependencies = this.dependencies.filter(
      (d) => !(d.issueId === dep.issueId && d.dependsOnId === dep.dependsOnId)
    );
    this.dependencies.push(dep);
  }

  async deleteDependency(issueId: string, dependsOnId: string): Promise<void> {
    this.dependencies = this.dependencies.filter(
      (d) => !(d.issueId === issueId && d.dependsOnId === dependsOnId)
    );
  }

  async getOutcome(issueId: string): Promise<Outcome | null> {
    return this.outcomes.get(issueId) || null;
  }

  async getAllOutcomes(): Promise<Outcome[]> {
    return Array.from(this.outcomes.values());
  }

  async saveOutcome(outcome: Outcome): Promise<void> {
    this.outcomes.set(outcome.issueId, outcome);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracker
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  id?: string;
  name: string;
  description: string;
}

export interface CreateIssueInput {
  id?: string;
  projectId?: string;
  title: string;
  priority?: number;
  capabilities?: string[];
  labels?: string[];
}

export interface AddDependencyInput {
  issueId: string;
  dependsOnId: string;
  type: DependencyType;
}

export interface RecordOutcomeInput {
  issueId: string;
  outcome: OutcomeType;
  summary: string;
  agentId: string;
}

export class Tracker {
  constructor(private storage: TrackerStorage) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Projects
  // ─────────────────────────────────────────────────────────────────────────

  async createProject(input: CreateProjectInput): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: input.id || this.generateId('proj'),
      name: input.name,
      description: input.description,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.saveProject(project);
    return project;
  }

  async getProject(id: string): Promise<Project | null> {
    return this.storage.getProject(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return this.storage.getAllProjects();
  }

  async updateProjectStatus(
    id: string,
    status: Project['status']
  ): Promise<Project | null> {
    const project = await this.storage.getProject(id);
    if (!project) return null;

    const updated: Project = {
      ...project,
      status,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.saveProject(updated);
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Issues
  // ─────────────────────────────────────────────────────────────────────────

  async createIssue(input: CreateIssueInput): Promise<CoordinatedIssue> {
    const now = new Date().toISOString();
    const issue: CoordinatedIssue = {
      id: input.id || this.generateId('issue'),
      projectId: input.projectId || null,
      title: input.title,
      status: 'open',
      priority: input.priority ?? 2,
      capabilities: input.capabilities || [],
      labels: input.labels || [],
      createdAt: now,
      updatedAt: now,
    };

    await this.storage.saveIssue(issue);
    return issue;
  }

  async getIssue(id: string): Promise<CoordinatedIssue | null> {
    return this.storage.getIssue(id);
  }

  async getAllIssues(): Promise<CoordinatedIssue[]> {
    return this.storage.getAllIssues();
  }

  async getIssuesByProject(projectId: string): Promise<CoordinatedIssue[]> {
    return this.storage.getIssuesByProject(projectId);
  }

  async updateIssueStatus(
    id: string,
    status: CoordinatedIssue['status']
  ): Promise<CoordinatedIssue | null> {
    const issue = await this.storage.getIssue(id);
    if (!issue) return null;

    const updated: CoordinatedIssue = {
      ...issue,
      status,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.saveIssue(updated);
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dependencies
  // ─────────────────────────────────────────────────────────────────────────

  async addDependency(input: AddDependencyInput): Promise<Dependency> {
    const dep: Dependency = {
      issueId: input.issueId,
      dependsOnId: input.dependsOnId,
      type: input.type,
      createdAt: new Date().toISOString(),
    };

    await this.storage.saveDependency(dep);
    return dep;
  }

  async removeDependency(issueId: string, dependsOnId: string): Promise<void> {
    await this.storage.deleteDependency(issueId, dependsOnId);
  }

  async getDependencies(issueId: string): Promise<Dependency[]> {
    return this.storage.getDependencies(issueId);
  }

  async getDependents(issueId: string): Promise<Dependency[]> {
    return this.storage.getDependents(issueId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Outcomes
  // ─────────────────────────────────────────────────────────────────────────

  async recordOutcome(input: RecordOutcomeInput): Promise<Outcome> {
    const outcome: Outcome = {
      issueId: input.issueId,
      outcome: input.outcome,
      summary: input.summary,
      agentId: input.agentId,
      completedAt: new Date().toISOString(),
    };

    await this.storage.saveOutcome(outcome);

    // Update issue status based on outcome
    const statusMap: Record<OutcomeType, CoordinatedIssue['status']> = {
      success: 'completed',
      failure: 'failed',
      partial: 'in_progress',
      cancelled: 'cancelled',
    };

    await this.updateIssueStatus(input.issueId, statusMap[input.outcome]);

    // Handle speculative parallelism (any_of dependencies)
    if (input.outcome === 'success') {
      await this.cancelSpeculativeAlternatives(input.issueId);
    }

    return outcome;
  }

  async getOutcome(issueId: string): Promise<Outcome | null> {
    return this.storage.getOutcome(issueId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Ready Issues (for work stealing)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get issues that are ready to be worked on:
   * - Status is 'open'
   * - All blocking dependencies are completed
   * - Not currently claimed (caller should check claims separately)
   */
  async getReadyIssues(): Promise<CoordinatedIssue[]> {
    const allIssues = await this.storage.getAllIssues();
    const allDependencies = await this.storage.getAllDependencies();
    const allOutcomes = await this.storage.getAllOutcomes();

    const completedIds = new Set(
      allOutcomes
        .filter((o) => o.outcome === 'success')
        .map((o) => o.issueId)
    );

    const readyIssues: CoordinatedIssue[] = [];

    for (const issue of allIssues) {
      if (issue.status !== 'open') continue;

      // Get blocking dependencies for this issue
      const blockingDeps = allDependencies.filter(
        (d) => d.issueId === issue.id && d.type === 'blocks'
      );

      // Check if all blockers are completed
      const allBlockersCompleted = blockingDeps.every((d) =>
        completedIds.has(d.dependsOnId)
      );

      if (allBlockersCompleted) {
        readyIssues.push(issue);
      }
    }

    return readyIssues;
  }

  /**
   * Get issues that are blocked and their blockers.
   */
  async getBlockedIssues(): Promise<
    Array<{ issue: CoordinatedIssue; blockedBy: string[] }>
  > {
    const allIssues = await this.storage.getAllIssues();
    const allDependencies = await this.storage.getAllDependencies();
    const allOutcomes = await this.storage.getAllOutcomes();

    const completedIds = new Set(
      allOutcomes
        .filter((o) => o.outcome === 'success')
        .map((o) => o.issueId)
    );

    const blockedIssues: Array<{ issue: CoordinatedIssue; blockedBy: string[] }> = [];

    for (const issue of allIssues) {
      if (issue.status !== 'open') continue;

      const blockingDeps = allDependencies.filter(
        (d) => d.issueId === issue.id && d.type === 'blocks'
      );

      const activeBlockers = blockingDeps
        .filter((d) => !completedIds.has(d.dependsOnId))
        .map((d) => d.dependsOnId);

      if (activeBlockers.length > 0) {
        blockedIssues.push({ issue, blockedBy: activeBlockers });
      }
    }

    return blockedIssues;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Graph Analysis
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get issues that unblock the most other issues when completed.
   * These are high-impact bottlenecks.
   */
  async getBottlenecks(limit = 5): Promise<
    Array<{ issue: CoordinatedIssue; unblocks: number }>
  > {
    const allIssues = await this.storage.getAllIssues();
    const allDependencies = await this.storage.getAllDependencies();

    const openIssueIds = new Set(
      allIssues.filter((i) => i.status === 'open').map((i) => i.id)
    );

    const impactMap = new Map<string, number>();

    // Count how many open issues each open issue blocks
    for (const dep of allDependencies) {
      if (dep.type !== 'blocks') continue;
      if (!openIssueIds.has(dep.dependsOnId)) continue;
      if (!openIssueIds.has(dep.issueId)) continue;

      const current = impactMap.get(dep.dependsOnId) || 0;
      impactMap.set(dep.dependsOnId, current + 1);
    }

    const bottlenecks: Array<{ issue: CoordinatedIssue; unblocks: number }> = [];

    for (const [issueId, unblocks] of impactMap.entries()) {
      const issue = allIssues.find((i) => i.id === issueId);
      if (issue) {
        bottlenecks.push({ issue, unblocks });
      }
    }

    return bottlenecks
      .sort((a, b) => b.unblocks - a.unblocks)
      .slice(0, limit);
  }

  /**
   * Calculate critical path through the dependency graph.
   * Returns issues in order of execution for fastest completion.
   */
  async getCriticalPath(): Promise<CoordinatedIssue[]> {
    const allIssues = await this.storage.getAllIssues();
    const allDependencies = await this.storage.getAllDependencies();

    const openIssues = allIssues.filter((i) => i.status === 'open');
    const issueMap = new Map(openIssues.map((i) => [i.id, i]));

    // Build adjacency list for blocking dependencies
    const blockedBy = new Map<string, Set<string>>();
    for (const issue of openIssues) {
      blockedBy.set(issue.id, new Set());
    }

    for (const dep of allDependencies) {
      if (dep.type !== 'blocks') continue;
      if (!issueMap.has(dep.issueId)) continue;
      if (!issueMap.has(dep.dependsOnId)) continue;

      blockedBy.get(dep.issueId)?.add(dep.dependsOnId);
    }

    // Topological sort using Kahn's algorithm
    const inDegree = new Map<string, number>();
    for (const issue of openIssues) {
      inDegree.set(issue.id, blockedBy.get(issue.id)?.size || 0);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const sorted: CoordinatedIssue[] = [];

    while (queue.length > 0) {
      // Sort by priority to handle ties
      queue.sort((a, b) => {
        const issueA = issueMap.get(a)!;
        const issueB = issueMap.get(b)!;
        return issueB.priority - issueA.priority;
      });

      const id = queue.shift()!;
      const issue = issueMap.get(id);
      if (issue) {
        sorted.push(issue);
      }

      // Find issues that this one blocks
      for (const dep of allDependencies) {
        if (dep.type !== 'blocks') continue;
        if (dep.dependsOnId !== id) continue;
        if (!issueMap.has(dep.issueId)) continue;

        const newDegree = (inDegree.get(dep.issueId) || 1) - 1;
        inDegree.set(dep.issueId, newDegree);

        if (newDegree === 0) {
          queue.push(dep.issueId);
        }
      }
    }

    return sorted;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * When an any_of dependency completes successfully,
   * cancel other alternatives that share the same goal.
   */
  private async cancelSpeculativeAlternatives(
    completedIssueId: string
  ): Promise<void> {
    const allDependencies = await this.storage.getAllDependencies();

    // Find any_of dependencies where this issue is a participant
    const anyOfDeps = allDependencies.filter(
      (d) => d.type === 'any_of' && d.issueId === completedIssueId
    );

    for (const dep of anyOfDeps) {
      // Find other issues with the same any_of target
      const alternatives = allDependencies.filter(
        (d) =>
          d.type === 'any_of' &&
          d.dependsOnId === dep.dependsOnId &&
          d.issueId !== completedIssueId
      );

      for (const alt of alternatives) {
        const issue = await this.storage.getIssue(alt.issueId);
        if (issue && issue.status === 'open') {
          await this.updateIssueStatus(alt.issueId, 'cancelled');
          await this.storage.saveOutcome({
            issueId: alt.issueId,
            outcome: 'cancelled',
            summary: `Cancelled: alternative ${completedIssueId} completed first`,
            agentId: 'system',
            completedAt: new Date().toISOString(),
          });
        }
      }
    }
  }
}
