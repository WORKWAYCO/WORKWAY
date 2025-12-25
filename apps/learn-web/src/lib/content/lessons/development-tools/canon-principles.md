# The Canon: Design System Enforcement

## Learning Objectives

By the end of this lesson, you will be able to:

- Understand the canonical patterns that guide WORKWAY development
- Apply the canon checklist before every commit
- Recognize and fix canon violations
- Maintain consistency across the codebase

---

The canon is the set of principles and patterns that maintain consistency across WORKWAY. It's enforced not by tooling alone, but by understanding.

## Core Canon Principles

### 1. Zuhandenheit First

Every feature must answer: **Does this help the tool recede?**

```typescript
// Canon violation: Makes user think about mechanism
configSchema: {
  webhookUrl: { required: true, label: 'Webhook URL' },
  webhookSecret: { required: true, label: 'Webhook Secret' },
  webhookVersion: { required: true, options: ['v1', 'v2', 'v3'] },
}

// Canon compliant: User thinks about outcome
configSchema: {
  notionWorkspace: { required: true, type: 'notion_workspace' },
  // Webhook handled automatically
}
```

### 2. Outcome-First Naming

Names describe outcomes, not mechanisms:

| Mechanism Name | Outcome Name |
|----------------|--------------|
| `ZoomOAuthIntegration` | `MeetingConnection` |
| `WebhookProcessor` | `RealTimeSync` |
| `CronJobManager` | `ScheduledUpdates` |
| `APIv3Endpoint` | `DataAccess` |

### 3. Canonical Design Tokens

Never hardcode visual values. Import from the design system:

```typescript
// Canon violation
const Card = styled.div`
  border-radius: 8px;
  opacity: 0.6;
  background: #1a1a1a;
`;

// Canon compliant
import { BRAND_RADIUS, BRAND_OPACITY, BRAND_COLORS } from '../lib/brand-design-system';

const Card = styled.div`
  border-radius: ${BRAND_RADIUS.md};
  opacity: ${BRAND_OPACITY.tertiary};
  background: ${BRAND_COLORS.black};
`;
```

### 4. BaseAPIClient Pattern

All integrations extend BaseAPIClient:

```typescript
// Canon violation: Raw fetch
async function getNotionPage(id: string) {
  const response = await fetch(`https://api.notion.com/pages/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return response.json();
}

// Canon compliant: BaseAPIClient
class NotionClient extends BaseAPIClient {
  async getPage(id: string) {
    return this.request<Page>({
      method: 'GET',
      path: `/pages/${id}`,
    });
  }
}
```

### 5. Error Message Standards

Errors are actionable, not technical:

```typescript
// Canon violation
throw new Error('ECONNREFUSED 127.0.0.1:5432');

// Canon compliant
throw new UserFacingError(
  'Database connection lost. Check your network and try again.',
  'DATABASE_UNAVAILABLE',
  { retryable: true }
);
```

### 6. Configuration Minimalism

Sensible defaults over configuration:

```typescript
// Canon violation: Everything configurable
interface WorkflowConfig {
  retryCount: number;
  retryDelay: number;
  timeout: number;
  logLevel: string;
  enableMetrics: boolean;
  metricsInterval: number;
  // ... 20 more
}

// Canon compliant: Tested defaults, minimal config
interface WorkflowConfig {
  timeout?: number;  // Only override if necessary
}

const DEFAULT_TIMEOUT = 30000;  // Tested optimal
```

## The Canon Checklist

Run before every commit:

### Code Quality
- [ ] **Zuhandenheit**: Does the tool recede?
- [ ] **Weniger, aber besser**: Can anything be removed?
- [ ] **Outcome naming**: Names describe outcomes, not mechanisms
- [ ] **No hardcoded values**: Design tokens imported from system

### Patterns
- [ ] **BaseAPIClient**: All integrations extend the base client
- [ ] **TypeScript types**: All interfaces defined in `.types.ts`
- [ ] **Error handling**: Errors are actionable, not technical
- [ ] **Configuration**: Sensible defaults, minimal required config

### Documentation
- [ ] **Self-documenting**: Code is clear without comments
- [ ] **No unnecessary comments**: Comments for "why", not "what"
- [ ] **Updated tests**: Tests cover the change

## Canon Violations and Fixes

### Violation: Exposed Mechanism

```typescript
// Violation
<button onClick={() => refreshOAuthToken(provider.id)}>
  Refresh OAuth Token
</button>

// Fix
<button onClick={() => reconnectService(provider.id)}>
  Reconnect {provider.name}
</button>
```

### Violation: Hardcoded Values

```typescript
// Violation
style={{ borderRadius: '8px', opacity: 0.6 }}

// Fix
style={{ borderRadius: BRAND_RADIUS.md, opacity: BRAND_OPACITY.tertiary }}
```

### Violation: Technical Error

```typescript
// Violation
return { error: 'OAuth2 token refresh failed: invalid_grant' };

// Fix
return {
  error: 'Your connection expired. Please reconnect.',
  action: 'reconnect',
  actionUrl: `/settings/integrations/${provider.id}`,
};
```

### Violation: Over-Configuration

```typescript
// Violation
export const defaultConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  timeoutMs: 10000,
};

// Fix: Just use the values directly
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === MAX_RETRIES - 1) throw error;
      await sleep(RETRY_DELAY * Math.pow(2, i));
    }
  }
}
```

## Automated Canon Enforcement

Some canon rules are enforced automatically:

| Rule | Enforcement |
|------|-------------|
| No hardcoded colors | ESLint rule |
| TypeScript strict mode | tsconfig.json |
| Import order | Prettier |
| No console.log in production | ESLint rule |

But most canon principles require human judgment:

| Rule | Requires Judgment |
|------|-------------------|
| Outcome-first naming | Yes |
| Appropriate abstraction level | Yes |
| Sensible defaults | Yes |
| Error message quality | Yes |

This is why the canon is taught, not just configured.

## Praxis

Apply the canon checklist to your recent work:

> **Praxis**: Review your last three commits against the canon checklist:
> 1. Open each commit in your git history
> 2. Score each against the checklist (pass/fail)
> 3. Identify any violations
> 4. Document how you would fix them

The goal is not perfection, but awareness. Once you see the patterns, you'll catch violations before they're committed.

## The Canon Grows

The canon isn't static. When you discover a pattern that improves WORKWAY:

1. **Document it**: Add to the relevant skill or rule file
2. **Discuss it**: Propose in team review
3. **Adopt it**: Update the canon checklist
4. **Teach it**: Add to this learning path

The canon is a living document, refined through use.

## Reflection

- What's the difference between a guideline and a canon rule?
- When is it appropriate to break the canon?
- How do you balance consistency with innovation?
