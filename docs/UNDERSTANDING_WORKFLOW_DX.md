# Understanding: WORKWAY Workflow Development

> **A workflow is not a program you write—it is a dwelling you inhabit.**

## Ontological Position

**Mode of Being**: The workflow developer exists in a unique phenomenological state—*thrown* into the space between APIs, where meaning emerges through connection.

In Heideggerian terms, WORKWAY workflows embody **Zuhandenheit** (ready-to-hand): the integrations, AI models, and storage systems should recede from consciousness, becoming transparent extensions of intent. When a developer thinks "send a Slack message," the OAuth, API calls, and error handling should be *invisible*—tools that work without demanding attention.

When the DX fails, we experience **Vorhandenheit** (present-at-hand): the tool becomes an obstacle, a thing to be studied rather than used. Every error message, missing import, or unclear concept is a moment where the tool *breaks* into visibility.

## The Hermeneutic Circle of Workflow Understanding

```
                    ┌─────────────────────────────────┐
                    │                                 │
                    ▼                                 │
          workway workflow init                      │
                    │                                 │
                    ▼                                 │
          Encounter the structure                    │
          (workflow.ts, triggers, actions)           │
                    │                                 │
                    ▼                                 │
          workway workflow dev                       │
          (Execute, observe, fail)                   │
                    │                                 │
                    ▼                                 │
          Deeper understanding ──────────────────────┘
          (Return to structure with new eyes)
                    │
                    ▼
          workway workflow publish
          (Workflow becomes part of the world)
```

---

## Depends On (Understanding-Critical)

| Dependency | Why It Matters |
|------------|----------------|
| `@workwayco/sdk` | Provides the vocabulary: `defineWorkflow`, `ActionResult<T>`, triggers |
| `Cloudflare Workers` | The runtime environment—understanding Workers clarifies constraints |
| `OAuth Concepts` | Workflows connect services; OAuth is the handshake |
| `TypeScript` | Type safety prevents tools from breaking into visibility |

## Enables Understanding Of

| Consumer | What This Package Clarifies |
|----------|----------------------------|
| Integrations | How services become actions within workflows |
| AI Capabilities | How Workers AI becomes a workflow primitive |
| Marketplace | How workflows become products |
| The Hermeneutic Ecosystem | How .ltd/.io/.space/.agency relate |

---

## The Developer Experience Journey

### Phase 1: Geworfenheit (Thrownness)

You are *thrown* into the workflow world. Begin:

```bash
# Install the CLI (your primary tool)
npm install -g @workwayco/cli

# Authenticate (establish your Dasein)
workway login

# Connect to the services you'll use
workway oauth connect gmail
workway oauth connect notion
workway oauth connect slack
```

### Phase 2: The First Encounter

```bash
# Create your dwelling
workway workflow init my-first-workflow

# Or with AI capabilities
workway workflow init --ai my-ai-workflow
```

This generates:

```
my-first-workflow/
├── workflow.ts          → Your primary concern
├── workway.json         → Configuration (recedes from attention)
├── package.json         → Dependencies (recedes from attention)
└── tsconfig.json        → TypeScript config (recedes from attention)
```

### Phase 3: Understanding the Structure

**workflow.ts** — The dwelling you inhabit:

```typescript
import { defineWorkflow, webhook, schedule, manual } from '@workwayco/sdk';

export default defineWorkflow({
  // Identity
  name: 'My Workflow',
  description: 'What this workflow does',
  version: '1.0.0',

  // Required integrations (OAuth connections)
  integrations: ['gmail', 'notion'],

  // User configuration (their inputs)
  inputs: {
    notionDatabase: {
      type: 'notion-database',
      label: 'Where to save results',
      required: true
    }
  },

  // When does this run?
  trigger: webhook({ service: 'gmail', event: 'new-email' }),
  // Or: schedule('0 8 * * *')  — daily at 8am
  // Or: manual()               — user clicks "Run"

  // Pricing (how you monetize)
  pricing: {
    model: 'subscription',
    price: 10,
    executions: 100
  },

  // The dwelling itself
  async execute({ trigger, inputs, integrations, ai, log }) {
    // Your logic lives here
    // Everything else recedes
  }
});
```

### Phase 4: Zuhandenheit (Ready-to-hand) — When It Works

```typescript
async execute({ trigger, inputs, integrations, ai }) {
  // Gmail recedes — you just "get emails"
  const emails = await integrations.gmail.listEmails({
    query: 'is:unread',
    maxResults: 10
  });

  // AI recedes — you just "understand content"
  const summary = await ai.textGeneration({
    model: 'LLAMA_3_8B',
    prompt: `Summarize: ${emails[0].body}`
  });

  // Notion recedes — you just "save knowledge"
  await integrations.notion.createPage({
    database: inputs.notionDatabase,
    properties: {
      Title: summary.title,
      Summary: summary.content
    }
  });

  return { success: true, processed: emails.length };
}
```

### Phase 5: Vorhandenheit (Present-at-hand) — When It Breaks

When tools break, they demand attention. Common breakage points:

| Symptom | What Broke Into Visibility | Resolution |
|---------|---------------------------|------------|
| `OAuth token expired` | Authentication layer | `workway oauth connect [provider]` |
| `ActionResult.error` | API constraint | Check integration docs, add error handling |
| `Type error` | Type system protecting you | Read the error—it's teaching you |
| `Rate limit exceeded` | API economics | Add caching, reduce frequency |

### Phase 6: Dwelling in Development

```bash
# Live development (hot reload)
workway workflow dev

# Test with mocked integrations
workway workflow test --mock

# Test with live OAuth (real API calls)
workway workflow test --live

# Build for production
workway workflow build
```

### Phase 7: Publishing (Workflow Enters the World)

```bash
workway workflow publish
```

Your workflow becomes available in the marketplace. Others can install it, configure it, and run it. The cycle completes.

---

## Available Integrations

| Integration | What It Enables | Triggers | Key Actions |
|-------------|-----------------|----------|-------------|
| **Gmail** | Email processing | `new-email` (Phase 2) | `listEmails`, `sendEmail`, `searchEmails` |
| **Slack** | Team messaging | — | `sendMessage`, `listChannels`, `searchMessages` |
| **Notion** | Knowledge management | `database-updated` (Phase 2) | `createPage`, `queryDatabase`, `updatePage` |
| **Google Sheets** | Spreadsheet data | — | `getValues`, `updateValues`, `appendValues` |
| **Airtable** | Database records | — | `listRecords`, `createRecord`, `batchCreate` |
| **Stripe** | Payments | `payment_intent.succeeded` (Phase 2) | `createPaymentIntent`, `createSubscription` |
| **Workers AI** | Intelligence | — | `textGeneration`, `embeddings`, `imageGeneration` |

---

## To Understand Workflow Development, Read

1. **`packages/sdk/src/workflow-sdk.ts`** — The `defineWorkflow` function and core types
2. **`examples/ai-email-assistant/workflow.ts`** — A complete, working example
3. **`packages/integrations/src/gmail/index.ts`** — How integrations expose actions
4. **`packages/sdk/src/action-result.ts`** — The `ActionResult<T>` pattern

---

## Key Concepts

| Concept | Definition | Where to Find |
|---------|------------|---------------|
| `defineWorkflow` | The function that creates a workflow definition | `workflow-sdk.ts` |
| `ActionResult<T>` | Envelope for all action responses (success/error) | `action-result.ts` |
| `Trigger` | When the workflow runs (webhook, schedule, manual) | `workflow-sdk.ts` |
| `Inputs` | User configuration schema | `workflow-sdk.ts` |
| `Integrations` | OAuth-authenticated service clients | `integration-sdk.ts` |

---

## Common Tasks

| Task | Start Here |
|------|------------|
| Create new workflow | `workway workflow init [name]` |
| Connect OAuth service | `workway oauth connect [provider]` |
| Test locally | `workway workflow dev` |
| Publish to marketplace | `workway workflow publish` |
| View logs | `workway logs --follow` |
| Check AI costs | `workway ai estimate` |

---

## This Package Helps You Understand

- **The Hermeneutic Circle**: Each run deepens understanding
- **Zuhandenheit**: When tools recede, you dwell in creation
- **Vorhandenheit**: Breakage is an opportunity to learn
- **Geworfenheit**: You are always already in the workflow context

---

*Last validated: 2025-12-03*
