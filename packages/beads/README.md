# @workwayco/beads

Lightweight issue tracking for autonomous agent harnesses. File-based storage with JSONL append-only log.

## Installation

```bash
pnpm add @workwayco/beads
```

## CLI Usage

Two CLIs are provided:
- `bd` - Human mutations (create, update, close)
- `bv` - Robot-friendly views (JSON output for agents)

### Quick Start for Agents

```bash
bd onboard                 # Get started guide
bd prime                   # Load session context
bd work "Task title"       # Create and claim atomically
bd close <id> --reason "Done"
bd sync                    # Sync with git
```

### Initialize

```bash
bd init
```

Creates `.beads/` directory with `config.json` and `issues.jsonl`.

### Work on Issues

```bash
bd work "Implement user authentication"       # Create + start working
bd work --id ww-abc123                        # Work on existing issue
bd work                                       # Auto-select highest priority ready issue
```

### Create Issues

```bash
bd create "Implement user authentication"
bd create "Fix login bug" --priority P1 --type bug --labels security,urgent
bd create --title "Task" --type feature       # Alternative syntax
bd create "Task" --json                       # Output as JSON
```

### List & View

```bash
bd list                    # List open issues
bd list --all              # Include closed issues
bd list --json             # Output as JSON
bd list --limit 5          # Limit results
bd list --label bug        # Filter by label
bd list --status in_progress
bd show <id>               # Show issue details
bd show <id> --json        # Output as JSON
```

### Update & Close

```bash
bd update <id> --status in_progress
bd update <id> --priority P3
bd update <id> --description "New description"
bd close <id>
bd close <id> --reason "Completed in PR #123"
bd close <id> --comment "Fixed"               # Alias for --reason
```

### Session Management

```bash
bd prime                   # Load context at session start
bd onboard                 # Quick start guide
bd sync                    # Sync .beads/ with git staging
```

### Dependencies

```bash
bd dep add <id> <depends-on-id>           # Default: blocks
bd dep add <id> <depends-on-id> --type any-of
bd dep remove <id> <depends-on-id>
```

### Progress & Status

```bash
bd progress                # Human-readable summary
bd progress --json         # Output as JSON
bd ready                   # Issues ready to work on (not blocked)
bd ready --json            # Output as JSON
bd ready --label bug       # Filter by label
bd ready --limit 3         # Limit results
bd blocked                 # Issues waiting on dependencies
bd blocked --json          # Output as JSON
```

### Robot Mode (for agents)

```bash
bv --robot-priority        # Priority-ranked issues as JSON
bv --robot-insights        # Graph analysis, bottlenecks
bv --robot-plan            # Suggested execution sequence
```

### Molecules (Multi-Step Workflows)

Molecules are multi-step workflow templates using a chemistry metaphor:

| Phase | Type | Persistence | Use Case |
|-------|------|-------------|----------|
| **Solid** | Proto | Template (reusable) | Workflow patterns |
| **Liquid** | Mol | Persistent (git-synced) | Feature work |
| **Vapor** | Wisp | Ephemeral (gitignored) | Scratch work |

```bash
bd mol current             # Show current molecule context
bd mol catalog             # List available templates (protos)
bd mol show <id>           # Show molecule structure
bd mol spawn <proto-id>    # Create molecule from template
bd pour <proto-id>         # Alias for mol spawn
```

Create a template by labeling an epic:
```bash
bd label add <epic-id> template
```

## Programmatic API

```typescript
import { BeadsStore } from '@workwayco/beads';

const store = new BeadsStore('/path/to/project');
await store.init();

// Create issue
const issue = await store.createIssue({
  title: 'Implement feature X',
  priority: 3,
  issue_type: 'feature',
  labels: ['enhancement'],
});

// Add dependency
await store.addDependency(issue.id, 'other-issue-id', 'blocks');

// Get ready issues (not blocked)
const ready = await store.getReadyIssues();

// Get progress
const progress = await store.getProgress();
console.log(`${progress.completed}/${progress.total} issues completed`);
```

## File Format

```
.beads/
├── config.json           # Project configuration
├── issues.jsonl          # Append-only issue log
└── checkpoints/          # Checkpoint reports (optional)
```

### Issue Schema

```typescript
interface Issue {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 0 | 1 | 2 | 3 | 4;  // 0=lowest, 4=highest
  issue_type: 'bug' | 'feature' | 'task' | 'epic' | 'chore';
  labels: string[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  metadata: Record<string, unknown>;
}
```

### Dependency Types

| Type | Meaning |
|------|---------|
| `blocks` | Target cannot start until source completes |
| `any-of` | Speculative parallelism - first to complete wins |
| `parent-child` | Hierarchical relationship |
| `related` | Informational link |
| `discovered-from` | Issue discovered while working on another |

## Design Philosophy

**Zuhandenheit**: The tool recedes. Agents see JSON; humans see summaries. The mechanism disappears.

**Weniger, aber besser**: Minimal schema, maximum utility. No unnecessary fields.
