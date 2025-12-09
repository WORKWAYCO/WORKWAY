import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!platform?.env) {
		return { jobs: [] };
	}

	const { DB } = platform.env;
	const userId = locals.user!.id;

	// Get all sync jobs for this user
	const jobs = await DB.prepare(
		`SELECT id, status, progress, total_transcripts, database_name, created_at, completed_at
		 FROM sync_jobs
		 WHERE user_id = ?
		 ORDER BY created_at DESC
		 LIMIT 50`
	)
		.bind(userId)
		.all<{
			id: string;
			status: string;
			progress: number;
			total_transcripts: number;
			database_name: string | null;
			created_at: string;
			completed_at: string | null;
		}>();

	return {
		jobs: jobs.results || []
	};
};
