/**
 * Configuration constants for WORKWAY Construction MCP
 */

// ============================================================================
// Deployment Configuration
// ============================================================================

/**
 * Base URL for the MCP server
 * Update this when deploying to a different domain
 */
export const MCP_BASE_URL = 'https://workway-construction-mcp.half-dozen.workers.dev';

/**
 * OAuth callback URL (must match Procore app configuration)
 */
export const OAUTH_CALLBACK_URL = `${MCP_BASE_URL}/oauth/callback`;

/**
 * Webhook base URL for workflow triggers
 */
export const WEBHOOK_BASE_URL = `${MCP_BASE_URL}/webhooks`;

// ============================================================================
// CORS Configuration
// ============================================================================

/**
 * Allowed origins for CORS
 * Add your frontend domains here
 */
export const ALLOWED_ORIGINS = [
  'https://workway.co',
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
  
  // In development, allow all origins
  if (process.env.NODE_ENV === 'development') return true;
  
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
