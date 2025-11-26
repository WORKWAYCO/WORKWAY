# @workway/sdk

The official SDK for building WORKWAY workflows.

## Installation

```bash
npm install @workway/sdk
```

## Quick Start

### Integration Workflow (No AI - Most Common)

```typescript
import { defineWorkflow, webhook } from '@workway/sdk'

// Simple, profitable, high-margin integration
export default defineWorkflow({
  name: 'Stripe to Notion Invoice Tracker',
  type: 'integration', // ← Runs on Cloudflare, costs ~$0.001/execution
  pricing: { model: 'subscription', price: 5, executions: 'unlimited' },

  integrations: [
    { service: 'stripe', scopes: ['read_payments'] },
    { service: 'notion', scopes: ['write_pages'] }
  ],

  inputs: {
    notionDatabaseId: { type: 'notion_database_picker', required: true }
  },

  trigger: webhook({ service: 'stripe', event: 'payment_intent.succeeded' }),

  async execute({ trigger, inputs, integrations }) {
    const payment = trigger.data.object

    // Pure business logic - no AI costs
    await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        'Amount': { number: payment.amount / 100 },
        'Customer': { email: payment.receipt_email },
        'Date': { date: { start: new Date().toISOString() } }
      }
    })

    return { success: true }
  }
})
```

**Cost:** $0.001/execution | **Margin:** 98% | **Your earnings:** $3.50/mo per user

---

### AI-Enhanced Workflow (Selective AI Use)

```typescript
import { defineWorkflow, webhook, ai } from '@workway/sdk'

// Integration + strategic AI for categorization
export default defineWorkflow({
  name: 'Smart Support Ticket Router',
  type: 'ai-enhanced', // ← Auto-optimizes AI usage
  pricing: { model: 'subscription', price: 15, executions: 200 },

  integrations: [
    { service: 'zendesk', scopes: ['read_tickets', 'update_tickets'] },
    { service: 'slack', scopes: ['send_messages'] }
  ],

  inputs: {
    teams: {
      type: 'array',
      items: { name: 'string', slackChannel: 'string' }
    }
  },

  trigger: webhook({ service: 'zendesk', event: 'ticket.created' }),

  async execute({ trigger, inputs, integrations }) {
    const ticket = trigger.data.ticket

    // Strategic AI use - only where needed
    const category = await ai.completion({
      model: 'claude-haiku', // Cheapest model for simple task
      systemPrompt: `Classify ticket into: ${inputs.teams.map(t => t.name).join(', ')}`,
      prompt: `${ticket.subject}\n${ticket.description}`,
      maxTokens: 20,
      cache: true // ← SDK auto-caches similar prompts
    })

    // Rest is pure business logic
    const team = inputs.teams.find(t => t.name === category) || inputs.teams[0]

    await integrations.zendesk.tickets.update(ticket.id, {
      tags: [team.name.toLowerCase()]
    })

    await integrations.slack.chat.postMessage({
      channel: team.slackChannel,
      text: `New ${team.name} ticket: ${ticket.subject}`
    })

    return { success: true, category: team.name }
  }
})
```

**Cost:** $0.008/execution | **Margin:** 85% | **Your earnings:** $8.40/mo per user

---

### AI-Native Workflow (Heavy AI Use)

```typescript
import { defineWorkflow, schedule, ai, http } from '@workway/sdk'

// Multiple AI steps - needs optimization
export default defineWorkflow({
  name: 'Daily AI Newsletter',
  type: 'ai-native', // ← SDK applies all optimizations
  pricing: { model: 'subscription', price: 25, executions: 30 },

  inputs: {
    topics: { type: 'array', default: ['AI', 'startups'] },
    email: { type: 'email', required: true }
  },

  trigger: schedule('0 8 * * *'),

  async execute({ inputs, cache }) {
    // Step 1: Research (caching helps here)
    const cacheKey = `research_${inputs.topics.join('_')}_${new Date().toDateString()}`
    let research = await cache.get(cacheKey)

    if (!research) {
      research = await ai.completion({
        model: 'claude-sonnet-4', // SDK auto-routes to cheapest provider
        prompt: `Research latest in: ${inputs.topics.join(', ')}`,
        maxTokens: 2000,
        routing: 'cost-optimized' // ← Let SDK choose provider
      })
      await cache.set(cacheKey, research, { ttl: 3600 }) // 1 hour
    }

    // Step 2: Generate newsletter
    const newsletter = await ai.completion({
      model: 'gpt-4o',
      systemPrompt: 'You are a newsletter writer',
      prompt: `Write newsletter based on:\n\n${research}`,
      maxTokens: 1500,
      routing: 'quality-optimized' // ← Best quality for content
    })

    // Step 3: Send email (no AI cost)
    await http.post('https://api.sendgrid.com/v3/mail/send', {
      headers: { 'Authorization': `Bearer ${process.env.SENDGRID_KEY}` },
      body: {
        to: inputs.email,
        subject: `Your Daily ${inputs.topics[0]} Update`,
        html: newsletter
      }
    })

    return { success: true }
  }
})
```

**Cost:** $0.15/execution (with caching) | **Margin:** 82% | **Your earnings:** $14.70/mo per user

---

## Workflow Types

The SDK automatically optimizes based on workflow type:

### `type: 'integration'` (70% of marketplace)
- **Runtime:** Cloudflare Workers
- **Cost:** $0.001-0.01/execution
- **Best for:** API-to-API workflows, data sync, webhooks
- **Examples:** Stripe→Notion, Airtable→Calendar, GitHub→Slack

### `type: 'ai-enhanced'` (20% of marketplace)
- **Runtime:** Cloudflare Workers + Smart AI routing
- **Cost:** $0.01-0.10/execution
- **Best for:** Workflows with 1-2 AI calls for categorization/analysis
- **Examples:** Email categorization, sentiment analysis, smart routing

### `type: 'ai-native'` (10% of marketplace)
- **Runtime:** Multi-provider AI routing + aggressive caching
- **Cost:** $0.10-2.00/execution (optimized from $0.50-5.00)
- **Best for:** Content generation, research, multi-step AI pipelines
- **Examples:** Newsletter generation, research assistants, content creators

---

## Core Concepts

### 1. Integrations

Pre-built connectors for popular services:

```typescript
integrations: [
  {
    service: 'stripe',
    scopes: ['read_payments', 'read_customers'],
    description: 'Read payment and customer data'
  },
  {
    service: 'notion',
    scopes: ['write_pages', 'read_databases'],
    description: 'Create and read Notion pages'
  }
]
```

**Available integrations:**
- **Payment:** Stripe, PayPal, Square
- **Productivity:** Notion, Airtable, Google Workspace
- **Communication:** Slack, Discord, Telegram
- **CRM:** HubSpot, Salesforce, Pipedrive
- **Email:** SendGrid, Resend, Mailchimp
- **Development:** GitHub, GitLab, Linear

### 2. Triggers

How workflows are executed:

```typescript
// Webhook trigger (instant)
trigger: webhook({
  service: 'stripe',
  event: 'payment_intent.succeeded'
})

// Schedule trigger (cron)
trigger: schedule('0 8 * * *') // Daily at 8am

// Manual trigger (user clicks button)
trigger: manual()

// Polling trigger (check for new data)
trigger: poll({
  service: 'airtable',
  interval: '15m', // Every 15 minutes
  query: 'filterByFormula=...'
})
```

### 3. Inputs (User Configuration)

```typescript
inputs: {
  // Text input
  projectName: {
    type: 'text',
    label: 'Project Name',
    required: true,
    placeholder: 'My Project'
  },

  // Number input
  maxItems: {
    type: 'number',
    label: 'Maximum Items',
    min: 1,
    max: 100,
    default: 10
  },

  // Select dropdown
  priority: {
    type: 'select',
    label: 'Priority Level',
    options: ['low', 'medium', 'high'],
    default: 'medium'
  },

  // Boolean checkbox
  sendNotifications: {
    type: 'boolean',
    label: 'Send Notifications',
    default: true
  },

  // Array input
  tags: {
    type: 'array',
    label: 'Tags',
    itemType: 'text',
    default: []
  },

  // Service-specific pickers
  notionDatabase: {
    type: 'notion_database_picker',
    label: 'Notion Database',
    required: true
  },

  slackChannel: {
    type: 'slack_channel_picker',
    label: 'Slack Channel',
    required: true
  }
}
```

### 4. Pricing Models

```typescript
// Subscription (most common)
pricing: {
  model: 'subscription',
  price: 10,
  executions: 100 // per month
}

// Usage-based
pricing: {
  model: 'usage',
  pricePerExecution: 0.10,
  minPrice: 5 // Minimum monthly charge
}

// One-time
pricing: {
  model: 'one-time',
  price: 29
}

// Tiered pricing
pricing: {
  model: 'subscription',
  tiers: [
    { name: 'starter', price: 10, executions: 50 },
    { name: 'pro', price: 25, executions: 200 },
    { name: 'enterprise', price: 99, executions: 1000 }
  ]
}
```

---

## SDK APIs

### Workers AI Module (Cloudflare-Native)

For workflows running on Cloudflare Workers, use the native Workers AI integration — no API keys required.

```typescript
import { createAIClient, AIModels } from '@workway/sdk/workers-ai'

export default defineWorkflow({
  name: 'AI Email Processor',
  type: 'ai-native',

  async execute({ env }) {
    // Create AI client from Cloudflare binding
    const ai = createAIClient(env)

    // Text generation
    const result = await ai.generateText({
      prompt: 'Summarize this email...',
      model: AIModels.LLAMA_3_8B,  // $0.01/1M tokens
      max_tokens: 512,
      temperature: 0.7
    })

    return { summary: result.data }
  }
})
```

#### Available Models

| Model | Alias | Cost/1M | Best For |
|-------|-------|---------|----------|
| Llama 2 7B | `AIModels.LLAMA_2_7B` | $0.005 | Fast, simple tasks |
| Llama 3 8B | `AIModels.LLAMA_3_8B` | $0.01 | Balanced (default) |
| Mistral 7B | `AIModels.MISTRAL_7B` | $0.02 | Complex reasoning |
| BGE Small | `AIModels.BGE_SMALL` | $0.001 | Fast embeddings |
| BGE Base | `AIModels.BGE_BASE` | $0.002 | Quality embeddings |
| Stable Diffusion XL | `AIModels.STABLE_DIFFUSION_XL` | $0.02/img | Image generation |
| Whisper | `AIModels.WHISPER` | $0.006/min | Speech-to-text |

#### Workers AI Methods

```typescript
const ai = createAIClient(env)

// Text generation
const text = await ai.generateText({
  prompt: string,
  model?: string,        // Default: LLAMA_3_8B
  temperature?: number,  // Default: 0.7
  max_tokens?: number,   // Default: 1024
  system?: string,       // System prompt
  cache?: boolean        // Enable caching
})

// Embeddings (for semantic search)
const embeddings = await ai.generateEmbeddings({
  text: string | string[],
  model?: string  // Default: BGE_BASE
})

// Image generation
const image = await ai.generateImage({
  prompt: string,
  model?: string,         // Default: STABLE_DIFFUSION_XL
  negative_prompt?: string,
  width?: number,         // Default: 1024
  height?: number         // Default: 1024
})

// Speech-to-text
const transcript = await ai.transcribeAudio({
  audio: ArrayBuffer,
  model?: string,   // Default: WHISPER
  language?: string
})

// Translation (100+ languages)
const translated = await ai.translateText({
  text: string,
  source: string,  // e.g., 'en'
  target: string   // e.g., 'es'
})

// Sentiment analysis
const sentiment = await ai.analyzeSentiment({
  text: string
})
// Returns: { sentiment: 'POSITIVE' | 'NEGATIVE', confidence: number }

// Streaming responses
for await (const chunk of ai.streamText({ prompt: '...' })) {
  console.log(chunk)
}

// Chain multiple operations
const results = await ai.chain([
  { type: 'text', options: { prompt: 'Analyze...' } },
  { type: 'sentiment', options: { usePrevious: true } },
  { type: 'translate', options: { source: 'en', target: 'es', usePrevious: true } }
])
```

#### Workers AI vs External Providers

| Feature | Workers AI | OpenAI/Anthropic |
|---------|-----------|------------------|
| API Keys | None required | Required |
| Cost | $0.01/1M tokens | $0.15-3/1M tokens |
| Latency | Edge (fast) | Variable |
| Data | Stays in Cloudflare | Leaves network |
| Models | Open source (Llama, Mistral) | Proprietary |

**When to use Workers AI:**
- High-volume, cost-sensitive workflows
- Privacy-sensitive data (no external API calls)
- Simple-to-moderate AI tasks

**When to use external providers:**
- Complex reasoning requiring GPT-4/Claude
- Specific model capabilities (vision, etc.)

---

### AI Module (Multi-Provider)

```typescript
import { ai } from '@workway/sdk'

// Text completion
const response = await ai.completion({
  model: 'claude-sonnet-4' | 'gpt-4o' | 'gemini-1.5-pro',
  prompt: string,
  systemPrompt?: string,
  maxTokens?: number,
  temperature?: number,
  routing?: 'cost-optimized' | 'quality-optimized' | 'speed-optimized',
  cache?: boolean
})

// Streaming completion
const stream = await ai.completionStream({
  model: 'gpt-4o',
  prompt: 'Write a long story...'
})

for await (const chunk of stream) {
  console.log(chunk)
}

// Embeddings
const embeddings = await ai.embed({
  model: 'text-embedding-3-small',
  text: string | string[]
})

// Image generation
const image = await ai.generateImage({
  model: 'dall-e-3',
  prompt: string,
  size: '1024x1024' | '1792x1024' | '1024x1792'
})
```

### HTTP Module

```typescript
import { http } from '@workway/sdk'

// GET request
const data = await http.get(url, {
  headers?: Record<string, string>,
  query?: Record<string, string>
})

// POST request
const result = await http.post(url, {
  headers?: Record<string, string>,
  body?: any,
  retry?: { attempts: 3, backoff: 'exponential' }
})

// Other methods
await http.put(url, options)
await http.patch(url, options)
await http.delete(url, options)
```

### Cache Module

```typescript
import { cache } from '@workway/sdk'

// Set cache entry
await cache.set(key, value, {
  ttl?: number, // seconds
  tags?: string[]
})

// Get cache entry
const value = await cache.get(key)

// Delete cache entry
await cache.delete(key)

// Invalidate by tags
await cache.invalidateByTags(['user_123', 'posts'])
```

### Storage Module

```typescript
import { storage } from '@workway/sdk'

// Key-value storage
await storage.set(key, value)
const value = await storage.get(key)
await storage.delete(key)

// List keys
const keys = await storage.list({ prefix: 'user_' })

// File upload
await storage.uploadFile(filename, buffer, {
  contentType: 'application/pdf'
})

// File download
const buffer = await storage.downloadFile(filename)
```

### Transform Module

```typescript
import { transform } from '@workway/sdk'

// Array operations
const filtered = transform.filter(array, predicate)
const mapped = transform.map(array, mapper)
const reduced = transform.reduce(array, reducer, initial)

// Data parsing
const json = transform.parseJSON(string)
const csv = transform.parseCSV(string)
const xml = transform.parseXML(string)

// Date formatting
const formatted = transform.formatDate(date, 'YYYY-MM-DD')
const relative = transform.relativeTime(date) // "2 hours ago"

// String operations
const slug = transform.slugify('Hello World') // "hello-world"
const truncated = transform.truncate(text, 100)
const sanitized = transform.sanitize(html)
```

---

## Execution Context

Every workflow receives a context object:

```typescript
interface ExecutionContext {
  // User inputs
  inputs: Record<string, any>

  // Trigger data
  trigger: {
    type: 'webhook' | 'schedule' | 'manual' | 'poll'
    data?: any
  }

  // Connected integrations
  integrations: {
    [service: string]: ServiceClient
  }

  // User secrets (encrypted)
  secrets: Record<string, string>

  // Execution metadata
  executionId: string
  userId: string
  workflowId: string

  // State management
  state: {
    get(key: string): Promise<any>
    set(key: string, value: any): Promise<void>
    delete(key: string): Promise<void>
  }

  // Caching
  cache: {
    get(key: string): Promise<any>
    set(key: string, value: any, options?: CacheOptions): Promise<void>
    delete(key: string): Promise<void>
  }

  // Logging
  log: {
    info(message: string, data?: any): void
    warn(message: string, data?: any): void
    error(message: string, data?: any): void
  }
}
```

---

## Examples

### Example 1: Google Forms → Notion Database

```typescript
export default defineWorkflow({
  name: 'Google Forms to Notion',
  type: 'integration',
  pricing: { model: 'subscription', price: 5, executions: 'unlimited' },

  integrations: [
    { service: 'google_forms', scopes: ['read_responses'] },
    { service: 'notion', scopes: ['write_pages'] }
  ],

  inputs: {
    formId: { type: 'google_form_picker', required: true },
    notionDb: { type: 'notion_database_picker', required: true }
  },

  trigger: webhook({ service: 'google_forms', event: 'form_response' }),

  async execute({ trigger, inputs, integrations }) {
    const response = trigger.data

    await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDb },
      properties: {
        'Name': { title: [{ text: { content: response.answers.name } }] },
        'Email': { email: response.answers.email },
        'Submitted': { date: { start: new Date().toISOString() } }
      }
    })

    return { success: true }
  }
})
```

### Example 2: Meeting Transcription → AI Summary → Notion

```typescript
export default defineWorkflow({
  name: 'Meeting Summary Generator',
  type: 'ai-enhanced',
  pricing: { model: 'subscription', price: 20, executions: 50 },

  integrations: [
    { service: 'google_meet', scopes: ['read_recordings'] },
    { service: 'notion', scopes: ['write_pages'] }
  ],

  inputs: {
    notionDb: { type: 'notion_database_picker', required: true },
    summaryLength: {
      type: 'select',
      options: ['brief', 'detailed'],
      default: 'brief'
    }
  },

  trigger: webhook({ service: 'google_meet', event: 'recording_ready' }),

  async execute({ trigger, inputs, integrations, ai }) {
    const recording = trigger.data

    // Get transcript
    const transcript = await integrations.google_meet.getTranscript(recording.id)

    // AI summarization
    const summary = await ai.completion({
      model: 'claude-sonnet-4',
      systemPrompt: `Summarize meeting transcript. Format: ${inputs.summaryLength}`,
      prompt: transcript,
      maxTokens: inputs.summaryLength === 'brief' ? 500 : 1500,
      cache: false // Don't cache - each meeting is unique
    })

    // Extract action items with AI
    const actionItems = await ai.completion({
      model: 'claude-haiku', // Cheaper model for simple task
      systemPrompt: 'Extract action items from meeting summary. Return JSON array.',
      prompt: summary,
      maxTokens: 300
    })

    // Save to Notion
    await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDb },
      properties: {
        'Title': { title: [{ text: { content: recording.title } }] },
        'Date': { date: { start: recording.date } },
        'Summary': { rich_text: [{ text: { content: summary } }] },
        'Action Items': { rich_text: [{ text: { content: actionItems } }] }
      }
    })

    return { success: true, summary, actionItems: JSON.parse(actionItems) }
  }
})
```

---

## Testing

```typescript
// test/workflow.test.ts
import { test, expect } from '@workway/testing'
import workflow from '../workflow'

test('processes payment correctly', async () => {
  const result = await workflow.execute({
    trigger: {
      type: 'webhook',
      data: {
        object: {
          amount: 1000,
          currency: 'usd',
          receipt_email: 'test@example.com'
        }
      }
    },
    inputs: {
      notionDatabaseId: 'test-db-id'
    },
    integrations: {
      notion: mockNotionClient
    }
  })

  expect(result.success).toBe(true)
})
```

---

## CLI Commands

```bash
# Create new workflow
npx create-workway-workflow

# Test locally
npm run test

# Get cost estimate
npx workway estimate

# Deploy to WORKWAY
npx workway publish

# View logs
npx workway logs <workflow-id>

# Update workflow
npx workway update
```

---

## Cost Optimization

The SDK automatically optimizes costs:

### 1. **Semantic Caching**
```typescript
// SDK auto-caches similar AI prompts
await ai.completion({
  prompt: 'Summarize this article...',
  cache: true // ← SDK uses semantic similarity to reuse responses
})
```

### 2. **Model Routing**
```typescript
// SDK routes to cheapest provider that meets requirements
await ai.completion({
  model: 'gpt-4o',
  routing: 'cost-optimized' // ← SDK may use Claude/Gemini if cheaper
})
```

### 3. **Batch Processing**
```typescript
// SDK batches multiple AI calls
const results = await ai.batch([
  { model: 'claude-haiku', prompt: 'Classify A' },
  { model: 'claude-haiku', prompt: 'Classify B' },
  { model: 'claude-haiku', prompt: 'Classify C' }
])
```

### 4. **Response Streaming**
```typescript
// For long responses, stream to reduce timeout costs
const stream = await ai.completionStream({
  model: 'gpt-4o',
  prompt: 'Write a comprehensive guide...'
})
```

---

## Best Practices

### ✅ DO

```typescript
// Use integration type for API workflows
type: 'integration' // Runs cheap on Cloudflare

// Cache expensive AI operations
const cached = await cache.get(key)
if (!cached) {
  cached = await ai.completion(...)
  await cache.set(key, cached, { ttl: 3600 })
}

// Use cheapest model for simple tasks
await ai.completion({
  model: 'claude-haiku', // $0.25/1M tokens vs $3/1M
  prompt: 'Classify this as A, B, or C'
})

// Parallel execution when possible
const [research, data] = await Promise.all([
  ai.completion(...),
  http.get(...)
])
```

### ❌ DON'T

```typescript
// Don't use AI for simple logic
await ai.completion({ prompt: 'Is 10 > 5?' }) // Use if/else!

// Don't make sequential calls when parallel is possible
const a = await ai.completion(...)
const b = await ai.completion(...) // Should be Promise.all

// Don't use expensive models for simple tasks
await ai.completion({
  model: 'gpt-4o', // $15/1M tokens
  prompt: 'Say yes or no'
})

// Don't forget to cache
await ai.completion({ prompt: 'same prompt every time' }) // Cache this!
```

---

## License

MIT
