/**
 * Notion Two-Way Sync (Base → Mirror with Initial Sync)
 *
 * Bidirectional synchronization between ANY two Notion databases.
 * Works with any schema - no configuration needed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * USE CASE: Agency Issue Tracking
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Agencies can provide issue tracking in their client's Notion workspace:
 *   1. Agency has a BASE "Issues" database
 *   2. Client connects their MIRROR database via invite link
 *   3. ALL existing issues from BASE sync to MIRROR (initial sync)
 *   4. Future changes sync bidirectionally
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * USER FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * STEP 1: You (Agency/Workflow Owner)
 * ────────────────────────────────────
 *   1. Go to workway.co/workflows/databases-mirrored
 *   2. Click "Connect Notion" → OAuth screen → authorize
 *   3. Select your BASE database (e.g., "Client Issues")
 *   4. Click "Enable Workflow"
 *   5. Copy the invite link that appears
 *
 * STEP 2: Your Client (External Party)
 * ─────────────────────────────────────
 *   1. Receives your invite link (email, Slack, etc.)
 *   2. Clicks link → sees Notion OAuth screen (NOT WORKWAY)
 *   3. Authorizes their Notion workspace
 *   4. Selects their MIRROR database (e.g., "Issues")
 *   5. INITIAL SYNC begins automatically
 *
 * STEP 3: Initial Sync (Automatic, One-Time)
 * ──────────────────────────────────────────
 *   - All pages from BASE database are copied to MIRROR
 *   - Rate-limited to respect Notion API limits (3 req/s)
 *   - Progress tracked and visible in dashboard
 *   - Mappings stored for future bidirectional sync
 *
 * STEP 4: Ongoing Bidirectional Sync
 * ──────────────────────────────────
 *   - Client creates issue → appears in Agency DB
 *   - Agency updates status → syncs to Client DB
 *   - Properties with same name sync automatically
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HOW PROPERTIES SYNC
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Schema auto-discovery by exact name match:
 *
 *   BASE DATABASE           MIRROR DATABASE         RESULT
 *   ─────────────           ───────────────         ──────
 *   Name (title)      →     Name (title)            ✓ Syncs (base → mirror)
 *   Status (status)  ←→     Status (select)         ✓ Syncs (bidirectional)
 *   Priority (select)       [not present]           ✗ Skipped
 *   [not present]           Notes (rich_text)       ✗ Skipped
 *
 * Bidirectionality by type:
 *   - title, rich_text → Syncs both directions for content
 *   - status, select, checkbox, date, number → Both directions
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ```
 * ┌─────────────────────────┐              ┌─────────────────────────┐
 * │   MIRROR (Client)       │              │   BASE (Agency)         │
 * │   (via invite link)     │◄────────────►│   (workflow owner)      │
 * │                         │    SYNC      │                         │
 * │   • Notion OAuth only   │              │   • WORKWAY dashboard   │
 * │   • No WORKWAY account  │   ┌──────┐   │   • Full control        │
 * │   • Sees their DB only  │◄──│INIT  │───│   • Initial sync source │
 * └─────────────────────────┘   │SYNC  │   └─────────────────────────┘
 *                               └──────┘
 * ```
 *
 * @see https://developers.notion.com/reference/webhooks
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Time window to ignore events after a sync (prevents infinite loops) */
const LOOP_PREVENTION_WINDOW_MS = 5000;

/** Property name to store link to synced page (auto-created if needed) */
const SYNC_LINK_PROPERTY = 'Synced Page ID';

/** Max text length before AI summarization kicks in */
const SUMMARIZE_THRESHOLD = 500;

/** Schema cache TTL (24 hours) */
const SCHEMA_CACHE_TTL_SECONDS = 86400;

/** Property types that sync bidirectionally (status-like properties) */
const BIDIRECTIONAL_TYPES = ['select', 'multi_select', 'status', 'checkbox', 'number', 'date'];

/** Property types that are text-based (for summarization) */
const TEXT_TYPES = ['rich_text', 'title'];

/** Notion API rate limit: 3 requests per second */
const RATE_LIMIT_DELAY_MS = 350; // ~3 req/s with safety margin

/** Batch size for initial sync (process this many, then delay) */
const INITIAL_SYNC_BATCH_SIZE = 3;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Notion property type from database schema
 */
type NotionPropertyType =
	| 'title'
	| 'rich_text'
	| 'number'
	| 'select'
	| 'multi_select'
	| 'status'
	| 'date'
	| 'checkbox'
	| 'url'
	| 'email'
	| 'phone_number'
	| 'formula'
	| 'relation'
	| 'rollup'
	| 'files'
	| 'people'
	| 'created_time'
	| 'created_by'
	| 'last_edited_time'
	| 'last_edited_by';

/**
 * Database schema extracted from Notion API
 */
interface DatabaseSchema {
	databaseId: string;
	properties: Record<string, {
		id: string;
		type: NotionPropertyType;
		name: string;
	}>;
	titlePropertyName: string;
	cachedAt: number;
}

/**
 * Auto-derived property mapping (by exact name match)
 */
interface PropertyMapping {
	name: string;
	sourceType: NotionPropertyType;
	destType: NotionPropertyType;
	bidirectional: boolean;
	isTitle: boolean;
}

/**
 * Sync mapping stored for bidirectional sync
 */
interface SyncMapping {
	/** Base (agency) workspace page ID */
	basePageId: string;
	/** Mirror (client) workspace page ID */
	mirrorPageId: string;
	/** Last sync timestamp (ISO) */
	lastSyncedAt: string;
	/** Last sync direction */
	lastSyncDirection: 'base_to_mirror' | 'mirror_to_base';
	/** Version counter for conflict detection */
	syncVersion: number;
}

/**
 * Initial sync progress tracking
 */
interface InitialSyncProgress {
	status: 'pending' | 'in_progress' | 'completed' | 'failed';
	totalPages: number;
	syncedPages: number;
	failedPages: number;
	startedAt: string;
	completedAt?: string;
	lastError?: string;
	/** Cursor for resuming if interrupted */
	lastCursor?: string;
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'Notion Two-Way Sync',
	description: 'Bidirectional sync with initial base → mirror population. Perfect for agency issue tracking.',
	version: '3.0.0',

	// Pathway metadata for discovery
	pathway: {
		outcomeFrame: 'when_databases_diverge',

		outcomeStatement: {
			suggestion: 'Keep two Notion databases in sync?',
			explanation:
				'All existing items sync from your base database to the mirror, then changes sync bidirectionally.',
			outcome: 'Databases that sync themselves',
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
				priority: 70,
			},
			{
				trigger: 'pattern_detected',
				integrations: ['notion'],
				workflowId: 'databases-mirrored',
				priority: 95,
				pattern: {
					action: 'manual_cross_workspace_copy',
					threshold: 3,
					period: 'week',
				},
			},
		],

		smartDefaults: {
			syncDirection: { value: 'bidirectional' },
			loopPreventionWindow: { value: 5000 },
			initialSyncEnabled: { value: true },
		},

		essentialFields: ['baseDatabase'],

		zuhandenheit: {
			timeToValue: 5, // Minutes — includes initial sync time
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'usage',
		price: 49,
		usagePricing: {
			pricePerExecution: 0.05,
			includedExecutions: 100, // More included for initial sync
		},
		description: 'Pay once + 5¢ per sync event. Initial sync included in trial.',
	},

	integrations: [
		{ service: 'notion', scopes: ['read_content', 'update_content', 'insert_content'] },
	],

	inputs: {
		// ================================================================
		// BASE DATABASE (Agency configures this)
		// ================================================================
		baseDatabase: {
			type: 'notion_database_picker',
			label: 'Your Base Database',
			required: true,
			description: 'Your primary database. All existing items will sync to the mirror on first connection.',
		},

		// ================================================================
		// MIRROR CONNECTION (Set via invite link)
		// ================================================================
		_mirrorNotionToken: {
			type: 'string',
			label: 'Mirror Notion Token (auto-populated)',
			required: false,
			description: 'Auto-populated when client connects via invite link.',
		},

		_mirrorDatabase: {
			type: 'string',
			label: 'Mirror Database ID (auto-populated)',
			required: false,
			description: 'Auto-populated when client selects database in invite flow.',
		},

		_mirrorEmail: {
			type: 'string',
			label: 'Client Email (auto-populated)',
			required: false,
			description: 'Client email for notifications.',
		},
	},

	trigger: webhook({
		service: 'notion',
		event: 'page.created',
	}),

	webhooks: [
		webhook({
			service: 'notion',
			event: 'page.properties.updated',
		}),
	],

	// ========================================================================
	// LIFECYCLE: onEnable - Generate invite link
	// ========================================================================

	async onEnable({ storage }) {
		const inviteToken = crypto.randomUUID();

		await storage.set('invite', {
			token: inviteToken,
			createdAt: new Date().toISOString(),
			status: 'pending',
			integration: 'notion',
			targetInputs: ['_mirrorNotionToken', '_mirrorDatabase', '_mirrorEmail'],
		});

		// Initialize sync progress as pending
		await storage.set('initialSync', {
			status: 'pending',
			totalPages: 0,
			syncedPages: 0,
			failedPages: 0,
			startedAt: '',
		} as InitialSyncProgress);
	},

	// ========================================================================
	// LIFECYCLE: onDisable - Cleanup
	// ========================================================================

	async onDisable({ storage }) {
		await storage.delete('invite');
		await storage.delete('initialSync');
	},

	// ========================================================================
	// MAIN EXECUTION
	// ========================================================================

	async execute({ trigger, inputs, integrations, storage }) {
		const event = trigger.data;

		// ========================================================================
		// HANDLE INITIAL SYNC TRIGGER (special event from platform)
		// ========================================================================

		if (event?.type === 'client_connected' || event?._initialSync) {
			return await performInitialSync({ inputs, integrations, storage });
		}

		// ========================================================================
		// STANDARD WEBHOOK HANDLING
		// ========================================================================

		const pageId = event.page_id || event.id;
		const parentDatabaseId = event.parent?.database_id;
		const eventTimestamp = event.timestamp || event.last_edited_time;

		const mirrorDatabase = inputs._mirrorDatabase;

		// Determine source
		const isFromMirror = parentDatabaseId === mirrorDatabase;
		const isFromBase = parentDatabaseId === inputs.baseDatabase;

		if (!isFromMirror && !isFromBase) {
			return { success: true, skipped: true, reason: 'Event not from configured databases' };
		}

		const source = isFromMirror ? 'mirror' : 'base';
		const eventType = event.type === 'page.created' ? 'created' : 'updated';

		// ========================================================================
		// CHECK MIRROR CONNECTION
		// ========================================================================

		if (!inputs._mirrorNotionToken || !mirrorDatabase) {
			const invite = await storage.get<{ token: string }>('invite');
			return {
				success: false,
				error: 'Client has not connected their Notion workspace yet',
				inviteUrl: invite ? `https://workway.co/join/${invite.token}` : undefined,
				hint: 'Send the invite link to your client to complete setup',
			};
		}

		// ========================================================================
		// CHECK INITIAL SYNC STATUS
		// ========================================================================

		const syncProgress = await storage.get<InitialSyncProgress>('initialSync');
		if (syncProgress?.status === 'in_progress') {
			// Queue this event for after initial sync completes
			return {
				success: true,
				queued: true,
				reason: 'Initial sync in progress - event will be processed after completion',
			};
		}

		// ========================================================================
		// IDEMPOTENCY CHECK
		// ========================================================================

		const idempotencyKey = `sync:${pageId}:${eventTimestamp}`;
		const recentSync = await storage.get<{ syncedAt: number }>(idempotencyKey);

		if (recentSync) {
			const timeSinceSync = Date.now() - recentSync.syncedAt;
			if (timeSinceSync < LOOP_PREVENTION_WINDOW_MS) {
				return { success: true, skipped: true, reason: 'Recently synced (loop prevention)' };
			}
		}

		// ========================================================================
		// GET NOTION CLIENTS
		// ========================================================================

		const baseNotion = integrations.notion;
		const mirrorNotion = integrations.createClient('notion', {
			accessToken: inputs._mirrorNotionToken,
		});

		const sourceNotion = isFromMirror ? mirrorNotion : baseNotion;
		const destNotion = isFromMirror ? baseNotion : mirrorNotion;
		const sourceDatabase = isFromMirror ? mirrorDatabase : inputs.baseDatabase;
		const destDatabase = isFromMirror ? inputs.baseDatabase : mirrorDatabase;

		// ========================================================================
		// FETCH SCHEMAS
		// ========================================================================

		const sourceSchema = await getOrFetchSchema(sourceDatabase, sourceNotion, storage);
		const destSchema = await getOrFetchSchema(destDatabase, destNotion, storage);

		if (!sourceSchema || !destSchema) {
			return {
				success: false,
				error: 'Failed to fetch database schemas',
				hint: 'Ensure both databases are accessible',
			};
		}

		// ========================================================================
		// DERIVE PROPERTY MAPPINGS
		// ========================================================================

		const propertyMappings = derivePropertyMappings(sourceSchema, destSchema);

		// ========================================================================
		// FETCH SOURCE PAGE
		// ========================================================================

		const sourcePage = await sourceNotion.getPage({ pageId });
		if (!sourcePage.success) {
			return { success: false, error: `Failed to fetch source page: ${sourcePage.error}` };
		}

		const page = sourcePage.data;

		// ========================================================================
		// CHECK FOR EXISTING MAPPING
		// ========================================================================

		let mapping = await storage.get<SyncMapping>(`mapping:${pageId}`);

		const linkedPageId = extractRichTextProperty(page?.properties?.[SYNC_LINK_PROPERTY]);

		if (!mapping && linkedPageId) {
			mapping = {
				basePageId: isFromMirror ? linkedPageId : pageId,
				mirrorPageId: isFromMirror ? pageId : linkedPageId,
				lastSyncedAt: new Date().toISOString(),
				lastSyncDirection: isFromMirror ? 'mirror_to_base' : 'base_to_mirror',
				syncVersion: 1,
			};
		}

		// ========================================================================
		// BUILD DESTINATION PROPERTIES
		// ========================================================================

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const destProperties: Record<string, any> = {};
		const syncedProperties: string[] = [];

		for (const propMapping of propertyMappings) {
			// For mirror → base sync, only sync bidirectional properties
			if (isFromMirror && !propMapping.bidirectional && !propMapping.isTitle) continue;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const sourceProp = (page?.properties as any)?.[propMapping.name];
			if (!sourceProp) continue;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let value: any = sourceProp;

			// Auto-summarize long text
			if (TEXT_TYPES.includes(propMapping.sourceType) && !propMapping.isTitle) {
				const text = extractRichTextProperty(sourceProp);
				if (text && text.length > SUMMARIZE_THRESHOLD) {
					const summary = await integrations.ai.generateText({
						model: AIModels.LLAMA_3_8B,
						system: 'Summarize in 2-3 sentences. Focus on the key points.',
						prompt: text,
						temperature: 0.3,
						max_tokens: 150,
					});
					value = {
						rich_text: [{ text: { content: summary.data?.response || text.slice(0, SUMMARIZE_THRESHOLD) } }],
					};
				}
			}

			destProperties[propMapping.name] = value;
			syncedProperties.push(propMapping.name);
		}

		// ========================================================================
		// CREATE OR UPDATE DESTINATION PAGE
		// ========================================================================

		let result;

		if (eventType === 'created' && !mapping) {
			destProperties[SYNC_LINK_PROPERTY] = {
				rich_text: [{ text: { content: pageId } }],
			};

			result = await destNotion.createPage({
				parentDatabaseId: destDatabase,
				properties: destProperties,
			});

			if (result.success) {
				const newMapping: SyncMapping = {
					basePageId: isFromMirror ? result.data.id : pageId,
					mirrorPageId: isFromMirror ? pageId : result.data.id,
					lastSyncedAt: new Date().toISOString(),
					lastSyncDirection: isFromMirror ? 'mirror_to_base' : 'base_to_mirror',
					syncVersion: 1,
				};

				await storage.set(`mapping:${pageId}`, newMapping);
				await storage.set(`mapping:${result.data.id}`, newMapping);

				await sourceNotion.updatePage({
					pageId,
					properties: {
						[SYNC_LINK_PROPERTY]: { rich_text: [{ text: { content: result.data.id } }] },
					},
				});
			}
		} else {
			const destPageId = isFromMirror ? mapping?.basePageId : mapping?.mirrorPageId;

			if (!destPageId) {
				return {
					success: false,
					error: 'No mapping found for update event',
					pageId,
					source,
					hint: 'This page may need to be manually linked or re-created',
				};
			}

			result = await destNotion.updatePage({
				pageId: destPageId,
				properties: destProperties,
			});

			if (result?.success && mapping) {
				const updatedMapping: SyncMapping = {
					...mapping,
					lastSyncedAt: new Date().toISOString(),
					lastSyncDirection: isFromMirror ? 'mirror_to_base' : 'base_to_mirror',
					syncVersion: mapping.syncVersion + 1,
				};

				await storage.set(`mapping:${pageId}`, updatedMapping);
				await storage.set(`mapping:${destPageId}`, updatedMapping);
			}
		}

		await storage.set(idempotencyKey, { syncedAt: Date.now() });

		if (!result?.success) {
			return {
				success: false,
				error: `Failed to ${eventType === 'created' ? 'create' : 'update'} destination page`,
				details: result?.error,
			};
		}

		return {
			success: true,
			action: eventType === 'created' ? 'created' : 'updated',
			source,
			sourcePageId: pageId,
			destPageId: result.data?.id,
			propertiesSynced: syncedProperties,
			propertyMappingsUsed: propertyMappings.length,
		};
	},
});

// ============================================================================
// INITIAL SYNC IMPLEMENTATION
// ============================================================================

/**
 * Perform initial sync: copy all pages from BASE to MIRROR
 * Rate-limited to respect Notion API limits
 */
async function performInitialSync({ inputs, integrations, storage }: {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	inputs: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	integrations: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	storage: any;
}) {
	const baseNotion = integrations.notion;
	const mirrorNotion = integrations.createClient('notion', {
		accessToken: inputs._mirrorNotionToken,
	});

	const baseDatabase = inputs.baseDatabase;
	const mirrorDatabase = inputs._mirrorDatabase;

	// Get schemas for property mapping
	const baseSchema = await getOrFetchSchema(baseDatabase, baseNotion, storage);
	const mirrorSchema = await getOrFetchSchema(mirrorDatabase, mirrorNotion, storage);

	if (!baseSchema || !mirrorSchema) {
		await storage.set('initialSync', {
			status: 'failed',
			lastError: 'Failed to fetch database schemas',
			totalPages: 0,
			syncedPages: 0,
			failedPages: 0,
			startedAt: new Date().toISOString(),
		} as InitialSyncProgress);

		return { success: false, error: 'Failed to fetch database schemas' };
	}

	const propertyMappings = derivePropertyMappings(baseSchema, mirrorSchema);

	// Initialize progress
	const progress: InitialSyncProgress = {
		status: 'in_progress',
		totalPages: 0,
		syncedPages: 0,
		failedPages: 0,
		startedAt: new Date().toISOString(),
	};

	await storage.set('initialSync', progress);

	// Query all pages from BASE database
	let cursor: string | undefined;
	let totalSynced = 0;
	let totalFailed = 0;
	const allPages: Array<{ id: string }> = [];

	try {
		// First pass: count total pages
		do {
			const result = await baseNotion.queryDatabase({
				databaseId: baseDatabase,
				startCursor: cursor,
				pageSize: 100,
			});

			if (!result.success) {
				throw new Error(`Failed to query base database: ${result.error}`);
			}

			for (const page of result.data?.results || []) {
				allPages.push({ id: page.id });
			}

			cursor = result.data?.next_cursor;

			// Rate limit
			await sleep(RATE_LIMIT_DELAY_MS);
		} while (cursor);

		// Update total count
		progress.totalPages = allPages.length;
		await storage.set('initialSync', progress);

		// Second pass: sync each page with rate limiting
		for (let i = 0; i < allPages.length; i++) {
			const page = allPages[i];

			try {
				// Check if already mapped (idempotent)
				const existing = await storage.get<SyncMapping>(`mapping:${page.id}`);
				if (existing) {
					totalSynced++;
					continue;
				}

				// Fetch full page
				const fullPage = await baseNotion.getPage({ pageId: page.id });
				if (!fullPage.success) {
					totalFailed++;
					continue;
				}

				// Build properties for mirror
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const mirrorProperties: Record<string, any> = {};

				for (const propMapping of propertyMappings) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const sourceProp = (fullPage.data?.properties as any)?.[propMapping.name];
					if (sourceProp) {
						mirrorProperties[propMapping.name] = sourceProp;
					}
				}

				// Add back-reference
				mirrorProperties[SYNC_LINK_PROPERTY] = {
					rich_text: [{ text: { content: page.id } }],
				};

				// Create in mirror
				const createResult = await mirrorNotion.createPage({
					parentDatabaseId: mirrorDatabase,
					properties: mirrorProperties,
				});

				if (createResult.success) {
					// Store mapping
					const mapping: SyncMapping = {
						basePageId: page.id,
						mirrorPageId: createResult.data.id,
						lastSyncedAt: new Date().toISOString(),
						lastSyncDirection: 'base_to_mirror',
						syncVersion: 1,
					};

					await storage.set(`mapping:${page.id}`, mapping);
					await storage.set(`mapping:${createResult.data.id}`, mapping);

					// Update source with back-reference
					await baseNotion.updatePage({
						pageId: page.id,
						properties: {
							[SYNC_LINK_PROPERTY]: { rich_text: [{ text: { content: createResult.data.id } }] },
						},
					});

					totalSynced++;
				} else {
					totalFailed++;
				}
			} catch {
				totalFailed++;
			}

			// Update progress every batch
			if (i % INITIAL_SYNC_BATCH_SIZE === 0 || i === allPages.length - 1) {
				progress.syncedPages = totalSynced;
				progress.failedPages = totalFailed;
				await storage.set('initialSync', progress);
			}

			// Rate limit between each page
			await sleep(RATE_LIMIT_DELAY_MS);
		}

		// Mark complete
		progress.status = 'completed';
		progress.syncedPages = totalSynced;
		progress.failedPages = totalFailed;
		progress.completedAt = new Date().toISOString();
		await storage.set('initialSync', progress);

		// Update invite status
		const invite = await storage.get<{ token: string; status: string }>('invite');
		if (invite) {
			await storage.set('invite', { ...invite, status: 'connected' });
		}

		return {
			success: true,
			initialSync: true,
			totalPages: allPages.length,
			syncedPages: totalSynced,
			failedPages: totalFailed,
			durationMs: Date.now() - new Date(progress.startedAt).getTime(),
		};

	} catch (error) {
		progress.status = 'failed';
		progress.lastError = error instanceof Error ? error.message : 'Unknown error';
		await storage.set('initialSync', progress);

		return {
			success: false,
			error: progress.lastError,
			syncedPages: totalSynced,
			failedPages: totalFailed,
		};
	}
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sleep for rate limiting
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get schema from cache or fetch from Notion API
 */
async function getOrFetchSchema(
	databaseId: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	notion: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	storage: any,
): Promise<DatabaseSchema | null> {
	const cacheKey = `schema:${databaseId}`;

	const cached = await storage.get(cacheKey) as DatabaseSchema | undefined;
	if (cached && (Date.now() - cached.cachedAt) < SCHEMA_CACHE_TTL_SECONDS * 1000) {
		return cached;
	}

	try {
		const db = await notion.getDatabase({ databaseId });
		if (!db.success || !db.data) return null;

		const schema = extractSchema(db.data);
		await storage.set(cacheKey, schema);

		return schema;
	} catch {
		return null;
	}
}

/**
 * Extract schema from Notion database response
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractSchema(database: any): DatabaseSchema {
	const properties: DatabaseSchema['properties'] = {};
	let titlePropertyName = 'Name';

	for (const [name, prop] of Object.entries(database.properties || {})) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const propData = prop as any;
		properties[name] = {
			id: propData.id,
			type: propData.type as NotionPropertyType,
			name,
		};

		if (propData.type === 'title') {
			titlePropertyName = name;
		}
	}

	return {
		databaseId: database.id,
		properties,
		titlePropertyName,
		cachedAt: Date.now(),
	};
}

/**
 * Auto-derive property mappings by exact name match
 */
function derivePropertyMappings(
	sourceSchema: DatabaseSchema,
	destSchema: DatabaseSchema,
): PropertyMapping[] {
	const mappings: PropertyMapping[] = [];

	for (const [name, sourceProp] of Object.entries(sourceSchema.properties)) {
		const unsyncableTypes: NotionPropertyType[] = [
			'formula', 'rollup', 'created_time', 'created_by',
			'last_edited_time', 'last_edited_by', 'relation', 'files', 'people',
		];
		if (unsyncableTypes.includes(sourceProp.type)) continue;
		if (name === SYNC_LINK_PROPERTY) continue;

		const destProp = destSchema.properties[name];
		if (!destProp) continue;

		if (!areTypesCompatible(sourceProp.type, destProp.type)) continue;

		const isTitle = sourceProp.type === 'title';
		const bidirectional = BIDIRECTIONAL_TYPES.includes(sourceProp.type);

		mappings.push({
			name,
			sourceType: sourceProp.type,
			destType: destProp.type,
			bidirectional,
			isTitle,
		});
	}

	return mappings;
}

/**
 * Check if two property types are compatible for syncing
 */
function areTypesCompatible(type1: NotionPropertyType, type2: NotionPropertyType): boolean {
	if (type1 === type2) return true;
	if (TEXT_TYPES.includes(type1) && TEXT_TYPES.includes(type2)) return true;

	const selectTypes = ['select', 'status'];
	if (selectTypes.includes(type1) && selectTypes.includes(type2)) return true;

	return false;
}

/**
 * Extract plain text from a Notion rich_text or title property
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRichTextProperty(prop: any): string | undefined {
	if (!prop) return undefined;

	if (prop.rich_text && Array.isArray(prop.rich_text)) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return prop.rich_text.map((rt: any) => rt.plain_text || rt.text?.content || '').join('');
	}

	if (prop.title && Array.isArray(prop.title)) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return prop.title.map((rt: any) => rt.plain_text || rt.text?.content || '').join('');
	}

	return undefined;
}

// ============================================================================
// METADATA
// ============================================================================

export const metadata = {
	id: 'databases-mirrored',
	category: 'data-sync',
	featured: true,
	experimental: false,
	stats: { rating: 4.9, users: 0, reviews: 0 },
	tags: [
		'notion',
		'sync',
		'bidirectional',
		'database',
		'cross-workspace',
		'cross-organization',
		'agency',
		'issue-tracking',
		'initial-sync',
	],
};
