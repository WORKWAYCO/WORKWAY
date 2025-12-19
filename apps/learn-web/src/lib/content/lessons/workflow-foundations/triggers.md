# Triggers: When Workflows Run

A workflow without a trigger is just code. Triggers define when your workflow springs into action.

## Trigger Types

| Type | When It Fires |
|------|---------------|
| Webhook | External service sends HTTP request |
| Schedule | Scheduled time (daily, hourly, etc.) |
| Manual | User clicks "Run" or API call |
| Poll | Periodic API checks |

## Trigger Helpers

WORKWAY provides helper functions for creating triggers:

```typescript
import { defineWorkflow, webhook, schedule, manual, poll } from '@workwayco/sdk';
```

## Webhook Triggers

Most common. External services call your workflow:

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Zoom Meeting Ended',

  trigger: webhook({
    service: 'zoom',
    event: 'meeting.ended',
  }),

  async execute({ trigger }) {
    // trigger.data contains the webhook payload
    const meetingId = trigger.data.object.id;
    const topic = trigger.data.object.topic;
  },
});
```

### Webhook Payloads

Each provider sends different data:

**Zoom meeting.ended**:
```json
{
  "event": "meeting.ended",
  "payload": {
    "object": {
      "id": "123456789",
      "topic": "Weekly Standup",
      "duration": 45,
      "end_time": "2024-01-15T10:45:00Z"
    }
  }
}
```

**Stripe payment_intent.succeeded**:
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_123",
      "amount": 2000,
      "customer": "cus_456"
    }
  }
}
```

### Configuring Webhooks

WORKWAY generates unique webhook URLs:

```
https://hooks.workway.co/wf_abc123/zoom
```

Configure this URL in your service's webhook settings.

## Schedule Triggers

Run on a schedule using cron expressions:

```typescript
import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Daily Report',

  // Positional pattern
  trigger: schedule('0 9 * * *'),  // 9 AM daily

  async execute({ trigger }) {
    // trigger.timestamp contains when triggered
    const reportDate = new Date(trigger.timestamp);
  },
});

// With timezone
export default defineWorkflow({
  name: 'Daily Report',

  trigger: schedule({
    cron: '0 9 * * *',
    timezone: 'America/New_York',
  }),

  async execute({ trigger }) {
    // ...
  },
});
```

### Cron Syntax

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6)
│ │ │ │ │
* * * * *
```

**Common patterns**:

| Schedule | Cron Expression |
|----------|-----------------|
| Every hour | `0 * * * *` |
| Daily at 9 AM | `0 9 * * *` |
| Weekly Monday 8 AM | `0 8 * * 1` |
| First of month | `0 0 1 * *` |
| Every 15 minutes | `*/15 * * * *` |
| Weekdays at noon | `0 12 * * 1-5` |

### User-Configurable Schedules

Let users choose their schedule using template interpolation:

```typescript
inputs: {
  schedule: {
    type: 'select',
    label: 'Run Frequency',
    options: [
      { value: '0 9 * * *', label: 'Daily at 9 AM' },
      { value: '0 9 * * 1', label: 'Weekly on Mondays' },
      { value: '0 9 1 * *', label: 'Monthly on the 1st' },
    ],
    default: '0 9 * * *',
  },
},

// Dynamic cron with template interpolation
trigger: schedule({
  cron: '{{inputs.schedule}}',
  timezone: '{{inputs.timezone}}',
}),
```

## Manual Triggers

User-initiated runs via API or dashboard:

```typescript
import { defineWorkflow, manual } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Generate Report',

  trigger: manual({ description: 'Run monthly report generation' }),

  // Manual triggers can use input parameters
  inputs: {
    reportType: {
      type: 'select',
      label: 'Report Type',
      options: [
        { value: 'weekly', label: 'Weekly Summary' },
        { value: 'monthly', label: 'Monthly Summary' },
      ],
    },
  },

  async execute({ trigger, inputs }) {
    // inputs contains user's configuration
    const reportType = inputs.reportType;
  },
});
```

Manual triggers show a "Run" button in the dashboard.

## Poll Triggers

Periodically check an API for new data when webhooks aren't available:

```typescript
import { defineWorkflow, poll } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Check for New Emails',

  trigger: poll({
    service: 'gmail',
    endpoint: 'messages.list',
    interval: 300, // 5 minutes (minimum 60 seconds)
    filter: { q: 'is:unread' },
  }),

  async execute({ trigger }) {
    // Process new data
  },
});
```

## Multiple Triggers

A workflow can have a primary trigger and additional webhook triggers:

```typescript
import { defineWorkflow, schedule, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Meeting Intelligence',

  // Primary trigger
  trigger: schedule('0 18 * * *'),  // 6 PM daily

  // Additional webhook triggers
  webhooks: [
    webhook({ service: 'zoom', event: 'recording.completed' }),
  ],

  async execute({ trigger }) {
    // Check how it was triggered
    if (trigger.type === 'webhook') {
      // Process single meeting from webhook
    } else {
      // Batch process from schedule
    }
  },
});
```

## Trigger Data

Access trigger details in execute:

```typescript
async execute({ trigger }) {
  // Common properties
  trigger.type       // 'webhook' | 'schedule' | 'manual' | 'poll'
  trigger.timestamp  // When triggered

  // Webhook-specific
  if (trigger.type === 'webhook') {
    const data = trigger.data;     // Webhook payload
    const payload = trigger.payload; // Alias for data
  }

  // All triggers provide data context
  console.log('Triggered at:', trigger.timestamp);
}
```

## Webhook Security

WORKWAY validates webhook authenticity automatically for known providers (Stripe, Zoom, etc.).

For custom webhooks with a secret:

```typescript
trigger: webhook({
  path: '/custom-webhook',
  secret: 'your-webhook-secret',  // Used for signature verification
}),
```

## Best Practices

### 1. Idempotency

Triggers can fire multiple times. Handle duplicates:

```typescript
async execute({ trigger, context }) {
  const eventId = trigger.payload.id;

  // Check if already processed
  const processed = await context.storage.get(`processed:${eventId}`);
  if (processed) {
    return { success: true, skipped: true };
  }

  // Process...

  // Mark as processed
  await context.storage.put(`processed:${eventId}`, Date.now());
}
```

### 2. Graceful Degradation

Handle missing trigger data:

```typescript
async execute({ trigger }) {
  const meetingId = trigger.payload?.object?.id;

  if (!meetingId) {
    return { success: false, error: 'Missing meeting ID in webhook' };
  }
}
```

### 3. Trigger-Appropriate Logic

Different triggers might need different logic:

```typescript
async execute({ trigger, inputs, integrations, storage }) {
  if (trigger.type === 'schedule') {
    // Batch process: get all meetings since last run
    const lastRun = await storage.get('lastRun');
    const meetings = await integrations.zoom.getMeetings({ days: 1 });

    for (const meeting of meetings.data) {
      await processMeeting(meeting);
    }
  } else {
    // Real-time: process single meeting from webhook
    await processMeeting(trigger.data.object);
  }
}
```

## Common Pitfalls

### Missing Idempotency Check

Webhooks can fire multiple times for the same event:

```typescript
// Wrong - processes duplicate events
async execute({ trigger }) {
  const meetingId = trigger.data.object.id;
  await createNotionPage(meetingId);  // Creates duplicates
}

// Right - check if already processed
async execute({ trigger, storage }) {
  const eventId = trigger.data.object.id;
  const processedKey = `processed:${eventId}`;

  if (await storage.get(processedKey)) {
    return { success: true, skipped: true, reason: 'Already processed' };
  }

  await createNotionPage(eventId);
  await storage.put(processedKey, Date.now());

  return { success: true };
}
```

### Invalid Cron Expression

Cron syntax errors cause silent failures:

```typescript
// Wrong - invalid syntax
trigger: schedule('9 AM every day'),  // Not cron format

// Right - valid cron expression
trigger: schedule('0 9 * * *'),  // 9 AM daily

// Common patterns:
// Every hour:     '0 * * * *'
// Daily at 9 AM:  '0 9 * * *'
// Weekdays noon:  '0 12 * * 1-5'
// Every 15 min:   '*/15 * * * *'
```

### Not Handling Missing Webhook Data

Webhook payloads can be incomplete:

```typescript
// Wrong - assumes data exists
async execute({ trigger }) {
  const meetingId = trigger.data.object.id;  // Crashes if object undefined
  const topic = trigger.data.object.topic;
}

// Right - validate before use
async execute({ trigger }) {
  const meetingId = trigger.data?.object?.id;
  if (!meetingId) {
    return { success: false, error: 'Invalid webhook payload: missing meeting ID' };
  }
  const topic = trigger.data.object.topic || 'Untitled';
}
```

### Wrong Webhook Event Name

Event names must match the provider's format exactly:

```typescript
// Wrong - incorrect event name
trigger: webhook({
  service: 'zoom',
  event: 'meeting_ended',  // Underscore instead of dot
}),

// Right - exact event name from provider docs
trigger: webhook({
  service: 'zoom',
  event: 'meeting.ended',  // Correct format
}),
```

### Schedule Without Timezone

Cron runs in UTC by default, which surprises users:

```typescript
// Wrong - runs at 9 AM UTC, not user's timezone
trigger: schedule('0 9 * * *'),

// Right - specify timezone
trigger: schedule({
  cron: '0 9 * * *',
  timezone: 'America/New_York',  // Explicit timezone
}),
```

### Polling Too Frequently

Poll triggers have minimum intervals:

```typescript
// Wrong - too frequent, hits rate limits
trigger: poll({
  service: 'gmail',
  endpoint: 'messages.list',
  interval: 10,  // 10 seconds - too frequent
}),

// Right - respect minimum interval (60s)
trigger: poll({
  service: 'gmail',
  endpoint: 'messages.list',
  interval: 300,  // 5 minutes - reasonable
}),
```

### Not Differentiating Trigger Types

Multiple triggers need different handling:

```typescript
// Wrong - same logic for all triggers
async execute({ trigger }) {
  const meeting = trigger.data.object;  // Breaks on schedule trigger
}

// Right - handle each trigger type
async execute({ trigger, integrations, storage }) {
  if (trigger.type === 'webhook') {
    // Real-time: process single event
    await processMeeting(trigger.data.object);
  } else if (trigger.type === 'schedule') {
    // Batch: process since last run
    const lastRun = await storage.get('lastRun');
    const meetings = await integrations.zoom.getMeetings({ since: lastRun });
    for (const meeting of meetings.data) {
      await processMeeting(meeting);
    }
    await storage.put('lastRun', new Date().toISOString());
  }
}
```

## Praxis

Add triggers to your workflow and understand the different types:

> **Praxis**: Ask Claude Code: "Show me examples of webhook, schedule, and manual triggers in the WORKWAY codebase"

Create a workflow with multiple triggers:

```typescript
import { defineWorkflow, schedule, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Meeting Sync',

  // Primary trigger: daily schedule
  trigger: schedule('0 18 * * *'),  // 6 PM daily

  // Additional webhook trigger
  webhooks: [
    webhook({ service: 'zoom', event: 'recording.completed' }),
  ],

  async execute({ trigger }) {
    if (trigger.type === 'webhook') {
      // Process single meeting
    } else {
      // Batch process day's meetings
    }
  },
});
```

Practice writing cron expressions:
- Every hour: `0 * * * *`
- Weekdays at 9 AM: `0 9 * * 1-5`
- Every 15 minutes: `*/15 * * * *`

## Reflection

- What events in your daily work could trigger automations?
- How does real-time (webhook) differ from scheduled (cron) processing?
- Why is idempotency important for reliable workflows?
