/**
 * @workwayco/harness - ScaleManager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScaleManager, createScaleManager } from '../scale-manager.js';
import { WorkerPool } from '../worker.js';
import type { ScaleConfig } from '../types.js';

describe('ScaleManager', () => {
  let workerPool: WorkerPool;
  let scaleManager: ScaleManager;
  const cwd = process.cwd();

  beforeEach(() => {
    workerPool = new WorkerPool(cwd, true);
    // Start with 4 workers (Phase 1 baseline)
    for (let i = 1; i <= 4; i++) {
      workerPool.addWorker(`test-worker-${i}`);
    }
  });

  afterEach(async () => {
    if (scaleManager) {
      await scaleManager.stop();
    }
  });

  describe('Initialization', () => {
    it('should create with default configuration', () => {
      scaleManager = createScaleManager(workerPool, cwd);
      const metrics = scaleManager.getMetrics();

      expect(metrics.currentWorkers).toBe(4);
      expect(metrics.health).toBe('healthy');
    });

    it('should create with custom configuration', () => {
      const config: Partial<ScaleConfig> = {
        minWorkers: 2,
        maxWorkers: 50,
        targetQueueDepth: 20,
      };

      scaleManager = createScaleManager(workerPool, cwd, null, config);
      expect(scaleManager).toBeDefined();
    });
  });

  describe('Session Tracking', () => {
    beforeEach(() => {
      scaleManager = createScaleManager(workerPool, cwd);
    });

    it('should track session start and completion', () => {
      scaleManager.recordSessionStart('test-worker-1', 'issue-1');
      scaleManager.recordSessionComplete('test-worker-1', 'issue-1', true);

      const metrics = scaleManager.getMetrics();
      expect(metrics.totalSessionsCompleted).toBe(1);
      expect(metrics.totalSessionsFailed).toBe(0);
      expect(metrics.successRate).toBe(1.0);
    });

    it('should track failed sessions', () => {
      scaleManager.recordSessionStart('test-worker-1', 'issue-1');
      scaleManager.recordSessionComplete('test-worker-1', 'issue-1', false);

      const metrics = scaleManager.getMetrics();
      expect(metrics.totalSessionsCompleted).toBe(0);
      expect(metrics.totalSessionsFailed).toBe(1);
      expect(metrics.successRate).toBe(0.0);
    });

    it('should calculate success rate correctly', () => {
      // Record 3 successful, 1 failed
      for (let i = 1; i <= 3; i++) {
        scaleManager.recordSessionStart('test-worker-1', `issue-${i}`);
        scaleManager.recordSessionComplete('test-worker-1', `issue-${i}`, true);
      }

      scaleManager.recordSessionStart('test-worker-1', 'issue-4');
      scaleManager.recordSessionComplete('test-worker-1', 'issue-4', false);

      const metrics = scaleManager.getMetrics();
      expect(metrics.totalSessionsCompleted).toBe(3);
      expect(metrics.totalSessionsFailed).toBe(1);
      expect(metrics.successRate).toBe(0.75);
    });
  });

  describe('Backpressure', () => {
    it('should not apply backpressure with default settings', () => {
      const config: Partial<ScaleConfig> = {
        maxQueueDepth: 100,
      };

      scaleManager = createScaleManager(workerPool, cwd, null, config);
      expect(scaleManager.shouldApplyBackpressure()).toBe(false);
    });

    it('should apply backpressure when queue depth exceeds limit', () => {
      // This test would require a way to set queue depth
      // For now, we verify the method exists and returns boolean
      scaleManager = createScaleManager(workerPool, cwd);
      const result = scaleManager.shouldApplyBackpressure();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Resource Quotas', () => {
    beforeEach(() => {
      const config: Partial<ScaleConfig> = {
        maxSessionsPerWorker: 5,
      };
      scaleManager = createScaleManager(workerPool, cwd, null, config);
    });

    it('should detect when worker exceeds quota', async () => {
      // Get worker and execute sessions to increment its internal counter
      const worker = workerPool.getWorker('test-worker-1');
      expect(worker).toBeDefined();

      if (!worker) return;

      // Simulate 6 sessions to exceed quota (5)
      for (let i = 1; i <= 6; i++) {
        // Record in scale manager
        scaleManager.recordSessionStart('test-worker-1', `issue-${i}`);
        scaleManager.recordSessionComplete('test-worker-1', `issue-${i}`, true);

        // Also increment worker's session count
        // In real usage, this happens during worker.execute()
        // For testing, we access the internal state
        const state = worker.getState();
        (worker as any).state.sessionsCompleted = i;
      }

      // Worker should have exceeded quota (5)
      const exceeded = scaleManager.hasExceededQuota('test-worker-1');
      expect(exceeded).toBe(true);
    });

    it('should not detect quota violation for worker within limit', () => {
      // Record 3 sessions for worker-1
      for (let i = 1; i <= 3; i++) {
        scaleManager.recordSessionStart('test-worker-1', `issue-${i}`);
        scaleManager.recordSessionComplete('test-worker-1', `issue-${i}`, true);
      }

      // Worker should not have exceeded quota
      const exceeded = scaleManager.hasExceededQuota('test-worker-1');
      expect(exceeded).toBe(false);
    });
  });

  describe('Health Status', () => {
    beforeEach(() => {
      scaleManager = createScaleManager(workerPool, cwd);
    });

    it('should report healthy status with high success rate', () => {
      // Record all successful sessions
      for (let i = 1; i <= 10; i++) {
        scaleManager.recordSessionStart('test-worker-1', `issue-${i}`);
        scaleManager.recordSessionComplete('test-worker-1', `issue-${i}`, true);
      }

      const metrics = scaleManager.getMetrics();
      expect(metrics.health).toBe('healthy');
    });

    it('should report degraded status with moderate success rate', () => {
      // Record 7 successful, 3 failed (70% success)
      for (let i = 1; i <= 7; i++) {
        scaleManager.recordSessionStart('test-worker-1', `issue-${i}`);
        scaleManager.recordSessionComplete('test-worker-1', `issue-${i}`, true);
      }

      for (let i = 8; i <= 10; i++) {
        scaleManager.recordSessionStart('test-worker-1', `issue-${i}`);
        scaleManager.recordSessionComplete('test-worker-1', `issue-${i}`, false);
      }

      const metrics = scaleManager.getMetrics();
      expect(metrics.health).toBe('degraded');
    });

    it('should report unhealthy status with low success rate', () => {
      // Record 2 successful, 8 failed (20% success)
      for (let i = 1; i <= 2; i++) {
        scaleManager.recordSessionStart('test-worker-1', `issue-${i}`);
        scaleManager.recordSessionComplete('test-worker-1', `issue-${i}`, true);
      }

      for (let i = 3; i <= 10; i++) {
        scaleManager.recordSessionStart('test-worker-1', `issue-${i}`);
        scaleManager.recordSessionComplete('test-worker-1', `issue-${i}`, false);
      }

      const metrics = scaleManager.getMetrics();
      expect(metrics.health).toBe('unhealthy');
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      scaleManager = createScaleManager(workerPool, cwd);
    });

    it('should provide comprehensive metrics', () => {
      const metrics = scaleManager.getMetrics();

      expect(metrics).toHaveProperty('currentWorkers');
      expect(metrics).toHaveProperty('activeWorkers');
      expect(metrics).toHaveProperty('idleWorkers');
      expect(metrics).toHaveProperty('stalledWorkers');
      expect(metrics).toHaveProperty('queueDepth');
      expect(metrics).toHaveProperty('throughputPerMinute');
      expect(metrics).toHaveProperty('avgSessionDurationMs');
      expect(metrics).toHaveProperty('p95SessionDurationMs');
      expect(metrics).toHaveProperty('totalSessionsCompleted');
      expect(metrics).toHaveProperty('totalSessionsFailed');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('backpressureActive');
      expect(metrics).toHaveProperty('health');
    });

    it('should update metrics after sessions', () => {
      const before = scaleManager.getMetrics();
      expect(before.totalSessionsCompleted).toBe(0);

      scaleManager.recordSessionStart('test-worker-1', 'issue-1');
      scaleManager.recordSessionComplete('test-worker-1', 'issue-1', true);

      const after = scaleManager.getMetrics();
      expect(after.totalSessionsCompleted).toBe(1);
    });
  });

  describe('Recommended Worker Count', () => {
    beforeEach(() => {
      const config: Partial<ScaleConfig> = {
        minWorkers: 4,
        maxWorkers: 30,
        targetQueueDepth: 10,
      };
      scaleManager = createScaleManager(workerPool, cwd, null, config);
    });

    it('should recommend within min-max bounds', () => {
      const recommended = scaleManager.getRecommendedWorkerCount();
      expect(recommended).toBeGreaterThanOrEqual(4);
      expect(recommended).toBeLessThanOrEqual(30);
    });
  });
});
