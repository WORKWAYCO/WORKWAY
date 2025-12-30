import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createFirefliesClient, isRateLimitError } from '$lib/api/fireflies';

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

	// Clean the API key (remove accidental whitespace)
	const cleanedKey = apiKey.trim();

	if (!cleanedKey) {
		return json({ error: 'API key is required' }, { status: 400 });
	}

	// Validate API key
	const client = createFirefliesClient(cleanedKey);

	let isValid: boolean;
	try {
		isValid = await client.validateApiKey();
	} catch (error) {
		if (isRateLimitError(error)) {
			const retryTime = error.retryAfter.toLocaleString('en-US', {
				timeZone: 'UTC',
				dateStyle: 'medium',
				timeStyle: 'short'
			});
			return json({
				error: 'Fireflies rate limit reached',
				hint: `Too many requests to Fireflies API. Try again after ${retryTime} UTC. This is a Fireflies limit, not F→N.`,
				retryAfter: error.retryAfter.toISOString()
			}, { status: 429 });
		}
		throw error;
	}

	if (!isValid) {
		return json({
			error: 'Invalid API key',
			hint: 'Check that you copied the full key from Fireflies Settings → Developer Settings. The key is a long string of letters and numbers.'
		}, { status: 400 });
	}

	const { DB } = platform.env;

	try {
		// Ensure user exists in local database (handles Identity Worker users without local record)
		const userExists = await DB.prepare('SELECT id FROM users WHERE id = ?')
			.bind(locals.user.id)
			.first();

		if (!userExists) {
			// Create local user record for Identity Worker user
			await DB.prepare(
				'INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, 0)'
			)
				.bind(locals.user.id, locals.user.email || 'unknown@user.local', `identity:${locals.user.id}`)
				.run();

			// Create default subscription
			await DB.prepare(
				'INSERT INTO subscriptions (id, user_id, tier, status, sync_count, sync_count_reset_at) VALUES (?, ?, ?, ?, 0, ?)'
			)
				.bind(crypto.randomUUID(), locals.user.id, 'free', 'free', new Date().toISOString())
				.run();
		}

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
				.bind(cleanedKey, locals.user.id, 'fireflies')
				.run();
		} else {
			// Create new
			await DB.prepare(
				'INSERT INTO connected_accounts (id, user_id, provider, access_token) VALUES (?, ?, ?, ?)'
			)
				.bind(crypto.randomUUID(), locals.user.id, 'fireflies', cleanedKey)
				.run();
		}
	} catch (dbError) {
		console.error('Database error saving Fireflies connection:', dbError);
		return json({ error: 'Database error. Please try again.' }, { status: 500 });
	}

	return json({ success: true });
};
