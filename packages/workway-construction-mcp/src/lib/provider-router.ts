/**
 * Provider Router
 *
 * Routes hub tool execution to:
 * - First-party WORKWAY tools
 * - Composio (toolkits + connected accounts)
 */

import type { Env, ProviderExecutionRequest, ProviderExecutionResult } from '../types';

const DEFAULT_COMPOSIO_BASE_URL = 'https://backend.composio.dev/api/v3';

export interface HubToolkit {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
}

export interface HubToolkitTool {
  slug: string;
  name: string;
  description?: string;
  toolkitSlug?: string;
  tags?: string[];
}

export interface ComposioConnectedAccount {
  id: string;
  toolkit_slug?: string;
  status?: string;
  auth_config_id?: string;
  [key: string]: unknown;
}

interface ToolRouterSession {
  id?: string;
  session_id?: string;
  [key: string]: unknown;
}

interface ComposioProviderConfig {
  apiKey: string;
  baseUrl: string;
}

export class ComposioSessionProvider {
  private readonly config: ComposioProviderConfig;

  constructor(env: Env) {
    const apiKey = env.COMPOSIO_API_KEY;
    if (!apiKey) {
      throw new Error('COMPOSIO_API_KEY is required for hub toolkit operations.');
    }

    this.config = {
      apiKey,
      baseUrl: (env.COMPOSIO_BASE_URL || DEFAULT_COMPOSIO_BASE_URL).replace(/\/$/, ''),
    };
  }

  async listToolkits(): Promise<HubToolkit[]> {
    const response = await this.request<any>('GET', '/toolkits');
    const rawItems = toArray(response);

    return rawItems.map((item) => ({
      slug: String(item.slug || item.toolkit_slug || item.name || '').toLowerCase(),
      name: String(item.name || item.display_name || item.slug || ''),
      description: item.description ? String(item.description) : undefined,
      icon: item.icon ? String(item.icon) : undefined,
      category: item.category ? String(item.category) : undefined,
    })).filter((item) => item.slug.length > 0);
  }

  async listTools(toolkitSlug: string): Promise<HubToolkitTool[]> {
    const response = await this.request<any>(
      'GET',
      `/tools?toolkit_slug=${encodeURIComponent(toolkitSlug)}`
    );
    const rawItems = toArray(response);

    return rawItems.map((item) => ({
      slug: String(item.slug || item.tool_slug || item.name || ''),
      name: String(item.name || item.slug || item.tool_slug || ''),
      description: item.description ? String(item.description) : undefined,
      toolkitSlug: item.toolkit_slug ? String(item.toolkit_slug) : toolkitSlug,
      tags: Array.isArray(item.tags) ? item.tags.map((tag: unknown) => String(tag)) : undefined,
    })).filter((item) => item.slug.length > 0);
  }

  async listAuthConfigs(toolkitSlug: string): Promise<Array<{ id: string; toolkit_slug?: string; name?: string }>> {
    const response = await this.request<any>(
      'GET',
      `/auth_configs?toolkit_slug=${encodeURIComponent(toolkitSlug)}`
    );

    return toArray(response)
      .map((item) => ({
        id: String(item.id || ''),
        toolkit_slug: item.toolkit_slug ? String(item.toolkit_slug) : undefined,
        name: item.name ? String(item.name) : undefined,
      }))
      .filter((item) => item.id.length > 0);
  }

  async createConnectionLink(input: {
    authConfigId: string;
    userId: string;
    callbackUrl?: string;
  }): Promise<{ redirectUrl: string; connectedAccountId?: string }> {
    const body: Record<string, unknown> = {
      auth_config_id: input.authConfigId,
      user_id: input.userId,
    };
    if (input.callbackUrl) {
      body.callback_url = input.callbackUrl;
    }

    const response = await this.request<any>('POST', '/connected_accounts/link', body);

    return {
      redirectUrl: String(response.redirect_url || response.redirectUrl || ''),
      connectedAccountId: response.connected_account_id
        ? String(response.connected_account_id)
        : response.connectedAccountId
        ? String(response.connectedAccountId)
        : undefined,
    };
  }

  async listConnectedAccounts(input: {
    userId: string;
    toolkitSlug?: string;
  }): Promise<ComposioConnectedAccount[]> {
    const params = new URLSearchParams();
    params.set('user_id', input.userId);
    if (input.toolkitSlug) params.set('toolkit_slug', input.toolkitSlug);

    const response = await this.request<any>('GET', `/connected_accounts?${params.toString()}`);
    return toArray(response).map((item) => ({ ...item })) as ComposioConnectedAccount[];
  }

  async createToolRouterSession(input: {
    userId: string;
    connectedAccountIds?: string[];
  }): Promise<ToolRouterSession> {
    const body: Record<string, unknown> = {
      user_id: input.userId,
    };
    if (input.connectedAccountIds?.length) {
      body.connected_account_ids = input.connectedAccountIds;
    }

    const response = await this.request<any>('POST', '/toolkits/tool_router/sessions', body);
    return response as ToolRouterSession;
  }

  async executeTool(input: {
    toolSlug: string;
    args: Record<string, unknown>;
    userId: string;
    connectedAccountId?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      arguments: input.args,
      user_id: input.userId,
    };
    if (input.connectedAccountId) {
      body.connected_account_id = input.connectedAccountId;
    }

    const response = await this.request<any>('POST', `/tools/execute/${encodeURIComponent(input.toolSlug)}`, body);
    if (response?.data !== undefined) return response.data;
    if (response?.result !== undefined) return response.result;
    return response;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    const json = responseText.length ? tryParseJson(responseText) : null;

    if (!response.ok) {
      const detail = typeof json === 'object' && json !== null
        ? JSON.stringify(json)
        : responseText;
      throw new Error(`Composio request failed (${response.status}): ${detail}`);
    }

    return (json as T) ?? ({} as T);
  }
}

export function resolveProvider(toolSlug: string): 'first_party' | 'composio' {
  return isFirstPartyTool(toolSlug) ? 'first_party' : 'composio';
}

export function isFirstPartyTool(toolSlug: string): boolean {
  return toolSlug.startsWith('workway_');
}

export async function executeProviderTool(
  env: Env,
  request: ProviderExecutionRequest,
  firstPartyExecutor: (toolSlug: string, args: Record<string, unknown>) => Promise<unknown>
): Promise<ProviderExecutionResult> {
  const provider = resolveProvider(request.toolSlug);

  if (provider === 'first_party') {
    const result = await firstPartyExecutor(request.toolSlug, request.args);
    return {
      provider: 'first_party',
      toolSlug: request.toolSlug,
      toolkitSlug: request.toolkitSlug,
      result,
    };
  }

  const composio = new ComposioSessionProvider(env);
  const result = await composio.executeTool({
    toolSlug: request.toolSlug,
    args: request.args,
    userId: request.userId,
    connectedAccountId: request.connectedAccountId,
  });

  return {
    provider: 'composio',
    toolSlug: request.toolSlug,
    toolkitSlug: request.toolkitSlug,
    result,
  };
}

function toArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items as any[];
    if (Array.isArray(record.results)) return record.results as any[];
    if (Array.isArray(record.data)) return record.data as any[];
  }
  return [];
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
