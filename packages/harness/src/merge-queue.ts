/**
 * @workwayco/harness
 *
 * Merge Queue (Refinery Pattern from GAS TOWN)
 *
 * Coordinates concurrent worker commits to prevent conflicts.
 * Validates commits before merge, auto-resolves simple conflicts,
 * and serializes merges to main branch.
 *
 * Philosophy:
 * - Workers commit to their branches independently
 * - MergeQueue validates before allowing merge to main
 * - Non-overlapping file changes → auto-merge
 * - Overlapping file changes → queue for manual resolution
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  MergeRequest,
  MergeResult,
  MergeConflictType,
  MergeQueueState,
} from './types.js';

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// Merge Queue Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * MergeQueue coordinates concurrent worker commits.
 *
 * Usage:
 * ```typescript
 * const queue = new MergeQueue('/path/to/repo');
 *
 * // Worker 1 requests merge
 * const request1 = await queue.requestMerge({
 *   workerId: 'worker-1',
 *   issueId: 'ww-abc',
 *   commitHash: 'abc123',
 *   filesModified: ['src/foo.ts'],
 *   requestedAt: new Date().toISOString(),
 * });
 *
 * if (request1.allowed) {
 *   await queue.completeMerge(request1);
 * }
 * ```
 */
export class MergeQueue {
  private state: MergeQueueState;
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.state = {
      pending: [],
      merging: null,
      completed: [],
      failed: [],
    };
  }

  /**
   * Request a merge for a worker commit.
   * Validates against currently merging and pending requests.
   */
  async requestMerge(request: MergeRequest): Promise<MergeResult> {
    // Check if this worker already has a pending request or is currently merging
    const existingPending = this.state.pending.find((r) => r.workerId === request.workerId);
    const isCurrentlyMerging = this.state.merging?.workerId === request.workerId;

    if (existingPending || isCurrentlyMerging) {
      return {
        allowed: false,
        conflictType: 'none',
        conflictingFiles: [],
        conflictsWith: [],
        reason: `Worker ${request.workerId} already has a pending merge request`,
        autoMergeable: false,
      };
    }

    // Check if currently merging
    if (this.state.merging) {
      return this.validateAgainstMerging(request);
    }

    // No merge in progress - check against pending requests
    const conflictResult = this.detectConflicts(request);
    if (conflictResult.conflictType !== 'none') {
      // Has conflicts - queue for later
      this.state.pending.push(request);
      return conflictResult;
    }

    // No conflicts - allow immediate merge
    this.state.merging = request;
    return {
      allowed: true,
      conflictType: 'none',
      conflictingFiles: [],
      conflictsWith: [],
      reason: 'No conflicts detected - merge allowed',
      autoMergeable: true,
    };
  }

  /**
   * Validate a merge request against the currently merging request and pending queue.
   */
  private validateAgainstMerging(request: MergeRequest): MergeResult {
    if (!this.state.merging) {
      throw new Error('No merge in progress');
    }

    // Check against currently merging request
    const overlappingWithMerging = request.filesModified.filter((file) =>
      this.state.merging!.filesModified.includes(file)
    );

    // Also check against pending requests
    const pendingConflicts = this.detectConflicts(request);

    // Determine overall conflict status
    let conflictType: 'none' | 'overlapping_files' = 'none';
    const conflictingFiles: string[] = [];
    const conflictsWith: string[] = [];

    if (overlappingWithMerging.length > 0) {
      conflictType = 'overlapping_files';
      conflictingFiles.push(...overlappingWithMerging);
      conflictsWith.push(this.state.merging.workerId);
    }

    if (pendingConflicts.conflictType === 'overlapping_files') {
      conflictType = 'overlapping_files';
      conflictingFiles.push(...pendingConflicts.conflictingFiles);
      conflictsWith.push(...pendingConflicts.conflictsWith);
    }

    // Queue the request
    this.state.pending.push(request);

    if (conflictType === 'overlapping_files') {
      return {
        allowed: false,
        conflictType: 'overlapping_files',
        conflictingFiles: [...new Set(conflictingFiles)],
        conflictsWith: [...new Set(conflictsWith)],
        reason: `Conflicts with ${conflictsWith.length} request(s)`,
        autoMergeable: false,
      };
    }

    return {
      allowed: false,
      conflictType: 'none',
      conflictingFiles: [],
      conflictsWith: [],
      reason: 'Queued behind current merge (no conflicts)',
      autoMergeable: true,
    };
  }

  /**
   * Detect conflicts between a request and pending requests.
   */
  private detectConflicts(request: MergeRequest): MergeResult {
    const conflictingRequests: string[] = [];
    const conflictingFiles: string[] = [];

    for (const pending of this.state.pending) {
      const overlap = request.filesModified.filter((file) =>
        pending.filesModified.includes(file)
      );

      if (overlap.length > 0) {
        conflictingRequests.push(pending.workerId);
        conflictingFiles.push(...overlap);
      }
    }

    if (conflictingRequests.length > 0) {
      return {
        allowed: false,
        conflictType: 'overlapping_files',
        conflictingFiles: [...new Set(conflictingFiles)],
        conflictsWith: conflictingRequests,
        reason: `Conflicts with ${conflictingRequests.length} pending request(s)`,
        autoMergeable: false,
      };
    }

    return {
      allowed: true,
      conflictType: 'none',
      conflictingFiles: [],
      conflictsWith: [],
      reason: 'No conflicts detected',
      autoMergeable: true,
    };
  }

  /**
   * Complete a merge and release the lock.
   * Processes next queued request if available.
   */
  async completeMerge(request: MergeRequest): Promise<void> {
    if (!this.state.merging || this.state.merging.workerId !== request.workerId) {
      throw new Error(`Cannot complete merge - worker ${request.workerId} is not currently merging`);
    }

    // Move from merging to completed
    this.state.completed.push(this.state.merging);
    this.state.merging = null;

    // Process next queued request
    await this.processNextInQueue();
  }

  /**
   * Mark a merge as failed and release the lock.
   */
  async failMerge(request: MergeRequest, reason: string): Promise<void> {
    if (!this.state.merging || this.state.merging.workerId !== request.workerId) {
      throw new Error(`Cannot fail merge - worker ${request.workerId} is not currently merging`);
    }

    // Move from merging to failed
    this.state.failed.push({
      request: this.state.merging,
      reason,
    });
    this.state.merging = null;

    // Process next queued request
    await this.processNextInQueue();
  }

  /**
   * Process the next request in the queue.
   * Promotes to merging if no conflicts with EARLIER requests in queue.
   * FIFO order: earlier requests have priority.
   */
  private async processNextInQueue(): Promise<void> {
    if (this.state.pending.length === 0 || this.state.merging !== null) {
      return;
    }

    // Process in FIFO order - check each request against only earlier requests
    for (let i = 0; i < this.state.pending.length; i++) {
      const candidate = this.state.pending[i];
      const conflicts = this.detectConflictsForCandidate(candidate, i);

      if (conflicts.length === 0) {
        // No conflicts with earlier requests - promote to merging
        this.state.pending.splice(i, 1);
        this.state.merging = candidate;
        return;
      }
    }

    // All pending requests have conflicts with earlier requests - manual resolution needed
  }

  /**
   * Check if a candidate request conflicts with EARLIER pending requests.
   * Only checks requests that come before the candidate in the queue (FIFO).
   */
  private detectConflictsForCandidate(candidate: MergeRequest, candidateIndex: number): string[] {
    const conflicts: string[] = [];

    // Only check requests that come BEFORE this candidate (earlier in queue)
    for (let i = 0; i < candidateIndex; i++) {
      const other = this.state.pending[i];
      const overlap = candidate.filesModified.filter((file) =>
        other.filesModified.includes(file)
      );

      if (overlap.length > 0) {
        conflicts.push(other.workerId);
      }
    }

    return conflicts;
  }

  /**
   * Get the current queue state.
   */
  getState(): MergeQueueState {
    return { ...this.state };
  }

  /**
   * Get files modified in a commit.
   */
  async getModifiedFiles(commitHash: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        `git diff-tree --no-commit-id --name-only -r ${commitHash}`,
        { cwd: this.cwd }
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error) {
      throw new Error(`Failed to get modified files for ${commitHash}: ${error}`);
    }
  }

  /**
   * Check if a merge would succeed (dry run).
   */
  async canMerge(branchName: string, targetBranch = 'main'): Promise<{
    canMerge: boolean;
    conflictType: MergeConflictType;
    conflictingFiles: string[];
  }> {
    try {
      // Fetch latest
      await execAsync('git fetch origin', { cwd: this.cwd });

      // Test merge without committing
      const { stdout, stderr } = await execAsync(
        `git merge-tree $(git merge-base ${targetBranch} ${branchName}) ${targetBranch} ${branchName}`,
        { cwd: this.cwd }
      );

      // If output is empty or only whitespace, no conflicts
      if (!stdout.trim()) {
        return {
          canMerge: true,
          conflictType: 'none',
          conflictingFiles: [],
        };
      }

      // Parse conflict markers
      const hasConflicts = stdout.includes('<<<<<<<') || stderr.includes('conflict');

      if (hasConflicts) {
        // Extract conflicting file paths
        const conflicts = stdout.match(/(?<=\n)[\w/.-]+(?=\n)/g) || [];
        return {
          canMerge: false,
          conflictType: 'complex',
          conflictingFiles: [...new Set(conflicts)],
        };
      }

      return {
        canMerge: true,
        conflictType: 'none',
        conflictingFiles: [],
      };
    } catch (error) {
      // Merge test failed - likely has conflicts
      return {
        canMerge: false,
        conflictType: 'complex',
        conflictingFiles: [],
      };
    }
  }

  /**
   * Perform the actual merge to target branch.
   */
  async performMerge(
    request: MergeRequest,
    targetBranch = 'main'
  ): Promise<{ success: boolean; error?: string }> {
    if (!request.branchName) {
      return {
        success: false,
        error: 'Branch name required for merge',
      };
    }

    try {
      // Ensure we're on target branch
      await execAsync(`git checkout ${targetBranch}`, { cwd: this.cwd });

      // Pull latest
      await execAsync(`git pull origin ${targetBranch}`, { cwd: this.cwd });

      // Check if merge is possible
      const mergeCheck = await this.canMerge(request.branchName, targetBranch);
      if (!mergeCheck.canMerge) {
        return {
          success: false,
          error: `Merge conflicts detected in: ${mergeCheck.conflictingFiles.join(', ')}`,
        };
      }

      // Perform merge
      await execAsync(`git merge --no-ff ${request.branchName} -m "Merge ${request.issueId}: ${request.workerId}"`, {
        cwd: this.cwd,
      });

      // Push to remote
      await execAsync(`git push origin ${targetBranch}`, { cwd: this.cwd });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Merge failed: ${error}`,
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory & Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new merge queue for a repository.
 */
export function createMergeQueue(cwd: string): MergeQueue {
  return new MergeQueue(cwd);
}

/**
 * Create a merge request from session result.
 */
export function createMergeRequest(
  workerId: string,
  issueId: string,
  commitHash: string,
  filesModified: string[],
  branchName?: string
): MergeRequest {
  return {
    workerId,
    issueId,
    commitHash,
    filesModified,
    branchName,
    requestedAt: new Date().toISOString(),
  };
}
