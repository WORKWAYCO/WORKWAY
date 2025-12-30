import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createFirefliesClient } from '$lib/api/fireflies';
import { createNotionClient, formatTranscriptBlocks } from '$lib/api/notion';
import type { PropertyMapping } from '../property-mappings/+server';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const { DB } = platform.env;

	// Parse request body
	const body = await request.json().catch(() => ({}));
	const { databaseId, transcriptIds, dateFieldId } = body as {
		databaseId?: string;
		transcriptIds?: string[];
		dateFieldId?: string;
	};

	if (!databaseId) {
		return json({ error: 'Database ID is required' }, { status: 400 });
	}

	if (!transcriptIds?.length) {
		return json({ error: 'No transcripts selected' }, { status: 400 });
	}

	// Get connected accounts
	const accounts = await DB.prepare(
		'SELECT provider, access_token FROM connected_accounts WHERE user_id = ?'
	)
		.bind(locals.user.id)
		.all<{ provider: string; access_token: string }>();

	const firefliesAccount = accounts.results?.find((a) => a.provider === 'fireflies');
	const notionAccount = accounts.results?.find((a) => a.provider === 'notion');

	if (!firefliesAccount || !notionAccount) {
		return json({ error: 'Please connect both Fireflies and Notion' }, { status: 400 });
	}

	// Check subscription limits
	const subscription = await DB.prepare(
		'SELECT tier, sync_count, sync_count_reset_at FROM subscriptions WHERE user_id = ?'
	)
		.bind(locals.user.id)
		.first<{ tier: string; sync_count: number; sync_count_reset_at: string }>();

	const limits: Record<string, number> = {
		free: 5,
		pro: 100,
		unlimited: Infinity
	};

	const limit = limits[subscription?.tier || 'free'] || 5;

	// Check if reset is needed (monthly)
	const resetAt = subscription?.sync_count_reset_at ? new Date(subscription.sync_count_reset_at) : new Date();
	const now = new Date();
	let syncCount = subscription?.sync_count || 0;

	if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
		// Reset count for new month
		syncCount = 0;
		await DB.prepare(
			'UPDATE subscriptions SET sync_count = 0, sync_count_reset_at = ? WHERE user_id = ?'
		)
			.bind(now.toISOString(), locals.user.id)
			.run();
	}

	if (syncCount + transcriptIds.length > limit) {
		return json({
			error: `Sync limit reached. ${limit - syncCount} syncs remaining this month.`,
			remaining: limit - syncCount
		}, { status: 403 });
	}

	// Create sync job
	const jobId = crypto.randomUUID();

	await DB.prepare(
		`INSERT INTO sync_jobs (id, user_id, status, database_id, total_transcripts, selected_transcript_ids, date_field_id)
		 VALUES (?, ?, 'pending', ?, ?, ?, ?)`
	)
		.bind(
			jobId,
			locals.user.id,
			databaseId,
			transcriptIds.length,
			JSON.stringify(transcriptIds),
			dateFieldId || null
		)
		.run();

	// Load property mapping for this database
	const mappingRow = await DB.prepare(
		'SELECT mappings FROM property_mappings WHERE user_id = ? AND database_id = ?'
	)
		.bind(locals.user.id, databaseId)
		.first<{ mappings: string }>();

	const propertyMapping: PropertyMapping = mappingRow
		? JSON.parse(mappingRow.mappings)
		: { date: dateFieldId }; // Fallback to legacy dateFieldId

	// Start sync in background (using waitUntil for short syncs)
	platform.context.waitUntil(
		processSync({
			jobId,
			userId: locals.user.id,
			databaseId,
			transcriptIds,
			propertyMapping,
			firefliesApiKey: firefliesAccount.access_token,
			notionAccessToken: notionAccount.access_token,
			db: DB
		})
	);

	return json({ jobId, status: 'pending' });
};

async function processSync(params: {
	jobId: string;
	userId: string;
	databaseId: string;
	transcriptIds: string[];
	propertyMapping: PropertyMapping;
	firefliesApiKey: string;
	notionAccessToken: string;
	db: D1Database;
}) {
	const { jobId, userId, databaseId, transcriptIds, propertyMapping, firefliesApiKey, notionAccessToken, db } = params;

	const fireflies = createFirefliesClient(firefliesApiKey);
	const notion = createNotionClient(notionAccessToken);

	// Track errors for debugging
	const errors: Array<{ transcriptId: string; error: string }> = [];

	try {
		// Update job status to running
		await db.prepare('UPDATE sync_jobs SET status = ?, started_at = datetime("now") WHERE id = ?')
			.bind('running', jobId)
			.run();

		let progress = 0;

		for (const transcriptId of transcriptIds) {
			try {
				// Check if already synced (deduplication)
				const existing = await db.prepare(
					'SELECT notion_page_id FROM synced_transcripts WHERE user_id = ? AND fireflies_transcript_id = ?'
				)
					.bind(userId, transcriptId)
					.first();

				if (existing) {
					console.log(`Transcript ${transcriptId} already synced (dedup), skipping`);
					progress++;
					await db.prepare('UPDATE sync_jobs SET progress = ? WHERE id = ?')
						.bind(progress, jobId)
						.run();
					continue;
				}

				// Fetch full transcript
				const transcript = await fireflies.getTranscript(transcriptId);

				if (!transcript) {
					const errMsg = `Transcript not found in Fireflies: ${transcriptId}`;
					console.error(errMsg);
					errors.push({ transcriptId, error: errMsg });
					continue;
				}

				// Build Notion page properties - only Name is required
				const properties: Record<string, unknown> = {
					Name: {
						title: [{ text: { content: transcript.title || 'Untitled Meeting' } }]
					}
				};

				// Add date if mapped
				if (propertyMapping.date && transcript.date) {
					properties[propertyMapping.date] = {
						date: { start: new Date(transcript.date).toISOString().split('T')[0] }
					};
				}

				// Add URL if mapped (previously hardcoded 'Fireflies URL')
				if (propertyMapping.url && transcript.transcript_url) {
					properties[propertyMapping.url] = {
						url: transcript.transcript_url
					};
				}

				// Add duration if mapped (convert seconds to minutes)
				if (propertyMapping.duration && transcript.duration) {
					properties[propertyMapping.duration] = {
						number: Math.round(transcript.duration / 60)
					};
				}

				// Add participants if mapped
				if (propertyMapping.participants && transcript.participants?.length) {
					properties[propertyMapping.participants] = {
						multi_select: transcript.participants.map((p) => ({ name: p }))
					};
				}

				// Add keywords if mapped
				if (propertyMapping.keywords && transcript.summary?.keywords?.length) {
					properties[propertyMapping.keywords] = {
						multi_select: transcript.summary.keywords.slice(0, 10).map((k) => ({ name: k }))
					};
				}

				// Format content blocks
				const blocks = formatTranscriptBlocks(transcript);

				// Create Notion page
				const page = await notion.createPage(databaseId, properties, blocks.slice(0, 100));

				// Append remaining blocks if any
				if (blocks.length > 100) {
					await notion.appendBlocks(page.id, blocks.slice(100));
				}

				// Record synced transcript (for deduplication)
				await db.prepare(
					`INSERT INTO synced_transcripts (id, user_id, fireflies_transcript_id, notion_page_id, database_id, transcript_title)
					 VALUES (?, ?, ?, ?, ?, ?)`
				)
					.bind(crypto.randomUUID(), userId, transcriptId, page.id, databaseId, transcript.title)
					.run();

				console.log(`Successfully synced transcript ${transcriptId} → Notion page ${page.id}`);
				progress++;
				await db.prepare('UPDATE sync_jobs SET progress = ? WHERE id = ?')
					.bind(progress, jobId)
					.run();

			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				console.error(`Error syncing transcript ${transcriptId}:`, errMsg);
				errors.push({ transcriptId, error: errMsg });
				// Continue with other transcripts
			}
		}

		// Determine final status based on results
		const allFailed = progress === 0 && errors.length > 0;
		const finalStatus = allFailed ? 'failed' : 'completed';
		const errorMessage = errors.length > 0
			? `${errors.length} error(s): ${errors.map(e => e.error).join('; ').slice(0, 500)}`
			: null;

		await db.prepare(
			'UPDATE sync_jobs SET status = ?, error_message = ?, completed_at = datetime("now") WHERE id = ?'
		)
			.bind(finalStatus, errorMessage, jobId)
			.run();

		// Update sync count (only count successful syncs)
		if (progress > 0) {
			await db.prepare(
				'UPDATE subscriptions SET sync_count = sync_count + ? WHERE user_id = ?'
			)
				.bind(progress, userId)
				.run();
		}

		console.log(`Sync job ${jobId} ${finalStatus}: ${progress}/${transcriptIds.length} synced, ${errors.length} errors`);

	} catch (error) {
		const errMsg = error instanceof Error ? error.message : 'Unknown error';
		console.error('Sync job failed:', errMsg);
		await db.prepare(
			'UPDATE sync_jobs SET status = ?, error_message = ? WHERE id = ?'
		)
			.bind('failed', errMsg, jobId)
			.run();
	}
}

// GET endpoint for checking job status
export const GET: RequestHandler = async ({ url, locals, platform }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const jobId = url.searchParams.get('jobId');

	if (!jobId) {
		return json({ error: 'Job ID required' }, { status: 400 });
	}

	const job = await platform.env.DB.prepare(
		'SELECT status, progress, total_transcripts, error_message FROM sync_jobs WHERE id = ? AND user_id = ?'
	)
		.bind(jobId, locals.user.id)
		.first();

	if (!job) {
		return json({ error: 'Job not found' }, { status: 404 });
	}

	return json(job);
};
