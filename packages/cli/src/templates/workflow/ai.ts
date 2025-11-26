/**
 * AI Workflow Template
 *
 * Less, but better. Cloudflare Workers AI only.
 * No external APIs. No API keys. No complexity.
 */

export const aiWorkflowTemplate = (
	name: string,
	category: string,
	price: number,
	aiTask: string
) => `import { defineWorkflow } from '@workway/sdk/workflow';
import { createAIClient, AIModels } from '@workway/sdk/workers-ai';
import { z } from 'zod';

/**
 * ${name}
 *
 * Built on Cloudflare Workers AI.
 * Cost: ~$0.01 per 1M tokens (Llama 3 8B)
 */
export default defineWorkflow({
  metadata: {
    id: '${name.toLowerCase().replace(/\s+/g, '-')}',
    name: '${name}',
    tagline: '${aiTask}',
    description: 'AI-powered workflow using Cloudflare Workers AI. No external API keys required.',
    category: '${category}',
    icon: '🤖',
    version: '1.0.0',
    author: {
      name: 'Your Name',
      email: 'you@example.com',
    },
    tags: ['ai', 'automation', 'workers-ai'],
  },

  pricing: {
    model: 'subscription',
    price: ${price},
    trialDays: 7,
    currency: 'usd',
  },

  // Cloudflare Workers AI - no OAuth required
  integrations: [],

  trigger: {
    type: 'manual',
  },

  configSchema: z.object({
    model: z.enum(['fast', 'balanced', 'quality']).default('balanced'),
    maxTokens: z.number().min(100).max(4096).default(1024),
  }),

  configFields: [
    {
      key: 'model',
      label: 'AI Model',
      description: 'Fast (Llama 2, $0.005/1M) | Balanced (Llama 3, $0.01/1M) | Quality (Mistral, $0.02/1M)',
      type: 'select',
      required: true,
      options: [
        { value: 'fast', label: 'Fast - Llama 2 7B' },
        { value: 'balanced', label: 'Balanced - Llama 3 8B' },
        { value: 'quality', label: 'Quality - Mistral 7B' },
      ],
      schema: z.enum(['fast', 'balanced', 'quality']),
    },
    {
      key: 'maxTokens',
      label: 'Max Output Tokens',
      description: 'Maximum length of AI response (100-4096)',
      type: 'number',
      required: false,
      default: 1024,
      schema: z.number().min(100).max(4096),
    },
  ],

  async execute({ trigger, config, env }) {
    // Initialize Workers AI client
    const ai = createAIClient(env);

    // Select model based on config
    const modelMap = {
      fast: AIModels.LLAMA_2_7B,
      balanced: AIModels.LLAMA_3_8B,
      quality: AIModels.MISTRAL_7B,
    };
    const model = modelMap[config.model];

    // Get input from trigger
    const input = trigger.data?.text || trigger.data?.content || '';

    if (!input) {
      return {
        success: false,
        error: 'No input text provided',
      };
    }

    // Generate AI response
    const result = await ai.generateText({
      prompt: input,
      model,
      max_tokens: config.maxTokens,
      temperature: 0.7,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      output: result.data,
      metadata: result.metadata,
    };
  },
});
`;

export const aiTestDataTemplate = () => `{
  "trigger": {
    "type": "manual",
    "data": {
      "text": "Summarize the key benefits of automation in three bullet points."
    }
  },
  "config": {
    "model": "balanced",
    "maxTokens": 512
  }
}
`;

export const aiReadmeTemplate = (name: string) => `# ${name}

An AI-powered workflow built on Cloudflare Workers AI.

## Why Workers AI?

| Feature | Workers AI | External APIs |
|---------|-----------|---------------|
| API Keys | None required | Required |
| Cost | $0.01/1M tokens | $0.50-3/1M tokens |
| Latency | Edge (fast) | Variable |
| Data | Stays in Cloudflare | Leaves network |

## Available Models

| Model | ID | Cost/1M Tokens | Best For |
|-------|-----|----------------|----------|
| Llama 2 7B | fast | $0.005 | Simple tasks |
| Llama 3 8B | balanced | $0.01 | General use |
| Mistral 7B | quality | $0.02 | Complex reasoning |

## Getting Started

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Test Locally

\`\`\`bash
# Test with mock AI (no API calls)
workway workflow test --mock

# Test with live Workers AI
workway workflow test --live
\`\`\`

### 3. Customize

Edit \`workflow.ts\`:
- Change the prompt processing logic
- Add embeddings with \`ai.generateEmbeddings()\`
- Add image generation with \`ai.generateImage()\`
- Chain multiple AI operations with \`ai.chain()\`

### 4. Check Costs

\`\`\`bash
workway ai estimate
\`\`\`

### 5. Publish

\`\`\`bash
workway workflow publish
\`\`\`

## AI Methods Available

\`\`\`typescript
// Text generation
await ai.generateText({ prompt, model, max_tokens });

// Embeddings (for semantic search)
await ai.generateEmbeddings({ text, model });

// Image generation
await ai.generateImage({ prompt, model });

// Speech to text
await ai.transcribeAudio({ audio, model });

// Translation
await ai.translateText({ text, source, target });

// Sentiment analysis
await ai.analyzeSentiment({ text });

// Streaming responses
for await (const chunk of ai.streamText({ prompt })) {
  console.log(chunk);
}

// Chain operations
await ai.chain([
  { type: 'text', options: { prompt: '...' } },
  { type: 'sentiment', options: { usePrevious: true } },
]);
\`\`\`

## Cost Estimation

For 1,000 workflow executions with ~500 tokens each:

| Model | Cost |
|-------|------|
| Llama 2 (fast) | $0.0025 |
| Llama 3 (balanced) | $0.005 |
| Mistral (quality) | $0.01 |

## Documentation

- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [WORKWAY SDK Docs](https://docs.workway.dev/sdk/workers-ai)
`;

export const aiPackageJsonTemplate = (name: string) => `{
  "name": "${name.toLowerCase().replace(/\s+/g, '-')}",
  "version": "1.0.0",
  "description": "AI-powered WORKWAY workflow using Cloudflare Workers AI",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "workway workflow test --mock",
    "test:live": "workway workflow test --live",
    "dev": "workway workflow dev",
    "build": "workway workflow build",
    "publish": "workway workflow publish",
    "ai:models": "workway ai models",
    "ai:estimate": "workway ai estimate"
  },
  "dependencies": {
    "@workway/sdk": "latest",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
`;
