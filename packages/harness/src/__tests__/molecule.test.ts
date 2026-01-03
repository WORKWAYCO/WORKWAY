/**
 * @workwayco/harness - Molecular Workflow Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MoleculeManager } from '../molecule.js';
import type { Molecule, MoleculeStepCheckpoint, BeadsIssue } from '../types.js';
import * as beads from '../beads.js';

// Mock beads module
vi.mock('../beads.js', () => ({
  getIssue: vi.fn(),
  createIssue: vi.fn(),
  updateIssueStatus: vi.fn(),
}));

// Mock child_process for bd command execution
vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd, opts, callback) => {
    // Simulate successful execution
    callback(null, { stdout: 'Created issue: step-1', stderr: '' });
  }),
}));

const mockGetIssue = beads.getIssue as any;
const mockCreateIssue = beads.createIssue as any;
const mockUpdateIssueStatus = beads.updateIssueStatus as any;

describe('MoleculeManager', () => {
  let manager: MoleculeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new MoleculeManager('/test/cwd', {
      createStepIssues: true,
      captureCheckpoints: true,
      autoCommit: false,
      defaultMaxRetries: 2,
    });
  });

  describe('createMolecule', () => {
    it('should create a molecule with steps', async () => {
      // Mock issue retrieval for parent
      mockGetIssue.mockResolvedValue({
        id: 'parent-123',
        description: '',
      } as BeadsIssue);

      const molecule = await manager.createMolecule(
        'parent-123',
        'Test Molecule',
        [
          { id: 's1', title: 'Step 1' },
          { id: 's2', title: 'Step 2', dependsOn: ['s1'] },
          { id: 's3', title: 'Step 3', dependsOn: ['s2'] },
        ],
        {
          createdBy: 'test-agent',
          labels: ['test'],
        }
      );

      expect(molecule.title).toBe('Test Molecule');
      expect(molecule.parentIssueId).toBe('parent-123');
      expect(molecule.steps).toHaveLength(3);
      expect(molecule.steps[0].state).toBe('pending');
      expect(molecule.steps[1].dependsOn).toEqual(['s1']);
      // Note: issueId will be 'step-1' from the mocked exec
    });
  });

  describe('getNextStep', () => {
    it('should return first step with no dependencies', () => {
      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'pending',
            dependsOn: [],
            retryCount: 0,
            maxRetries: 2,
          },
          {
            id: 's2',
            title: 'Step 2',
            state: 'pending',
            dependsOn: ['s1'],
            retryCount: 0,
            maxRetries: 2,
          },
        ],
        state: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const next = manager.getNextStep(molecule);
      expect(next?.id).toBe('s1');
    });

    it('should return second step after first completes', () => {
      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'complete',
            dependsOn: [],
            retryCount: 0,
            maxRetries: 2,
            completedAt: new Date().toISOString(),
          },
          {
            id: 's2',
            title: 'Step 2',
            state: 'pending',
            dependsOn: ['s1'],
            retryCount: 0,
            maxRetries: 2,
          },
        ],
        state: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const next = manager.getNextStep(molecule);
      expect(next?.id).toBe('s2');
    });

    it('should return null when no steps are ready', () => {
      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'pending',
            dependsOn: [],
            retryCount: 0,
            maxRetries: 2,
          },
          {
            id: 's2',
            title: 'Step 2',
            state: 'pending',
            dependsOn: ['s1'],
            retryCount: 0,
            maxRetries: 2,
          },
        ],
        state: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      // Mark first step as in_progress
      molecule.steps[0].state = 'in_progress';

      const next = manager.getNextStep(molecule);
      expect(next).toBeNull();
    });
  });

  describe('startStep', () => {
    it('should transition step to in_progress', async () => {
      mockGetIssue.mockResolvedValue({
        id: 'parent-123',
        description: '',
      } as BeadsIssue);

      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'pending',
            dependsOn: [],
            issueId: 'step-1',
            retryCount: 0,
            maxRetries: 2,
          },
        ],
        state: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const updated = await manager.startStep(molecule, 's1');
      expect(updated.steps[0].state).toBe('in_progress');
      expect(updated.steps[0].startedAt).toBeDefined();
      expect(updated.state).toBe('in_progress');
    });
  });

  describe('completeStep', () => {
    it('should transition step to complete with checkpoint', async () => {
      mockGetIssue.mockResolvedValue({
        id: 'parent-123',
        description: '',
      } as BeadsIssue);

      const checkpoint: MoleculeStepCheckpoint = {
        filesModified: ['file1.ts', 'file2.ts'],
        gitCommit: 'abc123',
        testsPassed: true,
        notes: 'Step completed successfully',
        capturedAt: new Date().toISOString(),
      };

      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'in_progress',
            dependsOn: [],
            issueId: 'step-1',
            startedAt: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 2,
          },
        ],
        state: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const updated = await manager.completeStep(molecule, 's1', checkpoint);
      expect(updated.steps[0].state).toBe('complete');
      expect(updated.steps[0].completedAt).toBeDefined();
      expect(updated.steps[0].checkpoint).toEqual(checkpoint);
      expect(updated.state).toBe('complete');
    });
  });

  describe('failStep', () => {
    it('should retry step on first failure', async () => {
      mockGetIssue.mockResolvedValue({
        id: 'parent-123',
        description: '',
      } as BeadsIssue);

      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'in_progress',
            dependsOn: [],
            startedAt: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 2,
          },
        ],
        state: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const updated = await manager.failStep(molecule, 's1', 'Test error');
      expect(updated.steps[0].state).toBe('pending'); // Reset for retry
      expect(updated.steps[0].retryCount).toBe(1);
    });

    it('should mark step as failed after max retries', async () => {
      mockGetIssue.mockResolvedValue({
        id: 'parent-123',
        description: '',
      } as BeadsIssue);

      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'in_progress',
            dependsOn: [],
            startedAt: new Date().toISOString(),
            retryCount: 1, // Already retried once
            maxRetries: 2,
          },
        ],
        state: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const updated = await manager.failStep(molecule, 's1', 'Test error');
      expect(updated.steps[0].state).toBe('failed');
      expect(updated.steps[0].failureReason).toBe('Test error');
      expect(updated.state).toBe('failed');
    });
  });

  describe('advanceMolecule', () => {
    it('should return next executable step', async () => {
      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'pending',
            dependsOn: [],
            retryCount: 0,
            maxRetries: 2,
          },
        ],
        state: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const result = await manager.advanceMolecule(molecule);
      expect(result.success).toBe(true);
      expect(result.nextStep?.id).toBe('s1');
    });

    it('should indicate completion when all steps done', async () => {
      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'complete',
            dependsOn: [],
            retryCount: 0,
            maxRetries: 2,
            completedAt: new Date().toISOString(),
          },
        ],
        state: 'complete',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const result = await manager.advanceMolecule(molecule);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Molecule complete');
    });
  });

  describe('resumeMolecule', () => {
    it('should resume from in_progress step after crash', async () => {
      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'complete',
            dependsOn: [],
            retryCount: 0,
            maxRetries: 2,
            completedAt: new Date().toISOString(),
          },
          {
            id: 's2',
            title: 'Step 2',
            state: 'in_progress', // Crashed during this step
            dependsOn: ['s1'],
            startedAt: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 2,
          },
        ],
        state: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const result = await manager.resumeMolecule(molecule);
      expect(result.success).toBe(true);
      expect(result.nextStep?.id).toBe('s2');
      expect(result.reason).toBe('Resuming from crashed step');
    });
  });

  describe('getMoleculeProgress', () => {
    it('should calculate progress correctly', () => {
      const molecule: Molecule = {
        id: 'mol-123',
        title: 'Test',
        parentIssueId: 'parent-123',
        steps: [
          {
            id: 's1',
            title: 'Step 1',
            state: 'complete',
            dependsOn: [],
            retryCount: 0,
            maxRetries: 2,
            completedAt: new Date().toISOString(),
          },
          {
            id: 's2',
            title: 'Step 2',
            state: 'in_progress',
            dependsOn: ['s1'],
            startedAt: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 2,
          },
          {
            id: 's3',
            title: 'Step 3',
            state: 'pending',
            dependsOn: ['s2'],
            retryCount: 0,
            maxRetries: 2,
          },
          {
            id: 's4',
            title: 'Step 4',
            state: 'failed',
            dependsOn: [],
            retryCount: 2,
            maxRetries: 2,
            failureReason: 'Test error',
          },
        ],
        state: 'in_progress',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { createdBy: 'test', labels: [] },
      };

      const progress = manager.getMoleculeProgress(molecule);
      expect(progress.total).toBe(4);
      expect(progress.complete).toBe(1);
      expect(progress.inProgress).toBe(1);
      expect(progress.pending).toBe(1);
      expect(progress.failed).toBe(1);
      expect(progress.percentComplete).toBe(25); // 1/4 = 25%
    });
  });
});
