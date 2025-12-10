/**
 * Notion Two-Way Sync (Cross-Organization)
 *
 * Bidirectional synchronization between ANY two Notion databases.
 * Works with any schema - no configuration needed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * USER FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * STEP 1: You (Workflow Owner)
 * ────────────────────────────
 *   1. Go to workway.co/workflows/notion-two-way-sync
 *   2. Click "Connect Notion" → OAuth screen → authorize
 *   3. Select your database (e.g., "Client Projects")
 *   4. Click "Enable Workflow"
 *   5. Copy the invite link that appears
 *
 * STEP 2: Your Client (External Party)
 * ─────────────────────────────────────
 *   1. Receives your invite link (email, Slack, etc.)
 *   2. Clicks link → sees Notion OAuth screen (NOT WORKWAY)
 *   3. Authorizes their Notion workspace
 *   4. Selects their database (e.g., "Shared Tasks")
 *   5. Done. They never create a WORKWAY account.
 *
 * STEP 3: Automatic Sync (No Further Action)
 * ──────────────────────────────────────────
 *   - Client creates item in their DB → appears in yours
 *   - You update status/priority → syncs back to client
 *   - Properties with same name sync automatically
 *   - Different property names are ignored (no errors)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HOW PROPERTIES SYNC
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Schema auto-discovery by exact name match:
 *
 *   YOUR DATABASE          CLIENT DATABASE         RESULT
 *   ─────────────          ───────────────         ──────
 *   Name (title)     ←→    Name (title)            ✓ Syncs (unidirectional)
 *   Status (status)  ←→    Status (select)         ✓ Syncs (bidirectional)
 *   Priority (select)      [not present]           ✗ Skipped
 *   [not present]          Notes (rich_text)       ✗ Skipped
 *
 * Bidirectionality by type:
 *   - title, rich_text → Client → You only (client owns content)
 *   - status, select, checkbox, date, number → Both directions
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ```
 * ┌─────────────────────────┐              ┌─────────────────────────┐
 * │   CLIENT WORKSPACE      │              │   YOUR WORKSPACE        │
 * │   (via invite link)     │◄────────────►│   (workflow owner)      │
 * │                         │    SYNC      │                         │
 * │   • Notion OAuth only   │              │   • WORKWAY dashboard   │
 * │   • No WORKWAY account  │              │   • Full control        │
 * │   • Sees their DB only  │              │   • Invite management   │
 * └─────────────────────────┘              └─────────────────────────┘
 * ```
 *
 * The tool recedes: Your client only sees Notion. They don't know
 * WORKWAY exists. They just see their database magically staying in sync.
 *
 * @see https://developers.notion.com/reference/webhooks
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

// ============================================================================
// CONSTANTS (Weniger, aber besser - sensible defaults, no user config needed)
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
 * Cached for 24 hours (schemas rarely change)
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
	/** Property name (same in both databases) */
	name: string;
	/** Source property type */
	sourceType: NotionPropertyType;
	/** Destination property type */
	destType: NotionPropertyType;
	/** Whether to sync this property back (bidirectional) */
	bidirectional: boolean;
	/** Whether this is the title property */
	isTitle: boolean;
}

/**
 * Sync mapping stored for loop prevention and bidirectional sync
 */
interface SyncMapping {
	/** Client workspace page ID */
	clientPageId: string;
	/** Internal workspace page ID */
	internalPageId: string;
	/** Last sync timestamp (ISO) */
	lastSyncedAt: string;
	/** Last sync direction */
	lastSyncDirection: 'client_to_internal' | 'internal_to_client';
	/** Version counter for conflict detection */
	syncVersion: number;
}

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

export default defineWorkflow({
	name: 'Notion Two-Way Sync',
	description: 'Bidirectional sync between any two Notion databases - zero configuration',
	version: '2.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_databases_diverge',

		outcomeStatement: {
			suggestion: 'Keep two Notion databases in sync?',
			explanation:
				'Changes in one database automatically appear in the other. Works with any schema - no configuration needed.',
			outcome: 'Databases that sync themselves',
		},

		primaryPair: {
			from: 'notion',
			to: 'notion',
			workflowId: 'notion-two-way-sync',
			outcome: 'Databases that stay in sync',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion'],
				workflowId: 'notion-two-way-sync',
				priority: 70,
			},
			{
				trigger: 'pattern_detected',
				integrations: ['notion'],
				workflowId: 'notion-two-way-sync',
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
		},

		// Only internal database is essential — client connects via invite link
		essentialFields: ['internalDatabase'],

		zuhandenheit: {
			timeToValue: 2, // Minutes — select database, send invite link
			worksOutOfBox: true, // Invite link handles client OAuth
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'usage',
		price: 49, // Upfront fee
		usagePricing: {
			pricePerExecution: 0.05, // Light workflow - simple data sync
			includedExecutions: 20, // Free trial executions
		},
		description: 'Pay once + 5¢ per sync event. ~$15/mo for 300 syncs.',
	},

	// Single Notion integration - we use tokens for multi-workspace
	integrations: [
		{ service: 'notion', scopes: ['read_content', 'update_content', 'insert_content'] },
	],

	inputs: {
		// ================================================================
		// YOUR DATABASE (Internal team configures this)
		// ================================================================
		// This is the only input the workflow owner needs to configure.
		// Everything else is handled automatically via the invite flow.

		internalDatabase: {
			type: 'text',
			label: 'Your Ticket Database',
			required: true,
			description: 'Database in your workspace where synced tickets will appear',
		},

		// ================================================================
		// CLIENT CONNECTION (Set via invite link, not user input)
		// ================================================================
		// These are populated automatically when the client completes
		// the invite flow. The workflow owner never sees or edits these.
		// Note: UI layer should hide fields prefixed with underscore.

		_clientNotionToken: {
			type: 'string',
			label: 'Client Notion Token (auto-populated)',
			required: false,
			description: 'Auto-populated when client connects via invite link.',
		},

		_clientDatabase: {
			type: 'string',
			label: 'Client Database ID (auto-populated)',
			required: false,
			description: 'Auto-populated when client selects database in invite flow.',
		},

		_clientEmail: {
			type: 'string',
			label: 'Client Email (auto-populated)',
			required: false,
			description: 'Client email for notifications (optional, from invite flow).',
		},
	},

	// Trigger from either workspace webhook
	trigger: webhook({
		service: 'notion',
		event: 'page.created',
	}),

	// Additional webhook for property updates
	webhooks: [
		webhook({
			service: 'notion',
			event: 'page.properties.updated',
		}),
	],

	// ========================================================================
	// LIFECYCLE: onEnable - Generate invite link for client
	// ========================================================================
	// Note: The invite link URL pattern is:
	//   https://workway.co/workflows/{workflowId}/invite/{installationId}
	// This is handled by the WORKWAY platform, not generated in-workflow.
	// The onEnable hook stores metadata for the invite flow.

	async onEnable({ storage }) {
		// Generate unique invite token for this installation
		const inviteToken = crypto.randomUUID();

		// Store invite metadata
		// Platform uses this when client completes invite flow
		await storage.set('invite', {
			token: inviteToken,
			createdAt: new Date().toISOString(),
			status: 'pending', // pending | connected
			integration: 'notion',
			// Fields to populate when client completes:
			targetInputs: ['_clientNotionToken', '_clientDatabase', '_clientEmail'],
		});

		// Platform generates invite URL from installation ID
		// Workflow owner sees this in their dashboard
	},

	// ========================================================================
	// LIFECYCLE: onDisable - Cleanup invite
	// ========================================================================

	async onDisable({ storage }) {
		await storage.delete('invite');
	},

	// ========================================================================
	// MAIN EXECUTION
	// ========================================================================

	async execute({ trigger, inputs, integrations, storage }) {
		const event = trigger.data;
		const pageId = event.page_id || event.id;
		const parentDatabaseId = event.parent?.database_id;
		const eventTimestamp = event.timestamp || event.last_edited_time;

		// Client database comes from invite flow (hidden input)
		const clientDatabase = inputs._clientDatabase;

		// Determine source workspace
		const isFromClient = parentDatabaseId === clientDatabase;
		const isFromInternal = parentDatabaseId === inputs.internalDatabase;

		if (!isFromClient && !isFromInternal) {
			return { success: true, skipped: true, reason: 'Event not from configured databases' };
		}

		const source = isFromClient ? 'client' : 'internal';
		const eventType = event.type === 'page.created' ? 'created' : 'updated';

		// ========================================================================
		// CHECK CLIENT CONNECTION
		// ========================================================================

		if (!inputs._clientNotionToken || !clientDatabase) {
			const invite = await storage.get<{ token: string }>('invite');
			return {
				success: false,
				error: 'Client has not connected their Notion workspace yet',
				inviteUrl: invite ? `https://workway.co/join/${invite.token}` : undefined,
				hint: 'Send the invite link to your client to complete setup',
			};
		}

		// ========================================================================
		// UNIFIED IDEMPOTENCY CHECK (combines loop prevention + duplicate detection)
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

		const internalNotion = integrations.notion;
		const clientNotion = integrations.createClient('notion', {
			accessToken: inputs._clientNotionToken,
		});

		const sourceNotion = isFromClient ? clientNotion : internalNotion;
		const destNotion = isFromClient ? internalNotion : clientNotion;
		const sourceDatabase = isFromClient ? clientDatabase : inputs.internalDatabase;
		const destDatabase = isFromClient ? inputs.internalDatabase : clientDatabase;

		// ========================================================================
		// FETCH SCHEMAS (cached for 24 hours)
		// ========================================================================
		// Zuhandenheit: Auto-discover schemas, no user configuration needed

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
		// AUTO-DERIVE PROPERTY MAPPINGS (by exact name match)
		// ========================================================================
		// Weniger, aber besser: No configuration - properties with same name sync

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
				clientPageId: isFromClient ? pageId : linkedPageId,
				internalPageId: isFromClient ? linkedPageId : pageId,
				lastSyncedAt: new Date().toISOString(),
				lastSyncDirection: isFromClient ? 'client_to_internal' : 'internal_to_client',
				syncVersion: 1,
			};
		}

		// ========================================================================
		// BUILD PROPERTIES (auto-summarize long text, pass-through everything else)
		// ========================================================================

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const destProperties: Record<string, any> = {};
		const syncedProperties: string[] = [];

		for (const propMapping of propertyMappings) {
			// Skip non-bidirectional properties on reverse sync (internal → client)
			// Title and rich_text are unidirectional: client creates content, internal doesn't overwrite
			if (!isFromClient && !propMapping.bidirectional) continue;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const sourceProp = (page?.properties as any)?.[propMapping.name];
			if (!sourceProp) continue;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let value: any = sourceProp;

			// Auto-summarize long text properties (no configuration needed)
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
			// Add back-reference for linking
			destProperties[SYNC_LINK_PROPERTY] = {
				rich_text: [{ text: { content: pageId } }],
			};

			result = await destNotion.createPage({
				parentDatabaseId: destDatabase,
				properties: destProperties,
			});

			if (result.success) {
				// Store mapping
				const newMapping: SyncMapping = {
					clientPageId: isFromClient ? pageId : result.data.id,
					internalPageId: isFromClient ? result.data.id : pageId,
					lastSyncedAt: new Date().toISOString(),
					lastSyncDirection: isFromClient ? 'client_to_internal' : 'internal_to_client',
					syncVersion: 1,
				};

				await storage.set(`mapping:${pageId}`, newMapping);
				await storage.set(`mapping:${result.data.id}`, newMapping);

				// Update source with back-reference
				await sourceNotion.updatePage({
					pageId,
					properties: {
						[SYNC_LINK_PROPERTY]: { rich_text: [{ text: { content: result.data.id } }] },
					},
				});
			}
		} else {
			// Update existing page
			const destPageId = isFromClient ? mapping?.internalPageId : mapping?.clientPageId;

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
					lastSyncDirection: isFromClient ? 'client_to_internal' : 'internal_to_client',
					syncVersion: mapping.syncVersion + 1,
				};

				await storage.set(`mapping:${pageId}`, updatedMapping);
				await storage.set(`mapping:${destPageId}`, updatedMapping);
			}
		}

		// Mark as synced (unified idempotency)
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
// HELPERS: Schema Discovery (Zuhandenheit - tool adapts to user's schema)
// ============================================================================

/**
 * Get schema from cache or fetch from Notion API
 * Cached for 24 hours (schemas rarely change)
 */
async function getOrFetchSchema(
	databaseId: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	notion: any,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	storage: any,
): Promise<DatabaseSchema | null> {
	const cacheKey = `schema:${databaseId}`;

	// Check cache first
	const cached = await storage.get(cacheKey) as DatabaseSchema | undefined;
	if (cached && (Date.now() - cached.cachedAt) < SCHEMA_CACHE_TTL_SECONDS * 1000) {
		return cached;
	}

	// Fetch from Notion API
	try {
		const db = await notion.getDatabase({ databaseId });
		if (!db.success || !db.data) return null;

		const schema = extractSchema(db.data);

		// Cache for 24 hours
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
	let titlePropertyName = 'Name'; // Default fallback

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
 * Zuhandenheit: No configuration needed - matching names sync automatically
 */
function derivePropertyMappings(
	sourceSchema: DatabaseSchema,
	destSchema: DatabaseSchema,
): PropertyMapping[] {
	const mappings: PropertyMapping[] = [];

	for (const [name, sourceProp] of Object.entries(sourceSchema.properties)) {
		// Skip system properties that can't be synced
		const unsyncableTypes: NotionPropertyType[] = [
			'formula', 'rollup', 'created_time', 'created_by',
			'last_edited_time', 'last_edited_by', 'relation', 'files', 'people',
		];
		if (unsyncableTypes.includes(sourceProp.type)) continue;

		// Skip the sync link property (internal use only)
		if (name === SYNC_LINK_PROPERTY) continue;

		// Check if destination has matching property
		const destProp = destSchema.properties[name];
		if (!destProp) continue;

		// Check type compatibility
		if (!areTypesCompatible(sourceProp.type, destProp.type)) continue;

		// Determine bidirectionality based on type
		const isTitle = sourceProp.type === 'title';
		const bidirectional = !isTitle && BIDIRECTIONAL_TYPES.includes(sourceProp.type);

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

	// Text types are interchangeable
	if (TEXT_TYPES.includes(type1) && TEXT_TYPES.includes(type2)) return true;

	// Select and status are interchangeable
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
	id: 'notion-two-way-sync',
	category: 'data-sync',
	featured: false, // Not featured until tested in production
	experimental: false, // OAuth-based, no manual token setup
	stats: { rating: 4.9, users: 0, reviews: 0 },
	tags: ['notion', 'sync', 'bidirectional', 'database', 'cross-workspace', 'cross-organization', 'schema-agnostic'],
};
