/**
 * @workwayco/beads
 *
 * File-based storage for issues.
 * Uses JSONL (JSON Lines) format for append-only operations.
 *
 * Files:
 * - .beads/issues.jsonl  - Source of truth (git-synced)
 * - .beads/deps.jsonl    - Dependency relationships
 * - .beads/config.json   - Project configuration
 */

import { readFile, writeFile, mkdir, access, appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { nanoid } from 'nanoid';
import type {
  Issue,
  IssueStatus,
  IssueType,
  Priority,
  Dependency,
  DependencyType,
  BeadsConfig,
  DEFAULT_CONFIG,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BEADS_DIR = '.beads';
const ISSUES_FILE = 'issues.jsonl';
const DEPS_FILE = 'deps.jsonl';
const CONFIG_FILE = 'config.json';

// ─────────────────────────────────────────────────────────────────────────────
// Store Class
// ─────────────────────────────────────────────────────────────────────────────

export class BeadsStore {
  private readonly root: string;
  private readonly beadsDir: string;

  constructor(root?: string) {
    this.root = root || process.cwd();
    this.beadsDir = join(this.root, BEADS_DIR);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Initialization
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the .beads directory and files.
   */
  async init(config?: Partial<BeadsConfig>): Promise<void> {
    // Create .beads directory
    await mkdir(this.beadsDir, { recursive: true });

    // Create config file
    const fullConfig: BeadsConfig = {
      project: config?.project || this.inferProjectName(),
      default_priority: config?.default_priority ?? 2,
      default_labels: config?.default_labels || [],
    };
    await this.writeConfig(fullConfig);

    // Create empty issues file if it doesn't exist
    const issuesPath = join(this.beadsDir, ISSUES_FILE);
    try {
      await access(issuesPath);
    } catch {
      await writeFile(issuesPath, '');
    }

    // Create empty deps file if it doesn't exist
    const depsPath = join(this.beadsDir, DEPS_FILE);
    try {
      await access(depsPath);
    } catch {
      await writeFile(depsPath, '');
    }

    // Create .gitignore to ignore local cache
    const gitignorePath = join(this.beadsDir, '.gitignore');
    await writeFile(gitignorePath, '# Local cache\nbeads.db\n');
  }

  /**
   * Check if .beads directory exists.
   */
  async isInitialized(): Promise<boolean> {
    try {
      await access(this.beadsDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Infer project name from directory.
   */
  private inferProjectName(): string {
    const parts = this.root.split('/');
    return parts[parts.length - 1] || 'workway';
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Configuration
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Read configuration.
   */
  async getConfig(): Promise<BeadsConfig> {
    const configPath = join(this.beadsDir, CONFIG_FILE);
    try {
      const content = await readFile(configPath, 'utf-8');
      return JSON.parse(content) as BeadsConfig;
    } catch {
      return {
        project: this.inferProjectName(),
        default_priority: 2,
        default_labels: [],
      };
    }
  }

  /**
   * Write configuration.
   */
  async writeConfig(config: BeadsConfig): Promise<void> {
    const configPath = join(this.beadsDir, CONFIG_FILE);
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Issues
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Generate a new issue ID.
   */
  async generateId(): Promise<string> {
    const config = await this.getConfig();
    const shortId = nanoid(6).toLowerCase();
    return `${config.project}-${shortId}`;
  }

  /**
   * Create a new issue.
   */
  async createIssue(options: {
    title: string;
    description?: string;
    type?: IssueType;
    priority?: Priority;
    labels?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Issue> {
    const config = await this.getConfig();
    const now = new Date().toISOString();

    const issue: Issue = {
      id: await this.generateId(),
      title: options.title,
      description: options.description || '',
      status: 'open',
      priority: options.priority ?? config.default_priority,
      issue_type: options.type || 'task',
      labels: [...(options.labels || []), ...config.default_labels],
      created_at: now,
      updated_at: now,
      closed_at: null,
      metadata: options.metadata,
    };

    await this.appendIssue(issue);
    return issue;
  }

  /**
   * Update an existing issue.
   */
  async updateIssue(
    id: string,
    updates: Partial<Pick<Issue, 'title' | 'description' | 'status' | 'priority' | 'issue_type' | 'labels' | 'metadata'>>
  ): Promise<Issue | null> {
    const issues = await this.getAllIssues();
    const index = issues.findIndex((i) => i.id === id);
    if (index === -1) return null;

    const now = new Date().toISOString();
    const updated: Issue = {
      ...issues[index],
      ...updates,
      updated_at: now,
      closed_at: updates.status === 'closed' ? now : issues[index].closed_at,
    };

    issues[index] = updated;
    await this.writeAllIssues(issues);
    return updated;
  }

  /**
   * Close an issue.
   */
  async closeIssue(id: string): Promise<Issue | null> {
    return this.updateIssue(id, { status: 'closed' });
  }

  /**
   * Get a single issue by ID.
   */
  async getIssue(id: string): Promise<Issue | null> {
    const issues = await this.getAllIssues();
    return issues.find((i) => i.id === id) || null;
  }

  /**
   * Get all issues.
   */
  async getAllIssues(): Promise<Issue[]> {
    const issuesPath = join(this.beadsDir, ISSUES_FILE);
    try {
      const content = await readFile(issuesPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line) as Issue);
    } catch {
      return [];
    }
  }

  /**
   * Get open issues.
   */
  async getOpenIssues(): Promise<Issue[]> {
    const issues = await this.getAllIssues();
    return issues.filter((i) => i.status !== 'closed');
  }

  /**
   * Get issues by status.
   */
  async getIssuesByStatus(status: IssueStatus): Promise<Issue[]> {
    const issues = await this.getAllIssues();
    return issues.filter((i) => i.status === status);
  }

  /**
   * Get issues by label.
   */
  async getIssuesByLabel(label: string): Promise<Issue[]> {
    const issues = await this.getAllIssues();
    return issues.filter((i) => i.labels.includes(label));
  }

  /**
   * Append a single issue to the JSONL file.
   */
  private async appendIssue(issue: Issue): Promise<void> {
    const issuesPath = join(this.beadsDir, ISSUES_FILE);
    await appendFile(issuesPath, JSON.stringify(issue) + '\n');
  }

  /**
   * Rewrite all issues (for updates).
   */
  private async writeAllIssues(issues: Issue[]): Promise<void> {
    const issuesPath = join(this.beadsDir, ISSUES_FILE);
    const content = issues.map((i) => JSON.stringify(i)).join('\n') + (issues.length ? '\n' : '');
    await writeFile(issuesPath, content);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Dependencies
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Add a dependency.
   */
  async addDependency(issueId: string, dependsOnId: string, type: DependencyType): Promise<Dependency> {
    const dep: Dependency = {
      issue_id: issueId,
      depends_on_id: dependsOnId,
      type,
      created_at: new Date().toISOString(),
    };

    const depsPath = join(this.beadsDir, DEPS_FILE);
    await appendFile(depsPath, JSON.stringify(dep) + '\n');
    return dep;
  }

  /**
   * Remove a dependency.
   */
  async removeDependency(issueId: string, dependsOnId: string): Promise<boolean> {
    const deps = await this.getAllDependencies();
    const filtered = deps.filter(
      (d) => !(d.issue_id === issueId && d.depends_on_id === dependsOnId)
    );

    if (filtered.length === deps.length) return false;

    await this.writeAllDependencies(filtered);
    return true;
  }

  /**
   * Get all dependencies.
   */
  async getAllDependencies(): Promise<Dependency[]> {
    const depsPath = join(this.beadsDir, DEPS_FILE);
    try {
      const content = await readFile(depsPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line) as Dependency);
    } catch {
      return [];
    }
  }

  /**
   * Get dependencies for an issue.
   */
  async getDependencies(issueId: string): Promise<Dependency[]> {
    const deps = await this.getAllDependencies();
    return deps.filter((d) => d.issue_id === issueId);
  }

  /**
   * Get issues that depend on a given issue.
   */
  async getDependents(issueId: string): Promise<Dependency[]> {
    const deps = await this.getAllDependencies();
    return deps.filter((d) => d.depends_on_id === issueId);
  }

  /**
   * Rewrite all dependencies.
   */
  private async writeAllDependencies(deps: Dependency[]): Promise<void> {
    const depsPath = join(this.beadsDir, DEPS_FILE);
    const content = deps.map((d) => JSON.stringify(d)).join('\n') + (deps.length ? '\n' : '');
    await writeFile(depsPath, content);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Labels
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Add a label to an issue.
   */
  async addLabel(issueId: string, label: string): Promise<Issue | null> {
    const issue = await this.getIssue(issueId);
    if (!issue) return null;
    if (issue.labels.includes(label)) return issue;

    return this.updateIssue(issueId, { labels: [...issue.labels, label] });
  }

  /**
   * Remove a label from an issue.
   */
  async removeLabel(issueId: string, label: string): Promise<Issue | null> {
    const issue = await this.getIssue(issueId);
    if (!issue) return null;
    if (!issue.labels.includes(label)) return issue;

    return this.updateIssue(issueId, { labels: issue.labels.filter((l) => l !== label) });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Queries
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get ready issues (open, not blocked).
   */
  async getReadyIssues(): Promise<Issue[]> {
    const issues = await this.getOpenIssues();
    const deps = await this.getAllDependencies();

    // Build set of blocked issue IDs
    const blockedIds = new Set<string>();
    for (const dep of deps) {
      if (dep.type === 'blocks') {
        // The issue is blocked if its dependency is not closed
        const depIssue = issues.find((i) => i.id === dep.depends_on_id);
        if (depIssue && depIssue.status !== 'closed') {
          blockedIds.add(dep.issue_id);
        }
      }
    }

    // Filter to unblocked open issues, sorted by priority
    return issues
      .filter((i) => !blockedIds.has(i.id))
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get blocked issues with their blockers.
   */
  async getBlockedIssues(): Promise<Array<{ issue: Issue; blockedBy: Issue[] }>> {
    const issues = await this.getOpenIssues();
    const allIssues = await this.getAllIssues();
    const deps = await this.getAllDependencies();

    const result: Array<{ issue: Issue; blockedBy: Issue[] }> = [];

    for (const issue of issues) {
      const issueDeps = deps.filter((d) => d.issue_id === issue.id && d.type === 'blocks');
      const blockers: Issue[] = [];

      for (const dep of issueDeps) {
        const blocker = allIssues.find((i) => i.id === dep.depends_on_id);
        if (blocker && blocker.status !== 'closed') {
          blockers.push(blocker);
        }
      }

      if (blockers.length > 0) {
        result.push({ issue, blockedBy: blockers });
      }
    }

    return result;
  }

  /**
   * Get progress summary.
   */
  async getProgress(): Promise<{
    total: number;
    open: number;
    in_progress: number;
    closed: number;
    blocked: number;
  }> {
    const issues = await this.getAllIssues();
    const blocked = await this.getBlockedIssues();

    return {
      total: issues.length,
      open: issues.filter((i) => i.status === 'open').length,
      in_progress: issues.filter((i) => i.status === 'in_progress').length,
      closed: issues.filter((i) => i.status === 'closed').length,
      blocked: blocked.length,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Export
// ─────────────────────────────────────────────────────────────────────────────

export const store = new BeadsStore();
