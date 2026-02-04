/**
 * Core types for WORKWAY MCP servers
 */

import type { Context } from 'hono';
import type { z } from 'zod';

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Base environment bindings required by all MCP servers
 */
export interface BaseMCPEnv {
  /** KV namespace for sessions, API keys, and caching */
  KV: KVNamespace;
  /** D1 database for users and usage tracking */
  DB: D1Database;
  /** Workers AI binding (optional) */
  AI?: Ai;
}

/**
 * Extended environment with additional bindings
 * Verticals can extend this with their own bindings
 */
export interface MCPEnv extends BaseMCPEnv {
  /** Durable Object for workflow state */
  WORKFLOW_STATE?: DurableObjectNamespace;
  /** Environment name */
  ENVIRONMENT?: string;
  /** OAuth secrets */
  PROCORE_CLIENT_ID?: string;
  PROCORE_CLIENT_SECRET?: string;
  PROCORE_SANDBOX_CLIENT_ID?: string;
  PROCORE_SANDBOX_CLIENT_SECRET?: string;
  COOKIE_ENCRYPTION_KEY?: string;
}

// ============================================================================
// User & Auth Types
// ============================================================================

export type UserTier = 'anonymous' | 'free' | 'pro' | 'enterprise';

export interface User {
  id: string;
  email: string;
  tier: UserTier;
  runs_this_month: number;
  billing_cycle_start: string;
  created_at: string;
  updated_at: string;
}

export interface AnonymousUsage {
  runs: number;
  first_seen: string;
}

export interface UsageResult {
  exceeded: boolean;
  runs: number;
  limit: number;
  tier: UserTier;
  userId?: string;
  cycleStart?: string;
  daysUntilReset?: number;
}

// ============================================================================
// MCP Protocol Types
// ============================================================================

export interface MCPServerInfo {
  name: string;
  version: string;
  description?: string;
}

export interface MCPCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
}

export interface MCPTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema?: z.ZodSchema<TOutput>;
  execute: (input: TInput, env: MCPEnv) => Promise<MCPToolResult<TOutput>>;
}

export interface MCPToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// ============================================================================
// JSON-RPC Types
// ============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id?: string | number;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ============================================================================
// Server Configuration
// ============================================================================

export interface MCPServerConfig<TEnv extends BaseMCPEnv = MCPEnv> {
  /** Server name (e.g., 'workway-construction-mcp') */
  name: string;
  /** Server version */
  version: string;
  /** Server description */
  description?: string;
  /** MCP capabilities */
  capabilities?: MCPCapabilities;
  /** Tools provided by this server */
  tools: Record<string, MCPTool<any, any>>;
  /** Resources provided by this server */
  resources?: {
    list: () => MCPResource[];
    fetch: (uri: string, env: TEnv) => Promise<unknown | null>;
  };
  /** Prompts provided by this server */
  prompts?: MCPPrompt[];
  /** Allowed CORS origins */
  allowedOrigins?: string[];
  /** Tier limits override */
  tierLimits?: Partial<Record<UserTier, number>>;
  /** Custom routes to add to the server */
  customRoutes?: (app: any, env: TEnv) => void;
}

// ============================================================================
// Context Types
// ============================================================================

export type MCPContext<TEnv extends BaseMCPEnv = MCPEnv> = Context<{ Bindings: TEnv }>;
