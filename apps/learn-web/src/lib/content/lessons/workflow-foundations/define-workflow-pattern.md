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
import { defineWorkflow, manual } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'My First Workflow',
  description: 'Learning the WORKWAY pattern',
  version: '1.0.0',

  integrations: [],

  inputs: {},

  trigger: manual(),

  async execute() {
    console.log('Workflow executed!');
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

```typescript
// From: packages/workflows/src/stripe-to-notion/index.ts
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  // Basic info
  name: 'Stripe to Notion Invoice Tracker',
  description: 'Automatically log all Stripe payments to your Notion database',
  version: '1.0.0',

  // Required integrations with OAuth scopes
  integrations: [
    { service: 'stripe', scopes: ['read_payments', 'webhooks'] },
    { service: 'notion', scopes: ['write_pages', 'read_databases'] },
  ],

  // User-configurable inputs
  inputs: {
    notionDatabaseId: {
      type: 'text',
      label: 'Notion Database for Payments',
      required: true,
      description: 'Select the database where payments will be logged',
    },
    includeRefunds: {
      type: 'boolean',
      label: 'Track Refunds',
      default: true,
      description: 'Also log refunds to the database',
    },
  },

  // When to run: webhook from Stripe
  trigger: webhook({
    service: 'stripe',
    events: ['payment_intent.succeeded', 'charge.refunded'],
  }),

  // What happens when the workflow runs
  async execute({ trigger, inputs, integrations }) {
    // Your workflow logic here
    const event = trigger.data;
    const paymentData = event.data.object;

    // Create Notion page
    const page = await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        Name: { title: [{ text: { content: `Payment: ${paymentData.amount / 100}` } }] },
      },
    });

    return { success: true, pageId: page.data?.id };
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

Define when the workflow runs using trigger helpers:

```typescript
import { webhook, schedule, cron, manual, poll } from '@workwayco/sdk';

// Webhook trigger - single event
trigger: webhook({ service: 'zoom', event: 'recording.completed' }),

// Webhook trigger - multiple events (from stripe-to-notion workflow)
trigger: webhook({
  service: 'stripe',
  events: ['payment_intent.succeeded', 'charge.refunded'],
}),

// Schedule trigger - cron expression (both patterns work)
trigger: schedule('0 9 * * *'),  // Daily at 9 AM UTC

// Schedule with timezone (from standup-bot workflow)
trigger: schedule({
  cron: '0 9 * * 1-5',  // Weekdays at 9 AM
  timezone: 'America/New_York',
}),

// cron() is an alias for schedule()
trigger: cron({
  schedule: '0 7 * * *',
  timezone: 'UTC',
}),

// Manual trigger
trigger: manual({ description: 'Generate report' }),
```

### 5. Execute Function

The execute function contains your workflow logic:

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

### 6. Return Value

Always return a result object:

```typescript
// Success
return {
  success: true,
  data: { /* any data you want to expose */ }
};

// Failure
return {
  success: false,
  error: 'Human-readable error message'
};
```

## The Execute Parameters

### trigger

Contains information about what started the workflow:

```typescript
// Common properties
trigger.type       // 'webhook' | 'schedule' | 'manual' | 'poll'
trigger.timestamp  // When triggered
trigger.data       // Payload data (for webhooks)
trigger.payload    // Alias for data
```

### inputs

User's configuration values from the inputs schema:

```typescript
inputs.notionDatabaseId  // string
inputs.includeTranscript // boolean
inputs.syncMode          // 'meetings_only' | 'clips_only' | 'both'
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

Persistent key-value storage (survives across executions):

```typescript
// Get value
const lastProcessedId = await storage.get('lastProcessedId');

// Set value
await storage.put('lastProcessedId', meeting.id);

// Delete value
await storage.delete('lastProcessedId');
```

## Complete Example

This example is based on the real `stripe-to-notion` workflow in `packages/workflows/src/stripe-to-notion/index.ts`:

```typescript
// Real workflow: packages/workflows/src/stripe-to-notion/index.ts
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Stripe to Notion Invoice Tracker',
  description: 'Automatically log all Stripe payments to your Notion database',
  version: '1.0.0',

  integrations: [
    { service: 'stripe', scopes: ['read_payments', 'webhooks'] },
    { service: 'notion', scopes: ['write_pages', 'read_databases'] },
  ],

  inputs: {
    notionDatabaseId: {
      type: 'text',
      label: 'Notion Database for Payments',
      required: true,
      description: 'Select the database where payments will be logged',
    },
    includeRefunds: {
      type: 'boolean',
      label: 'Track Refunds',
      default: true,
      description: 'Also log refunds to the database',
    },
    currencyFormat: {
      type: 'select',
      label: 'Currency Display',
      options: ['symbol', 'code', 'both'],
      default: 'symbol',
    },
  },

  trigger: webhook({
    service: 'stripe',
    events: ['payment_intent.succeeded', 'charge.refunded'],
  }),

  async execute({ trigger, inputs, integrations }) {
    const event = trigger.data;
    const isRefund = event.type === 'charge.refunded';

    // Skip refunds if not configured
    if (isRefund && !inputs.includeRefunds) {
      return { success: true, skipped: true, reason: 'Refunds disabled' };
    }

    // Extract payment details
    const paymentData = event.data.object;
    const amount = paymentData.amount / 100;
    const currency = paymentData.currency.toUpperCase();

    // Format currency display
    const currencySymbols: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥',
    };
    const symbol = currencySymbols[currency] || currency;
    const displayAmount = `${symbol}${amount.toFixed(2)}`;

    // Idempotency check: prevent duplicate entries
    const existingCheck = await integrations.notion.databases.query({
      database_id: inputs.notionDatabaseId,
      filter: {
        property: 'Payment ID',
        rich_text: { equals: paymentData.id },
      },
      page_size: 1,
    });

    if (existingCheck.success && existingCheck.data?.results?.length > 0) {
      return {
        success: true,
        skipped: true,
        reason: 'Payment already logged (idempotency check)',
      };
    }

    // Create Notion page
    const notionPage = await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        Name: {
          title: [{ text: { content: `${isRefund ? '🔄 Refund' : '💰 Payment'}: ${displayAmount}` } }],
        },
        Amount: { number: isRefund ? -amount : amount },
        Currency: { select: { name: currency } },
        Status: { select: { name: isRefund ? 'Refunded' : 'Completed' } },
        'Payment ID': { rich_text: [{ text: { content: paymentData.id } }] },
        Date: { date: { start: new Date(paymentData.created * 1000).toISOString() } },
      },
    });

    if (!notionPage.success) {
      throw new Error(`Failed to create Notion page: ${notionPage.error?.message}`);
    }

    return {
      success: true,
      paymentId: paymentData.id,
      notionPageId: notionPage.data.id,
      amount: displayAmount,
      type: isRefund ? 'refund' : 'payment',
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

Study the defineWorkflow() pattern in real code:

> **Praxis**: Ask Claude Code: "Show me 3 different workflow examples from packages/workflows/ and highlight what's common across all of them"

After reviewing the examples, create a minimal workflow skeleton:

```typescript
import { defineWorkflow, manual } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'My First Pattern',
  description: 'Learning the structure',
  version: '1.0.0',

  integrations: [],

  inputs: {},

  trigger: manual(),

  async execute({ trigger, inputs, integrations, storage }) {
    console.log('Workflow executed');
    return { success: true };
  },
});
```

Save this as `src/index.ts` in your test project. Notice how the key parts (name, integrations, inputs, trigger, execute) create a consistent structure.

## Reflection

- How does the standard structure help you understand unfamiliar workflows?
- What configuration options would your ideal workflow need?
- How does separating inputs, trigger, and execute help the tool recede?
