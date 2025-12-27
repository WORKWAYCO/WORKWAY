# Harness Resume Implementation

## Overview

Implement the missing harness resume functionality that allows paused workflows to be continued.

**Philosophy**: Pause/resume should be invisible—you stop working, you come back, work continues where you left off.

**Priority**: P1 - HIGH. Currently the harness can pause but cannot resume (line 577 just logs "not implemented").

**Key Files**:
- `packages/harness/src/runner.ts` (main entry point, resume stub at line 577)
- `packages/harness/src/beads.ts` (Beads integration for state storage)
- `packages/harness/src/checkpoint.ts` (checkpoint management)

## Features

### Load harness state from Beads issues
Parse harness state from the issue description where it was stored on pause.

**Current state** (runner.ts:577):
```typescript
console.log('Resume functionality not yet implemented.');
```

**Target state**:
- Parse git branch name from issue metadata
- Extract completed features list
- Extract failed features list
- Reconstruct HarnessState object

**Implementation**:
```typescript
async function loadHarnessState(issueId: string): Promise<HarnessState> {
  const issue = await bd.show(issueId);
  // Parse description for state markers
  // Look for: git branch, completed features, current feature
  return {
    gitBranch: extractBranch(issue.description),
    completedFeatures: extractCompleted(issue.description),
    failedFeatures: extractFailed(issue.description),
    // ... other state
  };
}
```

**Verification**:
- Can load state from a paused harness issue
- State matches what was saved on pause

### Resume from last checkpoint
Find and load the most recent checkpoint for context restoration.

**Implementation**:
- Query for checkpoint issues linked to harness issue
- Sort by createdAt descending
- Load AgentContext from checkpoint description
- Generate resume brief for session priming

**Verification**:
- `loadCheckpointContext(harnessId)` returns valid AgentContext
- `generateResumeBrief(context)` produces markdown for session prime

### Integration test for resume flow
Ensure resume works end-to-end.

**Test cases**:
1. Create harness, pause, resume → continues on same branch
2. Resume with no checkpoints → starts from last completed feature
3. Resume after failure → retries failed feature

**Verification**:
- `pnpm --filter harness test` passes
- Manual test: `pnpm harness start <spec>`, pause, `pnpm harness resume <id>` works

## Verification

Confirm harness resume is complete:
- `resumeHarness()` no longer just logs
- State loading from Beads issues works
- Checkpoint context restoration works
- All harness tests pass
- Manual pause/resume cycle works
