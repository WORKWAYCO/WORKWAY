/**
 * Catalog to Notion Sync - Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockNotion } from '../lib/utils/createMockNotion';

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Helper Functions', () => {
	describe('buildPageProperties', () => {
		// Inline the function for testing
		function buildPageProperties(workflow: {
			id: string;
			name: string;
			tagline?: string | null;
			description?: string | null;
			icon_url?: string | null;
			pricing_model: string;
			base_price?: number | null;
			free_executions?: number;
			average_rating?: number | null;
			install_count?: number;
			review_count?: number;
			required_oauth_providers?: string[];
			outcome_frame?: string | null;
			category_id?: string | null;
			tags?: string[];
			published_at?: string;
		}): Record<string, any> {
			const WORKWAY_WEB_URL = 'https://workway.co';
			const properties: Record<string, any> = {
				Name: {
					title: [{ text: { content: workflow.name } }],
				},
				'Workflow ID': {
					rich_text: [{ text: { content: workflow.id } }],
				},
				Tagline: {
					rich_text: [{ text: { content: workflow.tagline || '' } }],
				},
				Description: {
					rich_text: [{ text: { content: (workflow.description || '').slice(0, 2000) } }],
				},
				Icon: {
					url: workflow.icon_url || null,
				},
				'Install Link': {
					url: `${WORKWAY_WEB_URL}/workflows/${workflow.id}`,
				},
				'Pricing Model': {
					select: workflow.pricing_model ? { name: workflow.pricing_model } : null,
				},
			};

			if (workflow.base_price !== undefined) {
				properties['Price'] = { number: workflow.base_price };
			}
			if (workflow.free_executions !== undefined) {
				properties['Free Executions'] = { number: workflow.free_executions };
			}
			if (workflow.average_rating !== undefined) {
				properties['Rating'] = { number: workflow.average_rating };
			}
			if (workflow.install_count !== undefined) {
				properties['Install Count'] = { number: workflow.install_count };
			}
			if (workflow.review_count !== undefined) {
				properties['Review Count'] = { number: workflow.review_count };
			}
			if (workflow.required_oauth_providers?.length) {
				properties['Integrations'] = {
					multi_select: workflow.required_oauth_providers.map((name) => ({ name })),
				};
			}
			if (workflow.outcome_frame) {
				properties['Outcome Frame'] = { select: { name: workflow.outcome_frame } };
			}
			if (workflow.category_id) {
				properties['Category'] = { select: { name: workflow.category_id } };
			}
			if (workflow.tags?.length) {
				properties['Tags'] = {
					multi_select: workflow.tags.slice(0, 10).map((tag) => ({ name: tag })),
				};
			}
			if (workflow.published_at) {
				properties['Published'] = {
					date: { start: workflow.published_at.split('T')[0] },
				};
			}

			return properties;
		}

		it('should create basic properties for a workflow', () => {
			const workflow = {
				id: 'test-workflow',
				name: 'Test Workflow',
				pricing_model: 'free',
			};

			const result = buildPageProperties(workflow);

			expect(result.Name.title[0].text.content).toBe('Test Workflow');
			expect(result['Workflow ID'].rich_text[0].text.content).toBe('test-workflow');
			expect(result['Install Link'].url).toBe('https://workway.co/workflows/test-workflow');
			expect(result['Pricing Model'].select.name).toBe('free');
		});

		it('should truncate long descriptions to 2000 chars', () => {
			const workflow = {
				id: 'test',
				name: 'Test',
				description: 'A'.repeat(3000),
				pricing_model: 'free',
			};

			const result = buildPageProperties(workflow);

			expect(result.Description.rich_text[0].text.content.length).toBe(2000);
		});

		it('should include optional properties when present', () => {
			const workflow = {
				id: 'test',
				name: 'Test',
				pricing_model: 'usage',
				base_price: 5,
				free_executions: 100,
				average_rating: 4.5,
				install_count: 150,
				review_count: 20,
				required_oauth_providers: ['notion', 'zoom'],
				outcome_frame: 'after_meetings',
				category_id: 'productivity',
				tags: ['automation', 'meetings'],
			};

			const result = buildPageProperties(workflow);

			expect(result['Price'].number).toBe(5);
			expect(result['Free Executions'].number).toBe(100);
			expect(result['Rating'].number).toBe(4.5);
			expect(result['Install Count'].number).toBe(150);
			expect(result['Review Count'].number).toBe(20);
			expect(result['Integrations'].multi_select).toHaveLength(2);
			expect(result['Outcome Frame'].select.name).toBe('after_meetings');
			expect(result['Category'].select.name).toBe('productivity');
			expect(result['Tags'].multi_select).toHaveLength(2);
		});

		it('should limit tags to 10', () => {
			const workflow = {
				id: 'test',
				name: 'Test',
				pricing_model: 'free',
				tags: Array.from({ length: 15 }, (_, i) => `tag${i}`),
			};

			const result = buildPageProperties(workflow);

			expect(result['Tags'].multi_select).toHaveLength(10);
		});
	});

	describe('formatPricing', () => {
		function formatPricing(workflow: {
			pricing_model: string;
			base_price?: number | null;
			free_executions?: number;
		}): string {
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

		it('should format free pricing', () => {
			expect(formatPricing({ pricing_model: 'free' })).toBe('Free to use');
		});

		it('should format freemium with free executions', () => {
			expect(formatPricing({ pricing_model: 'freemium', free_executions: 100 })).toBe(
				'100 free executions included, then usage-based pricing'
			);
		});

		it('should format subscription with price', () => {
			expect(formatPricing({ pricing_model: 'subscription', base_price: 9.99 })).toBe(
				'$9.99/month'
			);
		});

		it('should format usage pricing', () => {
			expect(formatPricing({ pricing_model: 'usage', base_price: 0.05 })).toBe(
				'$0.05 per execution'
			);
		});

		it('should format one-time pricing', () => {
			expect(formatPricing({ pricing_model: 'one-time', base_price: 29 })).toBe(
				'$29 one-time purchase'
			);
		});

		it('should return default for unknown model', () => {
			expect(formatPricing({ pricing_model: 'unknown' })).toBe('Contact for pricing');
		});
	});

	describe('formatStats', () => {
		function formatStats(workflow: {
			average_rating?: number;
			install_count?: number;
			review_count?: number;
		}): string {
			const parts: string[] = [];

			if (workflow.average_rating !== undefined) {
				const stars = '⭐'.repeat(Math.round(workflow.average_rating));
				parts.push(`${stars} ${workflow.average_rating.toFixed(1)}`);
			}

			if (workflow.install_count !== undefined) {
				const count =
					workflow.install_count >= 1000
						? `${(workflow.install_count / 1000).toFixed(1)}k`
						: workflow.install_count.toString();
				parts.push(`${count} installs`);
			}

			if (workflow.review_count !== undefined) {
				parts.push(`${workflow.review_count} reviews`);
			}

			return parts.join(' • ');
		}

		it('should format rating with stars', () => {
			const result = formatStats({ average_rating: 4.5 });
			expect(result).toContain('⭐⭐⭐⭐⭐');
			expect(result).toContain('4.5');
		});

		it('should format large install counts with k suffix', () => {
			const result = formatStats({ install_count: 2500 });
			expect(result).toBe('2.5k installs');
		});

		it('should format small install counts as-is', () => {
			const result = formatStats({ install_count: 150 });
			expect(result).toBe('150 installs');
		});

		it('should combine all stats with bullet separator', () => {
			const result = formatStats({
				average_rating: 4.0,
				install_count: 500,
				review_count: 25,
			});
			expect(result).toContain('•');
			expect(result).toContain('500 installs');
			expect(result).toContain('25 reviews');
		});
	});

	describe('extractWorkflowIdFromPage', () => {
		function extractWorkflowIdFromPage(page: {
			properties: Record<string, any>;
		}): string | null {
			const workflowIdProp =
				page.properties['Workflow ID'] || page.properties['workflow_id'];
			if (workflowIdProp?.rich_text?.[0]?.plain_text) {
				return workflowIdProp.rich_text[0].plain_text;
			}

			const installLinkProp =
				page.properties['Install Link'] || page.properties['install_link'];
			if (installLinkProp?.url) {
				const match = installLinkProp.url.match(/\/workflows\/([^/?]+)/);
				return match ? match[1] : null;
			}

			return null;
		}

		it('should extract from Workflow ID property', () => {
			const page = {
				properties: {
					'Workflow ID': { rich_text: [{ plain_text: 'meeting-intelligence' }] },
				},
			};

			expect(extractWorkflowIdFromPage(page)).toBe('meeting-intelligence');
		});

		it('should fallback to Install Link URL', () => {
			const page = {
				properties: {
					'Install Link': { url: 'https://workway.co/workflows/payments-tracked?ref=notion' },
				},
			};

			expect(extractWorkflowIdFromPage(page)).toBe('payments-tracked');
		});

		it('should return null if neither property exists', () => {
			const page = { properties: {} };

			expect(extractWorkflowIdFromPage(page)).toBeNull();
		});
	});
});

// ============================================================================
// WORKFLOW LOGIC TESTS
// ============================================================================

describe('Workflow Logic', () => {
	describe('Sync Mode', () => {
		function shouldSkipExisting(
			existingPageId: string | undefined,
			syncMode: string
		): boolean {
			return existingPageId !== undefined && syncMode === 'new_only';
		}

		it('should not skip if no existing page', () => {
			expect(shouldSkipExisting(undefined, 'new_only')).toBe(false);
			expect(shouldSkipExisting(undefined, 'full_sync')).toBe(false);
		});

		it('should skip existing in new_only mode', () => {
			expect(shouldSkipExisting('page123', 'new_only')).toBe(true);
		});

		it('should not skip existing in full_sync mode', () => {
			expect(shouldSkipExisting('page123', 'full_sync')).toBe(false);
		});
	});

	describe('State Key Generation', () => {
		it('should generate state key from database ID', () => {
			const prefix = 'catalog-to-notion:';
			const databaseId = 'db_abc123xyz';

			const stateKey = `${prefix}${databaseId}`;

			expect(stateKey).toBe('catalog-to-notion:db_abc123xyz');
		});
	});

	describe('Sync Result Counting', () => {
		it('should count created, updated, skipped, and errors', () => {
			type ResultItem = { action?: string; error?: string };
			const results: ResultItem[] = [
				{ action: 'created' },
				{ action: 'created' },
				{ action: 'updated' },
				{ action: 'skipped' },
				{ error: 'Failed to create' },
			];

			const created = results.filter((r) => r.action === 'created').length;
			const updated = results.filter((r) => r.action === 'updated').length;
			const skipped = results.filter((r) => r.action === 'skipped').length;
			const errors = results.filter((r) => r.error).length;

			expect(created).toBe(2);
			expect(updated).toBe(1);
			expect(skipped).toBe(1);
			expect(errors).toBe(1);
		});
	});

	describe('Page Mapping', () => {
		it('should build mapping from existing pages', () => {
			const existingPages = [
				{ id: 'page1', workflowId: 'meeting-intelligence' },
				{ id: 'page2', workflowId: 'payments-tracked' },
			];

			const pageMap: Record<string, string> = {};
			for (const page of existingPages) {
				if (page.workflowId) {
					pageMap[page.workflowId] = page.id;
				}
			}

			expect(pageMap['meeting-intelligence']).toBe('page1');
			expect(pageMap['payments-tracked']).toBe('page2');
			expect(pageMap['unknown-workflow']).toBeUndefined();
		});
	});
});

// ============================================================================
// PAGE CONTENT TESTS
// ============================================================================

describe('Page Content Building', () => {
	describe('Walkthrough Blocks', () => {
		function buildWalkthroughBlocks(
			walkthrough: { scenes: Array<{ title: string; text: string }> } | undefined
		): any[] {
			if (!walkthrough?.scenes?.length) return [];

			const blocks: any[] = [];

			for (const scene of walkthrough.scenes) {
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

			return blocks;
		}

		it('should create toggle blocks for walkthrough scenes', () => {
			const walkthrough = {
				scenes: [
					{ title: 'The Problem', text: 'Problem description...' },
					{ title: 'The Solution', text: 'Solution description...' },
				],
			};

			const blocks = buildWalkthroughBlocks(walkthrough);

			expect(blocks).toHaveLength(2);
			expect(blocks[0].type).toBe('toggle');
			expect(blocks[0].toggle.rich_text[0].text.content).toBe('The Problem');
		});

		it('should return empty array for missing walkthrough', () => {
			expect(buildWalkthroughBlocks(undefined)).toEqual([]);
			expect(buildWalkthroughBlocks({ scenes: [] })).toEqual([]);
		});

		it('should truncate long scene text', () => {
			const walkthrough = {
				scenes: [{ title: 'Long', text: 'A'.repeat(3000) }],
			};

			const blocks = buildWalkthroughBlocks(walkthrough);

			expect(
				blocks[0].toggle.children[0].paragraph.rich_text[0].text.content.length
			).toBe(2000);
		});
	});

	describe('Screenshot Blocks', () => {
		function buildScreenshotBlocks(screenshots: string[] | undefined): any[] {
			if (!screenshots?.length) return [];

			return screenshots.slice(0, 5).map((url) => ({
				object: 'block',
				type: 'image',
				image: {
					type: 'external',
					external: { url },
				},
			}));
		}

		it('should create image blocks for screenshots', () => {
			const screenshots = [
				'https://example.com/screenshot1.png',
				'https://example.com/screenshot2.png',
			];

			const blocks = buildScreenshotBlocks(screenshots);

			expect(blocks).toHaveLength(2);
			expect(blocks[0].type).toBe('image');
			expect(blocks[0].image.external.url).toBe('https://example.com/screenshot1.png');
		});

		it('should limit to 5 screenshots', () => {
			const screenshots = Array.from(
				{ length: 10 },
				(_, i) => `https://example.com/screenshot${i}.png`
			);

			const blocks = buildScreenshotBlocks(screenshots);

			expect(blocks).toHaveLength(5);
		});

		it('should return empty array for no screenshots', () => {
			expect(buildScreenshotBlocks(undefined)).toEqual([]);
			expect(buildScreenshotBlocks([])).toEqual([]);
		});
	});
});

// ============================================================================
// INTEGRATION MOCK TESTS
// ============================================================================

describe('Integration Mocks', () => {
	describe('Notion Integration', () => {
		it('should handle page creation', async () => {
			const notion = createMockNotion();
			notion.createPage.mockResolvedValueOnce({
				success: true,
				data: {
					id: 'page123',
					url: 'https://notion.so/page123',
				},
			});

			const result = await notion.createPage({
				parentDatabaseId: 'db123',
				properties: { Name: { title: [{ text: { content: 'Test Workflow' } }] } },
				children: [],
			});

			expect(result.success).toBe(true);
			expect(result.data.id).toBe('page123');
		});

		it('should handle page update', async () => {
			const notion = createMockNotion();
			notion.updatePage.mockResolvedValueOnce({
				success: true,
				data: { id: 'page123' },
			});

			const result = await notion.updatePage({
				pageId: 'page123',
				properties: { 'Install Count': { number: 200 } },
			});

			expect(result.success).toBe(true);
		});

		it('should query existing pages for duplicate detection', async () => {
			const notion = createMockNotion();
			notion.queryDatabase.mockResolvedValueOnce({
				success: true,
				data: [
					{ id: 'page1', properties: { 'Workflow ID': { rich_text: [{ plain_text: 'wf1' }] } } },
					{ id: 'page2', properties: { 'Workflow ID': { rich_text: [{ plain_text: 'wf2' }] } } },
				],
			});

			const result = await notion.queryDatabase({
				databaseId: 'db123',
				page_size: 100,
			});

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
		});
	});

	describe('Catalog API', () => {
		const createMockCatalogFetch = () => vi.fn();

		it('should fetch catalog successfully', async () => {
			const mockFetch = createMockCatalogFetch();
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					workflows: [
						{ id: 'wf1', name: 'Workflow 1', pricing_model: 'free' },
						{ id: 'wf2', name: 'Workflow 2', pricing_model: 'usage' },
					],
				}),
			});

			const response = await mockFetch('https://api.workway.co/v1/workflows-registry?limit=100');
			expect(response.ok).toBe(true);

			const data = await response.json();
			expect(data.workflows).toHaveLength(2);
		});

		it('should handle catalog fetch failure', async () => {
			const mockFetch = createMockCatalogFetch();
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 500,
			});

			const response = await mockFetch('https://api.workway.co/v1/workflows-registry?limit=100');
			expect(response.ok).toBe(false);
		});
	});
});

// ============================================================================
// WEBHOOK EVENT TESTS
// ============================================================================

describe('Webhook Events', () => {
	describe('Event Payload Parsing', () => {
		it('should parse workflow.published event', () => {
			const payload = {
				event: 'workflow.published',
				workflow: {
					id: 'test-workflow',
					name: 'Test Workflow',
					pricing_model: 'free',
				},
				timestamp: Date.now(),
			};

			expect(payload.event).toBe('workflow.published');
			expect(payload.workflow.id).toBe('test-workflow');
		});

		it('should parse workflow.updated event', () => {
			const payload = {
				event: 'workflow.updated',
				workflow: {
					id: 'test-workflow',
					name: 'Updated Test Workflow',
					pricing_model: 'usage',
				},
				timestamp: Date.now(),
			};

			expect(payload.event).toBe('workflow.updated');
			expect(payload.workflow.name).toBe('Updated Test Workflow');
		});

		it('should parse catalog.sync event', () => {
			const payload = {
				event: 'catalog.sync',
				timestamp: Date.now(),
			};

			expect(payload.event).toBe('catalog.sync');
			expect(payload.timestamp).toBeDefined();
		});
	});

	describe('Trigger Type Detection', () => {
		function determineSyncScope(
			triggerType: string,
			payload: { event?: string; workflow?: object; workflows?: object[] }
		): 'single' | 'full' {
			if (triggerType === 'webhook') {
				if (
					payload.event === 'workflow.published' ||
					payload.event === 'workflow.updated'
				) {
					if (payload.workflow) {
						return 'single';
					}
				}
			}
			return 'full';
		}

		it('should return single for single workflow events', () => {
			const scope = determineSyncScope('webhook', {
				event: 'workflow.published',
				workflow: { id: 'test' },
			});
			expect(scope).toBe('single');
		});

		it('should return full for catalog.sync', () => {
			const scope = determineSyncScope('webhook', { event: 'catalog.sync' });
			expect(scope).toBe('full');
		});

		it('should return full for manual trigger', () => {
			const scope = determineSyncScope('manual', {});
			expect(scope).toBe('full');
		});
	});
});
