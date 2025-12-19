# Local Testing & Debugging

## Learning Objectives

By the end of this lesson, you will be able to:

- Start the local development server with `workway dev` and hot reloading
- Test workflows using `curl` with custom JSON payloads
- Create mock data files for integration testing
- Write unit tests using the `@workway/testing` utilities
- Debug workflows using console logging and VS Code debugger

---

Test before deploy. Find bugs locally, not in production. The WORKWAY CLI brings the full execution environment to your machine.

## Step-by-Step: Test Your Workflow Locally

### Step 1: Start the Development Server

```bash
cd my-workflow
workway dev
```

You'll see:
```
✓ Workflow loaded
✓ Dev server running at http://localhost:8787
✓ Watching for file changes...
```

### Step 2: Trigger a Basic Execution

In a new terminal:

```bash
curl http://localhost:8787/execute
```

Check the dev server terminal for execution logs.

### Step 3: Test with Custom Payload

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

### Step 4: Create Custom Mock Data

Create `mocks/zoom.ts` in your project:

```typescript
export default {
  getMeeting: (meetingId: string) => ({
    success: true,
    data: {
      id: meetingId,
      topic: 'Mock Team Standup',
      duration: 30,
      participants: ['Alice', 'Bob'],
    },
  }),
  getTranscript: () => ({
    success: true,
    data: {
      transcript_text: 'Alice: Good morning everyone...',
    },
  }),
};
```

### Step 5: Test Error Handling

Send invalid data to verify error handling:

```bash
# Missing required fields
curl http://localhost:8787/execute -d '{}'

# Invalid meeting ID
curl http://localhost:8787/execute \
  -d '{"object": {"id": "nonexistent"}}'
```

### Step 6: Check Execution Logs

View detailed logs:

```bash
workway logs --tail
```

Or check the dev server output for:
- Request received
- Integration calls
- Errors and warnings
- Execution result

### Step 7: Iterate and Hot Reload

Edit your workflow code. The dev server automatically reloads:

```
✓ File changed: src/index.ts
✓ Workflow reloaded
```

Test again without restarting:

```bash
curl http://localhost:8787/execute -d '{"object": {"id": "123"}}'
```

---

## Development Server

### Start Local Development

```bash
workway dev
```

This starts:
- Local HTTP server on `localhost:8787`
- Hot reload on file changes
- Mocked integration clients
- Local D1 database
- Request/response logging

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

## Mocking Integrations

### Default Mocks

In development, integrations return mock data:

```typescript
// In dev mode, this returns mock meeting data
const meeting = await integrations.zoom.getMeeting('123');
// Returns: { id: '123', topic: 'Mock Meeting', duration: 30 }
```

### Custom Mock Data

Create `mocks/` directory for custom responses:

```
my-workflow/
├── src/
│   └── index.ts
├── mocks/
│   └── zoom.ts
└── package.json
```

```typescript
// mocks/zoom.ts
export default {
  getMeeting: (meetingId: string) => ({
    id: meetingId,
    topic: 'Custom Mock Meeting',
    start_time: '2024-01-15T10:00:00Z',
    duration: 45,
    participants: [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
    ],
  }),

  getMeetingTranscript: (meetingId: string) => ({
    text: 'This is a mock transcript for testing purposes.',
    speaker_segments: [
      { speaker: 'Alice', text: 'Hello everyone.' },
      { speaker: 'Bob', text: 'Hi Alice.' },
    ],
  }),
};
```

### Mock Environment Variable

Toggle real API calls in development:

```typescript
async execute({ integrations, context }) {
  const { zoom } = integrations;

  // Check if using real APIs
  const useRealApis = context.env.USE_REAL_APIS === 'true';

  if (useRealApis) {
    context.log.info('Using real Zoom API');
  }

  const meeting = await zoom.getMeeting(meetingId);
}
```

Set in `.dev.vars`:
```
USE_REAL_APIS=true
```

## Testing Strategies

### Unit Testing

Test individual functions:

```typescript
// src/utils.ts
export function formatMeetingTitle(topic: string, date: Date): string {
  return `${topic} - ${date.toLocaleDateString()}`;
}

// src/utils.test.ts
import { formatMeetingTitle } from './utils';

test('formatMeetingTitle includes topic and date', () => {
  const result = formatMeetingTitle('Standup', new Date('2024-01-15'));
  expect(result).toBe('Standup - 1/15/2024');
});
```

Run tests:
```bash
npm test
# or
workway test
```

### Integration Testing

Test complete workflow execution:

```typescript
// src/index.test.ts
import { testWorkflow } from '@workway/testing';
import workflow from './index';

test('creates Notion page from meeting', async () => {
  const result = await testWorkflow(workflow, {
    trigger: {
      type: 'webhook',
      payload: {
        event: 'meeting.ended',
        object: { id: '123', topic: 'Test Meeting' },
      },
    },
    config: {
      notionDatabase: 'db-123',
    },
    mocks: {
      zoom: {
        getMeeting: () => ({ id: '123', topic: 'Test Meeting', duration: 30 }),
      },
      notion: {
        createPage: jest.fn().mockResolvedValue({ id: 'page-456' }),
      },
    },
  });

  expect(result.success).toBe(true);
  expect(result.pageId).toBe('page-456');
});
```

### Snapshot Testing

Verify output structure:

```typescript
test('meeting page structure', async () => {
  const { notion } = await testWorkflow(workflow, { /* config */ });

  expect(notion.createPage).toHaveBeenCalledWith(
    expect.objectContaining({
      properties: expect.objectContaining({
        Name: expect.any(Object),
        Date: expect.any(Object),
      }),
    })
  );
});
```

## Debugging

### Console Logging

```typescript
async execute({ context }) {
  context.log.debug('Starting execution');
  context.log.info('Processing meeting', { meetingId });
  context.log.warn('Transcript not available');
  context.log.error('Failed to create page', { error: error.message });
}
```

View logs in terminal where `workway dev` is running.

### Breakpoints

Use `debugger` statement:

```typescript
async execute({ integrations }) {
  const meeting = await integrations.zoom.getMeeting(meetingId);

  debugger; // Execution pauses here in Node debugger

  const page = await integrations.notion.createPage(/* ... */);
}
```

Start with debugging:
```bash
workway dev --inspect
```

Then attach VS Code or Chrome DevTools.

### VS Code Debug Configuration

`.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to WORKWAY",
      "port": 9229,
      "restart": true
    }
  ]
}
```

### Inspect Integration Calls

Log all integration requests:

```typescript
// wrangler.toml
[dev]
log_level = "debug"
```

Or in code:
```typescript
async execute({ integrations, context }) {
  const { zoom } = integrations;

  context.log.debug('Fetching meeting', { meetingId });
  const meeting = await zoom.getMeeting(meetingId);
  context.log.debug('Meeting fetched', { meeting });
}
```

## Common Issues

### "Integration not mocked"

Your mock doesn't cover the method being called:

```typescript
// If you call zoom.getMeetingTranscript() but only mock getMeeting()
// Error: Integration method not mocked: zoom.getMeetingTranscript

// Fix: Add missing mock
mocks: {
  zoom: {
    getMeeting: () => ({ /* ... */ }),
    getMeetingTranscript: () => ({ text: 'Mock transcript' }), // Add this
  },
}
```

### "Cannot connect to localhost:8787"

Development server not running:
```bash
# Terminal 1
workway dev

# Terminal 2 (test commands)
curl localhost:8787/execute
```

### "Config value undefined"

Config not provided in test:

```typescript
// Your workflow expects config.notionDatabase
// But test doesn't provide it

// Fix:
const result = await testWorkflow(workflow, {
  config: {
    notionDatabase: 'db-123', // Provide required config
  },
});
```

### "TypeScript errors on mock"

Mock doesn't match interface:

```typescript
// Zoom.getMeeting returns Meeting type
// Your mock is missing required fields

// Fix: Match the full interface
mocks: {
  zoom: {
    getMeeting: () => ({
      id: '123',
      topic: 'Test',
      start_time: new Date().toISOString(), // Required field
      duration: 30,
      participants: [], // Required field
    }),
  },
}
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

## Pre-Deploy Checklist

Before `workway deploy`:

- [ ] All tests pass (`workway test`)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] Tested with realistic mock data
- [ ] Error cases handled
- [ ] Logging added for debugging
- [ ] Config schema matches execute usage

```bash
# Full check
workway test && tsc --noEmit && workway deploy
```

## Praxis

Set up a complete local testing environment:

> **Praxis**: Ask Claude Code: "Help me set up local testing with mocks for my workflow"

Create a test suite:

```typescript
// src/index.test.ts
import { testWorkflow } from '@workway/testing';
import workflow from './index';

test('creates Notion page from meeting', async () => {
  const result = await testWorkflow(workflow, {
    trigger: {
      type: 'webhook',
      payload: { object: { id: '123', topic: 'Test' } },
    },
    config: { notionDatabase: 'db-123' },
    mocks: {
      zoom: {
        getMeeting: () => ({ id: '123', topic: 'Test', duration: 30 }),
      },
      notion: {
        createPage: jest.fn().mockResolvedValue({ id: 'page-456' }),
      },
    },
  });

  expect(result.success).toBe(true);
});
```

Run the development flow:

```bash
# Terminal 1: Start dev server
workway dev

# Terminal 2: Run tests
workway test

# Terminal 3: Manual testing
curl localhost:8787/execute -d '{"test": true}'
```

## Reflection

- How does local testing change your development confidence?
- What edge cases should your workflow handle?
- When should you use real APIs vs. mocks in development?
