/**
 * @workway/mcp-core
 * 
 * Shared MCP infrastructure for WORKWAY vertical servers.
 * 
 * Usage:
 * ```typescript
 * import { createMCPServer } from '@workway/mcp-core';
 * import { myTools } from './tools';
 * 
 * export default createMCPServer({
 *   name: 'my-vertical-mcp',
 *   version: '0.1.0',
 *   tools: myTools,
 * });
 * ```
 */

// Main factory
export { createMCPServer, type CreateMCPServerOptions } from './server';

// Types
export type {
  BaseMCPEnv,
  MCPEnv,
  User,
  UserTier,
  UsageResult,
  AnonymousUsage,
  MCPServerInfo,
  MCPCapabilities,
  MCPTool,
  MCPToolResult,
  MCPResource,
  MCPPrompt,
  MCPServerConfig,
  MCPContext,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
} from './types';

// Auth
export {
  getUserFromToken,
  generateFingerprint,
  generateAPIKey,
  revokeAllAPIKeys,
  revokeAPIKey,
  validateAPIKey,
  type APIKeyResult,
} from './auth';

// Metering
export {
  createMetering,
  checkUsage,
  incrementUsage,
  getCurrentUsage,
  type MeteringConfig,
} from './metering';

// Transport
export {
  createSSEHandler,
  createMessageCORSHandler,
  validateSession,
  type SSESession,
} from './transport';

// Protocol
export {
  createMessageHandler,
  type ProtocolHandlerConfig,
} from './protocol';
