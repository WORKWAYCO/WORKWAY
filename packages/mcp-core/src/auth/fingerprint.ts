/**
 * Fingerprint generation for anonymous user tracking
 */

import type { Context } from 'hono';
import type { BaseMCPEnv } from '../types';

/**
 * Generate a fingerprint for anonymous users
 * Uses hash of IP + User-Agent for tracking
 */
export function generateFingerprint<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>
): string {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const userAgent = c.req.header('user-agent') || 'unknown';
  
  // Simple hash - in production you might want crypto.subtle.digest
  let hash = 0;
  const str = `${ip}:${userAgent}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
