# Agency Patterns

## Learning Objectives

By the end of this lesson, you will be able to:

- Conduct workflow discovery interviews with clients using outcome-focused questions
- Identify patterns across client projects that can become marketplace workflows
- Apply the "Build Once, Deploy Many" strategy for workflow reusability
- Structure client engagements with scoping, building, and maintenance phases
- Price workflows using hybrid models (implementation fee + per-execution)

---

Agencies building workflows for clients sit at a strategic leverage point. Build once, deploy many. Turn client projects into platform assets.

## Step-by-Step: Build Your First Client Workflow

### Step 1: Conduct Discovery

Ask the client these questions:

```
1. What manual processes take the most time?
2. What data moves between systems repeatedly?
3. What notifications would help your team?
4. What breaks when someone is out of office?
```

Document the answers in outcome format (not technology):
```
Manual process: "After every sales call, I update the CRM, send a summary to the team, and schedule a follow-up"
Outcome needed: "Sales calls that handle their own aftermath"
```

### Step 2: Map the Technical Requirements

Translate outcomes to workflow components:

```
Outcome: "Sales calls handle their own aftermath"

Trigger: Zoom meeting ends
Steps:
  1. Get meeting transcript (Zoom API)
  2. Generate summary (AI)
  3. Update CRM record (Salesforce)
  4. Notify team (Slack)
  5. Create follow-up task (CRM/Calendar)

Integrations needed: zoom, salesforce, slack, google-calendar
```

### Step 3: Create the Private Workflow

Set up the project structure:

```bash
mkdir client-acme-meeting-sync
cd client-acme-meeting-sync
pnpm init
pnpm add @workwayco/sdk
mkdir src
touch src/index.ts
```

Configure as private:

```typescript
export const metadata = {
  id: 'acme-meeting-intelligence',
  name: 'Acme Meeting Intelligence',
  visibility: 'private' as const,
  accessGrants: [
    { type: 'email_domain' as const, value: 'acme.com' },
  ],
};
```

### Step 4: Build the Core Workflow

Implement the client's requirements:

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Acme Meeting Intelligence',
  description: 'Automatic meeting summaries, CRM updates, and team notifications',
  version: '1.0.0',

  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
    { service: 'salesforce', scopes: ['api', 'refresh_token'] },
    { service: 'slack', scopes: ['chat:write'] },
  ],

  inputs: {
    salesforceObjectType: { type: 'text', default: 'Opportunity' },
    slackChannel: { type: 'picker', pickerType: 'slack:channel' },
  },

  trigger: webhook({ service: 'zoom', event: 'recording.completed' }),

  async execute({ trigger, inputs, integrations }) {
    // Implementation here
  },
});
```

### Step 5: Test with Client Data

Create mock data that matches client scenarios:

```typescript
// mocks/zoom.ts
export default {
  getMeeting: () => ({
    success: true,
    data: {
      id: 'mtg-123',
      topic: 'Acme Corp - Q1 Review',
      participants: ['sales@acme.com', 'client@prospect.com'],
    },
  }),
};
```

### Step 6: Deploy for Client

Deploy as private workflow:

```bash
workway deploy --visibility private

# Output:
# ✓ Deployed: acme-meeting-intelligence
# ✓ Access: acme.com email domain only
# ✓ URL: workway.co/workflows/private/acme-meeting-intelligence
```

### Step 7: Document for Handoff

Create client-facing documentation:

```markdown
## Acme Meeting Intelligence

### What it does
After every Zoom meeting with a recording, this workflow:
1. Extracts the transcript
2. Generates an AI summary
3. Updates the related Salesforce opportunity
4. Posts a summary to #sales-updates in Slack

### Setup required
1. Connect your Zoom account
2. Connect Salesforce (needs API access)
3. Select your Slack notification channel
```

---

## The Agency Opportunity

Traditional agency model:
```
Client need → Custom build → One-time revenue → Maintenance burden
```

WORKWAY agency model:
```
Client need → Private workflow → Recurring revenue → Marketplace opportunity
```

## Three Revenue Streams

### 1. Implementation Fee

Charge for building the workflow:

```
Client: "We need Zoom meetings synced to Salesforce"
Agency: Builds zoom-salesforce-sync workflow
Revenue: $X,000 implementation fee
```

### 2. Per-Execution Revenue

WORKWAY shares execution revenue:

```
Workflow runs 1,000 times/month
Per-execution fee: $0.01
Agency share: 70%
Monthly recurring: $7
```

Small per workflow, significant at scale across clients.

### 3. Marketplace Generalization

Recognize patterns → Generalize → Publish:

```
Private: acme-zoom-salesforce-sync
        ↓ (generalize)
Public: Zoom to Salesforce Meeting Sync
        ↓
Every installation = recurring revenue
```

## Client Engagement Pattern

### Phase 1: Discovery

```typescript
// Questions to ask:
// - What manual processes take the most time?
// - What data moves between systems repeatedly?
// - What notifications would help your team?
// - What compliance/reporting requirements exist?
```

### Phase 2: Scope

Define the workflow:

```typescript
const proposal = {
  workflow: 'Meeting Intelligence Pipeline',
  trigger: 'Zoom meeting ends',
  steps: [
    'Extract transcript',
    'AI summarization',
    'Save to Notion',
    'Update Salesforce',
    'Slack notification',
  ],
  integrations: ['zoom', 'notion', 'salesforce', 'slack'],
  timeline: '2 weeks',
  cost: 'Implementation: $5,000 | Ongoing: per-execution',
};
```

### Phase 3: Build

Create private workflow for client:

```typescript
export default defineWorkflow({
  metadata: {
    id: 'acme-meeting-intelligence',
    visibility: 'private',
    accessGrants: [
      { type: 'email_domain', value: 'acmecorp.com' },
    ],
    // Tag for your agency's tracking
    tags: ['agency:yourcompany', 'client:acme'],
  },
  // ... implementation
});
```

### Phase 4: Deploy & Train

```bash
workway deploy
```

Then:
- Walk client through installation
- Configure their integrations
- Test end-to-end
- Document any customizations

### Phase 5: Maintain & Expand

Monitor via analytics:
```
workway.co/workflows/private/acme-meeting-intelligence/analytics
```

Identify expansion opportunities:
- New integrations
- Additional triggers
- Related workflows

## Template Strategy

### Building Your Library

Create reusable templates:

```
agency-templates/
├── meeting-to-notion/
│   ├── base.ts           # Core logic
│   └── variants/
│       ├── with-salesforce.ts
│       ├── with-hubspot.ts
│       └── with-slack.ts
├── email-triage/
│   ├── base.ts
│   └── variants/
│       ├── support-queue.ts
│       └── sales-leads.ts
└── payment-notifications/
    └── ...
```

### Parameterized Templates

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

// templates/meeting-to-crm.ts
export function createMeetingToCRM(options: {
  clientName: string;
  crmType: 'salesforce' | 'hubspot' | 'pipedrive';
  includeTranscript: boolean;
  slackNotification: boolean;
}) {
  return {
    workflow: defineWorkflow({
      name: `${options.clientName} Meeting to CRM`,
      description: `Sync meetings to ${options.crmType} for ${options.clientName}`,
      version: '1.0.0',

      integrations: [
        { service: 'zoom', scopes: ['meeting:read'] },
        { service: options.crmType, scopes: ['read', 'write'] },
        ...(options.slackNotification ? [{ service: 'slack', scopes: ['send_messages'] }] : []),
      ],

      inputs: {
        crmObject: {
          type: 'text',
          label: 'CRM Object ID',
          required: true,
        },
        ...(options.slackNotification && {
          slackChannel: {
            type: 'text',
            label: 'Notification Channel',
          },
        }),
      },

      trigger: webhook({
        service: 'zoom',
        event: 'recording.completed',
      }),

      async execute({ trigger, inputs, integrations }) {
        const { zoom, [options.crmType]: crm, slack } = integrations;

        const meetingResult = await zoom.getMeeting(trigger.data.object.id);

        // CRM update logic based on type
        await updateCRM(crm, options.crmType, meetingResult.data, inputs);

        if (options.slackNotification && inputs.slackChannel) {
          await slack.chat.postMessage({
            channel: inputs.slackChannel,
            text: `Meeting synced to ${options.crmType}`,
          });
        }

        return { success: true };
      },
    }),
    metadata: {
      id: `${options.clientName.toLowerCase()}-meeting-crm`,
      visibility: 'private' as const,
      accessGrants: [
        { type: 'email_domain' as const, value: `${options.clientName.toLowerCase()}.com` },
      ],
    },
  };
}
```

### Rapid Client Deployment

```typescript
// For new client
const { workflow, metadata } = createMeetingToCRM({
  clientName: 'ACME',
  crmType: 'salesforce',
  includeTranscript: true,
  slackNotification: true,
});

export default workflow;
export { metadata };
```

Deploy in minutes, not weeks.

## Marketplace Graduation

### Identifying Generalization Candidates

After building for multiple clients, patterns emerge:

```
Client A: Zoom → Salesforce (with AI summary)
Client B: Zoom → HubSpot (with AI summary)
Client C: Google Meet → Salesforce (with AI summary)
                ↓
Generalization: Meeting Recording → CRM (any meeting tool, any CRM)
```

### Making It Generic

```typescript
// Private (client-specific)
export default defineWorkflow({
  metadata: {
    id: 'acme-zoom-salesforce',
    visibility: 'private',
    accessGrants: [{ type: 'email_domain', value: 'acme.com' }],
  },
  configSchema: {
    salesforceObject: { /* hardcoded to Salesforce */ },
  },
});

// Public (generalized)
export default defineWorkflow({
  metadata: {
    id: 'meeting-to-crm-sync',
    name: 'Meeting to CRM Sync',
    description: 'Automatically sync meeting recordings and transcripts to your CRM',
    visibility: 'public',
    category: 'sales',
    integrations: ['zoom', 'google-meet', 'salesforce', 'hubspot', 'pipedrive'],
  },
  configSchema: {
    meetingSource: {
      type: 'select',
      label: 'Meeting Source',
      options: [
        { value: 'zoom', label: 'Zoom' },
        { value: 'google-meet', label: 'Google Meet' },
      ],
    },
    crmDestination: {
      type: 'select',
      label: 'CRM',
      options: [
        { value: 'salesforce', label: 'Salesforce' },
        { value: 'hubspot', label: 'HubSpot' },
        { value: 'pipedrive', label: 'Pipedrive' },
      ],
    },
    // Dynamic picker based on CRM selection
    crmObject: {
      type: 'picker',
      pickerType: 'dynamic:crm-object',
      dependsOn: 'crmDestination',
    },
  },
});
```

## Pricing Strategy

### Implementation Pricing

| Complexity | Integrations | AI Features | Price Range |
|------------|--------------|-------------|-------------|
| Simple | 2 | No | $1,000-2,500 |
| Standard | 3-4 | Basic | $2,500-5,000 |
| Complex | 5+ | Advanced | $5,000-15,000 |
| Enterprise | Custom | Custom | $15,000+ |

### Value-Based Add-ons

- Custom error handling: +$500
- Analytics dashboard: +$1,000
- SLA guarantees: +20%
- On-call support: Retainer

### Recurring Revenue

Per-execution share from WORKWAY:
- You receive 70% of execution fees
- Applies to all client installations
- Marketplace workflows earn from all users

## Portfolio Management

### Track Your Workflows

```typescript
// Tag all agency workflows
metadata: {
  tags: [
    'agency:yourcompany',
    'client:clientname',
    'template:meeting-to-crm',
    'status:active',
  ],
},
```

### Agency Dashboard Metrics

Monitor across all client workflows:
- Total executions/month
- Success rates
- Revenue per client
- Top-performing workflows

### Lifecycle Management

```
New → Active → Mature → Sunset

New: Recently deployed, monitoring closely
Active: Running well, occasional updates
Mature: Stable, minimal maintenance
Sunset: Client churned or workflow deprecated
```

## Client Success Patterns

### Onboarding Checklist

- [ ] Client has WORKWAY account
- [ ] All required integrations connected
- [ ] Workflow installed and configured
- [ ] Test execution successful
- [ ] Client trained on monitoring
- [ ] Support escalation path documented

### Monthly Review Template

```markdown
## Workflow Health Report

**Client**: ACME Corp
**Workflow**: Meeting Intelligence Pipeline
**Period**: January 2024

### Metrics
- Executions: 1,247
- Success Rate: 99.2%
- Avg Duration: 3.2s

### Issues
- 10 failures due to Zoom API rate limit (resolved)

### Recommendations
- Add Slack notification for meeting highlights
- Consider expanding to Google Meet
```

## Praxis

Create a reusable template for client workflows:

> **Praxis**: Ask Claude Code: "Help me create a parameterized workflow template that can be customized per client"

Build a template factory:

```typescript
// templates/meeting-to-crm.ts
export function createMeetingToCRM(options: {
  clientName: string;
  crmType: 'salesforce' | 'hubspot';
}) {
  return defineWorkflow({
    metadata: {
      id: `${options.clientName.toLowerCase()}-meeting-crm`,
      visibility: 'private',
      accessGrants: [
        { type: 'email_domain', value: `${options.clientName.toLowerCase()}.com` },
      ],
      tags: ['agency:yourcompany', `client:${options.clientName.toLowerCase()}`],
    },

    configSchema: {
      crmObject: {
        type: 'picker',
        pickerType: `${options.crmType}:object`,
        label: 'CRM Object',
      },
    },

    async execute({ trigger, config, integrations }) {
      // Implementation...
    },
  });
}
```

Practice the client engagement flow:
1. Discovery: Identify their manual processes
2. Scope: Define workflow, integrations, timeline
3. Build: Use templates where possible
4. Deploy & Train: Onboard the client
5. Maintain & Expand: Monthly reviews

## Reflection

- What patterns have you seen across client requests?
- Which workflows could you templatize?
- How does recurring revenue change your pricing model?
