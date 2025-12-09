/**
 * Notion Two-Way Sync Workflow Tests
 *
 * Tests the bidirectional synchronization workflow between Notion workspaces.
 * Uses OAuth-based credential resolution via WORKWAY's public Notion app.
 *
 * Validates:
 * - Schema-based auto-discovery (no hardcoded property mappings)
 * - Page creation syncs client → internal
 * - Property updates sync bidirectionally (for select/status/checkbox types)
 * - Unified idempotency (loop prevention + duplicate detection)
 * - Auto-summarization for long text properties
 * - Invitation-based client connection
 *
 * Zuhandenheit: Properties with same name in both databases sync automatically.
 * The tool recedes: Tests verify outcomes, not implementation details.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// ============================================================================
// MOCK STORAGE (in-memory key-value store)
// ============================================================================

function createMockStorage() {
	const store = new Map<string, unknown>();

	return {
		get: vi.fn(async <T>(key: string): Promise<T | undefined> => {
			return store.get(key) as T | undefined;
		}),
		set: vi.fn(async (key: string, value: unknown): Promise<void> => {
			store.set(key, value);
		}),
		delete: vi.fn(async (key: string): Promise<void> => {
			store.delete(key);
		}),
		// Test helpers
		_store: store,
		_clear: () => store.clear(),
	};
}

// ============================================================================
// MOCK DATABASE SCHEMAS (simulates Notion database structure)
// ============================================================================

/** Standard schema for testing - both databases have matching properties */
const MOCK_DATABASE_SCHEMA = {
	properties: {
		Name: { id: 'title', type: 'title', name: 'Name' },
		Description: { id: 'desc', type: 'rich_text', name: 'Description' },
		Status: { id: 'status', type: 'status', name: 'Status' },
		Priority: { id: 'priority', type: 'select', name: 'Priority' },
		Done: { id: 'done', type: 'checkbox', name: 'Done' },
		'Synced Page ID': { id: 'sync', type: 'rich_text', name: 'Synced Page ID' },
	},
};

/** Schema with different properties (for testing partial sync) */
const PARTIAL_MATCH_SCHEMA = {
	properties: {
		Name: { id: 'title', type: 'title', name: 'Name' },
		Status: { id: 'status', type: 'status', name: 'Status' },
		// Missing: Description, Priority, Done
		Notes: { id: 'notes', type: 'rich_text', name: 'Notes' }, // Different name
	},
};

// ============================================================================
// MOCK NOTION CLIENT
// ============================================================================

function createMockNotionClient(overrides: Partial<MockNotionMethods> = {}, schemaOverride?: typeof MOCK_DATABASE_SCHEMA) {
	return {
		getPage: vi.fn().mockResolvedValue({
			success: true,
			data: {
				id: 'source-page-123',
				properties: {
					Name: { title: [{ text: { content: 'Test Item' } }] },
					Description: { rich_text: [{ text: { content: 'Short description' } }] },
					Status: { status: { name: 'New' } },
					Priority: { select: { name: 'High' } },
				},
			},
		}),
		getDatabase: vi.fn().mockResolvedValue({
			success: true,
			data: {
				id: 'mock-db-id',
				properties: (schemaOverride || MOCK_DATABASE_SCHEMA).properties,
			},
		}),
		createPage: vi.fn().mockResolvedValue({
			success: true,
			data: { id: 'dest-page-456' },
		}),
		updatePage: vi.fn().mockResolvedValue({
			success: true,
			data: { id: 'dest-page-456' },
		}),
		...overrides,
	};
}

interface MockNotionMethods {
	getPage: Mock;
	getDatabase: Mock;
	createPage: Mock;
	updatePage: Mock;
}

// ============================================================================
// MOCK AI INTEGRATION
// ============================================================================

function createMockAI() {
	return {
		generateText: vi.fn().mockResolvedValue({
			success: true,
			data: { response: 'Summarized: User reports login issue with error code 500.' },
		}),
	};
}

// ============================================================================
// MOCK INTEGRATIONS (with createClient for invite-based pattern)
// ============================================================================

function createMockIntegrations(overrides: {
	notion?: ReturnType<typeof createMockNotionClient>;
	clientNotion?: ReturnType<typeof createMockNotionClient>;
} = {}) {
	const clientNotion = overrides.clientNotion ?? createMockNotionClient();

	return {
		notion: overrides.notion ?? createMockNotionClient(),
		createClient: vi.fn().mockReturnValue(clientNotion),
		ai: createMockAI(),
	};
}

// ============================================================================
// TEST INPUTS (Invitation-based pattern)
// ============================================================================

const DEFAULT_INPUTS = {
	// Internal team's configuration
	internalDatabase: 'internal-db-uuid',

	// Hidden inputs populated via invite flow (simulated as already connected)
	_clientNotionToken: 'secret_client_token_from_invite',
	_clientDatabase: 'client-db-uuid',
	_clientEmail: 'client@example.com',
};

// Inputs for testing "client not connected" scenarios
const INPUTS_CLIENT_NOT_CONNECTED = {
	internalDatabase: 'internal-db-uuid',
	// No _client* fields — client hasn't completed invite flow
};

// ============================================================================
// WEBHOOK EVENT FACTORIES
// ============================================================================

function createPageCreatedEvent(
	pageId: string,
	databaseId: string,
	timestamp?: string
) {
	return {
		type: 'page.created',
		page_id: pageId,
		id: pageId,
		parent: { database_id: databaseId },
		timestamp: timestamp || new Date().toISOString(),
	};
}

function createPageUpdatedEvent(
	pageId: string,
	databaseId: string,
	timestamp?: string
) {
	return {
		type: 'page.properties.updated',
		page_id: pageId,
		id: pageId,
		parent: { database_id: databaseId },
		timestamp: timestamp || new Date().toISOString(),
		last_edited_time: timestamp || new Date().toISOString(),
	};
}

// ============================================================================
// WORKFLOW EXECUTOR (simulates SDK runtime with schema discovery)
// ============================================================================

// Constants matching the workflow
const LOOP_PREVENTION_WINDOW_MS = 5000;
const SUMMARIZE_THRESHOLD = 500;
const SYNC_LINK_PROPERTY = 'Synced Page ID';
const BIDIRECTIONAL_TYPES = ['select', 'multi_select', 'status', 'checkbox', 'number', 'date'];
const TEXT_TYPES = ['rich_text', 'title'];

/**
 * Simplified workflow executor for testing.
 * In production, this is handled by the WORKWAY SDK runtime.
 *
 * Zuhandenheit:
 * - Schema auto-discovery: properties with same name sync automatically
 * - No configuration needed - tool adapts to user's database structure
 */
async function executeWorkflow(params: {
	trigger: { data: unknown };
	inputs: typeof DEFAULT_INPUTS | typeof INPUTS_CLIENT_NOT_CONNECTED;
	storage: ReturnType<typeof createMockStorage>;
	clientNotion: ReturnType<typeof createMockNotionClient>;
	internalNotion: ReturnType<typeof createMockNotionClient>;
	ai: ReturnType<typeof createMockAI>;
}) {
	const { trigger, inputs, storage, clientNotion, internalNotion, ai } = params;
	const event = trigger.data as {
		type: string;
		page_id?: string;
		id?: string;
		parent?: { database_id?: string };
		timestamp?: string;
		last_edited_time?: string;
	};

	const pageId = event.page_id || event.id;
	const parentDatabaseId = event.parent?.database_id;
	const eventTimestamp = event.timestamp || event.last_edited_time;

	// Client database from invite flow (hidden input)
	const clientDatabase = (inputs as typeof DEFAULT_INPUTS)._clientDatabase;
	const clientToken = (inputs as typeof DEFAULT_INPUTS)._clientNotionToken;

	// Check if client has connected via invite flow
	if (!clientToken || !clientDatabase) {
		const invite = await storage.get<{ token: string }>('invite');
		return {
			success: false,
			error: 'Client has not connected their Notion workspace yet',
			inviteUrl: invite ? `https://workway.co/join/${invite.token}` : undefined,
			hint: 'Send the invite link to your client to complete setup',
		};
	}

	// Determine source workspace
	const isFromClient = parentDatabaseId === clientDatabase;
	const isFromInternal = parentDatabaseId === inputs.internalDatabase;

	if (!isFromClient && !isFromInternal) {
		return {
			success: true,
			skipped: true,
			reason: 'Event not from configured databases',
		};
	}

	const source = isFromClient ? 'client' : 'internal';
	const eventType = event.type === 'page.created' ? 'created' : 'updated';

	// Unified idempotency check (combines loop prevention + duplicate detection)
	const idempotencyKey = `sync:${pageId}:${eventTimestamp}`;
	const recentSync = await storage.get<{ syncedAt: number }>(idempotencyKey);

	if (recentSync) {
		const timeSinceSync = Date.now() - recentSync.syncedAt;
		if (timeSinceSync < LOOP_PREVENTION_WINDOW_MS) {
			return {
				success: true,
				skipped: true,
				reason: 'Recently synced (loop prevention)',
			};
		}
	}

	// Get clients
	const sourceNotion = isFromClient ? clientNotion : internalNotion;
	const destNotion = isFromClient ? internalNotion : clientNotion;
	const sourceDatabase = isFromClient ? clientDatabase : inputs.internalDatabase;
	const destDatabase = isFromClient ? inputs.internalDatabase : clientDatabase;

	// Fetch schemas (auto-discover properties)
	const sourceSchemaRes = await sourceNotion.getDatabase({ databaseId: sourceDatabase });
	const destSchemaRes = await destNotion.getDatabase({ databaseId: destDatabase });

	if (!sourceSchemaRes.success || !destSchemaRes.success) {
		return { success: false, error: 'Failed to fetch database schemas' };
	}

	// Auto-derive property mappings by exact name match
	const propertyMappings = derivePropertyMappings(
		sourceSchemaRes.data.properties,
		destSchemaRes.data.properties
	);

	// Fetch source page
	const sourcePage = await sourceNotion.getPage({ pageId });
	if (!sourcePage.success) {
		return {
			success: false,
			error: `Failed to fetch source page: ${sourcePage.error}`,
		};
	}

	const page = sourcePage.data;

	// Check for existing mapping
	let mapping = await storage.get<{
		clientPageId: string;
		internalPageId: string;
		lastSyncedAt: string;
		lastSyncDirection: string;
		syncVersion: number;
	}>(`mapping:${pageId}`);

	// Build destination properties based on auto-derived mappings
	const destProperties: Record<string, unknown> = {};
	const syncedProperties: string[] = [];

	for (const propMapping of propertyMappings) {
		// Skip non-bidirectional properties on reverse sync (internal → client)
		if (!isFromClient && !propMapping.bidirectional) continue;

		const sourceProp = page?.properties?.[propMapping.name];
		if (!sourceProp) continue;

		let value: unknown = sourceProp;

		// Auto-summarize long text properties (no config needed)
		if (TEXT_TYPES.includes(propMapping.sourceType) && !propMapping.isTitle) {
			const text = extractRichText(sourceProp);
			if (text && text.length > SUMMARIZE_THRESHOLD) {
				const summary = await ai.generateText({
					prompt: text,
				});
				value = {
					rich_text: [
						{ text: { content: summary.data?.response || text.slice(0, SUMMARIZE_THRESHOLD) } },
					],
				};
			}
		}

		destProperties[propMapping.name] = value;
		syncedProperties.push(propMapping.name);
	}

	// Create or update destination
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
			const newMapping = {
				clientPageId: isFromClient ? pageId : result.data.id,
				internalPageId: isFromClient ? result.data.id : pageId,
				lastSyncedAt: new Date().toISOString(),
				lastSyncDirection: isFromClient
					? 'client_to_internal'
					: 'internal_to_client',
				syncVersion: 1,
			};

			await storage.set(`mapping:${pageId}`, newMapping);
			await storage.set(`mapping:${result.data.id}`, newMapping);

			// Update source with back-reference
			await sourceNotion.updatePage({
				pageId,
				properties: {
					[SYNC_LINK_PROPERTY]: {
						rich_text: [{ text: { content: result.data.id } }],
					},
				},
			});
		}
	} else {
		const destPageId = isFromClient
			? mapping?.internalPageId
			: mapping?.clientPageId;

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
			const updatedMapping = {
				...mapping,
				lastSyncedAt: new Date().toISOString(),
				lastSyncDirection: isFromClient
					? 'client_to_internal'
					: 'internal_to_client',
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
}

/**
 * Auto-derive property mappings by exact name match
 * This mirrors the workflow's derivePropertyMappings function
 */
function derivePropertyMappings(
	sourceProps: Record<string, { type: string; name: string }>,
	destProps: Record<string, { type: string; name: string }>
): Array<{
	name: string;
	sourceType: string;
	destType: string;
	bidirectional: boolean;
	isTitle: boolean;
}> {
	const mappings: Array<{
		name: string;
		sourceType: string;
		destType: string;
		bidirectional: boolean;
		isTitle: boolean;
	}> = [];

	const unsyncableTypes = [
		'formula', 'rollup', 'created_time', 'created_by',
		'last_edited_time', 'last_edited_by', 'relation', 'files', 'people',
	];

	for (const [name, sourceProp] of Object.entries(sourceProps)) {
		if (unsyncableTypes.includes(sourceProp.type)) continue;
		if (name === SYNC_LINK_PROPERTY) continue;

		const destProp = destProps[name];
		if (!destProp) continue;

		// Type compatibility check
		if (!areTypesCompatible(sourceProp.type, destProp.type)) continue;

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

function areTypesCompatible(type1: string, type2: string): boolean {
	if (type1 === type2) return true;
	if (TEXT_TYPES.includes(type1) && TEXT_TYPES.includes(type2)) return true;
	const selectTypes = ['select', 'status'];
	if (selectTypes.includes(type1) && selectTypes.includes(type2)) return true;
	return false;
}

function extractRichText(prop: unknown): string | undefined {
	if (!prop) return undefined;
	const p = prop as {
		rich_text?: Array<{ plain_text?: string; text?: { content?: string } }>;
		title?: Array<{ plain_text?: string; text?: { content?: string } }>;
	};

	if (p.rich_text && Array.isArray(p.rich_text)) {
		return p.rich_text.map((rt) => rt.plain_text || rt.text?.content || '').join('');
	}

	if (p.title && Array.isArray(p.title)) {
		return p.title.map((rt) => rt.plain_text || rt.text?.content || '').join('');
	}

	return undefined;
}

// ============================================================================
// TESTS: PAGE CREATION (Client → Internal)
// ============================================================================

describe('Notion Two-Way Sync: Page Creation', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let clientNotion: ReturnType<typeof createMockNotionClient>;
	let internalNotion: ReturnType<typeof createMockNotionClient>;
	let ai: ReturnType<typeof createMockAI>;

	beforeEach(() => {
		storage = createMockStorage();
		clientNotion = createMockNotionClient();
		internalNotion = createMockNotionClient();
		ai = createMockAI();
	});

	it('should create page in internal workspace when client creates ticket', async () => {
		const trigger = {
			data: createPageCreatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase),
		};

		const result = await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(true);
		expect(result.action).toBe('created');
		expect(result.source).toBe('client');
		expect(internalNotion.createPage).toHaveBeenCalled();
	});

	it('should store mapping after creation', async () => {
		const trigger = {
			data: createPageCreatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase),
		};

		await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		const mapping = await storage.get('mapping:client-page-123');
		expect(mapping).toBeDefined();
		expect((mapping as { clientPageId: string }).clientPageId).toBe('client-page-123');
		expect((mapping as { internalPageId: string }).internalPageId).toBe('dest-page-456');
	});

	it('should add back-reference to source page', async () => {
		const trigger = {
			data: createPageCreatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase),
		};

		await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		// Sync link property used for back-reference
		expect(clientNotion.updatePage).toHaveBeenCalledWith(
			expect.objectContaining({
				pageId: 'client-page-123',
				properties: expect.objectContaining({
					'Synced Page ID': expect.any(Object),
				}),
			})
		);
	});

	it('should pass through status values unchanged', async () => {
		clientNotion.getPage.mockResolvedValue({
			success: true,
			data: {
				id: 'client-page-123',
				properties: {
					Title: { title: [{ text: { content: 'Bug Report' } }] },
					Status: { status: { name: 'New' } },
				},
			},
		});

		const trigger = {
			data: createPageCreatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase),
		};

		await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		// Status passes through unchanged (no mapping)
		expect(internalNotion.createPage).toHaveBeenCalledWith(
			expect.objectContaining({
				properties: expect.objectContaining({
					Status: { status: { name: 'New' } }, // Unchanged
				}),
			})
		);
	});
});

// ============================================================================
// TESTS: BIDIRECTIONAL SYNC (Internal → Client)
// ============================================================================

describe('Notion Two-Way Sync: Bidirectional Updates', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let clientNotion: ReturnType<typeof createMockNotionClient>;
	let internalNotion: ReturnType<typeof createMockNotionClient>;
	let ai: ReturnType<typeof createMockAI>;

	beforeEach(() => {
		storage = createMockStorage();
		clientNotion = createMockNotionClient();
		internalNotion = createMockNotionClient();
		ai = createMockAI();

		// Pre-populate mapping (simulating existing sync)
		storage._store.set('mapping:internal-page-456', {
			clientPageId: 'client-page-123',
			internalPageId: 'internal-page-456',
			lastSyncedAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
			lastSyncDirection: 'client_to_internal',
			syncVersion: 1,
		});
	});

	it('should sync status changes back to client unchanged', async () => {
		internalNotion.getPage.mockResolvedValue({
			success: true,
			data: {
				id: 'internal-page-456',
				properties: {
					Status: { status: { name: 'Done' } }, // Changed in internal
					Priority: { select: { name: 'Low' } },
				},
			},
		});

		const trigger = {
			data: createPageUpdatedEvent(
				'internal-page-456',
				DEFAULT_INPUTS.internalDatabase
			),
		};

		const result = await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(true);
		expect(result.source).toBe('internal');
		// Status passes through unchanged (no reverse mapping)
		expect(clientNotion.updatePage).toHaveBeenCalledWith(
			expect.objectContaining({
				pageId: 'client-page-123',
				properties: expect.objectContaining({
					Status: { status: { name: 'Done' } }, // Unchanged
				}),
			})
		);
	});

	it('should NOT sync non-bidirectional properties back to client', async () => {
		internalNotion.getPage.mockResolvedValue({
			success: true,
			data: {
				id: 'internal-page-456',
				properties: {
					Title: { title: [{ text: { content: 'Modified Title' } }] },
					Description: {
						rich_text: [{ text: { content: 'Modified Description' } }],
					},
					Status: { status: { name: 'Active' } },
				},
			},
		});

		const trigger = {
			data: createPageUpdatedEvent(
				'internal-page-456',
				DEFAULT_INPUTS.internalDatabase
			),
		};

		await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		// Title and Description are NOT bidirectional
		const updateCall = clientNotion.updatePage.mock.calls[0][0];
		expect(updateCall.properties.Title).toBeUndefined();
		expect(updateCall.properties.Description).toBeUndefined();
	});
});

// ============================================================================
// TESTS: LOOP PREVENTION
// ============================================================================

describe('Notion Two-Way Sync: Unified Idempotency (Loop Prevention)', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let clientNotion: ReturnType<typeof createMockNotionClient>;
	let internalNotion: ReturnType<typeof createMockNotionClient>;
	let ai: ReturnType<typeof createMockAI>;

	beforeEach(() => {
		storage = createMockStorage();
		clientNotion = createMockNotionClient();
		internalNotion = createMockNotionClient();
		ai = createMockAI();
	});

	it('should skip events within 5-second window', async () => {
		const timestamp = '2024-01-15T10:30:00.000Z';

		// Simulate recent sync using unified idempotency key
		storage._store.set(`sync:client-page-123:${timestamp}`, {
			syncedAt: Date.now(), // Just now
		});

		const trigger = {
			data: createPageUpdatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase, timestamp),
		};

		const result = await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(true);
		expect(result.skipped).toBe(true);
		expect(result.reason).toContain('loop prevention');
	});

	it('should process events after 5-second window expires', async () => {
		const timestamp = '2024-01-15T10:30:00.000Z';

		// Simulate old sync (6 seconds ago) using unified idempotency key
		storage._store.set(`sync:client-page-123:${timestamp}`, {
			syncedAt: Date.now() - 6000,
		});
		storage._store.set('mapping:client-page-123', {
			clientPageId: 'client-page-123',
			internalPageId: 'internal-page-456',
			lastSyncedAt: new Date(Date.now() - 6000).toISOString(),
			lastSyncDirection: 'client_to_internal',
			syncVersion: 1,
		});

		const trigger = {
			data: createPageUpdatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase, timestamp),
		};

		const result = await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(true);
		expect(result.skipped).toBeUndefined();
	});
});

// ============================================================================
// TESTS: IDEMPOTENCY (Part of unified mechanism)
// ============================================================================

describe('Notion Two-Way Sync: Idempotency', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let clientNotion: ReturnType<typeof createMockNotionClient>;
	let internalNotion: ReturnType<typeof createMockNotionClient>;
	let ai: ReturnType<typeof createMockAI>;

	beforeEach(() => {
		storage = createMockStorage();
		clientNotion = createMockNotionClient();
		internalNotion = createMockNotionClient();
		ai = createMockAI();
	});

	it('should skip duplicate events with same timestamp (unified mechanism)', async () => {
		const timestamp = '2024-01-15T10:30:00.000Z';

		// First execution
		const trigger1 = {
			data: createPageCreatedEvent(
				'client-page-123',
				DEFAULT_INPUTS._clientDatabase,
				timestamp
			),
		};

		await executeWorkflow({
			trigger: trigger1,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		// Reset mock call counts
		clientNotion.getPage.mockClear();
		internalNotion.createPage.mockClear();

		// Second execution with same timestamp
		const trigger2 = {
			data: createPageCreatedEvent(
				'client-page-123',
				DEFAULT_INPUTS._clientDatabase,
				timestamp
			),
		};

		// The unified key (sync:pageId:timestamp) already exists from first execution
		// This tests that same page+timestamp combo is rejected

		const result = await executeWorkflow({
			trigger: trigger2,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(true);
		expect(result.skipped).toBe(true);
		expect(result.reason).toContain('loop prevention');
		expect(internalNotion.createPage).not.toHaveBeenCalled();
	});
});

// ============================================================================
// TESTS: UNKNOWN DATABASE
// ============================================================================

describe('Notion Two-Way Sync: Database Validation', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let clientNotion: ReturnType<typeof createMockNotionClient>;
	let internalNotion: ReturnType<typeof createMockNotionClient>;
	let ai: ReturnType<typeof createMockAI>;

	beforeEach(() => {
		storage = createMockStorage();
		clientNotion = createMockNotionClient();
		internalNotion = createMockNotionClient();
		ai = createMockAI();
	});

	it('should skip events from unconfigured databases', async () => {
		const trigger = {
			data: createPageCreatedEvent('page-123', 'unknown-database-uuid'),
		};

		const result = await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(true);
		expect(result.skipped).toBe(true);
		expect(result.reason).toContain('not from configured databases');
	});
});

// ============================================================================
// TESTS: CLIENT NOT CONNECTED (Invitation Flow)
// ============================================================================

describe('Notion Two-Way Sync: Client Not Connected', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let clientNotion: ReturnType<typeof createMockNotionClient>;
	let internalNotion: ReturnType<typeof createMockNotionClient>;
	let ai: ReturnType<typeof createMockAI>;

	beforeEach(() => {
		storage = createMockStorage();
		clientNotion = createMockNotionClient();
		internalNotion = createMockNotionClient();
		ai = createMockAI();

		// Store pending invite
		storage._store.set('invite', {
			token: 'test-invite-token-123',
			createdAt: new Date().toISOString(),
			status: 'pending',
		});
	});

	it('should return error with invite URL when client not connected', async () => {
		const trigger = {
			data: createPageCreatedEvent('some-page', 'internal-db-uuid'),
		};

		const result = await executeWorkflow({
			trigger,
			inputs: INPUTS_CLIENT_NOT_CONNECTED,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('Client has not connected');
		expect(result.inviteUrl).toBe('https://workway.co/join/test-invite-token-123');
		expect(result.hint).toContain('invite link');
	});

	it('should not call any Notion APIs when client not connected', async () => {
		const trigger = {
			data: createPageCreatedEvent('some-page', 'internal-db-uuid'),
		};

		await executeWorkflow({
			trigger,
			inputs: INPUTS_CLIENT_NOT_CONNECTED,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(clientNotion.getPage).not.toHaveBeenCalled();
		expect(clientNotion.createPage).not.toHaveBeenCalled();
		expect(internalNotion.getPage).not.toHaveBeenCalled();
		expect(internalNotion.createPage).not.toHaveBeenCalled();
	});
});

// ============================================================================
// TESTS: ERROR HANDLING
// ============================================================================

describe('Notion Two-Way Sync: Error Handling', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let clientNotion: ReturnType<typeof createMockNotionClient>;
	let internalNotion: ReturnType<typeof createMockNotionClient>;
	let ai: ReturnType<typeof createMockAI>;

	beforeEach(() => {
		storage = createMockStorage();
		clientNotion = createMockNotionClient();
		internalNotion = createMockNotionClient();
		ai = createMockAI();
	});

	it('should handle missing mapping on update event', async () => {
		// No mapping exists for this page
		const trigger = {
			data: createPageUpdatedEvent('orphan-page-123', DEFAULT_INPUTS._clientDatabase),
		};

		const result = await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('No mapping found');
		expect(result.hint).toBeDefined();
	});

	it('should handle source page fetch failure', async () => {
		clientNotion.getPage.mockResolvedValue({
			success: false,
			error: 'Page not found',
		});

		const trigger = {
			data: createPageCreatedEvent('missing-page', DEFAULT_INPUTS._clientDatabase),
		};

		const result = await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('Failed to fetch source page');
	});

	it('should handle destination creation failure', async () => {
		internalNotion.createPage.mockResolvedValue({
			success: false,
			error: 'Database not found',
		});

		const trigger = {
			data: createPageCreatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase),
		};

		const result = await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('Failed to create destination page');
	});
});

// ============================================================================
// TESTS: AUTO-SUMMARIZATION (No config needed - Weniger, aber besser)
// ============================================================================

describe('Notion Two-Way Sync: Auto-Summarization', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let clientNotion: ReturnType<typeof createMockNotionClient>;
	let internalNotion: ReturnType<typeof createMockNotionClient>;
	let ai: ReturnType<typeof createMockAI>;

	beforeEach(() => {
		storage = createMockStorage();
		clientNotion = createMockNotionClient();
		internalNotion = createMockNotionClient();
		ai = createMockAI();
	});

	it('should auto-summarize long descriptions (> 500 chars)', async () => {
		const longDescription = 'A'.repeat(600); // > 500 chars

		clientNotion.getPage.mockResolvedValue({
			success: true,
			data: {
				id: 'client-page-123',
				properties: {
					Title: { title: [{ text: { content: 'Bug Report' } }] },
					Description: { rich_text: [{ text: { content: longDescription } }] },
				},
			},
		});

		const trigger = {
			data: createPageCreatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase),
		};

		await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		// Auto-summarization happens without any config
		expect(ai.generateText).toHaveBeenCalled();
	});

	it('should NOT summarize short descriptions (< 500 chars)', async () => {
		clientNotion.getPage.mockResolvedValue({
			success: true,
			data: {
				id: 'client-page-123',
				properties: {
					Title: { title: [{ text: { content: 'Bug Report' } }] },
					Description: { rich_text: [{ text: { content: 'Short description' } }] },
				},
			},
		});

		const trigger = {
			data: createPageCreatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase),
		};

		await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		// No summarization for short text
		expect(ai.generateText).not.toHaveBeenCalled();
	});
});

// ============================================================================
// TESTS: STATUS PASS-THROUGH (Weniger, aber besser - No mapping config)
// ============================================================================

describe('Notion Two-Way Sync: Status Pass-Through', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let clientNotion: ReturnType<typeof createMockNotionClient>;
	let internalNotion: ReturnType<typeof createMockNotionClient>;
	let ai: ReturnType<typeof createMockAI>;

	beforeEach(() => {
		storage = createMockStorage();
		clientNotion = createMockNotionClient();
		internalNotion = createMockNotionClient();
		ai = createMockAI();
	});

	// Test various status values pass through unchanged (no mapping needed)
	const statusValues = ['New', 'In Progress', 'Waiting', 'Resolved', 'Closed', 'CustomStatus'];

	statusValues.forEach((status) => {
		it(`should pass through status "${status}" unchanged (client → internal)`, async () => {
			clientNotion.getPage.mockResolvedValue({
				success: true,
				data: {
					id: 'client-page-123',
					properties: {
						Title: { title: [{ text: { content: 'Test' } }] },
						Status: { status: { name: status } },
					},
				},
			});

			const trigger = {
				data: createPageCreatedEvent('client-page-123', DEFAULT_INPUTS._clientDatabase),
			};

			await executeWorkflow({
				trigger,
				inputs: DEFAULT_INPUTS,
				storage,
				clientNotion,
				internalNotion,
				ai,
			});

			// Status passes through unchanged
			expect(internalNotion.createPage).toHaveBeenCalledWith(
				expect.objectContaining({
					properties: expect.objectContaining({
						Status: { status: { name: status } },
					}),
				})
			);
		});
	});

	it('should pass through status unchanged (internal → client)', async () => {
		// Pre-populate mapping
		storage._store.set('mapping:internal-page-456', {
			clientPageId: 'client-page-123',
			internalPageId: 'internal-page-456',
			lastSyncedAt: new Date(Date.now() - 60000).toISOString(),
			lastSyncDirection: 'client_to_internal',
			syncVersion: 1,
		});

		internalNotion.getPage.mockResolvedValue({
			success: true,
			data: {
				id: 'internal-page-456',
				properties: {
					Status: { status: { name: 'Done' } },
				},
			},
		});

		const trigger = {
			data: createPageUpdatedEvent(
				'internal-page-456',
				DEFAULT_INPUTS.internalDatabase
			),
		};

		await executeWorkflow({
			trigger,
			inputs: DEFAULT_INPUTS,
			storage,
			clientNotion,
			internalNotion,
			ai,
		});

		// Status passes through unchanged - no reverse mapping
		expect(clientNotion.updatePage).toHaveBeenCalledWith(
			expect.objectContaining({
				properties: expect.objectContaining({
					Status: { status: { name: 'Done' } },
				}),
			})
		);
	});
});
