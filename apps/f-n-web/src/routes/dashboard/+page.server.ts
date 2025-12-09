import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!platform?.env) {
		return {
			connections: { fireflies: false, notion: false, notionWorkspace: null as string | null },
			subscription: null,
			recentJobs: []
		};
	}

	const { DB } = platform.env;
	const userId = locals.user!.id;

	// Get connected accounts
	const accounts = await DB.prepare(
		'SELECT provider, workspace_name FROM connected_accounts WHERE user_id = ?'
	)
		.bind(userId)
		.all<{ provider: string; workspace_name: string | null }>();

	const connections = {
		fireflies: accounts.results?.some((a) => a.provider === 'fireflies') || false,
		notion: accounts.results?.some((a) => a.provider === 'notion') || false,
		notionWorkspace: accounts.results?.find((a) => a.provider === 'notion')?.workspace_name
	};

	// Get subscription
	const subscription = await DB.prepare(
		'SELECT tier, status, sync_count, current_period_end FROM subscriptions WHERE user_id = ?'
	)
		.bind(userId)
		.first<{
			tier: string;
			status: string;
			sync_count: number;
			current_period_end: string | null;
		}>();

	// Get recent sync jobs
	const recentJobs = await DB.prepare(
		`SELECT id, status, progress, total_transcripts, database_name, created_at, completed_at
		 FROM sync_jobs
		 WHERE user_id = ?
		 ORDER BY created_at DESC
		 LIMIT 5`
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
		connections,
		subscription: subscription || { tier: 'free', status: 'free', sync_count: 0 },
		recentJobs: recentJobs.results || []
	};
};
