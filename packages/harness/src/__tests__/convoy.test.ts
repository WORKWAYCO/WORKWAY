/**
 * Convoy System Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConvoySystem, createConvoySystem } from '../convoy.js';
import type { BeadsIssue } from '../types.js';
import { execSync } from 'child_process';

// Mock execSync
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = execSync as unknown as ReturnType<typeof vi.fn>;

describe('ConvoySystem', () => {
  let convoySystem: ConvoySystem;
  const testCwd = '/test/cwd';

  beforeEach(() => {
    convoySystem = createConvoySystem(testCwd);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createConvoy', () => {
    it('creates a convoy with initial issues', async () => {
      const convoyName = 'auth-refactor';
      const issueIds = ['ww-abc123', 'wwp-def456'];

      // Mock bd commands
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('bd label add')) {
          return '';
        }
        if (cmd.includes('bd create')) {
          return JSON.stringify({ id: 'convoy-001' });
        }
        if (cmd.includes('bd list')) {
          return JSON.stringify([
            {
              id: 'convoy-001',
              title: 'Auth Refactor Convoy',
              description: 'Cross-repo auth refactor',
              issue_type: 'convoy',
              status: 'open',
              labels: ['convoy:auth-refactor'],
              created_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-abc123',
              title: 'Update SDK auth',
              status: 'open',
              labels: ['convoy:auth-refactor'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'wwp-def456',
              title: 'Update API auth',
              status: 'in_progress',
              labels: ['convoy:auth-refactor'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
          ]);
        }
        return '';
      });

      const convoy = await convoySystem.createConvoy({
        name: convoyName,
        title: 'Auth Refactor Convoy',
        description: 'Cross-repo auth refactor',
        issueIds,
        cwd: testCwd,
      });

      expect(convoy.name).toBe(convoyName);
      expect(convoy.totalIssues).toBe(2); // Excluding metadata issue
      expect(convoy.repos).toContain('Cloudflare');
      expect(convoy.repos).toContain('workway-platform');
    });
  });

  describe('getConvoy', () => {
    it('calculates progress correctly', async () => {
      const convoyName = 'test-convoy';

      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('bd list')) {
          return JSON.stringify([
            {
              id: 'convoy-001',
              title: 'Test Convoy',
              issue_type: 'convoy',
              status: 'open',
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-1',
              title: 'Task 1',
              status: 'closed',
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-2',
              title: 'Task 2',
              status: 'closed',
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-3',
              title: 'Task 3',
              status: 'in_progress',
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-4',
              title: 'Task 4',
              status: 'open',
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
          ]);
        }
        return '';
      });

      const convoy = await convoySystem.getConvoy(convoyName, testCwd);

      expect(convoy.totalIssues).toBe(4); // Excluding metadata issue
      expect(convoy.completedIssues).toBe(2);
      expect(convoy.inProgressIssues).toBe(1);
      expect(convoy.progress).toBe(50); // 2 out of 4 completed
    });
  });

  describe('addToConvoy', () => {
    it('adds convoy label to issue', async () => {
      const convoyName = 'test-convoy';
      const issueId = 'ww-xyz789';

      mockExecSync.mockReturnValue('');

      await convoySystem.addToConvoy(convoyName, issueId, testCwd);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('bd label add ww-xyz789'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('convoy:test-convoy'),
        expect.any(Object)
      );
    });
  });

  describe('getNextIssue', () => {
    it('returns highest priority unblocked issue', async () => {
      const convoyName = 'test-convoy';

      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('bd ready')) {
          return JSON.stringify([
            {
              id: 'ww-2',
              title: 'Task 2',
              status: 'open',
              priority: 2,
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-1',
              title: 'Task 1',
              status: 'open',
              priority: 1,
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-3',
              title: 'Task 3',
              status: 'open',
              priority: 3,
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
          ]);
        }
        return '';
      });

      const nextIssue = await convoySystem.getNextIssue(convoyName, testCwd);

      expect(nextIssue).toBeDefined();
      expect(nextIssue?.id).toBe('ww-1'); // Highest priority (P1)
      expect(nextIssue?.priority).toBe(1);
    });

    it('returns null when no unblocked issues exist', async () => {
      const convoyName = 'test-convoy';

      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('bd ready')) {
          return JSON.stringify([]);
        }
        return '';
      });

      const nextIssue = await convoySystem.getNextIssue(convoyName, testCwd);

      expect(nextIssue).toBeNull();
    });
  });

  describe('getProgress', () => {
    it('returns convoy progress snapshot', async () => {
      const convoyName = 'test-convoy';

      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('bd list')) {
          return JSON.stringify([
            {
              id: 'convoy-001',
              title: 'Test Convoy',
              issue_type: 'convoy',
              status: 'open',
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-1',
              title: 'Task 1',
              status: 'closed',
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-2',
              title: 'Task 2',
              status: 'in_progress',
              labels: ['convoy:test-convoy'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
          ]);
        }
        return '';
      });

      const progress = await convoySystem.getProgress(convoyName, testCwd);

      expect(progress.name).toBe(convoyName);
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(1);
      expect(progress.inProgress).toBe(1);
      expect(progress.progress).toBe(50);
      expect(progress.timestamp).toBeDefined();
    });
  });

  describe('extractReposFromIssues', () => {
    it('correctly identifies repos from issue prefixes', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('bd list')) {
          return JSON.stringify([
            {
              id: 'convoy-001',
              title: 'Test',
              issue_type: 'convoy',
              status: 'open',
              labels: ['convoy:test'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'ww-1',
              title: 'Cloudflare task',
              status: 'open',
              labels: ['convoy:test'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
            {
              id: 'wwp-2',
              title: 'Platform task',
              status: 'open',
              labels: ['convoy:test'],
              created_at: '2026-01-03T09:00:00Z',
              updated_at: '2026-01-03T09:00:00Z',
            },
          ]);
        }
        return '';
      });

      const convoy = await convoySystem.getConvoy('test', testCwd);

      expect(convoy.repos).toContain('Cloudflare');
      expect(convoy.repos).toContain('workway-platform');
      expect(convoy.repos.length).toBe(2);
    });
  });
});
