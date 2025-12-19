# Working with Integrations

Master the integration patterns for Slack, Zoom, Stripe, and more. Each service has its own conventions.

## Step-by-Step: Chain Multiple Integrations

### Step 1: Define Your Integration Flow

Plan the data flow between services:

```
Zoom (trigger) → AI (transform) → Notion (save) → Slack (notify)
```

### Step 2: Declare All Integrations

Add all required integrations to your workflow:

```typescript
integrations: [
  { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
  { service: 'notion', scopes: ['read_pages', 'write_pages'] },
  { service: 'slack', scopes: ['chat:write'], optional: true },
],
```

### Step 3: Get Source Data

Fetch data from the triggering service:

```typescript
async execute({ trigger, integrations }) {
  const { zoom } = integrations;

  const meetingId = trigger.data.object.id;
  const transcriptResult = await zoom.getTranscript({ meetingId });

  if (!transcriptResult.success) {
    console.warn('No transcript available');
    // Continue without transcript
  }

  const transcript = transcriptResult.data?.transcript_text || '';
}
```

### Step 4: Transform and Save

Process the data and save to your destination:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, notion } = integrations;

  // Get source data
  const transcriptResult = await zoom.getTranscript({
    meetingId: trigger.data.object.id,
  });

  // Create destination record
  const page = await notion.pages.create({
    parent: { database_id: inputs.notionDatabase },
    properties: {
      Name: { title: [{ text: { content: trigger.data.object.topic } }] },
      Date: { date: { start: new Date().toISOString().split('T')[0] } },
    },
    children: transcriptResult.success
      ? [{ type: 'paragraph', paragraph: { rich_text: [{ text: { content: transcriptResult.data.transcript_text } }] } }]
      : [],
  });

  return { success: true, pageId: page.data?.id };
}
```

### Step 5: Add Optional Notification

Notify users without failing the workflow:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, notion, slack } = integrations;

  // ... previous steps ...

  // Notify (optional - don't fail workflow if this fails)
  if (slack && inputs.slackChannel) {
    const notifyResult = await slack.chat.postMessage({
      channel: inputs.slackChannel,
      text: `Meeting notes ready: ${page.data?.url}`,
    });

    if (!notifyResult.success) {
      console.warn('Slack notification failed:', notifyResult.error);
    }
  }

  return { success: true, pageId: page.data?.id };
}
```

### Step 6: Test Each Integration Separately

Before combining:

```bash
# Test Zoom integration
workway dev
curl localhost:8787/test-zoom -d '{"meetingId": "123"}'

# Test Notion integration
curl localhost:8787/test-notion -d '{"title": "Test Page"}'

# Test full chain
curl localhost:8787/execute -d '{"object": {"id": "123", "topic": "Test"}}'
```

---

## Integration Basics

All integrations share common patterns:

```typescript
async execute({ integrations }) {
  const { slack, zoom, stripe, notion } = integrations;

  // Each is a pre-authenticated client
  // Token refresh, rate limiting handled automatically

  // All methods return ActionResult
  const result = await zoom.getMeetings({ days: 1 });
  if (result.success) {
    const meetings = result.data;
    // ...
  } else {
    console.error('Failed:', result.error);
  }
}
```

**Important:** Integration methods return `ActionResult` objects with `{ success, data, error }` pattern.

## Slack Integration

### Posting Messages

```typescript
// Simple message
await slack.chat.postMessage({
  channel: inputs.slackChannel,
  text: 'Meeting notes are ready!',
});

// Rich formatted message
await slack.chat.postMessage({
  channel: inputs.slackChannel,
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Meeting Summary' },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Topic:* Weekly Standup' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: '*Duration:* 45 min' },
        { type: 'mrkdwn', text: '*Attendees:* 5' },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Notes' },
          url: notionPageUrl,
        },
      ],
    },
  ],
});
```

### Channel Operations

```typescript
// Get all channels
const channels = await slack.getChannels();

// Get channel history
const messages = await slack.getChannelHistory(channelId, {
  limit: 100,
  oldest: timestamp,
});

// Update a message
await slack.updateMessage({
  channel: channelId,
  ts: messageTimestamp,
  text: 'Updated content',
});
```

### User Lookup

```typescript
// Get user by email
const user = await slack.getUserByEmail('user@example.com');

// Direct message a user
await slack.postMessage({
  channel: user.id,  // User ID as channel for DM
  text: 'Your report is ready',
});
```

## Zoom Integration

### Meeting Data

```typescript
// Get user's meetings
const meetings = await zoom.getMeetings();

// Get specific meeting
const meeting = await zoom.getMeeting(meetingId);
// Returns: { id, topic, start_time, duration, participants }

// Get meeting recordings
const recordings = await zoom.getMeetingRecordings(meetingId);
// Returns: { download_url, recording_type, file_size }
```

### Participant Information

```typescript
// Get meeting participants
const participants = await zoom.getMeetingParticipants(meetingId);

for (const participant of participants) {
  console.log(participant.name, participant.join_time, participant.duration);
}
```

### Meeting Transcripts

```typescript
// Get transcript (if available)
const transcript = await zoom.getMeetingTranscript(meetingId);
// Returns: { text, speaker_segments }

// Transcript segments have speaker attribution
for (const segment of transcript.speaker_segments) {
  console.log(`${segment.speaker}: ${segment.text}`);
}
```

### Webhook Events

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

// ...

trigger: webhook({
  service: 'zoom',
  event: 'recording.completed',
}),

async execute({ trigger }) {
  const meeting = trigger.data.object;
  // meeting.id, meeting.topic, meeting.duration
}
```

## Stripe Integration

### Customer Operations

```typescript
// Get customer
const customer = await stripe.getCustomer(customerId);

// Search customers
const customers = await stripe.searchCustomers({
  query: 'email:"user@example.com"',
});

// Create customer
const newCustomer = await stripe.createCustomer({
  email: 'new@example.com',
  name: 'New User',
  metadata: { source: 'workflow' },
});
```

### Payment Data

```typescript
// Get recent payments
const payments = await stripe.getPaymentIntents({
  limit: 10,
  created: { gte: startOfMonth },
});

// Get specific payment
const payment = await stripe.getPaymentIntent(paymentId);
// Returns: { id, amount, currency, status, customer }
```

### Subscription Management

```typescript
// Get subscription
const subscription = await stripe.getSubscription(subscriptionId);

// List customer subscriptions
const subscriptions = await stripe.getSubscriptions({
  customer: customerId,
  status: 'active',
});

// Cancel subscription
await stripe.cancelSubscription(subscriptionId);
```

### Webhook Events

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

// ...

trigger: webhook({
  service: 'stripe',
  event: 'payment_intent.succeeded',
}),

async execute({ trigger }) {
  const payment = trigger.data.data.object;
  const amount = payment.amount / 100;  // Convert cents to dollars
  const customer = payment.customer;
}
```

## Notion Integration

### Database Operations

```typescript
// Query database with filter
const result = await notion.databases.query({
  database_id: databaseId,
  filter: {
    property: 'Status',
    select: { equals: 'In Progress' },
  },
  sorts: [
    { property: 'Created', direction: 'descending' },
  ],
});

if (result.success) {
  const pages = result.data;
}

// Create database entry
await notion.pages.create({
  parent: { database_id: databaseId },
  properties: {
    Name: { title: [{ text: { content: 'New Item' } }] },
    Status: { select: { name: 'New' } },
    Priority: { number: 1 },
    Tags: { multi_select: [{ name: 'urgent' }] },
    DueDate: { date: { start: '2024-01-20' } },
  },
});
```

### Page Content

```typescript
// Create page with blocks
await notion.pages.create({
  parent: { database_id: databaseId },
  properties: { /* ... */ },
  children: [
    {
      type: 'heading_1',
      heading_1: { rich_text: [{ text: { content: 'Overview' } }] },
    },
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [{ text: { content: 'Details here...' } }]
      },
    },
    {
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ text: { content: 'First point' } }],
      },
    },
    {
      type: 'code',
      code: {
        rich_text: [{ text: { content: 'const x = 1;' } }],
        language: 'typescript',
      },
    },
  ],
});

// Append blocks to existing page
await notion.blocks.children.append({
  block_id: pageId,
  children: [
    {
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: 'Added content' } }] },
    },
  ],
});
```

### Update Existing Pages

```typescript
// Update page properties
await notion.pages.update({
  page_id: pageId,
  properties: {
    Status: { select: { name: 'Complete' } },
  },
});

// Archive page
await notion.pages.update({
  page_id: pageId,
  archived: true,
});
```

## Gmail Integration

### Reading Email

```typescript
// Search emails
const emails = await gmail.getMessages({
  query: 'from:important@client.com is:unread',
  maxResults: 10,
});

// Get full message
const message = await gmail.getMessage(messageId);
// Returns: { id, subject, from, to, date, body, attachments }
```

### Sending Email

```typescript
// Simple email
await gmail.sendEmail({
  to: 'recipient@example.com',
  subject: 'Meeting Follow-up',
  body: 'Thanks for meeting today...',
});

// HTML email
await gmail.sendEmail({
  to: 'recipient@example.com',
  subject: 'Your Report',
  html: '<h1>Report</h1><p>Details...</p>',
});

// With CC and attachments
await gmail.sendEmail({
  to: 'recipient@example.com',
  cc: ['manager@example.com'],
  subject: 'Report Attached',
  body: 'Please find attached...',
  attachments: [
    { filename: 'report.pdf', content: pdfBuffer },
  ],
});
```

### Label Management

```typescript
// Add label
await gmail.addLabel(messageId, labelId);

// Remove label
await gmail.removeLabel(messageId, labelId);

// Mark as read
await gmail.markAsRead(messageId);
```

## Integration Patterns

### Chaining Services

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, notion, slack } = integrations;

  // 1. Get meeting from Zoom
  const meetingId = trigger.data.object.id;
  const transcriptResult = await zoom.getTranscript({ meetingId });

  // 2. Save to Notion
  const page = await notion.pages.create({
    parent: { database_id: inputs.notionDatabase },
    properties: {
      Name: { title: [{ text: { content: trigger.data.object.topic } }] },
    },
    children: transcriptResult.success
      ? formatTranscript(transcriptResult.data.transcript_text)
      : [],
  });

  // 3. Notify via Slack
  await slack.chat.postMessage({
    channel: inputs.slackChannel,
    text: `Meeting notes ready: ${page.data?.url}`,
  });

  return { success: true, pageId: page.data?.id };
}
```

### Conditional Integration Use

```typescript
async execute({ inputs, integrations }) {
  const { notion, slack } = integrations;

  // Always save to Notion
  const page = await notion.pages.create(/* ... */);

  // Optionally notify Slack
  if (inputs.enableSlackNotification && inputs.slackChannel) {
    await slack.chat.postMessage({
      channel: inputs.slackChannel,
      text: `New entry: ${page.data?.url}`,
    });
  }

  return { success: true };
}
```

### Error Recovery

```typescript
async execute({ integrations }) {
  const { notion, slack } = integrations;

  const page = await notion.pages.create(/* ... */);

  // Slack failure shouldn't fail the whole workflow
  const slackResult = await slack.chat.postMessage(/* ... */);
  if (!slackResult.success) {
    console.warn('Slack notification failed:', slackResult.error);
  }

  return { success: true, pageId: page.data?.id };
}
```

## Common Pitfalls

### Not Checking ActionResult Success

All integration methods return `ActionResult` - ignoring it causes crashes:

```typescript
// Wrong - assumes success
async execute({ integrations }) {
  const result = await integrations.zoom.getMeetings();
  const meetings = result.data;  // undefined if failed
  console.log(`Found ${meetings.length} meetings`);  // Crashes
}

// Right - check before accessing data
async execute({ integrations }) {
  const result = await integrations.zoom.getMeetings();
  if (!result.success) {
    return { success: false, error: result.error };
  }
  const meetings = result.data || [];
  console.log(`Found ${meetings.length} meetings`);
}
```

### Wrong Property Names for Notion

Notion's API has specific property formats:

```typescript
// Wrong - incorrect property structure
await notion.pages.create({
  properties: {
    Name: 'Meeting Notes',  // Wrong: needs title array
    Date: '2024-01-15',     // Wrong: needs date object
  },
});

// Right - correct Notion property format
await notion.pages.create({
  properties: {
    Name: { title: [{ text: { content: 'Meeting Notes' } }] },
    Date: { date: { start: '2024-01-15' } },
  },
});
```

### Slack Block Builder Mistakes

Slack blocks have strict structure requirements:

```typescript
// Wrong - missing required fields
await slack.chat.postMessage({
  channel: channelId,
  blocks: [
    {
      type: 'section',
      text: 'Hello world',  // Wrong: needs mrkdwn/plain_text object
    },
  ],
});

// Right - complete block structure
await slack.chat.postMessage({
  channel: channelId,
  blocks: [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: 'Hello world' },
    },
  ],
  text: 'Hello world',  // Fallback for notifications
});
```

### Stripe Amount in Wrong Units

Stripe uses cents, not dollars:

```typescript
// Wrong - $10 becomes $1000
const payment = await stripe.createPaymentIntent({
  amount: 10,  // This is 10 cents, not $10
});

// Right - convert to cents
const payment = await stripe.createPaymentIntent({
  amount: 10 * 100,  // $10.00 = 1000 cents
});
```

### Gmail Query Syntax Errors

Gmail search uses specific operators:

```typescript
// Wrong - natural language query
await gmail.getMessages({ query: 'emails from john last week' });

// Right - Gmail search operators
await gmail.getMessages({
  query: 'from:john@example.com after:2024/01/08 is:unread',
});
```

### Chaining Without Error Isolation

One failure shouldn't break everything:

```typescript
// Wrong - entire chain fails if Slack fails
async execute({ integrations }) {
  const meeting = await integrations.zoom.getMeeting(id);
  const page = await integrations.notion.pages.create(data);
  await integrations.slack.postMessage(notification);  // If this fails, no return
  return { success: true, pageId: page.data.id };
}

// Right - isolate optional steps
async execute({ integrations }) {
  const meeting = await integrations.zoom.getMeeting(id);
  if (!meeting.success) return { success: false, error: meeting.error };

  const page = await integrations.notion.pages.create(data);
  if (!page.success) return { success: false, error: page.error };

  // Slack is optional - don't fail workflow if it fails
  const slackResult = await integrations.slack.postMessage(notification);
  if (!slackResult.success) {
    console.warn('Slack notification failed:', slackResult.error);
  }

  return { success: true, pageId: page.data.id };
}
```

### Zoom Transcript Timing

Transcripts aren't immediately available after meetings:

```typescript
// Wrong - expects transcript right after meeting ends
trigger: webhook({ service: 'zoom', event: 'meeting.ended' }),
async execute({ trigger, integrations }) {
  const transcript = await integrations.zoom.getTranscript(meetingId);
  // Often fails: transcript not yet processed
}

// Right - wait for recording.completed event
trigger: webhook({ service: 'zoom', event: 'recording.completed' }),
async execute({ trigger, integrations }) {
  const transcript = await integrations.zoom.getTranscript(meetingId);
  // Transcript available after recording processed
}
```

## Praxis

Build a workflow that chains multiple integrations:

> **Praxis**: Ask Claude Code: "Help me create a workflow that chains Zoom → Notion → Slack when a meeting ends"

Implement the chaining pattern:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, notion, slack } = integrations;

  // 1. Get data from source
  const meetingId = trigger.data.object.id;
  const transcriptResult = await zoom.getTranscript({ meetingId });

  // 2. Transform and save
  const page = await notion.pages.create({
    parent: { database_id: inputs.notionDatabase },
    properties: {
      Name: { title: [{ text: { content: trigger.data.object.topic } }] },
    },
  });

  // 3. Notify (with error isolation)
  const slackResult = await slack.chat.postMessage({
    channel: inputs.slackChannel,
    text: `Meeting notes ready: ${page.data?.url}`,
  });

  if (!slackResult.success) {
    console.warn('Notification failed:', slackResult.error);
  }

  return { success: true };
}
```

Test each integration call individually before chaining them together.

## Reflection

- Which integration patterns will you use most?
- How does service chaining create compound outcomes?
- What error scenarios should your workflows handle gracefully?
