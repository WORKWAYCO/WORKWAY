# Hook Queue: Crash-Resilient Work Recovery

**Status**: ✅ Implemented (Phase 1)
**Issue**: Cloudflare-u5q2
**Inspired by**: GAS TOWN hook pattern

## Overview

The Hook Queue implements crash-resilient work distribution using Beads labels. Work "hangs" on hooks (issues with `hook:ready` label) and agents claim it atomically. If an agent crashes, the work auto-releases back to the queue.

**Zuhandenheit**: Crashes don't block progress. Work persists; agents restart.

## Hook State Lifecycle

```
hook:ready → hook:in-progress → closed
    ↑              ↓
    └─ (crash) ─────┘
    └─ (max retries) → hook:failed
```

### State Labels

| Label | Meaning | Next States |
|-------|---------|-------------|
| `hook:ready` | Work available for claim | → `hook:in-progress` |
| `hook:in-progress` | Agent actively working | → `closed`, `hook:ready` (crash), `hook:failed` |
| `hook:failed` | Failed after max retries | → `hook:ready` (manual requeue) |

## Usage

### Basic Example

```typescript
import { createHookQueue } from '@workwayco/harness';

// Create queue
const queue = createHookQueue({
  claimTimeoutMs: 10 * 60 * 1000,    // 10 minutes
  heartbeatIntervalMs: 60 * 1000,     // 1 minute
  maxRetries: 2,
});

// Agent loop
while (true) {
  // Claim work
  const result = await queue.claimWork();

  if (!result.success) {
    console.log('No work available:', result.reason);
    await sleep(30000); // Wait 30 seconds
    continue;
  }

  const { issue } = result;
  console.log(`Claimed: ${issue.id} - ${issue.title}`);

  try {
    // Do work
    await performWork(issue);

    // Complete
    await queue.completeWork(issue.id);
  } catch (error) {
    // Release on failure
    await queue.releaseWork(issue.id, error.message);
  }
}
```

### With Harness Integration

```typescript
import { createHookQueue, getOpenIssues } from '@workwayco/harness';

// Add work to the queue
const issues = await getOpenIssues({ labels: ['feature'] });
for (const issue of issues) {
  await bd(`label add ${issue.id} hook:ready`);
}

// Start multiple agents (each in separate process)
const queue = createHookQueue();
const claim = await queue.claimWork({ labels: ['feature'] });

if (claim.success) {
  // Agent owns this work now
  // Heartbeats automatically sent
  // Claim auto-released if agent crashes
}
```

### Cleanup on Shutdown

```typescript
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await queue.releaseAllClaims();
  process.exit(0);
});
```

## API Reference

### `HookQueue`

#### Constructor

```typescript
new HookQueue(config?: Partial<HookQueueConfig>, cwd?: string)
```

#### Methods

##### Work Management

```typescript
// Claim available work
claimWork(options?: {
  labels?: string[];
  priority?: number;
}): Promise<ClaimResult>

// Release work back to queue
releaseWork(issueId: string, reason?: string): Promise<void>

// Mark work as complete
completeWork(issueId: string): Promise<void>

// Mark work as failed (after max retries)
markFailed(issueId: string, reason: string): Promise<void>
```

##### Queue Inspection

```typescript
// Get available work
getAvailableWork(): Promise<BeadsIssue[]>

// Get in-progress work
getInProgressWork(): Promise<BeadsIssue[]>

// Get failed work
getFailedWork(): Promise<BeadsIssue[]>

// Get queue statistics
getStats(): Promise<{
  ready: number;
  inProgress: number;
  failed: number;
  staleClaims: number;
}>
```

##### Maintenance

```typescript
// Detect and release stale claims
releaseStaleClaims(): Promise<string[]>

// Requeue failed work (if under retry limit)
requeueFailed(issueId: string): Promise<boolean>

// Release all claims held by this agent
releaseAllClaims(): Promise<void>
```

### Configuration

```typescript
interface HookQueueConfig {
  claimTimeoutMs: number;        // Claim expiry (default: 10 minutes)
  heartbeatIntervalMs: number;   // Heartbeat frequency (default: 1 minute)
  maxRetries: number;            // Max retry attempts (default: 2)
}
```

## Architecture Details

### Atomicity

Claims are atomic via Beads label operations:
1. Remove `hook:ready` label
2. Add `hook:in-progress` label
3. Update issue status to `in_progress`

If the agent crashes between steps, Beads maintains consistency.

### Heartbeats

Active claims send heartbeats every `heartbeatIntervalMs` to update `lastHeartbeat` timestamp. Claims without heartbeats for `claimTimeoutMs` are considered stale and auto-released.

### Claim Metadata

Claims store minimal metadata in issue descriptions:

```json
{
  "issueId": "ww-abc123",
  "agentId": "agent-12345-1234567890",
  "claimedAt": "2026-01-03T10:00:00.000Z",
  "lastHeartbeat": "2026-01-03T10:05:00.000Z",
  "title": "Feature: Add hook system"
}
```

**Note**: Current implementation uses in-memory heartbeats. Full persistence would require extending `bd` CLI to support description updates.

### Retry Tracking

Retry counts are tracked via markers in issue descriptions:

```html
<!-- RETRY_COUNT: 2 -->
```

After `maxRetries`, work is marked `hook:failed` and requires manual intervention.

## Beads Integration

The hook queue integrates with Beads via helper functions in `beads.ts`:

```typescript
// Mark work as ready for claim
await markAsHookReady(issueId);

// Mark work as claimed
await markAsHookInProgress(issueId);

// Mark work as failed
await markAsHookFailed(issueId);

// Remove all hook labels
await removeHookLabels(issueId);

// Get all hook issues
const hookIssues = await getHookIssues();
```

## Testing

Run hook queue tests:

```bash
pnpm test hook-queue
```

All tests pass (13/13).

## Limitations & Future Work

### Current Limitations

1. **Heartbeat persistence**: Heartbeats are in-memory only. If the queue process restarts, claim metadata is lost (but labels persist).
2. **Description updates**: Retry counts and claim metadata require `bd` CLI extension for description updates.
3. **Cross-process coordination**: Each `HookQueue` instance is independent. No shared state across processes.

### Phase 2 Enhancements

1. **SQLite-backed claims**: Store claim metadata in `.beads/hooks.db` for persistence.
2. **Witness pattern**: Separate observer process monitors all agents and releases stale claims.
3. **Convoy integration**: Link hook issues to convoy groups for multi-repo work.
4. **Molecular steps**: Hook system for individual molecule steps (finer granularity).

## Comparison to Manual Resume

| Aspect | Manual Resume | Hook Queue |
|--------|---------------|------------|
| **Recovery** | Human intervention | Automatic |
| **State persistence** | AgentContext schema in `.harness/` | Beads labels (git-synced) |
| **Multi-agent** | Single agent only | Multiple agents |
| **Crash resilience** | Requires restart command | Auto-release on timeout |
| **Work visibility** | Hidden in harness state | Visible in `bd list` |

## Examples

### Multi-Agent Workflow

Terminal 1 (Agent A):
```bash
node agent-a.js
# Claims ww-abc123
# Sends heartbeats
# Completes work
```

Terminal 2 (Agent B):
```bash
node agent-b.js
# Claims ww-def456
# Crashes mid-work
# Claim expires after 10 minutes
```

Terminal 3 (Agent C):
```bash
node agent-c.js
# Sees ww-def456 auto-released
# Claims and completes it
```

### CLI Usage

```bash
# Create work
bd create "Fix button" --label hook:ready

# View queue
bd list --label hook:ready         # Available work
bd list --label hook:in-progress   # Active work
bd list --label hook:failed        # Failed work

# Manual intervention
bd label remove ww-abc hook:failed
bd label add ww-abc hook:ready     # Requeue failed work
```

## Integration with Harness Runner

The hook queue will be integrated into the harness runner in Phase 2:

```typescript
// packages/harness/src/runner.ts
import { createHookQueue } from './hook-queue.js';

async function runHarness(state: HarnessState) {
  const queue = createHookQueue();

  while (true) {
    const claim = await queue.claimWork({
      labels: [`harness:${state.id}`]
    });

    if (!claim.success) {
      await checkForRedirects();
      await sleep(30000);
      continue;
    }

    try {
      const result = await runSession(claim.issue);
      await queue.completeWork(claim.issue.id);
    } catch (error) {
      await queue.releaseWork(claim.issue.id, error.message);
    }
  }
}
```

## Related Issues

- **Cloudflare-x317**: Implement GAS TOWN role-based agents (Mayor/Polecat/Witness)
- **Cloudflare-gr00**: Add Refinery merge queue for code integration
- **Cloudflare-ejbe**: Integrate molecular workflow system (formulas → molecules)

## Resources

- [GAS TOWN Repository](https://github.com/steveyegge/gastown)
- [GAS TOWN Evaluation](../../docs/GASTOWN_EVALUATION.md)
- [Beads CLI Documentation](https://github.com/beadsland/beads)
