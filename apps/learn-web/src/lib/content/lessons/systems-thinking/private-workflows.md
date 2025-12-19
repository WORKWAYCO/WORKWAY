# Private Workflows

Not every workflow belongs in the marketplace. Private workflows serve specific organizations with custom requirements while leveraging the full WORKWAY platform.

## Public vs. Private

| Aspect | Public Workflow | Private Workflow |
|--------|-----------------|------------------|
| Visibility | Marketplace listing | Organization only |
| Access | Anyone can install | Authorized users only |
| Discovery | Searchable | Hidden from search |
| Pricing | Per-execution fees | Custom arrangements |
| Customization | Config options only | Full customization |

## When to Build Private

Private workflows make sense when:

- **Proprietary process**: Your competitive advantage shouldn't be public
- **Client-specific**: Built for a specific organization's needs
- **Sensitive data**: Handles data that shouldn't touch shared infrastructure
- **Custom integrations**: Uses internal APIs or systems
- **Compliance**: Requires audit trails or specific controls

## Defining Private Workflows

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Client CRM Sync',
  description: 'Syncs meeting data to internal CRM',
  version: '1.0.0',

  integrations: [
    { service: 'zoom', scopes: ['meeting:read'] },
  ],

  inputs: {
    crmEndpoint: { type: 'text', label: 'CRM API Endpoint', required: true },
  },

  trigger: webhook({
    service: 'zoom',
    event: 'meeting.ended',
  }),

  async execute({ trigger, inputs, integrations }) {
    // ... workflow logic
  },
});

// Private workflow metadata is exported separately
export const metadata = {
  id: 'client-crm-sync',
  visibility: 'private' as const,
  accessGrants: [
    { type: 'email_domain' as const, value: 'acmecorp.com' },
    { type: 'email' as const, value: 'contractor@external.com' },
    { type: 'organization' as const, value: 'org_123' },
  ],
};
```

## Access Control

### Email Domain

Allow anyone from a company domain:

```typescript
accessGrants: [
  { type: 'email_domain', value: 'acmecorp.com' },
]
```

Anyone with `@acmecorp.com` email can install and use the workflow.

### Specific Emails

Grant access to specific individuals:

```typescript
accessGrants: [
  { type: 'email', value: 'alice@example.com' },
  { type: 'email', value: 'bob@contractor.io' },
]
```

### Organization ID

Link to WORKWAY organization:

```typescript
accessGrants: [
  { type: 'organization', value: 'org_abc123' },
]
```

All members of the organization can access.

### Combined Access

```typescript
accessGrants: [
  { type: 'email_domain', value: 'acmecorp.com' },     // Company employees
  { type: 'email', value: 'auditor@pwc.com' },         // External auditor
  { type: 'organization', value: 'org_partner123' },   // Partner org
]
```

## BYOO: Bring Your Own OAuth

For clients who need their own API credentials:

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Enterprise Zoom Sync',
  version: '1.0.0',

  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
    { service: 'notion', scopes: ['read_pages', 'write_pages'] },
  ],

  inputs: {
    zoomClientId: {
      type: 'text',
      label: 'Zoom Client ID',
      required: true,
    },
    zoomClientSecret: {
      type: 'text',
      label: 'Zoom Client Secret',
      required: true,
    },
    notionApiKey: {
      type: 'text',
      label: 'Notion API Key',
      required: true,
    },
    notionDatabase: {
      type: 'text',
      label: 'Notion Database ID',
      required: true,
    },
  },

  trigger: webhook({ service: 'zoom', event: 'recording.completed' }),

  async execute({ trigger, inputs, integrations }) {
    // Workflow uses client's credentials via BYOO
    // ...
  },
});

export const metadata = {
  id: 'enterprise-zoom-sync',
  visibility: 'private' as const,
  byoo: {
    enabled: true,
    providers: ['zoom', 'notion'],
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

| Purpose | URL Pattern |
|---------|-------------|
| Install | `workway.co/workflows/private/{workflow-id}` |
| Configure | `workway.co/workflows/private/{workflow-id}/configure` |
| Analytics | `workway.co/workflows/private/{workflow-id}/analytics` |
| Logs | `workway.co/workflows/private/{workflow-id}/logs` |

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
  visibility: 'private',
  accessGrants: [
    { type: 'email_domain', value: 'clientcorp.com' },
  ],
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

```typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'ACME Meeting Processor',
  description: 'Process meetings for ACME Corp with custom CRM sync',
  version: '1.2.0',

  integrations: [
    { service: 'zoom', scopes: ['meeting:read'] },
    { service: 'notion', scopes: ['read_pages', 'write_pages'], optional: true },
  ],

  inputs: {
    crmEndpoint: {
      type: 'text',
      label: 'Internal CRM API Endpoint',
      required: true,
    },
    crmApiKey: {
      type: 'text',
      label: 'CRM API Key',
      required: true,
    },
    notionDatabase: {
      type: 'text',
      label: 'Backup Database ID',
      description: 'Optional: Notion database for backup',
    },
  },

  trigger: webhook({
    service: 'zoom',
    event: 'meeting.ended',
  }),

  async execute({ trigger, inputs, integrations }) {
    const { zoom, notion } = integrations;

    const meetingResult = await zoom.getMeeting(trigger.data.object.id);
    const meeting = meetingResult.data;

    // Sync to internal CRM
    await fetch(inputs.crmEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${inputs.crmApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meetingId: meeting.id,
        topic: meeting.topic,
        duration: meeting.duration,
        date: meeting.start_time,
      }),
    });

    // Backup to Notion if configured
    if (inputs.notionDatabase) {
      await notion.pages.create({
        parent: { database_id: inputs.notionDatabase },
        properties: {
          Name: { title: [{ text: { content: meeting.topic } }] },
        },
      });
    }

    console.log('Meeting processed', {
      meetingId: meeting.id,
      crmSynced: true,
      notionBackup: !!inputs.notionDatabase,
    });

    return { success: true };
  },
});

// Private workflow metadata
export const metadata = {
  id: 'acme-meeting-processor',
  visibility: 'private' as const,
  accessGrants: [
    { type: 'email_domain' as const, value: 'acmecorp.com' },
    { type: 'email' as const, value: 'auditor@external.com' },
  ],
  byoo: {
    enabled: true,
    providers: ['zoom'],
    instructions: 'Use your corporate Zoom OAuth app.',
  },
  analyticsUrl: 'https://workway.co/workflows/private/acme-meeting-processor/analytics',
};
```

## Praxis

Design a private workflow for your organization or a client:

> **Praxis**: Ask Claude Code: "Help me create a private workflow with access controls for [organization/client]"

Define the access and security model:

```typescript
metadata: {
  id: 'my-private-workflow',
  visibility: 'private',

  accessGrants: [
    { type: 'email_domain', value: 'yourcompany.com' },
    { type: 'email', value: 'external-contractor@example.com' },
  ],

  analytics: {
    enabled: true,
    retention: '90d',
  },

  audit: {
    enabled: true,
    events: ['execute', 'config_change'],
    retention: '365d',
  },
},
```

Walk through the deployment and onboarding:

1. **Deploy**: `workway deploy`
2. **Share install link**: `https://workway.co/workflows/private/my-private-workflow`
3. **Verify access**: Test with an authorized email
4. **Configure**: Connect integrations and set options
5. **Monitor**: Check analytics dashboard

## Reflection

- What workflows in your organization should be private?
- How does BYOO change the trust model with clients?
- What audit requirements do your clients have?
