# Integrations & OAuth

## Learning Objectives

By the end of this lesson, you will be able to:

- Declare integrations with proper OAuth scopes in the `integrations` array
- Use the extended format for optional integrations and credential aliasing
- Handle `ActionResult` responses with `success`, `data`, and `error` checking
- Implement graceful degradation when optional integrations fail
- Understand how WORKWAY handles token refresh and rate limiting automatically

---

WORKWAY handles OAuth complexity so your workflows can focus on outcomes. Connect once, use everywhere.

## Step-by-Step: Add Your First Integration

### Step 1: Declare the Integration

Add the integration to your workflow's `integrations` array:

```typescript
integrations: [
  { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
],
```

### Step 2: Destructure in Execute

Access the integration client in your execute function:

```typescript
async execute({ integrations }) {
  const { zoom } = integrations;
  // zoom is now a fully authenticated client
}
```

### Step 3: Call Integration Methods

Use the integration's methods:

```typescript
async execute({ integrations }) {
  const { zoom } = integrations;

  const meetingsResult = await zoom.getMeetings();

  if (!meetingsResult.success) {
    return { success: false, error: meetingsResult.error };
  }

  console.log('Found meetings:', meetingsResult.data);
  return { success: true, meetings: meetingsResult.data };
}
```

### Step 4: Add a Second Integration

Extend your workflow to use multiple services:

```typescript
integrations: [
  { service: 'zoom', scopes: ['meeting:read'] },
  { service: 'slack', scopes: ['chat:write'] },
],

async execute({ integrations }) {
  const { zoom, slack } = integrations;

  const meetingsResult = await zoom.getMeetings();

  await slack.chat.postMessage({
    channel: '#meetings',
    text: `Found ${meetingsResult.data?.length || 0} recent meetings`,
  });

  return { success: true };
}
```

### Step 5: Handle Optional Integrations

Mark integrations as optional and check before use:

```typescript
integrations: [
  { service: 'zoom', scopes: ['meeting:read'] },
  { service: 'slack', scopes: ['chat:write'], optional: true },
],

async execute({ integrations }) {
  const { zoom, slack } = integrations;

  const meetingsResult = await zoom.getMeetings();

  // Only post to Slack if connected
  if (slack) {
    await slack.chat.postMessage({
      channel: '#meetings',
      text: `Found ${meetingsResult.data?.length || 0} meetings`,
    });
  }

  return { success: true };
}
```

---

## The Integration Problem

Every SaaS API requires authentication. Without abstraction:

```typescript
// Without WORKWAY - manual OAuth hell
const tokens = await refreshOAuthTokens(userId, 'zoom');
const response = await fetch('https://api.zoom.us/v2/meetings', {
  headers: { 'Authorization': `Bearer ${tokens.access_token}` }
});
if (response.status === 401) {
  // Token expired mid-request? Refresh and retry...
}
```

With WORKWAY integrations:

```typescript
// With WORKWAY - the mechanism recedes
const meetings = await integrations.zoom.getMeetings();
```

## How OAuth Works (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                       OAuth Flow                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. User clicks "Connect Zoom"                                │
│      ↓                                                          │
│   2. Redirect to Zoom login                                     │
│      ↓                                                          │
│   3. User approves permissions                                  │
│      ↓                                                          │
│   4. Zoom redirects back with auth code                         │
│      ↓                                                          │
│   5. WORKWAY exchanges code for tokens                          │
│      ↓                                                          │
│   6. Tokens stored securely, refreshed automatically            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

WORKWAY handles steps 2-6. Your workflow just uses the integration.

## Available Integrations

| Integration | Capabilities |
|-------------|--------------|
| `zoom` | Meetings, recordings, transcripts |
| `notion` | Pages, databases, blocks |
| `slack` | Messages, channels, users |
| `gmail` | Send, read, search emails |
| `google-calendar` | Events, calendars |
| `stripe` | Payments, customers, subscriptions |
| `hubspot` | Contacts, deals, companies |
| `salesforce` | Objects, records, queries |

## Using Integrations

### In Your Workflow

```typescript
async execute({ integrations }) {
  const { zoom, notion, slack } = integrations;

  // Each is a fully authenticated client
  const meetings = await zoom.getMeetings();
  const databases = await notion.getDatabases();
  const channels = await slack.getChannels();
}
```

### Declaring Dependencies

Specify required integrations in metadata:

```typescript
metadata: {
  id: 'my-workflow',
  integrations: ['zoom', 'notion'],  // User must connect both
}
```

Users see which services they need to connect before installing.

## The BaseAPIClient Pattern

All WORKWAY integrations extend BaseAPIClient, which provides:

```typescript
class BaseAPIClient {
  // Automatic token refresh
  protected async request(endpoint: string, options?: RequestOptions) {
    // Checks token expiry
    // Refreshes if needed
    // Retries on 401
    // Handles rate limits
  }

  // Consistent error handling
  protected handleError(error: Error) {
    // Wraps API errors in consistent format
    // Logs for debugging
    // Returns user-friendly messages
  }
}
```

### Benefits

| Feature | What It Does |
|---------|--------------|
| Token Refresh | Automatically refreshes expired tokens |
| Retry Logic | Retries failed requests with backoff |
| Rate Limiting | Respects API rate limits |
| Error Wrapping | Consistent error format across integrations |
| Logging | Built-in request/response logging |

## Integration Methods

### Zoom

```typescript
// Meetings
await zoom.getMeetings();
await zoom.getMeeting(meetingId);
await zoom.getMeetingRecordings(meetingId);

// Users
await zoom.getUser();
await zoom.getUserSettings();
```

### Notion

```typescript
// Databases
await notion.getDatabases();
await notion.queryDatabase(databaseId, filter);

// Pages
await notion.createPage(pageData);
await notion.updatePage(pageId, properties);
await notion.getPage(pageId);

// Blocks
await notion.appendBlocks(pageId, blocks);
await notion.getBlocks(blockId);
```

### Slack

```typescript
// Messages
await slack.postMessage(channel, text, options);
await slack.updateMessage(channel, ts, text);

// Channels
await slack.getChannels();
await slack.getChannelHistory(channel);

// Users
await slack.getUsers();
await slack.getUserInfo(userId);
```

### Gmail

```typescript
// Send
await gmail.sendEmail({ to, subject, body });

// Read
await gmail.getMessages(query);
await gmail.getMessage(messageId);

// Labels
await gmail.getLabels();
await gmail.addLabel(messageId, labelId);
```

## Custom API Calls

For APIs without pre-built integrations, use fetch directly:

```typescript
async execute({ config }) {
  // Direct API call with user's credentials
  const response = await fetch('https://api.custom-service.com/data', {
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  return await response.json();
}
```

This is your escape hatch for any API.

## Token Security

WORKWAY secures OAuth tokens:

| Layer | Protection |
|-------|------------|
| Storage | Encrypted at rest |
| Transit | TLS 1.3 |
| Access | Per-workflow scope |
| Refresh | Automatic rotation |
| Revocation | User can disconnect anytime |

Users connect once in their WORKWAY dashboard. Workflows receive pre-authenticated clients.

## Handling Integration Errors

```typescript
import { IntegrationError, ErrorCode } from '@workwayco/sdk';

async execute({ integrations, context }) {
  const { notion } = integrations;

  try {
    await notion.createPage(pageData);
  } catch (error) {
    if (error instanceof IntegrationError) {
      if (error.code === ErrorCode.AUTH_EXPIRED || error.code === ErrorCode.AUTH_INVALID) {
        // User needs to reconnect
        context.log.error('Notion connection expired');
        return { success: false, error: 'Please reconnect Notion' };
      }

      if (error.code === ErrorCode.RATE_LIMITED) {
        // Will be retried automatically
        throw error;
      }
    }

    // Unknown error
    context.log.error('Notion error', { error });
    return { success: false, error: 'Failed to create page' };
  }
}
```

## Common Pitfalls

### Wrong Scopes Declared

OAuth fails if you request scopes not granted:

```typescript
// Wrong - using methods that need more scopes
integrations: [
  { service: 'notion', scopes: ['read_pages'] },  // Read only
],
async execute({ integrations }) {
  await integrations.notion.pages.create(/* ... */);  // Fails: needs write_pages
}

// Right - declare all needed scopes
integrations: [
  { service: 'notion', scopes: ['read_pages', 'write_pages'] },  // Read + Write
],
async execute({ integrations }) {
  await integrations.notion.pages.create(/* ... */);  // Works
}
```

### Not Handling Token Expiration

OAuth tokens expire. The BaseAPIClient handles refresh automatically, but your code should handle reconnection prompts:

```typescript
import { ErrorCode } from '@workwayco/sdk';

// Wrong - ignoring auth errors
async execute({ integrations }) {
  const result = await integrations.zoom.getMeetings();
  // Continues even if user needs to reconnect
}

// Right - surface reconnection needs
async execute({ integrations }) {
  const result = await integrations.zoom.getMeetings();
  if (!result.success && (
    result.error?.code === ErrorCode.AUTH_EXPIRED ||
    result.error?.code === ErrorCode.AUTH_INVALID
  )) {
    return {
      success: false,
      error: 'Please reconnect your Zoom account',
      requiresAction: true,
    };
  }
}
```

### Assuming Integration Availability

Optional integrations may not be connected:

```typescript
// Wrong - crashes if Slack not connected
integrations: [
  { service: 'notion', scopes: ['write_pages'] },
  { service: 'slack', scopes: ['chat:write'], optional: true },
],
async execute({ integrations }) {
  await integrations.slack.postMessage(/* ... */);  // undefined.postMessage
}

// Right - check before using
async execute({ integrations }) {
  if (integrations.slack) {
    await integrations.slack.postMessage(/* ... */);
  }
}
```

### Hardcoding API URLs

Use integration clients, not raw fetch:

```typescript
// Wrong - bypasses token management
async execute({ config }) {
  const response = await fetch('https://api.zoom.us/v2/meetings', {
    headers: { 'Authorization': `Bearer ${config.zoomToken}` },
  });
}

// Right - use the integration client
async execute({ integrations }) {
  const result = await integrations.zoom.getMeetings();
  // Token refresh, rate limiting handled automatically
}
```

### Ignoring Rate Limits

APIs have rate limits. The BaseAPIClient handles backoff, but batch operations need care:

```typescript
// Wrong - rapid fire requests hit rate limits
async execute({ integrations }) {
  const pages = await getPageIds();  // 100 pages
  for (const id of pages) {
    await integrations.notion.pages.update(id, data);  // 100 requests at once
  }
}

// Right - batch or throttle
async execute({ integrations }) {
  const pages = await getPageIds();
  // Process in batches of 10
  for (let i = 0; i < pages.length; i += 10) {
    const batch = pages.slice(i, i + 10);
    await Promise.all(batch.map(id =>
      integrations.notion.pages.update(id, data)
    ));
  }
}
```

## Praxis

Explore the integration patterns in the WORKWAY codebase:

> **Praxis**: Ask Claude Code: "Show me how the BaseAPIClient pattern works in packages/integrations/"

Then examine a specific integration:

> "How does the Zoom integration handle token refresh and rate limiting?"

Create a mental map of:
1. Which integrations are available
2. What methods each integration exposes
3. How error handling is centralized

Write a simple workflow that uses two integrations:

```typescript
async execute({ integrations }) {
  const { zoom, slack } = integrations;

  const meetings = await zoom.getMeetings();
  await slack.postMessage({
    channel: 'general',
    text: `You have ${meetings.length} recent meetings`,
  });

  return { success: true };
}
```

## Reflection

- How does hiding OAuth complexity help workflows focus on outcomes?
- What manual API authentication have you dealt with before?
- Why is it important that users can disconnect integrations at any time?
