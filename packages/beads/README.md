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

### Initialize

```bash
bd init
```

Creates `.beads/` directory with `config.json` and `issues.jsonl`.

### Create Issues

```bash
bd create "Implement user authentication"
bd create "Fix login bug" --priority 4 --type bug --labels security,urgent
```

### List & View

```bash
bd list                    # List open issues
bd list --all              # Include closed issues
bd show <id>               # Show issue details
```

### Update & Close

```bash
bd update <id> --status in_progress
bd update <id> --priority 3
bd close <id>
bd close <id> --comment "Completed in PR #123"
```

### Dependencies

```bash
bd dep add <id> <depends-on-id>           # Default: blocks
bd dep add <id> <depends-on-id> --type any-of
bd dep remove <id> <depends-on-id>
```

### Progress

```bash
bd progress                # Human-readable summary
bd ready                   # Issues ready to work on (not blocked)
bd blocked                 # Issues waiting on dependencies
```

### Robot Mode (for agents)

```bash
bv --robot-priority        # Priority-ranked issues as JSON
bv --robot-insights        # Graph analysis, bottlenecks
bv --robot-plan            # Suggested execution sequence
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
