/**
 * Usage Metering
 * 
 * Tracks and enforces usage limits for anonymous and authenticated users.
 */

import type { Context } from 'hono';
import type { BaseMCPEnv, User, UserTier, UsageResult, AnonymousUsage } from '../types';
import { generateFingerprint } from '../auth/fingerprint';
import { getUserFromToken } from '../auth/user';

// Default tier limits
const DEFAULT_TIER_LIMITS: Record<UserTier, number> = {
  anonymous: 50,      // Total lifetime runs
  free: 500,          // Per month
  pro: 5000,          // Per month
  enterprise: -1,     // Unlimited (-1 means no limit)
};

export interface MeteringConfig {
  tierLimits?: Partial<Record<UserTier, number>>;
}

/**
 * Create a metering instance with optional custom limits
 */
export function createMetering(config?: MeteringConfig) {
  const tierLimits = { ...DEFAULT_TIER_LIMITS, ...config?.tierLimits };
  
  return {
    tierLimits,
    checkUsage: <TEnv extends BaseMCPEnv>(c: Context<{ Bindings: TEnv }>) => 
      checkUsage(c, tierLimits),
    incrementUsage: <TEnv extends BaseMCPEnv>(c: Context<{ Bindings: TEnv }>) => 
      incrementUsage(c),
    getCurrentUsage: <TEnv extends BaseMCPEnv>(c: Context<{ Bindings: TEnv }>) => 
      getCurrentUsage(c, tierLimits),
  };
}

/**
 * Check anonymous usage via KV
 */
async function checkAnonymousUsage<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  tierLimits: Record<UserTier, number>
): Promise<UsageResult> {
  const fingerprint = generateFingerprint(c);
  const key = `anon_usage:${fingerprint}`;
  
  const usageData = await c.env.KV.get<AnonymousUsage>(key, 'json');
  const limit = tierLimits.anonymous;
  
  if (!usageData) {
    return {
      exceeded: false,
      runs: 0,
      limit,
      tier: 'anonymous',
    };
  }

  return {
    exceeded: usageData.runs >= limit,
    runs: usageData.runs,
    limit,
    tier: 'anonymous',
  };
}

/**
 * Check authenticated user usage via D1
 */
async function checkAuthenticatedUsage<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  user: User,
  tierLimits: Record<UserTier, number>
): Promise<UsageResult> {
  const limit = tierLimits[user.tier];
  
  // Enterprise has unlimited
  if (limit === -1) {
    return {
      exceeded: false,
      runs: user.runs_this_month,
      limit: -1,
      tier: user.tier,
      userId: user.id,
      cycleStart: user.billing_cycle_start,
    };
  }

  // Check if billing cycle needs reset (30 days)
  const cycleStart = new Date(user.billing_cycle_start);
  const now = new Date();
  const daysSinceCycleStart = Math.floor((now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceCycleStart >= 30) {
    // Reset the billing cycle
    await c.env.DB.prepare(`
      UPDATE users 
      SET runs_this_month = 0, 
          billing_cycle_start = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(now.toISOString(), now.toISOString(), user.id).run();

    return {
      exceeded: false,
      runs: 0,
      limit,
      tier: user.tier,
      userId: user.id,
      cycleStart: now.toISOString(),
      daysUntilReset: 30,
    };
  }

  const daysUntilReset = 30 - daysSinceCycleStart;

  return {
    exceeded: user.runs_this_month >= limit,
    runs: user.runs_this_month,
    limit,
    tier: user.tier,
    userId: user.id,
    cycleStart: user.billing_cycle_start,
    daysUntilReset,
  };
}

/**
 * Check usage for current request
 */
export async function checkUsage<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  tierLimits: Record<UserTier, number> = DEFAULT_TIER_LIMITS
): Promise<UsageResult> {
  const user = await getUserFromToken(c);
  if (!user) {
    return checkAnonymousUsage(c, tierLimits);
  }
  return checkAuthenticatedUsage(c, user, tierLimits);
}

/**
 * Increment usage after successful tool call
 */
export async function incrementUsage<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>
): Promise<void> {
  const user = await getUserFromToken(c);
  
  if (!user) {
    // Anonymous - increment in KV
    const fingerprint = generateFingerprint(c);
    const key = `anon_usage:${fingerprint}`;
    
    const usageData = await c.env.KV.get<AnonymousUsage>(key, 'json');
    const newUsage: AnonymousUsage = {
      runs: (usageData?.runs || 0) + 1,
      first_seen: usageData?.first_seen || new Date().toISOString(),
    };
    
    // Store with 90 day expiration for anonymous users
    await c.env.KV.put(key, JSON.stringify(newUsage), {
      expirationTtl: 90 * 24 * 60 * 60, // 90 days in seconds
    });
  } else {
    // Authenticated - increment in D1
    await c.env.DB.prepare(`
      UPDATE users 
      SET runs_this_month = runs_this_month + 1,
          updated_at = ?
      WHERE id = ?
    `).bind(new Date().toISOString(), user.id).run();
  }
}

/**
 * Get current usage for API endpoint
 */
export async function getCurrentUsage<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  tierLimits: Record<UserTier, number> = DEFAULT_TIER_LIMITS
): Promise<UsageResult & { resetDate?: string }> {
  const usage = await checkUsage(c, tierLimits);
  
  // Calculate reset date for display
  let resetDate: string | undefined;
  if (usage.cycleStart && usage.daysUntilReset) {
    const reset = new Date(usage.cycleStart);
    reset.setDate(reset.getDate() + 30);
    resetDate = reset.toISOString();
  }

  return {
    ...usage,
    resetDate,
  };
}
