# Beads Workflow

Agent-native task management. The tool recedes; the work remains.

## Session Workflow

```bash
# Session Start: What's highest impact?
bv --robot-priority

# During Work: Capture and track
bd create "Discovered task"
bd update <id> --status in-progress
bd dep add <id> blocks <other>

# Session End: Close and verify
bd close <id>
bd sync
```

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
| Cloudflare | `ww-` | `ww-abc123` |
| workway-platform | `wwp-` | `wwp-xyz789` |

Each repo has its own `.beads/issues.jsonl`. Issues stay with their code.

## Command Reference

### View Commands
```bash
bd list                 # All open issues
bd ready                # Unblocked work
bd show <id>            # Issue details
bd blocked              # Blocked issues with reasons
bv --robot-priority     # AI-optimized priority output
bv --robot-insights     # Graph analysis
```

### Mutation Commands
```bash
bd create "Task"                         # Create issue
bd create "Task" --priority P1           # With priority
bd update <id> --status in-progress      # Update status
bd close <id>                            # Mark done
bd label add <id> sdk                    # Add label
bd dep add <id> blocks <other>           # Add dependency
```

## Molecules & Chemistry (v0.34.0)

The molecule system uses a chemistry metaphor for work templates:

| Phase | Type | Persistence | Use Case |
|-------|------|-------------|----------|
| **Solid** | Proto | Template (reusable) | Workflow patterns |
| **Liquid** | Mol | Persistent (git-synced) | Feature work |
| **Vapor** | Wisp | Ephemeral (gitignored) | Scratch work, experiments |

### Protos (Templates)
```bash
# Create a proto from an existing epic
bd label add <epic-id> template

# View available protos
bd mol catalog

# Show proto structure
bd mol show <proto-id>

# Extract proto from ad-hoc work (reverse engineering)
bd mol distill <epic-id> --name "workflow-name"
```

### Spawning Molecules
```bash
# Create persistent mol from proto (solid → liquid)
bd pour <proto-id> --var name=auth

# Create ephemeral wisp from proto (solid → vapor)
bd wisp create <proto-id> --var name=experiment

# Full syntax with options
bd mol spawn <proto-id> --var key=value --assignee agent
```

### Wisps (Ephemeral Molecules)
Wisps live in `.beads-wisp/` (gitignored). Use for:
- Scratch work during exploration
- Experiments that may not pan out
- Session-scoped tasks

```bash
# Create wisp from proto
bd wisp create <proto-id>

# List all wisps with staleness
bd wisp list

# Garbage collect orphaned wisps
bd wisp gc

# Compress wisp to permanent digest
bd mol squash <wisp-id>

# Delete wisp without trace
bd mol burn <wisp-id>
```

### Bonding (Combining Work)
```bash
# Attach proto to existing mol
bd mol bond <mol-id> <proto-id>

# Force spawn as wisp when attaching
bd mol bond <mol-id> <proto-id> --wisp

# Force spawn as persistent mol
bd mol bond <wisp-id> <proto-id> --pour
```

## Label Conventions

### Scope (where the code lives)

| Label | Directory |
|-------|-----------|
| `integrations` | `packages/integrations/` |
| `workflows` | `packages/workflows/` |
| `workers` | `packages/workers/` |
| `sdk` | `packages/sdk/` |
| `cli` | `packages/cli/` |
| `api` | `workway-platform/apps/api/` |
| `web` | `workway-platform/apps/web/` |
| `harness` | Harness infrastructure |

### Type (what kind of work)

| Label | Meaning |
|-------|---------|
| `feature` | New capability |
| `bug` | Something broken |
| `task` | Implementation work |
| `experiment` | Research/POC |
| `refactor` | Structural improvement |
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

## Dependency Patterns

```bash
# X blocks Y (Y cannot start until X completes)
bd dep add <X> blocks <Y>

# Parent-child (hierarchical)
bd dep add <child> parent <parent>

# Related (informational)
bd dep add <X> related <Y>

# Discovered-from (audit trail)
bd dep add <new> discovered-from <source>
```

### Cross-Repo Dependencies

When API work blocks SDK work:
```bash
# In workway-platform
bd create --title="Add teams endpoint" --type=feature
# Returns: wwp-abc123

# In Cloudflare
bd create --title="Add teams to SDK" --type=feature
bd dep add ww-xyz789 wwp-abc123  # SDK blocked by API
```

### Cross-Project Dependencies (v0.34.0)

Reference issues across multiple Beads repositories:

```bash
# Configure additional repos
bd repo add /path/to/other/repo

# Add cross-project dependency
bd dep add <id> external:<repo>:<capability>

# Ship capability to satisfy external deps
bd ship <capability>

# bd ready filters by external dependency satisfaction
bd ready
```

## Robot Mode Flags

For AI agent consumption:

| Flag | Output |
|------|--------|
| `--robot-priority` | PageRank + Critical Path ranking |
| `--robot-insights` | Bottleneck and keystone detection |
| `--robot-plan` | Suggested execution sequence |

These provide machine-readable JSON output.

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

For autonomous multi-issue work:
```bash
cd Cloudflare  # or workway-platform
bd work specs/feature.md
```

See `harness-patterns.md` for full harness reference.

## Daemon Coordination

The Beads daemon syncs changes to git. During harness runs, daemon is stopped to prevent conflicts:

```bash
bd daemon --status    # Check if running
bd daemon --stop      # Stop daemon
bd daemon --start     # Start daemon
```

## Files

```
.beads/
├── beads.db      # Local SQLite cache (gitignored)
├── issues.jsonl  # Source of truth (Git-synced)
└── config.yaml   # Repository configuration

.beads-wisp/      # Ephemeral molecules (gitignored)
└── wisp.db       # Wisp-only SQLite database
```

## Maintenance

```bash
# Check installation health
bd doctor

# Sync with remote
bd sync

# Garbage collect wisps
bd wisp gc

# Compact old closed issues
bd compact

# Migrate tombstones (if warned by doctor)
bd migrate-tombstones
```

## Integration with Claude Code

When starting a session:
1. Run `bv --robot-priority` to see highest-impact work
2. Use output to select focus area
3. Create issues for discovered tasks as you work
4. Close issues when completing work

**Goal**: Hermeneutic continuity across context boundaries.

## Philosophy

Issues are **commitments**, not tasks. Each issue is a promise that something will exist that doesn't exist yet.

The tool recedes: you think about work, not about issue tracking.
