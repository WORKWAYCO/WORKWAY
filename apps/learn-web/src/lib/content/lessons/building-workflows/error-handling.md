# Error Handling & Retry Patterns

## Learning Objectives

By the end of this lesson, you will be able to:

- Implement try-catch blocks for required vs optional workflow steps
- Create a `withRetry()` helper with exponential backoff for transient failures
- Build a circuit breaker pattern to prevent cascading failures
- Use the `onError` handler for workflow-level error handling
- Return informative error responses for debugging and monitoring

---

Workflows fail. APIs go down, rate limits trigger, data is malformed. Good error handling makes the difference between a workflow that works and one that works reliably.

## Step-by-Step: Add Comprehensive Error Handling

### Step 1: Wrap Critical Steps in Try-Catch

Start with the basic pattern:

```typescript
async execute({ trigger, integrations }) {
  try {
    const result = await integrations.zoom.getMeeting(trigger.data.object.id);
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Workflow failed:', (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}
```

### Step 2: Separate Required from Optional Steps

Identify which steps must succeed vs. which can fail gracefully:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, notion, slack } = integrations;

  // REQUIRED: Get meeting data
  let meeting;
  try {
    const result = await zoom.getMeeting(trigger.data.object.id);
    if (!result.success) throw new Error(result.error);
    meeting = result.data;
  } catch (error) {
    return { success: false, error: 'Failed to fetch meeting data' };
  }

  // REQUIRED: Save to Notion
  let page;
  try {
    page = await notion.pages.create({ /* ... */ });
    if (!page.success) throw new Error(page.error);
  } catch (error) {
    return { success: false, error: 'Failed to save meeting notes' };
  }

  // OPTIONAL: Notify Slack
  try {
    await slack.chat.postMessage({ /* ... */ });
  } catch (error) {
    console.warn('Slack notification failed:', (error as Error).message);
    // Continue - don't fail workflow
  }

  return { success: true, pageId: page.data?.id };
}
```

### Step 3: Add a Retry Wrapper

Create a reusable retry function:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; delayMs: number },
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, lastError.message);

      if (attempt < options.maxAttempts) {
        const delay = options.delayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### Step 4: Apply Retry to Flaky Operations

Use the retry wrapper for operations that may transiently fail:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, notion } = integrations;

  // Retry meeting fetch with exponential backoff
  const meeting = await withRetry(
    () => zoom.getMeeting(trigger.data.object.id),
    { maxAttempts: 3, delayMs: 1000 }
  );

  // Create Notion page (also with retry)
  const page = await withRetry(
    () => notion.pages.create({
      parent: { database_id: inputs.notionDatabase },
      properties: { /* ... */ },
    }),
    { maxAttempts: 3, delayMs: 1000 }
  );

  return { success: true, pageId: page.data?.id };
}
```

### Step 5: Return Detailed Error Information

Include context in error responses:

```typescript
async execute({ trigger, inputs, integrations }) {
  try {
    // ... workflow logic
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      context: {
        meetingId: trigger.data?.object?.id,
        step: 'notion_create',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
```

### Step 6: Test Error Scenarios

Simulate failures in development:

```bash
# Test with invalid meeting ID
curl localhost:8787/execute -d '{"object": {"id": "invalid-123"}}'

# Test with missing required fields
curl localhost:8787/execute -d '{}'

# Check logs for error handling
workway logs --tail
```

---

## The Error Reality

Every external call can fail:

```typescript
// Any of these can throw
const meeting = await zoom.getMeeting(id); // 404, 401, 500, timeout
const page = await notion.createPage(data); // Rate limit, validation error
await slack.postMessage(message); // Channel not found, no permission
```

Plan for failure.

## Basic Error Handling

### Try-Catch Pattern

```typescript
async execute({ trigger, integrations }) {
  const { zoom, notion } = integrations;

  try {
    const meetingResult = await zoom.getMeeting(trigger.data.object.id);
    await notion.pages.create(formatMeeting(meetingResult.data));
    return { success: true };
  } catch (error) {
    console.error('Workflow failed', { error: (error as Error).message });
    return { success: false, error: (error as Error).message };
  }
}
```

### Typed Error Handling

The SDK provides `IntegrationError` with standardized error codes and built-in helpers:

```typescript
import {
  IntegrationError,
  ErrorCode,
  ErrorCategory,
  isIntegrationError,
  toIntegrationError,
} from '@workwayco/sdk';

async execute({ integrations }) {
  try {
    // ... workflow logic
  } catch (error) {
    if (isIntegrationError(error)) {
      // Use built-in helper methods
      if (error.isRetryable()) {
        // Let WORKWAY retry automatically
        throw error;
      }

      if (error.requiresReauth()) {
        // AUTH_MISSING, AUTH_INVALID, AUTH_INSUFFICIENT_SCOPE
        return {
          success: false,
          error: error.getUserMessage(),  // User-friendly message
          requiresAction: true,
        };
      }

      if (error.isRateLimited()) {
        const retryAfter = error.getRetryAfterMs();
        console.warn(`Rate limited, retry after ${retryAfter}ms`);
        throw error;  // WORKWAY handles retry
      }

      // Log with full context
      console.error('Integration error', error.toJSON());
    }

    // Convert unknown errors to IntegrationError
    const integrationError = toIntegrationError(error, {
      integration: 'zoom',
      action: 'getMeeting',
    });

    return { success: false, error: integrationError.getUserMessage() };
  }
}
```

## Granular Error Handling

Don't let one failure kill everything:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, notion, slack } = integrations;
  const results: { notion: string | null; slack: string | null; errors: string[] } = {
    notion: null,
    slack: null,
    errors: [],
  };

  // Step 1: Get meeting (required)
  let meeting;
  try {
    const meetingResult = await zoom.getMeeting(trigger.data.object.id);
    meeting = meetingResult.data;
  } catch (error) {
    // Can't proceed without meeting data
    return { success: false, error: 'Failed to fetch meeting' };
  }

  // Step 2: Save to Notion (required)
  try {
    const page = await notion.pages.create({
      parent: { database_id: inputs.notionDatabase },
      properties: formatMeeting(meeting),
    });
    results.notion = page.data?.id || null;
  } catch (error) {
    console.error('Notion failed', { error: (error as Error).message });
    return { success: false, error: 'Failed to create Notion page' };
  }

  // Step 3: Notify Slack (optional)
  try {
    await slack.chat.postMessage({
      channel: inputs.slackChannel,
      text: `Meeting notes ready: ${results.notion}`,
    });
    results.slack = 'sent';
  } catch (error) {
    // Log but don't fail the workflow
    console.warn('Slack notification failed', { error: (error as Error).message });
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

| Error Type             | Retried?      | Max Attempts |
| ---------------------- | ------------- | ------------ |
| Rate limit (429)       | Yes           | 3            |
| Server error (500-503) | Yes           | 5            |
| Timeout                | Yes           | 2            |
| Network error          | Yes           | 5            |
| Authentication (401)   | Yes (refresh) | 1            |
| Not found (404)        | No            | -            |
| Validation (400)       | No            | -            |

### SDK Retry Utilities

The WORKWAY SDK provides built-in retry utilities with exponential backoff:

```typescript
import { withRetry, fetchWithRetry, RetryOptions } from "@workwayco/sdk";

// withRetry - wrap any async function
const meeting = await withRetry(
  async (context) => {
    console.log(`Attempt ${context.attempt} of ${context.maxAttempts}`);
    const result = await integrations.zoom.getMeeting(meetingId);
    if (!result.success) throw new Error(result.error);
    return result.data;
  },
  {
    maxAttempts: 3,
    backoff: "exponential", // 'exponential' | 'linear' | 'constant'
    initialDelay: 1000,
    maxDelay: 30000,
    jitter: 0.1, // Randomize delay to prevent thundering herd
    onRetry: (error, attempt, delay) => {
      console.warn(`Retry ${attempt}: waiting ${delay}ms`, error);
    },
  },
);

// fetchWithRetry - for direct HTTP calls with automatic timeout
const response = await fetchWithRetry(
  "https://api.custom-service.com/data",
  {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  },
  {
    maxAttempts: 3,
    timeout: 10000, // Request timeout in ms
  },
);
```

### Rate Limit Handling

The SDK provides helpers for respecting `Retry-After` headers:

```typescript
import { parseRetryAfter, createRateLimitAwareRetry } from "@workwayco/sdk";

// Parse Retry-After header from response
const retryAfterMs = parseRetryAfter(response); // Returns ms or null

// Create a rate-limit-aware retry function
const rateLimitAwareRetry = createRateLimitAwareRetry({
  maxWait: 60000, // Don't wait more than 60s
  onRateLimit: (waitMs) => {
    console.log(`Rate limited, waiting ${waitMs}ms`);
  },
});

// Use with withRetry
const result = await withRetry(
  () => integrations.slack.chat.postMessage({ channel, text }),
  { shouldRetry: rateLimitAwareRetry },
);
```

### Conditional Retries

```typescript
import { withRetry, defaultShouldRetry } from "@workwayco/sdk";

// Custom retry logic for specific errors
const result = await withRetry(() => externalApi.call(), {
  maxAttempts: 3,
  shouldRetry: (error, attempt) => {
    // Only retry network errors and 5xx
    if (error instanceof Response) {
      return error.status >= 500 || error.status === 429;
    }
    // Retry on fetch network errors
    if (error instanceof TypeError) {
      return true;
    }
    return false;
  },
});
```

## Graceful Degradation

When part of a workflow fails, continue with reduced functionality:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, notion, ai } = integrations;

  const meetingResult = await zoom.getMeeting(trigger.data.object.id);
  const meeting = meetingResult.data;

  // Try to get transcript, fall back to basic info
  let transcript: { transcript_text: string } | null = null;
  try {
    const transcriptResult = await zoom.getTranscript({ meetingId: meeting.id });
    transcript = transcriptResult.data;
  } catch (error) {
    console.warn('Transcript unavailable', { error: (error as Error).message });
  }

  // Try AI summary, fall back to no summary
  let summary: string | null = null;
  if (transcript) {
    try {
      const summaryResult = await ai.generateText({
        prompt: `Summarize: ${transcript.transcript_text}`,
      });
      summary = summaryResult.data?.response || null;
    } catch (error) {
      console.warn('AI summarization failed', { error: (error as Error).message });
    }
  }

  // Create page with whatever we have
  const children = [];

  if (summary) {
    children.push({
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: summary } }] },
    });
  }

  if (transcript) {
    children.push({
      type: 'toggle',
      toggle: {
        rich_text: [{ text: { content: 'Full Transcript' } }],
        children: [{
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: transcript.transcript_text } }] },
        }],
      },
    });
  } else {
    children.push({
      type: 'callout',
      callout: {
        rich_text: [{ text: { content: 'Transcript not available' } }],
        icon: { emoji: '⚠️' },
      },
    });
  }

  await notion.pages.create({
    parent: { database_id: inputs.notionDatabase },
    properties: {
      Name: { title: [{ text: { content: meeting.topic } }] },
    },
    children,
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
async execute({ trigger }) {
  const meetingId = trigger.data?.object?.id;
  const topic = trigger.data?.object?.topic;

  if (!meetingId) {
    console.error('Missing meeting ID in payload');
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
  const meeting = validateMeetingData(trigger.data?.object);

  if (!meeting) {
    return { success: false, error: 'Invalid meeting data' };
  }
}
```

## Error Reporting

### Structured Logging

```typescript
context.log.error("Operation failed", {
  operation: "createNotionPage",
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
  errors.push({ step: "step1", error: e.message });
}

try {
  await step2();
} catch (e) {
  errors.push({ step: "step2", error: e.message });
}

if (errors.length > 0) {
  context.log.warn("Workflow completed with errors", { errors });
}

return { success: errors.length === 0, errors };
```

### User-Friendly Errors

`IntegrationError` provides user-friendly messages out of the box:

```typescript
import {
  IntegrationError,
  isIntegrationError,
  toIntegrationError,
} from "@workwayco/sdk";

function getUserFriendlyError(error: unknown): string {
  // Convert to IntegrationError if needed
  const integrationError = isIntegrationError(error)
    ? error
    : toIntegrationError(error);

  // Built-in user-friendly messages based on error code
  return integrationError.getUserMessage();

  // Example messages returned by getUserMessage():
  // AUTH_MISSING: "Please connect your Gmail to continue."
  // AUTH_EXPIRED: "Your Zoom connection has expired. We're refreshing it automatically."
  // AUTH_INVALID: "Your Slack connection is no longer valid. Please reconnect."
  // RATE_LIMITED: "We're hitting rate limits. Your workflow will retry in 30 seconds."
  // PERMISSION_DENIED: "You don't have permission to perform this action."
  // PROVIDER_DOWN: "Notion appears to be down. We'll retry automatically."
}

// Check specific error conditions with helper methods:
function handleError(error: IntegrationError): void {
  if (error.isUnauthorized()) {
    /* 401 or AUTH_EXPIRED */
  }
  if (error.isForbidden()) {
    /* 403 or PERMISSION_DENIED */
  }
  if (error.isNotFound()) {
    /* 404 or NOT_FOUND */
  }
  if (error.isRateLimited()) {
    /* 429 or RATE_LIMITED */
  }
  if (error.isNetworkError()) {
    /* NETWORK_ERROR or PROVIDER_DOWN */
  }
  if (error.isServerError()) {
    /* 5xx status codes */
  }
  if (error.requiresReauth()) {
    /* AUTH_MISSING/INVALID/INSUFFICIENT_SCOPE */
  }
  if (error.shouldNotifyUser()) {
    /* Non-retryable errors needing user action */
  }
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
        throw new Error("Circuit breaker open - service unavailable");
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

## Error Code Reference

The SDK provides standardized error codes for intelligent handling:

| Category           | Error Codes                                                               | Retryable           | Action                     |
| ------------------ | ------------------------------------------------------------------------- | ------------------- | -------------------------- |
| **Authentication** | `AUTH_MISSING`, `AUTH_EXPIRED`, `AUTH_INVALID`, `AUTH_INSUFFICIENT_SCOPE` | `AUTH_EXPIRED` only | Refresh token or reconnect |
| **Rate Limiting**  | `RATE_LIMITED`, `QUOTA_EXCEEDED`                                          | `RATE_LIMITED` only | Backoff retry              |
| **Configuration**  | `INVALID_CONFIG`, `MISSING_REQUIRED_FIELD`, `INVALID_INPUT`               | No                  | Fix user config            |
| **API**            | `API_ERROR`, `NOT_FOUND`, `PERMISSION_DENIED`, `CONFLICT`                 | No                  | Check inputs               |
| **Network**        | `NETWORK_ERROR`, `PROVIDER_DOWN`, `TIMEOUT`                               | Yes                 | Auto-retry                 |

```typescript
import { ErrorCode, ErrorCategory } from "@workwayco/sdk";

// Check error category for broad handling
if (error.category === ErrorCategory.AUTHENTICATION) {
  // Handle all auth errors
}

if (error.category === ErrorCategory.RATE_LIMIT) {
  // Handle rate limiting
}
```

## Complete Example

```typescript
import {
  defineWorkflow,
  webhook,
  withRetry,
  IntegrationError,
  isIntegrationError,
} from "@workwayco/sdk";

export default defineWorkflow({
  name: "Resilient Meeting Notes",
  description: "Save meeting notes with comprehensive error handling",
  version: "1.0.0",

  integrations: [
    { service: "zoom", scopes: ["meeting:read"] },
    { service: "notion", scopes: ["read_pages", "write_pages"] },
    { service: "slack", scopes: ["send_messages"], optional: true },
  ],

  inputs: {
    notionDatabase: {
      type: "text",
      label: "Notion Database ID",
      required: true,
    },
    slackChannel: { type: "text", label: "Slack Channel", required: false },
  },

  trigger: webhook({
    service: "zoom",
    event: "recording.completed",
  }),

  async execute({ trigger, inputs, integrations }) {
    const { zoom, notion, slack } = integrations;
    const meetingId = trigger.data?.object?.id;

    // Validate input early
    if (!meetingId) {
      console.error("Invalid trigger payload", { payload: trigger.data });
      return { success: false, error: "Missing meeting ID" };
    }

    // Get meeting with SDK retry utility
    let meeting;
    try {
      meeting = await withRetry(
        async (context) => {
          const result = await zoom.getMeeting(meetingId);
          if (!result.success) throw new Error(result.error);
          return result.data;
        },
        {
          maxAttempts: 3,
          backoff: "exponential",
          initialDelay: 1000,
          onRetry: (error, attempt, delay) => {
            console.warn(
              `Retry ${attempt} for meeting fetch, waiting ${delay}ms`,
            );
          },
        },
      );
    } catch (error) {
      console.error("Failed to fetch meeting after retries", {
        meetingId,
        error: isIntegrationError(error) ? error.toJSON() : error,
      });
      return { success: false, error: "Could not retrieve meeting data" };
    }

    // Create Notion page (required step)
    let pageId;
    try {
      const page = await notion.pages.create({
        parent: { database_id: inputs.notionDatabase },
        properties: {
          Name: { title: [{ text: { content: meeting.topic } }] },
          Date: { date: { start: meeting.start_time } },
        },
      });
      pageId = page.data?.id;
    } catch (error) {
      if (isIntegrationError(error)) {
        if (error.isRetryable()) {
          throw error; // Let WORKWAY platform retry
        }
        console.error("Notion error", error.toJSON());
        return { success: false, error: error.getUserMessage() };
      }
      return { success: false, error: "Failed to save meeting notes" };
    }

    // Notify Slack (optional step - graceful degradation)
    let slackSent = false;
    if (inputs.slackChannel) {
      try {
        await slack.chat.postMessage({
          channel: inputs.slackChannel,
          text: `Meeting "${meeting.topic}" notes saved`,
        });
        slackSent = true;
      } catch (error) {
        // Log but continue - optional step failure doesn't fail workflow
        console.warn("Slack notification failed", {
          channel: inputs.slackChannel,
          error: isIntegrationError(error) ? error.getUserMessage() : error,
        });
      }
    }

    return {
      success: true,
      pageId,
      meetingTopic: meeting.topic,
      notifications: { slack: slackSent },
    };
  },

  // Workflow-level error handler for unhandled errors
  onError: async ({ error, trigger, inputs }) => {
    console.error("Workflow failed", {
      meetingId: trigger.data?.object?.id,
      error: isIntegrationError(error) ? error.toJSON() : error,
    });
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
