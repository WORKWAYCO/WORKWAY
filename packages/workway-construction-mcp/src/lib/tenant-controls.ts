/**
 * Tenant runtime controls for MCP hub operations:
 * - Feature flags
 * - Circuit breaker state + policy
 */

import type { Env } from '../types';

export interface CircuitPolicy {
  enabled: boolean;
  failureThreshold: number;
  cooldownSeconds: number;
}

export interface CircuitState {
  state: 'closed' | 'open';
  failureCount: number;
  openedAt?: string;
  openUntil?: string;
  lastFailureAt?: string;
  reason?: string;
}

const DEFAULT_CIRCUIT_POLICY: CircuitPolicy = {
  enabled: true,
  failureThreshold: 3,
  cooldownSeconds: 120,
};

const FEATURE_FLAG_DEFAULTS: Record<string, boolean> = {
  hub_enabled: true,
  hub_execution_enabled: true,
  hub_circuit_breaker_enabled: true,
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'enabled') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'disabled') {
      return false;
    }
  }
  return undefined;
}

function getFeatureFlagKey(tenantId: string, flagKey: string): string {
  return `tenant:${tenantId}:feature:${flagKey}`;
}

function getCircuitStateKey(tenantId: string, toolkitSlug: string, toolSlug: string): string {
  return `tenant:${tenantId}:circuit:${toolkitSlug}:${toolSlug}`;
}

export async function getTenantFeatureFlag(
  env: Env,
  tenantId: string,
  flagKey: string,
  defaultValue = FEATURE_FLAG_DEFAULTS[flagKey] ?? false
): Promise<boolean> {
  try {
    const row = await env.DB.prepare(`
      SELECT enabled
      FROM tenant_feature_flags
      WHERE tenant_id = ? AND flag_key = ?
      LIMIT 1
    `).bind(tenantId, flagKey).first<{ enabled: number | string | boolean }>();

    const parsed = parseBoolean(row?.enabled);
    if (typeof parsed === 'boolean') return parsed;
  } catch {
    // Fallback to KV/default when migration isn't applied.
  }

  const kvValue = await env.KV.get(getFeatureFlagKey(tenantId, flagKey));
  const parsedKv = parseBoolean(kvValue);
  if (typeof parsedKv === 'boolean') return parsedKv;
  return defaultValue;
}

export async function getCircuitPolicy(
  env: Env,
  tenantId: string,
  toolkitSlug: string,
  toolSlug: string
): Promise<CircuitPolicy> {
  try {
    const row = await env.DB.prepare(`
      SELECT enabled, failure_threshold, cooldown_seconds
      FROM tenant_circuit_policies
      WHERE tenant_id = ? AND toolkit_slug = ? AND (tool_slug = ? OR tool_slug IS NULL)
      ORDER BY CASE WHEN tool_slug IS NULL THEN 1 ELSE 0 END ASC
      LIMIT 1
    `).bind(tenantId, toolkitSlug, toolSlug).first<{
      enabled: number | string | boolean;
      failure_threshold: number | string;
      cooldown_seconds: number | string;
    }>();

    if (!row) return DEFAULT_CIRCUIT_POLICY;

    return {
      enabled: parseBoolean(row.enabled) ?? DEFAULT_CIRCUIT_POLICY.enabled,
      failureThreshold: Number(row.failure_threshold) || DEFAULT_CIRCUIT_POLICY.failureThreshold,
      cooldownSeconds: Number(row.cooldown_seconds) || DEFAULT_CIRCUIT_POLICY.cooldownSeconds,
    };
  } catch {
    return DEFAULT_CIRCUIT_POLICY;
  }
}

export async function getCircuitState(
  env: Env,
  tenantId: string,
  toolkitSlug: string,
  toolSlug: string
): Promise<CircuitState | null> {
  const key = getCircuitStateKey(tenantId, toolkitSlug, toolSlug);
  const raw = await env.KV.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CircuitState;
  } catch {
    return null;
  }
}

async function putCircuitState(
  env: Env,
  tenantId: string,
  toolkitSlug: string,
  toolSlug: string,
  state: CircuitState,
  ttlSeconds = 24 * 60 * 60
): Promise<void> {
  const key = getCircuitStateKey(tenantId, toolkitSlug, toolSlug);
  await env.KV.put(key, JSON.stringify(state), { expirationTtl: ttlSeconds });
}

export async function isCircuitOpen(
  env: Env,
  tenantId: string,
  toolkitSlug: string,
  toolSlug: string
): Promise<{ open: boolean; state?: CircuitState | null; policy: CircuitPolicy }> {
  const policyFlag = await getTenantFeatureFlag(env, tenantId, 'hub_circuit_breaker_enabled', true);
  const policy = await getCircuitPolicy(env, tenantId, toolkitSlug, toolSlug);
  if (!policyFlag || !policy.enabled) {
    return { open: false, state: null, policy: { ...policy, enabled: false } };
  }

  const state = await getCircuitState(env, tenantId, toolkitSlug, toolSlug);
  if (!state || state.state !== 'open') {
    return { open: false, state, policy };
  }

  if (!state.openUntil) {
    return { open: true, state, policy };
  }

  const openUntilMs = new Date(state.openUntil).getTime();
  if (Number.isFinite(openUntilMs) && Date.now() >= openUntilMs) {
    // auto-close after cooldown
    await putCircuitState(env, tenantId, toolkitSlug, toolSlug, {
      state: 'closed',
      failureCount: 0,
      reason: 'cooldown_elapsed',
    });
    return { open: false, state: { state: 'closed', failureCount: 0 }, policy };
  }

  return { open: true, state, policy };
}

export async function recordCircuitSuccess(
  env: Env,
  tenantId: string,
  toolkitSlug: string,
  toolSlug: string
): Promise<void> {
  const policyFlag = await getTenantFeatureFlag(env, tenantId, 'hub_circuit_breaker_enabled', true);
  if (!policyFlag) return;

  await putCircuitState(env, tenantId, toolkitSlug, toolSlug, {
    state: 'closed',
    failureCount: 0,
    reason: 'success',
  });
}

export async function recordCircuitFailure(
  env: Env,
  tenantId: string,
  toolkitSlug: string,
  toolSlug: string,
  reason: string
): Promise<CircuitState> {
  const policyFlag = await getTenantFeatureFlag(env, tenantId, 'hub_circuit_breaker_enabled', true);
  const policy = await getCircuitPolicy(env, tenantId, toolkitSlug, toolSlug);
  if (!policyFlag || !policy.enabled) {
    return {
      state: 'closed',
      failureCount: 0,
      reason: 'circuit_breaker_disabled',
    };
  }

  const existing = await getCircuitState(env, tenantId, toolkitSlug, toolSlug);
  const previousFailures = existing?.state === 'closed' ? existing.failureCount : existing?.failureCount || 0;
  const failureCount = previousFailures + 1;

  if (failureCount >= policy.failureThreshold) {
    const openedAt = nowIso();
    const openUntil = new Date(Date.now() + policy.cooldownSeconds * 1000).toISOString();
    const openState: CircuitState = {
      state: 'open',
      failureCount,
      openedAt,
      openUntil,
      lastFailureAt: openedAt,
      reason,
    };
    await putCircuitState(env, tenantId, toolkitSlug, toolSlug, openState);
    return openState;
  }

  const closedState: CircuitState = {
    state: 'closed',
    failureCount,
    lastFailureAt: nowIso(),
    reason,
  };
  await putCircuitState(env, tenantId, toolkitSlug, toolSlug, closedState);
  return closedState;
}
