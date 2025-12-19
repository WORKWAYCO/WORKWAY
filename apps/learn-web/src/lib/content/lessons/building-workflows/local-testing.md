# Testing Workflows Locally

## Learning Objectives

By the end of this lesson, you will be able to:

- Start the local development server with `wrangler dev` and understand Cloudflare Workers runtime
- Test workflows using `curl` with custom JSON payloads
- Create mock integrations using Vitest patterns from the codebase
- Write unit tests with proper mocking of storage, integrations, and AI
- Debug workflows using `wrangler tail` and structured logging

---

Test before deploy. Find bugs locally, not in production. Wrangler brings the Cloudflare Workers environment to your machine.

## Step-by-Step: Test Your Workflow Locally

### Step 1: Start the Development Server

WORKWAY workflows run on Cloudflare Workers. Use `wrangler dev` to start locally:

```bash
cd packages/workers/my-worker
wrangler dev
```

You'll see:
```
⎔ Starting local server...
[wrangler] Ready on http://localhost:8787
```

### Step 2: Configure wrangler.toml

Every worker needs a `wrangler.toml` configuration:

```toml
name = "my-workflow"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# Environment variables (non-secret)
[vars]
WORKER_URL = "https://my-workflow.workway.co"

# Durable Objects for stateful workflows
[[durable_objects.bindings]]
name = "SESSIONS"
class_name = "UserSession"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["UserSession"]

# Cron triggers
[triggers]
crons = ["0 7 * * *"]  # Daily at 7 AM UTC
```

### Step 3: Set Up Environment Variables

Create `.dev.vars` for local secrets (gitignored):

```env
# OAuth credentials for development
ZOOM_CLIENT_ID=your_dev_client_id
ZOOM_CLIENT_SECRET=your_dev_client_secret

# API secrets
API_SECRET=your_dev_secret
UPLOAD_SECRET=your_dev_upload_secret

# Optional: Use real APIs instead of mocks
USE_REAL_APIS=false
```

### Step 4: Trigger a Test Execution

In a new terminal:

```bash
curl http://localhost:8787/execute
```

Check the dev server terminal for execution logs.

### Step 5: Test with Custom Payload

Simulate a webhook event:

```bash
curl http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "object": {
      "id": "test-meeting-123",
      "topic": "Test Meeting",
      "duration": 45
    }
  }'
```

### Step 6: View Live Logs

Monitor real-time logs from your deployed worker:

```bash
# Stream all logs
wrangler tail

# Filter by status
wrangler tail --status error

# JSON format for parsing
wrangler tail --format json
```

### Step 7: Hot Reload Development

Edit your workflow code. Wrangler automatically reloads:

```
[wrangler] Detected changes, restarting...
[wrangler] Ready on http://localhost:8787
```

---

## Mocking Patterns for Testing

WORKWAY uses Vitest for testing with mock patterns from the codebase.

### Creating Mock Storage

From `packages/workflows/src/notion-two-way-sync/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

function createMockStorage() {
  const store = new Map<string, unknown>();

  return {
    get: vi.fn(async <T>(key: string): Promise<T | undefined> => {
      return store.get(key) as T | undefined;
    }),
    set: vi.fn(async (key: string, value: unknown): Promise<void> => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string): Promise<void> => {
      store.delete(key);
    }),
    // Test helpers
    _store: store,
    _clear: () => store.clear(),
  };
}
```

### Creating Mock Integration Clients

```typescript
function createMockNotionClient() {
  return {
    getPage: vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'page-123',
        properties: {
          Name: { title: [{ text: { content: 'Test Item' } }] },
          Status: { status: { name: 'New' } },
        },
      },
    }),
    createPage: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'new-page-456' },
    }),
    updatePage: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'page-123' },
    }),
  };
}

function createMockAI() {
  return {
    generateText: vi.fn().mockResolvedValue({
      success: true,
      data: { response: 'AI-generated summary of the content.' },
    }),
  };
}
```

### Complete Test Setup

```typescript
describe('My Workflow', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let notion: ReturnType<typeof createMockNotionClient>;
  let ai: ReturnType<typeof createMockAI>;

  beforeEach(() => {
    storage = createMockStorage();
    notion = createMockNotionClient();
    ai = createMockAI();
  });

  it('should create page from webhook event', async () => {
    const trigger = {
      data: {
        type: 'meeting.ended',
        object: { id: 'meeting-123', topic: 'Team Standup' },
      },
    };

    const result = await executeWorkflow({
      trigger,
      storage,
      integrations: { notion, ai },
    });

    expect(result.success).toBe(true);
    expect(notion.createPage).toHaveBeenCalled();
  });
});
```

### Testing Idempotency

Prevent duplicate processing:

```typescript
it('should skip duplicate events within window', async () => {
  const timestamp = '2024-01-15T10:30:00.000Z';

  // Simulate recent processing
  storage._store.set(`sync:page-123:${timestamp}`, {
    syncedAt: Date.now(),
  });

  const trigger = {
    data: {
      page_id: 'page-123',
      timestamp,
    },
  };

  const result = await executeWorkflow({ trigger, storage, integrations });

  expect(result.success).toBe(true);
  expect(result.skipped).toBe(true);
  expect(result.reason).toContain('loop prevention');
});
```

### Testing Error Scenarios

```typescript
it('should handle missing mapping gracefully', async () => {
  // No mapping exists for this page
  const trigger = {
    data: { page_id: 'orphan-page', type: 'page.updated' },
  };

  const result = await executeWorkflow({ trigger, storage, integrations });

  expect(result.success).toBe(false);
  expect(result.error).toContain('No mapping found');
  expect(result.hint).toBeDefined();
});

it('should handle API failures', async () => {
  notion.createPage.mockResolvedValue({
    success: false,
    error: 'Database not found',
  });

  const result = await executeWorkflow({ trigger, storage, integrations });

  expect(result.success).toBe(false);
  expect(result.error).toContain('Failed to create');
});
```

---

## Development Server Commands

### Start Local Development

```bash
wrangler dev
```

This starts:
- Local HTTP server on `localhost:8787`
- Hot reload on file changes
- Simulated Cloudflare Workers runtime
- Access to Durable Objects (local mode)
- Request/response logging

### Common Wrangler Commands

```bash
# Start dev server
wrangler dev

# Start on specific port
wrangler dev --port 3000

# Deploy to production
wrangler deploy

# View live logs
wrangler tail

# Create D1 database
wrangler d1 create my-database

# Create KV namespace
wrangler kv:namespace create MY_KV

# Set secrets (production)
wrangler secret put API_SECRET
```

### Trigger Test Execution

```bash
# Basic trigger
curl http://localhost:8787/execute

# With payload
curl http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"meetingId": "123"}'

# With trigger type
curl http://localhost:8787/execute?trigger=webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "meeting.ended", "payload": {"object": {"id": "123"}}}'
```

## Environment Variables

### .dev.vars (Local Development)

Create `.dev.vars` in your worker directory:

```env
# OAuth credentials
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret

# API secrets
JWT_SECRET=your_dev_jwt_secret
API_SECRET=your_dev_api_secret

# Feature flags
USE_REAL_APIS=true
DEBUG=true
```

### Production Secrets

Set production secrets via Wrangler:

```bash
wrangler secret put JWT_SECRET
# Enter your secret when prompted

wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put API_SECRET
```

### Accessing Environment Variables

In your workflow code:

```typescript
async execute({ env }) {
  // Access vars from wrangler.toml [vars]
  const workerUrl = env.WORKER_URL;

  // Access secrets from .dev.vars or wrangler secret
  const apiSecret = env.API_SECRET;

  // Feature flag check
  const useRealApis = env.USE_REAL_APIS === 'true';

  if (useRealApis) {
    console.log('Using real API calls');
  }
}
```

## Testing Strategies

### Unit Testing with Vitest

Test individual helper functions:

```typescript
// src/utils.ts
export function formatMeetingTitle(topic: string, date: Date): string {
  return `${topic} - ${date.toLocaleDateString()}`;
}

// src/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatMeetingTitle } from './utils';

describe('formatMeetingTitle', () => {
  it('includes topic and date', () => {
    const result = formatMeetingTitle('Standup', new Date('2024-01-15'));
    expect(result).toBe('Standup - 1/15/2024');
  });
});
```

Run tests:
```bash
pnpm test
```

### Integration Testing with Mocks

Test complete workflow execution using the mock patterns shown above:

```typescript
// src/index.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Meeting to Notion Workflow', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let notion: ReturnType<typeof createMockNotionClient>;
  let zoom: ReturnType<typeof createMockZoomClient>;
  let ai: ReturnType<typeof createMockAI>;

  beforeEach(() => {
    storage = createMockStorage();
    notion = createMockNotionClient();
    zoom = createMockZoomClient();
    ai = createMockAI();
  });

  it('creates Notion page from meeting webhook', async () => {
    const trigger = {
      data: {
        event: 'meeting.ended',
        object: { id: 'meeting-123', topic: 'Team Standup' },
      },
    };

    const result = await executeWorkflow({
      trigger,
      storage,
      integrations: { notion, zoom, ai },
      inputs: { notionDatabaseId: 'db-123' },
    });

    expect(result.success).toBe(true);
    expect(notion.createPage).toHaveBeenCalledWith(
      expect.objectContaining({
        parentDatabaseId: 'db-123',
      })
    );
  });
});
```

### Testing with Assertions

Verify specific API call patterns:

```typescript
it('passes meeting data to Notion correctly', async () => {
  zoom.getMeeting.mockResolvedValue({
    success: true,
    data: {
      id: '123',
      topic: 'Planning Session',
      duration: 45,
      start_time: '2024-01-15T10:00:00Z',
    },
  });

  await executeWorkflow({ trigger, storage, integrations });

  expect(notion.createPage).toHaveBeenCalledWith(
    expect.objectContaining({
      properties: expect.objectContaining({
        Name: { title: [{ text: { content: 'Planning Session' } }] },
      }),
    })
  );
});
```

## Debugging

### Structured Console Logging

Use console methods that show in `wrangler tail`:

```typescript
async execute({ trigger, env }) {
  const triggerId = crypto.randomUUID().slice(0, 8);

  console.log('[START]', { triggerId, event: trigger.type });

  try {
    const meeting = await fetchMeeting(trigger.data.meetingId);
    console.log('[MEETING]', { triggerId, meetingId: meeting.id });

    const page = await createNotionPage(meeting);
    console.log('[SUCCESS]', { triggerId, pageId: page.id });

    return { success: true, pageId: page.id };
  } catch (error) {
    console.error('[ERROR]', { triggerId, error: error.message });
    throw error;
  }
}
```

### Using wrangler tail

Monitor deployed worker logs in real-time:

```bash
# Stream all logs
wrangler tail

# Filter errors only
wrangler tail --status error

# JSON format for piping to jq
wrangler tail --format json | jq '.logs[]'

# Sample 10% of requests (for high-traffic workers)
wrangler tail --sampling-rate 0.1
```

### Local Debugging with VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Worker",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["wrangler", "dev", "--local"],
      "skipFiles": ["<node_internals>/**"],
      "cwd": "${workspaceFolder}/packages/workers/my-worker"
    }
  ]
}
```

### Debug Logging in wrangler.toml

Enable verbose logging:

```toml
[dev]
log_level = "debug"
```

### Inspecting Request/Response

Log integration calls for debugging:

```typescript
async function debugFetch(url: string, options: RequestInit) {
  console.log('[FETCH]', { url, method: options.method });

  const response = await fetch(url, options);
  const data = await response.json();

  console.log('[RESPONSE]', {
    url,
    status: response.status,
    dataPreview: JSON.stringify(data).slice(0, 200),
  });

  return data;
}
```

## Common Issues

### "Integration not mocked"

Your mock doesn't cover the method being called:

```typescript
// If you call zoom.getMeetingTranscript() but only mock getMeeting()
// Error: Integration method not mocked: zoom.getMeetingTranscript

// Fix: Add missing mock method
function createMockZoomClient() {
  return {
    getMeeting: vi.fn().mockResolvedValue({ success: true, data: {} }),
    getMeetingTranscript: vi.fn().mockResolvedValue({
      success: true,
      data: { text: 'Mock transcript' },
    }), // Add missing method
  };
}
```

### "Cannot connect to localhost:8787"

Development server not running:

```bash
# Terminal 1: Start wrangler
cd packages/workers/my-worker
wrangler dev

# Terminal 2: Test commands
curl localhost:8787/execute
```

### "Durable Object not found"

Missing migration in `wrangler.toml`:

```toml
# Add migration for new Durable Object classes
[[migrations]]
tag = "v1"
new_sqlite_classes = ["UserSession"]
```

### "Secret not found in .dev.vars"

Environment variable missing:

```bash
# Check .dev.vars exists and has the variable
cat .dev.vars

# Should contain:
# API_SECRET=your_secret
```

### "TypeScript errors on mock"

Mock doesn't match interface:

```typescript
// Zoom.getMeeting returns Meeting type
// Your mock is missing required fields

// Fix: Match the full interface
zoom.getMeeting.mockResolvedValue({
  success: true,
  data: {
    id: '123',
    topic: 'Test',
    start_time: new Date().toISOString(), // Required field
    duration: 30,
    participants: [], // Required field
  },
});
```

## Test Fixtures

### Shared Test Data

```typescript
// tests/fixtures/meetings.ts
export const mockMeeting = {
  id: '123',
  topic: 'Weekly Standup',
  start_time: '2024-01-15T10:00:00Z',
  duration: 30,
  participants: [
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob', email: 'bob@example.com' },
  ],
};

export const mockTranscript = {
  text: 'Alice: Hello. Bob: Hi.',
  speaker_segments: [
    { speaker: 'Alice', text: 'Hello.' },
    { speaker: 'Bob', text: 'Hi.' },
  ],
};
```

### Factory Functions

```typescript
// tests/fixtures/factories.ts
export function createMeeting(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    topic: 'Test Meeting',
    start_time: new Date().toISOString(),
    duration: 30,
    participants: [],
    ...overrides,
  };
}

// Usage
const shortMeeting = createMeeting({ duration: 10 });
const longMeeting = createMeeting({ duration: 120, topic: 'Planning' });
```

### Event Factory Functions

```typescript
// tests/fixtures/events.ts
export function createPageCreatedEvent(
  pageId: string,
  databaseId: string,
  timestamp?: string
) {
  return {
    type: 'page.created',
    page_id: pageId,
    id: pageId,
    parent: { database_id: databaseId },
    timestamp: timestamp || new Date().toISOString(),
  };
}

export function createWebhookEvent(type: string, data: object) {
  return {
    type,
    timestamp: new Date().toISOString(),
    ...data,
  };
}
```

## Pre-Deploy Checklist

Before `wrangler deploy`:

- [ ] All tests pass (`pnpm test`)
- [ ] No TypeScript errors (`pnpm tsc --noEmit`)
- [ ] Tested with realistic mock data
- [ ] Error cases handled
- [ ] Structured logging added for debugging
- [ ] Secrets configured (`wrangler secret put`)
- [ ] wrangler.toml configured correctly

```bash
# Full check
pnpm test && pnpm tsc --noEmit && wrangler deploy
```

## Praxis

Set up a complete local testing environment:

> **Praxis**: Create a test file with mocked storage and integrations for your workflow

Create a test suite using Vitest and the mock patterns:

```typescript
// src/index.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock factories (copy from above)
function createMockStorage() { /* ... */ }
function createMockNotionClient() { /* ... */ }
function createMockAI() { /* ... */ }

describe('My Workflow', () => {
  let storage: ReturnType<typeof createMockStorage>;
  let notion: ReturnType<typeof createMockNotionClient>;
  let ai: ReturnType<typeof createMockAI>;

  beforeEach(() => {
    storage = createMockStorage();
    notion = createMockNotionClient();
    ai = createMockAI();
  });

  it('creates page from webhook event', async () => {
    const trigger = {
      data: { type: 'meeting.ended', object: { id: '123' } },
    };

    const result = await executeWorkflow({
      trigger,
      storage,
      integrations: { notion, ai },
    });

    expect(result.success).toBe(true);
    expect(notion.createPage).toHaveBeenCalled();
  });

  it('handles API failures gracefully', async () => {
    notion.createPage.mockResolvedValue({
      success: false,
      error: 'Database not found',
    });

    const result = await executeWorkflow({
      trigger,
      storage,
      integrations: { notion, ai },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

Run the development flow:

```bash
# Terminal 1: Start wrangler dev
cd packages/workers/my-worker
wrangler dev

# Terminal 2: Run tests
pnpm test

# Terminal 3: Manual testing
curl localhost:8787/execute -d '{"test": true}'

# Monitor deployed logs
wrangler tail
```

## Reflection

- How does local testing with wrangler change your development confidence?
- What edge cases should your workflow handle?
- When should you use real APIs vs. mocks in development?
- How do Durable Objects affect your testing strategy?
