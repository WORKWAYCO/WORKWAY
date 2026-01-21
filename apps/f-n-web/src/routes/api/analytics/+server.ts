/**
 * Analytics API for WORKWAY Dashboard Integration
 * 
 * Returns sync execution data in WORKWAY's standard analytics format.
 * Called by workway.co/workflows/private/fireflies-notion-sync/analytics
 * 
 * Zuhandenheit: Users see their sync history in the unified WORKWAY dashboard,
 * not scattered across separate apps.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SyncJob {
	id: string;
	status: string;
	progress: number;
	total_transcripts: number;
	trigger_type: string;
	error_message: string | null;
	created_at: string;
	started_at: string | null;
	completed_at: string | null;
}

interface AnalyticsResponse {
	workflow: {
		id: string;
		name: string;
		description: string;
	};
	user: {
		email: string;
		autoSyncEnabled: boolean;
		lastAutoSyncAt: string | null;
		totalSynced: number;
	};
	executions: Array<{
		id: string;
		status: string;
		triggerType: string;
		transcriptsSynced: number;
		totalTranscripts: number;
		errorMessage: string | null;
		startedAt: string | null;
		completedAt: string | null;
		executionTimeMs: number | null;
	}>;
	stats: {
		totalRuns: number;
		successfulRuns: number;
		failedRuns: number;
		successRate: number;
		totalTranscriptsSynced: number;
		avgExecutionTimeMs: number;
		lastRunAt: string | null;
	};
}

export const GET: RequestHandler = async ({ url, locals, platform }) => {
	// Support both authenticated users and email query param (for WORKWAY dashboard)
	const emailParam = url.searchParams.get('email');
	const userEmail = locals.user?.email || emailParam;

	if (!userEmail) {
		return json({ error: 'Email required (login or provide ?email=)' }, { status: 400 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const { DB } = platform.env;

	try {
		// Get user info
		const user = await DB.prepare(
			'SELECT id, email FROM users WHERE email = ?'
		).bind(userEmail).first<{ id: string; email: string }>();

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Get property mappings (auto-sync config)
		const config = await DB.prepare(`
			SELECT auto_sync_enabled, last_auto_sync_at, database_id
			FROM property_mappings
			WHERE user_id = ?
		`).bind(user.id).first<{
			auto_sync_enabled: number;
			last_auto_sync_at: string | null;
			database_id: string;
		}>();

		// Get total synced transcripts
		const syncedCount = await DB.prepare(
			'SELECT COUNT(*) as count FROM synced_transcripts WHERE user_id = ?'
		).bind(user.id).first<{ count: number }>();

		// Get sync jobs (executions)
		const jobs = await DB.prepare(`
			SELECT id, status, progress, total_transcripts, trigger_type,
			       error_message, created_at, started_at, completed_at
			FROM sync_jobs
			WHERE user_id = ?
			ORDER BY created_at DESC
			LIMIT 50
		`).bind(user.id).all<SyncJob>();

		const executions = jobs.results || [];

		// Calculate stats
		const successfulRuns = executions.filter(j => j.status === 'completed').length;
		const failedRuns = executions.filter(j => j.status === 'failed').length;
		const totalRuns = executions.length;

		const totalTranscriptsSynced = executions.reduce((sum, j) => sum + (j.progress || 0), 0);

		// Calculate average execution time
		const executionTimes = executions
			.filter(j => j.started_at && j.completed_at)
			.map(j => new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime());
		const avgExecutionTimeMs = executionTimes.length > 0
			? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
			: 0;

		const response: AnalyticsResponse = {
			workflow: {
				id: 'fireflies-notion-sync',
				name: 'Fireflies → Notion Sync',
				description: 'Automatically sync Fireflies meeting transcripts to Notion',
			},
			user: {
				email: user.email,
				autoSyncEnabled: config?.auto_sync_enabled === 1,
				lastAutoSyncAt: config?.last_auto_sync_at || null,
				totalSynced: syncedCount?.count || 0,
			},
			executions: executions.map(j => ({
				id: j.id,
				status: j.status,
				triggerType: j.trigger_type || 'manual',
				transcriptsSynced: j.progress || 0,
				totalTranscripts: j.total_transcripts || 0,
				errorMessage: j.error_message,
				startedAt: j.started_at,
				completedAt: j.completed_at,
				executionTimeMs: j.started_at && j.completed_at
					? new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()
					: null,
			})),
			stats: {
				totalRuns,
				successfulRuns,
				failedRuns,
				successRate: totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0,
				totalTranscriptsSynced,
				avgExecutionTimeMs,
				lastRunAt: executions[0]?.created_at || null,
			},
		};

		return json(response, {
			headers: {
				'Access-Control-Allow-Origin': 'https://workway.co',
				'Access-Control-Allow-Methods': 'GET',
				'Cache-Control': 'no-cache',
			},
		});

	} catch (error) {
		const errMsg = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: errMsg }, { status: 500 });
	}
};

// Handle CORS preflight
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': 'https://workway.co',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		},
	});
};
