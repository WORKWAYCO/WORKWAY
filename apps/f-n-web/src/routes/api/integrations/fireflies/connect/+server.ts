import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createFirefliesClient } from '$lib/api/fireflies';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const { apiKey } = await request.json() as { apiKey?: string };

	if (!apiKey || typeof apiKey !== 'string') {
		return json({ error: 'API key is required' }, { status: 400 });
	}

	// Validate API key
	const client = createFirefliesClient(apiKey);
	const isValid = await client.validateApiKey();

	if (!isValid) {
		return json({ error: 'Invalid Fireflies API key' }, { status: 400 });
	}

	const { DB } = platform.env;

	// Check for existing connection
	const existing = await DB.prepare(
		'SELECT id FROM connected_accounts WHERE user_id = ? AND provider = ?'
	)
		.bind(locals.user.id, 'fireflies')
		.first();

	if (existing) {
		// Update existing
		await DB.prepare(
			'UPDATE connected_accounts SET access_token = ?, updated_at = datetime("now") WHERE user_id = ? AND provider = ?'
		)
			.bind(apiKey, locals.user.id, 'fireflies')
			.run();
	} else {
		// Create new
		await DB.prepare(
			'INSERT INTO connected_accounts (id, user_id, provider, access_token) VALUES (?, ?, ?, ?)'
		)
			.bind(crypto.randomUUID(), locals.user.id, 'fireflies', apiKey)
			.run();
	}

	return json({ success: true });
};
