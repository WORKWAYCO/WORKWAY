/**
 * Procore API Client
 * 
 * Handles authentication, token refresh, and API requests to Procore.
 * Based on the BaseAPIClient pattern from WORKWAY integrations.
 */

import type { Env, OAuthToken } from '../types';

const PROCORE_API_BASE = 'https://api.procore.com/rest/v1.0';
const PROCORE_AUTH_BASE = 'https://login.procore.com';

export interface ProcoreClientOptions {
  env: Env;
  companyId?: string;
}

export class ProcoreClient {
  private env: Env;
  private companyId?: string;
  private tokenCache: OAuthToken | null = null;

  constructor(options: ProcoreClientOptions) {
    this.env = options.env;
    this.companyId = options.companyId;
  }

  /**
   * Get current OAuth token, refreshing if needed
   */
  async getToken(): Promise<OAuthToken> {
    if (this.tokenCache) {
      const expiresAt = this.tokenCache.expiresAt 
        ? new Date(this.tokenCache.expiresAt)
        : null;
      
      // Check if token is still valid (with 5 min buffer)
      if (!expiresAt || expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
        return this.tokenCache;
      }
    }

    // Fetch from database
    const token = await this.env.DB.prepare(`
      SELECT * FROM oauth_tokens WHERE provider = 'procore' LIMIT 1
    `).first<any>();

    if (!token) {
      throw new ProcoreError('NOT_CONNECTED', 'Not connected to Procore. Use workway_connect_procore first.');
    }

    // Check if refresh needed
    const expiresAt = token.expires_at ? new Date(token.expires_at) : null;
    const needsRefresh = expiresAt && expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

    if (needsRefresh && token.refresh_token) {
      return await this.refreshToken(token);
    }

    if (needsRefresh && !token.refresh_token) {
      throw new ProcoreError('TOKEN_EXPIRED', 'Procore token expired. Please reconnect.');
    }

    this.tokenCache = {
      id: token.id,
      provider: token.provider,
      userId: token.user_id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at,
      scopes: token.scopes ? JSON.parse(token.scopes) : undefined,
      createdAt: token.created_at,
    };

    return this.tokenCache;
  }

  /**
   * Refresh the OAuth token
   */
  private async refreshToken(token: any): Promise<OAuthToken> {
    const response = await fetch(`${PROCORE_AUTH_BASE}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
        client_id: this.env.PROCORE_CLIENT_ID,
        client_secret: this.env.PROCORE_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ProcoreError('REFRESH_FAILED', `Token refresh failed: ${error}`);
    }

    const data = await response.json() as any;

    // Update token in database
    const newExpiresAt = data.expires_in 
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    await this.env.DB.prepare(`
      UPDATE oauth_tokens 
      SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      data.access_token,
      data.refresh_token || token.refresh_token,
      newExpiresAt,
      new Date().toISOString(),
      token.id
    ).run();

    this.tokenCache = {
      id: token.id,
      provider: 'procore',
      userId: token.user_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || token.refresh_token,
      expiresAt: newExpiresAt || undefined,
      createdAt: token.created_at,
    };

    return this.tokenCache;
  }

  /**
   * Make an authenticated request to Procore API
   */
  async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getToken();

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add company ID if available
    if (this.companyId) {
      headers['Procore-Company-Id'] = this.companyId;
    }

    const response = await fetch(`${PROCORE_API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      
      if (response.status === 401) {
        // Token might be invalid, clear cache and retry once
        this.tokenCache = null;
        throw new ProcoreError('UNAUTHORIZED', 'Procore authentication failed. Please reconnect.');
      }
      
      if (response.status === 403) {
        throw new ProcoreError('FORBIDDEN', 'Access denied. Check your Procore permissions.');
      }
      
      if (response.status === 429) {
        throw new ProcoreError('RATE_LIMITED', 'Procore rate limit exceeded. Please try again later.');
      }

      throw new ProcoreError('API_ERROR', `Procore API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Convenience methods for common operations
   */
  
  async getProjects(filters?: { active?: boolean }) {
    let path = '/projects';
    if (filters?.active !== undefined) {
      path += `?filters[active]=${filters.active}`;
    }
    return this.request<any[]>(path);
  }

  async getRFIs(projectId: number, filters?: { status?: string; limit?: number }) {
    let path = `/projects/${projectId}/rfis`;
    const params = new URLSearchParams();
    if (filters?.status) params.set('filters[status]', filters.status);
    if (filters?.limit) params.set('per_page', filters.limit.toString());
    if (params.toString()) path += `?${params.toString()}`;
    return this.request<any[]>(path);
  }

  async getDailyLogs(projectId: number, filters?: { startDate?: string; endDate?: string; limit?: number }) {
    let path = `/projects/${projectId}/daily_logs`;
    const params = new URLSearchParams();
    if (filters?.startDate) params.set('filters[log_date][gte]', filters.startDate);
    if (filters?.endDate) params.set('filters[log_date][lte]', filters.endDate);
    if (filters?.limit) params.set('per_page', filters.limit.toString());
    if (params.toString()) path += `?${params.toString()}`;
    return this.request<any[]>(path);
  }

  async getSubmittals(projectId: number, filters?: { status?: string; limit?: number }) {
    let path = `/projects/${projectId}/submittals`;
    const params = new URLSearchParams();
    if (filters?.status) params.set('filters[status]', filters.status);
    if (filters?.limit) params.set('per_page', filters.limit.toString());
    if (params.toString()) path += `?${params.toString()}`;
    return this.request<any[]>(path);
  }
}

/**
 * Procore-specific error class
 */
export class ProcoreError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProcoreError';
    this.code = code;
  }
}
