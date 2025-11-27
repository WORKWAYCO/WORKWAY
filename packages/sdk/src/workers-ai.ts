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
          'AI model execution failed',
          ErrorCode.AI_MODEL_ERROR,
          { model, error: response.error }
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

    try {
      const response = await this.ai.run(model, {
        text: Array.isArray(options.text) ? options.text : [options.text]
      });

      if (!response.success) {
        throw new IntegrationError(
          'Embedding generation failed',
          ErrorCode.AI_MODEL_ERROR,
          { model, error: response.error }
        );
      }

      return ActionResult.success(response.data, {
        metadata: {
          model,
          dimensions: response.data[0]?.length,
          count: response.data.length
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to generate embeddings: ${error}`,
        ErrorCode.AI_MODEL_ERROR
      );
    }
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

    try {
      const response = await this.ai.run(model, {
        prompt: options.prompt,
        negative_prompt: options.negative_prompt,
        num_steps: options.steps || 20,
        width: options.width || 1024,
        height: options.height || 1024,
      });

      if (!response.success) {
        throw new IntegrationError(
          'Image generation failed',
          ErrorCode.AI_MODEL_ERROR,
          { model, error: response.error }
        );
      }

      return ActionResult.success(response.image, {
        metadata: {
          model,
          format: 'base64',
          width: options.width || 1024,
          height: options.height || 1024
        },
        capabilities: ['downloadable', 'viewable']
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to generate image: ${error}`,
        ErrorCode.AI_MODEL_ERROR
      );
    }
  }

  /**
   * Classify images
   */
  async classifyImage(options: {
    image: ArrayBuffer | Uint8Array;
    model?: string;
  }): Promise<ActionResult> {
    const model = options.model || AIModels.RESNET_50;

    try {
      const response = await this.ai.run(model, {
        image: Array.from(new Uint8Array(options.image))
      });

      if (!response.success) {
        throw new IntegrationError(
          'Image classification failed',
          ErrorCode.AI_MODEL_ERROR,
          { model, error: response.error }
        );
      }

      return ActionResult.success(response.predictions, {
        metadata: {
          model,
          topPrediction: response.predictions[0]
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to classify image: ${error}`,
        ErrorCode.AI_MODEL_ERROR
      );
    }
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

    try {
      const response = await this.ai.run(model, {
        audio: Array.from(new Uint8Array(options.audio)),
        language: options.language
      });

      if (!response.success) {
        throw new IntegrationError(
          'Audio transcription failed',
          ErrorCode.AI_MODEL_ERROR,
          { model, error: response.error }
        );
      }

      return ActionResult.success({
        text: response.text,
        language: response.language,
        duration: response.duration
      }, {
        metadata: {
          model,
          confidence: response.confidence
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to transcribe audio: ${error}`,
        ErrorCode.AI_MODEL_ERROR
      );
    }
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

    try {
      const response = await this.ai.run(model, {
        text: options.text,
        source_lang: options.source,
        target_lang: options.target
      });

      if (!response.success) {
        throw new IntegrationError(
          'Translation failed',
          ErrorCode.AI_MODEL_ERROR,
          { model, error: response.error }
        );
      }

      return ActionResult.success({
        text: response.translated_text,
        source: options.source,
        target: options.target
      }, {
        metadata: {
          model,
          confidence: response.confidence
        }
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to translate text: ${error}`,
        ErrorCode.AI_MODEL_ERROR
      );
    }
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(options: {
    text: string;
    model?: string;
  }): Promise<ActionResult> {
    const model = options.model || AIModels.DISTILBERT_SST2;

    try {
      const response = await this.ai.run(model, {
        text: options.text
      });

      if (!response.success) {
        throw new IntegrationError(
          'Sentiment analysis failed',
          ErrorCode.AI_MODEL_ERROR,
          { model, error: response.error }
        );
      }

      return ActionResult.success({
        sentiment: response.label,
        confidence: response.score,
        positive: response.label === 'POSITIVE' ? response.score : 1 - response.score,
        negative: response.label === 'NEGATIVE' ? response.score : 1 - response.score
      }, {
        metadata: { model }
      });
    } catch (error) {
      return ActionResult.error(
        `Failed to analyze sentiment: ${error}`,
        ErrorCode.AI_MODEL_ERROR
      );
    }
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
          `Model execution failed: ${response.error}`,
          ErrorCode.AI_MODEL_ERROR,
          { model: options.model, error: response.error }
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
        `Streaming failed: ${error}`,
        ErrorCode.AI_MODEL_ERROR,
        { model }
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

/**
 * Helper function to create a Workers AI client
 */
export function createAIClient(env: { AI: any }): WorkersAI {
  if (!env.AI) {
    throw new Error('Workers AI binding not found. Add [ai] binding to wrangler.toml');
  }
  return new WorkersAI(env.AI);
}