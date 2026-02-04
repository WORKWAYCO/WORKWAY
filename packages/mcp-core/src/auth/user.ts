/**
 * User authentication and lookup
 */

import type { Context } from 'hono';
import type { BaseMCPEnv, User } from '../types';

/**
 * Get user from Authorization header (JWT or API key)
 */
export async function getUserFromToken<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>
): Promise<User | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return null;

  // Extract token
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;

  try {
    // Check if it's a user API key stored in KV
    const userId = await c.env.KV.get(`api_key:${token}`);
    if (userId) {
      const user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(userId).first<User>();
      return user || null;
    }

    // Check oauth_tokens for user lookup
    const oauthToken = await c.env.DB.prepare(
      'SELECT user_id FROM oauth_tokens WHERE access_token = ? LIMIT 1'
    ).bind(token).first<{ user_id: string }>();

    if (oauthToken) {
      const user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(oauthToken.user_id).first<User>();
      return user || null;
    }

    return null;
  } catch (error) {
    console.error('Error getting user from token:', error);
    return null;
  }
}
