# Compound Workflows

## Learning Objectives

By the end of this lesson, you will be able to:

- Design compound workflows that orchestrate 4+ services in a single execution
- Map dependencies between workflow steps (sequential vs parallel)
- Use `Promise.allSettled()` for parallel execution with independent error handling
- Implement partial success patterns where optional steps can fail gracefully
- Calculate the multiplicative value of compound workflows vs simple integrations

---

Single automations move data A → B. Compound workflows orchestrate complete outcomes across multiple services, creating results greater than the sum of their parts.

## Step-by-Step: Design a Compound Workflow

### Step 1: Map the Complete Outcome

Write down everything that should happen when your trigger fires:

```
Trigger: Zoom meeting ends

Outcomes needed:
1. Meeting notes saved to Notion
2. AI summary generated
3. Team notified in Slack
4. Follow-up email drafted
5. CRM record updated
```

### Step 2: Identify Dependencies

Determine which steps depend on others:

```
                    Meeting Data
                         │
                    ┌────┴────┐
                    │         │
               Transcript  Metadata
                    │         │
                    ▼         │
               AI Summary     │
                    │         │
                    ├─────────┤
                    │         │
              ┌─────┼─────┐   │
              ▼     ▼     ▼   ▼
           Notion Slack  Email CRM
           (sequential)  (parallel)
```

### Step 3: Implement Sequential Steps

Add dependent steps that must run in order:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, ai, notion } = integrations;

  // Sequential: Each step needs the previous result
  const meetingResult = await zoom.getMeeting(trigger.data.object.id);

  const transcriptResult = await zoom.getTranscript({
    meetingId: meetingResult.data?.id,
  });

  const summaryResult = await ai.generateText({
    system: 'Summarize meeting highlights in 3-5 bullets.',
    prompt: transcriptResult.data?.transcript_text || '',
  });

  const page = await notion.pages.create({
    parent: { database_id: inputs.notionDatabase },
    properties: {
      Name: { title: [{ text: { content: meetingResult.data?.topic || 'Meeting' } }] },
    },
    children: [{
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: summaryResult.data?.response || '' } }] },
    }],
  });

  return { success: true, pageId: page.data?.id };
}
```

### Step 4: Add Parallel Steps

Use `Promise.all()` for independent operations:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, ai, notion, slack, gmail } = integrations;

  // Get data (sequential)
  const meeting = await zoom.getMeeting(trigger.data.object.id);
  const summary = await ai.generateText({ /* ... */ });

  // Dispatch to multiple services (parallel)
  const [notionResult, slackResult, emailResult] = await Promise.all([
    notion.pages.create({ /* ... */ }),
    slack.chat.postMessage({
      channel: inputs.slackChannel,
      text: `Meeting "${meeting.data?.topic}" complete`,
    }),
    gmail.sendEmail({
      to: meeting.data?.host_email,
      subject: `Follow-up: ${meeting.data?.topic}`,
      body: `Draft follow-up for your meeting...\n\n${summary.data?.response}`,
    }),
  ]);

  return {
    success: true,
    pageId: notionResult.data?.id,
    slackSent: slackResult.success,
    emailDrafted: emailResult.success,
  };
}
```

### Step 5: Isolate Failures

Prevent one failure from breaking everything:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { notion, slack, gmail } = integrations;
  const results = { notion: null, slack: null, email: null, errors: [] };

  // Required step
  const notionResult = await notion.pages.create({ /* ... */ });
  if (!notionResult.success) {
    return { success: false, error: 'Failed to save meeting notes' };
  }
  results.notion = notionResult.data?.id;

  // Optional steps - don't fail workflow
  try {
    const slackResult = await slack.chat.postMessage({ /* ... */ });
    results.slack = slackResult.success ? 'sent' : 'failed';
  } catch (e) {
    results.errors.push('Slack notification failed');
  }

  try {
    const emailResult = await gmail.sendEmail({ /* ... */ });
    results.email = emailResult.success ? 'sent' : 'failed';
  } catch (e) {
    results.errors.push('Email draft failed');
  }

  return { success: true, ...results };
}
```

### Step 6: Test the Complete Flow

```bash
workway dev

# Test with all steps
curl localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"object": {"id": "123", "topic": "Sprint Planning", "host_email": "host@example.com"}}'

# Check logs for all service calls
workway logs --tail
```

---

## The Compound Advantage

Simple workflow:
```
Meeting ends → Create Notion page
```

Compound workflow:
```
Meeting ends →
  ├── Notion page with AI summary
  ├── Slack notification with highlights
  ├── Email draft for follow-up
  ├── CRM updated with meeting notes
  └── Calendar event for next meeting
```

Five services. One trigger. Complete outcome.

## Orchestration Patterns

### Sequential Steps

Each step depends on the previous:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, ai, notion, slack } = integrations;

  // Step 1: Get meeting data
  const meetingResult = await zoom.getMeeting(trigger.data.object.id);
  const transcriptResult = await zoom.getTranscript({ meetingId: meetingResult.data.id });

  // Step 2: AI processing (needs transcript)
  const summaryResult = await ai.generateText({
    prompt: `Summarize: ${transcriptResult.data.transcript_text}`,
  });
  const actionItems = await extractActionItems(transcriptResult.data.transcript_text, ai);

  // Step 3: Save to Notion (needs summary + actions)
  const page = await notion.pages.create({
    parent: { database_id: inputs.notionDatabase },
    properties: { Name: { title: [{ text: { content: meetingResult.data.topic } }] } },
    children: formatContent(summaryResult.data?.response, actionItems),
  });

  // Step 4: Notify (needs page URL)
  await slack.chat.postMessage({
    channel: inputs.slackChannel,
    text: `Meeting notes ready: ${page.data?.url}`,
  });

  return { success: true, pageId: page.data?.id };
}
```

### Parallel Steps

Independent operations run concurrently:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, notion, slack, gmail } = integrations;

  const meetingResult = await zoom.getMeeting(trigger.data.object.id);
  const meeting = meetingResult.data;

  // Run independent steps in parallel
  const [notionResult, slackResult, emailResult] = await Promise.all([
    // Save to Notion
    notion.pages.create({
      parent: { database_id: inputs.notionDatabase },
      properties: { Name: { title: [{ text: { content: meeting.topic } }] } },
    }),

    // Post to Slack
    slack.chat.postMessage({
      channel: inputs.slackChannel,
      text: `Meeting "${meeting.topic}" ended`,
    }),

    // Draft email
    gmail.createDraft({
      to: meeting.host_email,
      subject: `Follow-up: ${meeting.topic}`,
      body: `Thanks for meeting today...`,
    }),
  ]);

  return {
    success: true,
    pageId: notionResult.data?.id,
    messageTs: slackResult.data?.ts,
    draftId: emailResult.data?.id,
  };
}
```

### Mixed Pattern

Combine sequential and parallel:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { zoom, ai, notion, slack, gmail, crm } = integrations;

  // Sequential: must happen in order
  const meetingResult = await zoom.getMeeting(trigger.data.object.id);
  const transcriptResult = await zoom.getTranscript({ meetingId: meetingResult.data.id });
  const summary = await summarize(transcriptResult.data.transcript_text, ai);

  // Parallel: independent outputs
  const [page, message, draft] = await Promise.all([
    notion.pages.create({ /* uses summary */ }),
    slack.chat.postMessage({ /* uses summary */ }),
    gmail.createDraft({ /* uses summary */ }),
  ]);

  // Sequential: depends on parallel results
  await updateCRM(meetingResult.data, page.data?.url, crm);

  return { success: true };
}
```

## Fan-Out Pattern

One trigger produces multiple outputs:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { notion, slack } = integrations;

  const data = trigger.data;

  // Fan out to multiple Notion databases
  const pagePromises = inputs.databases.map(dbId =>
    notion.pages.create({
      parent: { database_id: dbId },
      properties: formatForDatabase(data, dbId),
    })
  );

  // Fan out to multiple Slack channels
  const messagePromises = inputs.channels.map(channel =>
    slack.chat.postMessage({
      channel,
      text: formatForChannel(data, channel),
    })
  );

  const pages = await Promise.all(pagePromises);
  const messages = await Promise.all(messagePromises);

  return {
    success: true,
    pagesCreated: pages.length,
    messagesSent: messages.length,
  };
}
```

## Saga Pattern (With Rollback)

For operations that must all succeed or all fail:

```typescript
async execute({ inputs, integrations }) {
  const { stripe, notion, slack } = integrations;
  const completed: string[] = [];
  let charge: any, page: any;

  try {
    // Step 1
    const chargeResult = await stripe.createCharge({ amount: 1000 });
    charge = chargeResult.data;
    completed.push('charge');

    // Step 2
    const pageResult = await notion.pages.create({
      parent: { database_id: inputs.notionDatabase },
      properties: { /* invoice record */ },
    });
    page = pageResult.data;
    completed.push('notion');

    // Step 3
    await slack.chat.postMessage({
      channel: inputs.slackChannel,
      text: 'Payment received!',
    });
    completed.push('slack');

    return { success: true };
  } catch (error) {
    // Rollback completed steps
    for (const step of completed.reverse()) {
      try {
        switch (step) {
          case 'charge':
            await stripe.refundCharge(charge.id);
            break;
          case 'notion':
            await notion.pages.update({ page_id: page.id, archived: true });
            break;
          // Slack message doesn't need rollback
        }
      } catch (rollbackError) {
        console.error('Rollback failed', { step, error: rollbackError });
      }
    }

    return { success: false, error: (error as Error).message };
  }
}
```

## Event-Driven Chaining

Workflows triggering other workflows:

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

// Workflow 1: Process meeting
export default defineWorkflow({
  name: 'Process Meeting',

  integrations: ['zoom', 'notion'],

  trigger: webhook({
    service: 'zoom',
    event: 'recording.completed',
  }),

  async execute({ trigger, inputs, integrations, storage }) {
    const result = await processData(trigger.data);

    // Store result for potential downstream workflows
    await storage.put(`processed:${trigger.data.object.id}`, {
      notionPageId: result.pageId,
      summary: result.summary,
      timestamp: Date.now(),
    });

    return { success: true, pageId: result.pageId };
  },
});

// Workflow 2: Notify on schedule (can query processed meetings)
export const notifyStakeholders = defineWorkflow({
  name: 'Notify Stakeholders',

  integrations: ['slack'],

  inputs: {
    slackChannel: { type: 'text', label: 'Slack Channel', required: true },
  },

  trigger: schedule('0 17 * * *'),  // Daily at 5 PM

  async execute({ inputs, integrations, storage }) {
    // Get recently processed meetings
    const keys = await storage.keys();
    const processedToday = keys.filter(k => k.startsWith('processed:'));

    for (const key of processedToday) {
      const data = await storage.get(key);
      if (data) {
        await integrations.slack.chat.postMessage({
          channel: inputs.slackChannel,
          text: `Meeting processed: ${data.summary}`,
        });
      }
    }

    return { success: true };
  },
});
```

## Conditional Branches

Different paths based on data:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { ai, notion, slack, gmail } = integrations;

  const email = trigger.data;

  // AI classifies the email
  const classificationResult = await ai.generateText({
    prompt: `Classify: urgent, follow-up, or informational\n\n${email.subject}\n${email.body}`,
  });

  const category = classificationResult.data?.response?.trim().toLowerCase();

  // Branch based on classification
  switch (category) {
    case 'urgent':
      await slack.chat.postMessage({
        channel: inputs.urgentChannel,
        text: `🚨 Urgent email from ${email.from}: ${email.subject}`,
      });
      break;

    case 'follow-up':
      await notion.pages.create({
        parent: { database_id: inputs.followUpDatabase },
        properties: {
          Name: { title: [{ text: { content: email.subject } }] },
          Status: { select: { name: 'Needs Follow-up' } },
        },
      });
      break;

    case 'informational':
      // Archive with label
      await gmail.addLabel(email.id, inputs.infoLabelId);
      break;
  }

  return { success: true, classification: category };
}
```

## State Machines

Complex workflows with multiple states:

```typescript
type OrderState = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

async execute({ trigger, inputs, integrations, storage }) {
  const orderId = trigger.data.orderId;
  const event = trigger.data.event;

  // Get current state
  const currentState = await storage.get(`order:${orderId}:state`) || 'pending';

  // State transition logic
  const transitions: Record<OrderState, Record<string, OrderState>> = {
    pending: { payment_received: 'paid', cancel: 'cancelled' },
    paid: { ship: 'shipped', refund: 'cancelled' },
    shipped: { deliver: 'delivered' },
    delivered: {},
    cancelled: {},
  };

  const nextState = transitions[currentState as OrderState]?.[event];

  if (!nextState) {
    return { success: false, error: `Invalid transition: ${currentState} -> ${event}` };
  }

  // Execute state-specific actions
  await executeStateActions(nextState, orderId, inputs, integrations);

  // Save new state
  await storage.put(`order:${orderId}:state`, nextState);

  return { success: true, previousState: currentState, newState: nextState };
}

async function executeStateActions(
  state: OrderState,
  orderId: string,
  inputs: any,
  integrations: any
) {
  switch (state) {
    case 'paid':
      await integrations.slack.chat.postMessage({
        channel: inputs.slackChannel,
        text: `Order ${orderId} paid!`,
      });
      break;
    case 'shipped':
      await integrations.gmail.sendEmail({
        to: inputs.customerEmail,
        subject: `Your order shipped!`,
        body: `Order ${orderId} is on its way.`,
      });
      break;
    case 'delivered':
      await integrations.notion.pages.update({
        page_id: orderId,
        properties: { Status: { select: { name: 'Complete' } } },
      });
      break;
  }
}
```

## Best Practices

### 1. Fail Fast

Check prerequisites early:

```typescript
async execute({ trigger, inputs }) {
  // Validate everything before doing anything
  if (!trigger.data?.object?.id) {
    return { success: false, error: 'Missing meeting ID' };
  }
  if (!inputs.notionDatabase) {
    return { success: false, error: 'Notion database not configured' };
  }

  // Now proceed with workflow
}
```

### 2. Idempotency

Handle duplicate triggers:

```typescript
async execute({ trigger, storage }) {
  const eventId = trigger.data.id;
  const processedKey = `processed:${eventId}`;

  if (await storage.get(processedKey)) {
    return { success: true, skipped: true, reason: 'Already processed' };
  }

  // Process...

  await storage.put(processedKey, Date.now());
  return { success: true };
}
```

### 3. Observability

Log at key points:

```typescript
async execute({ trigger, inputs, integrations }) {
  const start = Date.now();
  const { zoom, ai, notion } = integrations;

  console.log('Starting compound workflow', { triggerType: trigger.type });

  console.log('Step 1: Fetching meeting');
  const meetingResult = await zoom.getMeeting(trigger.data.object.id);

  console.log('Step 2: Generating summary');
  const summaryResult = await ai.generateText({ prompt: '...' });

  console.log('Step 3: Saving to Notion');
  const page = await notion.pages.create({ /* ... */ });

  console.log('Workflow complete', { pageId: page.data?.id, duration: Date.now() - start });
}
```

### 4. Graceful Degradation

Continue when non-critical steps fail:

```typescript
async execute({ inputs, integrations }) {
  const { notion, slack, gmail } = integrations;

  const results: {
    notion: any;
    slack: any;
    email: any;
    errors: Array<{ step: string; error: string }>;
  } = {
    notion: null,
    slack: null,
    email: null,
    errors: [],
  };

  // Critical step
  results.notion = await notion.pages.create({ /* ... */ });

  // Non-critical steps
  try {
    results.slack = await slack.chat.postMessage({ /* ... */ });
  } catch (e) {
    results.errors.push({ step: 'slack', error: (e as Error).message });
  }

  try {
    results.email = await gmail.createDraft({ /* ... */ });
  } catch (e) {
    results.errors.push({ step: 'email', error: (e as Error).message });
  }

  return { success: true, ...results };
}
```

## Praxis

Design a compound workflow that orchestrates multiple integrations:

> **Praxis**: Ask Claude Code: "Help me design a compound workflow for [your outcome] that uses Zoom, Notion, Slack, and email"

Map out the workflow:

1. **Trigger**: What event starts everything?
2. **Sequential steps**: What must happen in order?
3. **Parallel steps**: What can happen simultaneously?
4. **Critical vs optional**: Which steps can fail gracefully?

Implement the pattern:

```typescript
async execute({ trigger, inputs, integrations }) {
  const start = Date.now();
  const { zoom, notion, slack, gmail } = integrations;

  // Critical: Get source data
  const meetingResult = await zoom.getMeeting(trigger.data.object.id);

  // Critical: Save to primary destination
  const page = await notion.pages.create({
    parent: { database_id: inputs.notionDatabase },
    properties: { /* ... */ },
  });

  // Parallel optional steps
  const [slackResult, emailResult] = await Promise.allSettled([
    slack.chat.postMessage({
      channel: inputs.slackChannel,
      text: `Notes ready: ${page.data?.url}`,
    }),
    gmail.createDraft({
      to: inputs.followUpEmail,
      subject: 'Meeting follow-up',
    }),
  ]);

  console.log('Compound workflow complete', {
    duration: Date.now() - start,
    slackSuccess: slackResult.status === 'fulfilled',
    emailSuccess: emailResult.status === 'fulfilled',
  });

  return { success: true, pageId: page.data?.id };
}
```

## Reflection

- What complete outcomes could compound workflows create for you?
- How do you decide between sequential vs. parallel execution?
- When is eventual consistency acceptable vs. requiring all-or-nothing?
