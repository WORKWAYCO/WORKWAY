/**
 * Procore Rate Limiter - Durable Object
 * 
 * Implements token bucket algorithm for Procore API rate limiting.
 * Procore limit: 3600 requests/minute = 60 requests/second
 * 
 * Uses a token bucket that refills at 60 tokens/second.
 */

import type { Env } from '../types';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number; // seconds until next available token
  limit: number;
  resetAt: number; // timestamp when bucket fully refills
}

export interface RateLimiterState {
  tokens: number;
  lastRefill: number;
}

// Procore rate limit configuration
const TOKENS_PER_SECOND = 60; // 3600/minute = 60/second
const MAX_TOKENS = 3600; // Maximum bucket capacity (1 minute worth)
const REFILL_INTERVAL_MS = 1000; // Refill every second

export class ProcoreRateLimiter implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private async refillTokens(): Promise<RateLimiterState> {
    const stored = await this.state.storage.get<RateLimiterState>('rateLimitState');
    const now = Date.now();
    
    if (!stored) {
      // Initialize with full bucket
      const initial: RateLimiterState = {
        tokens: MAX_TOKENS,
        lastRefill: now,
      };
      await this.state.storage.put('rateLimitState', initial);
      return initial;
    }

    // Calculate tokens to add based on time elapsed
    const elapsedMs = now - stored.lastRefill;
    const tokensToAdd = Math.floor(elapsedMs / REFILL_INTERVAL_MS) * TOKENS_PER_SECOND;
    
    if (tokensToAdd > 0) {
      const newState: RateLimiterState = {
        tokens: Math.min(MAX_TOKENS, stored.tokens + tokensToAdd),
        lastRefill: now,
      };
      await this.state.storage.put('rateLimitState', newState);
      return newState;
    }

    return stored;
  }

  /**
   * Attempt to consume a token
   */
  private async tryConsume(count: number = 1): Promise<RateLimitResult> {
    // Use storage transaction for atomic updates
    const result = await this.state.storage.transaction(async (txn) => {
      const stored = await txn.get<RateLimiterState>('rateLimitState');
      const now = Date.now();
      
      let state: RateLimiterState;
      
      if (!stored) {
        state = { tokens: MAX_TOKENS, lastRefill: now };
      } else {
        // Refill tokens
        const elapsedMs = now - stored.lastRefill;
        const tokensToAdd = Math.floor(elapsedMs / REFILL_INTERVAL_MS) * TOKENS_PER_SECOND;
        state = {
          tokens: Math.min(MAX_TOKENS, stored.tokens + tokensToAdd),
          lastRefill: tokensToAdd > 0 ? now : stored.lastRefill,
        };
      }

      if (state.tokens >= count) {
        // Consume token(s)
        state.tokens -= count;
        await txn.put('rateLimitState', state);
        
        return {
          allowed: true,
          remaining: state.tokens,
          limit: MAX_TOKENS,
          resetAt: now + Math.ceil((MAX_TOKENS - state.tokens) / TOKENS_PER_SECOND) * 1000,
        };
      } else {
        // Calculate retry time
        const tokensNeeded = count - state.tokens;
        const retryAfter = Math.ceil(tokensNeeded / TOKENS_PER_SECOND);
        
        return {
          allowed: false,
          remaining: state.tokens,
          retryAfter,
          limit: MAX_TOKENS,
          resetAt: now + Math.ceil(MAX_TOKENS / TOKENS_PER_SECOND) * 1000,
        };
      }
    });

    return result;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Check rate limit (GET /check or POST /consume)
    if (url.pathname === '/check') {
      const state = await this.refillTokens();
      const result: RateLimitResult = {
        allowed: state.tokens > 0,
        remaining: state.tokens,
        limit: MAX_TOKENS,
        resetAt: Date.now() + Math.ceil((MAX_TOKENS - state.tokens) / TOKENS_PER_SECOND) * 1000,
      };
      if (state.tokens <= 0) {
        result.retryAfter = Math.ceil(1 / TOKENS_PER_SECOND); // Wait for at least 1 token
      }
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/consume') {
      const body = await request.json().catch(() => ({})) as { count?: number };
      const count = body.count || 1;
      const result = await this.tryConsume(count);
      
      return new Response(JSON.stringify(result), {
        status: result.allowed ? 200 : 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': MAX_TOKENS.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          ...(result.retryAfter ? { 'Retry-After': result.retryAfter.toString() } : {}),
        },
      });
    }

    if (url.pathname === '/status') {
      const state = await this.refillTokens();
      return new Response(JSON.stringify({
        tokens: state.tokens,
        maxTokens: MAX_TOKENS,
        tokensPerSecond: TOKENS_PER_SECOND,
        lastRefill: new Date(state.lastRefill).toISOString(),
        utilizationPercent: ((MAX_TOKENS - state.tokens) / MAX_TOKENS * 100).toFixed(2),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/reset') {
      // Reset to full bucket (useful for testing)
      const state: RateLimiterState = {
        tokens: MAX_TOKENS,
        lastRefill: Date.now(),
      };
      await this.state.storage.put('rateLimitState', state);
      return new Response(JSON.stringify({ reset: true, tokens: MAX_TOKENS }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }
}

/**
 * Helper class to interact with the rate limiter from other code
 */
export class RateLimiterClient {
  private env: Env;
  private userId: string;

  constructor(env: Env, userId: string = 'default') {
    this.env = env;
    this.userId = userId;
  }

  /**
   * Get the Durable Object stub for this user's rate limiter
   */
  private getStub(): DurableObjectStub {
    // Use user ID to create a unique rate limiter per user
    const id = this.env.PROCORE_RATE_LIMITER.idFromName(`procore-${this.userId}`);
    return this.env.PROCORE_RATE_LIMITER.get(id);
  }

  /**
   * Check if a request is allowed without consuming a token
   */
  async check(): Promise<RateLimitResult> {
    const stub = this.getStub();
    const response = await stub.fetch('https://rate-limiter/check');
    return response.json();
  }

  /**
   * Consume a token and check if allowed
   * Returns the result immediately - caller should handle retries
   */
  async consume(count: number = 1): Promise<RateLimitResult> {
    const stub = this.getStub();
    const response = await stub.fetch('https://rate-limiter/consume', {
      method: 'POST',
      body: JSON.stringify({ count }),
    });
    return response.json();
  }

  /**
   * Wait for rate limit and then consume
   * Implements exponential backoff for 429 responses
   */
  async waitAndConsume(maxRetries: number = 3): Promise<RateLimitResult> {
    let lastResult: RateLimitResult | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      lastResult = await this.consume();
      
      if (lastResult.allowed) {
        return lastResult;
      }

      // Wait for the retry period with a small buffer
      const waitMs = ((lastResult.retryAfter || 1) + 0.1) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    // Return the last result even if not allowed
    return lastResult || {
      allowed: false,
      remaining: 0,
      retryAfter: 60,
      limit: MAX_TOKENS,
      resetAt: Date.now() + 60000,
    };
  }

  /**
   * Get current rate limiter status
   */
  async status(): Promise<{
    tokens: number;
    maxTokens: number;
    tokensPerSecond: number;
    lastRefill: string;
    utilizationPercent: string;
  }> {
    const stub = this.getStub();
    const response = await stub.fetch('https://rate-limiter/status');
    return response.json();
  }
}
