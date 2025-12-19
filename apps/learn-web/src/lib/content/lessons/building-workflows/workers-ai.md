# Workers AI: Adding Intelligence

Transform raw data into insights. Workers AI runs on Cloudflare's global network—no external API keys needed.

## Why Workers AI?

| Traditional AI APIs | Workers AI |
|--------------------:|:-----------|
| External API calls | Runs on Cloudflare edge |
| API key management | Built into WORKWAY |
| Variable latency | Consistent low latency |
| Per-token pricing | Included in Workers |

## Basic Usage

```typescript
import { AIModels } from '@workwayco/sdk';

async execute({ integrations }) {
  const { ai } = integrations;

  const result = await ai.generateText({
    prompt: 'Summarize this meeting: ...',
    model: AIModels.LLAMA_3_8B,  // Optional, defaults to LLAMA_3_8B
  });

  // result.data contains the response
  return { summary: result.data?.response };
}
```

## Common Use Cases

### Text Summarization

```typescript
async function summarizeMeeting(transcript: string, ai: any) {
  const result = await ai.generateText({
    system: 'You are a meeting summarizer.',
    prompt: `Summarize this meeting transcript in 3-5 bullet points.
Focus on decisions made and action items.

Transcript:
${transcript}`,
    temperature: 0.3,
    max_tokens: 500,
  });

  return result.data?.response;
}
```

### Email Classification

```typescript
async function classifyEmail(email: { subject: string; body: string }, ai: any) {
  const result = await ai.generateText({
    system: 'You are an email classifier. Respond with only a single word.',
    prompt: `Classify this email into one category:
urgent, follow-up, informational, spam, or other.

Subject: ${email.subject}
Body: ${email.body}

Category:`,
    temperature: 0.1,
  });

  const category = result.data?.response?.trim().toLowerCase();
  return category;
}
```

### Action Item Extraction

```typescript
async function extractActionItems(notes: string, ai: any) {
  const result = await ai.generateText({
    system: 'Extract action items as JSON. Return only valid JSON array.',
    prompt: `Extract action items from these meeting notes.
Format as: [{"task": "...", "assignee": "...", "deadline": "..."}]

Notes:
${notes}`,
    temperature: 0.2,
  });

  try {
    const jsonMatch = result.data?.response?.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return [];
  }
}
```

### Sentiment Analysis

```typescript
async function analyzeSentiment(text: string, ai: any) {
  // Use the dedicated sentiment analysis method
  const result = await ai.analyzeSentiment({ text });

  return result.data?.sentiment; // 'positive', 'negative', or 'neutral'
}
```

## Available Models

WORKWAY provides model constants via `AIModels`:

```typescript
import { AIModels } from '@workwayco/sdk';

// Text Generation
AIModels.LLAMA_3_8B       // '@cf/meta/llama-3-8b-instruct'
AIModels.LLAMA_2_7B       // '@cf/meta/llama-2-7b-chat-int8'
AIModels.MISTRAL_7B       // '@cf/mistral/mistral-7b-instruct-v0.1'

// Code Generation
AIModels.CODE_LLAMA       // '@cf/meta/codellama-7b-instruct-awq'
AIModels.DEEPSEEK_CODER   // '@cf/deepseek-ai/deepseek-coder-6.7b-instruct-awq'

// Embeddings
AIModels.BGE_BASE         // '@cf/baai/bge-base-en-v1.5'
AIModels.BGE_SMALL        // '@cf/baai/bge-small-en-v1.5'
```

### Text Generation

```typescript
const result = await ai.generateText({
  prompt: 'Your prompt here',
  model: AIModels.LLAMA_3_8B,  // Optional
  temperature: 0.7,
  max_tokens: 1024,
});
```

### Embeddings

```typescript
// Generate embeddings for semantic search
const result = await ai.generateEmbeddings({
  text: 'Meeting about Q4 planning',
  model: AIModels.BGE_BASE,  // Optional
});

// result.data is the embedding array
```

### Image Generation

```typescript
const result = await ai.generateImage({
  prompt: 'A professional office meeting',
  width: 1024,
  height: 768,
  steps: 20,
});

// result.data contains the base64 image
```

## Structured Output

### JSON Responses with extractStructured

The SDK provides a high-level method for structured extraction:

```typescript
async function extractMeetingData(transcript: string, ai: any) {
  // Use extractStructured for guaranteed JSON output
  const result = await ai.extractStructured(transcript, {
    topic: 'string',
    attendees: 'string[]',
    decisions: 'string[]',
    action_items: 'string[]',
    next_meeting: 'string',
  });

  return result.data;  // Typed according to schema
}
```

### Manual JSON Extraction

For more control, use generateText with JSON prompting:

```typescript
async function extractMeetingData(transcript: string, ai: any) {
  const result = await ai.generateText({
    system: 'Extract meeting data as JSON. Return ONLY valid JSON, no explanation.',
    prompt: `Extract from this transcript:
${transcript}

Format:
{
  "topic": "string",
  "attendees": ["string"],
  "decisions": ["string"]
}`,
    temperature: 0.2,
  });

  // Parse with fallback handling
  try {
    const jsonMatch = result.data?.response?.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    return null;
  }
}
```

### Validation Layer

```typescript
interface MeetingData {
  topic: string;
  attendees: string[];
  decisions: string[];
  action_items: Array<{ task: string; owner: string }>;
}

function validateMeetingData(data: unknown): MeetingData | null {
  if (!data || typeof data !== 'object') return null;

  const d = data as Record<string, unknown>;

  if (typeof d.topic !== 'string') return null;
  if (!Array.isArray(d.attendees)) return null;
  if (!Array.isArray(d.decisions)) return null;
  if (!Array.isArray(d.action_items)) return null;

  return d as MeetingData;
}
```

## Prompt Engineering Tips

### Be Specific

```typescript
// Vague - unpredictable results
const bad = 'Summarize this meeting';

// Specific - consistent format
const good = `Summarize this meeting in exactly 3 bullet points.
Each bullet should be one sentence, max 20 words.
Focus on: decisions made, action items, next steps.`;
```

### Provide Examples

```typescript
const prompt = `Classify the email priority.

Examples:
- "Server is down" → urgent
- "Can we meet next week?" → follow-up
- "Newsletter: December updates" → informational

Email subject: "${subject}"
Email body: "${body}"

Priority:`;
```

### Set Boundaries

```typescript
const prompt = `Extract company names from this text.
Rules:
- Only return actual company names
- Exclude personal names
- Exclude generic terms like "the company"
- Return as JSON array: ["Company1", "Company2"]
- If no companies found, return []

Text: ${text}

Companies:`;
```

## Complete Workflow Example

```typescript
import { defineWorkflow, webhook, AIModels } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Intelligent Meeting Notes',
  description: 'AI-powered meeting summaries to Notion',

  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
    { service: 'notion', scopes: ['read_pages', 'write_pages'] },
  ],

  inputs: {
    notionDatabase: {
      type: 'text',
      label: 'Notes Database ID',
      required: true,
    },
    summaryStyle: {
      type: 'select',
      label: 'Summary Style',
      options: [
        { value: 'brief', label: 'Brief (3 bullets)' },
        { value: 'detailed', label: 'Detailed (full summary)' },
        { value: 'executive', label: 'Executive (key decisions only)' },
      ],
      default: 'brief',
    },
  },

  trigger: webhook({
    service: 'zoom',
    event: 'recording.completed',
  }),

  async execute({ trigger, inputs, integrations }) {
    const { zoom, notion, ai } = integrations;

    // Get meeting transcript
    const meetingId = trigger.data.object.id;
    const transcriptResult = await zoom.getTranscript({ meetingId });

    if (!transcriptResult.success) {
      return { success: false, error: 'No transcript available' };
    }

    const transcript = transcriptResult.data.transcript_text;

    // AI: Generate summary based on style preference
    const summary = await ai.generateText({
      system: getSummarySystem(inputs.summaryStyle),
      prompt: `Meeting transcript:\n${transcript}`,
      temperature: 0.3,
      model: AIModels.LLAMA_3_8B,
    });

    // AI: Extract action items using structured extraction
    const actionItems = await ai.extractStructured(transcript, {
      actionItems: 'string[]',
    });

    // Create Notion page
    const page = await notion.pages.create({
      parent: { database_id: inputs.notionDatabase },
      properties: {
        Title: { title: [{ text: { content: trigger.data.object.topic } }] },
        Date: { date: { start: new Date().toISOString().split('T')[0] } },
      },
      children: [
        {
          type: 'heading_2',
          heading_2: { rich_text: [{ text: { content: 'Summary' } }] },
        },
        {
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: summary.data?.response || '' } }] },
        },
        {
          type: 'heading_2',
          heading_2: { rich_text: [{ text: { content: 'Action Items' } }] },
        },
        ...formatActionItems(actionItems.data?.actionItems || []),
      ],
    });

    return { success: true, pageId: page.data?.id };
  },
});

function getSummarySystem(style: string): string {
  const styles: Record<string, string> = {
    brief: 'Summarize in exactly 3 bullet points, max 20 words each.',
    detailed: 'Provide a comprehensive summary covering all topics discussed.',
    executive: 'List only key decisions and their business impact.',
  };
  return styles[style] || styles.brief;
}

function formatActionItems(items: string[]) {
  return items.map((item) => ({
    type: 'to_do',
    to_do: {
      rich_text: [{ text: { content: item } }],
      checked: false,
    },
  }));
}
```

## Best Practices

### 1. Handle AI Failures Gracefully

```typescript
const result = await ai.generateText({ prompt });

let summary: string;
if (result.success) {
  summary = result.data?.response || 'No response';
} else {
  console.warn('AI summarization failed:', result.error);
  summary = 'Summary generation failed. See full transcript below.';
}
```

### 2. Limit Input Size

```typescript
const MAX_TRANSCRIPT_LENGTH = 10000;

const truncatedTranscript = transcript.length > MAX_TRANSCRIPT_LENGTH
  ? transcript.slice(0, MAX_TRANSCRIPT_LENGTH) + '...[truncated]'
  : transcript;
```

### 3. Cache Expensive Operations

```typescript
const cacheKey = `summary:${meetingId}`;
let summary = await storage.get(cacheKey);

if (!summary) {
  const result = await ai.generateText({
    prompt: transcript,
    cache: true,  // Enable SDK-level caching
  });
  summary = result.data?.response;
  await storage.put(cacheKey, summary);
}
```

## Common Pitfalls

### Not Handling AI Failures

AI calls can fail - always have fallbacks:

```typescript
// Wrong - crashes if AI unavailable
async execute({ integrations }) {
  const result = await integrations.ai.generateText({ prompt });
  return { summary: result.data.response };  // Crashes if failed
}

// Right - graceful degradation
async execute({ integrations }) {
  const result = await integrations.ai.generateText({ prompt });

  if (!result.success) {
    console.warn('AI summarization failed:', result.error);
    return { summary: 'Summary unavailable', raw: transcript };
  }

  return { summary: result.data?.response || 'No response generated' };
}
```

### Transcript Too Long

Workers AI has token limits - truncate long inputs:

```typescript
// Wrong - sends entire transcript
const result = await ai.generateText({
  prompt: `Summarize: ${transcript}`,  // 50,000 characters = error
});

// Right - truncate to safe limit
const MAX_INPUT = 8000;  // Characters, not tokens
const truncated = transcript.length > MAX_INPUT
  ? transcript.slice(0, MAX_INPUT) + '...[truncated]'
  : transcript;

const result = await ai.generateText({
  prompt: `Summarize: ${truncated}`,
});
```

### Expecting Consistent JSON

LLMs don't guarantee valid JSON output:

```typescript
// Wrong - assumes valid JSON
const result = await ai.generateText({ prompt: 'Return JSON: {items: [...]}' });
const data = JSON.parse(result.data.response);  // Crashes on invalid JSON

// Right - extract and validate
const result = await ai.generateText({ prompt: 'Return JSON: {items: [...]}' });

let data = null;
try {
  const jsonMatch = result.data?.response?.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    data = JSON.parse(jsonMatch[0]);
  }
} catch {
  console.warn('Failed to parse AI response as JSON');
}

// Use data safely with fallback
const items = data?.items || [];
```

### Vague Prompts

Unclear prompts get inconsistent results:

```typescript
// Wrong - vague, inconsistent output
const result = await ai.generateText({
  prompt: 'Summarize this meeting',
});

// Right - specific constraints
const result = await ai.generateText({
  system: 'You are a meeting summarizer. Be concise.',
  prompt: `Summarize in exactly 3 bullet points, max 20 words each.
Focus on: 1) decisions made, 2) action items, 3) next steps.

Meeting transcript:
${transcript}`,
  temperature: 0.3,  // Lower = more consistent
});
```

### Wrong Temperature Setting

High temperature = creative but inconsistent; low = predictable:

```typescript
// Wrong - high temperature for structured extraction
const result = await ai.generateText({
  prompt: 'Extract: {"name": "...", "email": "..."}',
  temperature: 0.9,  // Too creative for extraction
});

// Right - low temperature for structured tasks
const result = await ai.generateText({
  prompt: 'Extract: {"name": "...", "email": "..."}',
  temperature: 0.1,  // Deterministic for extraction
});

// Use higher temperature for creative tasks
const creative = await ai.generateText({
  prompt: 'Write a friendly follow-up email',
  temperature: 0.7,  // More variety in phrasing
});
```

### Not Using extractStructured

Manual JSON prompting is error-prone:

```typescript
// Wrong - manual JSON extraction
const result = await ai.generateText({
  prompt: 'Return JSON with actionItems array',
});
const items = JSON.parse(result.data.response).actionItems;

// Right - use SDK's structured extraction
const result = await ai.extractStructured(transcript, {
  actionItems: 'string[]',
  decisions: 'string[]',
  nextMeeting: 'string',
});

// Typed and validated automatically
const items = result.data?.actionItems || [];
```

### Ignoring Model Capabilities

Different models have different strengths:

```typescript
// Wrong - using general model for code
const result = await ai.generateText({
  model: AIModels.LLAMA_3_8B,
  prompt: 'Generate TypeScript function',
});

// Right - use code-specialized model
const result = await ai.generateText({
  model: AIModels.CODE_LLAMA,  // Specialized for code
  prompt: 'Generate TypeScript function',
});
```

## Praxis

Add AI intelligence to your meeting notes workflow:

> **Praxis**: Ask Claude Code: "Help me add Workers AI summarization to my workflow"

Implement these AI patterns:

```typescript
import { AIModels } from '@workwayco/sdk';

async execute({ integrations }) {
  const { ai } = integrations;

  // 1. Summarization with generateText
  const summary = await ai.generateText({
    system: 'Summarize in 3 bullet points.',
    prompt: transcript,
    model: AIModels.LLAMA_3_8B,
    temperature: 0.3,
  });

  // 2. Action item extraction with extractStructured
  const actions = await ai.extractStructured(transcript, {
    actionItems: 'string[]',
    decisions: 'string[]',
  });

  return {
    summary: summary.data?.response,
    actionItems: actions.data?.actionItems || [],
    decisions: actions.data?.decisions || [],
  };
}
```

Experiment with:
- Different temperature settings
- Using `system` prompts for consistent formatting
- The `extractStructured` method for guaranteed JSON output

## Reflection

- What repetitive cognitive tasks could AI handle in your workflows?
- How does edge AI change what's possible with automation?
- What's the right balance between AI automation and human review?
