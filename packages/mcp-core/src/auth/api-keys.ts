/**
 * API Key Management
 * 
 * Handles generation, validation, and revocation of API keys
 * for both anonymous and authenticated users.
 */

import type { Context } from 'hono';
import type { BaseMCPEnv, User, UserTier } from '../types';
import { generateFingerprint } from './fingerprint';

export interface APIKeyResult {
  apiKey: string;
  tier: UserTier;
  expiresIn?: string;
  userId?: string;
}

/**
 * Generate an API key for the current user
 * Anonymous users get a temporary key tied to their fingerprint
 * Authenticated users get a persistent key
 */
export async function generateAPIKey<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  user: User | null
): Promise<APIKeyResult> {
  if (!user) {
    // Anonymous user - generate temporary key tied to fingerprint
    const fingerprint = generateFingerprint(c);
    const key = `ww_anon_${crypto.randomUUID().replace(/-/g, '')}`;
    
    // Store key -> fingerprint mapping with 90 day expiration
    await c.env.KV.put(`api_key:${key}`, fingerprint, {
      expirationTtl: 90 * 24 * 60 * 60, // 90 days in seconds
    });
    
    return {
      apiKey: key,
      tier: 'anonymous',
      expiresIn: '90 days',
    };
  }
  
  // Authenticated user - generate persistent key
  const key = `ww_${crypto.randomUUID().replace(/-/g, '')}`;
  
  // Store key -> userId mapping (no expiration for authenticated users)
  await c.env.KV.put(`api_key:${key}`, user.id);
  
  // Also store user -> key mapping so we can revoke later
  const userKeysKey = `user_keys:${user.id}`;
  const existingKeys = await c.env.KV.get<string[]>(userKeysKey, 'json') || [];
  existingKeys.push(key);
  await c.env.KV.put(userKeysKey, JSON.stringify(existingKeys));
  
  return {
    apiKey: key,
    tier: user.tier,
    userId: user.id,
  };
}

/**
 * Revoke all API keys for a user
 */
export async function revokeAllAPIKeys<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  user: User | null
): Promise<{ success: boolean; keysRevoked: number; message?: string }> {
  if (!user) {
    // Anonymous user - keys will expire naturally
    return {
      success: true,
      keysRevoked: 0,
      message: 'Anonymous keys will expire automatically',
    };
  }
  
  // Authenticated user - revoke all their keys
  const userKeysKey = `user_keys:${user.id}`;
  const existingKeys = await c.env.KV.get<string[]>(userKeysKey, 'json') || [];
  
  // Delete all keys
  for (const key of existingKeys) {
    await c.env.KV.delete(`api_key:${key}`);
  }
  
  // Clear the user's key list
  await c.env.KV.delete(userKeysKey);
  
  return {
    success: true,
    keysRevoked: existingKeys.length,
  };
}

/**
 * Revoke a specific API key
 */
export async function revokeAPIKey<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  keyToRevoke: string,
  user: User | null
): Promise<{ success: boolean; error?: string }> {
  // Verify the key exists
  const keyOwner = await c.env.KV.get(`api_key:${keyToRevoke}`);
  
  if (!keyOwner) {
    return { success: false, error: 'Key not found' };
  }
  
  // Verify ownership if authenticated
  if (user && keyOwner !== user.id) {
    return { success: false, error: 'Unauthorized' };
  }
  
  // Delete the key
  await c.env.KV.delete(`api_key:${keyToRevoke}`);
  
  // Remove from user's key list if authenticated
  if (user) {
    const userKeysKey = `user_keys:${user.id}`;
    const existingKeys = await c.env.KV.get<string[]>(userKeysKey, 'json') || [];
    const updatedKeys = existingKeys.filter(k => k !== keyToRevoke);
    await c.env.KV.put(userKeysKey, JSON.stringify(updatedKeys));
  }
  
  return { success: true };
}

/**
 * Validate an API key and return the owner ID
 */
export async function validateAPIKey<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  apiKey: string
): Promise<string | null> {
  return c.env.KV.get(`api_key:${apiKey}`);
}
