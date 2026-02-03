# Add Workers AI

Use AI for summarization, classification, and structured extraction.

## What you'll do

- Generate text with `ai.generateText()`
- Extract structured data with `ai.extractStructured()`
- Choose models: LLaMA 3, Code LLaMA, BGE
- Handle AI failures with fallbacks
- Apply prompt engineering for consistent output

## Step-by-Step: Add AI to Your Workflow

### Step 1: Access the AI Integration

The AI integration is built-in—just destructure it:

```typescript
async execute({ integrations }) {
  const { ai } = integrations;
  // ai is ready to use
}
```

### Step 2: Generate Your First AI Response

Add a basic text generation call:

```typescript
async execute({ integrations }) {
  const { ai } = integrations;

  const result = await ai.generateText({
    prompt: 'What are the key takeaways from a successful meeting?',
  });

  console.log('AI response:', result.data?.response);
  return { success: true, output: result.data?.response };
}
```

### Step 3: Add a System Prompt

Guide the AI's behavior with a system prompt:

```typescript
async execute({ trigger, integrations }) {
  const { ai } = integrations;
  const transcript = trigger.data.transcript;

  const result = await ai.generateText({
    system: 'You are a professional meeting summarizer. Extract key decisions, action items, and highlights. Be concise.',
    prompt: `Summarize this meeting transcript:\n\n${transcript}`,
    temperature: 0.3,  // Lower = more deterministic
    max_tokens: 500,   // Limit response length
  });

  return { success: true, summary: result.data?.response };
}
```

### Step 4: Parse Structured Output

When you need structured data, guide the AI and parse:

```typescript
async execute({ trigger, integrations }) {
  const { ai } = integrations;

  const result = await ai.generateText({
    system: 'You extract action items as JSON. Return ONLY a valid JSON array, no other text.',
    prompt: `Extract action items from this text:\n\n${trigger.data.notes}`,
    temperature: 0.1,
  });

  // Parse the JSON response
  let actionItems = [];
  try {
    actionItems = JSON.parse(result.data?.response || '[]');
  } catch (error) {
    console.warn('Failed to parse AI response as JSON');
  }

  return { success: true, actionItems };
}
```

### Step 5: Integrate AI with Other Services

Chain AI output to other integrations:

```typescript
async execute({ trigger, inputs, integrations }) {
  const { ai, notion, slack } = integrations;

  // 1. Generate summary with AI
  const summaryResult = await ai.generateText({
    system: 'Summarize meetings in 3-5 bullet points.',
    prompt: `Summarize:\n\n${trigger.data.transcript}`,
  });

  // 2. Save to Notion with AI-generated summary
  const page = await notion.pages.create({
    parent: { database_id: inputs.notionDatabase },
    properties: {
      Name: { title: [{ text: { content: trigger.data.topic } }] },
    },
    children: [{
      type: 'paragraph',
      paragraph: {
        rich_text: [{ text: { content: summaryResult.data?.response || '' } }],
      },
    }],
  });

  // 3. Notify Slack
  await slack.chat.postMessage({
    channel: inputs.slackChannel,
    text: `Meeting summary ready: ${page.data?.url}`,
  });

  return { success: true };
}
```

### Step 6: Test AI Responses Locally

```bash
workway dev

# Test with sample transcript
curl localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Alice: Lets launch the new feature next week. Bob: Agreed, I will prepare the deployment plan."}'
```

---

## Why Workers AI?

| Traditional AI APIs | Workers AI              |
| ------------------: | :---------------------- |
|  External API calls | Runs on Cloudflare edge |
|  API key management | Built into WORKWAY      |
|    Variable latency | Consistent low latency  |
|   Per-token pricing | Included in Workers     |

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

## Real Examples from the WORKWAY Codebase

These examples are taken directly from production WORKWAY workflows.

### Customer Feedback Analysis

From `packages/workflows/src/feedback-analyzer/index.ts` — This workflow analyzes customer feedback emails and extracts structured insights:

```typescript
// AI Analysis with structured JSON output
const analysis = await integrations.ai.generateText({
  model: AIModels.LLAMA_3_8B,
  system: `Analyze customer feedback and return JSON:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": 0-1 (1 = very positive, 0 = very negative),
  "category": "bug" | "feature_request" | "praise" | "complaint" | "question" | "other",
  "summary": "one sentence summary",
  "keyPoints": ["point1", "point2"],
  "suggestedAction": "what to do about this feedback",
  "priority": "low" | "medium" | "high" | "urgent"
}`,
  prompt: `Analyze this customer feedback:\n\nFrom: ${from}\nSubject: ${subject}\n\n${body}`,
  temperature: 0.3,
  max_tokens: 400,
});

let parsed;
try {
  parsed = JSON.parse(analysis.data?.response || "{}");
} catch {
  // Fallback when JSON parsing fails
  parsed = {
    sentiment: "neutral",
    sentimentScore: 0.5,
    category: "other",
    summary: "Unable to analyze",
    keyPoints: [],
    suggestedAction: "Manual review required",
    priority: "medium",
  };
}
```

**Key patterns:**

- Uses `temperature: 0.3` for consistent structured output
- Provides explicit JSON schema in system prompt
- Has fallback values when parsing fails

### Support Ticket Classification

From `packages/workflows/src/support-ticket-router/index.ts` — This workflow routes support tickets to the right team:

```typescript
// AI Classification for ticket routing
const classification = await integrations.ai.generateText({
  model: AIModels.LLAMA_3_8B,
  system: `You are a support ticket classifier. Analyze the message and return JSON:
{
  "category": "billing" | "technical" | "sales" | "general",
  "urgency": "low" | "medium" | "high" | "critical",
  "summary": "one sentence summary",
  "suggestedResponse": "brief suggested response"
}`,
  prompt: `Classify this support message:\n\n${message.text}`,
  temperature: 0.3,
  max_tokens: 200,
});

let parsed;
try {
  parsed = JSON.parse(classification.data?.response || "{}");
} catch {
  parsed = {
    category: "general",
    urgency: "medium",
    summary: "Unable to classify",
  };
}

const { category, urgency, summary, suggestedResponse } = parsed;

// Route based on classification
const targetChannel =
  inputs.routingChannels[category] || inputs.routingChannels.general;
```

**Key patterns:**

- Limited output categories for reliable routing decisions
- Generates both classification AND suggested response in one call
- Falls back to safe defaults ('general', 'medium')

### Meeting Notes Summarization

From `packages/workflows/src/meeting-summarizer/index.ts` — This workflow summarizes meeting notes and extracts action items:

```typescript
// AI Analysis with configurable summary length
const lengthInstructions = {
  brief: "Keep the summary to 2-3 sentences.",
  standard: "Provide a thorough summary in 4-6 sentences.",
  detailed: "Provide a comprehensive summary with all key points.",
};

const analysis = await integrations.ai.generateText({
  model: AIModels.LLAMA_3_8B,
  system: `You are a meeting notes analyst. Analyze meeting notes and extract:
1. Summary: ${lengthInstructions[inputs.summaryLength]}
2. Key Decisions: List any decisions made (bullet points)
3. Action Items: List tasks with assignees if mentioned (format: "- [ ] Task (@person if mentioned)")
4. Next Steps: What needs to happen next

Return as JSON:
{
  "summary": "...",
  "decisions": ["..."],
  "actionItems": [{"task": "...", "assignee": "..." or null}],
  "nextSteps": ["..."]
}`,
  prompt: `Analyze these meeting notes:\n\nTitle: ${pageTitle}\n\n${textContent}`,
  temperature: 0.3,
  max_tokens: 800,
});
```

**Key patterns:**

- User-configurable output length via input options
- Extracts multiple structured data types in one call
- Action items include optional assignee detection

---

## Common Use Cases

### Text Summarization

```typescript
async function summarizeMeeting(transcript: string, ai: any) {
  const result = await ai.generateText({
    system: "You are a meeting summarizer.",
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
async function classifyEmail(
  email: { subject: string; body: string },
  ai: any,
) {
  const result = await ai.generateText({
    system: "You are an email classifier. Respond with only a single word.",
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
    system: "Extract action items as JSON. Return only valid JSON array.",
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

### Model Selection Guide

| Task                   | Recommended Model       | Why                                    |
| ---------------------- | ----------------------- | -------------------------------------- |
| Meeting summaries      | `LLAMA_3_8B`            | Best balance of quality and speed      |
| Action item extraction | `LLAMA_3_8B` + low temp | Deterministic structured output        |
| Code generation        | `CODE_LLAMA`            | Trained on code, better syntax         |
| Email classification   | `LLAMA_3_8B` + temp 0.1 | Single-word responses need consistency |
| Semantic search        | `BGE_BASE`              | High-quality embeddings                |
| Quick embeddings       | `BGE_SMALL`             | Faster, slightly lower quality         |

WORKWAY provides model constants via `AIModels`:

```typescript
import { AIModels } from "@workwayco/sdk";

// Text Generation
AIModels.LLAMA_3_8B; // '@cf/meta/llama-3-8b-instruct'
AIModels.LLAMA_2_7B; // '@cf/meta/llama-2-7b-chat-int8'
AIModels.MISTRAL_7B; // '@cf/mistral/mistral-7b-instruct-v0.1'

// Code Generation
AIModels.CODE_LLAMA; // '@cf/meta/codellama-7b-instruct-awq'
AIModels.DEEPSEEK_CODER; // '@cf/deepseek-ai/deepseek-coder-6.7b-instruct-awq'

// Embeddings
AIModels.BGE_BASE; // '@cf/baai/bge-base-en-v1.5'
AIModels.BGE_SMALL; // '@cf/baai/bge-small-en-v1.5'
```

### Text Generation

```typescript
const result = await ai.generateText({
  prompt: "Your prompt here",
  model: AIModels.LLAMA_3_8B, // Optional
  temperature: 0.7,
  max_tokens: 1024,
});
```

### Embeddings

```typescript
// Generate embeddings for semantic search
const result = await ai.generateEmbeddings({
  text: "Meeting about Q4 planning",
  model: AIModels.BGE_BASE, // Optional
});

// result.data is the embedding array
```

### Image Generation

```typescript
const result = await ai.generateImage({
  prompt: "A professional office meeting",
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
    topic: "string",
    attendees: "string[]",
    decisions: "string[]",
    action_items: "string[]",
    next_meeting: "string",
  });

  return result.data; // Typed according to schema
}
```

### Manual JSON Extraction

For more control, use generateText with JSON prompting:

```typescript
async function extractMeetingData(transcript: string, ai: any) {
  const result = await ai.generateText({
    system:
      "Extract meeting data as JSON. Return ONLY valid JSON, no explanation.",
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
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, unknown>;

  if (typeof d.topic !== "string") return null;
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
const bad = "Summarize this meeting";

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
import { defineWorkflow, webhook, AIModels } from "@workwayco/sdk";

export default defineWorkflow({
  name: "Intelligent Meeting Notes",
  description: "AI-powered meeting summaries to Notion",

  integrations: [
    { service: "zoom", scopes: ["meeting:read", "recording:read"] },
    { service: "notion", scopes: ["read_pages", "write_pages"] },
  ],

  inputs: {
    notionDatabase: {
      type: "text",
      label: "Notes Database ID",
      required: true,
    },
    summaryStyle: {
      type: "select",
      label: "Summary Style",
      options: [
        { value: "brief", label: "Brief (3 bullets)" },
        { value: "detailed", label: "Detailed (full summary)" },
        { value: "executive", label: "Executive (key decisions only)" },
      ],
      default: "brief",
    },
  },

  trigger: webhook({
    service: "zoom",
    event: "recording.completed",
  }),

  async execute({ trigger, inputs, integrations }) {
    const { zoom, notion, ai } = integrations;

    // Get meeting transcript
    const meetingId = trigger.data.object.id;
    const transcriptResult = await zoom.getTranscript({ meetingId });

    if (!transcriptResult.success) {
      return { success: false, error: "No transcript available" };
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
      actionItems: "string[]",
    });

    // Create Notion page
    const page = await notion.pages.create({
      parent: { database_id: inputs.notionDatabase },
      properties: {
        Title: { title: [{ text: { content: trigger.data.object.topic } }] },
        Date: { date: { start: new Date().toISOString().split("T")[0] } },
      },
      children: [
        {
          type: "heading_2",
          heading_2: { rich_text: [{ text: { content: "Summary" } }] },
        },
        {
          type: "paragraph",
          paragraph: {
            rich_text: [{ text: { content: summary.data?.response || "" } }],
          },
        },
        {
          type: "heading_2",
          heading_2: { rich_text: [{ text: { content: "Action Items" } }] },
        },
        ...formatActionItems(actionItems.data?.actionItems || []),
      ],
    });

    return { success: true, pageId: page.data?.id };
  },
});

function getSummarySystem(style: string): string {
  const styles: Record<string, string> = {
    brief: "Summarize in exactly 3 bullet points, max 20 words each.",
    detailed: "Provide a comprehensive summary covering all topics discussed.",
    executive: "List only key decisions and their business impact.",
  };
  return styles[style] || styles.brief;
}

function formatActionItems(items: string[]) {
  return items.map((item) => ({
    type: "to_do",
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
  summary = result.data?.response || "No response";
} else {
  console.warn("AI summarization failed:", result.error);
  summary = "Summary generation failed. See full transcript below.";
}
```

### 2. Limit Input Size

```typescript
const MAX_TRANSCRIPT_LENGTH = 10000;

const truncatedTranscript =
  transcript.length > MAX_TRANSCRIPT_LENGTH
    ? transcript.slice(0, MAX_TRANSCRIPT_LENGTH) + "...[truncated]"
    : transcript;
```

### 3. Cache Expensive Operations

```typescript
const cacheKey = `summary:${meetingId}`;
let summary = await storage.get(cacheKey);

if (!summary) {
  const result = await ai.generateText({
    prompt: transcript,
    cache: true, // Enable SDK-level caching
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
  prompt: `Summarize: ${transcript}`, // 50,000 characters = error
});

// Right - truncate to safe limit
const MAX_INPUT = 8000; // Characters, not tokens
const truncated =
  transcript.length > MAX_INPUT
    ? transcript.slice(0, MAX_INPUT) + "...[truncated]"
    : transcript;

const result = await ai.generateText({
  prompt: `Summarize: ${truncated}`,
});
```

### Expecting Consistent JSON

LLMs don't guarantee valid JSON output:

```typescript
// Wrong - assumes valid JSON
const result = await ai.generateText({ prompt: "Return JSON: {items: [...]}" });
const data = JSON.parse(result.data.response); // Crashes on invalid JSON

// Right - extract and validate
const result = await ai.generateText({ prompt: "Return JSON: {items: [...]}" });

let data = null;
try {
  const jsonMatch = result.data?.response?.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    data = JSON.parse(jsonMatch[0]);
  }
} catch {
  console.warn("Failed to parse AI response as JSON");
}

// Use data safely with fallback
const items = data?.items || [];
```

### Vague Prompts

Unclear prompts get inconsistent results:

```typescript
// Wrong - vague, inconsistent output
const result = await ai.generateText({
  prompt: "Summarize this meeting",
});

// Right - specific constraints
const result = await ai.generateText({
  system: "You are a meeting summarizer. Be concise.",
  prompt: `Summarize in exactly 3 bullet points, max 20 words each.
Focus on: 1) decisions made, 2) action items, 3) next steps.

Meeting transcript:
${transcript}`,
  temperature: 0.3, // Lower = more consistent
});
```

### Wrong Temperature Setting

High temperature = creative but inconsistent; low = predictable:

```typescript
// Wrong - high temperature for structured extraction
const result = await ai.generateText({
  prompt: 'Extract: {"name": "...", "email": "..."}',
  temperature: 0.9, // Too creative for extraction
});

// Right - low temperature for structured tasks
const result = await ai.generateText({
  prompt: 'Extract: {"name": "...", "email": "..."}',
  temperature: 0.1, // Deterministic for extraction
});

// Use higher temperature for creative tasks
const creative = await ai.generateText({
  prompt: "Write a friendly follow-up email",
  temperature: 0.7, // More variety in phrasing
});
```

### Not Using extractStructured

Manual JSON prompting is error-prone:

```typescript
// Wrong - manual JSON extraction
const result = await ai.generateText({
  prompt: "Return JSON with actionItems array",
});
const items = JSON.parse(result.data.response).actionItems;

// Right - use SDK's structured extraction
const result = await ai.extractStructured(transcript, {
  actionItems: "string[]",
  decisions: "string[]",
  nextMeeting: "string",
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
  prompt: "Generate TypeScript function",
});

// Right - use code-specialized model
const result = await ai.generateText({
  model: AIModels.CODE_LLAMA, // Specialized for code
  prompt: "Generate TypeScript function",
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
