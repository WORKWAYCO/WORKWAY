import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createFirefliesClient, isRateLimitError } from '$lib/api/fireflies';

export const GET: RequestHandler = async ({ url, locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const { DB } = platform.env;

	// Get Fireflies connection
	const account = await DB.prepare(
		'SELECT access_token FROM connected_accounts WHERE user_id = ? AND provider = ?'
	)
		.bind(locals.user.id, 'fireflies')
		.first<{ access_token: string }>();

	if (!account) {
		return json({ error: 'Fireflies not connected' }, { status: 400 });
	}

	const limit = parseInt(url.searchParams.get('limit') || '500');
	const skip = parseInt(url.searchParams.get('skip') || '0');

	const client = createFirefliesClient(account.access_token);

	try {
		const transcripts = await client.getTranscripts({ limit, skip });

		// Get already synced transcript IDs
		const syncedIds = await DB.prepare(
			'SELECT fireflies_transcript_id FROM synced_transcripts WHERE user_id = ?'
		)
			.bind(locals.user.id)
			.all<{ fireflies_transcript_id: string }>();

		const syncedSet = new Set(syncedIds.results?.map((r) => r.fireflies_transcript_id) || []);

		// Mark which transcripts are already synced
		const transcriptsWithStatus = transcripts.map((t) => ({
			...t,
			synced: syncedSet.has(t.id)
		}));

		return json({ transcripts: transcriptsWithStatus });
	} catch (error) {
		if (isRateLimitError(error)) {
			const retryTime = error.retryAfter.toLocaleString('en-US', {
				timeZone: 'UTC',
				dateStyle: 'medium',
				timeStyle: 'short'
			});
			return json({
				error: 'Fireflies rate limit reached',
				hint: `Too many requests to Fireflies API. Try again after ${retryTime} UTC.`,
				retryAfter: error.retryAfter.toISOString()
			}, { status: 429 });
		}
		console.error('Error fetching transcripts:', error);
		return json({ error: 'Failed to fetch transcripts' }, { status: 500 });
	}
};
