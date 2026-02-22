import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkAndCreateCheckpointFromHook,
  shouldCreateCheckpoint,
} from '../checkpoint.js';
import type { CheckpointPolicy, CheckpointTracker, SessionResult } from '../types.js';

describe('checkpoint policy', () => {
  const basePolicy: CheckpointPolicy = {
    afterSessions: 99,
    afterHours: 99,
    onError: true,
    onConfidenceBelow: 0.4,
    onRedirect: true,
  };

  const baseResult: SessionResult = {
    issueId: 'WORKWAY-123',
    outcome: 'success',
    summary: 'completed',
    gitCommit: null,
    contextUsed: 1200,
    durationMs: 60_000,
    error: null,
  };

  const tracker: CheckpointTracker = {
    sessionsResults: [baseResult],
    lastCheckpointTime: new Date().toISOString(),
    elapsedMs: 60_000,
  };

  it('creates a checkpoint when redirect policy is enabled and redirect exists', () => {
    const decision = shouldCreateCheckpoint(tracker, basePolicy, baseResult, true);
    expect(decision).toEqual({ create: true, reason: 'Human redirect' });
  });

  it('does not create a checkpoint when redirect policy is disabled', () => {
    const decision = shouldCreateCheckpoint(
      tracker,
      { ...basePolicy, onRedirect: false },
      baseResult,
      true
    );
    expect(decision.create).toBe(false);
  });
});

describe('checkAndCreateCheckpointFromHook', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { recursive: true, force: true }))
    );
    tempDirs.length = 0;
  });

  it('returns early when there are no session results to evaluate', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'harness-checkpoint-test-'));
    tempDirs.push(cwd);

    const harnessDir = join(cwd, '.harness');
    await mkdir(harnessDir, { recursive: true });

    await writeFile(
      join(harnessDir, 'state.json'),
      JSON.stringify({
        id: 'harness-test',
        status: 'running',
        mode: 'workflow',
        specFile: 'spec.md',
        gitBranch: 'codex/test',
        startedAt: new Date().toISOString(),
        currentSession: 1,
        sessionsCompleted: 0,
        featuresTotal: 0,
        featuresCompleted: 0,
        featuresFailed: 0,
        lastCheckpoint: null,
        checkpointPolicy: {
          afterSessions: 3,
          afterHours: 1,
          onError: true,
          onConfidenceBelow: 0.4,
          onRedirect: true,
        },
        pauseReason: null,
      }),
      'utf-8'
    );

    await writeFile(
      join(harnessDir, 'tracker.json'),
      JSON.stringify({
        sessionsResults: [],
        lastCheckpointTime: new Date().toISOString(),
        elapsedMs: 0,
      }),
      'utf-8'
    );

    const result = await checkAndCreateCheckpointFromHook(cwd);
    expect(result).toEqual({
      created: false,
      reason: 'No completed sessions to evaluate',
    });
  });
});
