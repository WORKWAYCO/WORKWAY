/**
 * Repair Orchestrator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RepairStateManager } from './state';

// Mock Durable Object storage
class MockStorage implements DurableObjectStorage {
  private data = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async put<T = unknown>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async list<T = unknown>(options?: {
    prefix?: string;
  }): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const prefix = options?.prefix || '';

    for (const [key, value] of this.data) {
      if (key.startsWith(prefix)) {
        result.set(key, value as T);
      }
    }

    return result;
  }

  // Stub other methods
  async delete(): Promise<boolean> {
    return true;
  }
  async deleteAll(): Promise<void> {}
  async getAlarm(): Promise<number | null> {
    return null;
  }
  async setAlarm(): Promise<void> {}
  async deleteAlarm(): Promise<void> {}
  async sync(): Promise<void> {}
  transaction<T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T> {
    throw new Error('Not implemented');
  }
  transactionSync<T>(closure: () => T): T {
    throw new Error('Not implemented');
  }
  sql = {} as any;
}

describe('RepairStateManager', () => {
  let manager: RepairStateManager;
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
    manager = new RepairStateManager(storage);
  });

  describe('deduplication', () => {
    it('should detect duplicate errors within time window', async () => {
      const error = {
        id: 'test-1',
        fingerprint: 'abc123',
        level: 'error' as const,
        message: 'Test error',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      await manager.createRepair(error);
      const isDupe = await manager.isDuplicate(error.fingerprint);
      expect(isDupe).toBe(true);
    });

    it('should not flag different errors as duplicates', async () => {
      const error1 = {
        id: 'test-1',
        fingerprint: 'abc123',
        level: 'error' as const,
        message: 'Test error 1',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      await manager.createRepair(error1);
      const isDupe = await manager.isDuplicate('different-fingerprint');
      expect(isDupe).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('should track repairs per repo per hour', async () => {
      const isLimited = await manager.isRateLimited('Cloudflare');
      expect(isLimited).toBe(false);

      await manager.incrementRateLimit('Cloudflare');
      const isStillOk = await manager.isRateLimited('Cloudflare', 1);
      expect(isStillOk).toBe(false); // At limit but not exceeded

      await manager.incrementRateLimit('Cloudflare');
      const isNowLimited = await manager.isRateLimited('Cloudflare', 1);
      expect(isNowLimited).toBe(true); // Exceeded limit
    });

    it('should isolate rate limits per repo', async () => {
      await manager.incrementRateLimit('Cloudflare');
      await manager.incrementRateLimit('Cloudflare');

      const cloudflareLimit = await manager.isRateLimited('Cloudflare', 1);
      const platformLimit = await manager.isRateLimited('workway-platform', 1);

      expect(cloudflareLimit).toBe(true);
      expect(platformLimit).toBe(false);
    });
  });

  describe('state management', () => {
    it('should create repair state', async () => {
      const error = {
        id: 'test-1',
        fingerprint: 'abc123',
        level: 'error' as const,
        message: 'Test error',
        stack: 'at foo.ts:10',
        context: { url: '/api/test' },
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      const state = await manager.createRepair(error);

      expect(state.id).toBeDefined();
      expect(state.error_fingerprint).toBe('abc123');
      expect(state.status).toBe('pending');
      expect(state.repo).toBe('Cloudflare');
    });

    it('should update repair state', async () => {
      const error = {
        id: 'test-1',
        fingerprint: 'abc123',
        level: 'error' as const,
        message: 'Test error',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      const state = await manager.createRepair(error);
      const updated = await manager.updateRepair(state.id, {
        status: 'diagnosing',
      });

      expect(updated?.status).toBe('diagnosing');
      expect(updated?.updated_at).not.toBe(state.updated_at);
    });

    it('should transition through testing and auto_merged statuses', async () => {
      const error = {
        id: 'test-1',
        fingerprint: 'abc123',
        level: 'error' as const,
        message: 'Test error',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      const state = await manager.createRepair(error);

      // Progress through workflow states
      await manager.updateRepair(state.id, { status: 'diagnosing' });
      await manager.updateRepair(state.id, { status: 'fixing' });
      await manager.updateRepair(state.id, { status: 'testing' });

      const testing = await manager.getRepair(state.id);
      expect(testing?.status).toBe('testing');

      // Simulate auto-merge on successful tests
      await manager.updateRepair(state.id, { status: 'auto_merged' });

      const merged = await manager.getRepair(state.id);
      expect(merged?.status).toBe('auto_merged');
    });

    it('should exclude auto_merged from active repairs', async () => {
      const error1 = {
        id: 'test-1',
        fingerprint: 'abc123',
        level: 'error' as const,
        message: 'Error 1',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      const error2 = {
        id: 'test-2',
        fingerprint: 'def456',
        level: 'error' as const,
        message: 'Error 2',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      const state1 = await manager.createRepair(error1);
      await manager.createRepair(error2);

      // Mark first as auto_merged (terminal state)
      await manager.updateRepair(state1.id, { status: 'auto_merged' });

      const active = await manager.listActiveRepairs();

      // Only the pending repair should be active
      expect(active.length).toBe(1);
      expect(active[0].status).toBe('pending');
    });

    it('should retrieve repair by ID', async () => {
      const error = {
        id: 'test-1',
        fingerprint: 'abc123',
        level: 'error' as const,
        message: 'Test error',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      const created = await manager.createRepair(error);
      const retrieved = await manager.getRepair(created.id);

      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.error_fingerprint).toBe('abc123');
    });

    it('should retrieve repair by fingerprint', async () => {
      const error = {
        id: 'test-1',
        fingerprint: 'abc123',
        level: 'error' as const,
        message: 'Test error',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      await manager.createRepair(error);
      const retrieved = await manager.getRepairByFingerprint('abc123');

      expect(retrieved?.error_fingerprint).toBe('abc123');
    });
  });

  describe('statistics', () => {
    it('should calculate repair statistics', async () => {
      const error1 = {
        id: 'test-1',
        fingerprint: 'abc123',
        level: 'error' as const,
        message: 'Error 1',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'Cloudflare',
        received_at: new Date().toISOString(),
      };

      const error2 = {
        id: 'test-2',
        fingerprint: 'def456',
        level: 'error' as const,
        message: 'Error 2',
        stack: null,
        context: {},
        source: 'custom',
        repo: 'workway-platform',
        received_at: new Date().toISOString(),
      };

      const state1 = await manager.createRepair(error1);
      await manager.createRepair(error2);
      await manager.updateRepair(state1.id, { status: 'diagnosing' });

      const stats = await manager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.by_status.pending).toBe(1);
      expect(stats.by_status.diagnosing).toBe(1);
      expect(stats.by_repo.Cloudflare).toBe(1);
      expect(stats.by_repo['workway-platform']).toBe(1);
    });
  });
});
