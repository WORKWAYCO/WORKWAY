# The defineWorkflow() Pattern

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
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  // Basic info
  name: 'Meeting Notes to Notion',
  description: 'Automatically save meeting transcripts to Notion',
  version: '1.0.0',

  // Required integrations
  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
    { service: 'notion', scopes: ['read_pages', 'write_pages'] },
  ],

  // User-configurable inputs
  inputs: {
    notionDatabaseId: {
      type: 'text',
      label: 'Notion Database',
      description: 'Select the database for meeting notes',
      required: true,
    },
  },

  // When to run
  trigger: webhook({
    service: 'zoom',
    event: 'recording.completed',
  }),

  // What happens when the workflow runs
  async execute({ trigger, inputs, integrations, storage }) {
    // Your workflow logic here
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
import { webhook, schedule, manual, poll } from '@workwayco/sdk';

// Webhook trigger
trigger: webhook({ service: 'zoom', event: 'recording.completed' }),

// Schedule trigger (cron)
trigger: schedule('0 9 * * *'),  // Daily at 9 AM

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

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Zoom Recordings to Notion',
  description: 'Save Zoom meeting recordings and transcripts to Notion',
  version: '1.0.0',

  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
    { service: 'notion', scopes: ['read_pages', 'write_pages'] },
  ],

  inputs: {
    notionDatabaseId: {
      type: 'text',
      label: 'Meetings Database ID',
      required: true,
    },
    includeTranscript: {
      type: 'boolean',
      label: 'Include Transcript',
      default: true,
    },
  },

  trigger: webhook({
    service: 'zoom',
    event: 'recording.completed',
  }),

  async execute({ trigger, inputs, integrations, storage }) {
    const { zoom, notion } = integrations;

    // Get meeting from trigger data
    const meetingId = trigger.data.object.id;
    const topic = trigger.data.object.topic;

    // Build page content
    const children = [
      {
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: 'Meeting Details' } }] },
      },
    ];

    // Get transcript if requested
    if (inputs.includeTranscript) {
      const result = await zoom.getTranscript({ meetingId });
      if (result.success && result.data?.transcript_text) {
        children.push({
          type: 'heading_2',
          heading_2: { rich_text: [{ text: { content: 'Transcript' } }] },
        });
        children.push({
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: result.data.transcript_text } }] },
        });
      }
    }

    // Create Notion page
    const page = await notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        Name: { title: [{ text: { content: topic } }] },
        Date: { date: { start: new Date().toISOString().split('T')[0] } },
      },
      children,
    });

    console.log('Created Notion page:', page.data?.id);

    return { success: true, pageId: page.data?.id };
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
