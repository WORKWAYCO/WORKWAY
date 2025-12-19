# Integrations & OAuth Providers

## Learning Objectives

By the end of this lesson, you will be able to:

- Understand the BaseAPIClient pattern that powers all WORKWAY integrations
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

WORKWAY provides 20+ production integrations. Here are the most commonly used:

| Integration | Capabilities |
|-------------|--------------|
| `zoom` | Meetings, recordings, clips |
| `notion` | Pages, databases, blocks, tasks |
| `slack` | Messages, channels, users, threads |
| `google-sheets` | Read, write, format spreadsheets |
| `stripe` | Payments, customers, subscriptions |
| `hubspot` | Contacts, deals, companies |
| `linear` | Issues, projects, teams |
| `github` | Repos, issues, PRs, commits |
| `airtable` | Bases, tables, records |
| `discord` | Messages, channels, guilds |
| `calendly` | Events, scheduling |
| `typeform` | Forms, responses |
| `todoist` | Tasks, projects |

**Industry-Specific:**

| Integration | Use Case |
|-------------|----------|
| `procore` | Construction management |
| `sikka` | Dental practice management |
| `nexhealth` | Healthcare scheduling |
| `follow-up-boss` | Real estate CRM |
| `quickbooks` | Accounting |
| `docusign` | Document signing |

**AI Integration:**

| Integration | Capabilities |
|-------------|--------------|
| `workers-ai` | Text generation, summarization, classification |

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

All WORKWAY integrations extend BaseAPIClient from `packages/integrations/src/core/base-client.ts`. This eliminates ~120-180 lines of duplicate code per integration.

**Weniger, aber besser**: One HTTP implementation for all integrations.

```typescript
// From packages/integrations/src/core/base-client.ts
import {
  IntegrationError,
  ErrorCode,
  createErrorFromResponse,
} from '@workwayco/sdk';

export interface TokenRefreshHandler {
  refreshToken: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  onTokenRefreshed: (newAccessToken: string, newRefreshToken?: string) => void | Promise<void>;
}

export interface BaseClientConfig {
  accessToken: string;
  apiUrl: string;
  timeout?: number;
  tokenRefresh?: TokenRefreshHandler;
}

export abstract class BaseAPIClient {
  protected accessToken: string;
  protected readonly apiUrl: string;
  protected readonly timeout: number;
  protected readonly tokenRefresh?: TokenRefreshHandler;

  constructor(config: BaseClientConfig) {
    this.accessToken = config.accessToken;
    this.apiUrl = config.apiUrl;
    this.timeout = config.timeout ?? 30000;
    this.tokenRefresh = config.tokenRefresh;
  }

  /**
   * Make an authenticated HTTP request
   * - Automatic token refresh on 401
   * - Timeout handling
   * - Consistent error wrapping
   */
  protected async request(
    path: string,
    options: RequestInit = {},
    additionalHeaders: Record<string, string> = {},
    isRetry = false
  ): Promise<Response> {
    const url = `${this.apiUrl}${path}`;
    const headers = new Headers(options.headers);

    // Standard headers
    headers.set('Authorization', `Bearer ${this.accessToken}`);
    headers.set('Content-Type', 'application/json');

    // Integration-specific headers (e.g., Notion-Version, Stripe-Version)
    for (const [key, value] of Object.entries(additionalHeaders)) {
      headers.set(key, value);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      // Handle 401 Unauthorized - attempt token refresh if configured
      if (response.status === 401 && !isRetry && this.tokenRefresh) {
        clearTimeout(timeoutId);
        await this.refreshAccessToken();
        // Retry the request once with the new token
        return this.request(path, options, additionalHeaders, true);
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new IntegrationError(ErrorCode.TIMEOUT,
          `Request timed out after ${this.timeout}ms`,
          { retryable: true });
      }
      throw new IntegrationError(ErrorCode.NETWORK_ERROR,
        `Network request failed: ${error}`,
        { retryable: true });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Convenience methods for common HTTP verbs
  protected get(path: string, headers?: Record<string, string>): Promise<Response>;
  protected post(path: string, body?: unknown, headers?: Record<string, string>): Promise<Response>;
  protected patch(path: string, body?: unknown, headers?: Record<string, string>): Promise<Response>;
  protected put(path: string, body?: unknown, headers?: Record<string, string>): Promise<Response>;
  protected delete(path: string, headers?: Record<string, string>): Promise<Response>;

  // JSON helpers that combine request + parsing + error handling
  protected async getJson<T>(path: string, headers?: Record<string, string>): Promise<T>;
  protected async postJson<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  protected async patchJson<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
}

/**
 * Build a query string from an object, filtering out undefined/null values
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}
```

### How Integrations Extend BaseAPIClient

```typescript
// From packages/integrations/src/slack/index.ts
import {
  ActionResult,
  createActionResult,
  IntegrationError,
  ErrorCode,
} from '@workwayco/sdk';
import {
  BaseAPIClient,
  validateAccessToken,
  createErrorHandler,
  assertResponseOk,
} from '../core/index.js';

/** Error handler bound to Slack integration */
const handleError = createErrorHandler('slack');

export class Slack extends BaseAPIClient {
  constructor(config: SlackConfig) {
    validateAccessToken(config.accessToken, 'slack');
    super({
      accessToken: config.accessToken,
      apiUrl: config.apiUrl || 'https://slack.com/api',
      timeout: config.timeout,
    });
  }

  async listChannels(options: ListChannelsOptions = {}): Promise<ActionResult<SlackChannel[]>> {
    const { limit = 100, cursor, excludeArchived = true } = options;

    try {
      const params = new URLSearchParams({
        limit: Math.min(limit, 1000).toString(),
        exclude_archived: excludeArchived.toString(),
        types: 'public_channel,private_channel',
      });
      if (cursor) params.set('cursor', cursor);

      const response = await this.get(`/conversations.list?${params}`);
      await assertResponseOk(response, { integration: 'slack', action: 'list-channels' });

      const data = await response.json() as { ok: boolean; error?: string; channels?: SlackChannel[] };

      if (!data.ok) {
        throw this.createSlackError(data.error || 'Unknown error', 'list-channels');
      }

      return createActionResult({
        data: data.channels || [],
        integration: 'slack',
        action: 'list-channels',
        schema: 'slack.channel-list.v1',
      });
    } catch (error) {
      return handleError(error, 'list-channels');
    }
  }

  /** Map Slack error codes to IntegrationError */
  private createSlackError(error: string, action: string): IntegrationError {
    const errorMap: Record<string, ErrorCode> = {
      not_authed: ErrorCode.AUTH_MISSING,
      invalid_auth: ErrorCode.AUTH_INVALID,
      token_expired: ErrorCode.AUTH_EXPIRED,
      ratelimited: ErrorCode.RATE_LIMITED,
      channel_not_found: ErrorCode.NOT_FOUND,
    };
    const code = errorMap[error] || ErrorCode.API_ERROR;
    return new IntegrationError(code, `Slack API error: ${error}`, {
      integration: 'slack', action, providerCode: error,
      retryable: code === ErrorCode.RATE_LIMITED,
    });
  }
}
```

Here's another example showing Notion with version headers:

```typescript
// From packages/integrations/src/notion/index.ts
export class Notion extends BaseAPIClient {
  private notionVersion: string;

  constructor(config: NotionConfig) {
    validateAccessToken(config.accessToken, 'notion');
    super({
      accessToken: config.accessToken,
      apiUrl: config.apiUrl || 'https://api.notion.com/v1',
      timeout: config.timeout,
    });
    this.notionVersion = config.notionVersion || '2022-06-28';
  }

  /** Notion requires version header on all requests */
  private get notionHeaders(): Record<string, string> {
    return { 'Notion-Version': this.notionVersion };
  }

  async getPage(options: GetPageOptions): Promise<ActionResult<NotionPage>> {
    if (!options.pageId) {
      return ActionResult.error('Page ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
        integration: 'notion', action: 'get-page',
      });
    }

    try {
      const response = await this.get(`/pages/${options.pageId}`, this.notionHeaders);
      await assertResponseOk(response, { integration: 'notion', action: 'get-page' });
      const page = await response.json() as NotionPage;

      return createActionResult({
        data: page,
        integration: 'notion',
        action: 'get-page',
        schema: 'notion.page.v1',
      });
    } catch (error) {
      return handleError(error, 'get-page');
    }
  }
}
```

### Error Handler Pattern

```typescript
// From packages/integrations/src/core/error-handler.ts
import {
  ActionResult,
  IntegrationError,
  ErrorCode,
  createErrorFromResponse,
} from '@workwayco/sdk';

/**
 * Create an error handler bound to a specific integration
 */
export function createErrorHandler(integrationName: string) {
  return function handleError<T>(error: unknown, action: string): ActionResult<T> {
    if (error instanceof IntegrationError) {
      return ActionResult.error(error.message, error.code, {
        integration: integrationName,
        action,
      });
    }
    const errMessage = error instanceof Error ? error.message : String(error);
    return ActionResult.error(
      `Failed to ${action.replace(/-/g, ' ')}: ${errMessage}`,
      ErrorCode.API_ERROR,
      { integration: integrationName, action }
    );
  };
}

/**
 * Assert response is OK, throw IntegrationError if not
 */
export async function assertResponseOk(
  response: Response,
  context: { integration: string; action: string }
): Promise<void> {
  if (!response.ok) {
    throw await createErrorFromResponse(response, context);
  }
}

/**
 * Validate that access token is provided
 */
export function validateAccessToken(
  token: unknown,
  integrationName: string
): asserts token is string {
  if (!token || (typeof token === 'string' && token.trim() === '')) {
    throw new IntegrationError(
      ErrorCode.AUTH_MISSING,
      `${integrationName} access token is required`,
      { integration: integrationName, retryable: false }
    );
  }
}

// Usage in integration methods:
const handleError = createErrorHandler('notion');

async createPage(options: CreatePageOptions): Promise<ActionResult<NotionPage>> {
  try {
    // ... implementation
    const response = await this.post('/pages', body, this.notionHeaders);
    await assertResponseOk(response, { integration: 'notion', action: 'create-page' });
    const page = await response.json() as NotionPage;
    return createActionResult({ data: page, integration: 'notion', action: 'create-page' });
  } catch (error) {
    return handleError(error, 'create-page');
  }
}
```

### Using buildQueryString (Zoom Example)

```typescript
// From packages/integrations/src/zoom/index.ts
import { buildQueryString } from '../core/index.js';

async getMeetings(options: GetMeetingsOptions = {}): Promise<ActionResult<ZoomMeeting[]>> {
  const { userId = 'me', type = 'previous_meetings', days, pageSize = 300 } = options;
  let { from, to } = options;

  // Calculate date range if days is specified (Zuhandenheit: "last 7 days" not timestamp math)
  if (days && !from && !to) {
    const now = new Date();
    to = now;
    from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  try {
    // buildQueryString filters out undefined values automatically
    const query = buildQueryString({
      type,
      page_size: Math.min(pageSize, 300),
      from: from ? this.formatDate(from) : undefined,  // Won't appear if undefined
      to: to ? this.formatDate(to) : undefined,
    });

    const response = await this.get(`/users/${userId}/meetings${query}`);
    await assertResponseOk(response, { integration: 'zoom', action: 'get-meetings' });
    // ...
  } catch (error) {
    return handleError(error, 'get-meetings');
  }
}
```

### Benefits

| Feature | What It Does |
|---------|--------------|
| Token Refresh | Automatically refreshes expired tokens via OAuth |
| Retry on 401 | One retry with fresh token before failing |
| Timeout | Configurable timeout (default: 30s) |
| Error Wrapping | Consistent `IntegrationError` format |
| Version Headers | Per-integration headers (Notion-Version, Stripe-Version) |
| JSON Helpers | `getJson()`, `postJson()` combine request + parsing |
| buildQueryString | Filters undefined/null, builds clean query strings |

## Integration Methods

All methods return `ActionResult<T>` with `success`, `data`, and `error` properties.

### Notion (from packages/integrations/src/notion/index.ts)

```typescript
// Pages
const page = await notion.getPage({ pageId: 'abc123' });
const created = await notion.createPage({
  parentDatabaseId: 'db123',
  properties: { Name: { title: [{ text: { content: 'New Page' } }] } },
  children: [/* blocks */]
});
const updated = await notion.updatePage({ pageId: 'abc123', properties: {...} });

// Databases
const database = await notion.getDatabase('db123');
const items = await notion.queryDatabase({
  databaseId: 'db123',
  filter: { property: 'Status', select: { equals: 'Done' } },
  sorts: [{ property: 'Created', direction: 'descending' }],
  page_size: 100
});

// Search
const results = await notion.search({ query: 'Project' });

// Blocks (page content)
const blocks = await notion.getBlockChildren({ blockId: 'page123' });

// Document templates (Zuhandenheit: think "create summary" not "construct blocks")
const doc = await notion.createDocument({
  database: 'db123',
  template: 'meeting',  // 'summary' | 'report' | 'notes' | 'article' | 'meeting' | 'feedback'
  data: {
    title: 'Team Standup - 2024-01-15',
    summary: 'Sprint progress on API work',
    sections: {
      actionItems: ['Review PR #123', 'Deploy staging'],
      decisions: ['Use Workers AI for summarization'],
    }
  }
});
```

### Slack (from packages/integrations/src/slack/index.ts)

```typescript
// Channels
const channels = await slack.listChannels({ limit: 20, excludeArchived: true });

// Messages with Zuhandenheit time parsing
// Developer thinks "last 24 hours" not "convert milliseconds to Unix seconds"
const messages = await slack.getMessages({
  channel: 'C123456',
  since: '24h',        // Duration string: "1h", "24h", "7d"
  humanOnly: true      // Exclude bots and system messages
});

// Or use specific dates
const weekMessages = await slack.getMessages({
  channel: 'C123456',
  since: new Date('2024-01-01')
});

// Send message
const sent = await slack.sendMessage({
  channel: 'C123456',
  text: 'Hello from WORKWAY!',
  thread_ts: 'optional-thread-ts'  // For threading
});

// Users
const user = await slack.getUser({ user: 'U123456' });

// Search messages
const results = await slack.searchMessages('budget meeting');
```

**Zuhandenheit in action**: The `humanOnly` parameter lets developers think "get what people said" instead of "filter by bot_id, subtype, and type". The `since: '24h'` syntax lets them think in human time, not Unix timestamps.

### Workers AI (from packages/integrations/src/workers-ai/index.ts)

```typescript
// Text generation
const response = await ai.generateText({
  prompt: 'Summarize this meeting transcript...',
  maxTokens: 500
});

// Structured extraction
const data = await ai.extractStructured({
  text: meetingTranscript,
  schema: {
    actionItems: 'string[]',
    decisions: 'string[]',
    sentiment: 'positive | neutral | negative'
  }
});
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
