import type { PageServerLoad } from './$types';
import { createReadHelper } from '@workwayco/sdk';

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

	// Use eventual consistency for dashboard reads (faster, uses read replicas)
	const read = createReadHelper(DB, 'eventual');

	// Get connected accounts (eventual consistency - dashboard data)
	const accounts = await read.query<{ provider: string; workspace_name: string | null }>(
		'SELECT provider, workspace_name FROM connected_accounts WHERE user_id = ?',
		[userId]
	);

	const connections = {
		fireflies: accounts.some((a) => a.provider === 'fireflies'),
		notion: accounts.some((a) => a.provider === 'notion'),
		notionWorkspace: accounts.find((a) => a.provider === 'notion')?.workspace_name ?? null
	};

	// Get subscription (eventual consistency - display only)
	const subscription = await read.first<{
		tier: string;
		status: string;
		sync_count: number;
		current_period_end: string | null;
	}>(
		'SELECT tier, status, sync_count, current_period_end FROM subscriptions WHERE user_id = ?',
		[userId]
	);

	// Get recent sync jobs (eventual consistency - list view)
	const recentJobs = await read.query<{
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
		 LIMIT 5`,
		[userId]
	);

	return {
		connections,
		subscription: subscription || { tier: 'free', status: 'free', sync_count: 0 },
		recentJobs
	};
};
