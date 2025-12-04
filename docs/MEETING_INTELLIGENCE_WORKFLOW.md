# Meeting Intelligence Workflow

A production workflow that transforms Zoom meetings into actionable knowledge across your stack.

## Overview

**What it does:**
- Syncs Zoom meetings and clips to Notion with full transcripts
- Extracts action items, decisions, and key topics via AI
- Posts summaries to Slack
- Drafts follow-up emails in Gmail
- Updates CRM deals in HubSpot (optional)

**Pricing:** $0.25 per meeting synced (heavy tier - AI + multiple APIs)

**Trigger:** Daily cron (7 AM UTC) or Zoom webhook (`recording.completed`)

---

## Step 1: Create the Workflow

```bash
# Initialize a new workflow
workway workflow init meeting-intelligence

# Or start from template
workway workflow create --template productivity
```

## Step 2: Define the Workflow

Create `workflow.ts`:

```typescript
import { defineWorkflow, cron, webhook } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Meeting Intelligence',
  description: 'Sync Zoom meetings to Notion with transcripts, action items, and Slack summaries',
  version: '1.0.0',

  // Usage-based pricing: $0.25 per meeting
  pricing: {
    model: 'usage',
    pricePerExecution: 0.25,
    freeExecutions: 20,
    description: 'Per meeting synced (includes transcription + AI analysis)',
  },

  // Required integrations
  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read', 'clip:read'] },
    { service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
    { service: 'slack', scopes: ['send_messages', 'read_channels'] },
    { service: 'gmail', scopes: ['compose'], optional: true },
    { service: 'hubspot', scopes: ['crm.objects.deals.read', 'crm.objects.deals.write'], optional: true },
  ],

  // User configuration inputs
  inputs: {
    // Core settings
    notionDatabaseId: {
      type: 'notion_database_picker',
      label: 'Meeting Notes Database',
      required: true,
      description: 'Where to store meeting notes',
    },
    slackChannel: {
      type: 'slack_channel_picker',
      label: 'Meeting Summaries Channel',
      required: true,
      description: 'Where to post meeting summaries',
    },

    // Sync settings
    syncMode: {
      type: 'select',
      label: 'What to Sync',
      options: ['meetings_only', 'clips_only', 'both'],
      default: 'both',
    },
    lookbackDays: {
      type: 'number',
      label: 'Days to Look Back',
      default: 1,
      description: 'How many days of meetings to sync (for daily cron)',
    },

    // AI settings
    enableAI: {
      type: 'boolean',
      label: 'AI Analysis',
      default: true,
      description: 'Extract action items, decisions, and key topics',
    },
    analysisDepth: {
      type: 'select',
      label: 'Analysis Depth',
      options: ['brief', 'standard', 'detailed'],
      default: 'standard',
    },

    // Notification settings
    postToSlack: {
      type: 'boolean',
      label: 'Post Slack Summary',
      default: true,
    },
    draftFollowupEmail: {
      type: 'boolean',
      label: 'Draft Follow-up Email',
      default: false,
      description: 'Create Gmail draft with action items',
    },

    // CRM settings (optional)
    updateCRM: {
      type: 'boolean',
      label: 'Update CRM (HubSpot)',
      default: false,
      description: 'Log meeting activity and update deals',
    },
  },

  // Daily sync at 7 AM
  trigger: cron({
    schedule: '0 7 * * *',
    timezone: 'UTC',
  }),

  // Also support webhook for immediate processing
  webhooks: [
    webhook({
      service: 'zoom',
      event: 'recording.completed',
    }),
  ],

  async execute({ trigger, inputs, integrations, env }) {
    // Implementation follows...
  },
});
```

## Step 3: Implement the Execute Function

```typescript
async execute({ trigger, inputs, integrations, env }) {
  const results = [];
  const isWebhook = trigger.type === 'webhook';

  // Determine what to process
  if (isWebhook) {
    // Single meeting from webhook
    const recording = trigger.data;
    const result = await processMeeting({
      meetingId: recording.meeting_id,
      topic: recording.topic,
      startTime: recording.start_time,
      inputs,
      integrations,
      env,
    });
    results.push(result);
  } else {
    // Batch sync from cron
    const meetings = await integrations.zoom.getMeetings({
      days: inputs.lookbackDays || 1,
      type: 'previous_meetings',
    });

    if (meetings.success) {
      for (const meeting of meetings.data) {
        // Skip already-synced meetings (deduplication)
        const exists = await checkNotionPage(integrations.notion, inputs.notionDatabaseId, meeting.id);
        if (exists) continue;

        const result = await processMeeting({
          meetingId: meeting.id,
          topic: meeting.topic,
          startTime: meeting.start_time,
          inputs,
          integrations,
          env,
        });
        results.push(result);
      }
    }
  }

  return {
    success: true,
    synced: results.length,
    actionItems: results.reduce((sum, r) => sum + r.actionItemCount, 0),
    results,
  };
}
```

## Step 4: Process Each Meeting

```typescript
async function processMeeting({ meetingId, topic, startTime, inputs, integrations, env }) {
  // 1. Get transcript
  const transcriptResult = await integrations.zoom.getTranscript({
    meetingId,
    fallbackToBrowser: true, // Gets speaker attribution
  });

  const transcript = transcriptResult.data?.transcript_text || null;
  const speakers = transcriptResult.data?.speakers || [];

  // 2. AI Analysis
  let analysis = null;
  if (inputs.enableAI && transcript) {
    analysis = await analyzeWithAI(transcript, topic, inputs.analysisDepth, integrations);
  }

  // 3. Create Notion page
  const notionPage = await createNotionPage({
    databaseId: inputs.notionDatabaseId,
    topic,
    startTime,
    transcript,
    speakers,
    analysis,
    sourceId: meetingId,
    integrations,
  });

  // 4. Post to Slack
  let slackPosted = false;
  if (inputs.postToSlack) {
    slackPosted = await postToSlack({
      channel: inputs.slackChannel,
      topic,
      summary: analysis?.summary,
      actionItems: analysis?.actionItems || [],
      notionUrl: notionPage?.url,
      integrations,
    });
  }

  // 5. Draft follow-up email
  let emailDrafted = false;
  if (inputs.draftFollowupEmail && analysis?.actionItems?.length) {
    const draft = await integrations.gmail.createMeetingFollowup({
      meetingTitle: topic,
      summary: analysis.summary,
      actionItems: analysis.actionItems,
      notionUrl: notionPage?.url,
    });
    emailDrafted = draft.success;
  }

  // 6. Update CRM
  let crmUpdated = false;
  if (inputs.updateCRM && integrations.hubspot) {
    crmUpdated = await updateHubSpot({
      topic,
      summary: analysis?.summary,
      actionItems: analysis?.actionItems || [],
      speakers,
      notionUrl: notionPage?.url,
      integrations,
    });
  }

  return {
    meeting: { id: meetingId, topic, date: startTime },
    notionPageUrl: notionPage?.url,
    slackPosted,
    emailDrafted,
    crmUpdated,
    actionItemCount: analysis?.actionItems?.length || 0,
  };
}
```

## Step 5: AI Analysis Helper

```typescript
async function analyzeWithAI(transcript, topic, depth, integrations) {
  const depthPrompts = {
    brief: 'Keep summary to 2-3 sentences. List only critical items.',
    standard: 'Thorough summary in 4-6 sentences. Include all notable items.',
    detailed: 'Comprehensive analysis with full context.',
  };

  const result = await integrations.ai.generateText({
    model: AIModels.LLAMA_3_8B,
    system: `Analyze the meeting transcript and extract:
- summary: Brief summary of the meeting
- decisions: Key decisions made
- actionItems: Tasks with assignees if mentioned
- followUps: Items requiring follow-up
- keyTopics: Main topics discussed
- sentiment: positive, neutral, or concerned

${depthPrompts[depth]}

Return ONLY valid JSON.`,
    prompt: `Meeting: ${topic}\n\nTranscript:\n${transcript.slice(0, 8000)}`,
    temperature: 0.3,
  });

  // Parse JSON from response
  const jsonMatch = result.data?.response?.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
}
```

## Step 6: Notion Page Creation

```typescript
async function createNotionPage({ databaseId, topic, startTime, transcript, speakers, analysis, sourceId, integrations }) {
  const properties = {
    Title: { title: [{ text: { content: topic } }] },
    Date: { date: { start: startTime.split('T')[0] } },
    'Source ID': { rich_text: [{ text: { content: sourceId } }] },
    Status: { select: { name: 'Synced' } },
  };

  if (analysis?.sentiment) {
    properties['Sentiment'] = { select: { name: analysis.sentiment } };
  }

  // Build content blocks
  const children = [];

  // Meeting info callout
  children.push({
    type: 'callout',
    callout: {
      rich_text: [{ text: { content: `Meeting on ${new Date(startTime).toLocaleDateString()}${speakers.length ? ` • ${speakers.join(', ')}` : ''}` } }],
      icon: { emoji: '📅' },
    },
  });

  // AI Summary
  if (analysis?.summary) {
    children.push({ type: 'heading_2', heading_2: { rich_text: [{ text: { content: 'Summary' } }] } });
    children.push({ type: 'paragraph', paragraph: { rich_text: [{ text: { content: analysis.summary } }] } });
  }

  // Action Items as to-do list
  if (analysis?.actionItems?.length) {
    children.push({ type: 'heading_2', heading_2: { rich_text: [{ text: { content: '📋 Action Items' } }] } });
    for (const item of analysis.actionItems) {
      children.push({
        type: 'to_do',
        to_do: {
          rich_text: [{ text: { content: item.task + (item.assignee ? ` (@${item.assignee})` : '') } }],
          checked: false,
        },
      });
    }
  }

  // Transcript in toggle
  if (transcript) {
    children.push({ type: 'divider', divider: {} });
    children.push({
      type: 'toggle',
      toggle: {
        rich_text: [{ text: { content: '📜 Full Transcript' } }],
        children: [{ type: 'paragraph', paragraph: { rich_text: [{ text: { content: transcript.slice(0, 1900) } }] } }],
      },
    });
  }

  const result = await integrations.notion.pages.create({
    parent: { database_id: databaseId },
    properties,
    children,
  });

  return result.success ? { url: result.data?.url } : null;
}
```

## Step 7: Slack Summary

```typescript
async function postToSlack({ channel, topic, summary, actionItems, notionUrl, integrations }) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📋 ${topic}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Summary:*\n${summary || 'Meeting synced'}` },
    },
  ];

  if (actionItems.length > 0) {
    const list = actionItems.map(a => `• ${a.task}${a.assignee ? ` (@${a.assignee})` : ''}`).join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Action Items (${actionItems.length}):*\n${list}` },
    });
  }

  if (notionUrl) {
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: 'View in Notion' },
        url: notionUrl,
      }],
    });
  }

  const result = await integrations.slack.sendMessage({ channel, blocks });
  return result.success;
}
```

## Step 8: HubSpot CRM Update

```typescript
async function updateHubSpot({ topic, summary, actionItems, speakers, notionUrl, integrations }) {
  // Search for deals by meeting topic or attendees
  let dealId = null;

  const dealSearch = await integrations.hubspot.searchDeals({ query: topic, limit: 1 });
  if (dealSearch.success && dealSearch.data?.length) {
    dealId = dealSearch.data[0].id;
  }

  // Find contacts by speaker names
  const contactIds = [];
  for (const speaker of speakers.slice(0, 5)) {
    const search = await integrations.hubspot.searchContacts({ query: speaker, limit: 1 });
    if (search.success && search.data?.length) {
      contactIds.push(search.data[0].id);
    }
  }

  // Log meeting activity
  if (dealId || contactIds.length) {
    await integrations.hubspot.logMeetingActivity({
      dealId,
      contactIds,
      meetingTitle: topic,
      notes: summary,
      externalUrl: notionUrl,
    });
  }

  // Update deal notes
  if (dealId) {
    await integrations.hubspot.updateDealFromMeeting({
      dealId,
      meetingTitle: topic,
      summary,
      actionItems,
      notionUrl,
    });
  }

  return !!(dealId || contactIds.length);
}
```

---

## Step 9: Test Locally

```bash
# Connect required integrations
workway oauth connect zoom
workway oauth connect notion
workway oauth connect slack
workway oauth connect gmail      # optional
workway oauth connect hubspot    # optional

# Test with mock data
workway workflow test --mock

# Test with live integrations
workway workflow test --live
```

## Step 10: Publish to Marketplace

```bash
# Validate workflow
workway workflow validate

# Publish
workway workflow publish

# Output:
# ✓ Workflow "Meeting Intelligence" published!
# ✓ Marketplace URL: https://workway.co/marketplace/meeting-intelligence
# ✓ Pricing: $0.25 per execution (20 free)
```

---

## Notion Database Setup

Users need a Notion database with these properties:

| Property | Type | Purpose |
|----------|------|---------|
| Title | Title | Meeting topic |
| Date | Date | Meeting date |
| Source ID | Text | Zoom meeting ID (for deduplication) |
| Status | Select | Synced, Processing, Failed |
| Sentiment | Select | positive, neutral, concerned |
| Type | Select | Meeting, Clip |
| Source URL | URL | Link to Zoom recording |

---

## Environment Variables

For local development, create `.dev.vars`:

```env
# Required
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret

# Optional: Browser scraper for speaker attribution
BROWSER_SCRAPER_URL=https://zoom-scraper.workway.co
```

---

## Browser Scraper Setup (Speaker Attribution)

The Zoom OAuth API provides transcripts but often lacks speaker names. For full speaker attribution, deploy the WORKWAY Zoom Scraper worker:

### Deploy the Worker

```bash
cd packages/workers/zoom-scraper

# Create KV namespace for cookie storage
wrangler kv:namespace create ZOOM_COOKIES
# Note the ID output, update wrangler.toml

# Set upload secret
wrangler secret put UPLOAD_SECRET
# Enter a random secret (save this for the bookmarklet)

# Deploy
wrangler deploy
```

### Authenticate via Bookmarklet

1. Visit your deployed worker: `https://your-worker.workers.dev/sync`
2. Drag the "Sync Cookies" button to your bookmarks bar
3. Log into Zoom (us06web.zoom.us)
4. Click the bookmark to sync your session cookies

Cookies expire after 24 hours. Re-sync when prompted.

### Configure Workflow

Set the browser scraper URL in your workflow environment:

```typescript
const zoom = new Zoom({
  accessToken: tokens.zoom.access_token,
  browserScraperUrl: env.BROWSER_SCRAPER_URL
});

// Now getTranscript with fallbackToBrowser: true will include speakers
const transcript = await zoom.getTranscript({
  meetingId: '123456',
  fallbackToBrowser: true,
  shareUrl: recording.share_url
});
// transcript.speakers = ['Alice', 'Bob', 'Charlie']
```

---

## Workflow Outputs

Each execution returns:

```typescript
{
  success: true,
  synced: 3,              // Meetings processed
  actionItems: 12,        // Total action items extracted
  crmUpdated: 2,          // Deals updated in HubSpot
  results: [
    {
      meeting: { id: '123', topic: 'Q4 Planning', date: '2024-12-03' },
      notionPageUrl: 'https://notion.so/...',
      slackPosted: true,
      emailDrafted: true,
      crmUpdated: true,
      actionItemCount: 5,
    },
    // ...
  ]
}
```

---

## Error Handling

```typescript
onError: async ({ error, inputs, integrations }) => {
  // Notify on failure
  if (inputs.slackChannel && integrations.slack) {
    await integrations.slack.sendMessage({
      channel: inputs.slackChannel,
      text: `❌ Meeting Intelligence sync failed: ${error.message}`,
    });
  }
}
```

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Zoom     │────▶│  Workers AI │────▶│   Notion    │
│  Meetings   │     │  Analysis   │     │   Pages     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   ▼                   │
       │            ┌─────────────┐            │
       │            │   Slack     │◀───────────┤
       │            │  Summaries  │            │
       │            └─────────────┘            │
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Gmail     │     │  HubSpot    │     │   Linear    │
│   Drafts    │     │    CRM      │     │   Tasks     │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Why This Workflow?

**Zuhandenheit (Ready-to-hand):** The tool recedes, the outcome remains.

Developers think:
- "Sync my meetings" → not "GET /zoom/recordings, parse JSON, POST /notion/pages..."
- "Extract action items" → not "prompt engineering, JSON schema, temperature tuning..."
- "Update CRM" → not "search deals, log engagement, PATCH notes..."

The workflow handles complexity. The user gets value.
