/**
 * @workwayco/harness - Convoy System
 *
 * GAS TOWN Pattern: Groups related work across multiple projects.
 * Convoy labels (e.g., `convoy:<name>`) group related issues across repos.
 * Progress tracked at convoy level (% complete across all convoy issues).
 *
 * Key principles:
 * - Lightweight grouping via Beads labels (no new data structures)
 * - Cross-repo awareness (works with ww-* and wwp-* prefixes)
 * - Convoy-level progress tracking (% complete)
 * - Integrates with Coordinator for convoy-aware work distribution
 *
 * Zuhandenheit: Convoys group work conceptually but recede during execution.
 * You think "complete the auth refactor" not "manage convoy convoy:auth-refactor".
 */

import type { BeadsIssue } from './types.js';
import { execSync } from 'child_process';
import chalk from 'chalk';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convoy metadata for grouping related work.
 */
export interface Convoy {
  /** Convoy name (from convoy:<name> label) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Description of the convoy's purpose */
  description: string;
  /** Total issues in convoy */
  totalIssues: number;
  /** Completed issues */
  completedIssues: number;
  /** In-progress issues */
  inProgressIssues: number;
  /** Failed issues */
  failedIssues: number;
  /** Progress percentage (0-100) */
  progress: number;
  /** Issue IDs in convoy */
  issueIds: string[];
  /** Repository paths participating in convoy */
  repos: string[];
  /** Creation timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Convoy creation options.
 */
export interface ConvoyCreateOptions {
  /** Convoy name (will be prefixed with convoy:) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Description of the convoy's purpose */
  description?: string;
  /** Initial issue IDs to add to convoy */
  issueIds?: string[];
  /** Working directory */
  cwd?: string;
}

/**
 * Convoy progress snapshot.
 */
export interface ConvoyProgress {
  /** Convoy name */
  name: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Total issues */
  total: number;
  /** Completed issues */
  completed: number;
  /** In-progress issues */
  inProgress: number;
  /** Failed issues */
  failed: number;
  /** Timestamp */
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convoy Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convoy system for cross-project work grouping.
 *
 * Groups related issues across repos using convoy:<name> labels.
 * Provides convoy-level progress tracking and coordination.
 */
export class ConvoySystem {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Create a new convoy.
   * Adds convoy:<name> label to specified issues.
   */
  async createConvoy(options: ConvoyCreateOptions): Promise<Convoy> {
    const {
      name,
      title,
      description = '',
      issueIds = [],
      cwd = this.cwd,
    } = options;

    const convoyLabel = `convoy:${name}`;
    const timestamp = new Date().toISOString();

    // Add convoy label to initial issues
    for (const issueId of issueIds) {
      try {
        execSync(`bd label add ${issueId} "${convoyLabel}"`, {
          cwd,
          stdio: 'pipe',
          encoding: 'utf-8',
        });
      } catch (error) {
        console.warn(chalk.yellow(`Warning: Failed to add convoy label to ${issueId}`));
      }
    }

    // Store convoy metadata as a special issue (type: convoy)
    const convoyIssueId = this.createConvoyMetadataIssue(
      name,
      title,
      description,
      cwd
    );

    console.log(chalk.green(`✅ Created convoy: ${convoyLabel}`));
    console.log(chalk.white(`   Convoy ID: ${convoyIssueId}`));
    console.log(chalk.white(`   Initial issues: ${issueIds.length}`));

    return this.getConvoy(name, cwd);
  }

  /**
   * Get convoy by name.
   * Scans all issues with convoy:<name> label.
   */
  async getConvoy(name: string, cwd: string = this.cwd): Promise<Convoy> {
    const convoyLabel = `convoy:${name}`;

    // Get all issues with convoy label
    const issues = this.getIssuesWithLabel(convoyLabel, cwd);

    // Separate metadata issue from work issues
    const metadataIssue = issues.find(i => i.issue_type === 'convoy');
    const workIssues = issues.filter(i => i.issue_type !== 'convoy');

    // Calculate stats
    const totalIssues = workIssues.length;
    const completedIssues = workIssues.filter(i => i.status === 'closed').length;
    const inProgressIssues = workIssues.filter(i => i.status === 'in_progress').length;
    const failedIssues = workIssues.filter(i => i.labels?.includes('hook:failed')).length;
    const progress = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;

    // Extract repos from issue IDs (ww-* vs wwp-*)
    const repos = this.extractReposFromIssues(workIssues);

    return {
      name,
      title: metadataIssue?.title || name,
      description: metadataIssue?.description || '',
      totalIssues,
      completedIssues,
      inProgressIssues,
      failedIssues,
      progress,
      issueIds: workIssues.map(i => i.id),
      repos,
      createdAt: metadataIssue?.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Add issue to convoy.
   */
  async addToConvoy(convoyName: string, issueId: string, cwd: string = this.cwd): Promise<void> {
    const convoyLabel = `convoy:${convoyName}`;

    try {
      execSync(`bd label add ${issueId} "${convoyLabel}"`, {
        cwd,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      console.log(chalk.green(`✅ Added ${issueId} to convoy:${convoyName}`));
    } catch (error) {
      throw new Error(`Failed to add ${issueId} to convoy: ${error}`);
    }
  }

  /**
   * Remove issue from convoy.
   */
  async removeFromConvoy(convoyName: string, issueId: string, cwd: string = this.cwd): Promise<void> {
    const convoyLabel = `convoy:${convoyName}`;

    try {
      execSync(`bd label remove ${issueId} "${convoyLabel}"`, {
        cwd,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      console.log(chalk.green(`✅ Removed ${issueId} from convoy:${convoyName}`));
    } catch (error) {
      throw new Error(`Failed to remove ${issueId} from convoy: ${error}`);
    }
  }

  /**
   * List all convoys in current repo.
   */
  async listConvoys(cwd: string = this.cwd): Promise<Convoy[]> {
    // Get all convoy metadata issues
    const allIssues = this.getAllIssues(cwd);
    const convoyIssues = allIssues.filter(i => i.issue_type === 'convoy');

    const convoys: Convoy[] = [];
    for (const issue of convoyIssues) {
      // Extract convoy name from labels
      const convoyLabel = issue.labels?.find(l => l.startsWith('convoy:'));
      if (!convoyLabel) continue;

      const name = convoyLabel.replace('convoy:', '');
      const convoy = await this.getConvoy(name, cwd);
      convoys.push(convoy);
    }

    return convoys;
  }

  /**
   * Get convoy progress snapshot.
   */
  async getProgress(convoyName: string, cwd: string = this.cwd): Promise<ConvoyProgress> {
    const convoy = await this.getConvoy(convoyName, cwd);

    return {
      name: convoy.name,
      progress: convoy.progress,
      total: convoy.totalIssues,
      completed: convoy.completedIssues,
      inProgress: convoy.inProgressIssues,
      failed: convoy.failedIssues,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Display convoy status (human-readable).
   */
  async displayConvoy(convoyName: string, cwd: string = this.cwd): Promise<void> {
    const convoy = await this.getConvoy(convoyName, cwd);

    console.log('');
    console.log(chalk.bold.cyan(`🚂 Convoy: ${convoy.name}`));
    console.log(chalk.white(`   ${convoy.title}`));
    if (convoy.description) {
      console.log(chalk.gray(`   ${convoy.description}`));
    }
    console.log('');
    console.log(chalk.white('   Progress:'));
    console.log(chalk.white(`     • Total: ${convoy.totalIssues} issues`));
    console.log(chalk.green(`     • Completed: ${convoy.completedIssues}`));
    console.log(chalk.cyan(`     • In Progress: ${convoy.inProgressIssues}`));
    if (convoy.failedIssues > 0) {
      console.log(chalk.red(`     • Failed: ${convoy.failedIssues}`));
    }
    console.log(chalk.bold(`     • Overall: ${convoy.progress.toFixed(0)}%`));
    console.log('');

    if (convoy.repos.length > 1) {
      console.log(chalk.white('   Repositories:'));
      for (const repo of convoy.repos) {
        console.log(chalk.gray(`     • ${repo}`));
      }
      console.log('');
    }

    // Progress bar
    this.displayProgressBar(convoy.progress);
    console.log('');
  }

  /**
   * Get next issue from convoy (convoy-aware work distribution).
   * Returns highest priority unblocked issue from convoy.
   */
  async getNextIssue(convoyName: string, cwd: string = this.cwd): Promise<BeadsIssue | null> {
    const convoyLabel = `convoy:${convoyName}`;

    try {
      // Use bd ready to get unblocked issues with convoy label
      const output = execSync(`bd ready --label "${convoyLabel}" --json`, {
        cwd,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      const issues: BeadsIssue[] = JSON.parse(output);
      if (issues.length === 0) return null;

      // Sort by priority (lower number = higher priority)
      issues.sort((a, b) => (a.priority || 2) - (b.priority || 2));

      return issues[0];
    } catch (error) {
      return null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Create convoy metadata issue.
   */
  private createConvoyMetadataIssue(
    name: string,
    title: string,
    description: string,
    cwd: string
  ): string {
    const convoyLabel = `convoy:${name}`;

    try {
      const output = execSync(
        `bd create --title="${title}" --type=convoy --label="${convoyLabel}" --json`,
        {
          cwd,
          stdio: 'pipe',
          encoding: 'utf-8',
        }
      );

      const issue = JSON.parse(output);

      // Update description if provided
      if (description) {
        execSync(`bd update ${issue.id} --description="${description}"`, {
          cwd,
          stdio: 'pipe',
          encoding: 'utf-8',
        });
      }

      return issue.id;
    } catch (error) {
      throw new Error(`Failed to create convoy metadata issue: ${error}`);
    }
  }

  /**
   * Get all issues with specific label.
   */
  private getIssuesWithLabel(label: string, cwd: string): BeadsIssue[] {
    try {
      const output = execSync(`bd list --label "${label}" --json`, {
        cwd,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      return JSON.parse(output);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get all issues in repo.
   */
  private getAllIssues(cwd: string): BeadsIssue[] {
    try {
      const output = execSync(`bd list --json`, {
        cwd,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      return JSON.parse(output);
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract repository names from issue IDs.
   * ww-* → Cloudflare, wwp-* → workway-platform
   */
  private extractReposFromIssues(issues: BeadsIssue[]): string[] {
    const repoSet = new Set<string>();

    for (const issue of issues) {
      if (issue.id.startsWith('ww-')) {
        repoSet.add('Cloudflare');
      } else if (issue.id.startsWith('wwp-')) {
        repoSet.add('workway-platform');
      }
    }

    return Array.from(repoSet);
  }

  /**
   * Display progress bar.
   */
  private displayProgressBar(progress: number): void {
    const width = 40;
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    console.log(`   [${bar}] ${progress.toFixed(0)}%`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a convoy system instance.
 */
export function createConvoySystem(cwd: string = process.cwd()): ConvoySystem {
  return new ConvoySystem(cwd);
}

/**
 * Create a convoy (convenience function).
 */
export async function createConvoy(options: ConvoyCreateOptions): Promise<Convoy> {
  const system = createConvoySystem(options.cwd);
  return system.createConvoy(options);
}

/**
 * Get convoy by name (convenience function).
 */
export async function getConvoy(name: string, cwd: string = process.cwd()): Promise<Convoy> {
  const system = createConvoySystem(cwd);
  return system.getConvoy(name, cwd);
}

/**
 * Display convoy status (convenience function).
 */
export async function displayConvoy(name: string, cwd: string = process.cwd()): Promise<void> {
  const system = createConvoySystem(cwd);
  return system.displayConvoy(name, cwd);
}
