/**
 * @workwayco/harness
 *
 * Tests for MergeQueue (Refinery pattern).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MergeQueue, createMergeQueue, createMergeRequest } from '../merge-queue.js';
import type { MergeRequest } from '../types.js';

describe('MergeQueue', () => {
  let queue: MergeQueue;

  beforeEach(() => {
    queue = createMergeQueue('/tmp/test-repo');
  });

  describe('createMergeRequest', () => {
    it('should create a merge request with all fields', () => {
      const request = createMergeRequest(
        'worker-1',
        'ww-abc',
        'abc123',
        ['src/foo.ts', 'src/bar.ts'],
        'feature/ww-abc'
      );

      expect(request.workerId).toBe('worker-1');
      expect(request.issueId).toBe('ww-abc');
      expect(request.commitHash).toBe('abc123');
      expect(request.filesModified).toEqual(['src/foo.ts', 'src/bar.ts']);
      expect(request.branchName).toBe('feature/ww-abc');
      expect(request.requestedAt).toBeTruthy();
    });
  });

  describe('requestMerge', () => {
    it('should allow merge when queue is empty', async () => {
      const request = createMergeRequest(
        'worker-1',
        'ww-abc',
        'abc123',
        ['src/foo.ts']
      );

      const result = await queue.requestMerge(request);

      expect(result.allowed).toBe(true);
      expect(result.conflictType).toBe('none');
      expect(result.conflictingFiles).toEqual([]);
      expect(result.conflictsWith).toEqual([]);
      expect(result.autoMergeable).toBe(true);

      const state = queue.getState();
      expect(state.merging).toEqual(request);
      expect(state.pending).toEqual([]);
    });

    it('should queue request when another merge is in progress', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);
      const request2 = createMergeRequest('worker-2', 'ww-def', 'def456', ['src/bar.ts']);

      await queue.requestMerge(request1);
      const result2 = await queue.requestMerge(request2);

      expect(result2.allowed).toBe(false);
      expect(result2.conflictType).toBe('none');
      expect(result2.reason).toContain('Queued behind current merge');
      expect(result2.autoMergeable).toBe(true);

      const state = queue.getState();
      expect(state.merging?.workerId).toBe('worker-1');
      expect(state.pending).toHaveLength(1);
      expect(state.pending[0].workerId).toBe('worker-2');
    });

    it('should detect overlapping files with current merge', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts', 'src/shared.ts']);
      const request2 = createMergeRequest('worker-2', 'ww-def', 'def456', ['src/bar.ts', 'src/shared.ts']);

      await queue.requestMerge(request1);
      const result2 = await queue.requestMerge(request2);

      expect(result2.allowed).toBe(false);
      expect(result2.conflictType).toBe('overlapping_files');
      expect(result2.conflictingFiles).toContain('src/shared.ts');
      expect(result2.conflictsWith).toEqual(['worker-1']);
      expect(result2.autoMergeable).toBe(false);

      const state = queue.getState();
      expect(state.pending).toHaveLength(1);
      expect(state.pending[0].workerId).toBe('worker-2');
    });

    it('should detect conflicts with pending requests', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);
      const request2 = createMergeRequest('worker-2', 'ww-def', 'def456', ['src/bar.ts']);
      const request3 = createMergeRequest('worker-3', 'ww-ghi', 'ghi789', ['src/bar.ts', 'src/baz.ts']);

      await queue.requestMerge(request1); // Starts merging
      await queue.requestMerge(request2); // Queued (no conflict)
      const result3 = await queue.requestMerge(request3); // Conflicts with request2

      expect(result3.allowed).toBe(false);
      expect(result3.conflictType).toBe('overlapping_files');
      expect(result3.conflictingFiles).toContain('src/bar.ts');
      expect(result3.conflictsWith).toEqual(['worker-2']);
      expect(result3.autoMergeable).toBe(false);
    });

    it('should reject duplicate merge request from same worker', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);
      const request2 = createMergeRequest('worker-1', 'ww-def', 'def456', ['src/bar.ts']);

      await queue.requestMerge(request1);
      const result2 = await queue.requestMerge(request2);

      expect(result2.allowed).toBe(false);
      expect(result2.reason).toContain('already has a pending merge request');
    });
  });

  describe('completeMerge', () => {
    it('should complete merge and release lock', async () => {
      const request = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);

      await queue.requestMerge(request);
      await queue.completeMerge(request);

      const state = queue.getState();
      expect(state.merging).toBeNull();
      expect(state.completed).toHaveLength(1);
      expect(state.completed[0].workerId).toBe('worker-1');
    });

    it('should process next queued request after completion', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);
      const request2 = createMergeRequest('worker-2', 'ww-def', 'def456', ['src/bar.ts']);

      await queue.requestMerge(request1);
      await queue.requestMerge(request2);

      // Complete first merge
      await queue.completeMerge(request1);

      const state = queue.getState();
      expect(state.merging?.workerId).toBe('worker-2');
      expect(state.pending).toHaveLength(0);
      expect(state.completed).toHaveLength(1);
    });

    it('should skip conflicting requests when processing queue', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);
      const request2 = createMergeRequest('worker-2', 'ww-def', 'def456', ['src/bar.ts']);
      const request3 = createMergeRequest('worker-3', 'ww-ghi', 'ghi789', ['src/bar.ts']); // Conflicts with request2

      await queue.requestMerge(request1);
      await queue.requestMerge(request2);
      await queue.requestMerge(request3);

      // Complete first merge
      await queue.completeMerge(request1);

      const state = queue.getState();
      // request2 should be merging, request3 still pending (conflicts with request2)
      expect(state.merging?.workerId).toBe('worker-2');
      expect(state.pending).toHaveLength(1);
      expect(state.pending[0].workerId).toBe('worker-3');
    });

    it('should throw error if worker is not currently merging', async () => {
      const request = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);

      await expect(queue.completeMerge(request)).rejects.toThrow('not currently merging');
    });
  });

  describe('failMerge', () => {
    it('should mark merge as failed and release lock', async () => {
      const request = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);

      await queue.requestMerge(request);
      await queue.failMerge(request, 'Merge conflict detected');

      const state = queue.getState();
      expect(state.merging).toBeNull();
      expect(state.failed).toHaveLength(1);
      expect(state.failed[0].request.workerId).toBe('worker-1');
      expect(state.failed[0].reason).toBe('Merge conflict detected');
    });

    it('should process next queued request after failure', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);
      const request2 = createMergeRequest('worker-2', 'ww-def', 'def456', ['src/bar.ts']);

      await queue.requestMerge(request1);
      await queue.requestMerge(request2);

      // Fail first merge
      await queue.failMerge(request1, 'Test failure');

      const state = queue.getState();
      expect(state.merging?.workerId).toBe('worker-2');
      expect(state.pending).toHaveLength(0);
      expect(state.failed).toHaveLength(1);
    });

    it('should throw error if worker is not currently merging', async () => {
      const request = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);

      await expect(queue.failMerge(request, 'Test')).rejects.toThrow('not currently merging');
    });
  });

  describe('getState', () => {
    it('should return a copy of state', async () => {
      const request = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);
      await queue.requestMerge(request);

      const state1 = queue.getState();
      const state2 = queue.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object instances
    });
  });

  describe('conflict detection scenarios', () => {
    it('should allow non-overlapping files from different workers', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/foo.ts']);
      const request2 = createMergeRequest('worker-2', 'ww-def', 'def456', ['src/bar.ts']);
      const request3 = createMergeRequest('worker-3', 'ww-ghi', 'ghi789', ['src/baz.ts']);

      await queue.requestMerge(request1);
      await queue.requestMerge(request2);
      await queue.requestMerge(request3);

      // All should be queued without conflicts
      const state = queue.getState();
      expect(state.merging?.workerId).toBe('worker-1');
      expect(state.pending).toHaveLength(2);
    });

    it('should detect complex multi-file conflicts', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/a.ts', 'src/b.ts']);
      const request2 = createMergeRequest('worker-2', 'ww-def', 'def456', ['src/b.ts', 'src/c.ts']);

      await queue.requestMerge(request1);
      const result2 = await queue.requestMerge(request2);

      expect(result2.conflictingFiles).toEqual(['src/b.ts']);
    });

    it('should handle empty file lists', async () => {
      const request = createMergeRequest('worker-1', 'ww-abc', 'abc123', []);

      const result = await queue.requestMerge(request);

      expect(result.allowed).toBe(true);
      expect(result.conflictType).toBe('none');
    });
  });

  describe('queue ordering', () => {
    it('should maintain FIFO order for non-conflicting requests', async () => {
      const request1 = createMergeRequest('worker-1', 'ww-abc', 'abc123', ['src/a.ts']);
      const request2 = createMergeRequest('worker-2', 'ww-def', 'def456', ['src/b.ts']);
      const request3 = createMergeRequest('worker-3', 'ww-ghi', 'ghi789', ['src/c.ts']);

      await queue.requestMerge(request1);
      await queue.requestMerge(request2);
      await queue.requestMerge(request3);

      // Complete request1
      await queue.completeMerge(request1);

      let state = queue.getState();
      expect(state.merging?.workerId).toBe('worker-2');

      // Complete request2
      await queue.completeMerge(request2);

      state = queue.getState();
      expect(state.merging?.workerId).toBe('worker-3');
    });
  });
});
