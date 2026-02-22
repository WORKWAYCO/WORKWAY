import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../src/types';
import { createMockEnv } from '../../mocks/env';
import {
  getTenantFeatureFlag,
  isCircuitOpen,
  recordCircuitFailure,
  recordCircuitSuccess,
} from '../../../src/lib/tenant-controls';

describe('tenant-controls', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('uses defaults when no DB/KV flag exists', async () => {
    const enabled = await getTenantFeatureFlag(env, 'tenant_1', 'hub_execution_enabled', true);
    expect(enabled).toBe(true);
  });

  it('reads feature flag from DB when available', async () => {
    env.DB.prepare = vi.fn((sql: string) => {
      if (sql.includes('tenant_feature_flags')) {
        return {
          bind: () => ({
            first: async () => ({ enabled: 0 }),
          }),
        };
      }
      return {
        bind: () => ({
          first: async () => null,
        }),
      };
    }) as any;

    const enabled = await getTenantFeatureFlag(env, 'tenant_1', 'hub_execution_enabled', true);
    expect(enabled).toBe(false);
  });

  it('opens circuit after threshold failures and auto-closes on success', async () => {
    env.DB.prepare = vi.fn((sql: string) => {
      if (sql.includes('tenant_feature_flags')) {
        return {
          bind: () => ({
            first: async () => ({ enabled: 1 }),
          }),
        };
      }
      if (sql.includes('tenant_circuit_policies')) {
        return {
          bind: () => ({
            first: async () => ({
              enabled: 1,
              failure_threshold: 2,
              cooldown_seconds: 120,
            }),
          }),
        };
      }
      return {
        bind: () => ({
          first: async () => null,
        }),
      };
    }) as any;

    const keyPrefix = 'tenant:tenant_1:circuit:slack:SLACK_SEND_MESSAGE';
    expect(await env.KV.get(keyPrefix)).toBeNull();

    const failure1 = await recordCircuitFailure(
      env,
      'tenant_1',
      'slack',
      'SLACK_SEND_MESSAGE',
      'upstream timeout'
    );
    expect(failure1.state).toBe('closed');
    expect(failure1.failureCount).toBe(1);

    const failure2 = await recordCircuitFailure(
      env,
      'tenant_1',
      'slack',
      'SLACK_SEND_MESSAGE',
      'upstream timeout'
    );
    expect(failure2.state).toBe('open');
    expect(failure2.failureCount).toBe(2);
    expect(failure2.openUntil).toBeDefined();

    const open = await isCircuitOpen(env, 'tenant_1', 'slack', 'SLACK_SEND_MESSAGE');
    expect(open.open).toBe(true);

    await recordCircuitSuccess(env, 'tenant_1', 'slack', 'SLACK_SEND_MESSAGE');
    const closed = await isCircuitOpen(env, 'tenant_1', 'slack', 'SLACK_SEND_MESSAGE');
    expect(closed.open).toBe(false);
  });
});
