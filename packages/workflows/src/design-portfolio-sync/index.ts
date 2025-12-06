/**
 * Design Portfolio Sync
 *
 * Compound workflow: Dribbble → Notion + Slack
 *
 * Automates design portfolio management:
 * 1. Syncs Dribbble shots to Notion database
 * 2. Announces new shots in Slack
 * 3. Keeps portfolio page updated automatically
 *
 * Zuhandenheit: "My portfolio updates itself"
 * not "manually add each shot to Notion and post to Slack"
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';
import { Dribbble } from '@workwayco/integrations';

export default defineWorkflow({
	name: 'Design Portfolio Sync',
	description:
		'Automatically sync your Dribbble shots to Notion and announce new work in Slack - your portfolio updates itself',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'after_publishing',

		outcomeStatement: {
			suggestion: 'Want your portfolio to update itself?',
			explanation:
				"When you publish a new shot on Dribbble, we'll add it to your Notion portfolio and announce it in Slack.",
			outcome: 'Portfolio on autopilot',
		},

		primaryPair: {
			from: 'dribbble',
			to: 'notion',
			workflowId: 'design-portfolio-sync',
			outcome: 'Shots sync to Notion automatically',
		},

		additionalPairs: [
			{
				from: 'dribbble',
				to: 'slack',
				workflowId: 'design-portfolio-sync',
				outcome: 'New work announced in Slack',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['dribbble', 'notion'],
				workflowId: 'design-portfolio-sync',
				priority: 85,
			},
			{
				trigger: 'integration_connected',
				integrations: ['dribbble'],
				workflowId: 'design-portfolio-sync',
				priority: 70,
			},
		],

		smartDefaults: {
			syncOnSchedule: { value: true },
			announceInSlack: { value: true },
		},

		essentialFields: ['notionDatabaseId'],

		zuhandenheit: {
			timeToValue: 60, // First sync within an hour
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 8,
		trialDays: 14,
		description: 'Free for 10 shots/month, $8/month unlimited',
	},

	integrations: [
		{ service: 'dribbble', scopes: ['public'] },
		{ service: 'notion', scopes: ['insert_content', 'read_content'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'], optional: true },
	],

	inputs: {
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Portfolio Database',
			required: true,
			description: 'Notion database for your design portfolio',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Announcement Channel',
			required: false,
			description: 'Optional: Channel to announce new shots',
		},
		syncLimit: {
			type: 'number',
			label: 'Shots to Sync',
			default: 12,
			min: 1,
			max: 100,
			description: 'Maximum number of recent shots to sync',
		},
		includeAnimated: {
			type: 'boolean',
			label: 'Include Animated',
			default: true,
			description: 'Include animated shots (GIFs/videos)',
		},
		tagFilter: {
			type: 'text',
			label: 'Tag Filter',
			required: false,
			description: 'Only sync shots with this tag (leave empty for all)',
		},
		notifyNewOnly: {
			type: 'boolean',
			label: 'Notify New Shots Only',
			default: true,
			description: 'Only post to Slack for newly synced shots',
		},
	},

	trigger: schedule({
		cron: '0 */6 * * *', // Every 6 hours
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, env, storage }) {
		// Get last sync state
		const lastSync = (await storage.get('last-sync')) as SyncState | null;
		const syncedShotIds = new Set(lastSync?.syncedIds || []);
		const newShots: SyncedShot[] = [];

		// 1. Fetch shots from Dribbble
		const dribbble = new Dribbble({
			accessToken: integrations.dribbble.accessToken,
		});

		const shotsResult = await dribbble.listShots({
			perPage: inputs.syncLimit,
		});

		if (!shotsResult.success || !shotsResult.data) {
			return { success: false, error: 'Failed to fetch Dribbble shots' };
		}

		const shots = shotsResult.data;

		// Filter shots
		let filteredShots = shots;
		if (!inputs.includeAnimated) {
			filteredShots = filteredShots.filter((shot) => !shot.animated);
		}
		if (inputs.tagFilter) {
			const tagLower = inputs.tagFilter.toLowerCase();
			filteredShots = filteredShots.filter((shot) =>
				shot.tags.some((tag) => tag.toLowerCase().includes(tagLower))
			);
		}

		// 2. Sync to Notion
		for (const shot of filteredShots) {
			const isNew = !syncedShotIds.has(shot.id);

			// Check if page already exists
			const existingPages = await integrations.notion.databases.query({
				database_id: inputs.notionDatabaseId,
				filter: {
					property: 'Dribbble ID',
					number: { equals: shot.id },
				},
			});

			const details = Dribbble.extractShotDetails(shot);

			if (existingPages.success && existingPages.data?.results?.length > 0) {
				// Update existing page
				const pageId = existingPages.data.results[0].id;
				await integrations.notion.pages.update({
					page_id: pageId,
					properties: buildNotionProperties(shot, details),
				});
			} else {
				// Create new page
				await integrations.notion.pages.create({
					parent: { database_id: inputs.notionDatabaseId },
					properties: buildNotionProperties(shot, details),
					cover: {
						type: 'external',
						external: { url: details.hdImageUrl || details.imageUrl },
					},
					children: buildNotionContent(shot, details),
				});

				if (isNew) {
					newShots.push({
						id: shot.id,
						title: shot.title,
						url: shot.html_url,
						imageUrl: details.imageUrl,
						tags: shot.tags,
					});
				}
			}

			syncedShotIds.add(shot.id);
		}

		// 3. Announce new shots in Slack (optional)
		let slackNotified = 0;
		if (inputs.slackChannel && newShots.length > 0 && inputs.notifyNewOnly) {
			for (const shot of newShots.slice(0, 3)) {
				await integrations.slack?.chat.postMessage({
					channel: inputs.slackChannel,
					blocks: buildSlackBlocks(shot),
					text: `New shot published: ${shot.title}`,
					unfurl_links: false,
				});
				slackNotified++;
			}

			if (newShots.length > 3) {
				await integrations.slack?.chat.postMessage({
					channel: inputs.slackChannel,
					text: `...and ${newShots.length - 3} more new shots synced to portfolio`,
				});
			}
		}

		// 4. Save sync state
		await storage.set('last-sync', {
			syncedIds: Array.from(syncedShotIds).slice(-500), // Keep last 500
			lastSyncTime: new Date().toISOString(),
			totalSynced: filteredShots.length,
		});

		return {
			success: true,
			portfolio: {
				synced: filteredShots.length,
				new: newShots.length,
				skipped: shots.length - filteredShots.length,
			},
			notifications: {
				slack: slackNotified,
			},
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack && inputs.slackChannel) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Portfolio Sync Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface SyncState {
	syncedIds: number[];
	lastSyncTime: string;
	totalSynced: number;
}

interface SyncedShot {
	id: number;
	title: string;
	url: string;
	imageUrl: string;
	tags: string[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildNotionProperties(shot: any, details: any): Record<string, any> {
	return {
		Name: {
			title: [{ text: { content: shot.title } }],
		},
		'Dribbble ID': {
			number: shot.id,
		},
		'Dribbble URL': {
			url: shot.html_url,
		},
		Tags: {
			multi_select: shot.tags.slice(0, 10).map((tag: string) => ({ name: tag })),
		},
		'Published Date': {
			date: { start: shot.published_at },
		},
		Animated: {
			checkbox: shot.animated,
		},
		Dimensions: {
			rich_text: [
				{
					text: {
						content: `${details.dimensions.width}x${details.dimensions.height}`,
					},
				},
			],
		},
	};
}

function buildNotionContent(shot: any, details: any): any[] {
	const blocks: any[] = [
		{
			type: 'image',
			image: {
				type: 'external',
				external: { url: details.hdImageUrl || details.imageUrl },
			},
		},
	];

	if (shot.description) {
		blocks.push({
			type: 'paragraph',
			paragraph: {
				rich_text: [
					{
						type: 'text',
						text: {
							content: stripHtml(shot.description).slice(0, 2000),
						},
					},
				],
			},
		});
	}

	if (shot.tags.length > 0) {
		blocks.push({
			type: 'paragraph',
			paragraph: {
				rich_text: [
					{
						type: 'text',
						text: { content: 'Tags: ' },
						annotations: { bold: true },
					},
					{
						type: 'text',
						text: { content: shot.tags.join(', ') },
					},
				],
			},
		});
	}

	blocks.push({
		type: 'bookmark',
		bookmark: { url: shot.html_url },
	});

	return blocks;
}

function buildSlackBlocks(shot: SyncedShot): any[] {
	return [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*New Design Published*\n<${shot.url}|${shot.title}>`,
			},
			accessory: {
				type: 'image',
				image_url: shot.imageUrl,
				alt_text: shot.title,
			},
		},
		{
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: shot.tags.length > 0 ? `Tags: ${shot.tags.slice(0, 5).join(', ')}` : 'No tags',
				},
			],
		},
	];
}

function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.trim();
}

export const metadata = {
	id: 'design-portfolio-sync',
	category: 'productivity-utilities',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
