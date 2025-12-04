# Pattern: Compound Workflow Architecture

**Pattern ID:** `compound-workflow`
**Category:** Workflow Design
**Status:** Production
**Date:** December 3, 2025

---

## Context

Complex automation often requires orchestrating multiple services in sequence:
1. Data extraction from source (Zoom)
2. AI processing (Workers AI)
3. Storage in knowledge base (Notion)
4. Notifications (Slack)
5. CRM updates (HubSpot)

Each step may fail independently, and the workflow must handle partial success gracefully.

## Problem

Naive implementations lead to:
- Monolithic execute functions (500+ lines)
- Poor error isolation (one failure stops all)
- Difficult testing (can't test individual steps)
- Unclear data flow between steps

## Solution: Step-Based Compound Workflow

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WORKFLOW ORCHESTRATOR                       │
│                     (execute function)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   EXTRACT   │───▶│   ANALYZE   │───▶│   STORE     │          │
│  │   (Zoom)    │    │   (AI)      │    │   (Notion)  │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                  │                  │                 │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    PARALLEL NOTIFY                       │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │    │
│  │  │  Slack  │  │  Gmail  │  │ HubSpot │  │ Linear  │     │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles

#### 1. Single Responsibility Helpers

Each step is a pure function that handles one concern:

```typescript
// BAD: Monolithic
async execute({ trigger, inputs, integrations }) {
  const meetings = await integrations.zoom.getMeetings({ days: 1 });
  for (const meeting of meetings.data) {
    const transcript = await integrations.zoom.getTranscript({ meetingId: meeting.id });
    const analysis = await integrations.ai.generateText({ ... });
    const page = await integrations.notion.pages.create({ ... });
    await integrations.slack.chat.postMessage({ ... });
    // 200 more lines...
  }
}

// GOOD: Decomposed
async execute({ trigger, inputs, integrations }) {
  const results = [];

  for (const meeting of await getMeetings(inputs, integrations)) {
    const result = await processMeeting({
      meeting,
      inputs,
      integrations,
    });
    results.push(result);
  }

  return summarize(results);
}

async function processMeeting(params) {
  const transcript = await extractTranscript(params);
  const analysis = await analyzeWithAI(transcript, params);
  const page = await storeInNotion(analysis, params);
  await notifyChannels(page, analysis, params);
  return { success: true, page };
}
```

#### 2. Graceful Degradation

Each step can fail without stopping the workflow:

```typescript
async function processMeeting(params) {
  const { inputs, integrations } = params;

  // Step 1: Extract (required)
  const transcript = await extractTranscript(params);

  // Step 2: AI Analysis (optional - degrades gracefully)
  let analysis = null;
  if (inputs.enableAI && transcript) {
    analysis = await analyzeWithAI(transcript, params);
  }

  // Step 3: Store (required)
  const page = await storeInNotion({
    transcript,
    analysis, // May be null - page still created
    ...params
  });

  // Step 4: Notify (optional - all run independently)
  const notifications = await Promise.allSettled([
    inputs.postToSlack && postToSlack(page, analysis, params),
    inputs.draftEmail && draftEmail(page, analysis, params),
    inputs.updateCRM && updateCRM(page, analysis, params),
  ]);

  return {
    success: true,
    page,
    notifications: countSuccessful(notifications),
  };
}
```

#### 3. Input-Driven Branching

User inputs control which steps execute:

```typescript
inputs: {
  // Core (required)
  notionDatabaseId: { type: 'notion_database_picker', required: true },

  // Optional features (each enables a step)
  enableAI: { type: 'boolean', default: true },
  postToSlack: { type: 'boolean', default: true },
  draftFollowupEmail: { type: 'boolean', default: false },
  updateCRM: { type: 'boolean', default: false },

  // Feature-specific configuration
  analysisDepth: { type: 'select', options: ['brief', 'standard', 'detailed'] },
  slackChannel: { type: 'slack_channel_picker' },
}
```

#### 4. Consistent Return Types

All helpers return structured results:

```typescript
interface StepResult {
  success: boolean;
  data?: any;
  error?: string;
}

async function extractTranscript(params): Promise<StepResult> {
  try {
    const result = await params.integrations.zoom.getTranscript({ ... });
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### 5. Deduplication at Entry

Check for existing work before processing:

```typescript
async execute({ trigger, inputs, integrations }) {
  for (const meeting of meetings) {
    // Skip already-processed items
    const exists = await checkExisting(
      integrations.notion,
      inputs.notionDatabaseId,
      meeting.id
    );

    if (exists) {
      continue; // Idempotent - safe to re-run
    }

    await processMeeting({ meeting, inputs, integrations });
  }
}
```

## Implementation: Meeting Intelligence

### Workflow Structure

```typescript
export default defineWorkflow({
  name: 'Meeting Intelligence',

  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
    { service: 'notion', scopes: ['write_pages'] },
    { service: 'slack', scopes: ['send_messages'], optional: true },
    { service: 'gmail', scopes: ['compose'], optional: true },
    { service: 'hubspot', scopes: ['crm.objects.deals.write'], optional: true },
  ],

  inputs: { /* feature toggles */ },

  async execute({ trigger, inputs, integrations }) {
    // 1. Determine source (webhook vs cron)
    const meetings = trigger.type === 'webhook'
      ? [trigger.data]
      : await fetchRecentMeetings(inputs, integrations);

    // 2. Process each meeting
    const results = [];
    for (const meeting of meetings) {
      const result = await processMeeting({ meeting, inputs, integrations });
      results.push(result);
    }

    // 3. Return summary
    return summarizeResults(results);
  }
});
```

### Helper Functions (954 lines total)

| Function | Lines | Purpose |
|----------|-------|---------|
| `processMeeting` | 90 | Orchestrate single meeting pipeline |
| `processClip` | 60 | Orchestrate single clip pipeline |
| `analyzeMeeting` | 50 | AI transcript analysis |
| `createNotionMeetingPage` | 180 | Notion page with structured content |
| `splitTranscriptIntoBlocks` | 40 | WebVTT → Notion blocks |
| `postSlackSummary` | 50 | Slack message with blocks |
| `draftFollowupEmail` | 30 | Gmail draft creation |
| `updateCRM` | 70 | HubSpot deal/contact updates |
| `checkExistingPage` | 20 | Deduplication check |

## Results

| Metric | Monolithic | Compound | Improvement |
|--------|------------|----------|-------------|
| Max function length | 500+ lines | 90 lines | 82% reduction |
| Testability | Low | High | Isolated helpers |
| Error recovery | All-or-nothing | Per-step | Graceful degradation |
| Feature toggles | Hardcoded | Input-driven | User control |

## Pattern Applicability

Use this pattern when:
- Workflow has 3+ sequential steps
- Some steps are optional/configurable
- Steps may fail independently
- Testing individual steps is valuable

Don't use when:
- Simple 1-2 step workflows
- All steps must succeed (transactional)
- No user configuration needed

## Testing Strategy

```typescript
// Test individual helpers in isolation
describe('analyzeMeeting', () => {
  it('returns structured analysis', async () => {
    const result = await analyzeMeeting(
      'Transcript text...',
      'Meeting Topic',
      'standard',
      mockIntegrations
    );

    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('actionItems');
  });
});

// Test workflow with mocked helpers
describe('Meeting Intelligence', () => {
  it('handles AI failure gracefully', async () => {
    mockAI.generateText.mockRejectedValue(new Error('AI down'));

    const result = await workflow.execute({ ... });

    expect(result.success).toBe(true); // Still succeeds
    expect(result.results[0].analysis).toBeNull(); // But no analysis
  });
});
```

---

*Pattern documented as part of CREATE SOMETHING methodology.*
*Reference: createsomething.ltd/patterns*
