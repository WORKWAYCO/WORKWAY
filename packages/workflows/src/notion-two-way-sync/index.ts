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
 * @see https://developers.notion.com/reference/webhooks
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';
import { Notion } from '@workwayco/integrations/notion';

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
		// Client workspace configuration
		clientNotionToken: {
			type: 'string',
			label: 'Client Notion Integration Token',
			required: true,
			description: 'Integration token for the client workspace (from Notion integrations page)',
			placeholder: 'secret_...',
		},

		clientDatabase: {
			type: 'string',
			label: 'Client Support Database ID',
			required: true,
			description: 'Database ID in client workspace where support items are created',
			placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
		},

		// Internal workspace configuration
		internalNotionToken: {
			type: 'string',
			label: 'Internal Notion Integration Token',
			required: true,
			description: 'Integration token for your internal workspace',
			placeholder: 'secret_...',
		},

		internalDatabase: {
			type: 'string',
			label: 'Internal Tickets Database ID',
			required: true,
			description: 'Database ID in your workspace to receive tickets',
			placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
		},

		// Property mappings (simplified as JSON string)
		propertyMappingsJson: {
			type: 'string',
			label: 'Property Mappings (JSON)',
			description: 'How properties map between workspaces',
			default: JSON.stringify([
				{ source: 'Title', destination: 'Title', bidirectional: false },
				{ source: 'Description', destination: 'Description', bidirectional: false, transform: 'summarize' },
				{ source: 'Status', destination: 'Status', bidirectional: true, transform: 'status_map' },
				{ source: 'Priority', destination: 'Priority', bidirectional: true },
				{ source: 'Resolution', destination: 'Resolution', bidirectional: true },
			]),
		},

		// Status mapping (JSON string for client -> internal mapping)
		statusMapping: {
			type: 'string',
			label: 'Status Mapping (JSON)',
			description: 'Map client statuses to internal statuses as JSON object',
			default: '{"New":"Incoming","In Progress":"Active","Waiting":"Blocked","Resolved":"Done","Closed":"Archived"}',
		},

		// Reverse status mapping (JSON string for internal -> client mapping)
		reverseStatusMapping: {
			type: 'string',
			label: 'Reverse Status Mapping (JSON)',
			description: 'Map internal statuses back to client statuses as JSON object',
			default: '{"Incoming":"New","Active":"In Progress","Blocked":"Waiting","Done":"Resolved","Archived":"Closed"}',
		},

		// Sync behavior configuration
		syncDirection: {
			type: 'select',
			label: 'Sync Direction',
			options: ['client_to_internal', 'internal_to_client', 'bidirectional'],
			default: 'bidirectional',
			description: 'Which direction(s) to sync',
		},

		// Loop prevention window (milliseconds)
		loopPreventionWindow: {
			type: 'number',
			label: 'Loop Prevention Window (ms)',
			default: 5000,
			description: 'Ignore events within this window after a sync to prevent loops',
		},

		// Reference property names (for storing sync IDs)
		clientRefProperty: {
			type: 'string',
			label: 'Client Reference Property',
			default: 'Internal Ticket ID',
			description: 'Property in client database to store internal page ID',
		},

		internalRefProperty: {
			type: 'string',
			label: 'Internal Reference Property',
			default: 'Client Page ID',
			description: 'Property in internal database to store client page ID',
		},

		// AI summarization toggle
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

		// Parse JSON inputs
		const propertyMappings: PropertyMapping[] = JSON.parse(inputs.propertyMappingsJson || '[]');
		const statusMap = JSON.parse(inputs.statusMapping || '{}');
		const reverseStatusMap = JSON.parse(inputs.reverseStatusMapping || '{}');

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

			if (timeSinceLastSync < inputs.loopPreventionWindow) {
				return {
					success: true,
					skipped: true,
					reason: `Within loop prevention window (${timeSinceLastSync}ms < ${inputs.loopPreventionWindow}ms)`,
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
		// SYNC DIRECTION CHECK
		// ========================================================================

		const direction = inputs.syncDirection;

		if (direction === 'client_to_internal' && isFromInternal) {
			return { success: true, skipped: true, reason: 'Internal->Client sync disabled' };
		}

		if (direction === 'internal_to_client' && isFromClient) {
			return { success: true, skipped: true, reason: 'Client->Internal sync disabled' };
		}

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

		const refProperty = isFromClient ? inputs.clientRefProperty : inputs.internalRefProperty;
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
		// CREATE OR UPDATE DESTINATION PAGE
		// ========================================================================

		let result;

		if (eventType === 'created' && !mapping) {
			// Create new page in destination workspace
			const destDatabase = isFromClient ? inputs.internalDatabase : inputs.clientDatabase;

			// Add reference property pointing back to source
			const backRefProperty = isFromClient ? inputs.internalRefProperty : inputs.clientRefProperty;
			destProperties[backRefProperty] = {
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
				await storage.set(syncKey, newMapping);

				// Update source page with reference to new destination page
				const sourceRefProperty = isFromClient ? inputs.clientRefProperty : inputs.internalRefProperty;
				await sourceNotion.updatePage({
					pageId,
					properties: {
						[sourceRefProperty]: {
							rich_text: [{ text: { content: result.data.id } }],
						},
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
				};
			}

			result = await destNotion.updatePage({
				pageId: destPageId,
				properties: destProperties,
			});

			if (result.success && mapping) {
				const updatedMapping: SyncMapping = {
					...mapping,
					lastSyncedAt: new Date().toISOString(),
					lastSyncDirection: isFromClient ? 'client_to_internal' : 'internal_to_client',
					syncVersion: mapping.syncVersion + 1,
				};

				await storage.set(`mapping:${pageId}`, updatedMapping);
				await storage.set(`mapping:${destPageId}`, updatedMapping);
				await storage.set(syncKey, updatedMapping);
			}
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
		};
	},
});

// ============================================================================
// HELPERS
// ============================================================================

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
	featured: true,
	stats: { rating: 4.9, users: 0, reviews: 0 },
	tags: ['notion', 'sync', 'bidirectional', 'support', 'tickets', 'cross-workspace'],
};
