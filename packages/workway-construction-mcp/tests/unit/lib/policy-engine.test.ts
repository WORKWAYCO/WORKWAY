import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { evaluateActionPolicy } from '../../../src/lib/policy-engine';
import * as db from '../../../src/lib/db';
import { createMockEnv } from '../../mocks/env';
import type { Env } from '../../../src/types';

describe('policy-engine', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows low-risk read actions by fallback policy', async () => {
    const result = await evaluateActionPolicy(env, {
      tenantId: 'tenant_1',
      userId: 'user_1',
      toolSlug: 'workway_list_procore_projects',
    });

    expect(result.action).toBe('allow');
    expect(result.riskScore).toBeLessThan(0.45);
  });

  it('requires approval for medium/high-risk writes by fallback policy', async () => {
    const result = await evaluateActionPolicy(env, {
      tenantId: 'tenant_1',
      userId: 'user_1',
      toolSlug: 'SLACK_SEND_MESSAGE',
    });

    expect(result.action).toBe('require_approval');
    expect(result.requiredApprovalTier).toBe('project_manager');
  });

  it('denies very high-risk actions by fallback policy', async () => {
    const result = await evaluateActionPolicy(env, {
      tenantId: 'tenant_1',
      userId: 'user_1',
      toolSlug: 'dangerous_delete_all_records',
    });

    expect(result.action).toBe('deny');
  });

  it('applies tenant policy rule when active policy is present', async () => {
    vi.spyOn(db, 'getActivePolicy').mockResolvedValue({
      policy: {
        id: 'policy_1',
        tenantId: 'tenant_1',
        name: 'Default',
        policyType: 'default',
        status: 'active',
        createdBy: 'user_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      version: {
        id: 'version_1',
        policyId: 'policy_1',
        tenantId: 'tenant_1',
        version: 1,
        status: 'active',
        policyJson: JSON.stringify({
          default_action: 'require_approval',
          rules: [
            {
              id: 'rule_allow_safe_slack',
              action: 'allow',
              match: {
                toolkit_slugs: ['slack'],
                tool_slugs: ['SLACK_LIST_CHANNELS'],
              },
            },
          ],
        }),
        trustProfileJson: null,
        effectiveAt: new Date().toISOString(),
        createdBy: 'user_1',
        createdAt: new Date().toISOString(),
      },
    });

    const result = await evaluateActionPolicy(env, {
      tenantId: 'tenant_1',
      userId: 'user_1',
      toolkitSlug: 'slack',
      toolSlug: 'SLACK_LIST_CHANNELS',
    });

    expect(result.action).toBe('allow');
    expect(result.policyId).toBe('policy_1');
    expect(result.policyVersionId).toBe('version_1');
  });
});
