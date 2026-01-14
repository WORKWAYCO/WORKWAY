# The defineWorkflow() Pattern

## Learning Objectives

By the end of this lesson, you will be able to:

- Create a complete workflow using the `defineWorkflow()` function
- Define the core workflow properties: `name`, `description`, `version`
- Understand the five key sections: integrations, inputs, trigger, execute, pathway
- Destructure `integrations`, `trigger`, `inputs`, and `storage` in the execute function
- Return properly structured results with `success`, `data`, and `error` properties

---

Every WORKWAY workflow follows the same structure. Learn this pattern once, build any workflow.

## Step-by-Step: Create Your First Workflow

### Step 1: Create the Project Structure

```bash
mkdir my-workflow
cd my-workflow
pnpm init
pnpm add @workwayco/sdk
mkdir src
```

### Step 2: Create the Workflow File

Create `src/index.ts`:

```bash
touch src/index.ts
```

### Step 3: Add the Basic Structure

Copy this minimal workflow into `src/index.ts`:

```typescript
import { defineWorkflow, manual } from "@workwayco/sdk";

export default defineWorkflow({
  name: "My First Workflow",
  description: "Learning the WORKWAY pattern",
  version: "1.0.0",

  integrations: [],

  inputs: {},

  trigger: manual(),

  async execute() {
    console.log("Workflow executed!");
    return { success: true };
  },
});
```

### Step 4: Add an Integration

Update the workflow to use Notion:

```typescript
integrations: [
  { service: 'notion', scopes: ['read_pages', 'write_pages'] },
],
```

### Step 5: Add User Inputs

Define what users can configure:

```typescript
inputs: {
  notionDatabaseId: {
    type: 'text',
    label: 'Notion Database ID',
    required: true,
  },
},
```

### Step 6: Implement the Execute Function

Add the business logic:

```typescript
async execute({ inputs, integrations }) {
  const { notion } = integrations;

  const page = await notion.pages.create({
    parent: { database_id: inputs.notionDatabaseId },
    properties: {
      Name: { title: [{ text: { content: 'Test Page' } }] },
    },
  });

  return { success: true, pageId: page.data?.id };
},
```

### Step 7: Test Locally

```bash
workway dev
curl http://localhost:8787/execute -d '{}'
```

---

## Anatomy of a Workflow

This is the actual `stripe-to-notion` workflow from `packages/workflows/src/stripe-to-notion/index.ts` (simplified for clarity):

```typescript
// From: packages/workflows/src/stripe-to-notion/index.ts
import { defineWorkflow, webhook } from "@workwayco/sdk";

export default defineWorkflow({
  // Basic info
  name: "Stripe to Notion Invoice Tracker",
  description: "Automatically log all Stripe payments to your Notion database",
  version: "1.0.0",

  // Required integrations with OAuth scopes
  integrations: [
    { service: "stripe", scopes: ["read_payments", "webhooks"] },
    { service: "notion", scopes: ["write_pages", "read_databases"] },
  ],

  // User-configurable inputs
  inputs: {
    notionDatabaseId: {
      type: "text",
      label: "Notion Database for Payments",
      required: true,
      description: "Select the database where payments will be logged",
    },
    includeRefunds: {
      type: "boolean",
      label: "Track Refunds",
      default: true,
      description: "Also log refunds to the database",
    },
    currencyFormat: {
      type: "select",
      label: "Currency Display",
      options: ["symbol", "code", "both"],
      default: "symbol",
    },
  },

  // When to run: webhook from Stripe
  trigger: webhook({
    service: "stripe",
    events: ["payment_intent.succeeded", "charge.refunded"],
  }),

  // What happens when the workflow runs
  async execute({ trigger, inputs, integrations }) {
    const event = trigger.data;
    const isRefund = event.type === "charge.refunded";

    // Skip refunds if not configured
    if (isRefund && !inputs.includeRefunds) {
      return { success: true, skipped: true, reason: "Refunds disabled" };
    }

    // Extract payment details
    const paymentData = event.data.object;
    const amount = paymentData.amount / 100;
    const currency = paymentData.currency.toUpperCase();

    // Create Notion page
    const notionPage = await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: `${isRefund ? "Refund" : "Payment"}: $${amount}`,
              },
            },
          ],
        },
        Amount: { number: isRefund ? -amount : amount },
        Currency: { select: { name: currency } },
        Status: { select: { name: isRefund ? "Refunded" : "Completed" } },
        "Payment ID": { rich_text: [{ text: { content: paymentData.id } }] },
        Date: {
          date: { start: new Date(paymentData.created * 1000).toISOString() },
        },
      },
    });

    if (!notionPage.success) {
      throw new Error(
        `Failed to create Notion page: ${notionPage.error?.message}`,
      );
    }

    return {
      success: true,
      paymentId: paymentData.id,
      notionPageId: notionPage.data.id,
      type: isRefund ? "refund" : "payment",
    };
  },
});
```

## The Key Parts

### 1. Basic Info

Basic workflow information:

```typescript
name: 'Human Readable Name',       // Displayed in marketplace
description: 'What this does',     // Shown in workflow cards
version: '1.0.0',                  // Semver for updates
```

### 2. Integrations

Define required service connections:

```typescript
integrations: [
  { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
  { service: 'notion', scopes: ['read_pages', 'write_pages'] },
  { service: 'slack', scopes: ['send_messages'], optional: true }, // Optional
],
```

Users must connect these services before installing your workflow.

### 3. Inputs

Inputs define what users customize when installing your workflow:

```typescript
inputs: {
  // Text input
  apiKey: {
    type: 'text',
    label: 'API Key',
    description: 'Your service API key',
    required: true,
  },

  // Dropdown selection
  syncMode: {
    type: 'select',
    label: 'Sync Mode',
    options: ['meetings_only', 'clips_only', 'both'],
    default: 'both',
  },

  // Boolean toggle
  includeTranscript: {
    type: 'boolean',
    label: 'Include Full Transcript',
    default: true,
  },
}
```

### 4. Trigger

Define when the workflow runs using trigger helpers. These examples are from actual production workflows:

```typescript
import { webhook, schedule, cron, manual } from '@workwayco/sdk';

// Webhook trigger - multiple events
// From: packages/workflows/src/stripe-to-notion/index.ts
trigger: webhook({
  service: 'stripe',
  events: ['payment_intent.succeeded', 'charge.refunded'],
}),

// Webhook trigger - GitHub events
// From: packages/workflows/src/github-to-linear/index.ts
trigger: webhook({
  service: 'github',
  events: ['issues.opened', 'issues.edited', 'issues.closed', 'issues.reopened', 'issue_comment.created'],
}),

// Schedule with dynamic cron from user inputs
// From: packages/workflows/src/standup-bot/index.ts
trigger: schedule({
  cron: '0 {{inputs.standupTime.hour}} * * 1-5',  // Weekdays at user-configured time
  timezone: '{{inputs.timezone}}',
}),

// Schedule with fixed cron
// From: packages/workflows/src/payment-reminders/index.ts
trigger: schedule({
  cron: '0 {{inputs.checkTime.hour}} * * *',  // Daily at configured time
  timezone: '{{inputs.timezone}}',
}),

// cron() is an alias for schedule()
// From: packages/workflows/src/meeting-intelligence/index.ts
trigger: cron({
  schedule: '0 7 * * *',  // 7 AM UTC daily
  timezone: 'UTC',
}),

// Manual trigger
trigger: manual({ description: 'Generate report' }),
```

### 5. Execute Function

The execute function contains your workflow logic. Inside `execute()`, you have significant flexibility:

- **`fetch()`** - Call any HTTP API directly
- **Custom functions** - Define helpers at module level
- **Workers AI** - Generate text, summarize, classify
- **Standard JS** - Arrays, dates, regex, JSON, Map, Set
- **Complex logic** - if/else, loops, try/catch

```typescript
async execute({ trigger, inputs, integrations, storage }) {
  // trigger - what started this execution (data, type, timestamp)
  // inputs - user's configuration values
  // integrations - authenticated API clients
  // storage - persistent key-value storage

  const { zoom, notion } = integrations;

  // Get meeting data from trigger
  const meeting = trigger.data.object;

  // Create Notion page
  const result = await notion.pages.create({
    parent: { database_id: inputs.notionDatabaseId },
    properties: {
      Name: { title: [{ text: { content: meeting.topic } }] },
      Date: { date: { start: meeting.start_time } },
    },
  });

  return { success: true, meetingId: meeting.id };
}
```

See the [Common Pitfalls lesson](/paths/building-workflows/lessons/common-pitfalls) for full details on what works and what doesn't.

### 6. Return Value

Always return a result object:

```typescript
// Success
return {
  success: true,
  data: {
    /* any data you want to expose */
  },
};

// Failure
return {
  success: false,
  error: "Human-readable error message",
};
```

## The Execute Parameters

### trigger

Contains information about what started the workflow:

```typescript
// Common properties
trigger.type; // 'webhook' | 'schedule' | 'manual' | 'poll'
trigger.timestamp; // When triggered
trigger.data; // Payload data (for webhooks)
trigger.payload; // Alias for data
```

### inputs

User's configuration values from the inputs schema:

```typescript
inputs.notionDatabaseId; // string
inputs.includeTranscript; // boolean
inputs.syncMode; // 'meetings_only' | 'clips_only' | 'both'
```

### integrations

Pre-authenticated API clients for connected services:

```typescript
const { zoom, notion, slack } = integrations;

// Zoom methods
await zoom.getMeetings({ days: 1 });
await zoom.getTranscript({ meetingId });

// Notion methods
await notion.pages.create({ ... });
await notion.databases.query({ ... });

// Slack methods
await slack.chat.postMessage({ ... });
```

### storage

Persistent key-value storage (survives across executions). From `github-to-linear/index.ts`:

```typescript
// From: packages/workflows/src/github-to-linear/index.ts
async execute({ trigger, inputs, integrations, storage }) {
  const event = trigger.data;
  const issue = event.issue;
  const repo = event.repository;

  // Generate storage key for tracking synced issues
  const storageKey = `github-issue:${repo.full_name}:${issue.number}`;

  // Idempotency check: see if we've already synced this issue
  const existingSync = await storage.get(storageKey);
  if (existingSync?.linearIssueId) {
    return {
      success: true,
      skipped: true,
      reason: 'Issue already synced (idempotency check)',
      linearIssueId: existingSync.linearIssueId,
    };
  }

  // Create Linear issue...
  const linearIssue = await integrations.linear.issues.create({ /* ... */ });

  // Store mapping for future updates
  await storage.set(storageKey, {
    linearIssueId: linearIssue.data.id,
    linearIdentifier: linearIssue.data.identifier,
    githubIssue: issue.number,
    createdAt: Date.now(),
  });

  return { success: true, linearIssueId: linearIssue.data.id };
}
```

## Complete Examples from the Codebase

### Example 1: Webhook-Triggered Workflow

This example is from `packages/workflows/src/stripe-to-notion/index.ts`:

```typescript
// Real workflow: packages/workflows/src/stripe-to-notion/index.ts
import { defineWorkflow, webhook } from "@workwayco/sdk";

export default defineWorkflow({
  name: "Stripe to Notion Invoice Tracker",
  description: "Automatically log all Stripe payments to your Notion database",
  version: "1.0.0",

  integrations: [
    { service: "stripe", scopes: ["read_payments", "webhooks"] },
    { service: "notion", scopes: ["write_pages", "read_databases"] },
  ],

  inputs: {
    notionDatabaseId: {
      type: "text",
      label: "Notion Database for Payments",
      required: true,
      description: "Select the database where payments will be logged",
    },
    includeRefunds: {
      type: "boolean",
      label: "Track Refunds",
      default: true,
      description: "Also log refunds to the database",
    },
    currencyFormat: {
      type: "select",
      label: "Currency Display",
      options: ["symbol", "code", "both"],
      default: "symbol",
    },
  },

  trigger: webhook({
    service: "stripe",
    events: ["payment_intent.succeeded", "charge.refunded"],
  }),

  async execute({ trigger, inputs, integrations }) {
    const event = trigger.data;
    const isRefund = event.type === "charge.refunded";

    // Skip refunds if not configured
    if (isRefund && !inputs.includeRefunds) {
      return { success: true, skipped: true, reason: "Refunds disabled" };
    }

    // Extract payment details
    const paymentData = event.data.object;
    const amount = paymentData.amount / 100;
    const currency = paymentData.currency.toUpperCase();

    // Format currency display
    const currencySymbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
    };
    const symbol = currencySymbols[currency] || currency;
    const displayAmount = `${symbol}${amount.toFixed(2)}`;

    // Idempotency check: prevent duplicate entries
    const existingCheck = await integrations.notion.databases.query({
      database_id: inputs.notionDatabaseId,
      filter: {
        property: "Payment ID",
        rich_text: { equals: paymentData.id },
      },
      page_size: 1,
    });

    if (existingCheck.success && existingCheck.data?.results?.length > 0) {
      return {
        success: true,
        skipped: true,
        reason: "Payment already logged (idempotency check)",
      };
    }

    // Create Notion page
    const notionPage = await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: `${isRefund ? "🔄 Refund" : "💰 Payment"}: ${displayAmount}`,
              },
            },
          ],
        },
        Amount: { number: isRefund ? -amount : amount },
        Currency: { select: { name: currency } },
        Status: { select: { name: isRefund ? "Refunded" : "Completed" } },
        "Payment ID": { rich_text: [{ text: { content: paymentData.id } }] },
        Date: {
          date: { start: new Date(paymentData.created * 1000).toISOString() },
        },
      },
    });

    if (!notionPage.success) {
      throw new Error(
        `Failed to create Notion page: ${notionPage.error?.message}`,
      );
    }

    return {
      success: true,
      paymentId: paymentData.id,
      notionPageId: notionPage.data.id,
      amount: displayAmount,
      type: isRefund ? "refund" : "payment",
    };
  },
});
```

### Example 2: Schedule-Triggered Workflow

This example is from `packages/workflows/src/standup-bot/index.ts`:

```typescript
// From: packages/workflows/src/standup-bot/index.ts
import { defineWorkflow, schedule } from "@workwayco/sdk";

export default defineWorkflow({
  name: "Standup Reminder Bot",
  description: "Collect and share daily standups in Slack",
  version: "1.0.0",

  integrations: [
    { service: "slack", scopes: ["send_messages", "read_messages"] },
    { service: "notion", scopes: ["write_pages", "read_databases"] },
  ],

  inputs: {
    standupChannel: {
      type: "text",
      label: "Standup Channel",
      required: true,
      description: "Channel for daily standups",
    },
    standupTime: {
      type: "time",
      label: "Standup Prompt Time",
      default: "09:00",
    },
    timezone: {
      type: "timezone",
      label: "Timezone",
      default: "America/New_York",
    },
    promptQuestions: {
      type: "array",
      label: "Standup Questions",
      items: { type: "string" },
      default: [
        "What did you accomplish yesterday?",
        "What are you working on today?",
        "Any blockers or things you need help with?",
      ],
    },
  },

  trigger: schedule({
    cron: "0 {{inputs.standupTime.hour}} * * 1-5", // Weekdays
    timezone: "{{inputs.timezone}}",
  }),

  async execute({ inputs, integrations }) {
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

    // Build standup prompt
    const questionsFormatted = inputs.promptQuestions
      .map((q: string, i: number) => `${i + 1}. ${q}`)
      .join("\n");

    // Post standup prompt
    const promptMessage = await integrations.slack.chat.postMessage({
      channel: inputs.standupChannel,
      text: `Good morning! Time for standup - ${dateStr}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `Daily Standup - ${dateStr}` },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Good morning team! Please share your standup update.\n\n*Today's questions:*\n${questionsFormatted}`,
          },
        },
      ],
    });

    if (!promptMessage.success) {
      throw new Error("Failed to post standup prompt");
    }

    return {
      success: true,
      date: dateStr,
      promptPosted: true,
      threadTs: promptMessage.data?.ts,
    };
  },
});
```

## Common Pitfalls

### Missing Return Statement

Every `execute` function must return a result object:

```typescript
// Wrong - no return
async execute({ integrations }) {
  await integrations.notion.pages.create(/* ... */);
}

// Right - explicit return
async execute({ integrations }) {
  const page = await integrations.notion.pages.create(/* ... */);
  return { success: true, pageId: page.data?.id };
}
```

### Incorrect Integration Declaration

Integrations must be declared in the `integrations` array before use:

```typescript
// Wrong - using undeclared integration
integrations: [
  { service: 'notion', scopes: ['write_pages'] },
],
async execute({ integrations }) {
  const { notion, slack } = integrations;  // slack not declared!
  await slack.postMessage(/* ... */);  // Runtime error
}

// Right - all integrations declared
integrations: [
  { service: 'notion', scopes: ['write_pages'] },
  { service: 'slack', scopes: ['chat:write'] },  // Declared
],
async execute({ integrations }) {
  const { notion, slack } = integrations;  // Both available
}
```

### Destructuring Before Checking Success

Integration methods return `ActionResult` objects that should be checked:

```typescript
// Wrong - assumes success
async execute({ integrations }) {
  const result = await integrations.zoom.getMeeting(id);
  const topic = result.data.topic;  // Crashes if request failed
}

// Right - check success first
async execute({ integrations }) {
  const result = await integrations.zoom.getMeeting(id);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  const topic = result.data.topic;  // Safe access
}
```

### Using Node.js APIs

Cloudflare Workers don't have Node.js built-ins:

```typescript
// Wrong - Node.js APIs unavailable
import fs from 'fs';
import path from 'path';

async execute() {
  const data = fs.readFileSync('file.txt');  // Runtime error
}

// Right - use Workers-compatible APIs
async execute({ storage }) {
  const data = await storage.get('key');  // KV storage works
}
```

### Forgetting Async/Await

Integration methods are async - missing `await` causes issues:

```typescript
// Wrong - missing await
async execute({ integrations }) {
  const page = integrations.notion.pages.create(/* ... */);  // Returns Promise
  return { success: true, pageId: page.id };  // undefined
}

// Right - await the promise
async execute({ integrations }) {
  const page = await integrations.notion.pages.create(/* ... */);
  return { success: true, pageId: page.data?.id };
}
```

## Praxis

Study the defineWorkflow() pattern in real production workflows:

> **Praxis**: Ask Claude Code: "Compare these three workflows in packages/workflows/src/: stripe-to-notion, standup-bot, and github-to-linear. What patterns do they have in common?"

These workflows demonstrate:

- **stripe-to-notion**: Webhook trigger, Notion page creation, idempotency checks
- **standup-bot**: Schedule trigger with user-configurable time, Slack blocks
- **github-to-linear**: Multi-event webhook, storage for tracking synced issues

After reviewing the examples, create a minimal workflow skeleton:

```typescript
import { defineWorkflow, manual } from "@workwayco/sdk";

export default defineWorkflow({
  name: "My First Pattern",
  description: "Learning the structure",
  version: "1.0.0",

  integrations: [],

  inputs: {},

  trigger: manual(),

  async execute({ trigger, inputs, integrations, storage }) {
    console.log("Workflow executed");
    return { success: true };
  },
});
```

Save this as `src/index.ts` in your test project. Notice how the key parts (name, integrations, inputs, trigger, execute) create a consistent structure.

## Reflection

- How does the standard structure help you understand unfamiliar workflows?
- What configuration options would your ideal workflow need?
- How does separating inputs, trigger, and execute help the tool recede?
