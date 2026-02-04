/**
 * Procore Integration Tools
 * 
 * Tools for connecting to and interacting with Procore's construction
 * project management platform.
 * 
 * Procore API Documentation: https://developers.procore.com/
 */

import { z } from 'zod';
import type { Env, ProcoreProject, ProcoreRFI, ProcoreDailyLog, ProcoreSubmittal, ToolResult } from '../types';
import { decrypt, encrypt } from '../lib/crypto';
import { 
  OAUTH_CALLBACK_URL, 
  TOKEN_REFRESH_BUFFER_MS,
  MCP_BASE_URL,
  getProcoreUrls,
  type ProcoreEnvironment,
} from '../lib/config';
import { generateCodeVerifier, generateCodeChallenge, generateSecureToken } from '../lib/crypto';

// ============================================================================
// Procore API Client Helper
// ============================================================================

async function procoreRequest<T>(
  env: Env,
  path: string,
  options: RequestInit = {},
  userId: string = 'default'
): Promise<T> {
  // Get OAuth token for specific user
  const token = await env.DB.prepare(`
    SELECT * FROM oauth_tokens WHERE provider = 'procore' AND user_id = ? LIMIT 1
  `).bind(userId).first<any>();

  if (!token) {
    throw new Error('Not connected to Procore. Use workway_connect_procore first.');
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
      throw new Error('Procore token expired. Please reconnect.');
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
    const error = await response.text();
    
    if (response.status === 401) {
      throw new Error('Procore authentication failed. Please reconnect.');
    }
    if (response.status === 403) {
      throw new Error(`Access denied (403): ${error}`);
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    throw new Error(`Procore API error: ${response.status} - ${error}`);
  }

  return response.json();
}

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
    throw new Error('Token refresh failed. Please reconnect.');
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

  return { access_token: encryptedAccessToken };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const procoreTools = {
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
    execute: async (input: z.infer<typeof procoreTools.connect_procore.inputSchema>, env: Env): Promise<ToolResult> => {
      const procoreEnv = input.environment || 'production';
      const urls = getProcoreUrls(procoreEnv);
      
      // Generate or use existing connection ID
      const connectionId = input.connection_id || `ww_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      
      // Get the correct client ID for this environment
      const clientId = procoreEnv === 'sandbox' 
        ? (env.PROCORE_SANDBOX_CLIENT_ID || env.PROCORE_CLIENT_ID)
        : env.PROCORE_CLIENT_ID;
      
      if (procoreEnv === 'sandbox' && !env.PROCORE_SANDBOX_CLIENT_ID) {
        return {
          success: false,
          error: 'Sandbox credentials not configured. Set PROCORE_SANDBOX_CLIENT_ID and PROCORE_SANDBOX_CLIENT_SECRET.',
        };
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
      
      return {
        success: true,
        data: {
          authorizationUrl: authUrl.toString(),
          connection_id: connectionId,
          instructions: `⚠️ SAVE THIS: Your connection ID is "${connectionId}". You'll need this for all Procore tools.\n\nVisit the authorization URL to connect your Procore ${procoreEnv} account.`,
          status: 'pending',
          environment: procoreEnv,
        },
      };
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
    execute: async (input: z.infer<typeof procoreTools.check_procore_connection.inputSchema>, env: Env): Promise<ToolResult> => {
      const userId = input.connection_id || 'default';
      
      const token = await env.DB.prepare(`
        SELECT * FROM oauth_tokens WHERE provider = 'procore' AND user_id = ? LIMIT 1
      `).bind(userId).first<any>();

      if (!token) {
        return {
          success: true,
          data: {
            connected: false,
            userId,
            message: 'Not connected. Use workway_connect_procore to authenticate.',
          },
        };
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

      return {
        success: true,
        data: {
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
        },
      };
    },
  },

  // --------------------------------------------------------------------------
  // workway_list_procore_companies
  // --------------------------------------------------------------------------
  list_procore_companies: {
    name: 'workway_list_procore_companies',
    description: 'List all companies the user has access to in Procore. Use this to find company IDs.',
    inputSchema: z.object({
      connection_id: z.string().optional()
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
    }),
    outputSchema: z.object({
      companies: z.array(z.object({
        id: z.number(),
        name: z.string(),
        is_active: z.boolean(),
      })),
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof procoreTools.list_procore_companies.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        const userId = input.connection_id || 'default';
        
        // Companies endpoint doesn't require company ID header
        const token = await env.DB.prepare(`
          SELECT access_token, expires_at, refresh_token, environment FROM oauth_tokens 
          WHERE provider = 'procore' AND user_id = ? LIMIT 1
        `).bind(userId).first<any>();
        
        if (!token) {
          throw new Error('Not connected to Procore. Use workway_connect_procore first.');
        }
        
        const accessToken = await decrypt(token.access_token, env.COOKIE_ENCRYPTION_KEY);
        const procoreEnv = (token.environment || 'production') as ProcoreEnvironment;
        const urls = getProcoreUrls(procoreEnv);
        
        const response = await fetch(`${urls.apiBase}/companies`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Procore API error: ${response.status} - ${error}`);
        }
        
        const companies = await response.json() as any[];

        return {
          success: true,
          data: {
            companies: companies.map((c: any) => ({
              id: c.id,
              name: c.name,
              is_active: c.is_active,
            })),
            total: companies.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list companies',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_list_procore_projects
  // --------------------------------------------------------------------------
  list_procore_projects: {
    name: 'workway_list_procore_projects',
    description: 'List all projects the user has access to in Procore. Use this to find project IDs for workflow configuration.',
    inputSchema: z.object({
      company_id: z.string().optional()
        .describe('Filter by Procore company ID'),
      active_only: z.boolean().optional().default(true)
        .describe('Only return active projects'),
      connection_id: z.string().optional()
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
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
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof procoreTools.list_procore_projects.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Get company ID from token
        const userId = input.connection_id || 'default';
        const token = await env.DB.prepare(`
          SELECT company_id FROM oauth_tokens WHERE provider = 'procore' AND user_id = ? LIMIT 1
        `).bind(userId).first<any>();
        
        if (!token?.company_id) {
          throw new Error('Company ID not set. Please reconnect to Procore.');
        }
        
        // Try company-specific endpoint first, fall back to query params
        let projects: ProcoreProject[];
        try {
          // Method 1: Company-scoped endpoint
          const queryParams = input.active_only ? '?filters[active]=true' : '';
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

        return {
          success: true,
          data: {
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
            total: projects.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch projects',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_rfis
  // --------------------------------------------------------------------------
  get_procore_rfis: {
    name: 'workway_get_procore_rfis',
    description: 'Get RFIs (Requests for Information) from a Procore project. Useful for understanding RFI patterns and testing RFI automation workflows.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      status: z.enum(['open', 'closed', 'all']).optional().default('open')
        .describe('Filter by RFI status'),
      limit: z.number().optional().default(50)
        .describe('Maximum number of RFIs to return'),
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
      total: z.number(),
      stats: z.object({
        open_count: z.number(),
        avg_response_time_days: z.number().optional(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_rfis.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        let url = `/projects/${input.project_id}/rfis?per_page=${input.limit}`;
        if (input.status !== 'all') {
          url += `&filters[status]=${input.status}`;
        }

        const rfis = await procoreRequest<ProcoreRFI[]>(env, url, {}, input.connection_id || 'default');

        // Calculate stats
        const openCount = rfis.filter(r => r.status === 'open').length;
        const responseTimes = rfis
          .filter(r => r.responseTime !== undefined)
          .map(r => r.responseTime!);
        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : undefined;

        return {
          success: true,
          data: {
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
            total: rfis.length,
            stats: {
              openCount,
              avgResponseTimeDays: avgResponseTime,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch RFIs',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_daily_logs
  // --------------------------------------------------------------------------
  get_procore_daily_logs: {
    name: 'workway_get_procore_daily_logs',
    description: 'Get daily logs from a Procore project. Useful for understanding log patterns and testing daily log automation.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      start_date: z.string().optional()
        .describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().optional()
        .describe('End date (YYYY-MM-DD)'),
      limit: z.number().optional().default(30),
      connection_id: z.string().optional()
        .describe('Your WORKWAY connection ID from workway_connect_procore'),
    }),
    outputSchema: z.object({
      daily_logs: z.array(z.object({
        id: z.number(),
        log_date: z.string(),
        status: z.string(),
        weather_conditions: z.string().optional(),
        temperature_high: z.number().optional(),
        temperature_low: z.number().optional(),
        notes: z.string().optional(),
        manpower_count: z.number().optional(),
      })),
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_daily_logs.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Default to last 30 days if no dates provided
        // Use yesterday as safe end date to avoid timezone issues
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = input.end_date && input.end_date <= yesterday ? input.end_date : yesterday;
        const startDate = input.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Procore daily logs uses filters[start_date] and filters[end_date]
        const url = `/projects/${input.project_id}/daily_logs?filters[start_date]=${startDate}&filters[end_date]=${endDate}`;

        const response = await procoreRequest<any>(env, url, {}, input.connection_id || 'default');

        // Procore returns categorized logs (weather_logs, manpower_logs, etc.)
        return {
          success: true,
          data: {
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
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch daily logs',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_submittals
  // --------------------------------------------------------------------------
  get_procore_submittals: {
    name: 'workway_get_procore_submittals',
    description: 'Get submittals from a Procore project. Useful for understanding submittal patterns and testing submittal tracking automation.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('all')
        .describe('Filter by submittal status'),
      limit: z.number().optional().default(50),
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
      total: z.number(),
      stats: z.object({
        pending_count: z.number(),
        overdue_count: z.number(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_submittals.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        let url = `/projects/${input.project_id}/submittals?per_page=${input.limit}`;
        if (input.status !== 'all') {
          url += `&filters[status]=${input.status}`;
        }

        const submittals = await procoreRequest<ProcoreSubmittal[]>(env, url, {}, input.connection_id || 'default');

        const now = new Date();
        const pendingCount = submittals.filter(s => s.status === 'pending').length;
        const overdueCount = submittals.filter(s => 
          s.dueDate && new Date(s.dueDate) < now && s.status === 'pending'
        ).length;

        return {
          success: true,
          data: {
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
            total: submittals.length,
            stats: {
              pendingCount,
              overdueCount,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch submittals',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_photos
  // --------------------------------------------------------------------------
  get_procore_photos: {
    name: 'workway_get_procore_photos',
    description: 'Get photos from a Procore project. Useful for documentation and progress tracking automation.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      album_id: z.number().optional().describe('Filter by specific album ID'),
      limit: z.number().optional().default(50).describe('Maximum number of photos to return'),
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
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_photos.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        let url = `/projects/${input.project_id}/images?per_page=${input.limit}`;
        if (input.album_id) {
          url += `&filters[image_category_id]=${input.album_id}`;
        }

        const photos = await procoreRequest<any[]>(env, url, {}, input.connection_id || 'default');

        return {
          success: true,
          data: {
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
            total: photos.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch photos',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_documents
  // --------------------------------------------------------------------------
  get_procore_documents: {
    name: 'workway_get_procore_documents',
    description: 'Get documents from a Procore project. Useful for document tracking and compliance automation.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      folder_id: z.number().optional().describe('Filter by specific folder ID'),
      limit: z.number().optional().default(50).describe('Maximum number of documents to return'),
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
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_documents.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Use /documents endpoint which returns flat list of all files and folders
        let url = `/projects/${input.project_id}/documents?per_page=${input.limit}`;
        if (input.folder_id) {
          url += `&filters[parent_id]=${input.folder_id}`;
        }

        const documents = await procoreRequest<any[]>(env, url, {}, input.connection_id || 'default');

        const files = documents.filter(d => d.document_type === 'file');
        const folders = documents.filter(d => d.document_type === 'folder' && !d.is_recycle_bin);

        return {
          success: true,
          data: {
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
            total: files.length,
            totalFolders: folders.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch documents',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_get_procore_schedule
  // --------------------------------------------------------------------------
  get_procore_schedule: {
    name: 'workway_get_procore_schedule',
    description: 'Get schedule tasks from a Procore project. Note: Requires Schedule tool to be enabled in the project. Useful for timeline tracking and schedule automation.',
    inputSchema: z.object({
      project_id: z.number().describe('Procore project ID'),
      status: z.enum(['all', 'in_progress', 'completed', 'not_started']).optional().default('all')
        .describe('Filter by task status'),
      limit: z.number().optional().default(100).describe('Maximum number of tasks to return'),
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
      total: z.number(),
      stats: z.object({
        completed_count: z.number(),
        in_progress_count: z.number(),
        not_started_count: z.number(),
        overdue_count: z.number(),
      }),
    }),
    execute: async (input: z.infer<typeof procoreTools.get_procore_schedule.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        let url = `/projects/${input.project_id}/schedule/tasks?per_page=${input.limit}`;
        
        const tasks = await procoreRequest<any[]>(env, url, {}, input.connection_id || 'default');

        const now = new Date();
        let filteredTasks = tasks;
        
        // Apply status filter
        if (input.status !== 'all') {
          filteredTasks = tasks.filter(t => {
            if (input.status === 'completed') return t.percent_complete === 100;
            if (input.status === 'in_progress') return t.percent_complete > 0 && t.percent_complete < 100;
            if (input.status === 'not_started') return t.percent_complete === 0 || t.percent_complete == null;
            return true;
          });
        }

        // Calculate stats
        const completedCount = tasks.filter(t => t.percent_complete === 100).length;
        const inProgressCount = tasks.filter(t => t.percent_complete > 0 && t.percent_complete < 100).length;
        const notStartedCount = tasks.filter(t => t.percent_complete === 0 || t.percent_complete == null).length;
        const overdueCount = tasks.filter(t => 
          t.finish_date && new Date(t.finish_date) < now && t.percent_complete < 100
        ).length;

        return {
          success: true,
          data: {
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
            total: filteredTasks.length,
            stats: {
              completedCount,
              inProgressCount,
              notStartedCount,
              overdueCount,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch schedule',
        };
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
    execute: async (input: z.infer<typeof procoreTools.create_procore_rfi.inputSchema>, env: Env): Promise<ToolResult> => {
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
          input.connection_id || 'default'
        );

        return {
          success: true,
          data: {
            id: rfi.id,
            number: rfi.number,
            subject: rfi.subject,
            status: rfi.status,
            createdAt: rfi.created_at,
            message: `RFI #${rfi.number} created successfully`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create RFI',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_debug_procore_api (temporary debug tool)
  // --------------------------------------------------------------------------
  debug_procore_api: {
    name: 'workway_debug_procore_api',
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
    execute: async (input: z.infer<typeof procoreTools.debug_procore_api.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        const userId = input.connection_id || 'default';
        const token = await env.DB.prepare(`
          SELECT access_token, company_id, environment FROM oauth_tokens 
          WHERE provider = 'procore' AND user_id = ? LIMIT 1
        `).bind(userId).first<any>();
        
        if (!token) {
          throw new Error('Not connected to Procore');
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
        
        return {
          success: true,
          data: {
            status: response.status,
            headers: responseHeaders,
            body,
            requestPath: `${urls.apiBase}${input.path}`,
            companyIdUsed: token.company_id,
            environment: procoreEnv,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Debug call failed',
        };
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
    execute: async (input: z.infer<typeof procoreTools.create_procore_webhook.inputSchema>, env: Env): Promise<ToolResult> => {
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

        return {
          success: true,
          data: {
            webhookId: webhook.id,
            callbackUrl,
            eventType: input.event_type,
            message: `Webhook registered. Events will trigger workflow ${input.workflow_id}`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create webhook',
        };
      }
    },
  },

  // --------------------------------------------------------------------------
  // workway_list_procore_webhooks
  // --------------------------------------------------------------------------
  list_procore_webhooks: {
    name: 'workway_list_procore_webhooks',
    description: 'List all registered webhooks for a project or workflow.',
    inputSchema: z.object({
      project_id: z.number().optional().describe('Filter by Procore project ID'),
      workflow_id: z.string().optional().describe('Filter by workflow ID'),
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
      total: z.number(),
    }),
    execute: async (input: z.infer<typeof procoreTools.list_procore_webhooks.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        let query = 'SELECT * FROM webhook_subscriptions WHERE 1=1';
        const bindings: any[] = [];
        
        if (input.project_id) {
          query += ' AND project_id = ?';
          bindings.push(input.project_id);
        }
        if (input.workflow_id) {
          query += ' AND workflow_id = ?';
          bindings.push(input.workflow_id);
        }
        
        query += ' ORDER BY created_at DESC';
        
        const stmt = env.DB.prepare(query);
        const result = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt).all<any>();

        return {
          success: true,
          data: {
            webhooks: (result.results || []).map((w: any) => ({
              id: w.id,
              workflowId: w.workflow_id,
              projectId: w.project_id,
              eventType: w.event_type,
              callbackUrl: w.callback_url,
              createdAt: w.created_at,
            })),
            total: result.results?.length || 0,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list webhooks',
        };
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
    execute: async (input: z.infer<typeof procoreTools.delete_procore_webhook.inputSchema>, env: Env): Promise<ToolResult> => {
      try {
        // Get the webhook from our DB
        const webhook = await env.DB.prepare(`
          SELECT procore_hook_id FROM webhook_subscriptions WHERE id = ?
        `).bind(input.webhook_id).first<any>();
        
        if (!webhook) {
          throw new Error('Webhook not found');
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

        return {
          success: true,
          data: {
            deleted: true,
            message: 'Webhook deleted successfully',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete webhook',
        };
      }
    },
  },
};

export type ProcoreTools = typeof procoreTools;
