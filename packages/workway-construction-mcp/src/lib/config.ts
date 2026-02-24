/**
 * Configuration constants for WORKWAY Construction MCP
 */

// ============================================================================
// Deployment Configuration
// ============================================================================

/**
 * Canonical and legacy MCP hosts.
 */
export const CANONICAL_MCP_BASE_URL = 'https://mcp.workway.co';
export const LEGACY_MCP_BASE_URL = 'https://construction.mcp.workway.co';

type BaseUrlEnv = {
  MCP_BASE_URL?: string | null;
  MCP_USE_LEGACY_BASE_URL?: string | boolean | null;
};

function shouldUseLegacyBaseUrl(value: BaseUrlEnv['MCP_USE_LEGACY_BASE_URL']): boolean {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
}

function normalizeBaseUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

/**
 * Resolve MCP base URL with env override.
 * Default is canonical mcp.workway.co, with explicit legacy opt-in.
 */
export function getMcpBaseUrl(env?: BaseUrlEnv): string {
  if (shouldUseLegacyBaseUrl(env?.MCP_USE_LEGACY_BASE_URL)) {
    return LEGACY_MCP_BASE_URL;
  }
  return normalizeBaseUrl(env?.MCP_BASE_URL) || CANONICAL_MCP_BASE_URL;
}

/**
 * Base URL for the MCP server.
 * Defaults to canonical endpoint for docs and generated links.
 */
export const MCP_BASE_URL = getMcpBaseUrl();

/**
 * OAuth callback URL (must match Procore app configuration)
 */
export function getOAuthCallbackUrl(env?: BaseUrlEnv): string {
  return `${getMcpBaseUrl(env)}/oauth/callback`;
}

/**
 * OAuth callback URL (must match Procore app configuration)
 */
export const OAUTH_CALLBACK_URL = getOAuthCallbackUrl();

/**
 * Webhook base URL for workflow triggers
 */
export function getWebhookBaseUrl(env?: BaseUrlEnv): string {
  return `${getMcpBaseUrl(env)}/webhooks`;
}

/**
 * Webhook base URL for workflow triggers
 */
export const WEBHOOK_BASE_URL = getWebhookBaseUrl();

// ============================================================================
// CORS Configuration
// ============================================================================

/**
 * Allowed origins for CORS
 * Add your frontend domains here
 */
export const ALLOWED_ORIGINS = [
  'https://workway.co',
  'https://www.workway.co',
  'https://mcp.workway.co',
  'https://construction.mcp.workway.co',
  'https://app.workway.co',
  'https://api.workway.co',
  'https://construction-web.pages.dev',
  // Local development
  'http://localhost:3000',
  'http://localhost:5173',
  // Claude Desktop and other MCP clients
  'https://claude.ai',
];

/**
 * Check if an origin is allowed
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Allow localhost in any environment for development
  if (origin.startsWith('http://localhost:')) return true;
  
  return ALLOWED_ORIGINS.includes(origin);
}

// ============================================================================
// OAuth Configuration
// ============================================================================

/**
 * Procore environment URLs
 * Users choose sandbox vs production when connecting
 */
export const PROCORE_ENVIRONMENTS = {
  production: {
    authUrl: 'https://login.procore.com/oauth/authorize',
    tokenUrl: 'https://login.procore.com/oauth/token',
    apiBase: 'https://api.procore.com/rest/v1.0',
  },
  sandbox: {
    authUrl: 'https://login-sandbox.procore.com/oauth/authorize',
    tokenUrl: 'https://login-sandbox.procore.com/oauth/token',
    apiBase: 'https://sandbox.procore.com/rest/v1.0',
  },
} as const;

export type ProcoreEnvironment = keyof typeof PROCORE_ENVIRONMENTS;

/**
 * Get Procore URLs for a given environment
 */
export function getProcoreUrls(env: ProcoreEnvironment = 'production') {
  return PROCORE_ENVIRONMENTS[env];
}

// Legacy exports for backward compatibility (default to production)
export const PROCORE_AUTH_URL = PROCORE_ENVIRONMENTS.production.authUrl;
export const PROCORE_TOKEN_URL = PROCORE_ENVIRONMENTS.production.tokenUrl;
export const PROCORE_API_BASE = PROCORE_ENVIRONMENTS.production.apiBase;

/**
 * OAuth state TTL in seconds (10 minutes)
 */
export const OAUTH_STATE_TTL = 600;

/**
 * PKCE state TTL in seconds (10 minutes)
 */
export const PKCE_TTL = 600;

// ============================================================================
// Security Configuration
// ============================================================================

/**
 * Token encryption is required in production
 */
export const REQUIRE_TOKEN_ENCRYPTION = true;

/**
 * Minimum token refresh buffer (5 minutes before expiration)
 */
export const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Procore API rate limits
 */
export const PROCORE_RATE_LIMIT = {
  requestsPerMinute: 3600,
  requestsPerDay: 100000,
};
