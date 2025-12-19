# Working with Integrations

Master the integration patterns for Slack, Zoom, Stripe, and more. Each service has its own conventions.

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
