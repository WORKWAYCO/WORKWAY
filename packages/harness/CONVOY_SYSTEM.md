# Convoy System: Cross-Project Work Grouping

**Status**: ✅ Implemented (Phase 2)
**Issue**: Cloudflare-bma5
**Inspired by**: GAS TOWN convoy pattern

## Overview

The Convoy System groups related work across multiple projects using `convoy:<name>` labels. It provides convoy-level progress tracking and coordinates multi-repo workflows.

**Zuhandenheit**: Convoys group work conceptually but recede during execution. You think "complete the auth refactor" not "manage convoy convoy:auth-refactor".

## Use Cases

| Scenario | Without Convoy | With Convoy |
|----------|---------------|-------------|
| **Cross-repo feature** | Track issues separately in each repo | Single convoy tracks progress across both repos |
| **Platform refactor** | Manual coordination across ww-* and wwp-* issues | Convoy auto-groups and tracks % complete |
| **Multi-team project** | Lost visibility into overall progress | Convoy dashboard shows unified progress |

## Architecture

### Lightweight Design

Convoys use **Beads labels** (no new data structures):
- `convoy:<name>` label groups related issues
- Special `type: convoy` issue stores metadata
- Progress calculated on-demand from issue states

### Cross-Repo Awareness

Convoys automatically detect participating repos from issue prefixes:
- `ww-*` → Cloudflare repo
- `wwp-*` → workway-platform repo

### Integration with Coordinator

The Coordinator supports convoy-aware work distribution:
```typescript
const coordinator = new Coordinator(harnessState, {
  cwd: process.cwd(),
  maxWorkers: 4,
  convoy: 'auth-refactor', // Enable convoy mode
});
```

When convoy mode is enabled, `getNextIssue()` prioritizes convoy issues.

## Usage

### Creating a Convoy

```typescript
import { createConvoy } from '@workwayco/harness';

const convoy = await createConvoy({
  name: 'auth-refactor',
  title: 'Authentication System Refactor',
  description: 'Modernize auth across API and SDK',
  issueIds: ['wwp-abc123', 'ww-def456'], // Initial issues
  cwd: process.cwd(),
});

console.log(`Created convoy: ${convoy.name}`);
console.log(`Progress: ${convoy.progress}%`);
```

### Adding Issues to Convoy

```typescript
import { createConvoySystem } from '@workwayco/harness';

const system = createConvoySystem();

// Add issue to existing convoy
await system.addToConvoy('auth-refactor', 'ww-xyz789');

// Remove issue from convoy
await system.removeFromConvoy('auth-refactor', 'ww-xyz789');
```

### Checking Progress

```typescript
import { getConvoy } from '@workwayco/harness';

const convoy = await getConvoy('auth-refactor');

console.log(`Total: ${convoy.totalIssues} issues`);
console.log(`Completed: ${convoy.completedIssues}`);
console.log(`In Progress: ${convoy.inProgressIssues}`);
console.log(`Overall: ${convoy.progress}%`);
```

### Visual Display

```typescript
import { displayConvoy } from '@workwayco/harness';

await displayConvoy('auth-refactor');
```

Output:
```
🚂 Convoy: auth-refactor
   Authentication System Refactor
   Modernize auth across API and SDK

   Progress:
     • Total: 8 issues
     • Completed: 5
     • In Progress: 2
     • Overall: 63%

   Repositories:
     • Cloudflare
     • workway-platform

   [████████████████████████░░░░░░░░░░░░░░░░] 63%
```

### Convoy-Aware Work Distribution

The Coordinator integrates convoy awareness:

```typescript
import { Coordinator } from '@workwayco/harness';

const coordinator = new Coordinator(harnessState, {
  cwd: process.cwd(),
  convoy: 'auth-refactor', // Prioritize convoy issues
});

await coordinator.initialize();
await coordinator.run();

// Check convoy progress
const progress = await coordinator.getConvoyProgress();
console.log(`Convoy progress: ${progress.progress}%`);
```

## CLI Integration

### Via Beads Labels

```bash
# Create convoy (via special issue type)
bd create "Auth Refactor Convoy" --type=convoy --label=convoy:auth-refactor

# Add issues to convoy
bd label add ww-abc123 convoy:auth-refactor
bd label add wwp-def456 convoy:auth-refactor

# List all convoy issues
bd list --label=convoy:auth-refactor

# Check convoy progress
bd ready --label=convoy:auth-refactor
```

### Via Harness

```bash
# Run harness in convoy mode
pnpm harness start specs/auth-refactor.yaml --convoy=auth-refactor

# Status check
pnpm harness status --convoy=auth-refactor
```

## Data Model

### Convoy Interface

```typescript
interface Convoy {
  name: string;                // Convoy name (from label)
  title: string;               // Human-readable title
  description: string;         // Purpose description
  totalIssues: number;         // Total issues in convoy
  completedIssues: number;     // Closed issues
  inProgressIssues: number;    // In-progress issues
  failedIssues: number;        // Failed issues
  progress: number;            // % complete (0-100)
  issueIds: string[];          // All issue IDs
  repos: string[];             // Participating repos
  createdAt: string;           // Creation timestamp
  updatedAt: string;           // Last update timestamp
}
```

### Progress Snapshot

```typescript
interface ConvoyProgress {
  name: string;                // Convoy name
  progress: number;            // % complete (0-100)
  total: number;               // Total issues
  completed: number;           // Completed issues
  inProgress: number;          // In-progress issues
  failed: number;              // Failed issues
  timestamp: string;           // Snapshot timestamp
}
```

## API Reference

### ConvoySystem Class

```typescript
class ConvoySystem {
  constructor(cwd?: string);

  // Create new convoy
  async createConvoy(options: ConvoyCreateOptions): Promise<Convoy>;

  // Get convoy by name
  async getConvoy(name: string, cwd?: string): Promise<Convoy>;

  // Add/remove issues
  async addToConvoy(convoyName: string, issueId: string, cwd?: string): Promise<void>;
  async removeFromConvoy(convoyName: string, issueId: string, cwd?: string): Promise<void>;

  // List all convoys
  async listConvoys(cwd?: string): Promise<Convoy[]>;

  // Get progress snapshot
  async getProgress(convoyName: string, cwd?: string): Promise<ConvoyProgress>;

  // Display status (CLI-friendly)
  async displayConvoy(convoyName: string, cwd?: string): Promise<void>;

  // Get next issue (for Coordinator)
  async getNextIssue(convoyName: string, cwd?: string): Promise<BeadsIssue | null>;
}
```

### Factory Functions

```typescript
// Create convoy system
function createConvoySystem(cwd?: string): ConvoySystem;

// Create convoy (convenience)
async function createConvoy(options: ConvoyCreateOptions): Promise<Convoy>;

// Get convoy (convenience)
async function getConvoy(name: string, cwd?: string): Promise<Convoy>;

// Display convoy (convenience)
async function displayConvoy(name: string, cwd?: string): Promise<void>;
```

## Integration with Existing Patterns

### Beads Dependencies

Convoys work alongside Beads cross-repo dependencies:

```bash
# API issue blocks SDK issue (Beads dependency)
bd dep add ww-xyz789 blocks wwp-abc123

# Both issues in same convoy (grouping)
bd label add ww-xyz789 convoy:auth-refactor
bd label add wwp-abc123 convoy:auth-refactor
```

**Difference**:
- **Dependencies**: Execution order (X blocks Y)
- **Convoys**: Conceptual grouping (X and Y are related)

### Hook Queue

Convoy issues can be hook-ready:

```bash
# Issue is both in convoy and hook-ready
bd label add ww-abc123 convoy:auth-refactor
bd label add ww-abc123 hook:ready
```

Coordinator prioritizes convoy + hook-ready issues.

### Molecules

Convoy can span multiple molecules:

```bash
# Molecule 1 in convoy
bd label add mol-auth-api convoy:auth-refactor

# Molecule 2 in convoy
bd label add mol-auth-sdk convoy:auth-refactor
```

## Comparison to GAS TOWN

| Feature | GAS TOWN | WORKWAY Convoy |
|---------|----------|----------------|
| **Grouping** | Convoy label | `convoy:<name>` label |
| **Storage** | Separate convoy file | Special Beads issue |
| **Progress** | Manual tracking | Auto-calculated from issues |
| **Cross-repo** | Multi-project coordination | ww-* vs wwp-* detection |
| **Integration** | Mayor/Polecat aware | Coordinator aware |

## When to Use Convoys

| Use Case | Use Convoy? | Alternative |
|----------|-------------|-------------|
| Feature spans 2+ repos | ✅ Yes | Cross-repo dependencies only |
| Multi-week refactor | ✅ Yes | Epic label + manual tracking |
| Team wants unified dashboard | ✅ Yes | Separate repo tracking |
| Single-repo feature | ❌ No | Standard harness |
| Unrelated issues | ❌ No | Separate tracking |

## Examples

### Example 1: Auth Refactor (Cross-Repo)

```typescript
// Create convoy
const convoy = await createConvoy({
  name: 'auth-refactor',
  title: 'Authentication System Refactor',
  description: 'Modernize auth across platform and SDK',
  issueIds: [
    'wwp-auth-001', // API: Add JWT support
    'wwp-auth-002', // API: Deprecate session cookies
    'ww-auth-003',  // SDK: JWT client
    'ww-auth-004',  // SDK: Update docs
  ],
});

// Run convoy-aware harness
const coordinator = new Coordinator(harnessState, {
  cwd: process.cwd(),
  maxWorkers: 2,
  convoy: 'auth-refactor',
});

await coordinator.run();

// Check progress
const progress = await coordinator.getConvoyProgress();
console.log(`Auth refactor: ${progress.progress}% complete`);
```

### Example 2: Platform Migration

```typescript
// Large-scale migration with many issues
const convoy = await createConvoy({
  name: 'v2-migration',
  title: 'Platform V2 Migration',
  description: 'Migrate all services to V2 architecture',
});

// Add issues as they're discovered
await convoy.addToConvoy('v2-migration', 'wwp-mig-001');
await convoy.addToConvoy('v2-migration', 'wwp-mig-002');
await convoy.addToConvoy('v2-migration', 'ww-mig-003');

// Monitor progress
const progress = await convoy.getProgress('v2-migration');
console.log(`Migration: ${progress.completed}/${progress.total} complete`);
```

## Future Enhancements

Potential additions (not implemented):

1. **Convoy Dependencies**: One convoy blocks another
2. **Convoy Templates**: Reusable convoy structures
3. **Cross-Org Convoys**: Span multiple Beads repositories
4. **Convoy Analytics**: Time estimates, velocity tracking
5. **Convoy Notifications**: Slack/email on milestones

## Philosophy

**Zuhandenheit Applied**: The convoy recedes into transparent use. You describe work by outcome ("finish the auth refactor"), not mechanism ("update convoy:auth-refactor progress").

The tool disappears. The work remains.
