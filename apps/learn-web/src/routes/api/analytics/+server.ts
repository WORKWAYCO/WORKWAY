import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const body = await request.json();
	const { eventType, eventData, pagePath, referrer } = body;

	if (!eventType) {
		throw error(400, 'eventType is required');
	}

	try {
		// Get learner ID if authenticated
		let learnerId: string | null = null;
		if (locals.user) {
			const learner = await db
				.prepare('SELECT id FROM learners WHERE user_id = ?')
				.bind(locals.user.id)
				.first();
			learnerId = learner?.id as string || null;
		}

		await db
			.prepare(`
				INSERT INTO analytics_events (id, learner_id, event_type, event_data, page_path, referrer, created_at)
				VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
			`)
			.bind(
				crypto.randomUUID(),
				learnerId,
				eventType,
				JSON.stringify(eventData || {}),
				pagePath || null,
				referrer || null
			)
			.run();

		return json({ success: true });
	} catch (err) {
		console.error('Error tracking analytics:', err);
		throw error(500, 'Failed to track event');
	}
};

// GET endpoint for learners to see their own stats
export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		const learner = await db
			.prepare('SELECT id FROM learners WHERE user_id = ?')
			.bind(locals.user.id)
			.first();

		if (!learner) {
			return json({
				totalEvents: 0,
				recentActivity: [],
				eventCounts: {}
			});
		}

		// Get total events
		const totalEvents = await db
			.prepare('SELECT COUNT(*) as count FROM analytics_events WHERE learner_id = ?')
			.bind(learner.id)
			.first();

		// Get recent activity
		const recentActivity = await db
			.prepare(`
				SELECT event_type, page_path, created_at
				FROM analytics_events
				WHERE learner_id = ?
				ORDER BY created_at DESC
				LIMIT 10
			`)
			.bind(learner.id)
			.all();

		// Get event counts by type
		const eventCounts = await db
			.prepare(`
				SELECT event_type, COUNT(*) as count
				FROM analytics_events
				WHERE learner_id = ?
				GROUP BY event_type
			`)
			.bind(learner.id)
			.all();

		return json({
			totalEvents: (totalEvents as any)?.count || 0,
			recentActivity: recentActivity.results,
			eventCounts: Object.fromEntries(
				eventCounts.results.map((r: any) => [r.event_type, r.count])
			)
		});
	} catch (err) {
		console.error('Error fetching analytics:', err);
		throw error(500, 'Failed to fetch analytics');
	}
};
