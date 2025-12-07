/**
 * @workwayco/mcp - WORKWAY Code Execution Library
 *
 * A code execution library for debugging WORKWAY workflows on Cloudflare Workers.
 * Designed for AI agents to write code against these APIs rather than using
 * individual MCP tools.
 *
 * ## Philosophy: Progressive Disclosure
 *
 * Instead of loading all tool definitions upfront, agents discover capabilities
 * by reading source files. This reduces token consumption and allows filtering
 * data in the execution environment before returning to context.
 *
 * ## Usage
 *
 * ```typescript
 * // Import what you need
 * import * as cloudflare from '@workwayco/mcp/servers/cloudflare';
 * import * as workway from '@workwayco/mcp/servers/workway';
 * import * as skills from '@workwayco/mcp/skills';
 *
 * // Query D1 database
 * const runs = await cloudflare.d1.query({
 *   database: 'your-d1-id',
 *   query: 'SELECT * FROM workflow_runs WHERE status = ?',
 *   params: ['failed']
 * });
 *
 * // List workflows with filtering
 * const zoomWorkflows = workway.workflows.list({ filter: 'zoom' });
 *
 * // Use a skill for common debugging patterns
 * const result = await skills.debugWorkflow({
 *   workflow: 'error-incident-manager',
 *   testEvent: { type: 'sentry', payload: { ... } }
 * });
 * ```
 *
 * ## Directory Structure
 *
 * ```
 * @workwayco/mcp/
 * ├── servers/
 * │   ├── cloudflare/    # Cloudflare API wrappers
 * │   │   ├── kv.ts      # KV namespace operations
 * │   │   ├── d1.ts      # D1 database operations
 * │   │   └── workers.ts # Worker inspection
 * │   └── workway/       # WORKWAY API wrappers
 * │       ├── webhooks.ts # Webhook testing
 * │       ├── workflows.ts # Workflow registry
 * │       └── oauth.ts    # OAuth providers
 * ├── skills/            # Reusable debugging patterns
 * │   └── debug-workflow.ts
 * └── config.ts          # Configuration management
 * ```
 *
 * @module @workwayco/mcp
 */

// Re-export servers for convenient access
export * as cloudflare from './servers/cloudflare/index.js';
export * as workway from './servers/workway/index.js';
export * as skills from './skills/index.js';

// Re-export configuration
export { getConfig, hasCloudflareCredentials, clearConfig } from './config.js';
export type { WorkwayConfig } from './config.js';

// Re-export types for convenience
export type { KVListResult, KVKey } from './servers/cloudflare/kv.js';
export type { D1QueryResult } from './servers/cloudflare/d1.js';
export type { Worker, WorkerAnalytics } from './servers/cloudflare/workers.js';
export type { WebhookResult } from './servers/workway/webhooks.js';
export type { Workflow, OutcomeFrame } from './servers/workway/workflows.js';
export type { OAuthProvider } from './servers/workway/oauth.js';
export type { DebugWorkflowInput, DebugWorkflowResult } from './skills/debug-workflow.js';
