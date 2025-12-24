# Beads Workflow

Issue tracking that recedes into transparent operation.

## Quick Reference

```bash
bd ready              # Available work (open, not blocked)
bd show <id>          # View issue details
bd sync               # Commit beads to git
bd list --status=open # All open issues
bd blocked            # Issues waiting on dependencies
```

## Issue Prefixes

| Repo | Prefix | Example |
|------|--------|---------|
| Cloudflare | `ww` | `ww-42` |
| workway-platform | `wwp` | `wwp-17` |

## Label Conventions

### Scope (where the code lives)

| Label | Directory |
|-------|-----------|
| `integrations` | `packages/integrations/` |
| `workflows` | `packages/workflows/` |
| `workers` | `packages/workers/` |
| `sdk` | `packages/sdk/` |
| `cli` | `packages/cli/` |
| `harness` | Harness infrastructure |

### Type (what kind of work)

| Label | Meaning |
|-------|---------|
| `feature` | New capability |
| `bug` | Something broken |
| `task` | Implementation work |
| `experiment` | Research/POC |
| `chore` | Maintenance/cleanup |
| `epic` | Multi-issue initiative |

### Priority

| Label | Meaning |
|-------|---------|
| `P0` | Critical (blocks everything) |
| `P1` | High (do this week) |
| `P2` | Medium (default) |
| `P3` | Low (backlog) |
| `P4` | Someday (nice to have) |

## Creating Issues

```bash
# Create with labels
bd create "Implement Zoom OAuth refresh" --label integrations --label feature --label P1

# Directory-aware auto-labeling
# Files in packages/integrations/ auto-get 'integrations' label
```

## Status Flow

```
open → in_progress → code_complete → verified → closed
                           ↓
                       (E2E test)
```

**Two-stage completion**: Code passing tests is `code_complete`. E2E verification makes it `verified`. See `harness-patterns.md` for details.

## Harness Integration

Issues created by harness get `harness:<run-id>` label:

```bash
bd list --label harness           # All harness-created issues
bd list --label harness:abc123    # Specific run
```

## Daemon Coordination

The Beads daemon syncs changes to git. During harness runs, daemon is stopped to prevent conflicts:

```bash
bd daemon --status    # Check if running
bd daemon --stop      # Stop daemon
bd daemon --start     # Start daemon
```

## Zuhandenheit

Beads recedes into the workflow:
- Issues are the single source of truth (DRY)
- Auto-labeling reduces ceremony
- `bd ready` shows exactly what to work on next
- No separate progress tracking needed
