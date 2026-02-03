# Build private workflows

Create organization-specific workflows with access controls.

## What you'll do

- Choose private vs public visibility
- Configure access controls in metadata
- Define `accessGrants` by email domain
- Implement BYOO (Bring Your Own OAuth)
- Isolate organization data with storage

## Real Example: Private Emails Documented

Here's how the production `private-emails-documented` workflow configures private visibility and access grants:

```typescript
// From packages/workflows/src/private-emails-documented/index.ts

/**
 * Workflow metadata - Private workflow for @halfdozen.co
 */
export const metadata = {
  id: "private-emails-documented",
  category: "productivity",
  featured: false,

  // Private workflow - requires WORKWAY login
  visibility: "private" as const,
  accessGrants: [{ type: "email_domain" as const, value: "halfdozen.co" }],

  // Honest flags (matches meeting-intelligence-private pattern)
  experimental: true,
  requiresCustomInfrastructure: true,
  canonicalAlternative: "emails-documented", // Future public version

  // Why this exists
  workaroundReason:
    "Gmail OAuth scopes require Google app verification for public apps",
  infrastructureRequired: ["BYOO Google OAuth app", "Arc for Gmail worker"],

  // Upgrade path (when Google verification completes)
  upgradeTarget: "emails-documented",
  upgradeCondition: "When WORKWAY Gmail OAuth app is verified",

  // Analytics URL - unified at workway.co/workflows
  analyticsUrl:
    "https://workway.co/workflows/private/private-emails-documented/analytics",

  // Setup URL - initial BYOO connection setup
  setupUrl: "https://arc.halfdozen.co/setup",

  stats: { rating: 0, users: 0, reviews: 0 },
};
```

Key patterns to notice:

1. **`visibility: 'private' as const`** - TypeScript literal type for compile-time safety
2. **`accessGrants`** - Array of access rules (email_domain, email, organization)
3. **`experimental` and `requiresCustomInfrastructure`** - Honest flags about workflow requirements
4. **`canonicalAlternative` and `upgradeTarget`** - Points users to the standard path when available

## Step-by-Step: Create Your First Private Workflow

### Step 1: Initialize the Project

Create a new workflow with private visibility:

```bash
mkdir client-meeting-sync
cd client-meeting-sync
pnpm init
pnpm add @workwayco/sdk
```

### Step 2: Define the Workflow Structure

Create `src/index.ts`:

```typescript
import { defineWorkflow, webhook } from "@workwayco/sdk";

export default defineWorkflow({
  name: "Client Meeting Sync",
  description: "Syncs meeting data to internal CRM",
  version: "1.0.0",

  integrations: [{ service: "zoom", scopes: ["meeting:read"] }],

  inputs: {
    crmEndpoint: { type: "text", label: "CRM API Endpoint", required: true },
  },

  trigger: webhook({
    service: "zoom",
    event: "meeting.ended",
  }),

  async execute({ trigger, inputs, integrations }) {
    const { zoom } = integrations;
    const meeting = await zoom.getMeeting(trigger.data.object.id);

    // Sync to internal CRM
    await fetch(inputs.crmEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting: meeting.data }),
    });

    return { success: true };
  },
});
```

### Step 3: Add Private Metadata

Export the private workflow configuration:

```typescript
// Add at the bottom of src/index.ts
export const metadata = {
  id: "client-meeting-sync",
  visibility: "private" as const,
  accessGrants: [{ type: "email_domain" as const, value: "clientcorp.com" }],
};
```

### Step 4: Test Locally

```bash
workway dev

# In another terminal
curl localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"object": {"id": "test-123", "topic": "Test Meeting"}}'
```

### Step 5: Deploy as Private

```bash
workway deploy

# Output:
# ✓ Deployed: client-meeting-sync
# ✓ Visibility: private
# ✓ Access: clientcorp.com email domain
# ✓ URL: workway.co/workflows/private/client-meeting-sync
```

### Step 6: Share with Client

Send the install link to authorized users:

```
https://workway.co/workflows/private/client-meeting-sync
```

They'll authenticate, verify access, connect integrations, and configure.

---

## Public vs. Private

| Aspect        | Public Workflow     | Private Workflow      |
| ------------- | ------------------- | --------------------- |
| Visibility    | Marketplace listing | Organization only     |
| Access        | Anyone can install  | Authorized users only |
| Discovery     | Searchable          | Hidden from search    |
| Pricing       | Per-execution fees  | Custom arrangements   |
| Customization | Config options only | Full customization    |

## When to Build Private

Private workflows make sense when:

- **Proprietary process**: Your competitive advantage shouldn't be public
- **Client-specific**: Built for a specific organization's needs
- **Sensitive data**: Handles data that shouldn't touch shared infrastructure
- **Custom integrations**: Uses internal APIs or systems
- **Compliance**: Requires audit trails or specific controls

## Defining Private Workflows

```typescript
import { defineWorkflow, webhook } from "@workwayco/sdk";

export default defineWorkflow({
  name: "Client CRM Sync",
  description: "Syncs meeting data to internal CRM",
  version: "1.0.0",

  integrations: [{ service: "zoom", scopes: ["meeting:read"] }],

  inputs: {
    crmEndpoint: { type: "text", label: "CRM API Endpoint", required: true },
  },

  trigger: webhook({
    service: "zoom",
    event: "meeting.ended",
  }),

  async execute({ trigger, inputs, integrations }) {
    // ... workflow logic
  },
});

// Private workflow metadata is exported separately
export const metadata = {
  id: "client-crm-sync",
  visibility: "private" as const,
  accessGrants: [
    { type: "email_domain" as const, value: "acmecorp.com" },
    { type: "email" as const, value: "contractor@external.com" },
    { type: "organization" as const, value: "org_123" },
  ],
};
```

## Access Control

Access grants determine who can install and use your private workflow. All grants use TypeScript const assertions for type safety.

### Email Domain

Allow anyone from a company domain:

```typescript
// From private-emails-documented - restricts to @halfdozen.co team
accessGrants: [{ type: "email_domain" as const, value: "halfdozen.co" }];
```

Anyone with `@halfdozen.co` email can install and use the workflow.

### Specific Emails

Grant access to specific individuals (useful for external collaborators):

```typescript
accessGrants: [
  { type: "email" as const, value: "alice@example.com" },
  { type: "email" as const, value: "bob@contractor.io" },
];
```

### Organization ID

Link to WORKWAY organization:

```typescript
accessGrants: [{ type: "organization" as const, value: "org_abc123" }];
```

All members of the organization can access.

### Combined Access (Real Pattern)

From the production `private-emails-documented` workflow header comments:

```typescript
// Real-world example: Company + external auditor
export const metadata = {
  id: "acme-meeting-processor",
  visibility: "private" as const,
  accessGrants: [
    { type: "email_domain" as const, value: "acmecorp.com" }, // Company employees
    { type: "email" as const, value: "auditor@external.com" }, // External auditor
  ],
  // ... other metadata
};
```

### Access Grant Types Reference

| Type           | Value            | Who Gets Access                |
| -------------- | ---------------- | ------------------------------ |
| `email_domain` | `'company.com'`  | Anyone with @company.com email |
| `email`        | `'user@any.com'` | That specific email only       |
| `organization` | `'org_abc123'`   | All WORKWAY org members        |

## BYOO: Bring Your Own OAuth

For clients who need their own API credentials:

```typescript
import { defineWorkflow, webhook } from "@workwayco/sdk";

export default defineWorkflow({
  name: "Enterprise Zoom Sync",
  version: "1.0.0",

  integrations: [
    { service: "zoom", scopes: ["meeting:read", "recording:read"] },
    { service: "notion", scopes: ["read_pages", "write_pages"] },
  ],

  inputs: {
    zoomClientId: {
      type: "text",
      label: "Zoom Client ID",
      required: true,
    },
    zoomClientSecret: {
      type: "text",
      label: "Zoom Client Secret",
      required: true,
    },
    notionApiKey: {
      type: "text",
      label: "Notion API Key",
      required: true,
    },
    notionDatabase: {
      type: "text",
      label: "Notion Database ID",
      required: true,
    },
  },

  trigger: webhook({ service: "zoom", event: "recording.completed" }),

  async execute({ trigger, inputs, integrations }) {
    // Workflow uses client's credentials via BYOO
    // ...
  },
});

export const metadata = {
  id: "enterprise-zoom-sync",
  visibility: "private" as const,
  byoo: {
    enabled: true,
    providers: ["zoom", "notion"],
    instructions: `
      This workflow requires your organization's OAuth credentials.

      1. Create a Zoom Server-to-Server app at marketplace.zoom.us
      2. Create a Notion integration at notion.so/my-integrations
      3. Enter your credentials during setup
    `,
  },
};
```

### When to Use BYOO

- **Enterprise security**: Client requires their own credentials
- **API quotas**: Client has higher limits on their own account
- **Audit requirements**: All API calls must originate from client's credentials
- **Data sovereignty**: Data must only flow through client's accounts

## Private Analytics

Track private workflow usage:

```typescript
metadata: {
  id: 'client-workflow',
  visibility: 'private',

  analytics: {
    enabled: true,
    dashboardUrl: 'https://workway.co/workflows/private/client-workflow/analytics',
    retention: '90d',
    exportEnabled: true,
  },
},
```

Analytics available:

- Execution count
- Success/failure rates
- Average execution time
- Error breakdown
- Usage by user

## Private Workflow URLs

| Purpose   | URL Pattern                                            |
| --------- | ------------------------------------------------------ |
| Install   | `workway.co/workflows/private/{workflow-id}`           |
| Configure | `workway.co/workflows/private/{workflow-id}/configure` |
| Analytics | `workway.co/workflows/private/{workflow-id}/analytics` |
| Logs      | `workway.co/workflows/private/{workflow-id}/logs`      |

Users access via the unified workflows page—no separate dashboard.

## Deployment Pattern

### 1. Develop Locally

```bash
mkdir client-workflow
cd client-workflow
workway init --private
```

### 2. Configure Access

Edit `workway.config.ts`:

```typescript
export default {
  visibility: "private",
  accessGrants: [{ type: "email_domain", value: "clientcorp.com" }],
};
```

### 3. Deploy

```bash
workway deploy
```

### 4. Share with Client

Send them the install link:

```
https://workway.co/workflows/private/client-workflow
```

They'll authenticate, verify access, and configure.

## Client Onboarding

### Setup Flow

```
Client clicks install link
        ↓
Authenticates with WORKWAY
        ↓
System verifies access grant
        ↓
Client connects integrations (or enters BYOO credentials)
        ↓
Client configures workflow options
        ↓
Workflow activates
```

### Custom Setup Pages

For complex configurations:

```typescript
metadata: {
  setupUrl: 'https://client-setup.workway.co/onboard',
},
```

This redirects to your custom setup experience before returning to WORKWAY.

## Versioning Private Workflows

### Semantic Versions

```typescript
metadata: {
  id: 'client-workflow',
  version: '2.1.0',

  changelog: `
    2.1.0 - Added Slack integration
    2.0.0 - Breaking: New config schema
    1.1.0 - Performance improvements
    1.0.0 - Initial release
  `,
},
```

### Gradual Rollouts

```typescript
metadata: {
  version: '2.0.0',

  rollout: {
    strategy: 'gradual',
    percentage: 10,  // 10% of installations get new version
  },
},
```

### Migration Support

When config schema changes:

```typescript
metadata: {
  version: '2.0.0',

  migration: {
    from: '1.x',
    script: async (oldConfig) => {
      return {
        ...oldConfig,
        // Map old fields to new
        newField: oldConfig.deprecatedField || 'default',
      };
    },
  },
},
```

## Security Considerations

### Data Isolation

Private workflows run in isolated environments:

```typescript
async execute({ storage }) {
  // Storage is isolated per workflow per organization
  await storage.put('key', 'value');

  // This key is only accessible by this workflow
  // for this organization
}
```

### Secrets Management

```typescript
inputs: {
  apiKey: {
    type: 'text',
    label: 'API Key',
    required: true,
    // Note: Sensitive inputs are encrypted at rest
    // Never logged, never exposed in responses
  },
},
```

### Audit Logging

Enable for compliance:

```typescript
metadata: {
  audit: {
    enabled: true,
    events: ['execute', 'config_change', 'access_grant'],
    retention: '365d',
  },
},
```

## Complete Example

This example shows the complete private workflow pattern, including all metadata fields used in production workflows:

```typescript
import { defineWorkflow, cron } from "@workwayco/sdk";

// Organization-specific constants (hardcoded for internal workflows)
const INTERNAL_DATABASE_ID = "27a019187ac580b797fec563c98afbbc";
const INTERNAL_DOMAINS = ["acmecorp.com"];

export default defineWorkflow({
  name: "ACME Meeting Processor",
  description:
    "Internal workflow for @acmecorp.com. Meetings sync to central database.",
  version: "1.2.0",

  // Pathway metadata for discovery (optional but recommended)
  pathway: {
    outcomeFrame: "after_meetings",
    outcomeStatement: {
      suggestion: "Want meetings to document themselves?",
      explanation:
        "After every meeting, a Notion page appears with notes and action items.",
      outcome: "Meetings that document themselves",
    },
    zuhandenheit: {
      timeToValue: 5, // Minutes - be honest about setup time
      worksOutOfBox: false, // Requires custom setup
      gracefulDegradation: true,
      automaticTrigger: false,
    },
  },

  pricing: {
    model: "usage",
    pricePerExecution: 0.05,
    freeExecutions: 50,
    description: "Per meeting processed",
  },

  integrations: [
    { service: "zoom", scopes: ["meeting:read"] },
    {
      service: "notion",
      scopes: ["read_pages", "write_pages", "read_databases"],
    },
  ],

  inputs: {
    connectionId: {
      type: "string",
      label: "Connection ID",
      required: true,
      description: "Your unique identifier (set during setup)",
    },
  },

  // Cron trigger - runs every 5 minutes
  trigger: cron({
    schedule: "*/5 * * * *",
    timezone: "UTC",
  }),

  async execute({ inputs, integrations, env }) {
    const startTime = Date.now();

    // Get meetings and process them
    const meetings = await integrations.zoom.listMeetings({ type: "past" });

    for (const meeting of meetings.data || []) {
      // Create Notion page (using hardcoded internal database)
      await integrations.notion.pages.create({
        parent: { database_id: INTERNAL_DATABASE_ID },
        properties: {
          Name: { title: [{ text: { content: meeting.topic } }] },
          Date: { date: { start: meeting.start_time } },
          Type: { select: { name: "Meeting" } },
        },
      });
    }

    console.log("Meetings processed", {
      count: meetings.data?.length || 0,
      executionTimeMs: Date.now() - startTime,
    });

    return {
      success: true,
      processed: meetings.data?.length || 0,
      analyticsUrl:
        "https://workway.co/workflows/private/acme-meeting-processor/analytics",
    };
  },

  onError: async ({ error, inputs }) => {
    console.error(`Workflow failed for ${inputs.connectionId}:`, error);
  },
});

// Private workflow metadata - CRITICAL: This is what makes it private
export const metadata = {
  id: "acme-meeting-processor",
  category: "productivity",
  featured: false,

  // REQUIRED for private workflows
  visibility: "private" as const,
  accessGrants: [
    { type: "email_domain" as const, value: "acmecorp.com" },
    { type: "email" as const, value: "auditor@external.com" },
  ],

  // Honest flags about requirements
  experimental: true,
  requiresCustomInfrastructure: true,
  canonicalAlternative: "meeting-intelligence", // Public version

  // Why this private version exists
  workaroundReason: "Organization requires internal database and custom auth",
  infrastructureRequired: ["BYOO OAuth app", "Internal Notion database"],

  // Upgrade path when no longer needed
  upgradeTarget: "meeting-intelligence",
  upgradeCondition: "When org approves shared infrastructure",

  // URLs for the unified workflows page
  analyticsUrl:
    "https://workway.co/workflows/private/acme-meeting-processor/analytics",
  setupUrl: "https://acme-setup.workway.co/setup",

  stats: { rating: 0, users: 0, reviews: 0 },
};
```

### Key Metadata Fields Explained

| Field                          | Purpose                               | Required    |
| ------------------------------ | ------------------------------------- | ----------- |
| `visibility: 'private'`        | Hides from marketplace, requires auth | Yes         |
| `accessGrants`                 | Who can install                       | Yes         |
| `experimental`                 | Honest flag about stability           | Recommended |
| `requiresCustomInfrastructure` | Needs non-standard setup              | Recommended |
| `canonicalAlternative`         | Points to public version              | Recommended |
| `workaroundReason`             | Documents why private exists          | Recommended |
| `upgradeTarget`                | Public version to migrate to          | Recommended |
| `analyticsUrl`                 | Dashboard URL                         | Optional    |
| `setupUrl`                     | Custom setup page                     | Optional    |

## Praxis

Design a private workflow for your organization or a client:

> **Praxis**: Ask Claude Code: "Help me create a private workflow with access controls for [organization/client]"

Create the complete private workflow metadata with all recommended fields:

```typescript
// Your private workflow metadata
export const metadata = {
  id: "my-private-workflow",
  category: "productivity",
  featured: false,

  // REQUIRED: Private visibility
  visibility: "private" as const,

  // REQUIRED: Who can access
  accessGrants: [
    { type: "email_domain" as const, value: "yourcompany.com" },
    { type: "email" as const, value: "external-contractor@example.com" },
  ],

  // RECOMMENDED: Honest flags
  experimental: true,
  requiresCustomInfrastructure: true,
  canonicalAlternative: "public-workflow-id",

  // RECOMMENDED: Document why this exists
  workaroundReason: "Describe why private version is needed",
  infrastructureRequired: ["List", "of", "requirements"],

  // RECOMMENDED: Upgrade path
  upgradeTarget: "public-workflow-id",
  upgradeCondition: "When X condition is met",

  // OPTIONAL: URLs
  analyticsUrl:
    "https://workway.co/workflows/private/my-private-workflow/analytics",
  setupUrl: "https://your-worker.workway.co/setup",

  stats: { rating: 0, users: 0, reviews: 0 },
};
```

Walk through the deployment and onboarding:

1. **Deploy**: `workway deploy`
2. **Share install link**: `https://workway.co/workflows/private/my-private-workflow`
3. **Verify access**: Test with an authorized email
4. **Configure**: Connect integrations and set options
5. **Monitor**: Check analytics dashboard

### Validation Checklist

Your praxis will be validated for these patterns:

- [ ] `visibility: 'private' as const` - TypeScript literal type
- [ ] `accessGrants` array with at least one grant
- [ ] `type: 'email_domain' as const` or `type: 'email' as const` patterns
- [ ] Honest flags (`experimental`, `requiresCustomInfrastructure`)
- [ ] Upgrade path documented (`canonicalAlternative`, `upgradeTarget`)

## Reflection

- What workflows in your organization should be private?
- How does BYOO change the trust model with clients?
- What audit requirements do your clients have?
- When would you use `email_domain` vs `email` vs `organization` grants?
