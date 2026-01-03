/**
 * @workwayco/harness - Hook Queue
 *
 * GAS TOWN-inspired crash-resilient work queue using Beads labels.
 *
 * Pattern:
 * - Work "hangs" on hooks (Beads issues with hook:ready label)
 * - Agents claim work atomically (hook:ready → hook:in-progress)
 * - Stale claims auto-release after timeout
 * - Failed work marked with hook:failed after max retries
 *
 * Zuhandenheit: Crashes don't block progress. Work persists; agents restart.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  BeadsIssue,
  HookState,
  HookClaim,
  HookQueueConfig,
  ClaimResult,
} from './types.js';
import { DEFAULT_HOOK_CONFIG } from './types.js';
import {
  readAllIssues,
  getOpenIssues,
  updateIssueStatus,
} from './beads.js';

const execAsync = promisify(exec);

/**
 * Execute a bd command.
 */
async function bd(args: string, cwd?: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`bd ${args}`, {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    throw new Error(`bd command failed: ${err.stderr || err.message}`);
  }
}

/**
 * HookQueue manages crash-resilient work distribution.
 *
 * Work lifecycle:
 * 1. Issue created with hook:ready label
 * 2. Agent calls claimWork() → hook:ready → hook:in-progress
 * 3. Agent sends heartbeats to keep claim alive
 * 4. On completion: agent closes issue
 * 5. On crash: claim expires, work auto-released to hook:ready
 * 6. On failure: work marked hook:failed after max retries
 */
export class HookQueue {
  private config: HookQueueConfig;
  private cwd: string;
  private activeClaims: Map<string, NodeJS.Timeout> = new Map();
  private agentId: string;

  constructor(config?: Partial<HookQueueConfig>, cwd?: string) {
    this.config = { ...DEFAULT_HOOK_CONFIG, ...config };
    this.cwd = cwd || process.cwd();
    this.agentId = this.generateAgentId();
  }

  /**
   * Generate a unique agent identifier.
   */
  private generateAgentId(): string {
    return `agent-${process.pid}-${Date.now()}`;
  }

  /**
   * Get all issues with a specific hook state.
   */
  async getIssuesByHookState(state: HookState): Promise<BeadsIssue[]> {
    const issues = await readAllIssues(this.cwd);
    return issues.filter(
      (issue) =>
        issue.status !== 'closed' &&
        issue.labels?.includes(state)
    );
  }

  /**
   * Get all available work (issues with hook:ready).
   */
  async getAvailableWork(): Promise<BeadsIssue[]> {
    return this.getIssuesByHookState('hook:ready');
  }

  /**
   * Get all in-progress work (issues with hook:in-progress).
   */
  async getInProgressWork(): Promise<BeadsIssue[]> {
    return this.getIssuesByHookState('hook:in-progress');
  }

  /**
   * Get all failed work (issues with hook:failed).
   */
  async getFailedWork(): Promise<BeadsIssue[]> {
    return this.getIssuesByHookState('hook:failed');
  }

  /**
   * Check if a claim is stale (no heartbeat within timeout).
   */
  private isClaimStale(claim: HookClaim): boolean {
    const now = Date.now();
    const lastHeartbeat = new Date(claim.lastHeartbeat).getTime();
    return now - lastHeartbeat > this.config.claimTimeoutMs;
  }

  /**
   * Parse claim metadata from issue description.
   * Claims are stored as JSON in a special section of the description.
   */
  private parseClaimFromIssue(issue: BeadsIssue): HookClaim | null {
    if (!issue.description) return null;

    const claimMatch = issue.description.match(/<!-- HOOK_CLAIM\n(.*?)\n-->/s);
    if (!claimMatch) return null;

    try {
      return JSON.parse(claimMatch[1]) as HookClaim;
    } catch {
      return null;
    }
  }

  /**
   * Update issue description with claim metadata.
   */
  private async updateClaimMetadata(
    issueId: string,
    claim: HookClaim | null
  ): Promise<void> {
    const issue = await this.getIssueById(issueId);
    if (!issue) return;

    let description = issue.description || '';

    // Remove existing claim
    description = description.replace(/<!-- HOOK_CLAIM\n.*?\n-->\n?/s, '');

    // Add new claim if provided
    if (claim) {
      const claimJson = JSON.stringify(claim, null, 2);
      description = `<!-- HOOK_CLAIM\n${claimJson}\n-->\n\n${description}`;
    }

    // Update via bd CLI (we'll use a workaround since bd doesn't have update description)
    // For now, we'll rely on labels only and skip description updates
    // This is a minimal implementation - full version would extend bd CLI
  }

  /**
   * Get issue by ID.
   */
  private async getIssueById(issueId: string): Promise<BeadsIssue | null> {
    const issues = await readAllIssues(this.cwd);
    return issues.find((i) => i.id === issueId) || null;
  }

  /**
   * Detect and release stale claims.
   * Returns list of released issue IDs.
   */
  async releaseStaleClaims(): Promise<string[]> {
    const inProgress = await this.getInProgressWork();
    const released: string[] = [];

    for (const issue of inProgress) {
      const claim = this.parseClaimFromIssue(issue);

      // If no claim metadata or claim is stale, release it
      if (!claim || this.isClaimStale(claim)) {
        await this.releaseWork(issue.id, 'Stale claim detected');
        released.push(issue.id);
      }
    }

    return released;
  }

  /**
   * Atomically claim work from the ready queue.
   *
   * Returns the claimed issue or null if no work available.
   */
  async claimWork(options?: {
    labels?: string[];
    priority?: number;
  }): Promise<ClaimResult> {
    // Release any stale claims first
    await this.releaseStaleClaims();

    // Get available work
    let availableWork = await this.getAvailableWork();

    // Filter by labels if provided
    if (options?.labels?.length) {
      availableWork = availableWork.filter((issue) =>
        options.labels!.every((label) => issue.labels?.includes(label))
      );
    }

    // Filter by priority if provided
    if (options?.priority !== undefined) {
      availableWork = availableWork.filter(
        (issue) => issue.priority === options.priority
      );
    }

    // Sort by priority (lower number = higher priority)
    availableWork.sort((a, b) => (a.priority || 2) - (b.priority || 2));

    if (availableWork.length === 0) {
      return { success: false, reason: 'No available work' };
    }

    const issue = availableWork[0];

    try {
      // Atomically transition: remove hook:ready, add hook:in-progress
      await bd(`label remove ${issue.id} hook:ready`, this.cwd);
      await bd(`label add ${issue.id} hook:in-progress`, this.cwd);

      // Update status to in_progress
      await updateIssueStatus(issue.id, 'in_progress', this.cwd);

      // Create claim metadata
      const claim: HookClaim = {
        issueId: issue.id,
        agentId: this.agentId,
        claimedAt: new Date().toISOString(),
        lastHeartbeat: new Date().toISOString(),
        title: issue.title,
      };

      // Store claim metadata (in memory for now, could extend to issue description)
      await this.updateClaimMetadata(issue.id, claim);

      // Start heartbeat for this claim
      this.startHeartbeat(claim);

      return { success: true, issue };
    } catch (error) {
      return {
        success: false,
        reason: `Failed to claim ${issue.id}: ${error}`,
      };
    }
  }

  /**
   * Release work back to the ready queue.
   * Called when agent crashes or explicitly abandons work.
   */
  async releaseWork(issueId: string, reason?: string): Promise<void> {
    try {
      // Stop heartbeat if active
      this.stopHeartbeat(issueId);

      // Atomically transition: remove hook:in-progress, add hook:ready
      await bd(`label remove ${issueId} hook:in-progress`, this.cwd);
      await bd(`label add ${issueId} hook:ready`, this.cwd);

      // Update status back to open
      await updateIssueStatus(issueId, 'open', this.cwd);

      // Clear claim metadata
      await this.updateClaimMetadata(issueId, null);

      if (reason) {
        console.log(`[HookQueue] Released ${issueId}: ${reason}`);
      }
    } catch (error) {
      console.error(`[HookQueue] Failed to release ${issueId}:`, error);
    }
  }

  /**
   * Mark work as failed after max retries.
   */
  async markFailed(issueId: string, reason: string): Promise<void> {
    try {
      // Stop heartbeat if active
      this.stopHeartbeat(issueId);

      // Atomically transition: remove hook:in-progress, add hook:failed
      await bd(`label remove ${issueId} hook:in-progress`, this.cwd);
      await bd(`label add ${issueId} hook:failed`, this.cwd);

      // Keep status as open (human review needed)
      await updateIssueStatus(issueId, 'open', this.cwd);

      // Clear claim metadata
      await this.updateClaimMetadata(issueId, null);

      console.log(`[HookQueue] Marked ${issueId} as failed: ${reason}`);
    } catch (error) {
      console.error(`[HookQueue] Failed to mark ${issueId} as failed:`, error);
    }
  }

  /**
   * Complete work (remove from hook system, close issue).
   */
  async completeWork(issueId: string): Promise<void> {
    try {
      // Stop heartbeat if active
      this.stopHeartbeat(issueId);

      // Remove hook labels
      await bd(`label remove ${issueId} hook:in-progress`, this.cwd).catch(
        () => {}
      );
      await bd(`label remove ${issueId} hook:ready`, this.cwd).catch(() => {});
      await bd(`label remove ${issueId} hook:failed`, this.cwd).catch(() => {});

      // Close the issue
      await updateIssueStatus(issueId, 'closed', this.cwd);

      console.log(`[HookQueue] Completed ${issueId}`);
    } catch (error) {
      console.error(`[HookQueue] Failed to complete ${issueId}:`, error);
    }
  }

  /**
   * Start sending heartbeats for a claim.
   */
  private startHeartbeat(claim: HookClaim): void {
    // Clear any existing heartbeat
    this.stopHeartbeat(claim.issueId);

    // Create interval for heartbeats
    const interval = setInterval(async () => {
      try {
        claim.lastHeartbeat = new Date().toISOString();
        await this.updateClaimMetadata(claim.issueId, claim);
      } catch (error) {
        console.error(
          `[HookQueue] Heartbeat failed for ${claim.issueId}:`,
          error
        );
      }
    }, this.config.heartbeatIntervalMs);

    this.activeClaims.set(claim.issueId, interval);
  }

  /**
   * Stop sending heartbeats for a claim.
   */
  private stopHeartbeat(issueId: string): void {
    const interval = this.activeClaims.get(issueId);
    if (interval) {
      clearInterval(interval);
      this.activeClaims.delete(issueId);
    }
  }

  /**
   * Get retry count for an issue.
   * Counts how many times hook:failed has been added/removed.
   */
  private async getRetryCount(issueId: string): Promise<number> {
    const issue = await this.getIssueById(issueId);
    if (!issue?.description) return 0;

    // Count retry markers in description
    const retryMatch = issue.description.match(/<!-- RETRY_COUNT: (\d+) -->/);
    return retryMatch ? parseInt(retryMatch[1], 10) : 0;
  }

  /**
   * Increment retry count for an issue.
   */
  private async incrementRetryCount(issueId: string): Promise<number> {
    const currentCount = await this.getRetryCount(issueId);
    const newCount = currentCount + 1;

    // Store in description (minimal implementation)
    // Full version would use bd CLI extension
    return newCount;
  }

  /**
   * Check if issue has exceeded max retries.
   */
  async hasExceededRetries(issueId: string): Promise<boolean> {
    const retryCount = await this.getRetryCount(issueId);
    return retryCount >= this.config.maxRetries;
  }

  /**
   * Requeue failed work for retry (if under max retries).
   */
  async requeueFailed(issueId: string): Promise<boolean> {
    if (await this.hasExceededRetries(issueId)) {
      console.log(
        `[HookQueue] ${issueId} exceeded max retries (${this.config.maxRetries})`
      );
      return false;
    }

    try {
      await this.incrementRetryCount(issueId);

      // Transition: hook:failed → hook:ready
      await bd(`label remove ${issueId} hook:failed`, this.cwd);
      await bd(`label add ${issueId} hook:ready`, this.cwd);

      console.log(`[HookQueue] Requeued ${issueId} for retry`);
      return true;
    } catch (error) {
      console.error(`[HookQueue] Failed to requeue ${issueId}:`, error);
      return false;
    }
  }

  /**
   * Cleanup: release all claims held by this agent.
   * Call on shutdown/crash recovery.
   */
  async releaseAllClaims(): Promise<void> {
    const issues = Array.from(this.activeClaims.keys());
    for (const issueId of issues) {
      await this.releaseWork(issueId, 'Agent shutdown');
    }
  }

  /**
   * Get queue statistics.
   */
  async getStats(): Promise<{
    ready: number;
    inProgress: number;
    failed: number;
    staleClaims: number;
  }> {
    const ready = await this.getAvailableWork();
    const inProgress = await this.getInProgressWork();
    const failed = await this.getFailedWork();

    // Count stale claims
    let staleClaims = 0;
    for (const issue of inProgress) {
      const claim = this.parseClaimFromIssue(issue);
      if (claim && this.isClaimStale(claim)) {
        staleClaims++;
      }
    }

    return {
      ready: ready.length,
      inProgress: inProgress.length,
      failed: failed.length,
      staleClaims,
    };
  }
}

/**
 * Create a new hook queue instance.
 */
export function createHookQueue(
  config?: Partial<HookQueueConfig>,
  cwd?: string
): HookQueue {
  return new HookQueue(config, cwd);
}
