import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComposioSessionProvider, resolveProvider, executeProviderTool } from '../../../src/lib/provider-router';
import { createMockEnv } from '../../mocks/env';
import type { Env } from '../../../src/types';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('provider-router', () => {
  let env: Env;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    env = createMockEnv();
    env.COMPOSIO_API_KEY = 'test_composio_key';
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes workway tools to first_party', () => {
    expect(resolveProvider('workway_list_procore_projects')).toBe('first_party');
    expect(resolveProvider('SLACK_SEND_MESSAGE')).toBe('composio');
  });

  it('lists toolkits via Composio v3 endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { slug: 'slack', name: 'Slack' },
          { slug: 'gmail', name: 'Gmail' },
        ],
      })
    );

    const composio = new ComposioSessionProvider(env);
    const toolkits = await composio.listToolkits();

    expect(toolkits).toHaveLength(2);
    const url = mockFetch.mock.calls[0][0] as string;
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(url).toContain('/api/v3/toolkits');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('test_composio_key');
  });

  it('executes composio tools through /tools/execute/{toolSlug}', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));

    const composio = new ComposioSessionProvider(env);
    const result = await composio.executeTool({
      toolSlug: 'SLACK_SEND_MESSAGE',
      args: { channel: '#ops', text: 'hello' },
      userId: 'user_1',
      connectedAccountId: 'ca_123',
    });

    expect(result).toEqual({ ok: true });
    const url = mockFetch.mock.calls[0][0] as string;
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(url).toContain('/api/v3/tools/execute/SLACK_SEND_MESSAGE');
    const body = JSON.parse(String(init.body));
    expect(body.user_id).toBe('user_1');
    expect(body.connected_account_id).toBe('ca_123');
  });

  it('routes first-party executions through callback', async () => {
    const result = await executeProviderTool(
      env,
      {
        tenantId: 'tenant_1',
        userId: 'user_1',
        toolSlug: 'workway_list_workflows',
        args: {},
      },
      async (toolSlug, args) => ({ toolSlug, args, ok: true })
    );

    expect(result.provider).toBe('first_party');
    expect(result.result).toMatchObject({ ok: true });
  });
});
