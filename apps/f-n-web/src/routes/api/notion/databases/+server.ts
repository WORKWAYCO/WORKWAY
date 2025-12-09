import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createNotionClient } from '$lib/api/notion';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const { DB } = platform.env;

	// Get Notion connection
	const account = await DB.prepare(
		'SELECT access_token FROM connected_accounts WHERE user_id = ? AND provider = ?'
	)
		.bind(locals.user.id, 'notion')
		.first<{ access_token: string }>();

	if (!account) {
		return json({ error: 'Notion not connected' }, { status: 400 });
	}

	const client = createNotionClient(account.access_token);

	try {
		const databases = await client.getDatabases();

		// Format for frontend
		const formattedDatabases = databases.map((db) => ({
			id: db.id,
			title: db.title?.[0]?.plain_text || 'Untitled',
			properties: Object.entries(db.properties || {}).map(([name, prop]) => ({
				id: prop.id,
				name,
				type: prop.type
			}))
		}));

		return json({ databases: formattedDatabases });
	} catch (error) {
		console.error('Error fetching databases:', error);
		return json({ error: 'Failed to fetch databases' }, { status: 500 });
	}
};
