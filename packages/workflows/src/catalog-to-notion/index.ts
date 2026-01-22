/**
 * Catalog to Notion Workflow
 *
 * Syncs WORKWAY's public workflow marketplace catalog to a user's Notion database.
 * When workflows are published or updated, the user's Notion database stays current
 * with full metadata, pricing, walkthroughs, and install links.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "I can browse WORKWAY workflows from my Notion workspace"
 *
 * Integrations: Notion
 * Trigger: Webhook (workflow.published, workflow.updated, catalog.sync)
 *
 * ## Design Philosophy (Heideggerian)
 *
 * Users shouldn't have to leave Notion to discover automation opportunities.
 * The marketplace comes to them. The catalog lives where they work.
 * When new workflows appear, their Notion updates automatically.
 *
 * ## Architecture
 *
 * ```
 * WORKWAY Platform                              User's Notion
 * (Workflow Registry)                           (Catalog Database)
 *       │                                              │
 *       │ ──────── Webhook Trigger ──────────────→    │
 *       │      workflow.published                      │
 *       │      workflow.updated                        │
 *       │      catalog.sync (manual)                   │
 *       │                                              │
 *       ▼                                              ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    catalog-to-notion                         │
 * │  ┌─────────────────────────────────────────────────────────┐ │
 * │  │ Sync Logic                                              │ │
 * │  │ - Fetch catalog from WORKWAY API                        │ │
 * │  │ - Compare with existing Notion pages                    │ │
 * │  │ - Create/update pages with rich content                 │ │
 * │  │ - Track sync state in KV                                │ │
 * │  └─────────────────────────────────────────────────────────┘ │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * @public Marketplace workflow
 * @version 1.0.0
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';
import { delay } from '../_shared/utils.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** State key prefix for KV storage */
const STATE_KEY_PREFIX = 'catalog-to-notion:';

/** Maximum workflows to process per sync batch */
const MAX_WORKFLOWS_PER_BATCH = 50;

/** Delay between API calls (ms) to respect Notion rate limits (3 req/s) */
const API_DELAY_MS = 350;

/** WORKWAY API base URL */
const WORKWAY_API_URL = 'https://api.workway.co';

/** WORKWAY web base URL for install links */
const WORKWAY_WEB_URL = 'https://workway.co';

// ============================================================================
// TYPES
// ============================================================================

interface SyncState {
	databaseId: string;
	lastSyncTime: string; // ISO timestamp
	/** Map of workflow ID → Notion page ID */
	workflowPageMappings: Record<string, string>;
	/** Total workflows synced */
	totalSynced: number;
	/** Last sync result */
	lastSyncResult?: {
		created: number;
		updated: number;
		errors: number;
	};
}

interface WorkflowCatalogItem {
	id: string;
	name: string;
	tagline?: string;
	description: string;
	icon_url?: string;
	banner_url?: string;
	screenshots?: string[];
	tags?: string[];
	pricing_model: 'free' | 'freemium' | 'subscription' | 'usage' | 'one-time' | 'paid';
	base_price?: number;
	free_executions?: number;
	install_count?: number;
	average_rating?: number;
	review_count?: number;
	required_oauth_providers?: string[];
	category_id?: string;
	outcome_frame?: string;
	walkthrough?: {
		scenes: Array<{
			title: string;
			text: string;
		}>;
	};
	smart_defaults?: Record<string, unknown>;
	published_at?: string;
	updated_at?: string;
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
	name: 'Catalog to Notion',
	description:
		'Keep your Notion workspace updated with WORKWAY\'s workflow marketplace. When new workflows are published, they appear in your Notion database—complete with descriptions, pricing, and install links.',
	version: '1.0.0',

	// Pathway metadata for discovery
	pathway: {
		outcomeFrame: 'when_data_changes',

		outcomeStatement: {
			suggestion: 'Want to browse WORKWAY workflows from Notion?',
			explanation:
				'Your Notion database stays synced with our marketplace catalog. New workflows appear automatically with full details and install links.',
			outcome: 'Workflow catalog that updates itself',
		},

		primaryPair: {
			from: 'workway',
			to: 'notion',
			workflowId: 'catalog-to-notion',
			outcome: 'Marketplace catalog in your Notion',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion'],
				workflowId: 'catalog-to-notion',
				priority: 70,
			},
		],

		smartDefaults: {
			syncMode: { value: 'full_sync' },
		},

		essentialFields: ['notionDatabaseId'],

		zuhandenheit: {
			timeToValue: 3, // Minutes to first outcome
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true, // Webhook-triggered
		},

		walkthrough: {
			scenes: [
				{
					title: 'The Problem',
					text: "You know WORKWAY has workflows that could help you. Automations for meetings, payments, tasks, all kinds of things. But you'd have to go to the marketplace to browse them. And when new ones appear, you might not notice. The catalog exists somewhere else. Your work happens in Notion.",
				},
				{
					title: 'What Catalog to Notion Does',
					text: "This workflow brings the marketplace to you. Pick a Notion database. That's it. Every public workflow on WORKWAY appears as a page in your database. Name, description, integrations needed, pricing—all the details. When we publish new workflows, your database updates automatically. You browse from where you already work.",
				},
				{
					title: 'How It Looks',
					text: "Each workflow becomes a Notion page. The icon, the tagline, a full description. Which integrations it connects—Zoom, Stripe, Slack, whatever it uses. Pricing model and cost. User ratings if people have reviewed it. And a direct link to install. You can filter by category, search by name, sort by rating. All the power of Notion's database features, applied to workflow discovery.",
				},
				{
					title: 'The Setup',
					text: "Setup takes one minute. Connect Notion. Pick or create a database for your catalog. WORKWAY syncs the full marketplace—usually takes a minute or two for the initial load. After that, updates happen automatically when we publish new workflows. You can also trigger a manual sync anytime.",
				},
				{
					title: 'Close',
					text: "Catalog to Notion doesn't change how WORKWAY works. It changes where you discover it. The marketplace lives in your Notion. New workflows appear automatically. The tool disappears. And automation opportunities come to you.",
				},
			],
		},
	},

	pricing: {
		model: 'freemium',
		freeExecutions: 10, // 10 syncs free per month (catalog updates are infrequent)
		pricePerExecution: 0.01,
		description: '10 free syncs/month, then $0.01 per sync',
	},

	integrations: [
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases', 'write_databases'] },
	],

	config: {
		// Core configuration
		notionDatabaseId: {
			type: 'text',
			label: 'Catalog Database',
			required: true,
			description: 'Notion database where workflows will be synced',
		},

		// Sync settings
		syncMode: {
			type: 'select',
			label: 'Sync Mode',
			options: ['full_sync', 'new_only'],
			default: 'full_sync',
			description: 'Full sync updates all workflows; new_only only adds new ones',
		},

		// Include walkthrough content in page body
		includeWalkthrough: {
			type: 'boolean',
			label: 'Include Walkthrough',
			default: true,
			description: 'Add workflow walkthrough scenes to page content',
		},

		// Include screenshots
		includeScreenshots: {
			type: 'boolean',
			label: 'Include Screenshots',
			default: true,
			description: 'Add workflow screenshots to page content',
		},
	},

	// Webhook trigger from WORKWAY platform
	trigger: webhook({
		path: '/catalog-to-notion',
		events: ['workflow.published', 'workflow.updated', 'catalog.sync'],
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const {
			notionDatabaseId,
			syncMode = 'full_sync',
			includeWalkthrough = true,
			includeScreenshots = true,
		} = inputs;

		const result = {
			created: 0,
			updated: 0,
			skipped: 0,
			errors: 0,
			errorDetails: [] as string[],
		};

		// Load state from KV
		const stateKey = `${STATE_KEY_PREFIX}${notionDatabaseId}`;
		let state: SyncState = (await env.KV?.get(stateKey, 'json')) || {
			databaseId: notionDatabaseId,
			lastSyncTime: new Date(0).toISOString(),
			workflowPageMappings: {},
			totalSynced: 0,
		};

		try {
			// Determine what to sync based on trigger type
			let workflowsToSync: WorkflowCatalogItem[] = [];

			if (trigger.type === 'webhook') {
				const payload = trigger.data as {
					event?: string;
					workflow?: WorkflowCatalogItem;
					workflows?: WorkflowCatalogItem[];
				};

				if (payload.event === 'workflow.published' || payload.event === 'workflow.updated') {
					// Single workflow update
					if (payload.workflow) {
						workflowsToSync = [payload.workflow];
					}
				} else if (payload.event === 'catalog.sync' || payload.workflows) {
					// Full catalog sync - fetch from API
					workflowsToSync = await fetchCatalog(env);
				}
			} else {
				// Manual trigger or cron - do full sync
				workflowsToSync = await fetchCatalog(env);
			}

			if (workflowsToSync.length === 0) {
				return {
					success: true,
					message: 'No workflows to sync',
					...result,
				};
			}

			// Get existing pages in the database to determine creates vs updates
			const existingPages = await queryExistingPages(integrations, notionDatabaseId);

			// Build a map of workflow ID → existing page ID
			const existingPageMap: Record<string, string> = {};
			for (const page of existingPages) {
				const workflowId = extractWorkflowIdFromPage(page);
				if (workflowId) {
					existingPageMap[workflowId] = page.id;
				}
			}

			// Process each workflow
			for (const workflow of workflowsToSync) {
				try {
					const existingPageId = existingPageMap[workflow.id] || state.workflowPageMappings[workflow.id];

					if (existingPageId && syncMode === 'new_only') {
						result.skipped++;
						continue;
					}

					// Build page properties
					const properties = buildPageProperties(workflow);

					// Build page content blocks
					const children = buildPageContent(workflow, {
						includeWalkthrough,
						includeScreenshots,
					});

					if (existingPageId) {
						// Update existing page
						const updateResult = await integrations.notion.updatePage({
							pageId: existingPageId,
							properties,
						});

						if (updateResult.success) {
							// Append new content (replace would require deleting blocks first)
							// For simplicity, we just update properties on existing pages
							result.updated++;
						} else {
							result.errors++;
							result.errorDetails.push(`Failed to update ${workflow.id}: ${updateResult.error?.message}`);
						}
					} else {
						// Create new page
						const createResult = await integrations.notion.createPage({
							parentDatabaseId: notionDatabaseId,
							properties,
							children,
						});

						if (createResult.success) {
							state.workflowPageMappings[workflow.id] = createResult.data.id;
							result.created++;
						} else {
							result.errors++;
							result.errorDetails.push(`Failed to create ${workflow.id}: ${createResult.error?.message}`);
						}
					}

					// Rate limiting
					await delay(API_DELAY_MS);
				} catch (error) {
					result.errors++;
				result.errorDetails.push(
					`Error processing ${workflow.id}: ${error instanceof Error ? error.message : 'Unknown'}`
				);
				}
			}

			// Update state
			state.lastSyncTime = new Date().toISOString();
			state.totalSynced = Object.keys(state.workflowPageMappings).length;
			state.lastSyncResult = {
				created: result.created,
				updated: result.updated,
				errors: result.errors,
			};
			await env.KV?.put(stateKey, JSON.stringify(state));

			return {
				success: true,
				...result,
				message: `Synced ${result.created} new, ${result.updated} updated, ${result.errors} errors`,
				totalInCatalog: state.totalSynced,
			};
		} catch (error) {
			result.errorDetails.push(error instanceof Error ? error.message : 'Unknown error');
			return {
				success: false,
				...result,
			};
		}
	},

	onError: async ({ error, inputs }) => {
		console.error(`catalog-to-notion failed for database ${inputs.notionDatabaseId}:`, error);
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch the full workflow catalog from WORKWAY API
 */
async function fetchCatalog(env: any): Promise<WorkflowCatalogItem[]> {
	try {
		// Use internal registry if available, otherwise fetch from API
		const apiUrl = env.WORKWAY_API_URL || WORKWAY_API_URL;
		const response = await fetch(`${apiUrl}/v1/workflows-registry?limit=100`);

		if (!response.ok) {
			throw new Error(`Failed to fetch catalog: ${response.status}`);
		}

		const data = (await response.json()) as { workflows: WorkflowCatalogItem[] };
		return data.workflows || [];
	} catch (error) {
		console.error('Failed to fetch catalog:', error);
		return [];
	}
}

/**
 * Query existing workflow pages in the user's Notion database
 */
async function queryExistingPages(
	integrations: any,
	databaseId: string
): Promise<Array<{ id: string; properties: Record<string, any> }>> {
	const pages: Array<{ id: string; properties: Record<string, any> }> = [];
	let hasMore = true;
	let startCursor: string | undefined;

	while (hasMore) {
		const result = await integrations.notion.queryDatabase({
			databaseId,
			page_size: 100,
			start_cursor: startCursor,
		});

		if (!result.success) {
			break;
		}

		pages.push(...result.data);
		hasMore = result.data.has_more;
		startCursor = result.data.next_cursor;

		// Safety limit
		if (pages.length >= 500) break;
	}

	return pages;
}

/**
 * Extract workflow ID from a Notion page's properties
 */
function extractWorkflowIdFromPage(page: { properties: Record<string, any> }): string | null {
	// Look for Workflow ID property
	const workflowIdProp = page.properties['Workflow ID'] || page.properties['workflow_id'];
	if (workflowIdProp?.rich_text?.[0]?.plain_text) {
		return workflowIdProp.rich_text[0].plain_text;
	}

	// Fallback: extract from Install Link URL
	const installLinkProp = page.properties['Install Link'] || page.properties['install_link'];
	if (installLinkProp?.url) {
		const match = installLinkProp.url.match(/\/workflows\/([^/?]+)/);
		return match ? match[1] : null;
	}

	return null;
}

/**
 * Build Notion page properties for a workflow
 */
function buildPageProperties(workflow: WorkflowCatalogItem): Record<string, any> {
	const properties: Record<string, any> = {
		// Title property
		Name: {
			title: [{ text: { content: workflow.name } }],
		},

		// Workflow ID for tracking
		'Workflow ID': {
			rich_text: [{ text: { content: workflow.id } }],
		},

		// Tagline
		Tagline: {
			rich_text: [{ text: { content: workflow.tagline || '' } }],
		},

		// Description (truncated to 2000 chars for Notion limit)
		Description: {
			rich_text: [{ text: { content: (workflow.description || '').slice(0, 2000) } }],
		},

		// Icon URL
		Icon: {
			url: workflow.icon_url || null,
		},

		// Install Link
		'Install Link': {
			url: `${WORKWAY_WEB_URL}/workflows/${workflow.id}`,
		},

		// Pricing Model
		'Pricing Model': {
			select: workflow.pricing_model ? { name: workflow.pricing_model } : null,
		},
	};

	// Price (if applicable)
	if (workflow.base_price !== undefined) {
		properties['Price'] = {
			number: workflow.base_price,
		};
	}

	// Free Executions
	if (workflow.free_executions !== undefined) {
		properties['Free Executions'] = {
			number: workflow.free_executions,
		};
	}

	// Rating
	if (workflow.average_rating !== undefined) {
		properties['Rating'] = {
			number: workflow.average_rating,
		};
	}

	// Install Count
	if (workflow.install_count !== undefined) {
		properties['Install Count'] = {
			number: workflow.install_count,
		};
	}

	// Review Count
	if (workflow.review_count !== undefined) {
		properties['Review Count'] = {
			number: workflow.review_count,
		};
	}

	// Integrations (multi-select)
	if (workflow.required_oauth_providers && workflow.required_oauth_providers.length > 0) {
		properties['Integrations'] = {
			multi_select: workflow.required_oauth_providers.map((name) => ({ name })),
		};
	}

	// Outcome Frame (select)
	if (workflow.outcome_frame) {
		properties['Outcome Frame'] = {
			select: { name: workflow.outcome_frame },
		};
	}

	// Category (select)
	if (workflow.category_id) {
		properties['Category'] = {
			select: { name: workflow.category_id },
		};
	}

	// Tags (multi-select)
	if (workflow.tags && workflow.tags.length > 0) {
		properties['Tags'] = {
			multi_select: workflow.tags.slice(0, 10).map((tag) => ({ name: tag })),
		};
	}

	// Published Date
	if (workflow.published_at) {
		properties['Published'] = {
			date: { start: workflow.published_at.split('T')[0] },
		};
	}

	return properties;
}

/**
 * Build Notion page content blocks for a workflow
 */
function buildPageContent(
	workflow: WorkflowCatalogItem,
	options: { includeWalkthrough: boolean; includeScreenshots: boolean }
): any[] {
	const blocks: any[] = [];

	// Header callout with tagline
	if (workflow.tagline) {
		blocks.push({
			object: 'block',
			type: 'callout',
			callout: {
				rich_text: [{ text: { content: workflow.tagline } }],
				icon: { emoji: '✨' },
				color: 'blue_background',
			},
		});
	}

	// Install button (as bookmark)
	blocks.push({
		object: 'block',
		type: 'bookmark',
		bookmark: {
			url: `${WORKWAY_WEB_URL}/workflows/${workflow.id}`,
			caption: [{ text: { content: 'Install this workflow on WORKWAY' } }],
		},
	});

	// Divider
	blocks.push({ object: 'block', type: 'divider', divider: {} });

	// Description section
	if (workflow.description) {
		blocks.push({
			object: 'block',
			type: 'heading_2',
			heading_2: {
				rich_text: [{ text: { content: 'About' } }],
			},
		});

		// Split description into paragraphs
		const paragraphs = workflow.description.split('\n\n').filter((p) => p.trim());
		for (const para of paragraphs.slice(0, 5)) {
			// Limit to 5 paragraphs
			blocks.push({
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{ text: { content: para.slice(0, 2000) } }],
				},
			});
		}
	}

	// Integrations section
	if (workflow.required_oauth_providers && workflow.required_oauth_providers.length > 0) {
		blocks.push({
			object: 'block',
			type: 'heading_2',
			heading_2: {
				rich_text: [{ text: { content: 'Required Integrations' } }],
			},
		});

		for (const integration of workflow.required_oauth_providers) {
			blocks.push({
				object: 'block',
				type: 'bulleted_list_item',
				bulleted_list_item: {
					rich_text: [{ text: { content: integration } }],
				},
			});
		}
	}

	// Pricing section
	blocks.push({
		object: 'block',
		type: 'heading_2',
		heading_2: {
			rich_text: [{ text: { content: 'Pricing' } }],
		},
	});

	const pricingText = formatPricing(workflow);
	blocks.push({
		object: 'block',
		type: 'paragraph',
		paragraph: {
			rich_text: [{ text: { content: pricingText } }],
		},
	});

	// Walkthrough section (if enabled and available)
	if (options.includeWalkthrough && workflow.walkthrough?.scenes?.length) {
		blocks.push({ object: 'block', type: 'divider', divider: {} });

		blocks.push({
			object: 'block',
			type: 'heading_2',
			heading_2: {
				rich_text: [{ text: { content: 'How It Works' } }],
			},
		});

		for (const scene of workflow.walkthrough.scenes) {
			// Scene title as toggle
			blocks.push({
				object: 'block',
				type: 'toggle',
				toggle: {
					rich_text: [{ text: { content: scene.title } }],
					children: [
						{
							object: 'block',
							type: 'paragraph',
							paragraph: {
								rich_text: [{ text: { content: scene.text.slice(0, 2000) } }],
							},
						},
					],
				},
			});
		}
	}

	// Screenshots section (if enabled and available)
	if (options.includeScreenshots && workflow.screenshots?.length) {
		blocks.push({ object: 'block', type: 'divider', divider: {} });

		blocks.push({
			object: 'block',
			type: 'heading_2',
			heading_2: {
				rich_text: [{ text: { content: 'Screenshots' } }],
			},
		});

		// Add screenshots as images (up to 5)
		for (const screenshotUrl of workflow.screenshots.slice(0, 5)) {
			blocks.push({
				object: 'block',
				type: 'image',
				image: {
					type: 'external',
					external: { url: screenshotUrl },
				},
			});
		}
	}

	// Footer with stats
	if (workflow.average_rating || workflow.install_count) {
		blocks.push({ object: 'block', type: 'divider', divider: {} });

		const statsText = formatStats(workflow);
		blocks.push({
			object: 'block',
			type: 'paragraph',
			paragraph: {
				rich_text: [
					{
						text: { content: statsText },
						annotations: { color: 'gray' },
					},
				],
			},
		});
	}

	return blocks;
}

/**
 * Format pricing information for display
 */
function formatPricing(workflow: WorkflowCatalogItem): string {
	switch (workflow.pricing_model) {
		case 'free':
			return 'Free to use';
		case 'freemium':
			if (workflow.free_executions) {
				return `${workflow.free_executions} free executions included, then usage-based pricing`;
			}
			return 'Free tier available with paid options';
		case 'subscription':
			if (workflow.base_price) {
				return `$${workflow.base_price}/month`;
			}
			return 'Monthly subscription';
		case 'usage':
			if (workflow.base_price) {
				return `$${workflow.base_price} per execution`;
			}
			return 'Pay per execution';
		case 'one-time':
			if (workflow.base_price) {
				return `$${workflow.base_price} one-time purchase`;
			}
			return 'One-time purchase';
		default:
			return 'Contact for pricing';
	}
}

/**
 * Format stats for display
 */
function formatStats(workflow: WorkflowCatalogItem): string {
	const parts: string[] = [];

	if (workflow.average_rating !== undefined) {
		const stars = '⭐'.repeat(Math.round(workflow.average_rating));
		parts.push(`${stars} ${workflow.average_rating.toFixed(1)}`);
	}

	if (workflow.install_count !== undefined) {
		const count = workflow.install_count >= 1000
			? `${(workflow.install_count / 1000).toFixed(1)}k`
			: workflow.install_count.toString();
		parts.push(`${count} installs`);
	}

	if (workflow.review_count !== undefined) {
		parts.push(`${workflow.review_count} reviews`);
	}

	return parts.join(' • ');
}

// ============================================================================
// METADATA
// ============================================================================

export const metadata = {
	id: 'catalog-to-notion',
	category: 'productivity',
	featured: false,

	visibility: 'public' as const,

	// Official WORKWAY workflow
	developerId: 'dev_workway_official',

	// Flags
	experimental: false,
	requiresCustomInfrastructure: false,

	stats: { rating: 0, users: 0, reviews: 0 },
};
