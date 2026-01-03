/**
 * @workwayco/harness - Hook Queue Tests
 *
 * Tests for crash-resilient work distribution using Beads labels.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HookQueue } from '../hook-queue.js';
import type { HookQueueConfig } from '../types.js';

describe('HookQueue', () => {
  let queue: HookQueue;
  const testConfig: Partial<HookQueueConfig> = {
    claimTimeoutMs: 5000, // 5 seconds for tests
    heartbeatIntervalMs: 1000, // 1 second for tests
    maxRetries: 2,
  };

  beforeEach(() => {
    queue = new HookQueue(testConfig);
  });

  afterEach(async () => {
    // Cleanup: release all claims
    await queue.releaseAllClaims();
  });

  describe('initialization', () => {
    it('should create a queue with default config', () => {
      const defaultQueue = new HookQueue();
      expect(defaultQueue).toBeDefined();
    });

    it('should create a queue with custom config', () => {
      expect(queue).toBeDefined();
    });
  });

  describe('state detection', () => {
    it('should get available work (hook:ready issues)', async () => {
      const available = await queue.getAvailableWork();
      expect(Array.isArray(available)).toBe(true);
    });

    it('should get in-progress work (hook:in-progress issues)', async () => {
      const inProgress = await queue.getInProgressWork();
      expect(Array.isArray(inProgress)).toBe(true);
    });

    it('should get failed work (hook:failed issues)', async () => {
      const failed = await queue.getFailedWork();
      expect(Array.isArray(failed)).toBe(true);
    });
  });

  describe('claim lifecycle', () => {
    it('should return no work when queue is empty', async () => {
      const result = await queue.claimWork();
      expect(result.success).toBe(false);
      expect(result.reason).toContain('No available work');
    });

    it('should filter claims by labels', async () => {
      const result = await queue.claimWork({ labels: ['harness'] });
      expect(result.success).toBe(false);
    });

    it('should filter claims by priority', async () => {
      const result = await queue.claimWork({ priority: 0 });
      expect(result.success).toBe(false);
    });
  });

  describe('stale claim detection', () => {
    it('should detect stale claims', async () => {
      const released = await queue.releaseStaleClaims();
      expect(Array.isArray(released)).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should return queue statistics', async () => {
      const stats = await queue.getStats();
      expect(stats).toHaveProperty('ready');
      expect(stats).toHaveProperty('inProgress');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('staleClaims');
      expect(typeof stats.ready).toBe('number');
      expect(typeof stats.inProgress).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.staleClaims).toBe('number');
    });
  });

  describe('failure handling', () => {
    it('should handle retry limit checks', async () => {
      // Test with a mock issue ID
      const exceeded = await queue.hasExceededRetries('test-issue');
      expect(typeof exceeded).toBe('boolean');
    });
  });
});

describe('HookQueue Integration', () => {
  it('should create queue with factory function', async () => {
    const { createHookQueue } = await import('../hook-queue.js');
    const queue = createHookQueue();
    expect(queue).toBeDefined();
    expect(queue).toBeInstanceOf(HookQueue);
  });

  it('should export from main index', async () => {
    const { HookQueue, createHookQueue, DEFAULT_HOOK_CONFIG } = await import(
      '../index.js'
    );
    expect(HookQueue).toBeDefined();
    expect(createHookQueue).toBeDefined();
    expect(DEFAULT_HOOK_CONFIG).toBeDefined();
    expect(DEFAULT_HOOK_CONFIG.claimTimeoutMs).toBe(10 * 60 * 1000);
    expect(DEFAULT_HOOK_CONFIG.heartbeatIntervalMs).toBe(60 * 1000);
    expect(DEFAULT_HOOK_CONFIG.maxRetries).toBe(2);
  });
});
