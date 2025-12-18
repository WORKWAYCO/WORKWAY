# @workwayco/agents

Multi-agent coordination layer for WORKWAY. Work stealing, priority management, and health monitoring.

## Installation

```bash
pnpm add @workwayco/agents
```

## Quick Start

```typescript
import { Coordinator } from '@workwayco/agents';

// Create coordinator with in-memory storage
const coordinator = new Coordinator();

// Register an agent
const agent = await coordinator.registerAgent({
  name: 'worker-1',
  capabilities: ['typescript', 'testing'],
  maxConcurrent: 2,
});

// Work stealing loop
while (true) {
  const work = await coordinator.getNextWork(agent.id, agent.capabilities);

  if (work.claimed) {
    console.log(`Working on: ${work.issue.title}`);

    // Do the work...
    const result = await doWork(work.issue);

    // Report completion
    await coordinator.completeWork(work.claimId!, agent.id, {
      outcome: 'success',
      summary: 'Implemented the feature',
    });
  } else {
    // No work available, wait and retry
    await sleep(5000);
  }
}
```

## Core Components

### Coordinator (Unified API)

The `Coordinator` class combines all components into a single interface:

```typescript
const coordinator = new Coordinator({
  // Optional: custom storage implementations
  trackerStorage: new InMemoryStorage(),
  claimsStorage: new InMemoryClaimsStorage(),

  // Optional: priority scoring weights
  priority: {
    weights: {
      priority: 0.3,
      impact: 0.35,
      age: 0.1,
      connectivity: 0.15,
      project: 0.1,
    },
  },

  // Optional: claim TTL
  claimTtlMs: 5 * 60 * 1000, // 5 minutes
});
```

### Tracker (Task Graph)

Manages projects, issues, and dependencies:

```typescript
// Create a project
const project = await coordinator.tracker.createProject({
  name: 'Authentication System',
  description: 'Implement user auth',
});

// Create issues
const issue1 = await coordinator.tracker.createIssue({
  projectId: project.id,
  title: 'Design auth schema',
  priority: 3,
  capabilities: ['database'],
});

const issue2 = await coordinator.tracker.createIssue({
  projectId: project.id,
  title: 'Implement login endpoint',
  priority: 2,
  capabilities: ['typescript', 'api'],
});

// Add dependency (issue2 blocks on issue1)
await coordinator.tracker.addDependency({
  issueId: issue2.id,
  dependsOnId: issue1.id,
  type: 'blocks',
});

// Get ready issues (not blocked)
const ready = await coordinator.tracker.getReadyIssues();

// Get bottlenecks (high-impact blockers)
const bottlenecks = await coordinator.tracker.getBottlenecks(5);
```

### Claims (Work Stealing)

Prevents duplicate work with time-limited claims:

```typescript
// Register agent
const agent = await coordinator.claims.registerAgent({
  name: 'worker-1',
  capabilities: ['typescript'],
  maxConcurrent: 2,
});

// Claim an issue
const claim = await coordinator.claims.claimIssue({
  agentId: agent.id,
  issueId: 'issue-123',
  ttlMs: 5 * 60 * 1000, // 5 minutes
});

// Send heartbeat (extends claims)
await coordinator.claims.heartbeat(agent.id);

// Release claim when done
await coordinator.claims.releaseClaim(claim.claim!.id, agent.id);
```

### Priority (Scoring)

Weighted priority scoring for issue ordering:

```typescript
// Get all priority scores
const scores = await coordinator.getPriorityScores();

// Get top issues
const top5 = await coordinator.priority.getTopIssues(coordinator.tracker, 5);

// Get bottlenecks with scores
const bottlenecks = await coordinator.getBottlenecks(5);
```

**Scoring weights:**
| Component | Weight | Description |
|-----------|--------|-------------|
| Priority | 0.30 | User-assigned priority (0-4) |
| Impact | 0.35 | How many issues unblocked |
| Age | 0.10 | Time since creation |
| Connectivity | 0.15 | Graph centrality |
| Project | 0.10 | Project alignment boost |

### Router (Agent Assignment)

Matches issues to agents by capability:

```typescript
// Find best agent for an issue
const assignment = await coordinator.findBestAgent(issue);

if (assignment) {
  console.log(`Best agent: ${assignment.agentId}`);
  console.log(`Score: ${assignment.score}`);
  console.log(`Capability match: ${assignment.components.capability}`);
}
```

### Ethos (Health Monitoring)

Monitors system health and suggests remediations:

```typescript
// Get health metrics
const metrics = await coordinator.getHealthMetrics();
console.log(`Coherence: ${metrics.coherence}`);
console.log(`Velocity: ${metrics.velocity} issues/hour`);
console.log(`Blockage: ${metrics.blockage}`);

// Check for violations
const violations = await coordinator.checkHealth();
for (const v of violations) {
  console.log(`[${v.metric}] ${v.value} vs threshold ${v.threshold}`);
  console.log(`  Action: ${v.remediation}`);
}

// Get remediation suggestions
const remediations = await coordinator.getRemediations();
```

**Health metrics:**
| Metric | Target | Description |
|--------|--------|-------------|
| Coherence | ≥ 0.7 | Ratio of issues linked to projects |
| Velocity | - | Issues completed per hour (24h rolling) |
| Blockage | ≤ 0.3 | Ratio of blocked to open issues |
| Staleness | ≤ 7 days | Average age of open issues |
| Claim Health | ≥ 0.3 | Ratio of active claims to open issues |
| Agent Health | ≥ 0.5 | Ratio of active to registered agents |

## Dependency Types

| Type | Meaning |
|------|---------|
| `blocks` | Target cannot start until source completes |
| `informs` | Target should know about source |
| `discovered_from` | Target was discovered while working on source |
| `any_of` | Speculative parallelism - first to complete wins |

## Speculative Parallelism

Create multiple approaches; first completion wins:

```typescript
// Create competing approaches
const approachA = await coordinator.tracker.createIssue({
  title: 'Approach A: Use Redis',
  capabilities: ['redis'],
});

const approachB = await coordinator.tracker.createIssue({
  title: 'Approach B: Use PostgreSQL',
  capabilities: ['postgres'],
});

// Link with any_of to a goal
await coordinator.tracker.addDependency({
  issueId: approachA.id,
  dependsOnId: 'goal-issue',
  type: 'any_of',
});

await coordinator.tracker.addDependency({
  issueId: approachB.id,
  dependsOnId: 'goal-issue',
  type: 'any_of',
});

// When one completes successfully, others are auto-cancelled
```

## Custom Storage

Implement `TrackerStorage` and `ClaimsStorage` for persistent storage:

```typescript
import { TrackerStorage, ClaimsStorage, Coordinator } from '@workwayco/agents';

class MyTrackerStorage implements TrackerStorage {
  // Implement all methods...
}

class MyClaimsStorage implements ClaimsStorage {
  // Implement all methods...
}

const coordinator = new Coordinator({
  trackerStorage: new MyTrackerStorage(),
  claimsStorage: new MyClaimsStorage(),
});
```

## Design Philosophy

**Zuhandenheit**: The coordination layer recedes. Agents focus on work; the mechanism disappears.

**Work Stealing**: Agents pull work rather than being assigned. No central scheduler bottleneck.

**Graceful Degradation**: Dead agents are detected via heartbeat; their claims expire automatically.
