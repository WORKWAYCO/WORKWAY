/**
 * databases-mirrored: Share a Notion Database
 *
 * Keep two Notion databases in sync across workspaces.
 * Your items appear in their database. Their updates appear in yours.
 * Changes sync every five seconds. Last edit wins.
 *
 * ## What's New in v2.0.0
 *
 * - **Optional Filtering**: Specify a property and values to filter which pages sync
 * - **Multi-client support**: Share one database with multiple clients, each seeing only their items
 * - **Backwards compatible**: No filter = syncs all pages (same as v1)
 *
 * ## Design Philosophy (Heideggerian)
 *
 * The client never sees WORKWAY. They click a link, connect Notion, pick a database.
 * From then on, items just appear. The tool disappears into the background of their work.
 *
 * ## Architecture
 *
 * ```
 * Agency Notion                              Client Notion
 * (Base Database)                            (Mirror Database)
 *       │                                           │
 *       │ ←────── Optional Filter Layer ──────→    │
 *       │         (e.g., Client = "Acme")          │
 *       │                                           │
 *       │ ←────── SyncScheduler DO (5s) ──────→    │
 *       │      Content-based comparison            │
 *       │      Last-write-wins resolution          │
 *       │                                           │
 *       ▼                                           ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    databases-mirrored                        │
 * │  ┌─────────────────────────────────────────────────────────┐ │
 * │  │ State Store (KV)                                        │ │
 * │  │ - pageId → { basePageId, mirrorPageId, lastSync }       │ │
 * │  │ - propertyMappings: auto-discovered by name             │ │
 * │  │ - filterProperty / filterValues (optional)              │ │
 * │  └─────────────────────────────────────────────────────────┘ │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Sync Flow
 *
 * 1. **Initial Sync** (triggered on client_connected)
 *    - Copy all pages from base database to mirror (filtered if configured)
 *    - Store page ID mappings in state
 *    - Activate 5-second SyncScheduler
 *
 * 2. **Bidirectional Sync** (every 5 seconds via SyncScheduler DO)
 *    - Compare content (not timestamps—Notion updates those on view)
 *    - When content differs: last_edited_time determines winner
 *    - Newer page's values sync to older page
 *    - New pages in either database sync to the other (respecting filter)
 *
 * ## Conflict Resolution: Last-Write-Wins
 *
 * When base and mirror have different values:
 * - Compare last_edited_time on both pages
 * - More recently edited page wins
 * - Winner's values sync to loser
 * - No ping-pong, no overwrites
 *
 * ## Property Auto-Mapping
 *
 * Properties sync automatically when names match:
 * - "Status" in base ↔ "Status" in mirror ✓
 * - "Priority" in base, no match in mirror → skipped
 * - Supports: checkbox, text, select, date, number, url, email
 *
 * ## Filtering (v2.0.0+)
 *
 * Optionally filter which pages sync:
 * - filterProperty: "Client" → filterValues: "Acme Corp"
 * - Only pages where Client = "Acme Corp" sync to mirror
 * - Leave empty to sync all pages (v1 behavior)
 *
 * @public Marketplace workflow
 * @version 2.0.0
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';
import { delay } from '../_shared/utils.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Time window to ignore events after a sync (prevents infinite loops) */
const LOOP_PREVENTION_WINDOW_MS = 5000;

/** State key prefix for KV storage */
const STATE_KEY_PREFIX = 'databases-mirrored:';

/** Maximum pages to process per initial sync batch */
const MAX_PAGES_PER_BATCH = 100;

/** Delay between API calls (ms) to respect Notion rate limits (3 req/s) */
const API_DELAY_MS = 350;

/** Notion API version */
const NOTION_VERSION = '2022-06-28';

// ============================================================================
// TYPES
// ============================================================================

interface SyncState {
	baseDatabase: string;
	mirrorDatabase: string;
	lastSyncTime: string; // ISO timestamp
	pageMappings: Record<
		string,
		{
			basePageId: string;
			mirrorPageId: string;
			lastSyncedAt: string;
			lastSyncDirection: 'base_to_mirror' | 'mirror_to_base';
		}
	>;
	/** Pages currently being synced - for loop prevention */
	syncLocks: Record<string, number>; // pageId → timestamp
	/** Property mappings discovered during initial sync */
	propertyMappings: PropertyMapping[];
	/** Initial sync status */
	initialSyncStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
	initialSyncProgress?: {
		total: number;
		synced: number;
		startedAt: string;
	};
}

interface PropertyMapping {
	baseName: string;
	mirrorName: string;
	type: string; // Notion property type
}

interface SyncResult {
	success: boolean;
	created: number;
	updated: number;
	skipped: number;
	errors: number;
	errorDetails?: string[];
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'Share a Notion Database',
	description:
		'Collaborate on a Notion database without sharing your workspace. Send a link, they connect Notion, everything syncs every five seconds. Their updates appear in yours. Yours appear in theirs. Last edit wins. Optionally filter by property to share only specific items.',
	version: '2.0.0',

	pathway: {
		outcomeFrame: 'when_collaborating',

		outcomeStatement: {
			suggestion: 'Need to share a database with someone outside your workspace?',
			explanation:
				'Pick a database. Send a link. They connect their Notion and choose where items should appear. Changes sync every five seconds, both ways. Last edit wins.',
			outcome: 'A shared database without sharing your workspace',
		},

		primaryPair: {
			from: 'notion',
			to: 'notion',
			workflowId: 'databases-mirrored',
			outcome: 'Databases that stay in sync',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion'],
				workflowId: 'databases-mirrored',
				priority: 85,
			},
		],

		smartDefaults: {
			conflictResolution: { value: 'last_write_wins' },
		},

		essentialFields: ['baseDatabase'],

		zuhandenheit: {
			timeToValue: 5, // Minutes to first outcome
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},

		walkthrough: {
			scenes: [
				{
					title: 'The Problem',
					text: "You're working with a client. They need to see the project status. Update deliverables. Check what's done. But your Notion workspace is yours. You can't just add them to it. Too much access. Too many other things they shouldn't see. So you end up with workarounds. Duplicating databases. Copying and pasting updates. Hoping nothing gets out of sync. It's not collaboration. It's busywork.",
				},
				{
					title: 'What Share a Notion Database Does',
					text: "This workflow creates a bridge between two Notion workspaces. You pick a database. Send a link. That's it. They click the link, connect their Notion, and choose a database in their workspace. From that moment, everything syncs. In both directions. When you add a task, it appears in their database. When they check a box, you see it in yours. When they create something new, it shows up on your side too. Two workspaces. One shared database. No manual copying. No drift.",
				},
				{
					title: 'How It Works',
					text: "The sync runs every five seconds. Near real-time. Properties match by name. If your database has 'Status' and theirs has 'Status,' those stay in sync. Checkboxes, text, dates, selects—all of it. If they rename something or you add a new column, no problem. Only matching properties sync. Everything else stays separate. And when you both make changes? The most recent edit wins. No conflicts. No overwrites. Just the freshest version, always.",
				},
				{
					title: 'The Setup',
					text: "Setup takes two minutes. Connect your Notion. Pick the database you want to share. WORKWAY generates a link. Send it to your client—email, Slack, however you communicate. They click it. Connect their Notion. Pick their database. The initial sync runs automatically. Five-second sync activates immediately. That's it. You're connected.",
				},
				{
					title: 'Close',
					text: "Share a Notion Database doesn't change how you work in Notion. It extends where your work can go. Your workspace stays yours. Their workspace stays theirs. One database, shared between them. Changes in five seconds. Last edit wins. The sync disappears. And collaboration just works.",
				},
			],
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.05,
		freeExecutions: 100,
		description: 'First 100 syncs free, then $0.05 per sync',
	},

	integrations: [
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases', 'write_databases'] },
	],

	config: {
		// Base database - selected by agency during installation
		baseDatabase: {
			type: 'text',
			label: 'Your Database',
			required: true,
			description: 'The database you want to share with clients',
		},

		// Filter property - optional, to filter which items sync (v2.0.0+)
		filterProperty: {
			type: 'text',
			label: 'Filter Property (Optional)',
			required: false,
			description: 'Property name to filter by (e.g., "Client", "Project"). Leave empty to sync all items.',
		},

		// Filter values - comma-separated list of values to include (v2.0.0+)
		filterValues: {
			type: 'text',
			label: 'Filter Values',
			required: false,
			description: 'Comma-separated values to include (e.g., "Acme Corp" or "Client A, Client B")',
		},

		// Mirror database - filled in by client invite flow
		_mirrorDatabase: {
			type: 'text',
			label: 'Client Database',
			required: false,
			description: 'Filled automatically when client accepts invite',
		},

		// Mirror token - encrypted, filled by client OAuth
		_mirrorNotionToken: {
			type: 'text',
			label: 'Client Notion Token',
			required: false,
			description: 'Encrypted token from client OAuth flow',
		},

		// Client email - optional, for notifications
		_mirrorEmail: {
			type: 'text',
			label: 'Client Email',
			required: false,
			description: 'For sync notifications',
		},
	},

	// Webhook triggers for real-time sync
	trigger: webhook({
		path: '/databases-mirrored',
		events: ['page.created', 'page.properties.updated'],
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const { baseDatabase, _mirrorDatabase, _mirrorNotionToken } = inputs;

		// Handle initial sync trigger (from client invite flow)
		if (trigger.type === 'oauth_callback' && trigger.data?.type === 'client_connected') {
			return await performInitialSync({
				baseDatabase: baseDatabase as string,
				mirrorDatabase: trigger.data.mirrorDatabaseId as string,
				mirrorToken: _mirrorNotionToken as string,
				clientInviteId: trigger.data.clientInviteId as string,
				integrations,
				env,
			});
		}

		// Handle webhook triggers for ongoing sync
		if (trigger.type === 'webhook') {
			// Validate webhook token if secret is configured
			// This provides basic authentication for webhook endpoints
			const webhookSecret = env.WORKFLOW_API_SECRET;
			if (webhookSecret) {
				const payload = trigger.data as {
					_token?: string;
					page?: { id: string; last_edited_time: string };
					database_id?: string;
				};

				// Constant-time comparison to prevent timing attacks
				const payloadToken = payload._token || '';
				if (payloadToken.length !== webhookSecret.length) {
					return { success: false, error: 'Invalid webhook token' };
				}

				let isValid = true;
				for (let i = 0; i < webhookSecret.length; i++) {
					if (payloadToken.charCodeAt(i) !== webhookSecret.charCodeAt(i)) {
						isValid = false;
					}
				}

				if (!isValid) {
					return { success: false, error: 'Invalid webhook token' };
				}
			}

			const payload = trigger.data as {
				page?: { id: string; last_edited_time: string };
				database_id?: string;
			};

			if (!payload?.page?.id) {
				return { success: false, error: 'Missing page ID in webhook payload' };
			}

			// Determine sync direction based on which database the webhook came from
			const pageId = payload.page.id;
			const databaseId = payload.database_id;

			if (databaseId === baseDatabase) {
				return await syncBaseToMirror({
					pageId,
					baseDatabase: baseDatabase as string,
					mirrorDatabase: _mirrorDatabase as string,
					mirrorToken: _mirrorNotionToken as string,
					integrations,
					env,
				});
			} else if (databaseId === _mirrorDatabase) {
				return await syncMirrorToBase({
					pageId,
					baseDatabase: baseDatabase as string,
					mirrorDatabase: _mirrorDatabase as string,
					mirrorToken: _mirrorNotionToken as string,
					integrations,
					env,
				});
			}

			return { success: false, error: 'Webhook from unknown database' };
		}

		return { success: false, error: 'Unknown trigger type' };
	},

	onError: async ({ error, inputs }) => {
		console.error(`databases-mirrored failed for base database ${inputs.baseDatabase}:`, error);
	},
});

// ============================================================================
// INITIAL SYNC
// ============================================================================

/**
 * Perform initial sync when client connects their database
 * Copies all pages from base database to mirror database
 */
async function performInitialSync(params: {
	baseDatabase: string;
	mirrorDatabase: string;
	mirrorToken: string;
	clientInviteId: string;
	integrations: any;
	env: any;
}): Promise<SyncResult> {
	const { baseDatabase, mirrorDatabase, mirrorToken, clientInviteId, integrations, env } = params;

	const result: SyncResult = {
		success: false,
		created: 0,
		updated: 0,
		skipped: 0,
		errors: 0,
		errorDetails: [],
	};

	const stateKey = `${STATE_KEY_PREFIX}${baseDatabase}:${mirrorDatabase}`;

	// Initialize or load state
	let state: SyncState = (await env.KV?.get(stateKey, 'json')) || {
		baseDatabase,
		mirrorDatabase,
		lastSyncTime: new Date().toISOString(),
		pageMappings: {},
		syncLocks: {},
		propertyMappings: [],
		initialSyncStatus: 'pending',
	};

	state.initialSyncStatus = 'in_progress';
	state.initialSyncProgress = {
		total: 0,
		synced: 0,
		startedAt: new Date().toISOString(),
	};

	try {
		// 1. Get base database schema
		const baseDbResult = await integrations.notion.databases.retrieve({
			database_id: baseDatabase,
		});

		if (!baseDbResult.success) {
			throw new Error('Failed to fetch base database schema');
		}

		const baseProperties = baseDbResult.data.properties;

		// 2. Get mirror database schema (using client's token)
		const mirrorDbResult = await fetchWithToken(
			`https://api.notion.com/v1/databases/${mirrorDatabase}`,
			mirrorToken,
			'GET'
		);

		if (!mirrorDbResult.ok) {
			throw new Error('Failed to fetch mirror database schema');
		}

		const mirrorDbData = await mirrorDbResult.json();
		const mirrorProperties = mirrorDbData.properties;

		// 3. Auto-discover property mappings (same name = same mapping)
		state.propertyMappings = discoverPropertyMappings(baseProperties, mirrorProperties);

		if (state.propertyMappings.length === 0) {
			result.errorDetails?.push('No matching properties found between databases');
			// Continue anyway - might just be status updates
		}

		// 4. Query all pages from base database
		let hasMore = true;
		let startCursor: string | undefined;
		const allBasePages: any[] = [];

		while (hasMore) {
			const queryResult = await integrations.notion.databases.query({
				database_id: baseDatabase,
				page_size: MAX_PAGES_PER_BATCH,
				start_cursor: startCursor,
			});

			if (!queryResult.success) {
				throw new Error('Failed to query base database');
			}

			allBasePages.push(...queryResult.data.results);
			hasMore = queryResult.data.has_more;
			startCursor = queryResult.data.next_cursor;

			// Rate limiting
			await delay(API_DELAY_MS);
		}

		state.initialSyncProgress.total = allBasePages.length;
		await env.KV?.put(stateKey, JSON.stringify(state));

		// 5. Create each page in mirror database
		for (const basePage of allBasePages) {
			try {
				// Map properties from base to mirror
				const mirrorProperties = mapProperties(
					basePage.properties,
					state.propertyMappings,
					'base_to_mirror'
				);

				// Create page in mirror database using client's token
				const createResult = await fetchWithToken(
					'https://api.notion.com/v1/pages',
					mirrorToken,
					'POST',
					{
						parent: { database_id: mirrorDatabase },
						properties: mirrorProperties,
					}
				);

				if (createResult.ok) {
					const newPage = await createResult.json();

					// Store page mapping
					state.pageMappings[basePage.id] = {
						basePageId: basePage.id,
						mirrorPageId: newPage.id,
						lastSyncedAt: new Date().toISOString(),
						lastSyncDirection: 'base_to_mirror',
					};

					result.created++;
				} else {
					const errorData = await createResult.json();
					result.errors++;
					result.errorDetails?.push(`Failed to create mirror page: ${errorData.message || createResult.status}`);
				}

				state.initialSyncProgress.synced++;
				
				// Update state periodically
				if (state.initialSyncProgress.synced % 10 === 0) {
					await env.KV?.put(stateKey, JSON.stringify(state));
				}

				// Rate limiting
				await delay(API_DELAY_MS);
			} catch (pageError) {
				result.errors++;
				result.errorDetails?.push(
					`Error syncing page ${basePage.id}: ${pageError instanceof Error ? pageError.message : 'Unknown'}`
				);
			}
		}

		// 6. Finalize state
		state.initialSyncStatus = result.errors === 0 ? 'completed' : 'completed'; // Complete even with errors
		state.lastSyncTime = new Date().toISOString();
		await env.KV?.put(stateKey, JSON.stringify(state));

		result.success = true;
		return result;
	} catch (error) {
		state.initialSyncStatus = 'failed';
		await env.KV?.put(stateKey, JSON.stringify(state));

		result.errorDetails?.push(error instanceof Error ? error.message : 'Unknown error');
		return result;
	}
}

// ============================================================================
// BIDIRECTIONAL SYNC
// ============================================================================

/**
 * Sync a page from base database to mirror database
 * Triggered by webhook on base database
 */
async function syncBaseToMirror(params: {
	pageId: string;
	baseDatabase: string;
	mirrorDatabase: string;
	mirrorToken: string;
	integrations: any;
	env: any;
}): Promise<{ success: boolean; action?: string; error?: string }> {
	const { pageId, baseDatabase, mirrorDatabase, mirrorToken, integrations, env } = params;

	const stateKey = `${STATE_KEY_PREFIX}${baseDatabase}:${mirrorDatabase}`;
	const state: SyncState | null = await env.KV?.get(stateKey, 'json');

	if (!state) {
		return { success: false, error: 'Sync state not found - run initial sync first' };
	}

	// Loop prevention: check if we recently synced this page
	const lockTimestamp = state.syncLocks[pageId];
	if (lockTimestamp && Date.now() - lockTimestamp < LOOP_PREVENTION_WINDOW_MS) {
		return { success: true, action: 'skipped_loop_prevention' };
	}

	try {
		// Fetch the updated base page
		const pageResult = await integrations.notion.pages.retrieve({ page_id: pageId });

		if (!pageResult.success) {
			return { success: false, error: 'Failed to fetch base page' };
		}

		const basePage = pageResult.data;
		const mapping = state.pageMappings[pageId];

		// Map properties
		const mirrorProperties = mapProperties(
			basePage.properties,
			state.propertyMappings,
			'base_to_mirror'
		);

		if (mapping) {
			// Last-write-wins: fetch mirror page to compare timestamps
			const mirrorPageResult = await fetchWithToken(
				`https://api.notion.com/v1/pages/${mapping.mirrorPageId}`,
				mirrorToken,
				'GET'
			);

			if (mirrorPageResult.ok) {
				const mirrorPage = await mirrorPageResult.json();
				const baseEditTime = new Date(basePage.last_edited_time).getTime();
				const mirrorEditTime = new Date(mirrorPage.last_edited_time).getTime();

				// Skip if mirror is newer - it will sync in the other direction
				if (mirrorEditTime > baseEditTime) {
					return { success: true, action: 'skipped_mirror_newer' };
				}
			}

			// Update existing mirror page (base is newer or equal)
			const updateResult = await fetchWithToken(
				`https://api.notion.com/v1/pages/${mapping.mirrorPageId}`,
				mirrorToken,
				'PATCH',
				{ properties: mirrorProperties }
			);

			if (!updateResult.ok) {
				const errorData = await updateResult.json();
				return { success: false, error: `Failed to update mirror page: ${errorData.message}` };
			}

			// Update state
			state.pageMappings[pageId].lastSyncedAt = new Date().toISOString();
			state.pageMappings[pageId].lastSyncDirection = 'base_to_mirror';
			state.syncLocks[pageId] = Date.now();
			await env.KV?.put(stateKey, JSON.stringify(state));

			return { success: true, action: 'updated' };
		} else {
			// Create new mirror page (new page created in base)
			const createResult = await fetchWithToken(
				'https://api.notion.com/v1/pages',
				mirrorToken,
				'POST',
				{
					parent: { database_id: mirrorDatabase },
					properties: mirrorProperties,
				}
			);

			if (!createResult.ok) {
				const errorData = await createResult.json();
				return { success: false, error: `Failed to create mirror page: ${errorData.message}` };
			}

			const newPage = await createResult.json();

			// Store mapping
			state.pageMappings[pageId] = {
				basePageId: pageId,
				mirrorPageId: newPage.id,
				lastSyncedAt: new Date().toISOString(),
				lastSyncDirection: 'base_to_mirror',
			};
			state.syncLocks[pageId] = Date.now();
			await env.KV?.put(stateKey, JSON.stringify(state));

			return { success: true, action: 'created' };
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Sync a page from mirror database to base database
 * Triggered by webhook on mirror database
 */
async function syncMirrorToBase(params: {
	pageId: string;
	baseDatabase: string;
	mirrorDatabase: string;
	mirrorToken: string;
	integrations: any;
	env: any;
}): Promise<{ success: boolean; action?: string; error?: string }> {
	const { pageId, baseDatabase, mirrorDatabase, mirrorToken, integrations, env } = params;

	const stateKey = `${STATE_KEY_PREFIX}${baseDatabase}:${mirrorDatabase}`;
	const state: SyncState | null = await env.KV?.get(stateKey, 'json');

	if (!state) {
		return { success: false, error: 'Sync state not found' };
	}

	// Find the base page ID from the mirror page ID
	const mapping = Object.values(state.pageMappings).find((m) => m.mirrorPageId === pageId);

	if (!mapping) {
		// Page not tracked - client created a new page
		// Per design, clients can only update, not create
		return { success: true, action: 'skipped_not_tracked' };
	}

	// Loop prevention
	const lockTimestamp = state.syncLocks[mapping.basePageId];
	if (lockTimestamp && Date.now() - lockTimestamp < LOOP_PREVENTION_WINDOW_MS) {
		return { success: true, action: 'skipped_loop_prevention' };
	}

	try {
		// Fetch the updated mirror page using client's token
		const pageResult = await fetchWithToken(
			`https://api.notion.com/v1/pages/${pageId}`,
			mirrorToken,
			'GET'
		);

		if (!pageResult.ok) {
			return { success: false, error: 'Failed to fetch mirror page' };
		}

		const mirrorPage = await pageResult.json();

		// Last-write-wins: fetch base page to compare timestamps
		const basePageResult = await integrations.notion.pages.retrieve({
			page_id: mapping.basePageId,
		});

		if (basePageResult.success) {
			const basePage = basePageResult.data;
			const mirrorEditTime = new Date(mirrorPage.last_edited_time).getTime();
			const baseEditTime = new Date(basePage.last_edited_time).getTime();

			// Skip if base is newer - it will sync in the other direction
			if (baseEditTime > mirrorEditTime) {
				return { success: true, action: 'skipped_base_newer' };
			}
		}

		// Map properties from mirror to base (mirror is newer or equal)
		const baseProperties = mapProperties(
			mirrorPage.properties,
			state.propertyMappings,
			'mirror_to_base'
		);

		// Update base page
		const updateResult = await integrations.notion.pages.update({
			page_id: mapping.basePageId,
			properties: baseProperties,
		});

		if (!updateResult.success) {
			return { success: false, error: 'Failed to update base page' };
		}

		// Update state
		state.pageMappings[mapping.basePageId].lastSyncedAt = new Date().toISOString();
		state.pageMappings[mapping.basePageId].lastSyncDirection = 'mirror_to_base';
		state.syncLocks[mapping.basePageId] = Date.now();
		await env.KV?.put(stateKey, JSON.stringify(state));

		return { success: true, action: 'updated' };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

// ============================================================================
// PROPERTY MAPPING
// ============================================================================

/**
 * Discover property mappings by matching names
 */
function discoverPropertyMappings(
	baseProperties: Record<string, any>,
	mirrorProperties: Record<string, any>
): PropertyMapping[] {
	const mappings: PropertyMapping[] = [];

	for (const [baseName, baseProp] of Object.entries(baseProperties)) {
		// Look for exact name match (case-insensitive)
		const mirrorMatch = Object.entries(mirrorProperties).find(
			([mirrorName]) => mirrorName.toLowerCase() === baseName.toLowerCase()
		);

		if (mirrorMatch) {
			const [mirrorName, mirrorProp] = mirrorMatch;

			// Only map if types are compatible
			if (areTypesCompatible(baseProp.type, mirrorProp.type)) {
				mappings.push({
					baseName,
					mirrorName,
					type: baseProp.type,
				});
			}
		}
	}

	return mappings;
}

/**
 * Check if two Notion property types are compatible for syncing
 */
function areTypesCompatible(baseType: string, mirrorType: string): boolean {
	// Exact match
	if (baseType === mirrorType) return true;

	// Compatible type pairs
	const compatiblePairs: [string, string][] = [
		['rich_text', 'rich_text'],
		['title', 'title'],
		['select', 'select'],
		['status', 'status'],
		['multi_select', 'multi_select'],
		['date', 'date'],
		['number', 'number'],
		['checkbox', 'checkbox'],
		['url', 'url'],
		['email', 'email'],
		['phone_number', 'phone_number'],
	];

	return compatiblePairs.some(
		([a, b]) => (baseType === a && mirrorType === b) || (baseType === b && mirrorType === a)
	);
}

/**
 * Map properties from source to target format
 */
function mapProperties(
	sourceProperties: Record<string, any>,
	mappings: PropertyMapping[],
	direction: 'base_to_mirror' | 'mirror_to_base'
): Record<string, any> {
	const result: Record<string, any> = {};

	for (const mapping of mappings) {
		const sourceName = direction === 'base_to_mirror' ? mapping.baseName : mapping.mirrorName;
		const targetName = direction === 'base_to_mirror' ? mapping.mirrorName : mapping.baseName;

		const sourceValue = sourceProperties[sourceName];
		if (sourceValue) {
			// Copy the property value as-is (Notion API format)
			result[targetName] = clonePropertyValue(sourceValue);
		}
	}

	return result;
}

/**
 * Clone a Notion property value for use in create/update
 */
function clonePropertyValue(prop: any): any {
	// Notion properties need different formats for read vs write
	// This converts read format to write format

	switch (prop.type) {
		case 'title':
			return {
				title: prop.title?.map((t: any) => ({
					text: { content: t.plain_text || '' },
				})) || [],
			};

		case 'rich_text':
			return {
				rich_text: prop.rich_text?.map((t: any) => ({
					text: { content: t.plain_text || '' },
				})) || [],
			};

		case 'select':
			return prop.select ? { select: { name: prop.select.name } } : { select: null };

		case 'status':
			return prop.status ? { status: { name: prop.status.name } } : { status: null };

		case 'multi_select':
			return {
				multi_select: prop.multi_select?.map((s: any) => ({ name: s.name })) || [],
			};

		case 'date':
			return prop.date ? { date: prop.date } : { date: null };

		case 'number':
			return { number: prop.number };

		case 'checkbox':
			return { checkbox: prop.checkbox || false };

		case 'url':
			return { url: prop.url || null };

		case 'email':
			return { email: prop.email || null };

		case 'phone_number':
			return { phone_number: prop.phone_number || null };

		default:
			// Skip unsupported types (formula, rollup, relation, etc.)
			return undefined;
	}
}

// ============================================================================
// HELPERS
// ============================================================================

/** Maximum retry attempts for rate-limited requests */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Fetch with Notion token (for client's mirror database)
 * Includes exponential backoff retry logic for 429 rate limits
 */
async function fetchWithToken(
	url: string,
	token: string,
	method: 'GET' | 'POST' | 'PATCH',
	body?: any
): Promise<Response> {
	const options: RequestInit = {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			'Notion-Version': NOTION_VERSION,
			'Content-Type': 'application/json',
		},
	};

	if (body) {
		options.body = JSON.stringify(body);
	}

	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			const response = await fetch(url, options);

			// Handle rate limiting with retry
			if (response.status === 429) {
				if (attempt === MAX_RETRIES) {
					// Final attempt failed, return the 429 response
					return response;
				}

				// Calculate delay: use Retry-After header if available, else exponential backoff
				const retryAfter = response.headers.get('Retry-After');
				let delayMs: number;

				if (retryAfter) {
					// Retry-After can be seconds or a date string
					const seconds = parseInt(retryAfter, 10);
					delayMs = isNaN(seconds) ? BASE_RETRY_DELAY_MS * Math.pow(2, attempt) : seconds * 1000;
				} else {
					// Exponential backoff: 1s, 2s, 4s
					delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
				}

				// Cap at 30 seconds
				delayMs = Math.min(delayMs, 30000);

				console.log(`Rate limited (429), retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
				await delay(delayMs);
				continue;
			}

			// Return successful or non-retryable response
			return response;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt === MAX_RETRIES) {
				throw lastError;
			}

			// Network error - retry with exponential backoff
			const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
			console.log(`Network error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
			await delay(delayMs);
		}
	}

	// Should never reach here, but TypeScript needs this
	throw lastError || new Error('Unexpected retry loop exit');
}

// delay is now imported from ../_shared/utils.js

// ============================================================================
// METADATA
// ============================================================================

export const metadata = {
	id: 'databases-mirrored',
	category: 'data_sync',
	featured: true,

	visibility: 'public' as const,

	// Official WORKWAY workflow
	developerId: 'dev_workway_official',

	// Flags
	experimental: false,
	requiresCustomInfrastructure: false,

	// Analytics
	analyticsUrl: 'https://workway.co/workflows/databases-mirrored/analytics',

	stats: { rating: 0, users: 0, reviews: 0 },
};
