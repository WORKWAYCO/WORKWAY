# Common Pitfalls and Solutions

## Learning Objectives

By the end of this lesson, you will be able to:

- Recognize and avoid the most common mistakes when building WORKWAY workflows
- Replace Node.js patterns with Workers-compatible alternatives
- Debug runtime errors caused by incompatible npm packages
- Handle OAuth token expiration and authentication failures gracefully
- Avoid rate limiting issues with proper batching and backoff strategies
- Structure workflows to prevent state management bugs

---

Every developer hits the same walls when starting with WORKWAY. This lesson documents the pitfalls we see repeatedly—and the solutions that work.

## Step-by-Step: Diagnose and Fix Common Issues

### Step 1: Identify the Error Category

When a workflow fails, check the error message against these patterns:

```bash
# Run your workflow locally
workway dev

# Trigger and observe the error
curl localhost:8787/execute -d '{"test": true}'
```

Match the error to a category:
- `Cannot find module` → Node.js API issue (Pitfall 1)
- Runtime crash with no clear message → npm package issue (Pitfall 2)
- `AUTH_EXPIRED` or `AUTH_INVALID` → OAuth issue (Pitfall 3)
- `429` or `RATE_LIMITED` → Rate limit issue (Pitfall 4)
- `Cannot read property of undefined` → Missing validation (Pitfall 6)

### Step 2: Apply the Appropriate Fix

For **Node.js API errors**:
```typescript
// Replace Node.js import with Web API
// import crypto from 'crypto';  // ❌ Remove this
const hash = await crypto.subtle.digest('SHA-256', data);  // ✅ Use this
```

For **Auth errors**:
```typescript
// Add auth error handling
if (error.code === ErrorCode.AUTH_EXPIRED) {
  return {
    success: false,
    error: 'Please reconnect your account',
    requiresAction: true,
  };
}
```

For **Rate limit errors**:
```typescript
// Add batching with delays
const batchSize = 10;
for (let i = 0; i < items.length; i += batchSize) {
  await Promise.all(batch.map(processItem));
  await new Promise(r => setTimeout(r, 1000));  // 1s delay
}
```

### Step 3: Add Defensive Validation

Before accessing any webhook data:

```typescript
// Always validate required fields
const meetingId = trigger.data?.object?.id;
if (!meetingId) {
  context.log.error('Missing required field', { payload: trigger.data });
  return { success: false, error: 'Invalid payload: missing meeting ID' };
}
```

### Step 4: Test the Fix Locally

```bash
# Test with valid data
curl localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"object": {"id": "123", "topic": "Test"}}'

# Test with invalid data
curl localhost:8787/execute -d '{}'

# Check logs for proper error handling
workway logs --tail
```

### Step 5: Deploy and Monitor

```bash
workway deploy
workway logs --tail --level error
```

Watch for recurring errors in the first 24 hours.

---

## Pitfall 1: Using Node.js APIs

### The Problem

WORKWAY runs on Cloudflare Workers—a V8 isolate, not Node.js. Code that works locally may fail in production.

```typescript
// ❌ This will fail at runtime
import fs from 'fs';
import crypto from 'crypto';
import { Buffer } from 'buffer';

export default defineWorkflow({
  async execute({ trigger }) {
    const hash = crypto.createHash('sha256').update(trigger.data.text).digest('hex');
    return { hash };
  }
});
```

**Error you'll see:**
```
Error: Cannot find module 'crypto'
```

### The Solution

Use Web Standard APIs instead:

```typescript
// ✅ Works on Cloudflare Workers
export default defineWorkflow({
  async execute({ trigger }) {
    const encoder = new TextEncoder();
    const data = encoder.encode(trigger.data.text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash };
  }
});
```

### Quick Reference

| Need | Don't Use | Use Instead |
|------|-----------|-------------|
| HTTP requests | `axios`, `node-fetch` | `fetch()` |
| UUID generation | `uuid` package | `crypto.randomUUID()` |
| Hashing | `crypto.createHash()` | `crypto.subtle.digest()` |
| Base64 | `Buffer.from().toString('base64')` | `btoa()` / `atob()` |
| Binary data | `Buffer` | `ArrayBuffer` / `Uint8Array` |
| Environment vars | `process.env` | `config` parameter |

---

## Pitfall 2: Incompatible npm Packages

### The Problem

Many popular npm packages assume Node.js and will fail silently or crash:

```typescript
// ❌ These packages won't work
import axios from 'axios';        // Uses Node.js http module
import moment from 'moment';      // Works but is 70KB - too heavy
import express from 'express';    // Server model doesn't apply
import puppeteer from 'puppeteer'; // Needs Chrome binary
```

### The Solution

Check for Workers compatibility before adding dependencies:

1. **Check imports**: If package imports `fs`, `path`, `http`, it won't work
2. **Check for native bindings**: `binding.gyp` or `node-gyp` means it won't work
3. **Look for "browser" field**: In `package.json`, indicates isomorphic support
4. **Test in Wrangler dev**: The definitive test

### Packages That Work

```typescript
// ✅ These are Workers-compatible
import { z } from 'zod';           // Schema validation
import { format } from 'date-fns'; // Date formatting
import { nanoid } from 'nanoid';   // ID generation
import { SignJWT } from 'jose';    // JWT handling
```

### The Escape Hatch

When you need functionality from an incompatible package, use `fetch()`:

```typescript
// Instead of importing a heavy PDF library
const pdfResponse = await fetch('https://your-pdf-service.com/generate', {
  method: 'POST',
  body: JSON.stringify({ html: content }),
});
const pdfBuffer = await pdfResponse.arrayBuffer();
```

---

## Pitfall 3: Ignoring OAuth Token Expiration

### The Problem

OAuth tokens expire. If you don't handle this, workflows fail silently after 1-24 hours:

```typescript
// ❌ No handling for expired tokens
async execute({ integrations }) {
  const meeting = await integrations.zoom.getMeeting(meetingId);
  // Works initially, fails after token expires
  return { meeting };
}
```

**Error you'll see:**
```
IntegrationError: AUTH_EXPIRED - Access token has expired
```

### The Solution

WORKWAY's BaseAPIClient handles token refresh automatically, but you need to catch auth errors:

```typescript
// ✅ Handle authentication failures
import { IntegrationError, ErrorCode } from '@workwayco/sdk';

async execute({ integrations }) {
  try {
    const meeting = await integrations.zoom.getMeeting(meetingId);
    return { success: true, meeting: meeting.data };
  } catch (error) {
    if (error instanceof IntegrationError) {
      if (error.code === ErrorCode.AUTH_EXPIRED || error.code === ErrorCode.AUTH_INVALID) {
        return {
          success: false,
          error: 'Please reconnect your Zoom account',
          requiresAction: true,
        };
      }
    }
    throw error;
  }
}
```

### Pro Tip: Health Checks

Add integration health checks to catch expiring tokens before they fail:

```typescript
// Check token health at workflow start
const zoomHealth = await integrations.zoom.healthCheck();
if (!zoomHealth.authenticated) {
  return {
    success: false,
    error: 'Zoom connection expired',
    reconnectUrl: zoomHealth.reconnectUrl,
  };
}
```

---

## Pitfall 4: Rate Limit Blindness

### The Problem

APIs have rate limits. Ignoring them causes cascading failures:

```typescript
// ❌ Will hit rate limits on large batches
async execute({ trigger, integrations }) {
  const attendees = trigger.data.attendees; // Could be 100+ people

  for (const attendee of attendees) {
    await integrations.gmail.sendEmail({
      to: attendee.email,
      subject: 'Meeting notes',
      body: summary,
    });
  }
}
```

**Error you'll see:**
```
IntegrationError: RATE_LIMITED - Too many requests (429)
```

### The Solution

Batch requests and add delays:

```typescript
// ✅ Rate-limited batching
async execute({ trigger, integrations }) {
  const attendees = trigger.data.attendees;
  const batchSize = 10;
  const delayBetweenBatches = 1000; // 1 second

  for (let i = 0; i < attendees.length; i += batchSize) {
    const batch = attendees.slice(i, i + batchSize);

    // Process batch in parallel
    await Promise.all(
      batch.map(attendee =>
        integrations.gmail.sendEmail({
          to: attendee.email,
          subject: 'Meeting notes',
          body: summary,
        })
      )
    );

    // Delay before next batch
    if (i + batchSize < attendees.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
}
```

### Rate Limit Reference

| Service | Rate Limit | Best Practice |
|---------|------------|---------------|
| Notion | 3 requests/second | Batch with 400ms delays |
| Slack | Varies by method | Check `Retry-After` header |
| Gmail | 250 emails/day | Queue large sends |
| Zoom | 10 requests/second | Batch meeting fetches |

---

## Pitfall 5: Losing Errors in Optional Steps

### The Problem

Wrapping everything in try-catch without logging loses debugging information:

```typescript
// ❌ Silent failure - where did it break?
async execute({ integrations }) {
  try {
    await integrations.zoom.getMeeting(meetingId);
    await integrations.notion.createPage(pageData);
    await integrations.slack.sendMessage(message);
    return { success: true };
  } catch (error) {
    return { success: false }; // What failed? We'll never know
  }
}
```

### The Solution

Separate required from optional, and log every failure:

```typescript
// ✅ Granular error handling with logging
async execute({ integrations, context }) {
  const results = { errors: [] };

  // REQUIRED: Get meeting data
  let meeting;
  try {
    const result = await integrations.zoom.getMeeting(meetingId);
    meeting = result.data;
  } catch (error) {
    context.log.error('Failed to fetch meeting', {
      meetingId,
      error: error.message,
    });
    return { success: false, error: 'Could not retrieve meeting data' };
  }

  // REQUIRED: Save to Notion
  let pageId;
  try {
    const page = await integrations.notion.createPage(pageData);
    pageId = page.data?.id;
  } catch (error) {
    context.log.error('Failed to create Notion page', {
      meetingId: meeting.id,
      error: error.message,
    });
    return { success: false, error: 'Could not save to Notion' };
  }

  // OPTIONAL: Notify Slack
  try {
    await integrations.slack.sendMessage({
      channel: '#meetings',
      text: `Notes ready: ${pageId}`,
    });
  } catch (error) {
    context.log.warn('Slack notification failed', { error: error.message });
    results.errors.push('Slack notification failed');
    // Don't return - continue with workflow
  }

  return { success: true, pageId, ...results };
}
```

---

## Pitfall 6: Assuming Webhook Data Exists

### The Problem

Webhook payloads can have missing or malformed fields:

```typescript
// ❌ Will throw if any field is undefined
async execute({ trigger }) {
  const meetingId = trigger.data.object.id;
  const topic = trigger.data.object.topic;
  const hostEmail = trigger.data.object.host.email;

  // If host is null, this crashes
}
```

**Error you'll see:**
```
TypeError: Cannot read property 'email' of undefined
```

### The Solution

Validate before using:

```typescript
// ✅ Defensive data access
async execute({ trigger, context }) {
  const meetingId = trigger.data?.object?.id;
  const topic = trigger.data?.object?.topic;
  const hostEmail = trigger.data?.object?.host?.email;

  if (!meetingId) {
    context.log.error('Invalid trigger payload', { payload: trigger.data });
    return { success: false, error: 'Missing meeting ID' };
  }

  // Safe to proceed - meetingId exists
  const meeting = await integrations.zoom.getMeeting(meetingId);

  // Handle optional fields with defaults
  const title = topic || 'Untitled Meeting';
  const host = hostEmail || 'unknown@example.com';

  return { success: true, meetingId, title, host };
}
```

### Pro Tip: Schema Validation

Use Zod for robust payload validation:

```typescript
import { z } from 'zod';

const MeetingPayload = z.object({
  object: z.object({
    id: z.string(),
    topic: z.string().optional(),
    host: z.object({
      email: z.string().email(),
    }).optional(),
  }),
});

async execute({ trigger, context }) {
  const result = MeetingPayload.safeParse(trigger.data);

  if (!result.success) {
    context.log.error('Invalid payload', { errors: result.error.issues });
    return { success: false, error: 'Invalid webhook payload' };
  }

  const { object } = result.data;
  // TypeScript now knows object.id exists
}
```

---

## Pitfall 7: State Confusion Across Executions

### The Problem

Module-level variables persist between executions, causing unexpected behavior:

```typescript
// ❌ State persists across invocations
let processedMeetings = []; // This accumulates forever!

export default defineWorkflow({
  async execute({ trigger }) {
    processedMeetings.push(trigger.data.meetingId);
    console.log(`Processed: ${processedMeetings.length}`);
    // Returns 1, 2, 3, 4... across different meetings
  }
});
```

### The Solution

Use explicit storage for state that should persist, and reset for state that shouldn't:

```typescript
// ✅ Explicit state management
export default defineWorkflow({
  async execute({ trigger, context }) {
    // For per-execution state: use local variables
    const results = [];

    // For persistent state: use context.storage
    const history = await context.storage.get('processedMeetings') || [];
    history.push({
      meetingId: trigger.data.meetingId,
      processedAt: new Date().toISOString(),
    });
    await context.storage.put('processedMeetings', history);

    return {
      success: true,
      totalProcessed: history.length,
    };
  }
});
```

---

## Pitfall 8: Workers Execution Limits

### The Problem

Workers have strict execution limits:

```typescript
// ❌ Will timeout
async execute({ trigger }) {
  // Polling loop - Workers will kill this
  while (true) {
    const status = await checkStatus();
    if (status === 'complete') break;
    await sleep(5000);
  }
}
```

### The Solution

Design for event-driven, not polling:

```typescript
// ✅ Use triggers instead of loops
export default defineWorkflow({
  // Check every minute via cron instead of polling
  trigger: schedule({ cron: '* * * * *' }),

  async execute({ context, integrations }) {
    const pendingItems = await context.storage.get('pending') || [];

    for (const item of pendingItems) {
      const status = await checkStatus(item.id);
      if (status === 'complete') {
        await processComplete(item);
        // Remove from pending
      }
    }

    await context.storage.put('pending', remainingItems);
  }
});
```

### Workers Limits Reference

| Limit | Value | Workaround |
|-------|-------|------------|
| CPU time | 30s | Break into multiple executions |
| Wall clock | 30s | Use cron triggers for polling |
| Memory | 128 MB | Stream large files, paginate APIs |
| Subrequests | 50 | Batch and prioritize API calls |

---

## Praxis

Debug a common pitfall scenario:

> **Praxis**: Create a workflow with an intentional pitfall, then fix it. Try each of these:

1. **Node.js API**: Use `import crypto from 'crypto'`, run `workway dev`, observe the error, then fix with Web Crypto API
2. **Rate limiting**: Send 50 Slack messages in a loop, observe throttling, then add batching
3. **Missing validation**: Send a webhook with missing fields, observe the crash, then add validation

For each pitfall:
- Note the exact error message
- Implement the solution from this lesson
- Verify the fix works in `workway dev`

```bash
# Test your fixes
workway dev

# Trigger with incomplete data
curl localhost:8787/execute -d '{}'

# Check logs for proper error handling
workway logs --tail
```

---

## Quick Reference Card

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Node.js APIs | `Cannot find module` | Use Web Standard APIs |
| Bad npm package | Runtime crash | Check Workers compatibility |
| Token expiration | `AUTH_EXPIRED` | Catch and prompt reconnect |
| Rate limits | 429 errors | Batch with delays |
| Silent failures | "It just doesn't work" | Log at every catch block |
| Missing payload fields | `Cannot read property of undefined` | Validate with optional chaining or Zod |
| State leakage | Counts keep increasing | Use `context.storage` for persistence |
| Execution timeout | Workflow never completes | Use triggers, not loops |

---

## Reflection

- Which pitfall have you encountered before?
- How could you add a pre-flight check to catch these issues earlier?
- What monitoring would alert you to these problems in production?
