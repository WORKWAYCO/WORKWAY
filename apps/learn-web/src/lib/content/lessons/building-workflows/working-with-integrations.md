# Chain integrations

Connect Zoom → Notion → Slack in a single workflow.

## What you'll do

- Chain multiple integrations: Zoom, Notion, Slack
- Send Slack messages with threading
- Access Zoom meetings, recordings, and transcripts
- Create Notion pages with templates
- Handle Stripe cents, Gmail query syntax
- Isolate errors for optional steps

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
  const page = await notion.createPage({
    parentDatabaseId: inputs.notionDatabase,
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
    const notifyResult = await slack.sendMessage({
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

### ActionResult Pattern

All integration methods return `ActionResult` objects:

| Property  | Type                  | Description                     |
| --------- | --------------------- | ------------------------------- |
| `success` | `boolean`             | Whether the call succeeded      |
| `data`    | `T \| undefined`      | The response data if successful |
| `error`   | `string \| undefined` | Error message if failed         |

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

The Slack integration (`packages/integrations/src/slack/`) provides methods for messaging, channels, and user lookup.

### Posting Messages

```typescript
// Simple message
const result = await slack.sendMessage({
  channel: inputs.slackChannel,
  text: "Meeting notes are ready!",
});

if (result.success) {
  console.log("Sent message:", result.data.ts);
}

// With threading support
await slack.sendMessage({
  channel: inputs.slackChannel,
  text: "Follow-up comment",
  thread_ts: parentMessageTs, // Reply in thread
  reply_broadcast: true, // Also post to channel
});
```

### Channel Operations

```typescript
// List channels the bot has access to
const channelsResult = await slack.listChannels({
  limit: 100,
  excludeArchived: true,
  types: "public_channel,private_channel",
});

if (channelsResult.success) {
  for (const channel of channelsResult.data) {
    console.log(channel.name, channel.id);
  }
}

// Get messages from a channel with human-friendly since
const messagesResult = await slack.getMessages({
  channel: channelId,
  since: "24h", // Last 24 hours
  humanOnly: true, // Filter out bots and system messages
});

// Get messages since a specific date
const weekMessages = await slack.getMessages({
  channel: channelId,
  since: "7d", // Last 7 days
});

// Search messages across channels
const searchResult = await slack.searchMessages("project update", {
  count: 20,
  sort: "timestamp",
});
```

### User Lookup

```typescript
// Get user by ID
const userResult = await slack.getUser({ user: userId });

if (userResult.success) {
  console.log(userResult.data.real_name);
  console.log(userResult.data.profile?.email);
}

// Direct message a user (use user ID as channel)
await slack.sendMessage({
  channel: userResult.data.id,
  text: "Your report is ready",
});
```

## Zoom Integration

The Zoom integration (`packages/integrations/src/zoom/`) provides methods for meetings, recordings, clips, and transcripts.

### Meeting Data

```typescript
// Get user's recent meetings (last N days)
const meetingsResult = await zoom.getMeetings({ days: 7 });

if (meetingsResult.success) {
  for (const meeting of meetingsResult.data) {
    console.log(meeting.topic, meeting.start_time);
  }
}

// Get specific meeting
const meetingResult = await zoom.getMeeting({ meetingId: "123456789" });
// Returns: { id, topic, start_time, duration, host_id, join_url }

// Get meeting recordings
const recordingsResult = await zoom.getRecordings({ meetingId: "123456789" });
if (recordingsResult.success && recordingsResult.data) {
  const recording = recordingsResult.data;
  console.log("Share URL:", recording.share_url);
  for (const file of recording.recording_files) {
    console.log(file.file_type, file.download_url);
  }
}
```

### Meeting Transcripts

```typescript
// Get transcript (OAuth API - may lack speaker names)
const transcriptResult = await zoom.getTranscript({ meetingId: "123456789" });

if (transcriptResult.success && transcriptResult.data) {
  const transcript = transcriptResult.data;
  console.log("Source:", transcript.source); // 'oauth_api' or 'browser_scraper'
  console.log("Has speakers:", transcript.has_speaker_attribution);
  console.log("Text:", transcript.transcript_text);

  if (transcript.speakers) {
    console.log("Speakers:", transcript.speakers.join(", "));
  }
}

// Get transcript with browser fallback for speaker attribution
const transcriptWithSpeakers = await zoom.getTranscript({
  meetingId: "123456789",
  fallbackToBrowser: true,
  shareUrl: recording.share_url, // Required for browser fallback
});
```

### Zoom Clips

```typescript
// Get user's clips
const clipsResult = await zoom.getClips({ days: 30 });

if (clipsResult.success) {
  for (const clip of clipsResult.data) {
    console.log(clip.title, clip.duration, clip.share_url);
  }
}

// Get clip transcript (requires browser scraper)
const clipTranscript = await zoom.getClipTranscript({
  shareUrl: clip.share_url,
});
```

### Compound Method: Meetings with Transcripts

```typescript
// Get meetings and their transcripts in one call
const result = await zoom.getMeetingsWithTranscripts({
  days: 1,
  fallbackToBrowser: false,
});

if (result.success) {
  for (const { meeting, transcript } of result.data) {
    console.log("Meeting:", meeting.topic);
    if (transcript) {
      console.log("Transcript length:", transcript.transcript_text.length);
    }
  }
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

The Stripe integration (`packages/integrations/src/stripe/`) provides methods for payments, customers, and subscriptions. **Important:** Stripe uses cents, not dollars.

### Customer Operations

```typescript
// Get customer by ID
const customerResult = await stripe.getCustomer("cus_xxx");

if (customerResult.success) {
  console.log(customerResult.data.email, customerResult.data.name);
}

// List customers (with optional filters)
const customersResult = await stripe.listCustomers({
  limit: 10,
  email: "user@example.com",
});

// Create customer
const newCustomerResult = await stripe.createCustomer({
  email: "new@example.com",
  name: "New User",
  description: "Created via workflow",
  metadata: { source: "workway" },
});
```

### Payment Intents

```typescript
// Create a payment intent ($20.00 = 2000 cents)
const paymentResult = await stripe.createPaymentIntent({
  amount: 2000, // Always in cents!
  currency: "usd",
  customer: "cus_xxx",
  description: "Order #123",
  metadata: { order_id: "123" },
  automatic_payment_methods: { enabled: true },
});

if (paymentResult.success) {
  console.log("Payment ID:", paymentResult.data.id);
  console.log("Status:", paymentResult.data.status);
  console.log("Client Secret:", paymentResult.data.client_secret);
}

// Get specific payment
const payment = await stripe.getPaymentIntent("pi_xxx");

// List payment intents
const paymentsResult = await stripe.listPaymentIntents({
  limit: 10,
  customer: "cus_xxx",
});
```

### Subscription Management

```typescript
// Create subscription
const subResult = await stripe.createSubscription({
  customer: "cus_xxx",
  priceId: "price_xxx",
  quantity: 1,
  trial_period_days: 14,
  metadata: { plan: "pro" },
});

// Get subscription
const subscription = await stripe.getSubscription("sub_xxx");
if (subscription.success) {
  console.log("Status:", subscription.data.status);
  console.log("Current period end:", subscription.data.current_period_end);
}

// List subscriptions by customer
const subsResult = await stripe.listSubscriptions({
  customer: "cus_xxx",
  status: "active",
});

// Cancel subscription (at period end or immediately)
await stripe.cancelSubscription("sub_xxx", { cancel_at_period_end: true });
```

### Charges (Legacy)

```typescript
// List charges
const chargesResult = await stripe.listCharges({
  limit: 10,
  customer: "cus_xxx",
});

// Get specific charge
const charge = await stripe.getCharge("ch_xxx");
```

### Webhook Verification

```typescript
// Parse and verify webhook signature
const eventResult = await stripe.parseWebhookEvent(
  rawBody, // Raw request body string
  signatureHeader, // Stripe-Signature header
  webhookSecret, // Your endpoint secret
);

if (eventResult.success) {
  const event = eventResult.data;
  console.log("Event type:", event.type); // e.g., 'payment_intent.succeeded'
  console.log("Event data:", event.data.object);
}
```

### Webhook Events in Workflows

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

// ...

trigger: webhook({
  service: 'stripe',
  event: 'payment_intent.succeeded',
}),

async execute({ trigger }) {
  const payment = trigger.data.data.object;
  const amountDollars = payment.amount / 100;  // Convert cents to dollars!
  const customerId = payment.customer;

  console.log(`Payment of $${amountDollars} received from ${customerId}`);
}
```

## Notion Integration

The Notion integration (`packages/integrations/src/notion/`) provides methods for pages, databases, and content blocks.

### Database Operations

```typescript
// Query database with filter
const result = await notion.queryDatabase({
  databaseId: databaseId,
  filter: {
    property: "Status",
    status: { equals: "In Progress" },
  },
  sorts: [{ property: "Created", direction: "descending" }],
});

if (result.success) {
  for (const page of result.data) {
    console.log(page.id, page.properties);
  }
}

// Get database schema
const dbResult = await notion.getDatabase(databaseId);
if (dbResult.success) {
  console.log("Properties:", Object.keys(dbResult.data.properties));
}

// Search across pages and databases
const searchResult = await notion.search({
  query: "Project",
  filter: { property: "object", value: "page" },
});
```

### Creating Pages

```typescript
// Create page in database
const pageResult = await notion.createPage({
  parentDatabaseId: databaseId,
  properties: {
    Name: { title: [{ text: { content: "New Item" } }] },
    Status: { status: { name: "New" } },
    Priority: { number: 1 },
    Tags: { multi_select: [{ name: "urgent" }] },
    DueDate: { date: { start: "2024-01-20" } },
  },
});

if (pageResult.success) {
  console.log("Created page:", pageResult.data.url);
}

// Create page with content blocks
await notion.createPage({
  parentDatabaseId: databaseId,
  properties: {
    Name: { title: [{ text: { content: "Meeting Notes" } }] },
  },
  children: [
    {
      type: "heading_1",
      heading_1: { rich_text: [{ text: { content: "Overview" } }] },
    },
    {
      type: "paragraph",
      paragraph: { rich_text: [{ text: { content: "Details here..." } }] },
    },
    {
      type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ text: { content: "First point" } }] },
    },
    {
      type: "code",
      code: {
        rich_text: [{ text: { content: "const x = 1;" } }],
        language: "typescript",
      },
    },
  ],
});
```

### Document Templates (Zuhandenheit)

```typescript
// Create structured documents from templates
// Developer thinks "create meeting notes" not "construct 100 block objects"
const docResult = await notion.createDocument({
  database: databaseId,
  template: "meeting", // 'summary', 'report', 'notes', 'article', 'meeting', 'feedback'
  data: {
    title: "Weekly Standup - 2024-01-15",
    summary: "Team discussed Q1 priorities and blockers.",
    date: "2024-01-15",
    mood: "positive",
    sections: {
      decisions: ["Approved new feature spec", "Delayed launch by 1 week"],
      actionItems: ["Review PR #123", "Schedule design review"],
      keyTopics: ["Performance improvements", "User feedback"],
    },
    content: fullTranscriptText, // Optional: raw content in toggle
  },
});
```

### Update Existing Pages

```typescript
// Update page properties
const updateResult = await notion.updatePage({
  pageId: pageId,
  properties: {
    Status: { status: { name: "Complete" } },
  },
});

// Archive page
await notion.updatePage({
  pageId: pageId,
  archived: true,
});

// Get page content blocks
const blocksResult = await notion.getBlockChildren({ blockId: pageId });
if (blocksResult.success) {
  for (const block of blocksResult.data) {
    console.log(block.type);
  }
}
```

## Gmail Integration

### Reading Email

```typescript
// Search emails
const emails = await gmail.getMessages({
  query: "from:important@client.com is:unread",
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
  to: "recipient@example.com",
  subject: "Meeting Follow-up",
  body: "Thanks for meeting today...",
});

// HTML email
await gmail.sendEmail({
  to: "recipient@example.com",
  subject: "Your Report",
  html: "<h1>Report</h1><p>Details...</p>",
});

// With CC and attachments
await gmail.sendEmail({
  to: "recipient@example.com",
  cc: ["manager@example.com"],
  subject: "Report Attached",
  body: "Please find attached...",
  attachments: [{ filename: "report.pdf", content: pdfBuffer }],
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

  // 1. Get meeting data from Zoom
  const meetingId = trigger.data.object.id;
  const transcriptResult = await zoom.getTranscript({ meetingId });

  // 2. Save to Notion using document template
  const page = await notion.createDocument({
    database: inputs.notionDatabase,
    template: 'meeting',
    data: {
      title: trigger.data.object.topic,
      summary: transcriptResult.success ? 'Meeting transcript captured' : 'No transcript',
      date: new Date().toISOString().split('T')[0],
      sections: transcriptResult.success && transcriptResult.data.speakers
        ? { speakers: transcriptResult.data.speakers }
        : {},
      content: transcriptResult.data?.transcript_text,
    },
  });

  // 3. Notify via Slack
  await slack.sendMessage({
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
  const page = await notion.createPage({
    parentDatabaseId: inputs.notionDatabase,
    properties: {
      Name: { title: [{ text: { content: 'New Entry' } }] },
    },
  });

  // Optionally notify Slack
  if (inputs.enableSlackNotification && inputs.slackChannel) {
    await slack.sendMessage({
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

  const page = await notion.createPage({
    parentDatabaseId: inputs.notionDatabase,
    properties: {
      Name: { title: [{ text: { content: 'Entry' } }] },
    },
  });

  // Slack failure shouldn't fail the whole workflow
  const slackResult = await slack.sendMessage({
    channel: inputs.slackChannel,
    text: `Page created: ${page.data?.url}`,
  });

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
    Name: "Meeting Notes", // Wrong: needs title array
    Date: "2024-01-15", // Wrong: needs date object
  },
});

// Right - correct Notion property format
await notion.pages.create({
  properties: {
    Name: { title: [{ text: { content: "Meeting Notes" } }] },
    Date: { date: { start: "2024-01-15" } },
  },
});
```

### Slack Message Options

Always provide fallback text for notifications:

```typescript
// sendMessage requires channel and text
const result = await slack.sendMessage({
  channel: channelId,
  text: "Hello world",
});

// With threading
await slack.sendMessage({
  channel: channelId,
  text: "Reply to thread",
  thread_ts: originalMessageTs, // Thread parent timestamp
});

// Common mistake: forgetting to check success
if (!result.success) {
  console.error("Slack send failed:", result.error);
}
```

### Stripe Amount in Wrong Units

Stripe uses cents, not dollars:

```typescript
// Wrong - $10 becomes $1000
const payment = await stripe.createPaymentIntent({
  amount: 10, // This is 10 cents, not $10
});

// Right - convert to cents
const payment = await stripe.createPaymentIntent({
  amount: 10 * 100, // $10.00 = 1000 cents
});
```

### Gmail Query Syntax Errors

Gmail search uses specific operators:

```typescript
// Wrong - natural language query
await gmail.getMessages({ query: "emails from john last week" });

// Right - Gmail search operators
await gmail.getMessages({
  query: "from:john@example.com after:2024/01/08 is:unread",
});
```

### Chaining Without Error Isolation

One failure shouldn't break everything:

```typescript
// Wrong - entire chain fails if Slack fails
async execute({ integrations }) {
  const meeting = await integrations.zoom.getMeeting({ meetingId: id });
  const page = await integrations.notion.createPage({
    parentDatabaseId: dbId,
    properties: { /* ... */ },
  });
  await integrations.slack.sendMessage({ channel, text });  // If this fails, no return
  return { success: true, pageId: page.data.id };
}

// Right - isolate optional steps
async execute({ integrations }) {
  const meeting = await integrations.zoom.getMeeting({ meetingId: id });
  if (!meeting.success) return { success: false, error: meeting.error };

  const page = await integrations.notion.createPage({
    parentDatabaseId: dbId,
    properties: { /* ... */ },
  });
  if (!page.success) return { success: false, error: page.error };

  // Slack is optional - don't fail workflow if it fails
  const slackResult = await integrations.slack.sendMessage({ channel, text });
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
  const transcript = await integrations.zoom.getTranscript({ meetingId });
  // Often fails: transcript not yet processed
}

// Right - wait for recording.completed event
trigger: webhook({ service: 'zoom', event: 'recording.completed' }),
async execute({ trigger, integrations }) {
  const meetingId = trigger.data.object.id;
  const transcript = await integrations.zoom.getTranscript({ meetingId });
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

  // 2. Transform and save using document template
  const page = await notion.createDocument({
    database: inputs.notionDatabase,
    template: 'meeting',
    data: {
      title: trigger.data.object.topic,
      summary: transcriptResult.success ? 'Transcript captured' : 'No transcript available',
      date: new Date().toISOString().split('T')[0],
      content: transcriptResult.data?.transcript_text,
    },
  });

  // 3. Notify (with error isolation)
  const slackResult = await slack.sendMessage({
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
