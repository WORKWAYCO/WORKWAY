# What Developers Can Do in WORKWAY Workflows

This document provides an honest accounting of what's possible when building WORKWAY workflows.

## The Truth About TypeScript in Workflows

WORKWAY workflows are **TypeScript-based**, but with important constraints. Inside the `execute()` function, you have significant flexibility—more than our SDK types suggest.

---

## What You CAN Do

### 1. Call `fetch()` Directly

You can make HTTP requests to any API without a pre-built integration:

```typescript
export default defineWorkflow({
  async execute({ config }) {
    // Direct fetch() works
    const response = await fetch('https://api.weather.com/forecast', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    });
    const weather = await response.json();

    // Use the data in your workflow
    return { temperature: weather.current.temp };
  }
});
```

**Evidence**: Production workflows like `meeting-intelligence-private` use direct `fetch()` calls (see lines 73, 447, 519).

### 2. Write Custom Helper Functions

You can define helper functions at module level and use them in your workflow:

```typescript
// Helper function - full TypeScript
async function analyzeContent(text: string, depth: 'shallow' | 'deep') {
  const chunks = text.split('\n\n');
  const processed = chunks.map(chunk => ({
    content: chunk,
    wordCount: chunk.split(' ').length,
    sentiment: detectSentiment(chunk)
  }));
  return processed;
}

function detectSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  // Your custom logic
  const positiveWords = ['good', 'great', 'excellent'];
  const hasPositive = positiveWords.some(w => text.toLowerCase().includes(w));
  return hasPositive ? 'positive' : 'neutral';
}

export default defineWorkflow({
  async execute({ trigger }) {
    // Use your custom helpers
    const analysis = await analyzeContent(trigger.data.content, 'deep');
    return { analysis };
  }
});
```

### 3. Use Workers AI

Access Cloudflare Workers AI for text generation, embeddings, and more:

```typescript
export default defineWorkflow({
  async execute({ integrations }) {
    const result = await integrations.ai.generateText({
      model: '@cf/meta/llama-3-8b-instruct',
      prompt: 'Summarize this meeting transcript...',
      max_tokens: 500
    });

    return { summary: result.text };
  }
});
```

### 4. Use Persistent Storage

Store and retrieve state across workflow executions:

```typescript
export default defineWorkflow({
  async execute({ context, trigger }) {
    // Get previous state
    const previousRuns = await context.storage.get('runHistory') || [];

    // Update state
    previousRuns.push({
      timestamp: new Date().toISOString(),
      triggerId: trigger.id
    });

    await context.storage.put('runHistory', previousRuns);

    return { totalRuns: previousRuns.length };
  }
});
```

### 5. Use Standard JavaScript APIs

All standard JavaScript/TypeScript APIs work:

```typescript
export default defineWorkflow({
  async execute({ trigger }) {
    // Array methods
    const sorted = trigger.data.items.sort((a, b) => a.score - b.score);

    // JSON parsing
    const parsed = JSON.parse(trigger.data.rawJson);

    // Date manipulation
    const now = new Date();
    const formatted = now.toISOString();

    // Regular expressions
    const emails = trigger.data.text.match(/[\w.-]+@[\w.-]+\.\w+/g);

    // Map, Set, etc.
    const uniqueItems = [...new Set(trigger.data.items)];

    return { sorted, parsed, formatted, emails, uniqueItems };
  }
});
```

### 6. Complex Control Flow

Write arbitrary business logic:

```typescript
export default defineWorkflow({
  async execute({ trigger, integrations }) {
    const { meetingType, attendees, transcript } = trigger.data;

    // Conditional logic
    if (meetingType === 'sales') {
      await integrations.hubspot.createDeal({
        name: `Meeting with ${attendees[0]}`,
        stage: 'qualification'
      });
    } else if (meetingType === 'support') {
      await integrations.linear.createIssue({
        title: `Support follow-up: ${attendees[0]}`,
        priority: 2
      });
    }

    // Loops
    for (const attendee of attendees) {
      await integrations.gmail.sendEmail({
        to: attendee.email,
        subject: 'Meeting follow-up',
        body: `Thanks for joining the ${meetingType} meeting.`
      });
    }

    // Error handling
    try {
      await integrations.slack.sendMessage({
        channel: '#meetings',
        text: `Meeting completed: ${attendees.length} attendees`
      });
    } catch (error) {
      console.log('Slack notification failed, continuing...');
    }

    return { processed: attendees.length };
  }
});
```

---

## What You CANNOT Do

### 1. Use Node.js Standard Library

The following will **not work**:

```typescript
// ❌ These will fail
import fs from 'fs';           // No filesystem
import path from 'path';       // No path module
import child_process from 'child_process';  // No subprocesses
import os from 'os';           // No OS module
import crypto from 'crypto';   // Use Web Crypto API instead
```

**Why**: Workflows run on Cloudflare Workers, which is a V8 isolate, not Node.js.

### 2. Use Most npm Packages

Many npm packages assume Node.js:

```typescript
// ❌ These will likely fail
import axios from 'axios';     // Use fetch() instead
import moment from 'moment';   // Use native Date or date-fns
import lodash from 'lodash';   // Use native methods or lodash-es
import express from 'express'; // Not applicable
```

**What works**: Packages that are "isomorphic" or specifically support Workers. Check [Cloudflare Workers compatibility](https://developers.cloudflare.com/workers/runtime-apis/).

### 3. Escape the defineWorkflow() Structure

You must use the workflow DSL:

```typescript
// ❌ This won't work - no direct exports
export async function myWorkflow() {
  // Not a valid workflow
}

// ✅ Must use defineWorkflow()
export default defineWorkflow({
  async execute() {
    // Your logic here
  }
});
```

### 4. Run Long-Running Processes

Workers have execution time limits:

```typescript
// ❌ Avoid
while (true) {
  await checkForUpdates();
  await sleep(60000); // Workers will timeout
}

// ✅ Use triggers instead
export default defineWorkflow({
  trigger: schedule({ cron: '* * * * *' }), // Every minute
  async execute() {
    await checkForUpdates();
  }
});
```

---

## Escape Hatches

### When Pre-built Integrations Don't Exist

Use direct `fetch()` for any API:

```typescript
export default defineWorkflow({
  customActions: {
    // Define reusable custom actions
    'weather.get': async ({ city }) => {
      const response = await fetch(`https://api.weather.com?city=${city}`);
      return response.json();
    },
    'custom-crm.createLead': async ({ name, email }) => {
      const response = await fetch('https://my-crm.com/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      return response.json();
    }
  },

  async execute({ actions }) {
    // Use your custom actions
    const weather = await actions.execute('weather.get', { city: 'NYC' });
    const lead = await actions.execute('custom-crm.createLead', {
      name: 'John Doe',
      email: 'john@example.com'
    });
  }
});
```

### When You Need External Processing

For heavy computation, call an external service:

```typescript
export default defineWorkflow({
  async execute({ trigger }) {
    // Offload heavy processing to your own API
    const result = await fetch('https://my-processing-service.com/analyze', {
      method: 'POST',
      body: JSON.stringify({ data: trigger.data.largeDataset })
    });

    return await result.json();
  }
});
```

---

## The Honest Summary

| Capability | Status | Notes |
|------------|--------|-------|
| `fetch()` | ✅ Works | Use for any HTTP API |
| Custom functions | ✅ Works | Define at module level |
| Workers AI | ✅ Works | Via `integrations.ai` |
| Storage | ✅ Works | Via `context.storage` |
| Standard JS | ✅ Works | Array, Date, JSON, etc. |
| Node.js stdlib | ❌ Blocked | Workers constraint |
| Most npm | ❌ Limited | Only Workers-compatible |
| Long processes | ❌ Limited | Use triggers instead |

---

## Further Reading

- [Workers Runtime Guide](./WORKERS_RUNTIME_GUIDE.md) - Detailed runtime constraints
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/) - Official documentation
- [Integration SDK](../packages/sdk/README.md) - Building integrations
