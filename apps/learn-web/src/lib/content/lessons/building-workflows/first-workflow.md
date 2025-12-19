# Your First Workflow: Gmail to Notion

## Learning Objectives

By the end of this lesson, you will be able to:

- Create a complete Gmail to Notion workflow from scratch
- Initialize a project with `workway init` and configure integrations
- Implement polling-based email checking with star filtering
- Create Notion database entries with proper property formatting
- Deploy your workflow and verify it works in production

---

Build a real workflow that saves important emails to Notion. By the end, you'll have a working automation.

## What We're Building

**Outcome**: Starred emails automatically become Notion database entries.

No more copying email content. No more context switching. Star an email, it appears in Notion.

## Prerequisites

Before starting:
- [ ] WORKWAY CLI installed (`workway --version`)
- [ ] Gmail account with WORKWAY connected
- [ ] Notion workspace with WORKWAY connected
- [ ] A Notion database for email notes

## Step 1: Create the Project

```bash
mkdir gmail-to-notion
cd gmail-to-notion
workway init
```

This creates:
```
gmail-to-notion/
├── src/
│   └── index.ts      # Your workflow code
├── wrangler.toml     # Cloudflare config
├── package.json
└── tsconfig.json
```

## Step 2: Define the Workflow

Open `src/index.ts` and replace the contents:

```typescript
import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Gmail to Notion',
  description: 'Save starred emails to a Notion database',
  version: '1.0.0',

  integrations: [
    { service: 'gmail', scopes: ['gmail.readonly'] },
    { service: 'notion', scopes: ['read_pages', 'write_pages'] },
  ],

  inputs: {
    notionDatabase: {
      type: 'text',
      label: 'Email Notes Database ID',
      description: 'Where to save your starred emails',
      required: true,
    },
  },

  trigger: schedule('*/15 * * * *'),  // Every 15 minutes

  async execute({ inputs, integrations, storage }) {
    const { gmail, notion } = integrations;

    // Get starred emails since last check
    const lastCheck = await storage.get('lastCheck') || new Date(0).toISOString();

    const emailsResult = await gmail.getMessages({
      query: `is:starred after:${lastCheck}`,
    });

    if (!emailsResult.success) {
      return { success: false, error: 'Failed to fetch emails' };
    }

    const emails = emailsResult.data || [];
    console.log(`Found ${emails.length} new starred emails`);

    for (const email of emails) {
      // Get full email content
      const fullEmailResult = await gmail.getMessage(email.id);
      if (!fullEmailResult.success) continue;

      const fullEmail = fullEmailResult.data;

      // Create Notion page
      await notion.pages.create({
        parent: { database_id: inputs.notionDatabase },
        properties: {
          Name: {
            title: [{ text: { content: fullEmail.subject } }]
          },
          From: {
            rich_text: [{ text: { content: fullEmail.from } }]
          },
          Date: {
            date: { start: fullEmail.date }
          },
        },
        children: [
          {
            type: 'paragraph',
            paragraph: {
              rich_text: [{ text: { content: fullEmail.snippet } }],
            },
          },
        ],
      });

      console.log('Created Notion page:', fullEmail.subject);
    }

    // Update last check time
    await storage.put('lastCheck', new Date().toISOString());

    return {
      success: true,
      processed: emails.length
    };
  },
});
```

## Step 3: Understand the Code

### Integrations
```typescript
integrations: [
  { service: 'gmail', scopes: ['gmail.readonly'] },
  { service: 'notion', scopes: ['read_pages', 'write_pages'] },
],
```

Users must connect both Gmail and Notion before installing.

### Inputs
```typescript
inputs: {
  notionDatabase: {
    type: 'text',
    label: 'Email Notes Database ID',
    required: true,
  },
}
```

User provides the Notion database ID to save emails to.

### Trigger
```typescript
trigger: schedule('*/15 * * * *'),  // Every 15 minutes
```

Runs automatically every 15 minutes.

### Execute Logic
```typescript
async execute({ inputs, integrations, storage }) {
  // 1. Get new starred emails
  // 2. For each email, create Notion page
  // 3. Remember when we last checked (using storage)
}
```

The core workflow logic.

## Step 4: Test Locally

Start the development server:

```bash
workway dev
```

In another terminal, trigger a test run:

```bash
curl http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{}'
```

Check the output for any errors.

## Step 5: Prepare Notion Database

Your Notion database needs these properties:

| Property | Type |
|----------|------|
| Name | Title |
| From | Text |
| Date | Date |

Create the database if you haven't already.

## Step 6: Deploy

When ready, deploy to production:

```bash
workway deploy
```

Output:
```
Deploying gmail-to-notion...
✓ Build complete (1.2s)
✓ Uploaded to Cloudflare (0.8s)
✓ Workflow live at: https://gmail-to-notion.workway.co

Configure at: https://workway.co/workflows/gmail-to-notion/configure
```

## Step 7: Configure

Visit the configuration URL and:

1. Connect your Gmail account (if not already)
2. Connect your Notion workspace (if not already)
3. Select your Email Notes database
4. Enable the workflow

## Step 8: Test End-to-End

1. Star an email in Gmail
2. Wait up to 15 minutes (or trigger manually in dashboard)
3. Check your Notion database

The email should appear as a new page.

## Improvements to Try

### Add Email Body

Include the full email body:

```typescript
children: [
  {
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Email Content' } }] },
  },
  {
    type: 'paragraph',
    paragraph: {
      rich_text: [{ text: { content: fullEmail.body } }],
    },
  },
],
```

### Filter by Label

Only process specific labels:

```typescript
inputs: {
  gmailLabel: {
    type: 'text',
    label: 'Gmail Label',
    description: 'Only process emails with this label',
    default: 'STARRED',
  },
},

// In execute:
const emails = await gmail.getMessages({
  query: `label:${inputs.gmailLabel} after:${lastCheck}`,
});
```

### Add Status Property

Track processing status in Notion:

```typescript
properties: {
  // ... existing properties
  Status: {
    select: { name: 'New' },
  },
},
```

### Real-time with Webhooks

Instead of polling, use Gmail push notifications:

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

// ...

trigger: webhook({
  service: 'gmail',
  event: 'message.received',
}),

async execute({ trigger }) {
  const email = trigger.data;
  if (email.labels?.includes('STARRED')) {
    // Process immediately
  }
}
```

## Common Issues

### "No emails found"

- Make sure you've starred emails recently
- Check that the Gmail connection is active
- Verify the time filter isn't excluding emails

### "Failed to create Notion page"

- Verify database properties match (Name, From, Date)
- Check that you have write access to the database
- Ensure Notion connection hasn't expired

### "Rate limit exceeded"

- Gmail and Notion have API limits
- The workflow handles this automatically with retries
- For high volume, consider batching

## Praxis

Build and deploy your first workflow end-to-end:

> **Praxis**: Ask Claude Code: "Help me create a gmail-to-notion workflow following the pattern in this lesson"

Follow the complete lifecycle:

1. **Initialize**: Create the project structure
2. **Implement**: Write the workflow code
3. **Test locally**: `workway dev` + curl
4. **Deploy**: `workway deploy`
5. **Configure**: Connect integrations in the dashboard
6. **Test production**: Star an email, check Notion

If you encounter issues, ask Claude Code:

> "Debug this error: [paste error message]"

> "How do I verify my Notion database has the correct properties?"

Document what you learn. What surprised you? What would you do differently next time?

## Reflection

You've built a complete workflow that:
- Runs automatically on a schedule
- Reads from Gmail API
- Creates pages in Notion
- Persists state across runs

Next, expand this pattern to other integrations or add AI-powered features.
