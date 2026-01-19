import type { PageServerLoad } from './$types';
import { createReadHelper } from '@workwayco/sdk';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!platform?.env) {
		return { jobs: [] };
	}

	const { DB } = platform.env;
	const userId = locals.user!.id;

	// Use eventual consistency for history list (read-heavy, display data)
	const read = createReadHelper(DB, 'eventual');

	// Get all sync jobs for this user
	const jobs = await read.query<{
		id: string;
		status: string;
		progress: number;
		total_transcripts: number;
		database_name: string | null;
		error_message: string | null;
		created_at: string;
		completed_at: string | null;
	}>(
		`SELECT id, status, progress, total_transcripts, database_name, error_message, created_at, completed_at
		 FROM sync_jobs
		 WHERE user_id = ?
		 ORDER BY created_at DESC
		 LIMIT 50`,
		[userId]
	);

	return { jobs };
};
