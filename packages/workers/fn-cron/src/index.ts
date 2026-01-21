/**
 * fn-cron Worker
 * 
 * Cloudflare Worker with scheduled trigger to run auto-sync
 * for fn.workway.co (Fireflies → Notion sync)
 * 
 * Runs hourly via cron trigger.
 * Also supports bulk sync via POST /bulk-sync
 */

export interface Env {
	CRON_SECRET: string;
	FN_URL: string;
	DB: D1Database;
}

interface FirefliesTranscript {
	id: string;
	title: string;
	date: number;
	transcript_url?: string;
	duration?: number;
	participants?: string[];
	sentences?: Array<{ text: string; speaker_name?: string }>;
	summary?: { keywords?: string[] };
}

export default {
	/**
	 * Scheduled handler - triggered by cron
	 */
	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		const url = `${env.FN_URL}/api/cron/auto-sync`;
		
		console.log(`[fn-cron] Running auto-sync at ${new Date().toISOString()}`);
		
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${env.CRON_SECRET}`,
					'Content-Type': 'application/json',
				},
			});

			const result = await response.json();
			
			if (!response.ok) {
				console.error(`[fn-cron] Auto-sync failed: ${response.status}`, result);
				return;
			}

			console.log(`[fn-cron] Auto-sync complete:`, result);
		} catch (error) {
			console.error(`[fn-cron] Auto-sync error:`, error);
		}
	},

	/**
	 * HTTP handler - for manual testing and bulk sync
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);
		
		// GET / - status check
		if (request.method === 'GET' && url.pathname === '/') {
			return new Response(JSON.stringify({
				status: 'ok',
				worker: 'fn-cron',
				description: 'Hourly auto-sync trigger for fn.workway.co',
				target: `${env.FN_URL}/api/cron/auto-sync`,
				endpoints: [
					'GET / - status',
					'GET /analytics?email=user@example.com - get sync analytics (admin users see team metrics)',
					'POST / - trigger auto-sync',
					'POST /bulk-sync?email=user@example.com - bulk sync for user'
				],
				admins: ADMIN_CONFIGS.map(c => ({ email: c.email, teamName: c.teamName, managedUsers: c.managedUsers.length })),
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// GET /analytics - get sync analytics for WORKWAY dashboard
		if (request.method === 'GET' && url.pathname === '/analytics') {
			const email = url.searchParams.get('email');
			if (!email) {
				return new Response(JSON.stringify({ error: 'email query param required' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			
			// Check if this is an admin requesting team analytics
			const adminConfig = getAdminConfig(email);
			if (adminConfig) {
				return await getAdminAnalytics(email, adminConfig, env);
			}
			
			return await getAnalytics(email, env);
		}

		// POST /bulk-sync - bulk sync for a specific user
		if (request.method === 'POST' && url.pathname === '/bulk-sync') {
			const email = url.searchParams.get('email');
			if (!email) {
				return new Response(JSON.stringify({ error: 'email query param required' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			
			return await bulkSyncUser(email, env);
		}

		// POST / - trigger auto-sync
		if (request.method === 'POST') {
			const fnUrl = `${env.FN_URL}/api/cron/auto-sync`;
			
			const response = await fetch(fnUrl, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${env.CRON_SECRET}`,
					'Content-Type': 'application/json',
				},
			});

			const result = await response.json();
			
			return new Response(JSON.stringify({
				triggered: true,
				response: result,
			}), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response('Method not allowed', { status: 405 });
	},
};

// ============================================================================
// ADMIN CONFIGURATION
// ============================================================================

interface AdminConfig {
	email: string;
	teamName: string;
	managedUsers: string[];
}

/**
 * Admin users who can view team analytics
 * Pattern: Admin sees aggregated metrics for all users they manage
 */
const ADMIN_CONFIGS: AdminConfig[] = [
	{
		email: 'dm@halfdozen.co',
		teamName: 'Blondish',
		managedUsers: ['vivviv@gmail.com', 'joel@blondish.world'],
	},
	// Add more admin configs here as needed
];

function getAdminConfig(email: string): AdminConfig | null {
	return ADMIN_CONFIGS.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Get aggregated analytics for admin users
 * Shows team-wide metrics plus individual user breakdowns
 */
async function getAdminAnalytics(adminEmail: string, config: AdminConfig, env: Env): Promise<Response> {
	try {
		const teamUsers: Array<{
			email: string;
			autoSyncEnabled: boolean;
			lastAutoSyncAt: string | null;
			totalSynced: number;
			stats: {
				totalRuns: number;
				successfulRuns: number;
				failedRuns: number;
				successRate: number;
				totalTranscriptsSynced: number;
				avgExecutionTimeMs: number;
				lastRunAt: string | null;
			};
		}> = [];

		// Aggregate stats
		let totalTeamSynced = 0;
		let totalTeamRuns = 0;
		let totalTeamSuccess = 0;
		let totalTeamFailed = 0;
		let allExecutionTimes: number[] = [];

		// Get analytics for each managed user
		for (const userEmail of config.managedUsers) {
			const user = await env.DB.prepare(
				'SELECT id, email FROM users WHERE email = ?'
			).bind(userEmail).first<{ id: string; email: string }>();

			if (!user) continue;

			// Get property mappings
			const userConfig = await env.DB.prepare(`
				SELECT auto_sync_enabled, last_auto_sync_at
				FROM property_mappings
				WHERE user_id = ?
			`).bind(user.id).first<{
				auto_sync_enabled: number;
				last_auto_sync_at: string | null;
			}>();

			// Get total synced transcripts
			const syncedCount = await env.DB.prepare(
				'SELECT COUNT(*) as count FROM synced_transcripts WHERE user_id = ?'
			).bind(user.id).first<{ count: number }>();

			// Get sync jobs
			const jobs = await env.DB.prepare(`
				SELECT status, progress, started_at, completed_at, created_at
				FROM sync_jobs
				WHERE user_id = ?
				ORDER BY created_at DESC
				LIMIT 50
			`).bind(user.id).all<{
				status: string;
				progress: number;
				started_at: string | null;
				completed_at: string | null;
				created_at: string;
			}>();

			const executions = jobs.results || [];
			const successfulRuns = executions.filter(j => j.status === 'completed').length;
			const failedRuns = executions.filter(j => j.status === 'failed').length;
			const totalRuns = executions.length;
			const totalTranscriptsSynced = executions.reduce((sum, j) => sum + (j.progress || 0), 0);

			const executionTimes = executions
				.filter(j => j.started_at && j.completed_at)
				.map(j => new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime());
			const avgExecutionTimeMs = executionTimes.length > 0
				? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
				: 0;

			// Add to team aggregates
			totalTeamSynced += syncedCount?.count || 0;
			totalTeamRuns += totalRuns;
			totalTeamSuccess += successfulRuns;
			totalTeamFailed += failedRuns;
			allExecutionTimes.push(...executionTimes);

			teamUsers.push({
				email: user.email,
				autoSyncEnabled: userConfig?.auto_sync_enabled === 1,
				lastAutoSyncAt: userConfig?.last_auto_sync_at || null,
				totalSynced: syncedCount?.count || 0,
				stats: {
					totalRuns,
					successfulRuns,
					failedRuns,
					successRate: totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0,
					totalTranscriptsSynced,
					avgExecutionTimeMs,
					lastRunAt: executions[0]?.created_at || null,
				},
			});
		}

		const avgTeamExecutionTimeMs = allExecutionTimes.length > 0
			? Math.round(allExecutionTimes.reduce((a, b) => a + b, 0) / allExecutionTimes.length)
			: 0;

		const response = {
			workflow: {
				id: 'fireflies-notion-sync',
				name: 'Fireflies → Notion Sync',
				description: 'Automatically sync Fireflies meeting transcripts to Notion',
			},
			admin: {
				email: adminEmail,
				teamName: config.teamName,
				managedUsers: config.managedUsers,
			},
			teamStats: {
				totalUsers: teamUsers.length,
				usersWithAutoSync: teamUsers.filter(u => u.autoSyncEnabled).length,
				totalTranscriptsSynced: totalTeamSynced,
				totalRuns: totalTeamRuns,
				successfulRuns: totalTeamSuccess,
				failedRuns: totalTeamFailed,
				successRate: totalTeamRuns > 0 ? Math.round((totalTeamSuccess / totalTeamRuns) * 100) : 0,
				avgExecutionTimeMs: avgTeamExecutionTimeMs,
			},
			users: teamUsers,
		};

		return new Response(JSON.stringify(response), {
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': 'no-cache',
			},
		});

	} catch (error) {
		const errMsg = error instanceof Error ? error.message : 'Unknown error';
		return new Response(JSON.stringify({ error: errMsg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Get analytics for WORKWAY dashboard integration
 * Returns sync execution data in WORKWAY's standard format
 */
async function getAnalytics(email: string, env: Env): Promise<Response> {
	try {
		// Get user info
		const user = await env.DB.prepare(
			'SELECT id, email FROM users WHERE email = ?'
		).bind(email).first<{ id: string; email: string }>();

		if (!user) {
			return new Response(JSON.stringify({ error: 'User not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Get property mappings (auto-sync config)
		const config = await env.DB.prepare(`
			SELECT auto_sync_enabled, last_auto_sync_at, database_id
			FROM property_mappings
			WHERE user_id = ?
		`).bind(user.id).first<{
			auto_sync_enabled: number;
			last_auto_sync_at: string | null;
			database_id: string;
		}>();

		// Get total synced transcripts
		const syncedCount = await env.DB.prepare(
			'SELECT COUNT(*) as count FROM synced_transcripts WHERE user_id = ?'
		).bind(user.id).first<{ count: number }>();

		// Get sync jobs (executions)
		const jobs = await env.DB.prepare(`
			SELECT id, status, progress, total_transcripts, trigger_type,
			       error_message, created_at, started_at, completed_at
			FROM sync_jobs
			WHERE user_id = ?
			ORDER BY created_at DESC
			LIMIT 50
		`).bind(user.id).all<{
			id: string;
			status: string;
			progress: number;
			total_transcripts: number;
			trigger_type: string;
			error_message: string | null;
			created_at: string;
			started_at: string | null;
			completed_at: string | null;
		}>();

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

		const response = {
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

		return new Response(JSON.stringify(response), {
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
				'Cache-Control': 'no-cache',
			},
		});

	} catch (error) {
		const errMsg = error instanceof Error ? error.message : 'Unknown error';
		return new Response(JSON.stringify({ error: errMsg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Bulk sync all unsynced transcripts for a user
 */
async function bulkSyncUser(email: string, env: Env): Promise<Response> {
	const results: { synced: string[]; errors: string[] } = { synced: [], errors: [] };
	
	try {
		// Get user info and tokens
		const userRow = await env.DB.prepare(`
			SELECT 
				u.id as user_id,
				u.email,
				pm.database_id,
				pm.mappings,
				ca_ff.access_token as fireflies_token,
				ca_notion.access_token as notion_token
			FROM users u
			JOIN property_mappings pm ON u.id = pm.user_id
			JOIN connected_accounts ca_ff ON u.id = ca_ff.user_id AND ca_ff.provider = 'fireflies'
			JOIN connected_accounts ca_notion ON u.id = ca_notion.user_id AND ca_notion.provider = 'notion'
			WHERE u.email = ?
		`).bind(email).first<{
			user_id: string;
			email: string;
			database_id: string;
			mappings: string;
			fireflies_token: string;
			notion_token: string;
		}>();

		if (!userRow) {
			return new Response(JSON.stringify({ error: 'User not found or not fully configured' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Get already synced transcript IDs
		const syncedResult = await env.DB.prepare(
			'SELECT fireflies_transcript_id FROM synced_transcripts WHERE user_id = ?'
		).bind(userRow.user_id).all<{ fireflies_transcript_id: string }>();
		
		const syncedIds = new Set(syncedResult.results?.map(r => r.fireflies_transcript_id) || []);

		// Fetch ALL transcripts from Fireflies (API max is 50 per request)
		const transcripts = await fetchFirefliesTranscripts(userRow.fireflies_token, 50);
		
		if (!transcripts.length) {
			return new Response(JSON.stringify({ 
				message: 'No transcripts found in Fireflies',
				synced: [],
				errors: []
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Filter to unsynced only
		const unsyncedTranscripts = transcripts.filter(t => !syncedIds.has(t.id));
		
		if (!unsyncedTranscripts.length) {
			return new Response(JSON.stringify({ 
				message: 'All transcripts already synced',
				total: transcripts.length,
				synced: [],
				errors: []
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const propertyMapping = JSON.parse(userRow.mappings);

		// Get Notion database schema
		const database = await fetchNotionDatabase(userRow.notion_token, userRow.database_id);
		const titlePropertyName = findTitleProperty(database) || 'Name';

		// Sync each transcript
		for (const transcript of unsyncedTranscripts) {
			try {
				// Fetch full transcript details
				const fullTranscript = await fetchFirefliesTranscript(userRow.fireflies_token, transcript.id);
				
				if (!fullTranscript) {
					results.errors.push(`${transcript.id}: Not found in Fireflies`);
					continue;
				}

				// Build Notion properties
				const properties = buildNotionProperties(fullTranscript, titlePropertyName, propertyMapping, email);
				
				// Format content blocks
				const blocks = formatTranscriptBlocks(fullTranscript);

				// Create Notion page
				const page = await createNotionPage(
					userRow.notion_token, 
					userRow.database_id, 
					properties, 
					blocks.slice(0, 100)
				);

				// Append remaining blocks if any
				if (blocks.length > 100) {
					await appendNotionBlocks(userRow.notion_token, page.id, blocks.slice(100));
				}

				// Record synced transcript
				await env.DB.prepare(
					`INSERT INTO synced_transcripts (id, user_id, fireflies_transcript_id, notion_page_id, database_id, transcript_title)
					 VALUES (?, ?, ?, ?, ?, ?)`
				).bind(
					crypto.randomUUID(),
					userRow.user_id,
					transcript.id,
					page.id,
					userRow.database_id,
					fullTranscript.title || 'Untitled'
				).run();

				results.synced.push(fullTranscript.title || transcript.id);
				
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);
				results.errors.push(`${transcript.id}: ${errMsg}`);
			}
		}

		return new Response(JSON.stringify({
			message: `Bulk sync complete: ${results.synced.length} synced, ${results.errors.length} errors`,
			total: transcripts.length,
			unsynced: unsyncedTranscripts.length,
			synced: results.synced,
			errors: results.errors.slice(0, 10) // Limit error output
		}), {
			headers: { 'Content-Type': 'application/json' },
		});

	} catch (error) {
		const errMsg = error instanceof Error ? error.message : String(error);
		return new Response(JSON.stringify({ error: errMsg }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

// === Fireflies API ===

async function fetchFirefliesTranscripts(apiKey: string, limit: number): Promise<FirefliesTranscript[]> {
	const query = `
		query GetTranscripts($limit: Int, $skip: Int) {
			transcripts(limit: $limit, skip: $skip) {
				id
				title
				date
				transcript_url
				duration
				participants
			}
		}
	`;

	const response = await fetch('https://api.fireflies.ai/graphql', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify({ query, variables: { limit, skip: 0 } }),
	});

	const responseText = await response.text();
	console.log('[Fireflies] Response:', responseText.slice(0, 500));
	
	const data = JSON.parse(responseText) as { 
		data?: { transcripts?: FirefliesTranscript[] };
		errors?: Array<{ message: string }>;
	};
	
	if (data.errors?.length) {
		console.error('[Fireflies] Errors:', JSON.stringify(data.errors));
		throw new Error(data.errors[0].message);
	}
	
	return data.data?.transcripts || [];
}

async function fetchFirefliesTranscript(apiKey: string, id: string): Promise<FirefliesTranscript | null> {
	const query = `
		query Transcript($id: String!) {
			transcript(id: $id) {
				id
				title
				date
				transcript_url
				duration
				participants
				sentences {
					text
					speaker_name
				}
				summary {
					keywords
				}
			}
		}
	`;

	const response = await fetch('https://api.fireflies.ai/graphql', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify({ query, variables: { id } }),
	});

	const data = await response.json() as { data?: { transcript?: FirefliesTranscript } };
	return data.data?.transcript || null;
}

// === Notion API ===

async function fetchNotionDatabase(token: string, databaseId: string): Promise<Record<string, unknown>> {
	const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
		headers: {
			'Authorization': `Bearer ${token}`,
			'Notion-Version': '2022-06-28',
		},
	});
	return await response.json() as Record<string, unknown>;
}

function findTitleProperty(database: Record<string, unknown>): string | null {
	const properties = database.properties as Record<string, { type: string }> | undefined;
	if (!properties) return null;
	
	for (const [name, prop] of Object.entries(properties)) {
		if (prop.type === 'title') return name;
	}
	return null;
}

async function createNotionPage(
	token: string,
	databaseId: string,
	properties: Record<string, unknown>,
	blocks: unknown[]
): Promise<{ id: string }> {
	const response = await fetch('https://api.notion.com/v1/pages', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Notion-Version': '2022-06-28',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			parent: { database_id: databaseId },
			properties,
			children: blocks,
		}),
	});

	if (!response.ok) {
		const error = await response.json() as { message?: string };
		throw new Error(error.message || `Notion API error: ${response.status}`);
	}

	return await response.json() as { id: string };
}

async function appendNotionBlocks(token: string, pageId: string, blocks: unknown[]): Promise<void> {
	await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
		method: 'PATCH',
		headers: {
			'Authorization': `Bearer ${token}`,
			'Notion-Version': '2022-06-28',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ children: blocks }),
	});
}

// === Property & Block Building ===

function buildNotionProperties(
	transcript: FirefliesTranscript,
	titlePropertyName: string,
	propertyMapping: Record<string, string>,
	userEmail: string
): Record<string, unknown> {
	const properties: Record<string, unknown> = {
		[titlePropertyName]: {
			title: [{ text: { content: transcript.title || 'Untitled Meeting' } }]
		}
	};

	if (propertyMapping.date && transcript.date) {
		properties[propertyMapping.date] = {
			date: { start: new Date(transcript.date).toISOString().split('T')[0] }
		};
	}

	if (propertyMapping.url && transcript.transcript_url) {
		properties[propertyMapping.url] = { url: transcript.transcript_url };
	}

	if (propertyMapping.duration && transcript.duration) {
		properties[propertyMapping.duration] = { number: Math.round(transcript.duration / 60) };
	}

	if (propertyMapping.participants && transcript.participants?.length) {
		const names = transcript.participants
			.flatMap(p => p.includes(',') ? p.split(',').map(s => s.trim()) : [p])
			.filter(p => p.length > 0);

		if (names.length > 0) {
			if (propertyMapping.participantsType === 'rich_text') {
				properties[propertyMapping.participants] = {
					rich_text: [{ text: { content: names.join(', ') } }]
				};
			} else {
				properties[propertyMapping.participants] = {
					multi_select: names.slice(0, 100).map(p => ({ name: p }))
				};
			}
		}
	}

	if (propertyMapping.keywords && transcript.summary?.keywords?.length) {
		properties[propertyMapping.keywords] = {
			rich_text: [{ text: { content: transcript.summary.keywords.slice(0, 20).join(', ') } }]
		};
	}

	if (propertyMapping.owner && userEmail) {
		properties[propertyMapping.owner] = { select: { name: userEmail } };
	}

	return properties;
}

function formatTranscriptBlocks(transcript: FirefliesTranscript): unknown[] {
	const blocks: unknown[] = [];

	// Header with meeting info
	blocks.push({
		object: 'block',
		type: 'callout',
		callout: {
			rich_text: [{ text: { content: `📅 ${new Date(transcript.date).toLocaleDateString()} • ⏱️ ${Math.round((transcript.duration || 0) / 60)} min` } }],
			icon: { emoji: '🎙️' }
		}
	});

	if (transcript.transcript_url) {
		blocks.push({
			object: 'block',
			type: 'bookmark',
			bookmark: { url: transcript.transcript_url }
		});
	}

	// Transcript content
	if (transcript.sentences?.length) {
		blocks.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: 'Transcript' } }] }
		});

		let currentSpeaker = '';
		let currentText: string[] = [];

		for (const sentence of transcript.sentences) {
			const speaker = sentence.speaker_name || 'Unknown';
			
			if (speaker !== currentSpeaker) {
				if (currentText.length > 0) {
					blocks.push({
						object: 'block',
						type: 'paragraph',
						paragraph: {
							rich_text: [
								{ text: { content: `**${currentSpeaker}**: ` }, annotations: { bold: true } },
								{ text: { content: currentText.join(' ') } }
							]
						}
					});
				}
				currentSpeaker = speaker;
				currentText = [];
			}
			currentText.push(sentence.text);
		}

		// Add remaining text
		if (currentText.length > 0) {
			blocks.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [
						{ text: { content: `**${currentSpeaker}**: ` }, annotations: { bold: true } },
						{ text: { content: currentText.join(' ') } }
					]
				}
			});
		}
	}

	return blocks;
}
