# @workwayco/harness

Autonomous agent harness for WORKWAY. Multi-session project execution with checkpoints and human steering.

## Installation

```bash
pnpm add @workwayco/harness
```

## CLI Usage

### Start a Harness

```bash
# Workflow mode - building WORKWAY marketplace workflows
workway-harness start specs/my-workflow.md --mode workflow

# Platform mode - developing WORKWAY platform itself
workway-harness start specs/feature.md --mode platform
```

### Options

```bash
--mode <mode>              # 'workflow' or 'platform' (required)
--checkpoint-every <n>     # Sessions between checkpoints (default: 3)
--max-hours <n>            # Auto-pause after N hours (default: 8)
--confidence <n>           # Pause if confidence below threshold (default: 0.7)
--dry-run                  # Parse spec, show issues, don't execute
```

### Control

```bash
workway-harness pause                    # Pause the harness
workway-harness pause --reason "Need review"
workway-harness resume                   # Resume paused harness
workway-harness status                   # Show current status
```

## Programmatic API

```typescript
import {
  initializeHarness,
  runHarness,
  pauseHarness,
  resumeHarness,
  getHarnessStatus,
} from '@workwayco/harness';

// Initialize from spec file
const { harnessState, featureMap } = await initializeHarness({
  specFile: 'specs/my-project.md',
  mode: 'workflow',
  checkpointEvery: 3,
  maxHours: 8,
  confidenceThreshold: 0.7,
}, process.cwd());

// Run the harness loop
await runHarness(harnessState, { cwd: process.cwd() });

// Or control manually
await pauseHarness(harnessState.id, 'Taking a break', process.cwd());
await resumeHarness(harnessState.id, process.cwd());
const status = await getHarnessStatus(harnessState.id, process.cwd());
```

## Spec File Format

Markdown PRD with features marked by `## Feature:` headers:

```markdown
# My Workflow Project

Overview of what we're building.

## Feature: User Authentication

Implement OAuth2 login flow.

### Acceptance Criteria
- Users can sign in with Google
- Session persists across page refreshes
- Logout clears all tokens

## Feature: Data Sync

Sync data between services.

### Acceptance Criteria
- Real-time sync via webhooks
- Batch sync for historical data
```

## Modes

### Workflow Mode

Optimized for building WORKWAY marketplace workflows:
- Primes agent with `defineWorkflow()` patterns
- Expects `workway test` for validation
- Follows Zuhandenheit principles

### Platform Mode

Optimized for developing WORKWAY platform:
- Primes agent with package conventions
- TypeScript compilation checks
- Test suite execution

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         HARNESS                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Spec Parser ──► Runner ──► Session Spawner                 │
│       │            │              │                          │
│       │            │              ▼                          │
│       │            │        Claude Code CLI                  │
│       │            │              │                          │
│       │            ▼              │                          │
│       │      Checkpoint ◄────────┘                          │
│       │        Tracker                                       │
│       │            │                                         │
│       ▼            ▼                                         │
│    Beads ◄──── Redirect                                     │
│   (Issues)     Detector                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Session Outcomes

| Outcome | Meaning |
|---------|---------|
| `success` | Issue completed, all criteria met |
| `partial` | Some progress, but not complete |
| `failure` | Could not complete the issue |
| `context_overflow` | Session ran out of context |

## Checkpoints

Checkpoints are generated:
- Every N sessions (configurable)
- After redirect detection (priority changes)
- Before auto-pause

```typescript
interface Checkpoint {
  id: string;
  sessionNumber: number;
  summary: string;
  issuesCompleted: string[];
  issuesInProgress: string[];
  issuesFailed: string[];
  confidence: number;
  redirectNotes: string[];
  createdAt: string;
}
```

## Redirect Detection

The harness monitors for human steering:
- Priority changes on issues
- New urgent issues created
- Explicit pause requests
- Status changes outside harness control

When detected, the harness adapts its execution plan.

## Design Philosophy

**Zuhandenheit**: The harness recedes into transparent operation. Humans engage through progress reports—reactive steering rather than proactive management.

**Bounded Attention**: Each session gets focused priming context with only relevant information.

**Graceful Degradation**: Pause on low confidence rather than making poor decisions.
