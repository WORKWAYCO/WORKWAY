import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createNotionClient } from '$lib/api/notion';
import { createEdgeCache } from '@workwayco/sdk';

// Edge cache for Notion databases (external API call - cache for 2 min)
const notionCache = createEdgeCache('notion-databases');

interface FormattedDatabase {
	id: string;
	title: string;
	properties: Array<{ id: string; name: string; type: string }>;
}

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const { DB } = platform.env;
	const userId = locals.user.id;

	// Try edge cache first (keyed by user)
	const cacheKey = `user:${userId}`;
	const cached = await notionCache.get<{ databases: FormattedDatabase[] }>(cacheKey);
	if (cached) {
		return json(cached);
	}

	// Get Notion connection
	const account = await DB.prepare(
		'SELECT access_token FROM connected_accounts WHERE user_id = ? AND provider = ?'
	)
		.bind(userId, 'notion')
		.first<{ access_token: string }>();

	if (!account) {
		return json({ error: 'Notion not connected' }, { status: 400 });
	}

	const client = createNotionClient(account.access_token);

	try {
		const databases = await client.getDatabases();

		// Format for frontend
		const formattedDatabases: FormattedDatabase[] = databases.map((db) => ({
			id: db.id,
			title: db.title?.[0]?.plain_text || 'Untitled',
			properties: Object.entries(db.properties || {}).map(([name, prop]) => ({
				id: prop.id,
				name,
				type: prop.type
			}))
		}));

		const response = { databases: formattedDatabases };

		// Cache for 2 minutes (Notion data changes occasionally)
		await notionCache.set(cacheKey, response, { ttlSeconds: 120 });

		return json(response);
	} catch (error) {
		console.error('Error fetching databases:', error);
		return json({ error: 'Failed to fetch databases' }, { status: 500 });
	}
};

// Invalidate cache when Notion is disconnected
export const DELETE: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Invalidate the user's cached databases
	const cacheKey = `user:${locals.user.id}`;
	await notionCache.invalidate(cacheKey);

	return json({ success: true });
};
