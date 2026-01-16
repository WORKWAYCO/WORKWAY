/**
 * Sync Engine - Core sync logic for Fireflies → Notion
 * 
 * Extracted to enable reuse across:
 * - Manual sync (POST /api/sync)
 * - Auto-sync (scheduled cron)
 * 
 * Zuhandenheit: The tool recedes - users see meetings in Notion, not sync mechanics.
 */

import { createFirefliesClient, isRateLimitError, type FirefliesTranscript } from '$lib/api/fireflies';
import { createNotionClient, formatTranscriptBlocks } from '$lib/api/notion';
import type { PropertyMapping } from '../../routes/api/property-mappings/+server';

export interface SyncParams {
	jobId: string;
	userId: string;
	userEmail: string;
	databaseId: string;
	transcriptIds: string[];
	propertyMapping: PropertyMapping;
	firefliesApiKey: string;
	notionAccessToken: string;
	db: D1Database;
	forceResync?: boolean;
}

export interface SyncResult {
	status: 'completed' | 'failed';
	progress: number;
	errors: Array<{ transcriptId: string; error: string }>;
}

/**
 * Process a batch of transcripts, syncing from Fireflies to Notion
 */
export async function processSync(params: SyncParams): Promise<SyncResult> {
	const { 
		jobId, userId, userEmail, databaseId, transcriptIds, propertyMapping, 
		firefliesApiKey, notionAccessToken, db, forceResync = false 
	} = params;

	const fireflies = createFirefliesClient(firefliesApiKey);
	const notion = createNotionClient(notionAccessToken);
	const errors: Array<{ transcriptId: string; error: string }> = [];

	try {
		// Update job status to running
		await db.prepare('UPDATE sync_jobs SET status = ?, started_at = datetime("now") WHERE id = ?')
			.bind('running', jobId)
			.run();

		// Get database schema to find the title property name
		const database = await notion.getDatabase(databaseId);
		if (!database) {
			throw new Error('Could not access Notion database');
		}

		// Find the title property (every Notion database has exactly one)
		const titlePropertyEntry = Object.entries(database.properties || {}).find(
			([, prop]) => prop.type === 'title'
		);
		const titlePropertyName = titlePropertyEntry ? titlePropertyEntry[0] : 'Name';

		let progress = 0;

		for (const transcriptId of transcriptIds) {
			try {
				// Check if already synced (deduplication)
				const existing = await db.prepare(
					'SELECT notion_page_id FROM synced_transcripts WHERE user_id = ? AND fireflies_transcript_id = ?'
				)
					.bind(userId, transcriptId)
					.first();

				if (existing && !forceResync) {
					progress++;
					await db.prepare('UPDATE sync_jobs SET progress = ? WHERE id = ?')
						.bind(progress, jobId)
						.run();
					continue;
				}

				// If force resync, delete existing sync record
				if (existing && forceResync) {
					await db.prepare(
						'DELETE FROM synced_transcripts WHERE user_id = ? AND fireflies_transcript_id = ?'
					)
						.bind(userId, transcriptId)
						.run();
				}

				// Fetch full transcript
				const transcript = await fireflies.getTranscript(transcriptId);

				if (!transcript) {
					errors.push({ transcriptId, error: 'Transcript not found in Fireflies' });
					continue;
				}

				// Build Notion page properties
				const properties = buildNotionProperties(
					transcript, 
					titlePropertyName, 
					propertyMapping,
					userEmail
				);

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

				progress++;
				await db.prepare('UPDATE sync_jobs SET progress = ? WHERE id = ?')
					.bind(progress, jobId)
					.run();

			} catch (error) {
				// Rate limit errors should stop the entire sync
				if (isRateLimitError(error)) {
					throw error;
				}
				const errMsg = error instanceof Error ? error.message : String(error);
				errors.push({ transcriptId, error: errMsg });
			}
		}

		// Determine final status
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

		// Update sync count
		if (progress > 0) {
			await db.prepare(
				'UPDATE subscriptions SET sync_count = sync_count + ? WHERE user_id = ?'
			)
				.bind(progress, userId)
				.run();
		}

		return { status: finalStatus, progress, errors };

	} catch (error) {
		let errMsg: string;
		if (isRateLimitError(error)) {
			const retryTime = error.retryAfter.toLocaleString('en-US', {
				timeZone: 'UTC',
				dateStyle: 'medium',
				timeStyle: 'short'
			});
			errMsg = `Fireflies rate limit reached. Try again after ${retryTime} UTC.`;
		} else {
			errMsg = error instanceof Error ? error.message : 'Unknown error';
		}
		
		await db.prepare(
			'UPDATE sync_jobs SET status = ?, error_message = ? WHERE id = ?'
		)
			.bind('failed', errMsg, jobId)
			.run();

		return { status: 'failed', progress: 0, errors: [{ transcriptId: 'all', error: errMsg }] };
	}
}

/**
 * Build Notion page properties from transcript data
 */
function buildNotionProperties(
	transcript: {
		title?: string;
		date?: number;
		transcript_url?: string;
		duration?: number;
		participants?: string[];
		summary?: { keywords?: string[] };
	},
	titlePropertyName: string,
	propertyMapping: PropertyMapping,
	userEmail?: string
): Record<string, unknown> {
	const properties: Record<string, unknown> = {
		[titlePropertyName]: {
			title: [{ text: { content: transcript.title || 'Untitled Meeting' } }]
		}
	};

	// Date
	if (propertyMapping.date && transcript.date) {
		properties[propertyMapping.date] = {
			date: { start: new Date(transcript.date).toISOString().split('T')[0] }
		};
	}

	// URL
	if (propertyMapping.url && transcript.transcript_url) {
		properties[propertyMapping.url] = {
			url: transcript.transcript_url
		};
	}

	// Duration (seconds to minutes)
	if (propertyMapping.duration && transcript.duration) {
		properties[propertyMapping.duration] = {
			number: Math.round(transcript.duration / 60)
		};
	}

	// Participants
	if (propertyMapping.participants && transcript.participants?.length) {
		const participantNames = transcript.participants
			.flatMap((p) => p.includes(',') ? p.split(',').map(s => s.trim()) : [p])
			.filter((p) => p.length > 0);

		if (participantNames.length > 0) {
			if (propertyMapping.participantsType === 'rich_text') {
				properties[propertyMapping.participants] = {
					rich_text: [{ text: { content: participantNames.join(', ') } }]
				};
			} else {
				properties[propertyMapping.participants] = {
					multi_select: participantNames.slice(0, 100).map((p) => ({ name: p }))
				};
			}
		}
	}

	// Keywords (as text, comma-separated)
	if (propertyMapping.keywords && transcript.summary?.keywords?.length) {
		properties[propertyMapping.keywords] = {
			rich_text: [{ text: { content: transcript.summary.keywords.slice(0, 20).join(', ') } }]
		};
	}

	// Owner (select property with user's login email)
	if (propertyMapping.owner && userEmail) {
		properties[propertyMapping.owner] = {
			select: { name: userEmail }
		};
	}

	return properties;
}

/**
 * Get unsynced transcript IDs for a user
 * Used by auto-sync to find new transcripts
 */
export async function getUnsyncedTranscriptIds(
	firefliesApiKey: string,
	userId: string,
	db: D1Database,
	limit = 50
): Promise<string[]> {
	const fireflies = createFirefliesClient(firefliesApiKey);
	
	// Get recent transcripts from Fireflies
	const transcripts = await fireflies.getTranscripts({ limit, skip: 0 });
	
	if (!transcripts?.length) {
		return [];
	}

	// Get already synced IDs
	const syncedResult = await db.prepare(
		'SELECT fireflies_transcript_id FROM synced_transcripts WHERE user_id = ?'
	)
		.bind(userId)
		.all<{ fireflies_transcript_id: string }>();

	const syncedIds = new Set(syncedResult.results?.map(r => r.fireflies_transcript_id) || []);

	// Return unsynced IDs
	return transcripts
		.filter((t: FirefliesTranscript) => !syncedIds.has(t.id))
		.map((t: FirefliesTranscript) => t.id);
}
