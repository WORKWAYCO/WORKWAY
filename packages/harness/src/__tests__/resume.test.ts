/**
 * @workwayco/harness
 *
 * Tests for harness resume functionality.
 * These are unit tests for the parsing logic.
 */

import { describe, it, expect } from 'vitest';
import { parseIssueList } from '../lib/utils/parseIssueList.js';

describe('Harness Resume - Parsing Logic', () => {
  it('should parse spec file from harness description', () => {
    const description = 'Harness run for: specs/test.yaml\nFeatures: 5\nBranch: harness/test\nStarted: 2024-01-01T00:00:00.000Z';
    const specMatch = description.match(/Harness run for:\s*(.+)/);

    expect(specMatch).toBeTruthy();
    expect(specMatch![1].trim()).toBe('specs/test.yaml');
  });

  it('should parse git branch from harness description', () => {
    const description = 'Harness run for: specs/test.yaml\nFeatures: 5\nBranch: harness/test-branch\nStarted: 2024-01-01T00:00:00.000Z';
    const branchMatch = description.match(/Branch:\s*([\w\/-]+)/);

    expect(branchMatch).toBeTruthy();
    expect(branchMatch![1]).toBe('harness/test-branch');
  });

  it('should handle missing branch in description', () => {
    const description = 'Harness run for: specs/test.yaml\nFeatures: 5\nStarted: 2024-01-01T00:00:00.000Z';
    const branchMatch = description.match(/Branch:\s*([\w\/-]+)/);

    expect(branchMatch).toBeNull();
    // Fallback behavior: use default branch name
    const gitBranch = branchMatch ? branchMatch[1] : 'harness/resumed-test-id';
    expect(gitBranch).toBe('harness/resumed-test-id');
  });

  it('should parse checkpoint summary', () => {
    const description = '## Summary\n2 completed, 1 in progress (85% confidence)\n\n## Completed';
    const summaryMatch = description.match(/## Summary\n(.+)/);

    expect(summaryMatch).toBeTruthy();
    expect(summaryMatch![1].trim()).toBe('2 completed, 1 in progress (85% confidence)');
  });

  it('should parse checkpoint confidence', () => {
    const description = '## Confidence: 85%';
    const confidenceMatch = description.match(/## Confidence:\s*(\d+(?:\.\d+)?)%?/);

    expect(confidenceMatch).toBeTruthy();
    expect(parseFloat(confidenceMatch![1])).toBe(85);
  });

  it('should parse session number from checkpoint title', () => {
    const title = 'Checkpoint #3: Test summary';
    const sessionMatch = title.match(/Checkpoint #(\d+)/);

    expect(sessionMatch).toBeTruthy();
    expect(parseInt(sessionMatch![1], 10)).toBe(3);
  });

  it('should parse issue lists from checkpoint description', () => {
    const description = `## Completed
- task-1
- task-2

## In Progress
- task-3
- task-4`;

    const completedMatch = description.match(/## Completed\n((?:- .+\n?)+)/);
    const inProgressMatch = description.match(/## In Progress\n((?:- .+\n?)+)/);

    expect(completedMatch).toBeTruthy();
    expect(parseIssueList(completedMatch![1])).toEqual(['task-1', 'task-2']);

    expect(inProgressMatch).toBeTruthy();
    expect(parseIssueList(inProgressMatch![1])).toEqual(['task-3', 'task-4']);
  });

  it('should parse git commit from checkpoint metadata', () => {
    const description = `## Metadata
- Session: 3
- Git Commit: abc123def
- Timestamp: 2024-01-01T00:00:00.000Z`;

    const gitCommitMatch = description.match(/Git Commit:\s*(\S+)/);

    expect(gitCommitMatch).toBeTruthy();
    expect(gitCommitMatch![1]).toBe('abc123def');
  });

  it('should parse redirect notes from checkpoint', () => {
    const description = `## Redirect Notes
User requested priority change

## Metadata
- Session: 3`;

    const redirectMatch = description.match(/## Redirect Notes\n(.+?)(?:\n##|$)/s);

    expect(redirectMatch).toBeTruthy();
    expect(redirectMatch![1].trim()).toBe('User requested priority change');
  });

  it('should detect workflow mode from description', () => {
    const description1 = 'Harness run for: specs/workflow.yaml\nWorkflow mode enabled';
    const description2 = 'Harness run for: specs/platform.yaml\nPlatform mode';

    expect(description1.includes('workflow')).toBe(true);
    expect(description2.includes('workflow')).toBe(false);
  });
});
