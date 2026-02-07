/**
 * AI Gateway Client
 * 
 * Routes LLM calls through Cloudflare AI Gateway for automatic observability:
 * - Automatic token counting for all LLM calls
 * - Cost tracking per request
 * - Caching for repeated queries
 * - Rate limiting
 * - Analytics dashboard
 * - OpenTelemetry export
 * 
 * @see https://developers.cloudflare.com/ai-gateway/
 */

// ============================================================================
// Types
// ============================================================================

export interface AIGatewayConfig {
  accountId: string;
  gatewayId: string;
}

export type AIProvider = 'anthropic' | 'openai' | 'workers-ai';

export interface AIGatewayMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIGatewayMetadata {
  /** User ID for tracking */
  userId?: string;
  /** Workflow ID if part of a workflow execution */
  workflowId?: string;
  /** Tool/skill name that initiated the request */
  toolName?: string;
  /** Tenant ID for multi-tenant tracking */
  tenantId?: string;
  /** Project ID for construction context */
  projectId?: string;
  /** Custom tags for filtering in analytics */
  tags?: string[];
}

export interface AIGatewayRequest {
  /** LLM provider to use */
  provider: AIProvider;
  /** Model identifier */
  model: string;
  /** Chat messages */
  messages: AIGatewayMessage[];
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature (0-2, lower = more deterministic) */
  temperature?: number;
  /** System prompt (convenience, merged into messages) */
  systemPrompt?: string;
  /** Metadata for observability */
  metadata?: AIGatewayMetadata;
  /** Enable caching for this request */
  cache?: boolean;
  /** Cache TTL in seconds (default: 3600) */
  cacheTtl?: number;
}

export interface AIGatewayUsage {
  /** Tokens in the prompt */
  promptTokens: number;
  /** Tokens in the completion */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

export interface AIGatewayCost {
  /** Cost for prompt tokens in USD */
  promptCost: number;
  /** Cost for completion tokens in USD */
  completionCost: number;
  /** Total cost in USD */
  totalCost: number;
}

export interface AIGatewayResponse {
  /** Request ID from AI Gateway */
  id: string;
  /** Model used */
  model: string;
  /** Generated content */
  content: string;
  /** Token usage */
  usage: AIGatewayUsage;
  /** Estimated cost (if available) */
  cost?: AIGatewayCost;
  /** Request latency in milliseconds */
  latencyMs: number;
  /** Whether response was served from cache */
  cached: boolean;
  /** Finish reason */
  finishReason?: 'stop' | 'length' | 'content_filter';
}

export interface AIGatewayError extends Error {
  /** HTTP status code */
  status: number;
  /** Error code from provider */
  code?: string;
  /** Provider-specific error details */
  details?: unknown;
}

// ============================================================================
// Cost Estimation (approximate pricing as of 2024)
// ============================================================================

const COST_PER_1K_TOKENS: Record<string, { prompt: number; completion: number }> = {
  // Anthropic
  'claude-3-opus': { prompt: 0.015, completion: 0.075 },
  'claude-3-sonnet': { prompt: 0.003, completion: 0.015 },
  'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
  'claude-3-5-sonnet': { prompt: 0.003, completion: 0.015 },
  // OpenAI
  'gpt-4o': { prompt: 0.005, completion: 0.015 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
  'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  // Workers AI (typically free/included)
  '@cf/meta/llama-3.1-8b-instruct': { prompt: 0, completion: 0 },
  '@cf/meta/llama-3.1-70b-instruct': { prompt: 0, completion: 0 },
};

function estimateCost(model: string, usage: AIGatewayUsage): AIGatewayCost | undefined {
  // Normalize model name for lookup
  const normalizedModel = model.toLowerCase();
  const pricing = Object.entries(COST_PER_1K_TOKENS).find(([key]) => 
    normalizedModel.includes(key.toLowerCase())
  )?.[1];
  
  if (!pricing) {
    return undefined;
  }
  
  const promptCost = (usage.promptTokens / 1000) * pricing.prompt;
  const completionCost = (usage.completionTokens / 1000) * pricing.completion;
  
  return {
    promptCost: Math.round(promptCost * 1000000) / 1000000, // 6 decimal places
    completionCost: Math.round(completionCost * 1000000) / 1000000,
    totalCost: Math.round((promptCost + completionCost) * 1000000) / 1000000,
  };
}

// ============================================================================
// AI Gateway Client
// ============================================================================

export class AIGatewayClient {
  private baseUrl: string;
  private config: AIGatewayConfig;
  
  constructor(config: AIGatewayConfig) {
    this.config = config;
    // AI Gateway URL format: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}
    this.baseUrl = `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}`;
  }
  
  /**
   * Send a chat completion request through AI Gateway
   */
  async chat(request: AIGatewayRequest): Promise<AIGatewayResponse> {
    const startTime = Date.now();
    
    // Build messages array with optional system prompt
    const messages: AIGatewayMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push(...request.messages);
    
    // Route to appropriate provider endpoint
    const providerPath = this.getProviderPath(request.provider);
    const url = `${this.baseUrl}/${providerPath}`;
    
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add metadata as custom header for tracking in AI Gateway analytics
    if (request.metadata) {
      headers['cf-aig-metadata'] = JSON.stringify(request.metadata);
    }
    
    // Add caching headers if enabled
    if (request.cache) {
      headers['cf-aig-cache-ttl'] = String(request.cacheTtl || 3600);
    } else {
      headers['cf-aig-skip-cache'] = 'true';
    }
    
    // Format request body for provider
    const body = this.formatRequestForProvider(request, messages);
    
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw this.createError(
        `Network error calling AI Gateway: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0
      );
    }
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw this.createError(
        `AI Gateway error: ${response.status} ${errorText}`,
        response.status
      );
    }
    
    const data = await response.json();
    const latencyMs = Date.now() - startTime;
    
    return this.parseProviderResponse(request.provider, request.model, data, latencyMs, response);
  }
  
  /**
   * Get the provider-specific API path
   */
  private getProviderPath(provider: AIProvider): string {
    switch (provider) {
      case 'anthropic':
        return 'anthropic/v1/messages';
      case 'openai':
        return 'openai/v1/chat/completions';
      case 'workers-ai':
        return 'workers-ai';
      default:
        throw this.createError(`Unknown provider: ${provider}`, 400);
    }
  }
  
  /**
   * Format request body according to provider's API spec
   */
  private formatRequestForProvider(
    request: AIGatewayRequest, 
    messages: AIGatewayMessage[]
  ): object {
    switch (request.provider) {
      case 'anthropic':
        // Anthropic Messages API format
        // Extract system message separately (Anthropic requires system at top level)
        const systemMessages = messages.filter(m => m.role === 'system');
        const nonSystemMessages = messages.filter(m => m.role !== 'system');
        
        return {
          model: request.model,
          max_tokens: request.maxTokens || 1024,
          temperature: request.temperature,
          system: systemMessages.map(m => m.content).join('\n\n') || undefined,
          messages: nonSystemMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        };
      
      case 'openai':
        // OpenAI Chat Completions API format
        return {
          model: request.model,
          max_tokens: request.maxTokens || 1024,
          temperature: request.temperature,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        };
      
      case 'workers-ai':
        // Cloudflare Workers AI format
        return {
          model: request.model,
          max_tokens: request.maxTokens || 1024,
          temperature: request.temperature,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        };
      
      default:
        throw this.createError(`Unknown provider: ${request.provider}`, 400);
    }
  }
  
  /**
   * Parse provider response into unified format
   */
  private parseProviderResponse(
    provider: AIProvider,
    model: string,
    data: any,
    latencyMs: number,
    response: Response
  ): AIGatewayResponse {
    // Check cache status from AI Gateway headers
    const cacheStatus = response.headers.get('cf-aig-cache-status');
    const cached = cacheStatus === 'HIT';
    
    let content: string;
    let usage: AIGatewayUsage;
    let finishReason: AIGatewayResponse['finishReason'];
    let id: string;
    
    switch (provider) {
      case 'anthropic':
        // Anthropic response format
        content = data.content?.[0]?.text || '';
        usage = {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        };
        finishReason = data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason;
        id = data.id || crypto.randomUUID();
        break;
      
      case 'openai':
        // OpenAI response format
        content = data.choices?.[0]?.message?.content || '';
        usage = {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        };
        finishReason = data.choices?.[0]?.finish_reason as AIGatewayResponse['finishReason'];
        id = data.id || crypto.randomUUID();
        break;
      
      case 'workers-ai':
        // Workers AI response format
        content = data.response || data.result?.response || '';
        // Workers AI doesn't always return usage, estimate if needed
        usage = {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        };
        finishReason = 'stop';
        id = crypto.randomUUID();
        break;
      
      default:
        throw this.createError(`Unknown provider: ${provider}`, 400);
    }
    
    // Estimate cost based on usage
    const cost = estimateCost(model, usage);
    
    return {
      id,
      model,
      content,
      usage,
      cost,
      latencyMs,
      cached,
      finishReason,
    };
  }
  
  /**
   * Create a typed error
   */
  private createError(message: string, status: number): AIGatewayError {
    const error = new Error(message) as AIGatewayError;
    error.status = status;
    error.name = 'AIGatewayError';
    return error;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an AI Gateway client from environment variables
 */
export function createAIGatewayClient(env: {
  CLOUDFLARE_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
}): AIGatewayClient | null {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.AI_GATEWAY_ID) {
    return null;
  }
  
  return new AIGatewayClient({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    gatewayId: env.AI_GATEWAY_ID,
  });
}

// ============================================================================
// Helper for Direct Workers AI with Gateway Logging
// ============================================================================

/**
 * Options for calling Workers AI with gateway-style logging
 */
export interface WorkersAIOptions {
  model: string;
  messages: AIGatewayMessage[];
  maxTokens?: number;
  metadata?: AIGatewayMetadata;
}

/**
 * Call Workers AI directly but with response formatted like AIGatewayResponse
 * Use this when AI Gateway isn't configured but you still want consistent response format
 */
export async function callWorkersAI(
  ai: Ai,
  options: WorkersAIOptions
): Promise<AIGatewayResponse> {
  const startTime = Date.now();
  
  const response = await (ai as any).run(options.model, {
    messages: options.messages,
    max_tokens: options.maxTokens || 1024,
  }) as { response?: string };
  
  const latencyMs = Date.now() - startTime;
  const content = response.response || '';
  
  // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
  const promptTokens = options.messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  const completionTokens = Math.ceil(content.length / 4);
  
  return {
    id: crypto.randomUUID(),
    model: options.model,
    content,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
    latencyMs,
    cached: false,
    finishReason: 'stop',
  };
}
