# Error Handling & Retries

Workflows fail. APIs go down, rate limits trigger, data is malformed. Good error handling makes the difference between a workflow that works and one that works reliably.

## The Error Reality

Every external call can fail:

```typescript
// Any of these can throw
const meeting = await zoom.getMeeting(id);       // 404, 401, 500, timeout
const page = await notion.createPage(data);      // Rate limit, validation error
await slack.postMessage(message);                 // Channel not found, no permission
```

Plan for failure.

## Basic Error Handling

### Try-Catch Pattern

```typescript
async execute({ integrations, context }) {
  const { zoom, notion } = integrations;

  try {
    const meeting = await zoom.getMeeting(trigger.payload.meetingId);
    await notion.createPage(formatMeeting(meeting));
    return { success: true };
  } catch (error) {
    context.log.error('Workflow failed', { error: error.message });
    return { success: false, error: error.message };
  }
}
```

### Typed Error Handling

```typescript
async execute({ integrations, context }) {
  try {
    // ... workflow logic
  } catch (error) {
    if (error instanceof IntegrationError) {
      // Known integration failure
      if (error.code === 'RATE_LIMITED') {
        // Will be retried automatically
        throw error;
      }
      if (error.code === 'UNAUTHORIZED') {
        return {
          success: false,
          error: 'Please reconnect your account',
          requiresAction: true,
        };
      }
    }

    // Unknown error
    context.log.error('Unexpected error', { error });
    return { success: false, error: 'An unexpected error occurred' };
  }
}
```

## Granular Error Handling

Don't let one failure kill everything:

```typescript
async execute({ trigger, integrations, context }) {
  const { zoom, notion, slack } = integrations;
  const results = { notion: null, slack: null, errors: [] };

  // Step 1: Get meeting (required)
  let meeting;
  try {
    meeting = await zoom.getMeeting(trigger.payload.meetingId);
  } catch (error) {
    // Can't proceed without meeting data
    return { success: false, error: 'Failed to fetch meeting' };
  }

  // Step 2: Save to Notion (required)
  try {
    const page = await notion.createPage(formatMeeting(meeting));
    results.notion = page.id;
  } catch (error) {
    context.log.error('Notion failed', { error: error.message });
    return { success: false, error: 'Failed to create Notion page' };
  }

  // Step 3: Notify Slack (optional)
  try {
    await slack.postMessage({
      channel: config.slackChannel,
      text: `Meeting notes ready: ${results.notion}`,
    });
    results.slack = 'sent';
  } catch (error) {
    // Log but don't fail the workflow
    context.log.warn('Slack notification failed', { error: error.message });
    results.errors.push('Slack notification failed');
  }

  return {
    success: true,
    ...results,
  };
}
```

## Retry Strategies

### Automatic Retries

WORKWAY automatically retries certain failures:

| Error Type | Retried? | Max Attempts |
|------------|----------|--------------|
| Rate limit (429) | Yes | 3 |
| Server error (500-503) | Yes | 3 |
| Timeout | Yes | 2 |
| Authentication (401) | No | - |
| Not found (404) | No | - |
| Validation (400) | No | - |

### Manual Retry Logic

For custom retry behavior:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; delayMs: number }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < options.maxAttempts) {
        // Exponential backoff
        const delay = options.delayMs * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// Usage
const meeting = await withRetry(
  () => zoom.getMeeting(meetingId),
  { maxAttempts: 3, delayMs: 1000 }
);
```

### Conditional Retries

```typescript
async function fetchWithConditionalRetry(
  fn: () => Promise<any>,
  shouldRetry: (error: Error) => boolean
) {
  try {
    return await fn();
  } catch (error) {
    if (shouldRetry(error)) {
      await sleep(1000);
      return await fn();
    }
    throw error;
  }
}

// Only retry network errors
const result = await fetchWithConditionalRetry(
  () => externalApi.call(),
  (error) => error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT'
);
```

## Graceful Degradation

When part of a workflow fails, continue with reduced functionality:

```typescript
async execute({ integrations }) {
  const { zoom, notion, ai } = integrations;

  const meeting = await zoom.getMeeting(meetingId);

  // Try to get transcript, fall back to basic info
  let transcript;
  try {
    transcript = await zoom.getMeetingTranscript(meetingId);
  } catch (error) {
    context.log.warn('Transcript unavailable', { error: error.message });
    transcript = null;
  }

  // Try AI summary, fall back to no summary
  let summary = null;
  if (transcript) {
    try {
      summary = await ai.run('@cf/meta/llama-3-8b-instruct', {
        prompt: `Summarize: ${transcript.text}`,
      });
    } catch (error) {
      context.log.warn('AI summarization failed', { error: error.message });
    }
  }

  // Create page with whatever we have
  await notion.createPage({
    properties: {
      Name: { title: [{ text: { content: meeting.topic } }] },
    },
    children: [
      summary && {
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: summary.response } }] },
      },
      transcript && {
        type: 'toggle',
        toggle: {
          rich_text: [{ text: { content: 'Full Transcript' } }],
          children: [{ type: 'paragraph', paragraph: {
            rich_text: [{ text: { content: transcript.text } }]
          }}],
        },
      },
      !transcript && {
        type: 'callout',
        callout: {
          rich_text: [{ text: { content: 'Transcript not available' } }],
          icon: { emoji: '⚠️' },
        },
      },
    ].filter(Boolean),
  });

  return {
    success: true,
    hadTranscript: !!transcript,
    hadSummary: !!summary,
  };
}
```

## Validation

Catch problems before they cause failures:

### Input Validation

```typescript
async execute({ trigger, context }) {
  const { meetingId, topic } = trigger.payload?.object || {};

  if (!meetingId) {
    context.log.error('Missing meeting ID in payload');
    return { success: false, error: 'Invalid webhook payload' };
  }

  // Proceed with valid data
}
```

### Data Shape Validation

```typescript
function validateMeetingData(data: unknown): Meeting | null {
  if (!data || typeof data !== 'object') return null;

  const meeting = data as Record<string, unknown>;

  if (typeof meeting.id !== 'string') return null;
  if (typeof meeting.topic !== 'string') return null;
  if (typeof meeting.start_time !== 'string') return null;

  return {
    id: meeting.id,
    topic: meeting.topic,
    startTime: new Date(meeting.start_time),
    duration: typeof meeting.duration === 'number' ? meeting.duration : 0,
  };
}

async execute({ trigger }) {
  const meeting = validateMeetingData(trigger.payload?.object);

  if (!meeting) {
    return { success: false, error: 'Invalid meeting data' };
  }
}
```

## Error Reporting

### Structured Logging

```typescript
context.log.error('Operation failed', {
  operation: 'createNotionPage',
  meetingId: meeting.id,
  error: error.message,
  errorCode: error.code,
  stack: error.stack,
});
```

### Error Aggregation

```typescript
const errors: Array<{ step: string; error: string }> = [];

try {
  await step1();
} catch (e) {
  errors.push({ step: 'step1', error: e.message });
}

try {
  await step2();
} catch (e) {
  errors.push({ step: 'step2', error: e.message });
}

if (errors.length > 0) {
  context.log.warn('Workflow completed with errors', { errors });
}

return { success: errors.length === 0, errors };
```

### User-Friendly Errors

```typescript
function getUserFriendlyError(error: Error): string {
  const errorMap: Record<string, string> = {
    RATE_LIMITED: 'Too many requests. Please try again in a few minutes.',
    UNAUTHORIZED: 'Your connection expired. Please reconnect your account.',
    NOT_FOUND: 'The requested item no longer exists.',
    VALIDATION_ERROR: 'The data provided was invalid.',
  };

  return errorMap[error.code] || 'Something went wrong. Please try again.';
}
```

## Circuit Breaker Pattern

For workflows calling unreliable services:

```typescript
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  threshold: 5,
  resetTimeout: 60000, // 1 minute

  async call<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.failures >= this.threshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailure;
      if (timeSinceLastFailure < this.resetTimeout) {
        throw new Error('Circuit breaker open - service unavailable');
      }
      // Reset after timeout
      this.failures = 0;
    }

    try {
      const result = await fn();
      this.failures = 0; // Reset on success
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      throw error;
    }
  },
};
```

## Complete Example

```typescript
import { defineWorkflow, IntegrationError } from '@workway/sdk';

export default defineWorkflow({
  metadata: {
    id: 'resilient-meeting-notes',
    name: 'Resilient Meeting Notes',
  },

  async execute({ trigger, config, integrations, context }) {
    const { zoom, notion, slack } = integrations;
    const meetingId = trigger.payload?.object?.id;

    // Validate input
    if (!meetingId) {
      context.log.error('Invalid trigger payload', { payload: trigger.payload });
      return { success: false, error: 'Missing meeting ID' };
    }

    // Get meeting with retry
    let meeting;
    try {
      meeting = await withRetry(
        () => zoom.getMeeting(meetingId),
        { maxAttempts: 3, delayMs: 1000 }
      );
    } catch (error) {
      context.log.error('Failed to fetch meeting after retries', {
        meetingId,
        error: error.message
      });
      return { success: false, error: 'Could not retrieve meeting data' };
    }

    // Create Notion page (required)
    let pageId;
    try {
      const page = await notion.createPage({
        parent: { database_id: config.notionDatabase },
        properties: {
          Name: { title: [{ text: { content: meeting.topic } }] },
          Date: { date: { start: meeting.start_time } },
        },
      });
      pageId = page.id;
    } catch (error) {
      if (error instanceof IntegrationError && error.code === 'RATE_LIMITED') {
        throw error; // Let WORKWAY retry
      }
      context.log.error('Failed to create Notion page', { error: error.message });
      return { success: false, error: 'Failed to save meeting notes' };
    }

    // Notify Slack (optional)
    try {
      if (config.slackChannel) {
        await slack.postMessage({
          channel: config.slackChannel,
          text: `Meeting "${meeting.topic}" notes saved`,
        });
      }
    } catch (error) {
      context.log.warn('Slack notification failed', {
        error: error.message,
        channel: config.slackChannel,
      });
      // Continue - don't fail workflow for notification failure
    }

    return {
      success: true,
      pageId,
      meetingTopic: meeting.topic,
    };
  },
});
```

## Praxis

Add resilient error handling to your workflow:

> **Praxis**: Ask Claude Code: "Help me add comprehensive error handling to my workflow with retries and graceful degradation"

Implement these patterns:

1. **Granular try/catch** for each integration call
2. **Retry wrapper** with exponential backoff
3. **Graceful degradation** when optional steps fail
4. **Structured logging** at each failure point

Test your error handling:

```bash
# In development, simulate failures:
workway dev

# Test with invalid meeting ID
curl localhost:8787/execute -d '{"meetingId": "invalid"}'

# Check logs for error handling
```

Verify that:
- Required step failures stop the workflow
- Optional step failures log warnings but continue
- All errors include context for debugging

## Reflection

- What failures are acceptable vs. workflow-breaking?
- How do you balance retry attempts with user experience?
- When should a workflow fail fast vs. degrade gracefully?
