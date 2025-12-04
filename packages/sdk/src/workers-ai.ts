/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ActionResult } from './action-result';
import { IntegrationError, ErrorCode } from './integration-error';

/**
 * Cloudflare Workers AI integration for WORKWAY SDK
 *
 * Enables developers to leverage 50+ AI models directly in workflows:
 * - Text generation (Llama, Mistral, etc.)
 * - Image generation (Stable Diffusion)
 * - Embeddings (BAAI/bge models)
 * - Speech recognition (Whisper)
 * - Translation
 * - Sentiment analysis
 * - And more!
 */

export interface AIModelOptions {
  /**
   * Model to use (e.g., '@cf/meta/llama-2-7b-chat-int8')
   */
  model: string;

  /**
   * Input data for the model
   */
  input: any;

  /**
   * Optional model-specific parameters
   */
  parameters?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    seed?: number;
    stream?: boolean;
  };

  /**
   * Cache results to reduce costs
   */
  cache?: boolean;

  /**
   * Cache TTL in seconds
   */
  cacheTtl?: number;
}

/**
 * Popular AI models available on Workers AI
 *
 * NOTE: This list is a convenience subset and may become stale.
 * For the complete, up-to-date list of available models, see:
 * https://developers.cloudflare.com/workers-ai/models/
 *
 * You can use any model ID string directly with WorkersAI methods.
 */
export const AIModels = {
  // Text Generation
  LLAMA_2_7B: '@cf/meta/llama-2-7b-chat-int8',
  LLAMA_2_7B_FP16: '@cf/meta/llama-2-7b-chat-fp16',
  LLAMA_3_8B: '@cf/meta/llama-3-8b-instruct',
  MISTRAL_7B: '@cf/mistral/mistral-7b-instruct-v0.1',
  PHI_2: '@cf/microsoft/phi-2',
  QWEN_15_7B: '@cf/qwen/qwen1.5-7b-chat-awq',
  DEEPSEEK_CODER: '@cf/deepseek-ai/deepseek-coder-6.7b-instruct-awq',

  // Code Generation
  CODE_LLAMA: '@cf/meta/codellama-7b-instruct-awq',
  DEEPSEEK_MATH: '@cf/deepseek-ai/deepseek-math-7b-instruct',

  // Embeddings
  BGE_SMALL: '@cf/baai/bge-small-en-v1.5',
  BGE_BASE: '@cf/baai/bge-base-en-v1.5',
  BGE_LARGE: '@cf/baai/bge-large-en-v1.5',

  // Image Generation
  STABLE_DIFFUSION_XL: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  DREAMSHAPER: '@cf/lykon/dreamshaper-8-lcm',

  // Image Classification
  RESNET_50: '@cf/microsoft/resnet-50',

  // Speech Recognition
  WHISPER: '@cf/openai/whisper',
  WHISPER_TINY: '@cf/openai/whisper-tiny-en-v1',

  // Translation
  M2M100: '@cf/meta/m2m100-1.2b',

  // Sentiment Analysis
  DISTILBERT_SST2: '@cf/huggingface/distilbert-sst-2-int8',
} as const;

/**
 * AI operation result configuration
 * Weniger, aber besser: One interface drives all AI operations
 */
interface AIOperationResult<T> {
  data: T;
  metadata: Record<string, any>;
  capabilities?: Record<string, any>;
}

/**
 * Workers AI client for executing AI models
 */
export class WorkersAI {
  private ai: any; // Cloudflare AI binding
  private cache?: Map<string, any>;

  constructor(ai: any) {
    this.ai = ai;
    this.cache = new Map();
  }

  /**
   * Execute AI operation with standardized error handling
   * Weniger, aber besser: One method handles all error patterns
   */
  private async executeAIOperation<T>(
    model: string,
    input: any,
    operationName: string,
    extractResult: (response: any) => AIOperationResult<T>
  ): Promise<ActionResult> {
    try {
      const response = await this.ai.run(model, input);

      if (!response.success) {
        throw new IntegrationError(
          ErrorCode.AI_MODEL_ERROR,
          `${operationName} failed`,
          { metadata: { model, error: response.error } }
        );
      }

      const { data, metadata, capabilities } = extractResult(response);
      return ActionResult.success(data, {
        metadata: { model, ...metadata },
        ...(capabilities && { capabilities })
      });
    } catch (error) {
      if (error instanceof IntegrationError) {
        throw error;
      }
      return ActionResult.error(
        `Failed to ${operationName.toLowerCase()}: ${error}`,
        ErrorCode.AI_MODEL_ERROR
      );
    }
  }

  /**
   * Run a text generation model
   */
  async generateText(options: {
    prompt: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    system?: string;
    cache?: boolean;
  }): Promise<ActionResult> {
    const model = options.model || AIModels.LLAMA_3_8B;

    // Check cache
    const cacheKey = `text:${model}:${options.prompt}:${options.temperature}`;
    if (options.cache && this.cache?.has(cacheKey)) {
      return ActionResult.success(this.cache.get(cacheKey));
    }

    try {
      const messages = options.system
        ? [
            { role: 'system', content: options.system },
            { role: 'user', content: options.prompt }
          ]
        : [{ role: 'user', content: options.prompt }];

      const response = await this.ai.run(model, {
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1024,
      });

      if (!response.success) {
        throw new IntegrationError(
          ErrorCode.AI_MODEL_ERROR,
          'AI model execution failed',
          { metadata: { model, error: response.error } }
        );
      }

      const result = response.response;

      // Cache result
      if (options.cache) {
        this.cache?.set(cacheKey, result);
      }

      return ActionResult.success(result, {
        metadata: {
          model,
          tokens: response.usage?.total_tokens,
          cached: false
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to generate text: ${error}`,
        ErrorCode.AI_MODEL_ERROR
      );
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbeddings(options: {
    text: string | string[];
    model?: string;
  }): Promise<ActionResult> {
    const model = options.model || AIModels.BGE_BASE;

    return this.executeAIOperation(
      model,
      { text: Array.isArray(options.text) ? options.text : [options.text] },
      'Embedding generation',
      (response) => ({
        data: response.data,
        metadata: {
          dimensions: response.data[0]?.length,
          count: response.data.length
        }
      })
    );
  }

  /**
   * Generate images
   */
  async generateImage(options: {
    prompt: string;
    model?: string;
    negative_prompt?: string;
    steps?: number;
    width?: number;
    height?: number;
  }): Promise<ActionResult> {
    const model = options.model || AIModels.STABLE_DIFFUSION_XL;
    const width = options.width || 1024;
    const height = options.height || 1024;

    return this.executeAIOperation(
      model,
      {
        prompt: options.prompt,
        negative_prompt: options.negative_prompt,
        num_steps: options.steps || 20,
        width,
        height,
      },
      'Image generation',
      (response) => ({
        data: response.image,
        metadata: { format: 'base64', width, height },
        capabilities: { canHandleImages: true }
      })
    );
  }

  /**
   * Classify images
   */
  async classifyImage(options: {
    image: ArrayBuffer | Uint8Array;
    model?: string;
  }): Promise<ActionResult> {
    const model = options.model || AIModels.RESNET_50;

    return this.executeAIOperation(
      model,
      { image: Array.from(new Uint8Array(options.image)) },
      'Image classification',
      (response) => ({
        data: response.predictions,
        metadata: { topPrediction: response.predictions[0] }
      })
    );
  }

  /**
   * Transcribe audio with Whisper
   */
  async transcribeAudio(options: {
    audio: ArrayBuffer;
    model?: string;
    language?: string;
  }): Promise<ActionResult> {
    const model = options.model || AIModels.WHISPER;

    return this.executeAIOperation(
      model,
      {
        audio: Array.from(new Uint8Array(options.audio)),
        language: options.language
      },
      'Audio transcription',
      (response) => ({
        data: {
          text: response.text,
          language: response.language,
          duration: response.duration
        },
        metadata: { confidence: response.confidence }
      })
    );
  }

  /**
   * Translate text
   */
  async translateText(options: {
    text: string;
    source: string;
    target: string;
    model?: string;
  }): Promise<ActionResult> {
    const model = options.model || AIModels.M2M100;

    return this.executeAIOperation(
      model,
      {
        text: options.text,
        source_lang: options.source,
        target_lang: options.target
      },
      'Translation',
      (response) => ({
        data: {
          text: response.translated_text,
          source: options.source,
          target: options.target
        },
        metadata: { confidence: response.confidence }
      })
    );
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(options: {
    text: string;
    model?: string;
  }): Promise<ActionResult> {
    const model = options.model || AIModels.DISTILBERT_SST2;

    return this.executeAIOperation(
      model,
      { text: options.text },
      'Sentiment analysis',
      (response) => ({
        data: {
          sentiment: response.label,
          confidence: response.score,
          positive: response.label === 'POSITIVE' ? response.score : 1 - response.score,
          negative: response.label === 'NEGATIVE' ? response.score : 1 - response.score
        },
        metadata: {}
      })
    );
  }

  /**
   * Text completion (alias for generateText for API compatibility)
   * Matches documentation examples using ai.completion()
   */
  async completion(options: {
    prompt: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    system?: string;
    cache?: boolean;
  }): Promise<ActionResult> {
    return this.generateText(options);
  }

  /**
   * Run any Workers AI model
   */
  async runModel(options: AIModelOptions): Promise<ActionResult> {
    const cacheKey = options.cache
      ? `model:${options.model}:${JSON.stringify(options.input)}:${JSON.stringify(options.parameters)}`
      : null;

    // Check cache
    if (cacheKey && this.cache?.has(cacheKey)) {
      return ActionResult.success(this.cache.get(cacheKey), {
        metadata: { cached: true }
      });
    }

    try {
      const response = await this.ai.run(options.model, options.input, options.parameters);

      if (!response.success) {
        throw new IntegrationError(
          ErrorCode.AI_MODEL_ERROR,
          `Model execution failed: ${response.error}`,
          { metadata: { model: options.model, error: response.error } }
        );
      }

      const result = response.response || response;

      // Cache result
      if (cacheKey) {
        this.cache?.set(cacheKey, result);

        // Clear cache after TTL
        if (options.cacheTtl) {
          setTimeout(() => this.cache?.delete(cacheKey), options.cacheTtl * 1000);
        }
      }

      return ActionResult.success(result, {
        metadata: {
          model: options.model,
          cached: false,
          usage: response.usage
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to run model ${options.model}: ${error}`,
        ErrorCode.AI_MODEL_ERROR
      );
    }
  }

  /**
   * Stream text generation
   */
  async *streamText(options: {
    prompt: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    system?: string;
  }): AsyncGenerator<string, void, unknown> {
    const model = options.model || AIModels.LLAMA_3_8B;

    const messages = options.system
      ? [
          { role: 'system', content: options.system },
          { role: 'user', content: options.prompt }
        ]
      : [{ role: 'user', content: options.prompt }];

    try {
      const stream = await this.ai.run(model, {
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1024,
        stream: true
      });

      for await (const chunk of stream) {
        if (chunk.response) {
          yield chunk.response;
        }
      }
    } catch (error) {
      throw new IntegrationError(
        ErrorCode.AI_MODEL_ERROR,
        `Streaming failed: ${error}`,
        { metadata: { model } }
      );
    }
  }

  /**
   * Chain multiple AI operations efficiently
   */
  async chain(operations: Array<{
    type: 'text' | 'embeddings' | 'image' | 'classify' | 'sentiment' | 'translate';
    options: any;
    transform?: (result: any) => any;
  }>): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    let previousResult: any = null;

    for (const op of operations) {
      // Allow referencing previous results
      if (op.options.usePrevious && previousResult) {
        op.options = { ...op.options, ...previousResult };
      }

      let result: ActionResult;
      switch (op.type) {
        case 'text':
          result = await this.generateText(op.options);
          break;
        case 'embeddings':
          result = await this.generateEmbeddings(op.options);
          break;
        case 'image':
          result = await this.generateImage(op.options);
          break;
        case 'classify':
          result = await this.classifyImage(op.options);
          break;
        case 'sentiment':
          result = await this.analyzeSentiment(op.options);
          break;
        case 'translate':
          result = await this.translateText(op.options);
          break;
        default:
          result = ActionResult.error('Unknown operation type', ErrorCode.INVALID_INPUT);
      }

      if (op.transform && result.success) {
        result.data = op.transform(result.data);
      }

      results.push(result);
      previousResult = result.data;
    }

    return results;
  }
}

// ============================================================================
// ZUHANDENHEIT: Intent-based AI Configuration
// ============================================================================

/**
 * Intent-to-model mapping
 * Developer thinks "I need to synthesize" not "I need LLAMA_3_8B"
 */
const INTENT_MODEL_MAP: Record<string, Record<string, string>> = {
  synthesis: {
    quick: AIModels.LLAMA_2_7B,
    standard: AIModels.LLAMA_3_8B,
    detailed: AIModels.MISTRAL_7B,
  },
  analysis: {
    quick: AIModels.LLAMA_2_7B,
    standard: AIModels.LLAMA_3_8B,
    detailed: AIModels.MISTRAL_7B,
  },
  generation: {
    quick: AIModels.LLAMA_2_7B,
    standard: AIModels.LLAMA_3_8B,
    creative: AIModels.MISTRAL_7B,
  },
  code: {
    quick: AIModels.DEEPSEEK_CODER,
    standard: AIModels.CODE_LLAMA,
    detailed: AIModels.DEEPSEEK_CODER,
  },
  extraction: {
    quick: AIModels.LLAMA_2_7B,
    standard: AIModels.LLAMA_3_8B,
    detailed: AIModels.LLAMA_3_8B,
  },
};

/**
 * Structured output schema definition
 */
export interface StructuredSchema {
  [key: string]: 'string' | 'number' | 'boolean' | 'string[]' | 'number[]' | StructuredSchema;
}

/**
 * Extended WorkersAI with Zuhandenheit methods
 */
export class FluentAI extends WorkersAI {
  private selectedModel: string = AIModels.LLAMA_3_8B;
  private selectedTemperature: number = 0.5;

  /**
   * Intent-based model selection
   *
   * Zuhandenheit: Developer thinks "I need synthesis" not "I need LLAMA_3_8B"
   *
   * @example
   * ```typescript
   * // BEFORE: Must know model names
   * const model = depth === 'quick' ? AIModels.LLAMA_2_7B : AIModels.LLAMA_3_8B;
   *
   * // AFTER: Intent-based
   * const ai = createAIClient(env).for('synthesis', 'quick');
   * ```
   */
  for(intent: 'synthesis' | 'analysis' | 'generation' | 'code' | 'extraction', depth: 'quick' | 'standard' | 'detailed' | 'creative' = 'standard'): this {
    const mapping = INTENT_MODEL_MAP[intent];
    if (mapping && mapping[depth]) {
      this.selectedModel = mapping[depth];
    }

    // Adjust temperature based on intent
    if (intent === 'generation' && depth === 'creative') {
      this.selectedTemperature = 0.8;
    } else if (intent === 'extraction' || intent === 'analysis') {
      this.selectedTemperature = 0.3;
    } else {
      this.selectedTemperature = 0.5;
    }

    return this;
  }

  /**
   * Extract structured data with guaranteed JSON output
   *
   * Zuhandenheit: Developer thinks "extract themes as array" not
   * "parse JSON with regex fallback handling markdown code blocks"
   *
   * @example
   * ```typescript
   * // BEFORE: Manual JSON parsing with regex
   * const jsonMatch = response.match(/\{[\s\S]*\}/);
   * const data = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
   *
   * // AFTER: Guaranteed structured output
   * const data = await ai.extractStructured(text, {
   *   themes: 'string[]',
   *   mood: 'string',
   *   summary: 'string'
   * });
   * ```
   */
  async extractStructured<T extends Record<string, any>>(
    text: string,
    schema: StructuredSchema,
    options: { context?: string } = {}
  ): Promise<ActionResult<T>> {
    const schemaDescription = this.describeSchema(schema);

    const systemPrompt = `You are a data extraction expert. Extract structured information from text.
${options.context ? `Context: ${options.context}` : ''}

CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no explanation, no code blocks.
The JSON must match this exact structure:
${schemaDescription}

If a field cannot be determined, use null for optional fields or empty array [] for arrays.`;

    const result = await this.generateText({
      model: this.selectedModel,
      system: systemPrompt,
      prompt: `Extract from this text:\n\n${text}`,
      temperature: 0.2, // Low temperature for consistent extraction
      max_tokens: 1000,
    });

    if (!result.success) {
      return result as ActionResult<T>;
    }

    // Parse the response with fallback handling
    const parsed = this.parseStructuredResponse<T>(result.data?.response || result.data, schema);

    return ActionResult.success(parsed, {
      metadata: {
        model: this.selectedModel,
        extractionSchema: Object.keys(schema),
      },
    });
  }

  /**
   * Synthesize content (messages, documents, etc.) into structured insights
   *
   * @example
   * ```typescript
   * const synthesis = await ai.synthesize(messages, {
   *   type: 'standup',
   *   output: { themes: 'string[]', blockers: 'string[]', mood: 'string' }
   * });
   * ```
   */
  async synthesize<T extends Record<string, any>>(
    content: string | string[],
    options: {
      type: 'standup' | 'email' | 'support' | 'content' | 'meeting' | 'feedback' | 'general';
      output: StructuredSchema;
      context?: string;
    }
  ): Promise<ActionResult<T>> {
    const contentText = Array.isArray(content) ? content.join('\n\n') : content;

    const typePrompts: Record<string, string> = {
      standup: 'You are synthesizing team standup discussions. Focus on themes, blockers, accomplishments, and action items.',
      email: 'You are synthesizing email content. Focus on key points, required actions, and priority.',
      support: 'You are synthesizing support tickets. Focus on issue category, sentiment, and resolution steps.',
      content: 'You are synthesizing content for creation. Focus on main points, structure, and audience.',
      meeting: 'You are synthesizing meeting transcripts. Focus on decisions made, action items with assignees, key discussion topics, and follow-ups needed.',
      feedback: 'You are synthesizing customer feedback. Focus on sentiment, recurring themes, urgency, and actionable insights.',
      general: 'You are synthesizing information. Extract the essential patterns and insights.',
    };

    return this.extractStructured<T>(contentText, options.output, {
      context: `${typePrompts[options.type]}${options.context ? ` ${options.context}` : ''}`,
    });
  }

  /**
   * Generate a response with a specific tone/style
   */
  async respond(
    context: string,
    options: {
      tone: 'professional' | 'friendly' | 'empathetic' | 'technical' | 'casual';
      length?: 'brief' | 'standard' | 'detailed';
      format?: 'text' | 'email' | 'message';
    }
  ): Promise<ActionResult<string>> {
    const toneInstructions: Record<string, string> = {
      professional: 'Use a professional, formal tone. Be clear and direct.',
      friendly: 'Use a warm, friendly tone. Be personable but professional.',
      empathetic: 'Use an empathetic tone. Acknowledge concerns and show understanding.',
      technical: 'Use a technical tone. Be precise and detailed.',
      casual: 'Use a casual, conversational tone.',
    };

    const lengthTokens: Record<string, number> = {
      brief: 150,
      standard: 300,
      detailed: 500,
    };

    const result = await this.generateText({
      model: this.selectedModel,
      system: toneInstructions[options.tone],
      prompt: context,
      temperature: options.tone === 'empathetic' ? 0.7 : 0.5,
      max_tokens: lengthTokens[options.length || 'standard'],
    });

    return ActionResult.success(result.data?.response || result.data, {
      metadata: { tone: options.tone, length: options.length },
    });
  }

  // Helper: Describe schema for prompt
  private describeSchema(schema: StructuredSchema, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    let description = '{\n';

    for (const [key, type] of Object.entries(schema)) {
      if (typeof type === 'object') {
        description += `${spaces}  "${key}": ${this.describeSchema(type, indent + 1)},\n`;
      } else {
        const typeExample = this.getTypeExample(type);
        description += `${spaces}  "${key}": ${typeExample},\n`;
      }
    }

    description += `${spaces}}`;
    return description;
  }

  // Helper: Get example for type
  private getTypeExample(type: string): string {
    switch (type) {
      case 'string': return '"..."';
      case 'number': return '0';
      case 'boolean': return 'true|false';
      case 'string[]': return '["...", "..."]';
      case 'number[]': return '[0, 0]';
      default: return '"..."';
    }
  }

  // Helper: Parse structured response with fallback
  private parseStructuredResponse<T>(response: string, schema: StructuredSchema): T {
    // Try direct parse first
    try {
      return JSON.parse(response);
    } catch {
      // Try extracting JSON from markdown code block
      const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1].trim());
        } catch {}
      }

      // Try extracting any JSON object
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {}
      }

      // Return empty object matching schema
      return this.createEmptyFromSchema(schema) as T;
    }
  }

  // Helper: Create empty object from schema
  private createEmptyFromSchema(schema: StructuredSchema): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, type] of Object.entries(schema)) {
      if (typeof type === 'object') {
        result[key] = this.createEmptyFromSchema(type);
      } else if (type.endsWith('[]')) {
        result[key] = [];
      } else if (type === 'number') {
        result[key] = 0;
      } else if (type === 'boolean') {
        result[key] = false;
      } else {
        result[key] = '';
      }
    }
    return result;
  }

  // ============================================================================
  // ZUHANDENHEIT: Content Pipeline Methods
  // Tools recede - developer thinks intent, not implementation
  // ============================================================================

  /**
   * Generate content with type and audience awareness
   *
   * Zuhandenheit: Developer thinks "generate blog post for technical audience"
   * not "build prompt string with 20-line template"
   *
   * @example
   * ```typescript
   * // BEFORE: Manual prompt engineering
   * const prompt = contentType === 'blog-post'
   *   ? `Write a comprehensive 800-word blog post about "${topic}"...`
   *   : contentType === 'social-media'
   *   ? `Create social media content...`
   *   : ...
   *
   * // AFTER: Intent-based
   * const content = await ai.generateContent(topic, { type: 'blog-post', audience: 'technical' });
   * ```
   */
  async generateContent(
    topic: string,
    options: {
      type: 'blog-post' | 'social-media' | 'newsletter' | 'technical-article' | 'landing-page';
      audience: 'general' | 'technical' | 'business' | 'academic';
      wordCount?: number;
      includeCallToAction?: boolean;
    }
  ): Promise<ActionResult<{ content: string; wordCount: number; readingTime: string }>> {
    const contentTemplates: Record<string, string> = {
      'blog-post': `Write a comprehensive ${options.wordCount || 800}-word blog post about "${topic}".
Include: engaging introduction, 3-4 main sections with subheadings, practical examples, ${options.includeCallToAction !== false ? 'and conclusion with call-to-action' : 'and conclusion'}.
Format with markdown.`,
      'social-media': `Create social media content about "${topic}":
1. Twitter thread (5-7 tweets, each under 280 chars)
2. LinkedIn post (200 words, professional)
3. Instagram caption (150 words, engaging)
Include relevant hashtags.`,
      'newsletter': `Write a newsletter about "${topic}":
1. Attention-grabbing subject line
2. ${options.wordCount || 500}-word main content
3. 3 key takeaways as bullet points
4. Next steps or links section
Format for email delivery.`,
      'technical-article': `Write a technical article about "${topic}":
1. Abstract/overview
2. Background and context
3. Technical deep-dive with code examples if relevant
4. Best practices
5. Conclusion and further reading
Target word count: ${options.wordCount || 1200} words.`,
      'landing-page': `Create landing page copy for "${topic}":
1. Hero headline and subheadline
2. 3 key benefits with brief descriptions
3. Social proof placeholder
4. Feature list (5-7 items)
5. Call-to-action copy`,
    };

    const audienceContext: Record<string, string> = {
      general: 'Use clear, accessible language. Avoid jargon.',
      technical: 'Include technical details. Assume familiarity with industry concepts.',
      business: 'Focus on ROI, efficiency, and business impact. Use professional tone.',
      academic: 'Use formal, research-oriented language. Include citations format.',
    };

    const result = await this.generateText({
      model: this.selectedModel,
      system: `You are an expert content writer. ${audienceContext[options.audience]}`,
      prompt: contentTemplates[options.type],
      temperature: 0.7,
      max_tokens: Math.min((options.wordCount || 800) * 2, 4000),
    });

    const content = result.data?.response || result.data || '';
    const words = content.split(/\s+/).length;

    return ActionResult.success({
      content,
      wordCount: words,
      readingTime: `${Math.ceil(words / 200)} min`,
    }, {
      metadata: { type: options.type, audience: options.audience },
    });
  }

  /**
   * Extract SEO metadata from content
   *
   * Zuhandenheit: Developer thinks "get SEO" not "parse JSON with try-catch fallback"
   */
  async seoOptimize(content: string): Promise<ActionResult<{
    title: string;
    description: string;
    keywords: string[];
    socialPreview: string;
  }>> {
    const schema = {
      title: 'string',
      description: 'string',
      keywords: 'string[]',
      socialPreview: 'string',
    } as const;

    return this.extractStructured(content.slice(0, 1500), schema, {
      context: 'Extract SEO metadata: title (60 chars max), meta description (160 chars max), 5-10 keywords, and social media preview text.',
    });
  }

  /**
   * Generate image with style awareness
   *
   * Zuhandenheit: Developer thinks "photorealistic image of topic"
   * not "Professional photograph: ${topic}, high quality, detailed, 8k"
   */
  async generateStyledImage(
    subject: string,
    options: {
      style: 'photorealistic' | 'illustration' | 'abstract' | 'technical-diagram' | 'minimalist';
      size?: 'hero' | 'thumbnail' | 'social' | 'square';
    }
  ): Promise<ActionResult<{ data: any; prompt: string }>> {
    const stylePrompts: Record<string, string> = {
      photorealistic: `Professional photograph: ${subject}, high quality, detailed, 8k, sharp focus`,
      illustration: `Digital illustration: ${subject}, modern style, vibrant colors, clean lines`,
      abstract: `Abstract art representing: ${subject}, creative, colorful, dynamic composition`,
      'technical-diagram': `Technical diagram: ${subject}, clean, professional, informative, labeled`,
      minimalist: `Minimalist design: ${subject}, simple shapes, limited color palette, elegant`,
    };

    const sizeDimensions: Record<string, { width: number; height: number }> = {
      hero: { width: 1024, height: 768 },
      thumbnail: { width: 512, height: 512 },
      social: { width: 1200, height: 630 },
      square: { width: 1024, height: 1024 },
    };

    const dims = sizeDimensions[options.size || 'hero'];
    const prompt = stylePrompts[options.style];

    const result = await this.generateImage({
      prompt,
      negative_prompt: 'text, watermark, low quality, blurry, distorted',
      width: dims.width,
      height: dims.height,
      steps: options.size === 'thumbnail' ? 15 : 25,
    });

    return ActionResult.success({
      data: result.data,
      prompt,
    }, {
      metadata: { style: options.style, size: options.size },
    });
  }

  /**
   * Batch translate content to multiple languages
   *
   * Zuhandenheit: Developer thinks "translate to these languages"
   * not "loop through languages, skip source, handle errors"
   */
  async translateBatch(
    content: string,
    options: {
      source: string;
      targets: string[];
      includeSEO?: { title: string; description: string };
    }
  ): Promise<ActionResult<Record<string, { content: string; seo?: { title: string; description: string } }>>> {
    const translations: Record<string, { content: string; seo?: { title: string; description: string } }> = {};

    // Include source language
    translations[options.source] = {
      content,
      seo: options.includeSEO,
    };

    // Translate to each target
    for (const target of options.targets) {
      if (target === options.source) continue;

      const contentResult = await this.translateText({
        text: content,
        source: options.source,
        target,
      });

      translations[target] = {
        content: contentResult.data?.text || '',
      };

      // Translate SEO if provided
      if (options.includeSEO) {
        const seoResult = await this.translateText({
          text: `${options.includeSEO.title}\n---\n${options.includeSEO.description}`,
          source: options.source,
          target,
        });
        const [title, description] = (seoResult.data?.text || '').split('\n---\n');
        translations[target].seo = { title: title || '', description: description || '' };
      }
    }

    return ActionResult.success(translations, {
      metadata: { languages: [options.source, ...options.targets] },
    });
  }

  /**
   * Create social media variants from content
   *
   * Zuhandenheit: Developer thinks "create social posts"
   * not "chain 3 prompts with different models and temperatures"
   */
  async createSocialVariants(
    content: string,
    topic: string
  ): Promise<ActionResult<{
    twitter: string[];
    linkedin: string;
    instagram: string;
  }>> {
    const contentPreview = content.slice(0, 800);

    // Generate all variants in one call for efficiency
    const schema = {
      twitter: 'string[]',
      linkedin: 'string',
      instagram: 'string',
    } as const;

    return this.extractStructured(contentPreview, schema, {
      context: `Create social media content about "${topic}":
- twitter: Array of 5-7 tweets (each under 280 chars, include hashtags)
- linkedin: Professional 200-word post for LinkedIn
- instagram: Engaging 150-word caption with emojis and hashtags`,
    });
  }
}

/**
 * Helper function to create a Workers AI client
 */
export function createAIClient(env: { AI: any }): FluentAI {
  if (!env.AI) {
    throw new Error('Workers AI binding not found. Add [ai] binding to wrangler.toml');
  }
  return new FluentAI(env.AI);
}