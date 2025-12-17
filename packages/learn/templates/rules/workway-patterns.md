# WORKWAY Patterns

Rules for Claude Code when building WORKWAY workflows.

## Workflow Structure

Always use `defineWorkflow()`:

```typescript
import { defineWorkflow } from '@workwayco/sdk';

export default defineWorkflow({
  id: 'my-workflow',
  name: 'My Workflow',
  description: 'What this achieves (outcome, not mechanism)',

  integrations: ['gmail', 'notion'],

  triggers: {
    type: 'webhook',
    events: ['email.received']
  },

  configSchema: {
    inputs: [
      {
        id: 'label',
        type: 'text',
        label: 'Gmail label',
        default: 'INBOX'
      }
    ]
  },

  async execute({ config, integrations }) {
    // Implementation
  }
});
```

## Zuhandenheit Checklist

Before committing:

- [ ] Name describes outcome, not mechanism
- [ ] Has sensible defaults
- [ ] Fails gracefully
- [ ] Users won't think about it when working

## Naming

**Good**: "After Meeting Follow-up"
**Bad**: "Zoom-to-Notion API Sync"

The name should describe what disappears from the user's to-do list.

## Error Handling

Always include error handling:

```typescript
onError: async ({ error, context }) => {
  // Notify user
  await context.integrations.slack.postMessage({
    channel: config.alertChannel,
    text: `⚠️ Issue: ${error.message}`
  });
}
```

## Integrations

Use the integrations parameter, not raw `fetch()`:

```typescript
// Good
const emails = await integrations.gmail.listMessages({ labelIds: ['STARRED'] });

// Avoid
const response = await fetch('https://gmail.googleapis.com/...');
```

## Configuration

Prefer sensible defaults:

```typescript
{
  id: 'syncInterval',
  type: 'number',
  label: 'Sync interval (minutes)',
  default: 15,  // Most users want this
  description: 'How often to check for new items'
}
```
