# Harness Patterns

**Use the `harness` subagent** for autonomous work orchestration.

```bash
bd work ww-xyz                   # Work on Cloudflare issue
bd work wwp-abc                  # Work on platform issue
bd work --create "Fix button"    # Create and work
bd work --spec specs/feature.md  # Parse spec (Markdown or YAML)
```

The harness subagent handles: complexity detection, model routing, session protocols, two-stage completion (`code-complete` → `verified`), and Beads integration.

Invoke explicitly or let Claude delegate when `bd work` or harness operations are needed.

## Invocation Patterns

### Background Execution

For long-running work, run the harness in background mode:

```
run harness in the background: ultrathink
```

This:
1. Frees the main conversation for other work
2. Enables extended thinking for complex reasoning
3. Allows parallel workstreams

**When to use background**:
- Multi-file refactors
- Feature implementation from specs
- Work expected to exceed 10+ minutes

### Thinking Modes

| Mode | Use Case | Invocation |
|------|----------|------------|
| Default | Quick fixes, simple tasks | `run harness` |
| Ultrathink | Complex planning, architecture | `run harness in the background: ultrathink` |

**Ultrathink** enables extended reasoning—more thorough analysis, better decomposition, deeper consideration of edge cases. Use for non-trivial work.

### Example Invocations

```
# Simple: Work on a specific issue
run harness on ww-abc123

# Background with thinking: Complex feature work
run harness in the background: ultrathink

# With spec file
run harness on specs/auth-feature.yaml

# Create and work in one command
run harness: create and work on "Add teams endpoint"
```

## Spec Formats

The harness supports two spec formats (auto-detected):

### YAML (Recommended)

```yaml
title: Teams API Endpoint
property: cloudflare  # or platform
complexity: standard

features:
  - title: Teams list endpoint
    priority: 1
    files:
      - workway-platform/apps/api/src/routes/teams.ts
    acceptance:
      - test: Returns team list for authenticated user
        verify: pnpm test --filter=api
      - Team members included in response

  - title: Teams SDK method
    depends_on:
      - Teams list endpoint
    acceptance:
      - SDK exposes teams.list() method

requirements:
  - All endpoints require authentication
  - Rate limiting applied

success:
  - API tests pass
  - SDK tests pass
```

**YAML Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Project title (required) |
| `property` | enum | Target: `cloudflare`, `platform` |
| `complexity` | enum | Override: `trivial`, `simple`, `standard`, `complex` |
| `overview` | string | Brief description |
| `features` | array | List of features (required) |
| `requirements` | array | Technical requirements for all features |
| `success` | array | Project-level success criteria |

**Feature Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Feature title (required) |
| `description` | string | Detailed description |
| `priority` | int | P0-P4 (0=critical, default: 2) |
| `files` | array | Expected files to modify |
| `depends_on` | array | Feature titles this depends on |
| `acceptance` | array | Acceptance criteria (string or `{test, verify}`) |
| `labels` | array | Additional Beads labels |

### Markdown (Legacy)

Still supported but less structured:

```markdown
# Project Title

## Overview
Description...

## Features

### Feature Name
- Acceptance criterion 1
- Acceptance criterion 2
```

## Quality Gates

The harness implements three quality gate phases:

### Gate 1: Session Completion

| Requirement | Label | Notes |
|-------------|-------|-------|
| Tests pass | `code-complete` | Unit/integration tests |
| E2E passes | `verified` | End-to-end validation |
| Commit exists | `close` | Commit hash required |

```bash
# Session completes with passing tests
bd update ww-xyz --status code-complete

# E2E verified
bd update ww-xyz --status verified

# Close with commit reference
bd close ww-xyz
```

### Gate 2: Checkpoint Review

Triggered: every 3 sessions, every 4 hours, on failure, on redirect.

| Reviewer | Focus | Blocking |
|----------|-------|----------|
| Security | Auth, injection, secrets | Critical findings |
| Architecture | DRY violations (3+ files) | Critical findings |
| Quality | Testing, conventions | Non-blocking |

### Gate 3: Work Extraction

After checkpoint review, actionable findings become issues:

```bash
# Architecture finding → discovered issue
bd create "Extract shared validation logic" \
  --priority P2 \
  --label harness:supervisor \
  --label refactor

# Link to originating checkpoint
bd dep add <new-id> discovered-from <checkpoint-id>
```

## Discovered Work Taxonomy

| Label | Discovery Source | Priority Impact |
|-------|------------------|-----------------|
| `harness:blocker` | Blocks current work | +1 boost |
| `harness:related` | Related work discovered | None |
| `harness:supervisor` | Checkpoint review finding | None |
| `harness:self-heal` | Baseline fix needed | None |

## Pause/Resume with Context

Workflows can be interrupted and resumed anywhere. The AI figures out where it left off.

### AgentContext Schema

When a session pauses, it captures:

```typescript
interface AgentContext {
  filesModified: FileModification[];  // What files were changed
  issuesUpdated: IssueUpdate[];       // Issue status transitions
  currentTask: TaskProgress | null;   // Where we are in current work
  testState: TestState | null;        // Test results at pause time
  agentNotes: string;                 // Free-form observations
  blockers: string[];                 // Problems encountered
  decisions: Decision[];              // Choices made and rationale
  capturedAt: string;                 // When context was saved
}
```

### Recording Context During Work

```typescript
import {
  createCheckpointTracker,
  recordFileModification,
  recordDecision,
  addAgentNotes,
  recordTestState,
} from '@workwayco/harness';

const tracker = createCheckpointTracker();

// Record file changes
recordFileModification(tracker, {
  path: 'packages/sdk/src/teams.ts',
  summary: 'Added teams.list() method',
  changeType: 'modified',
  linesAdded: 45,
  linesRemoved: 12,
});

// Record decisions
recordDecision(tracker, {
  decision: 'Use cursor-based pagination',
  rationale: 'Better performance for large team lists',
  alternatives: ['offset pagination', 'page tokens'],
});

// Add notes for context
addAgentNotes(tracker, 'SDK method working. Need to add platform API next.');

// Record test state
recordTestState(tracker, {
  passed: 12,
  failed: 2,
  skipped: 1,
  failingTests: ['teams.test.ts: pagination', 'teams.test.ts: error handling'],
  durationMs: 3400,
});
```

### Resuming from Context

```typescript
import {
  loadAgentContext,
  generateResumeBrief,
  hasResumableContext,
} from '@workwayco/harness';

// Check if checkpoint has context
if (hasResumableContext(lastCheckpoint)) {
  const context = loadAgentContext(lastCheckpoint);
  const brief = generateResumeBrief(context);
  // Brief is markdown for session priming
}
```

## Self-Healing Baseline

Run quality gates before starting new work:

```bash
# Before claiming work
pnpm test          # Tests pass?
pnpm typecheck     # Types clean?
pnpm lint          # Lint clean?
```

If baseline is broken, fix before adding new code—otherwise failures accumulate.

### Configuration

```typescript
import { runBaselineCheck, DEFAULT_BASELINE_CONFIG } from '@workwayco/harness';

// Run all gates
const result = await runBaselineCheck(DEFAULT_BASELINE_CONFIG, cwd);

// Custom configuration
const result = await runBaselineCheck({
  enabled: true,
  gates: {
    tests: true,      // Run test suite
    typecheck: true,  // Run tsc --noEmit
    lint: true,       // Run eslint
    build: false,     // Skip build (expensive)
  },
  autoFix: true,        // Attempt eslint --fix
  createBlockers: true, // Create issues for failures
  maxAutoFixAttempts: 1,
  gateTimeoutMs: 5 * 60 * 1000,
  packageFilter: 'sdk', // Monorepo package filter
}, cwd);
```

### Gate Types

| Gate | Command | Auto-Fix | Notes |
|------|---------|----------|-------|
| `typecheck` | `tsc --noEmit` | No | Type errors require manual fix |
| `lint` | `eslint .` | Yes | `eslint --fix` for auto-fix |
| `tests` | `pnpm test` | No | Failing tests require investigation |
| `build` | `pnpm build` | No | Expensive, off by default |

### Blocker Issue Creation

When a gate fails and can't be auto-fixed:

```bash
# Auto-created issue
bd show ww-xyz

ww-xyz: [Self-Heal] Fix failing typecheck baseline
Priority: P1
Labels: harness:self-heal

Gate: typecheck
Command: pnpm --filter=sdk exec tsc --noEmit
Exit Code: 1
```

## Cross-Repo Work

When work spans both Cloudflare and workway-platform:

```bash
# Create linked issues
cd workway-platform
bd create --title="Add teams endpoint" --type=feature
# Returns: wwp-abc123

cd ../Cloudflare
bd create --title="Add teams to SDK" --type=feature
bd dep add ww-xyz789 wwp-abc123  # SDK blocked by API
```

The harness respects cross-repo dependencies and won't start blocked work.

## Failure Mode Reference

| Mode | Solution |
|------|----------|
| Premature completion | Require E2E before close |
| Context sprawl | Enforce one issue per session |
| Environment discovery | Use init.sh |
| Lost progress | Follow Session Startup Protocol |
| Shallow testing | E2E verification mandatory |
| Victory declaration | Check `bd list --status=open` |
| Commit amnesia | Commit after each unit |

## Daemon Coordination

The harness automatically:
1. Stops bd daemon at start (`bd daemon --stop`)
2. Runs all sessions with daemon off
3. Restarts bd daemon at end (`bd daemon --start`)

If harness crashes, manually restart: `bd daemon --start`

## Session Priming

Each session receives context including:

1. **Scope Guard**: Explicit constraint to work on ONE issue
2. **DRY Context**: Existing patterns and relevant files
3. **Recent Commits**: Git history for context
4. **Completion Criteria**: Two-stage (code complete + verified)
5. **Current Issue**: Full description and acceptance criteria

## Commands

```bash
# Via bd work (preferred)
bd work ww-xyz
bd work --spec specs/feature.md

# Via pnpm (legacy)
pnpm harness start specs/feature.md --mode workflow
pnpm harness pause --reason "Need human review"
pnpm harness resume
pnpm harness status
```

## Integration with Beads

- Issues created with `harness:<id>` label
- Checkpoints are issues (type: `checkpoint`)
- Uses `bd list` and `bd update` for state management
- Daemon stopped during harness runs to prevent sync conflicts
