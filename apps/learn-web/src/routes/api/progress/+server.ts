import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	try {
		// Get learner
		const learner = await db
			.prepare('SELECT * FROM learners WHERE user_id = ?')
			.bind(locals.user.id)
			.first();

		if (!learner) {
			return json({ pathProgress: [], lessonProgress: [] });
		}

		// Get path progress
		const pathProgress = await db
			.prepare('SELECT * FROM path_progress WHERE learner_id = ?')
			.bind(learner.id)
			.all();

		// Get lesson progress
		const lessonProgress = await db
			.prepare('SELECT * FROM lesson_progress WHERE learner_id = ?')
			.bind(learner.id)
			.all();

		return json({
			pathProgress: pathProgress.results,
			lessonProgress: lessonProgress.results
		});
	} catch (err) {
		console.error('Error fetching progress:', err);
		throw error(500, 'Failed to fetch progress');
	}
};

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const db = platform?.env?.DB;
	if (!db) {
		throw error(500, 'Database not available');
	}

	const body = await request.json();
	const { pathId, lessonId, status, timeSpentSeconds } = body;

	if (!pathId || !lessonId) {
		throw error(400, 'pathId and lessonId are required');
	}

	try {
		// Get or create learner
		let learner = await db
			.prepare('SELECT * FROM learners WHERE user_id = ?')
			.bind(locals.user.id)
			.first();

		if (!learner) {
			const learnerId = crypto.randomUUID();
			await db
				.prepare(
					'INSERT INTO learners (id, user_id, email, display_name) VALUES (?, ?, ?, ?)'
				)
				.bind(learnerId, locals.user.id, locals.user.email, locals.user.displayName || null)
				.run();
			learner = { id: learnerId };
		}

		// Update or insert lesson progress
		const existingProgress = await db
			.prepare(
				'SELECT * FROM lesson_progress WHERE learner_id = ? AND path_id = ? AND lesson_id = ?'
			)
			.bind(learner.id, pathId, lessonId)
			.first();

		if (existingProgress) {
			await db
				.prepare(`
					UPDATE lesson_progress
					SET status = ?,
						visits = visits + 1,
						time_spent_seconds = time_spent_seconds + ?,
						completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END
					WHERE id = ?
				`)
				.bind(
					status || existingProgress.status,
					timeSpentSeconds || 0,
					status,
					existingProgress.id
				)
				.run();
		} else {
			await db
				.prepare(`
					INSERT INTO lesson_progress (id, learner_id, path_id, lesson_id, status, visits, time_spent_seconds, started_at, completed_at)
					VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END)
				`)
				.bind(
					crypto.randomUUID(),
					learner.id,
					pathId,
					lessonId,
					status || 'in_progress',
					timeSpentSeconds || 0,
					status
				)
				.run();
		}

		// Update path progress if needed
		if (status === 'completed') {
			// Check if path progress exists
			const existingPathProgress = await db
				.prepare('SELECT * FROM path_progress WHERE learner_id = ? AND path_id = ?')
				.bind(learner.id, pathId)
				.first();

			if (!existingPathProgress) {
				await db
					.prepare(`
						INSERT INTO path_progress (id, learner_id, path_id, status, started_at)
						VALUES (?, ?, ?, 'in_progress', datetime('now'))
					`)
					.bind(crypto.randomUUID(), learner.id, pathId)
					.run();
			}
		}

		return json({ success: true });
	} catch (err) {
		console.error('Error updating progress:', err);
		throw error(500, 'Failed to update progress');
	}
};
