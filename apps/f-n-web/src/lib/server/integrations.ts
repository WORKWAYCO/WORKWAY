/**
 * Shared utilities for integration API routes
 * DRY Fix: Consolidated from youtube/notion/fireflies disconnect handlers
 */

import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

type Provider = 'youtube' | 'notion' | 'fireflies' | 'google' | 'slack';

type DisconnectResult = 
	| { success: true }
	| { success?: never; error: string };

/**
 * Create a POST handler for disconnecting an integration
 * 
 * @example
 * ```typescript
 * // In +server.ts
 * export const POST = createDisconnectHandler('youtube');
 * ```
 */
export function createDisconnectHandler(provider: Provider) {
	return async ({ locals, platform }: RequestEvent): Promise<Response> => {
		if (!locals.user) {
			return json({ error: 'Unauthorized' } satisfies DisconnectResult, { status: 401 });
		}

		if (!platform?.env) {
			return json({ error: 'Server configuration error' } satisfies DisconnectResult, { status: 500 });
		}

		const { DB } = platform.env as { DB: D1Database };

		await DB.prepare('DELETE FROM connected_accounts WHERE user_id = ? AND provider = ?')
			.bind(locals.user.id, provider)
			.run();

		return json({ success: true } satisfies DisconnectResult);
	};
}
