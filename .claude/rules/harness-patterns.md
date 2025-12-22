# Harness Patterns

Autonomous agent orchestration for WORKWAY development.

## Philosophy

The harness runs autonomously. Humans engage through **progress reports**—reactive steering rather than proactive management.

**Zuhandenheit**: The harness recedes into transparent operation. When working, you don't think about the harness—you review progress and redirect when needed.

## Core Constraints

| Constraint | Rationale | Enforcement |
|------------|-----------|-------------|
| **One feature per session** | Prevents scope creep; enables clean commits | Scope Guard in priming |
| **Beads is the only progress system** | DRY—no separate progress files | Architecture |
| **Commit before close** | Work without commits is lost work | Close reason must include commit |
| **Two-stage completion** | Prevents premature victory | `code_complete` → `verified` |
| **E2E before verified** | Unit tests aren't enough | Manual or automated check required |

## Two-Stage Verification

Sessions can return five outcomes:

| Outcome | Meaning | Action |
|---------|---------|--------|
| `success` | Feature verified end-to-end | Close issue |
| `code_complete` | Code written, tests pass, not yet verified | Keep in_progress, verify next |
| `failure` | Session failed with errors | Keep for retry |
| `partial` | Blocked, needs clarification | Keep in_progress |
| `context_overflow` | Ran out of tokens | Skip or break down |

**Workflow**:
```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│ in_progress │ ──► │ code_complete│ ──► │  verified  │
│             │     │ (tests pass) │     │ (E2E pass) │
└─────────────┘     └──────────────┘     └────────────┘
                           │                    │
                           │                    ▼
                           │              ┌──────────┐
                           └─────────────►│  closed  │
                                          └──────────┘
```

## Failure Mode Reference

Explicit mapping of failure patterns to solutions:

| Failure Mode | Symptom | Root Cause | Solution |
|--------------|---------|------------|----------|
| **Premature completion** | Agent says "done" but feature broken | No verification step | Require E2E test pass before close |
| **Context sprawl** | Multiple features touched, none complete | Scope creep | Enforce ONE issue per session in priming |
| **Environment discovery** | Wasted tokens on setup commands | No init script | Add `init.sh` or document startup |
| **Lost progress** | Agent re-implements completed work | Context not recovered | Use session priming with recent commits |
| **Shallow testing** | Only unit tests, integration broken | E2E not mandated | Add browser/CLI verification step |
| **Dependency cascade** | Blocked issues pile up | Poor dependency graph | Run `bd blocked` before session |
| **Victory declaration** | "Project complete" with open issues | No source of truth check | Verify against `bd list --status=open` |
| **Commit amnesia** | Work done but not committed | No commit discipline | Commit after each logical unit |

## Prevention Patterns

```bash
# Before marking ANY issue complete:
1. Run tests:        pnpm test (or workway test)
2. Verify E2E:       Test in browser or CLI
3. Check issue:      bd show <id>  # Confirm correct issue
4. Commit:           git commit -m "feat(<scope>): <desc>"
5. Close:            Harness closes automatically on success

# Before declaring session complete:
bd list --status=open            # Any remaining work?
bd blocked                       # Any blocked issues?
git status                       # Uncommitted changes?
```

## Daemon Coordination

**Critical**: The Beads daemon's git sync can overwrite SQLite data.

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
# Start harness
pnpm harness start specs/feature.md --mode workflow

# Pause
pnpm harness pause --reason "Need human review"

# Resume
pnpm harness resume

# Status
pnpm harness status
```

## Integration with Beads

- Issues created with `harness:<id>` label
- Checkpoints are issues (type: `checkpoint`)
- Uses `bd list` and `bd update` for state management
- Daemon stopped during harness runs to prevent sync conflicts
