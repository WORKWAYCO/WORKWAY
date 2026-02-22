import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { createMockEnv } from '../../mocks/env';
import type { Env } from '../../../src/types';
import { judgmentTools } from '../../../src/tools/judgment';
import { hubTools } from '../../../src/tools/hub';

describe('hub + judgment tools', () => {
  let env: Env;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    env = createMockEnv({
      dbData: {
        tenant_memberships: [
          {
            id: 'tm_1',
            tenant_id: 'tenant_1',
            user_id: 'user_1',
            role: 'admin',
            status: 'active',
          },
        ],
        tool_access_packs: [
          {
            id: 'pack_1',
            tenant_id: 'tenant_1',
            name: 'Ops Pack',
            slug: 'ops-pack',
            description: 'Ops tooling',
            status: 'active',
            created_by: 'user_1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        tool_access_rules: [
          {
            id: 'rule_1',
            pack_id: 'pack_1',
            tenant_id: 'tenant_1',
            toolkit_slug: 'slack',
            tool_slug: 'SLACK_LIST_CHANNELS',
            rule_type: 'allow',
          },
        ],
      },
    });

    env.COMPOSIO_API_KEY = 'test_composio_key';
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('evaluates actions and creates pending approvals when policy requires it', async () => {
    const result = await judgmentTools.evaluate_action.execute(
      {
        tenant_id: 'tenant_1',
        user_id: 'user_1',
        toolkit_slug: 'slack',
        tool_slug: 'SLACK_SEND_MESSAGE',
        args: { channel: '#ops', text: 'hello' },
      },
      env
    );

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('pending_approval');
    expect(result.data?.decision_id).toBeDefined();
  });

  it('lists allowlisted toolkits through hub resource surface', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ slug: 'slack', name: 'Slack' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await hubTools.list_toolkits.execute(
      {
        tenant_id: 'tenant_1',
        user_id: 'user_1',
        include_remote_catalog: true,
      },
      env
    );

    expect(result.success).toBe(true);
    expect(result.data?.toolkits?.[0]?.slug).toBe('slack');
  });

  it('denies execution when tool is not allowlisted', async () => {
    const result = await hubTools.execute_tool.execute(
      {
        tenant_id: 'tenant_1',
        user_id: 'user_1',
        toolkit_slug: 'slack',
        tool_slug: 'SLACK_DELETE_CHANNEL',
        args: { channel: 'C123' },
      },
      env
    );

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('denied');
    expect(result.data?.decision_id).toBeDefined();
  });
});
