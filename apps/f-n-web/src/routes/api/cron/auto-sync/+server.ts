/**
 * Auto-Sync Cron Endpoint
 * 
 * Triggered hourly by Cloudflare Cron Trigger.
 * Finds users with auto-sync enabled and syncs their new transcripts.
 * 
 * Security: Protected by cron secret header
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processSync, getUnsyncedTranscriptIds } from '$lib/server/sync-engine';
import type { PropertyMapping } from '../../property-mappings/+server';

// Cron secret for authentication (set in wrangler.toml vars)
const CRON_SECRET = 'fn-auto-sync-2026';

export const POST: RequestHandler = async ({ request, platform }) => {
	// Verify cron secret
	const authHeader = request.headers.get('Authorization');
	if (authHeader !== `Bearer ${CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const { DB } = platform.env;
	const results: Array<{ userId: string; databaseId: string; synced: number; error?: string }> = [];

	try {
		// Find all users with auto-sync enabled
		const autoSyncUsers = await DB.prepare(`
			SELECT 
				pm.user_id,
				pm.database_id,
				pm.mappings,
				ca_ff.access_token as fireflies_token,
				ca_notion.access_token as notion_token,
				u.email as user_email
			FROM property_mappings pm
			JOIN connected_accounts ca_ff 
				ON pm.user_id = ca_ff.user_id AND ca_ff.provider = 'fireflies'
			JOIN connected_accounts ca_notion 
				ON pm.user_id = ca_notion.user_id AND ca_notion.provider = 'notion'
			LEFT JOIN users u
				ON pm.user_id = u.id
			WHERE pm.auto_sync_enabled = 1
		`).all<{
			user_id: string;
			database_id: string;
			mappings: string;
			fireflies_token: string;
			notion_token: string;
			user_email: string | null;
		}>();

		if (!autoSyncUsers.results?.length) {
			return json({ message: 'No users with auto-sync enabled', results: [] });
		}

		// Process each user
		for (const user of autoSyncUsers.results) {
			try {
				// Get unsynced transcripts (limit to 10 per run to stay within rate limits)
				const unsyncedIds = await getUnsyncedTranscriptIds(
					user.fireflies_token,
					user.user_id,
					DB,
					10
				);

				if (unsyncedIds.length === 0) {
					results.push({ 
						userId: user.user_id, 
						databaseId: user.database_id, 
						synced: 0 
					});
					continue;
				}

				// Create sync job
				const jobId = crypto.randomUUID();
				await DB.prepare(
					`INSERT INTO sync_jobs (id, user_id, status, database_id, total_transcripts, selected_transcript_ids)
					 VALUES (?, ?, 'pending', ?, ?, ?)`
				)
					.bind(jobId, user.user_id, user.database_id, unsyncedIds.length, JSON.stringify(unsyncedIds))
					.run();

				const propertyMapping: PropertyMapping = JSON.parse(user.mappings);

				// Process sync
				const result = await processSync({
					jobId,
					userId: user.user_id,
					userEmail: user.user_email || '',
					databaseId: user.database_id,
					transcriptIds: unsyncedIds,
					propertyMapping,
					firefliesApiKey: user.fireflies_token,
					notionAccessToken: user.notion_token,
					db: DB
				});

				// Update last_auto_sync_at
				await DB.prepare(
					'UPDATE property_mappings SET last_auto_sync_at = datetime("now") WHERE user_id = ? AND database_id = ?'
				)
					.bind(user.user_id, user.database_id)
					.run();

				results.push({
					userId: user.user_id,
					databaseId: user.database_id,
					synced: result.progress,
					error: result.errors.length > 0 ? result.errors[0].error : undefined
				});

			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				results.push({
					userId: user.user_id,
					databaseId: user.database_id,
					synced: 0,
					error: errMsg
				});
			}
		}

		const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
		return json({ 
			message: `Auto-sync complete: ${totalSynced} transcripts synced for ${results.length} users`,
			results 
		});

	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error);
		console.error('Auto-sync cron failed:', errMsg);
		return json({ error: errMsg }, { status: 500 });
	}
};

// Also support GET for manual testing (with same auth)
export const GET: RequestHandler = async (event) => {
	return POST(event);
};
