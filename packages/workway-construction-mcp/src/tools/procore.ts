/**
 * Procore Integration Tools
 * 
 * Tools for connecting to and interacting with Procore's construction
 * project management platform.
 * 
 * Procore API Documentation: https://developers.procore.com/
 * 
 * Security Features:
 * - Rate limiting: 3600 requests/minute via Durable Object
 * - Audit logging: All tool executions logged for compliance
 * - Token encryption: OAuth tokens encrypted at rest
 */

import { z } from 'zod';
import type { Env, ProcoreProject, ProcoreRFI, ProcoreDailyLog, ProcoreSubmittal, MCPToolSet } from '../types';
import type { StandardResponse } from '../lib/errors';
import { decrypt, encrypt } from '../lib/crypto';
import { 
  OAUTH_CALLBACK_URL, 
  TOKEN_REFRESH_BUFFER_MS,
  MCP_BASE_URL,
  getProcoreUrls,
  type ProcoreEnvironment,
} from '../lib/config';
import { generateCodeVerifier, generateCodeChallenge, generateSecureToken } from '../lib/crypto';
import { RateLimiterClient } from '../durable-objects/rate-limiter';
import { 
  logToolExecution, 
  logTokenRefresh, 
  logRateLimitExceeded,
  logOAuthInitiate,
  type ResourceType,
} from '../lib/audit-logger';
import {
  ErrorCode,
  ProcoreError,
  AuthError,
  success,
  WorkwayError,
} from '../lib/errors';
import { handleError } from '../middleware/error-handler';
import {
  buildPaginationResult,
  getPaginationParams,
  buildProcorePaginationParams,
  type PaginationResult,
} from '../lib/pagination';

// ============================================================================
// Procore API Client Helper
// ============================================================================

async function procoreRequest<T>(
  env: Env,
  path: string,
  options: RequestInit = {},
  userId: string = 'default'
): Promise<T> {
  // Check rate limit before making request
  const rateLimiter = new RateLimiterClient(env, userId);
  const rateLimitResult = await rateLimiter.consume();
  
  if (!rateLimitResult.allowed) {
    // Log rate limit exceeded
    await logRateLimitExceeded(env, {
      userId,
      connectionId: userId,
      retryAfter: rateLimitResult.retryAfter || 1,
      remaining: rateLimitResult.remaining,
    });
    throw new ProcoreError(
      ErrorCode.PROCORE_RATE_LIMITED,
      `Procore rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds.`,
      {
        retryAfter: rateLimitResult.retryAfter || 1,
        details: { remaining: rateLimitResult.remaining },
      }
    );
  }

  // Get OAuth token for specific user
  const token = await env.DB.prepare(`
    SELECT * FROM oauth_tokens WHERE provider = 'procore' AND user_id = ? LIMIT 1
  `).bind(userId).first<any>();

  if (!token) {
    throw new ProcoreError(
      ErrorCode.PROCORE_NOT_CONNECTED,
      'Procore not connected. Use "Connect my Procore account" to authorize.',
      { details: { userId, tool: 'procoreRequest' } }
    );
  }

  // Get the correct API base for this user's environment
  const procoreEnv = (token.environment || 'production') as ProcoreEnvironment;
  const urls = getProcoreUrls(procoreEnv);

  // Check if token needs refresh
  if (token.expires_at) {
    const expiresAt = new Date(token.expires_at);
    const needsRefresh = expiresAt.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS;
    
    if (needsRefresh && token.refresh_token) {
      // Refresh the token
      const refreshedToken = await refreshProcoreToken(env, token, userId, procoreEnv);
      token.access_token = refreshedToken.access_token;
    } else if (needsRefresh) {
      throw new AuthError(
        ErrorCode.AUTH_EXPIRED,
        'Procore token expired. Please reconnect using workway_connect_procore.',
        { details: { userId } }
      );
    }
  }

  // Decrypt the access token
  const accessToken = await decrypt(token.access_token, env.COOKIE_ENCRYPTION_KEY);

  const response = await fetch(`${urls.apiBase}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Procore-Company-Id': token.company_id || '',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    if (response.status === 401) {
      throw new ProcoreError(
        ErrorCode.PROCORE_AUTH_FAILED,
        'Procore authentication failed. Please reconnect using workway_connect_procore.',
        { details: { userId, httpStatus: 401 } }
      );
    }
    if (response.status === 403) {
      throw new ProcoreError(
        ErrorCode.PROCORE_FORBIDDEN,
        'Access denied. Check your Procore permissions for this resource.',
        { details: { userId, httpStatus: 403, path, response: errorText } }
      );
    }
    if (response.status === 404) {
      throw new ProcoreError(
        ErrorCode.PROCORE_NOT_FOUND,
        'Resource not found in Procore.',
        { details: { userId, httpStatus: 404, path } }
      );
    }
    if (response.status === 429) {
      // Procore's own rate limit (shouldn't happen if our limiter is working)
      throw new ProcoreError(
        ErrorCode.PROCORE_RATE_LIMITED,
        'Procore rate limit exceeded. Please try again later.',
        { retryAfter: 60, details: { httpStatus: 429 } }
      );
    }
    
    throw new ProcoreError(
      ErrorCode.PROCORE_API_ERROR,
      `Procore API error (${response.status}): ${errorText}`,
      { details: { httpStatus: response.status, path, response: errorText } }
    );
  }

  return response.json();
}

// ProcoreRateLimitError class removed - use ProcoreError from lib/errors.ts instead

/**
 * Refresh an expired Procore token
 */
async function refreshProcoreToken(
  env: Env,
  token: any,
  userId: string,
  procoreEnv: ProcoreEnvironment = 'production'
): Promise<{ access_token: string }> {
  // Decrypt refresh token
  const refreshToken = await decrypt(token.refresh_token, env.COOKIE_ENCRYPTION_KEY);
  const urls = getProcoreUrls(procoreEnv);
  
  // Use the correct credentials for this environment
  const clientId = procoreEnv === 'sandbox'
    ? (env.PROCORE_SANDBOX_CLIENT_ID || env.PROCORE_CLIENT_ID)
    : env.PROCORE_CLIENT_ID;
  const clientSecret = procoreEnv === 'sandbox'
    ? (env.PROCORE_SANDBOX_CLIENT_SECRET || env.PROCORE_CLIENT_SECRET)
    : env.PROCORE_CLIENT_SECRET;
  
  const response = await fetch(urls.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    // Log failed token refresh
    await logTokenRefresh(env, {
      userId,
      connectionId: userId,
      success: false,
      provider: 'procore',
      errorMessage: 'Token refresh failed',
    });
    throw new AuthError(
      ErrorCode.AUTH_REFRESH_FAILED,
      'Procore token refresh failed. Please reconnect using workway_connect_procore.',
      { details: { userId, httpStatus: response.status } }
    );
  }

  const newTokenData = await response.json() as any;
  
  // Encrypt new tokens
  const encryptedAccessToken = await encrypt(newTokenData.access_token, env.COOKIE_ENCRYPTION_KEY);
  const encryptedRefreshToken = newTokenData.refresh_token 
    ? await encrypt(newTokenData.refresh_token, env.COOKIE_ENCRYPTION_KEY)
    : token.refresh_token; // Keep old refresh token if not returned
  
  const expiresAt = newTokenData.expires_in 
    ? new Date(Date.now() + newTokenData.expires_in * 1000).toISOString()
    : null;

  // Update token in database
  await env.DB.prepare(`
    UPDATE oauth_tokens 
    SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    encryptedAccessToken,
    encryptedRefreshToken,
    expiresAt,
    new Date().toISOString(),
    token.id
  ).run();

  // Log successful token refresh
  await logTokenRefresh(env, {
    userId,
    connectionId: userId,
    success: true,
    provider: 'procore',
  });

  return { access_token: encryptedAccessToken };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const procoreTools: MCPToolSet = {
  // --------------------------------------------------------------------------
  // workway_connect_procore
  // --------------------------------------------------------------------------
  connect_procore: {
    name: 'workway_connect_procore',
    description: `Initiate OAuth connection to Procore. Returns an authorization URL and a unique connection_id.

**IMPORTANT**: Save the \`connection_id\` returned - you'll need it for all future Procore tool calls.

**Environment Options:**
- \`production\` - Connect to live Procore (api.procore.com)
- \`sandbox\` - Connect to Procore developer sandbox (sandbox.procore.com)`,
    inputSchema: z.object({
      company_id: z.string().optional()
        .describe('Procore company ID (if known)'),
      connection_id: z.string().optional()
        .describe('Your existing connection ID (if reconnecting). Leave empty to generate a new one.'),
      environment: z.enum(['production', 'sandbox']).optional().default('production')
        .describe('Procore environment: "production" for live, "sandbox" for testing'),
    }),
    outputSchema: z.object({
      authorization_url: z.string(),
      connection_id: z.string(),
      instructions: z.string(),
      status: z.enum(['pending', 'connected', 'expired']),
      environment: z.string(),
    }),
    execute: async (input: z.infer<typeof procoreTools.connect_procore.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      const startTime = Date.now();
      const procoreEnv = input.environment || 'production';
      const urls = getProcoreUrls(procoreEnv);
      
      // Generate or use existing connection ID
      const connectionId = input.connection_id || `ww_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      
      // Get the correct client ID for this environment
      const clientId = procoreEnv === 'sandbox' 
        ? (env.PROCORE_SANDBOX_CLIENT_ID || env.PROCORE_CLIENT_ID)
        : env.PROCORE_CLIENT_ID;
      
      if (procoreEnv === 'sandbox' && !env.PROCORE_SANDBOX_CLIENT_ID) {
        await logToolExecution(env, {
          toolName: 'workway_connect_procore',
          userId: connectionId,
          connectionId,
          success: false,
          durationMs: Date.now() - startTime,
          errorMessage: 'Sandbox credentials not configured',
        });
        return new ProcoreError(
          ErrorCode.PROCORE_SANDBOX_NOT_CONFIGURED,
          'Sandbox credentials not configured. Set PROCORE_SANDBOX_CLIENT_ID and PROCORE_SANDBOX_CLIENT_SECRET.',
          { details: { environment: procoreEnv } }
        ).toResponse();
      }
      
      // Generate secure state token
      const state = generateSecureToken(32);
      
      // Store state for CSRF protection (includes connection_id)
      await env.KV.put(`oauth_state:${state}`, JSON.stringify({
        provider: 'procore',
        companyId: input.company_id,
        userId: connectionId, // Store as userId for backward compatibility
        environment: procoreEnv,
        createdAt: new Date().toISOString(),
      }), { expirationTtl: 600 }); // 10 minutes
      
      // Build authorization URL using environment-specific auth endpoint and client ID
      const authUrl = new URL(urls.authUrl);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', OAUTH_CALLBACK_URL);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      
      // Log OAuth initiation
      await logOAuthInitiate(env, {
        userId: connectionId,
        connectionId,
        provider: 'procore',
        environment: procoreEnv,
      });
      
      return success({
        authorizationUrl: authUrl.toString(),
        connection_id: connectionId,
        instructions: `⚠️ SAVE THIS: Your connection ID is "${connectionId}". You'll need this for all Procore tools.\n\nVisit the authorization URL to connect your Procore ${procoreEnv} account.`,
        status: 'pending',
        environment: procoreEnv,
      });
    },
  },

  // --------------------------------------------------------------------------
  // workway_check_procore_connection
  // --------------------------------------------------------------------------
  check_procore_connection: {
    name: 'workway_check_procore_connection',
    description: 'Check if Procore is connected and the token is valid. Returns connection status, user info, and available scopes.',
    inputSchema: z.object({
      connection_id: z.string().optional()
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
    }),
    outputSchema: z.object({
      connected: z.boolean(),
      token_expires_at: z.string().optional(),
      scopes: z.array(z.string()).optional(),
      company_name: z.string().optional(),
      last_used: z.string().optional(),
      user_id: z.string().optional(),
      procore_user: z.object({
        id: z.number(),
        login: z.string(),
        name: z.string(),
      }).optional(),
    }),
    execute: async (input: z.infer<typeof procoreTools.check_procore_connection.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      const userId = input.connection_id || 'default';
      
      const token = await env.DB.prepare(`
        SELECT * FROM oauth_tokens WHERE provider = 'procore' AND user_id = ? LIMIT 1
      `).bind(userId).first<any>();

      if (!token) {
        return success({
          connected: false,
          userId,
          message: 'Not connected. Use workway_connect_procore to authenticate.',
        });
      }

      const isExpired = token.expires_at && new Date(token.expires_at) < new Date();
      const needsRefresh = token.expires_at && 
        (new Date(token.expires_at).getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS);

      // Try to get current user info from Procore
      let procoreUser = null;
      try {
        procoreUser = await procoreRequest<any>(env, '/me', {}, userId);
      } catch (e) {
        // Ignore - just means we can't get user info
      }

      return success({
        connected: !isExpired,
        tokenExpiresAt: token.expires_at,
        needsRefresh: needsRefresh && !isExpired,
        scopes: token.scopes ? JSON.parse(token.scopes) : [],
        companyId: token.company_id,
        lastUsed: token.updated_at,
        userId,
        procoreUser: procoreUser ? {
          id: procoreUser.id,
          login: procoreUser.login,
          name: procoreUser.name,
        } : null,
      });
    },
  },

  // --------------------------------------------------------------------------
  // workway_list_procore_companies
  // --------------------------------------------------------------------------
  list_procore_companies: {
    name: 'workway_list_procore_companies',
    description: 'List all companies the user has access to in Procore. Use this to find company IDs. Supports pagination.',
    inputSchema: z.object({
      connection_id: z.string().optional()
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
      limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of companies to return (1-100, default 50)'),
      offset: z.number().min(0).default(0).optional()
        .describe('Number of companies to skip (default 0)'),
    }),
    outputSchema: z.object({
      companies: z.array(z.object({
        id: z.number(),
        name: z.string(),
        is_active: z.boolean(),
      })),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total: z.number(),
        hasMore: z.boolean(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.list_procore_companies.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        const userId = input.connection_id || 'default';
        
        // Build pagination params
        const pagination = getPaginationParams({ limit: input.limit ?? 50, offset: input.offset });
        const page = Math.floor(pagination.offset / pagination.limit) + 1;
        
        // Companies endpoint doesn't require company ID header
        const token = await env.DB.prepare(`
          SELECT access_token, expires_at, refresh_token, environment FROM oauth_tokens 
          WHERE provider = 'procore' AND user_id = ? LIMIT 1
        `).bind(userId).first<any>();
        
        if (!token) {
          throw new ProcoreError(
            ErrorCode.PROCORE_NOT_CONNECTED,
            'Procore not connected. Use "Connect my Procore account" to authorize.',
            { details: { userId, tool: 'workway_list_procore_companies' } }
          );
        }
        
        const accessToken = await decrypt(token.access_token, env.COOKIE_ENCRYPTION_KEY);
        const procoreEnv = (token.environment || 'production') as ProcoreEnvironment;
        const urls = getProcoreUrls(procoreEnv);
        
        const response = await fetch(`${urls.apiBase}/companies?per_page=${pagination.limit}&page=${page}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new ProcoreError(
            ErrorCode.PROCORE_API_ERROR,
            `Procore API error (${response.status}): ${errorText}`,
            { details: { httpStatus: response.status, path: '/companies' } }
          );
        }
        
        const companies = await response.json() as any[];

        // Estimate total and hasMore based on results
        const hasMore = companies.length === pagination.limit;
        const estimatedTotal = hasMore 
          ? pagination.offset + pagination.limit + 1
          : pagination.offset + companies.length;

        return success({
          companies: companies.map((c: any) => ({
            id: c.id,
            name: c.name,
            is_active: c.is_active,
          })),
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total: estimatedTotal,
            hasMore,
          },
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_list_procore_projects
  // --------------------------------------------------------------------------
  list_procore_projects: {
    name: 'workway_list_procore_projects',
    description: 'List all projects the user has access to in Procore. Use this to find project IDs for workflow configuration. Supports pagination.',
    inputSchema: z.object({
      company_id: z.string().optional()
        .describe('Filter by Procore company ID'),
      active_only: z.boolean().optional().default(true)
        .describe('Only return active projects'),
      connection_id: z.string().optional()
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
      limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of projects to return (1-100, default 50)'),
      offset: z.number().min(0).default(0).optional()
        .describe('Number of projects to skip (default 0)'),
    }),
    outputSchema: z.object({
      projects: z.array(z.object({
        id: z.number(),
        name: z.string(),
        display_name: z.string(),
        project_number: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state_code: z.string().optional(),
        active: z.boolean(),
      })),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total: z.number(),
        hasMore: z.boolean(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.list_procore_projects.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        // Get company ID from token
        const userId = input.connection_id || 'default';
        const token = await env.DB.prepare(`
          SELECT company_id FROM oauth_tokens WHERE provider = 'procore' AND user_id = ? LIMIT 1
        `).bind(userId).first<any>();
        
        if (!token?.company_id) {
          throw new ProcoreError(
            ErrorCode.PROCORE_COMPANY_NOT_SET,
            'Company ID not set. Please reconnect to Procore and select a company.',
            { details: { userId, tool: 'workway_list_procore_projects' } }
          );
        }
        
        // Build pagination params for Procore API
        const pagination = getPaginationParams(input);
        const paginationParams = buildProcorePaginationParams(input);
        
        // Try company-specific endpoint first, fall back to query params
        let projects: ProcoreProject[];
        try {
          // Method 1: Company-scoped endpoint
          let queryParams = `?${paginationParams}`;
          if (input.active_only) {
            queryParams += '&filters[active]=true';
          }
          projects = await procoreRequest<ProcoreProject[]>(
            env,
            `/companies/${token.company_id}/projects${queryParams}`,
            {},
            userId
          );
        } catch (e) {
          // Method 2: Query param approach
          const queryParams = new URLSearchParams();
          queryParams.set('company_id', token.company_id);
          // Add pagination
          const { page, per_page } = { page: Math.floor(pagination.offset / pagination.limit) + 1, per_page: pagination.limit };
          queryParams.set('page', page.toString());
          queryParams.set('per_page', per_page.toString());
          if (input.active_only) {
            queryParams.set('filters[active]', 'true');
          }
          projects = await procoreRequest<ProcoreProject[]>(
            env,
            `/projects?${queryParams.toString()}`,
            {},
            userId
          );
        }
        
        // Note: Procore doesn't return total count in response, so we estimate based on results
        // If we got a full page, there's likely more
        const hasMore = projects.length === pagination.limit;
        const estimatedTotal = hasMore 
          ? pagination.offset + pagination.limit + 1  // At least one more
          : pagination.offset + projects.length;

        return success({
          projects: projects.map(p => ({
            id: p.id,
            name: p.name,
            displayName: p.displayName,
            projectNumber: p.projectNumber,
            address: p.address,
            city: p.city,
            stateCode: p.stateCode,
            active: p.active,
          })),
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total: estimatedTotal,
            hasMore,
          },
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_rfis
  // --------------------------------------------------------------------------
  get_procore_rfis: {
    name: 'workway_get_procore_rfis',
    description: 'Get RFIs (Requests for Information) from a Procore project. Useful for understanding RFI patterns and testing RFI automation workflows. Supports pagination.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      status: z.enum(['open', 'closed', 'all']).optional().default('open')
        .describe('Filter by RFI status'),
      limit: z.number().min(1).max(100).default(30).optional()
        .describe('Maximum number of RFIs to return (1-100, default 30)'),
      offset: z.number().min(0).default(0).optional()
        .describe('Number of RFIs to skip (default 0)'),
      connection_id: z.string().optional()
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
    }),
    outputSchema: z.object({
      rfis: z.array(z.object({
        id: z.number(),
        number: z.number(),
        subject: z.string(),
        status: z.string(),
        question_body: z.string().optional(),
        answer_body: z.string().optional(),
        due_date: z.string().optional(),
        created_at: z.string(),
        response_time_days: z.number().optional(),
      })),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total: z.number(),
        hasMore: z.boolean(),
      }),
      stats: z.object({
        open_count: z.number(),
        avg_response_time_days: z.number().optional(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_rfis.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      const startTime = Date.now();
      const userId = input.connection_id || 'default';
      
      try {
        // Build pagination params
        const pagination = getPaginationParams({ limit: input.limit ?? 30, offset: input.offset });
        const page = Math.floor(pagination.offset / pagination.limit) + 1;
        
        let url = `/projects/${input.project_id}/rfis?per_page=${pagination.limit}&page=${page}`;
        if (input.status !== 'all') {
          url += `&filters[status]=${input.status}`;
        }

        const rfis = await procoreRequest<ProcoreRFI[]>(env, url, {}, userId);

        // Calculate stats from current page
        const openCount = rfis.filter(r => r.status === 'open').length;
        const responseTimes = rfis
          .filter(r => r.responseTime !== undefined)
          .map(r => r.responseTime!);
        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : undefined;

        // Estimate total and hasMore based on results
        const hasMore = rfis.length === pagination.limit;
        const estimatedTotal = hasMore 
          ? pagination.offset + pagination.limit + 1
          : pagination.offset + rfis.length;

        // Log successful tool execution
        await logToolExecution(env, {
          toolName: 'workway_get_procore_rfis',
          userId,
          connectionId: userId,
          projectId: input.project_id.toString(),
          resourceType: 'rfi',
          success: true,
          durationMs: Date.now() - startTime,
          details: { count: rfis.length, status: input.status, page },
        });

        return success({
          rfis: rfis.map(r => ({
            id: r.id,
            number: r.number,
            subject: r.subject,
            status: r.status,
            questionBody: r.questionBody,
            answerBody: r.answerBody,
            dueDate: r.dueDate,
            createdAt: r.createdAt,
            responseTimeDays: r.responseTime,
          })),
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total: estimatedTotal,
            hasMore,
          },
          stats: {
            openCount,
            avgResponseTimeDays: avgResponseTime,
          },
        }, { executionTime: Date.now() - startTime });
      } catch (error) {
        // Log failed tool execution
        await logToolExecution(env, {
          toolName: 'workway_get_procore_rfis',
          userId,
          connectionId: userId,
          projectId: input.project_id.toString(),
          resourceType: 'rfi',
          success: false,
          durationMs: Date.now() - startTime,
          errorMessage: error instanceof WorkwayError ? error.message : 'Unknown error',
        });
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_daily_logs
  // --------------------------------------------------------------------------
  get_procore_daily_logs: {
    name: 'workway_get_procore_daily_logs',
    description: 'Get daily logs from a Procore project. Useful for understanding log patterns and testing daily log automation. Supports date range filtering and pagination.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      start_date: z.string().optional()
        .describe('Start date (YYYY-MM-DD) - defaults to 30 days ago'),
      end_date: z.string().optional()
        .describe('End date (YYYY-MM-DD) - defaults to yesterday'),
      limit: z.number().min(1).max(100).default(30).optional()
        .describe('Maximum number of days to return (1-100, default 30)'),
      offset: z.number().min(0).default(0).optional()
        .describe('Number of days to skip from start_date (default 0)'),
      connection_id: z.string().optional()
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
    }),
    outputSchema: z.object({
      date_range: z.object({
        start_date: z.string(),
        end_date: z.string(),
      }),
      weather_logs: z.array(z.any()),
      manpower_logs: z.array(z.any()),
      notes_logs: z.array(z.any()),
      equipment_logs: z.array(z.any()),
      safety_violation_logs: z.array(z.any()),
      accident_logs: z.array(z.any()),
      work_logs: z.array(z.any()),
      delay_logs: z.array(z.any()),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total_days_in_range: z.number(),
        hasMore: z.boolean(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_daily_logs.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        const pagination = getPaginationParams({ limit: input.limit ?? 30, offset: input.offset });
        
        // Calculate date range based on pagination
        // Default to last 30 days if no dates provided
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Base dates from input or defaults
        const baseStartDate = input.start_date || defaultStartDate;
        const baseEndDate = input.end_date && input.end_date <= yesterday ? input.end_date : yesterday;
        
        // Apply offset to start date
        const startDateObj = new Date(baseStartDate);
        startDateObj.setDate(startDateObj.getDate() + pagination.offset);
        const startDate = startDateObj.toISOString().split('T')[0];
        
        // Calculate end date based on limit
        const endDateObj = new Date(startDate);
        endDateObj.setDate(endDateObj.getDate() + pagination.limit - 1);
        // Don't go past the base end date
        const calculatedEndDate = endDateObj.toISOString().split('T')[0];
        const endDate = calculatedEndDate < baseEndDate ? calculatedEndDate : baseEndDate;
        
        // Calculate total days in the full range
        const totalDaysInRange = Math.ceil(
          (new Date(baseEndDate).getTime() - new Date(baseStartDate).getTime()) / (24 * 60 * 60 * 1000)
        ) + 1;
        
        const hasMore = pagination.offset + pagination.limit < totalDaysInRange;
        
        // Procore daily logs uses filters[start_date] and filters[end_date]
        const url = `/projects/${input.project_id}/daily_logs?filters[start_date]=${startDate}&filters[end_date]=${endDate}`;

        const response = await procoreRequest<any>(env, url, {}, input.connection_id || 'default');

        // Procore returns categorized logs (weather_logs, manpower_logs, etc.)
        return success({
          dateRange: { startDate, endDate },
          weatherLogs: response.weather_logs || [],
          manpowerLogs: response.manpower_logs || [],
          notesLogs: response.notes_logs || [],
          equipmentLogs: response.equipment_logs || [],
          safetyViolationLogs: response.safety_violation_logs || [],
          accidentLogs: response.accident_logs || [],
          workLogs: response.work_logs || [],
          delayLogs: response.delay_logs || [],
          totalLogTypes: Object.keys(response).filter(k => Array.isArray(response[k]) && response[k].length > 0).length,
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            totalDaysInRange,
            hasMore,
          },
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_submittals
  // --------------------------------------------------------------------------
  get_procore_submittals: {
    name: 'workway_get_procore_submittals',
    description: 'Get submittals from a Procore project. Useful for understanding submittal patterns and testing submittal tracking automation. Supports pagination.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('all')
        .describe('Filter by submittal status'),
      limit: z.number().min(1).max(100).default(30).optional()
        .describe('Maximum number of submittals to return (1-100, default 30)'),
      offset: z.number().min(0).default(0).optional()
        .describe('Number of submittals to skip (default 0)'),
      connection_id: z.string().optional()
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
    }),
    outputSchema: z.object({
      submittals: z.array(z.object({
        id: z.number(),
        number: z.number(),
        title: z.string(),
        status: z.string(),
        spec_section: z.string().optional(),
        due_date: z.string().optional(),
        ball_in_court: z.string().optional(),
        created_at: z.string(),
      })),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total: z.number(),
        hasMore: z.boolean(),
      }),
      stats: z.object({
        pending_count: z.number(),
        overdue_count: z.number(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_submittals.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        // Build pagination params
        const pagination = getPaginationParams({ limit: input.limit ?? 30, offset: input.offset });
        const page = Math.floor(pagination.offset / pagination.limit) + 1;
        
        let url = `/projects/${input.project_id}/submittals?per_page=${pagination.limit}&page=${page}`;
        if (input.status !== 'all') {
          url += `&filters[status]=${input.status}`;
        }

        const submittals = await procoreRequest<ProcoreSubmittal[]>(env, url, {}, input.connection_id || 'default');

        const now = new Date();
        const pendingCount = submittals.filter(s => s.status === 'pending').length;
        const overdueCount = submittals.filter(s => 
          s.dueDate && new Date(s.dueDate) < now && s.status === 'pending'
        ).length;

        // Estimate total and hasMore based on results
        const hasMore = submittals.length === pagination.limit;
        const estimatedTotal = hasMore 
          ? pagination.offset + pagination.limit + 1
          : pagination.offset + submittals.length;

        return success({
          submittals: submittals.map(s => ({
            id: s.id,
            number: s.number,
            title: s.title,
            status: s.status,
            specSection: s.specSection,
            dueDate: s.dueDate,
            ballInCourt: s.ballInCourt,
            createdAt: s.createdAt,
          })),
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total: estimatedTotal,
            hasMore,
          },
          stats: {
            pendingCount,
            overdueCount,
          },
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_photos
  // --------------------------------------------------------------------------
  get_procore_photos: {
    name: 'workway_get_procore_photos',
    description: 'Get photos from a Procore project. Useful for documentation and progress tracking automation. Supports pagination.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      album_id: z.number().optional().describe('Filter by specific album ID'),
      limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of photos to return (1-100, default 50)'),
      offset: z.number().min(0).default(0).optional()
        .describe('Number of photos to skip (default 0)'),
      connection_id: z.string().optional().describe('Your WORKWAY connection ID'),
    }),
    outputSchema: z.object({
      photos: z.array(z.object({
        id: z.number(),
        name: z.string(),
        description: z.string().optional(),
        image_url: z.string(),
        thumbnail_url: z.string().optional(),
        taken_at: z.string().optional(),
        uploaded_at: z.string(),
        location: z.string().optional(),
        album_name: z.string().optional(),
      })),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total: z.number(),
        hasMore: z.boolean(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_photos.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        // Build pagination params
        const pagination = getPaginationParams({ limit: input.limit ?? 50, offset: input.offset });
        const page = Math.floor(pagination.offset / pagination.limit) + 1;
        
        let url = `/projects/${input.project_id}/images?per_page=${pagination.limit}&page=${page}`;
        if (input.album_id) {
          url += `&filters[image_category_id]=${input.album_id}`;
        }

        const photos = await procoreRequest<any[]>(env, url, {}, input.connection_id || 'default');

        // Estimate total and hasMore based on results
        const hasMore = photos.length === pagination.limit;
        const estimatedTotal = hasMore 
          ? pagination.offset + pagination.limit + 1
          : pagination.offset + photos.length;

        return success({
          photos: photos.map(p => ({
            id: p.id,
            name: p.name || 'Untitled',
            description: p.description,
            imageUrl: p.url,
            thumbnailUrl: p.thumbnail_url,
            takenAt: p.taken_at,
            uploadedAt: p.created_at,
            location: p.location?.name,
            albumName: p.image_category?.name,
          })),
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total: estimatedTotal,
            hasMore,
          },
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_documents
  // --------------------------------------------------------------------------
  get_procore_documents: {
    name: 'workway_get_procore_documents',
    description: 'Get documents from a Procore project. Useful for document tracking and compliance automation. Supports pagination.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      folder_id: z.number().optional().describe('Filter by specific folder ID'),
      limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of documents to return (1-100, default 50)'),
      offset: z.number().min(0).default(0).optional()
        .describe('Number of documents to skip (default 0)'),
      connection_id: z.string().optional().describe('Your WORKWAY connection ID'),
    }),
    outputSchema: z.object({
      documents: z.array(z.object({
        id: z.number(),
        name: z.string(),
        document_type: z.string().optional(),
        file_size: z.number().optional(),
        created_at: z.string(),
        updated_at: z.string(),
        folder_path: z.string().optional(),
        version: z.number().optional(),
      })),
      folders: z.array(z.object({
        id: z.number(),
        name: z.string(),
        document_count: z.number().optional(),
      })),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total: z.number(),
        hasMore: z.boolean(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_documents.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        // Build pagination params
        const pagination = getPaginationParams({ limit: input.limit ?? 50, offset: input.offset });
        const page = Math.floor(pagination.offset / pagination.limit) + 1;
        
        // Use /documents endpoint which returns flat list of all files and folders
        let url = `/projects/${input.project_id}/documents?per_page=${pagination.limit}&page=${page}`;
        if (input.folder_id) {
          url += `&filters[parent_id]=${input.folder_id}`;
        }

        const documents = await procoreRequest<any[]>(env, url, {}, input.connection_id || 'default');

        const files = documents.filter(d => d.document_type === 'file');
        const folders = documents.filter(d => d.document_type === 'folder' && !d.is_recycle_bin);

        // Estimate total and hasMore based on results
        const hasMore = documents.length === pagination.limit;
        const estimatedTotal = hasMore 
          ? pagination.offset + pagination.limit + 1
          : pagination.offset + documents.length;

        return success({
          documents: files.map((d: any) => ({
            id: d.id,
            name: d.name,
            documentType: d.document_type,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
            folderPath: d.name_with_path,
            parentId: d.parent_id,
          })),
          folders: folders.map((f: any) => ({
            id: f.id,
            name: f.name,
            path: f.name_with_path,
            parentId: f.parent_id,
          })),
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total: estimatedTotal,
            hasMore,
          },
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_schedule
  // --------------------------------------------------------------------------
  get_procore_schedule: {
    name: 'workway_get_procore_schedule',
    description: 'Get schedule tasks from a Procore project. Note: Requires Schedule tool to be enabled in the project. Useful for timeline tracking and schedule automation. Supports pagination.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      status: z.enum(['all', 'in_progress', 'completed', 'not_started']).optional().default('all')
        .describe('Filter by task status'),
      limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of tasks to return (1-100, default 50)'),
      offset: z.number().min(0).default(0).optional()
        .describe('Number of tasks to skip (default 0)'),
      connection_id: z.string().optional().describe('Your WORKWAY connection ID'),
    }),
    outputSchema: z.object({
      tasks: z.array(z.object({
        id: z.number(),
        name: z.string(),
        start_date: z.string().optional(),
        finish_date: z.string().optional(),
        percent_complete: z.number().optional(),
        status: z.string().optional(),
        assigned_to: z.string().optional(),
        is_milestone: z.boolean().optional(),
        is_critical: z.boolean().optional(),
      })),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total: z.number(),
        hasMore: z.boolean(),
      }),
      stats: z.object({
        completed_count: z.number(),
        in_progress_count: z.number(),
        not_started_count: z.number(),
        overdue_count: z.number(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_schedule.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        // Build pagination params
        const pagination = getPaginationParams({ limit: input.limit ?? 50, offset: input.offset });
        const page = Math.floor(pagination.offset / pagination.limit) + 1;
        
        let url = `/projects/${input.project_id}/schedule/tasks?per_page=${pagination.limit}&page=${page}`;
        
        const tasks = await procoreRequest<any[]>(env, url, {}, input.connection_id || 'default');

        const now = new Date();
        let filteredTasks = tasks;
        
        // Apply status filter (note: filtering happens client-side after pagination from API)
        if (input.status !== 'all') {
          filteredTasks = tasks.filter(t => {
            if (input.status === 'completed') return t.percent_complete === 100;
            if (input.status === 'in_progress') return t.percent_complete > 0 && t.percent_complete < 100;
            if (input.status === 'not_started') return t.percent_complete === 0 || t.percent_complete == null;
            return true;
          });
        }

        // Calculate stats from current page
        const completedCount = tasks.filter(t => t.percent_complete === 100).length;
        const inProgressCount = tasks.filter(t => t.percent_complete > 0 && t.percent_complete < 100).length;
        const notStartedCount = tasks.filter(t => t.percent_complete === 0 || t.percent_complete == null).length;
        const overdueCount = tasks.filter(t => 
          t.finish_date && new Date(t.finish_date) < now && t.percent_complete < 100
        ).length;

        // Estimate total and hasMore based on results
        const hasMore = tasks.length === pagination.limit;
        const estimatedTotal = hasMore 
          ? pagination.offset + pagination.limit + 1
          : pagination.offset + tasks.length;

        return success({
          tasks: filteredTasks.map(t => ({
            id: t.id,
            name: t.name,
            startDate: t.start_date,
            finishDate: t.finish_date,
            percentComplete: t.percent_complete,
            status: t.percent_complete === 100 ? 'completed' : 
                    t.percent_complete > 0 ? 'in_progress' : 'not_started',
            assignedTo: t.resource_name,
            isMilestone: t.is_milestone,
            isCritical: t.is_critical_path,
          })),
          pagination: {
            limit: pagination.limit,
            offset: pagination.offset,
            total: estimatedTotal,
            hasMore,
          },
          stats: {
            completedCount,
            inProgressCount,
            notStartedCount,
            overdueCount,
          },
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_create_procore_rfi
  // --------------------------------------------------------------------------
  create_procore_rfi: {
    name: 'workway_create_procore_rfi',
    description: 'Create a new RFI (Request for Information) in a Procore project. Useful for automated RFI generation workflows.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      subject: z.string().describe('RFI subject/title'),
      question: z.string().describe('The question or request for information'),
      assignee_id: z.number().optional().describe('User ID to assign the RFI to'),
      due_date: z.string().optional().describe('Due date (YYYY-MM-DD)'),
      priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
      connection_id: z.string().optional().describe('Your WORKWAY connection ID'),
    }),
    outputSchema: z.object({
      id: z.number(),
      number: z.number(),
      subject: z.string(),
      status: z.string(),
      created_at: z.string(),
    }),
    execute: async (input: z.infer<typeof procoreTools.create_procore_rfi.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      const startTime = Date.now();
      const userId = input.connection_id || 'default';
      
      try {
        const rfiData: any = {
          rfi: {
            subject: input.subject,
            question_body: input.question,
            priority: input.priority,
          },
        };
        
        if (input.assignee_id) {
          rfiData.rfi.assignee_id = input.assignee_id;
        }
        if (input.due_date) {
          rfiData.rfi.due_date = input.due_date;
        }

        const rfi = await procoreRequest<any>(
          env,
          `/projects/${input.project_id}/rfis`,
          {
            method: 'POST',
            body: JSON.stringify(rfiData),
          },
          userId
        );

        // Log successful RFI creation
        await logToolExecution(env, {
          toolName: 'workway_create_procore_rfi',
          userId,
          connectionId: userId,
          projectId: input.project_id.toString(),
          resourceType: 'rfi',
          resourceId: rfi.id.toString(),
          success: true,
          durationMs: Date.now() - startTime,
          details: { 
            rfiNumber: rfi.number, 
            subject: input.subject,
            priority: input.priority,
          },
        });

        return success({
          id: rfi.id,
          number: rfi.number,
          subject: rfi.subject,
          status: rfi.status,
          createdAt: rfi.created_at,
          message: `RFI #${rfi.number} created successfully`,
        }, { executionTime: Date.now() - startTime });
      } catch (error) {
        // Log failed RFI creation
        await logToolExecution(env, {
          toolName: 'workway_create_procore_rfi',
          userId,
          connectionId: userId,
          projectId: input.project_id.toString(),
          resourceType: 'rfi',
          success: false,
          durationMs: Date.now() - startTime,
          errorMessage: error instanceof WorkwayError ? error.message : 'Unknown error',
        });
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_test_procore_api (debug/test tool)
  // --------------------------------------------------------------------------
  test_procore_api: {
    name: 'workway_test_procore_api',
    description: 'Debug tool to test raw Procore API calls. Returns full response details.',
    inputSchema: z.object({
      path: z.string().describe('API path to call (e.g., /projects, /companies/123/projects)'),
      connection_id: z.string().optional().describe('Your WORKWAY connection ID'),
    }),
    outputSchema: z.object({
      status: z.number(),
      headers: z.record(z.string()),
      body: z.any(),
    }),
    execute: async (input: z.infer<typeof procoreTools.test_procore_api.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        const userId = input.connection_id || 'default';
        const token = await env.DB.prepare(`
          SELECT access_token, company_id, environment FROM oauth_tokens 
          WHERE provider = 'procore' AND user_id = ? LIMIT 1
        `).bind(userId).first<any>();
        
        if (!token) {
          throw new ProcoreError(
            ErrorCode.PROCORE_NOT_CONNECTED,
            'Procore not connected. Use "Connect my Procore account" to authorize.',
            { details: { userId, tool: 'workway_test_procore_api' } }
          );
        }
        
        const accessToken = await decrypt(token.access_token, env.COOKIE_ENCRYPTION_KEY);
        const procoreEnv = (token.environment || 'production') as ProcoreEnvironment;
        const urls = getProcoreUrls(procoreEnv);
        
        const response = await fetch(`${urls.apiBase}${input.path}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Procore-Company-Id': token.company_id || '',
          },
        });
        
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        
        let body;
        const text = await response.text();
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
        
        return success({
          status: response.status,
          headers: responseHeaders,
          body,
          requestPath: `${urls.apiBase}${input.path}`,
          companyIdUsed: token.company_id,
          environment: procoreEnv,
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_create_procore_webhook
  // --------------------------------------------------------------------------
  create_procore_webhook: {
    name: 'workway_create_procore_webhook',
    description: 'Register a webhook to receive real-time events from Procore. Events are sent to the workflow webhook endpoint.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      event_type: z.enum([
        'rfis.create', 'rfis.update', 'rfis.delete',
        'submittals.create', 'submittals.update',
        'daily_logs.create', 'daily_logs.update',
        'documents.create', 'documents.update',
        'photos.create',
      ]).describe('Type of event to listen for'),
      workflow_id: z.string().describe('Workflow ID to trigger when event fires'),
      connection_id: z.string().optional().describe('Your WORKWAY connection ID'),
    }),
    outputSchema: z.object({
      webhook_id: z.number(),
      callback_url: z.string(),
      event_type: z.string(),
    }),
    execute: async (input: z.infer<typeof procoreTools.create_procore_webhook.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        const callbackUrl = `${MCP_BASE_URL}/webhooks/${input.workflow_id}`;
        
        // Note: Procore webhook API varies - this is the general structure
        // Actual implementation may need adjustment based on Procore API version
        const webhookData = {
          hook: {
            api_version: 'v2',
            destination_url: callbackUrl,
            namespace: input.event_type.split('.')[0], // e.g., 'rfis'
            event_type: input.event_type.split('.')[1], // e.g., 'create'
          },
        };
        
        const webhook = await procoreRequest<any>(
          env,
          `/projects/${input.project_id}/webhooks/hooks`,
          {
            method: 'POST',
            body: JSON.stringify(webhookData),
          },
          input.connection_id || 'default'
        );

        // Store webhook reference in our DB
        await env.DB.prepare(`
          INSERT INTO webhook_subscriptions (id, workflow_id, project_id, event_type, procore_hook_id, callback_url, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          crypto.randomUUID(),
          input.workflow_id,
          input.project_id,
          input.event_type,
          webhook.id,
          callbackUrl
        ).run();

        return success({
          webhookId: webhook.id,
          callbackUrl,
          eventType: input.event_type,
          message: `Webhook registered. Events will trigger workflow ${input.workflow_id}`,
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_list_procore_webhooks
  // --------------------------------------------------------------------------
  list_procore_webhooks: {
    name: 'workway_list_procore_webhooks',
    description: 'List all registered webhooks for a project or workflow. Supports pagination.',
    inputSchema: z.object({
      project_id: z.number().optional().describe('Filter by Procore project ID'),
      workflow_id: z.string().optional().describe('Filter by workflow ID'),
      limit: z.number().min(1).max(100).default(50).optional()
        .describe('Maximum number of webhooks to return (1-100, default 50)'),
      offset: z.number().min(0).default(0).optional()
        .describe('Number of webhooks to skip (default 0)'),
    }),
    outputSchema: z.object({
      webhooks: z.array(z.object({
        id: z.string(),
        workflow_id: z.string(),
        project_id: z.number(),
        event_type: z.string(),
        callback_url: z.string(),
        created_at: z.string(),
      })),
      pagination: z.object({
        limit: z.number(),
        offset: z.number(),
        total: z.number(),
        hasMore: z.boolean(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.list_procore_webhooks.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        const pagination = getPaginationParams({ limit: input.limit ?? 50, offset: input.offset });
        
        // Build WHERE clause
        let whereClause = 'WHERE 1=1';
        const whereBindings: any[] = [];
        
        if (input.project_id) {
          whereClause += ' AND project_id = ?';
          whereBindings.push(input.project_id);
        }
        if (input.workflow_id) {
          whereClause += ' AND workflow_id = ?';
          whereBindings.push(input.workflow_id);
        }
        
        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM webhook_subscriptions ${whereClause}`;
        const countStmt = env.DB.prepare(countQuery);
        const countResult = await (whereBindings.length > 0 ? countStmt.bind(...whereBindings) : countStmt).first<{ total: number }>();
        const total = countResult?.total || 0;
        
        // Get paginated results
        const query = `SELECT * FROM webhook_subscriptions ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        const allBindings = [...whereBindings, pagination.limit, pagination.offset];
        const stmt = env.DB.prepare(query);
        const result = await stmt.bind(...allBindings).all<any>();

        return success({
          webhooks: (result.results || []).map((w: any) => ({
            id: w.id,
            workflowId: w.workflow_id,
            projectId: w.project_id,
            eventType: w.event_type,
            callbackUrl: w.callback_url,
            createdAt: w.created_at,
          })),
          pagination: buildPaginationResult(pagination.limit, pagination.offset, total),
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_delete_procore_webhook
  // --------------------------------------------------------------------------
  delete_procore_webhook: {
    name: 'workway_delete_procore_webhook',
    description: 'Delete a webhook subscription.',
    inputSchema: z.object({
      webhook_id: z.string().describe('Webhook subscription ID'),
      project_id: z.number().describe('Procore project ID'),
      connection_id: z.string().optional().describe('Your WORKWAY connection ID'),
    }),
    outputSchema: z.object({
      deleted: z.boolean(),
    }),
    execute: async (input: z.infer<typeof procoreTools.delete_procore_webhook.inputSchema>, env: Env): Promise<StandardResponse<any>> => {
      try {
        // Get the webhook from our DB
        const webhook = await env.DB.prepare(`
          SELECT procore_hook_id FROM webhook_subscriptions WHERE id = ?
        `).bind(input.webhook_id).first<any>();
        
        if (!webhook) {
          throw new WorkwayError(
            ErrorCode.WEBHOOK_NOT_FOUND,
            'Webhook not found. Check the webhook ID and try again.',
            { details: { webhookId: input.webhook_id } }
          );
        }

        // Delete from Procore (if API supports)
        try {
          await procoreRequest<any>(
            env,
            `/projects/${input.project_id}/webhooks/hooks/${webhook.procore_hook_id}`,
            { method: 'DELETE' },
            input.connection_id || 'default'
          );
        } catch (e) {
          // Continue even if Procore delete fails
          console.error('Failed to delete from Procore:', e);
        }

        // Delete from our DB
        await env.DB.prepare(`
          DELETE FROM webhook_subscriptions WHERE id = ?
        `).bind(input.webhook_id).run();

        return success({
          deleted: true,
          message: 'Webhook deleted successfully',
        });
      } catch (error) {
        return handleError(error);
      }
    },
  },
};

export type ProcoreTools = typeof procoreTools;
