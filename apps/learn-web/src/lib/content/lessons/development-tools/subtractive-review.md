# The Subtractive Triad

## Learning Objectives

By the end of this lesson, you will be able to:

- Apply the three-pass review methodology to any codebase
- Identify DRY violations, over-engineering, and broken connections
- Document removals and the insights they reveal
- Practice "addition through subtraction" in code review

---

The Subtractive Triad is a three-pass code review methodology that moves from technical to philosophical: DRY (Eliminate), Rams (Simplify), Heidegger (Reconnect).

## The Three Passes

### Pass 1: DRY (Eliminate)

**Goal**: Remove duplication.

Look for:
- Copy-pasted code blocks
- Similar functions with minor variations
- Repeated patterns that could be abstracted
- Duplicate data structures

```typescript
// Before: Duplication
async function getUserById(id: string) {
  const user = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw new NotFoundError('User not found');
  return user;
}

async function getTeamById(id: string) {
  const team = await db.select().from(teams).where(eq(teams.id, id));
  if (!team) throw new NotFoundError('Team not found');
  return team;
}

// After: Single abstraction
async function getById<T>(table: Table<T>, id: string, name: string): Promise<T> {
  const result = await db.select().from(table).where(eq(table.id, id));
  if (!result) throw new NotFoundError(`${name} not found`);
  return result;
}
```

**Caution**: Don't create abstractions for things that just happen to look similar. The duplication should represent a genuine concept.

### Pass 2: Rams (Simplify)

**Goal**: Remove unnecessary complexity.

Apply Rams' tenth principle: "Good design is as little design as possible."

Look for:
- Configuration options that could be defaults
- Abstractions without multiple implementations
- Features no one uses
- Code that anticipates futures that won't arrive

```typescript
// Before: Over-configured
interface NotificationConfig {
  channel: string;
  format: 'markdown' | 'plain' | 'html';
  mentionUsers: boolean;
  threadReplies: boolean;
  unfurlLinks: boolean;
  unfurlMedia: boolean;
  iconEmoji?: string;
  iconUrl?: string;
  username?: string;
}

// After: Essential only
interface NotificationConfig {
  channel: string;
  // Everything else: tested defaults
}
```

**Question to ask**: "If I removed this, would anyone notice?"

### Pass 3: Heidegger (Reconnect)

**Goal**: Restore coherent meaning.

After removing duplication and simplifying, check that the code still tells a coherent story.

Look for:
- Names that no longer match their purpose
- Orphaned helper functions
- Broken conceptual connections
- Lost context

```typescript
// After simplification, reconnect meaning:

// Before: Name suggests more than it does
class WorkflowOrchestrationEngine {
  async run(workflow: Workflow) {
    return workflow.execute();
  }
}

// After: Name matches reality
async function runWorkflow(workflow: Workflow) {
  return workflow.execute();
}
```

**Question to ask**: "Does this name/structure still make sense after what we removed?"

## The Review Process

### Step 1: Full Read-Through

Read the entire file or PR without making changes. Note patterns.

### Step 2: DRY Pass

Mark all duplications. Decide which are genuine concepts worth abstracting.

```
[ ] Lines 45-67 duplicate lines 102-124 (user validation)
[ ] Error handling repeated in 5 places
[ ] Config parsing in 3 locations
```

### Step 3: Rams Pass

Mark all unnecessary complexity. Decide what can be removed.

```
[ ] RetryConfig has 12 options, only 2 used
[ ] AbstractProcessor base class has 1 implementation
[ ] Feature flags for features we never toggle
```

### Step 4: Heidegger Pass

After removals, check coherence. Rename and restructure as needed.

```
[ ] "DataProcessor" now just transforms dates → rename to "formatDates"
[ ] "utils/helpers.ts" is now empty → delete
[ ] "validateAndProcess" now only validates → rename to "validate"
```

### Step 5: Document Insights

The most valuable part: what did the removals teach you?

```markdown
## Insights from Subtractive Review

### What we removed
- 3 unused configuration options
- 1 abstract base class (single implementation)
- 47 lines of "future-proofing" code

### What we learned
- The retry logic is simpler than we thought
- We don't actually need pluggable notification providers
- The "flexible" config was never varied
```

## Common Patterns

### Pattern: The Prophetic Abstraction

Code written for a future that never arrives:

```typescript
// Written 2 years ago, still single implementation
abstract class BasePaymentProvider {
  abstract processPayment(amount: number): Promise<Result>;
}

class StripePaymentProvider extends BasePaymentProvider {
  // The only implementation
}

// Subtractive fix: Remove abstraction
async function processStripePayment(amount: number): Promise<Result> {
  // Direct implementation
}
```

### Pattern: The Verbose Helper

Helper functions that don't help:

```typescript
// Helper that adds ceremony, not clarity
function makeApiCall<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: object,
  headers?: Record<string, string>
): Promise<T> {
  return fetch(url, { method, body: JSON.stringify(body), headers }).then(r => r.json());
}

// Subtractive fix: Just use fetch
const data = await fetch(url).then(r => r.json());
```

### Pattern: The Config Explosion

Options that are never varied:

```typescript
// 15 config options, all always set to defaults
const config = getConfig({
  retries: 3,        // Always 3
  timeout: 5000,     // Always 5000
  format: 'json',    // Always json
  // ... 12 more
});

// Subtractive fix: Hardcode the constants
const RETRIES = 3;
const TIMEOUT = 5000;
```

## Praxis

Apply the Subtractive Triad to real code:

> **Praxis**: Select a file or PR in your current project. Apply all three passes:
> 1. **DRY pass**: List all duplications. Remove or abstract the genuine ones.
> 2. **Rams pass**: List all unnecessary complexity. Remove what won't be missed.
> 3. **Heidegger pass**: Check coherence. Rename/restructure as needed.
>
> Document what you removed and what insight emerged from the removal.

The insight is often more valuable than the removal itself.

## Metrics

Track your subtractive reviews:

| Metric | Description |
|--------|-------------|
| Lines removed | Raw count of deleted lines |
| Abstractions removed | Base classes, interfaces, helpers eliminated |
| Configs simplified | Options converted to constants |
| Insights documented | What you learned from removing |

**Goal**: The ratio of lines removed to insights gained should trend upward. Early reviews remove obvious duplication. Later reviews reveal architectural insights.

## Reflection

- When is duplication acceptable?
- How do you know when simplification has gone too far?
- What's the relationship between removal and understanding?
