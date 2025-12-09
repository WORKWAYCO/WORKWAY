/**
 * Notion Two-Way Sync (Agentic Updates)
 *
 * Bidirectional synchronization between two Notion workspaces.
 * Information flows Client -> Internal and Internal -> Client automatically.
 *
 * Primary Use Case: Support Tickets
 * - Client creates a support item in their workspace
 * - Item syncs to internal workspace (Half Dozen)
 * - When internal team updates status/resolution, changes sync back
 * - Client sees updates without leaving their workspace
 *
 * The tool recedes: Clients don't manage tickets in two places.
 * They create once, updates flow bidirectionally.
 *
 * Integrations: Notion (x2 workspaces via separate tokens)
 * Trigger: Notion webhook (page.created, page.properties.updated)
 *
 * ## Setup Requirements
 *
 * This workflow requires webhooks to be configured manually:
 * 1. Create Notion integration tokens for both workspaces
 * 2. Configure webhooks via Notion API or use polling fallback
 * 3. Point webhooks to your WORKWAY webhook endpoint
 *
 * ## Experimental Status
 *
 * This workflow is marked experimental because:
 * - Notion webhooks require manual configuration
 * - Cross-workspace sync patterns are complex
 * - Loop prevention needs real-world testing
 *
 * @see https://developers.notion.com/reference/webhooks
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';
import { Notion } from '@workwayco/integrations';

// ============================================================================
// CONSTANTS (Weniger, aber besser - sensible defaults, no user config needed)
// ============================================================================

/** Time window to ignore events after a sync (prevents infinite loops) */
const LOOP_PREVENTION_WINDOW_MS = 5000;

/** Property name in client database to store link to internal page */
const CLIENT_REF_PROPERTY = 'Internal Ticket ID';

/** Property name in internal database to store link to client page */
const INTERNAL_REF_PROPERTY = 'Client Page ID';

/** Default property mappings for support ticket pattern */
const DEFAULT_PROPERTY_MAPPINGS: PropertyMapping[] = [
	{ source: 'Title', destination: 'Title', bidirectional: false },
	{ source: 'Description', destination: 'Description', bidirectional: false, transform: 'summarize' },
	{ source: 'Status', destination: 'Status', bidirectional: true, transform: 'status_map' },
	{ source: 'Priority', destination: 'Priority', bidirectional: true },
	{ source: 'Resolution', destination: 'Resolution', bidirectional: true },
];

// ============================================================================
// TYPES
// ============================================================================

/**
 * Property mapping configuration
 * Maps properties between source and destination workspaces
 */
interface PropertyMapping {
	/** Source property name in client workspace */
	source: string;
	/** Destination property name in internal workspace */
	destination: string;
	/** Whether to sync this property back (bidirectional) */
	bidirectional?: boolean;
	/** Transform function identifier */
	transform?: 'none' | 'summarize' | 'status_map' | 'priority_map';
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
	description: 'Bidirectional sync between Notion workspaces for support tickets and client updates',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_tickets_arrive',

		outcomeStatement: {
			suggestion: 'Sync support tickets across workspaces?',
			explanation:
				'When clients create tickets in their Notion, they appear in yours. When you resolve them, clients see updates automatically.',
			outcome: 'Support tickets that sync themselves',
		},

		primaryPair: {
			from: 'notion',
			to: 'notion',
			workflowId: 'notion-two-way-sync',
			outcome: 'Workspaces that stay in sync',
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

		essentialFields: ['clientDatabase', 'internalDatabase'],

		zuhandenheit: {
			timeToValue: 5,
			worksOutOfBox: false,
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
		// Essential: Client workspace configuration
		clientNotionToken: {
			type: 'string',
			label: 'Client Notion Token',
			required: true,
			description: 'Integration token for client workspace',
			placeholder: 'secret_...',
		},

		clientDatabase: {
			type: 'string',
			label: 'Client Database ID',
			required: true,
			description: 'Database ID in client workspace',
			placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
		},

		// Essential: Internal workspace configuration
		internalNotionToken: {
			type: 'string',
			label: 'Internal Notion Token',
			required: true,
			description: 'Integration token for your workspace',
			placeholder: 'secret_...',
		},

		internalDatabase: {
			type: 'string',
			label: 'Internal Database ID',
			required: true,
			description: 'Database ID in your workspace',
			placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
		},

		// Essential: Status mapping (reverse is auto-derived)
		statusMapping: {
			type: 'string',
			label: 'Status Mapping (JSON)',
			description: 'Map client → internal statuses. Reverse mapping is auto-derived.',
			default: '{"New":"Incoming","In Progress":"Active","Waiting":"Blocked","Resolved":"Done","Closed":"Archived"}',
		},

		// Optional: AI summarization (only non-essential config exposed)
		enableSummarization: {
			type: 'boolean',
			label: 'AI Summarization',
			default: true,
			description: 'Summarize long descriptions when syncing',
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

	async execute({ trigger, inputs, integrations, storage }) {
		const event = trigger.data;
		const pageId = event.page_id || event.id;
		const parentDatabaseId = event.parent?.database_id;

		// Use module-level constants (Weniger, aber besser)
		const propertyMappings = DEFAULT_PROPERTY_MAPPINGS;

		// Parse status mapping and auto-derive reverse
		const statusMap = JSON.parse(inputs.statusMapping || '{}');
		const reverseStatusMap = deriveReverseMapping(statusMap);

		// Determine source workspace
		const isFromClient = parentDatabaseId === inputs.clientDatabase;
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

		// ========================================================================
		// LOOP PREVENTION
		// ========================================================================

		const syncKey = `sync:${pageId}`;
		const recentSync = await storage.get<SyncMapping>(syncKey);

		if (recentSync) {
			const timeSinceLastSync = Date.now() - new Date(recentSync.lastSyncedAt).getTime();

			if (timeSinceLastSync < LOOP_PREVENTION_WINDOW_MS) {
				return {
					success: true,
					skipped: true,
					reason: `Within loop prevention window (${timeSinceLastSync}ms < ${LOOP_PREVENTION_WINDOW_MS}ms)`,
					mapping: recentSync,
				};
			}
		}

		// ========================================================================
		// IDEMPOTENCY CHECK
		// ========================================================================

		const idempotencyKey = `processed:${source}:${pageId}:${event.timestamp || event.last_edited_time}`;
		const alreadyProcessed = await storage.get(idempotencyKey);

		if (alreadyProcessed) {
			return {
				success: true,
				skipped: true,
				reason: 'Event already processed (idempotency check)',
			};
		}

		// ========================================================================
		// SYNC DIRECTION: Always bidirectional (Weniger, aber besser)
		// ========================================================================
		// Note: Direction control removed as single config. Bidirectional sync
		// is the core value proposition. If one-way sync needed, create a
		// separate simpler workflow.

		// ========================================================================
		// CREATE NOTION CLIENTS
		// ========================================================================

		const clientNotion = new Notion({ accessToken: inputs.clientNotionToken });
		const internalNotion = new Notion({ accessToken: inputs.internalNotionToken });

		const sourceNotion = isFromClient ? clientNotion : internalNotion;
		const destNotion = isFromClient ? internalNotion : clientNotion;

		// ========================================================================
		// FETCH SOURCE PAGE
		// ========================================================================

		const sourcePage = await sourceNotion.getPage({ pageId });

		if (!sourcePage.success) {
			return {
				success: false,
				error: `Failed to fetch source page: ${sourcePage.error}`,
			};
		}

		const page = sourcePage.data;

		// ========================================================================
		// CHECK FOR EXISTING MAPPING
		// ========================================================================

		let mapping = await storage.get<SyncMapping>(`mapping:${pageId}`);

		const refProperty = isFromClient ? CLIENT_REF_PROPERTY : INTERNAL_REF_PROPERTY;
		const linkedPageId = extractRichTextProperty(page?.properties?.[refProperty]);

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
		// BUILD PROPERTIES FOR DESTINATION
		// ========================================================================

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const destProperties: Record<string, any> = {};

		for (const propMapping of propertyMappings) {
			const sourcePropName = isFromClient ? propMapping.source : propMapping.destination;
			const destPropName = isFromClient ? propMapping.destination : propMapping.source;

			// Skip if this is a reverse sync and property isn't bidirectional
			if (!isFromClient && !propMapping.bidirectional) {
				continue;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const sourceProp = (page?.properties as any)?.[sourcePropName];
			if (!sourceProp) continue;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let value: any = sourceProp;

			// Apply transformations
			if (propMapping.transform === 'summarize' && inputs.enableSummarization) {
				const text = extractRichTextProperty(sourceProp);
				if (text && text.length > 500) {
					const summary = await integrations.ai.generateText({
						model: AIModels.LLAMA_3_8B,
						system: 'Summarize the following support ticket description in 2-3 sentences. Focus on the key issue and any specific requests.',
						prompt: text,
						temperature: 0.3,
						max_tokens: 150,
					});
					value = {
						rich_text: [{ text: { content: summary.data?.response || text.slice(0, 500) } }],
					};
				}
			} else if (propMapping.transform === 'status_map') {
				const statusName = sourceProp.status?.name || sourceProp.select?.name;
				if (statusName) {
					const currentStatusMap = isFromClient ? statusMap : reverseStatusMap;
					const mappedStatus = currentStatusMap[statusName] || statusName;
					value = sourceProp.status
						? { status: { name: mappedStatus } }
						: { select: { name: mappedStatus } };
				}
			}

			destProperties[destPropName] = value;
		}

		// ========================================================================
		// CREATE OR UPDATE DESTINATION PAGE (with partial sync recovery)
		// ========================================================================

		let result;
		let partialSyncState: {
			destPageCreated?: boolean;
			destPageId?: string;
			mappingStored?: boolean;
			backRefUpdated?: boolean;
		} = {};

		try {
			if (eventType === 'created' && !mapping) {
				// Create new page in destination workspace
				const destDatabase = isFromClient ? inputs.internalDatabase : inputs.clientDatabase;

				// Add reference property pointing back to source
				const backRefProperty = isFromClient ? INTERNAL_REF_PROPERTY : CLIENT_REF_PROPERTY;
				destProperties[backRefProperty] = {
					rich_text: [{ text: { content: pageId } }],
				};

				result = await destNotion.createPage({
					parentDatabaseId: destDatabase,
					properties: destProperties,
				});

				if (result.success) {
					partialSyncState.destPageCreated = true;
					partialSyncState.destPageId = result.data.id;

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
					await storage.set(syncKey, newMapping);
					partialSyncState.mappingStored = true;

					// Update source page with reference to new destination page
					const sourceRefProperty = isFromClient ? CLIENT_REF_PROPERTY : INTERNAL_REF_PROPERTY;
					const backRefResult = await sourceNotion.updatePage({
						pageId,
						properties: {
							[sourceRefProperty]: {
								rich_text: [{ text: { content: result.data.id } }],
							},
						},
					});
					partialSyncState.backRefUpdated = backRefResult.success;
				}
			} else {
				// Update existing page
				const destPageId = isFromClient ? mapping?.internalPageId : mapping?.clientPageId;

				if (!destPageId) {
					// Recovery: Check if we have a partial state from previous failed sync
					const recoveryKey = `recovery:${pageId}`;
					const recoveryState = await storage.get<typeof partialSyncState>(recoveryKey);

					if (recoveryState?.destPageId) {
						// Resume from partial state
						result = await destNotion.updatePage({
							pageId: recoveryState.destPageId,
							properties: destProperties,
						});
						await storage.delete(recoveryKey);
					} else {
						return {
							success: false,
							error: 'No mapping found for update event',
							pageId,
							source,
							hint: 'This page may need to be manually linked or re-created',
						};
					}
				} else {
					result = await destNotion.updatePage({
						pageId: destPageId,
						properties: destProperties,
					});
				}

				if (result?.success && mapping) {
					const updatedMapping: SyncMapping = {
						...mapping,
						lastSyncedAt: new Date().toISOString(),
						lastSyncDirection: isFromClient ? 'client_to_internal' : 'internal_to_client',
						syncVersion: mapping.syncVersion + 1,
					};

					const destPageId = isFromClient ? mapping.internalPageId : mapping.clientPageId;
					await storage.set(`mapping:${pageId}`, updatedMapping);
					await storage.set(`mapping:${destPageId}`, updatedMapping);
					await storage.set(syncKey, updatedMapping);
				}
			}
		} catch (error) {
			// Store partial state for recovery on next sync attempt
			if (partialSyncState.destPageCreated && !partialSyncState.mappingStored) {
				await storage.set(`recovery:${pageId}`, partialSyncState);
			}
			throw error;
		}

		// Mark as processed for idempotency
		await storage.set(idempotencyKey, {
			processedAt: new Date().toISOString(),
			source,
			eventType,
		});

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
			propertiesSynced: Object.keys(destProperties),
			mapping: await storage.get<SyncMapping>(`mapping:${pageId}`),
			partialSyncState: partialSyncState.backRefUpdated === false ? partialSyncState : undefined,
		};
	},
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Auto-derive reverse mapping from status mapping
 * Less config for user - system handles the inversion
 */
function deriveReverseMapping(mapping: Record<string, string>): Record<string, string> {
	const reverse: Record<string, string> = {};
	for (const [key, value] of Object.entries(mapping)) {
		reverse[value] = key;
	}
	return reverse;
}

/**
 * Extract plain text from a Notion rich_text property
 */
function extractRichTextProperty(prop: any): string | undefined {
	if (!prop) return undefined;

	if (prop.rich_text && Array.isArray(prop.rich_text)) {
		return prop.rich_text.map((rt: any) => rt.plain_text || rt.text?.content || '').join('');
	}

	if (prop.title && Array.isArray(prop.title)) {
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
	experimental: true, // Requires manual webhook setup, loop prevention needs testing
	stats: { rating: 4.9, users: 0, reviews: 0 },
	tags: ['notion', 'sync', 'bidirectional', 'support', 'tickets', 'cross-workspace', 'experimental'],
};
