/**
 * Deal Tracker
 *
 * Workflow: HubSpot → Slack + Notion
 *
 * Real-time deal updates:
 * 1. Monitors HubSpot for deal stage changes
 * 2. Posts updates to Slack
 * 3. Logs deal history to Notion
 * 4. Celebrates closed deals
 *
 * Zuhandenheit: "My team knows where deals stand"
 * not "manually report deal progress in meetings"
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Deal Tracker',
	description:
		'Get instant Slack alerts when deals move stages, and automatically log deal history to Notion',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_deals_progress',

		outcomeStatement: {
			suggestion: 'Want your team to know where deals stand?',
			explanation:
				'When deals move stages in HubSpot, we\'ll notify Slack and log the change to Notion.',
			outcome: 'Deal visibility on autopilot',
		},

		primaryPair: {
			from: 'hubspot',
			to: 'slack',
			workflowId: 'deal-tracker',
			outcome: 'Deal alerts in Slack',
		},

		additionalPairs: [
			{
				from: 'hubspot',
				to: 'notion',
				workflowId: 'deal-tracker',
				outcome: 'Deal history in Notion',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['hubspot', 'slack'],
				workflowId: 'deal-tracker',
				priority: 90,
			},
		],

		smartDefaults: {
			celebrateWins: { value: true },
			trackLostDeals: { value: true },
		},

		essentialFields: ['slackChannel'],

		zuhandenheit: {
			timeToValue: 60,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 15,
		trialDays: 14,
		description: 'Free for 20 deals/month, $15/month unlimited',
	},

	integrations: [
		{ service: 'hubspot', scopes: ['crm.objects.deals.read'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'] },
		{ service: 'notion', scopes: ['insert_content'], optional: true },
	],

	inputs: {
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Sales Channel',
			required: true,
			description: 'Channel for deal updates',
		},
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Deal History Database',
			required: false,
			description: 'Optional: Log deal changes to Notion',
		},
		celebrateWins: {
			type: 'boolean',
			label: 'Celebrate Wins',
			default: true,
			description: 'Special celebration for closed-won deals',
		},
		trackLostDeals: {
			type: 'boolean',
			label: 'Track Lost Deals',
			default: true,
			description: 'Notify when deals are lost',
		},
		minimumDealAmount: {
			type: 'number',
			label: 'Minimum Deal Amount ($)',
			default: 0,
			min: 0,
			description: 'Only track deals above this amount',
		},
	},

	trigger: schedule({
		cron: '*/15 * * * *', // Every 15 minutes
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, storage }) {
		// Get last check state
		const lastCheck = (await storage.get('last-check')) as {
			timestamp: string;
			dealStates: Record<string, string>;
		} | null;

		const previousDealStates = lastCheck?.dealStates || {};
		const currentDealStates: Record<string, string> = {};
		const changedDeals: DealChange[] = [];

		// Fetch recent deals from HubSpot
		const dealsResult = await integrations.hubspot.deals.list({
			limit: 100,
			properties: ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id'],
			sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
		});

		if (!dealsResult.success || !dealsResult.data?.results) {
			return { success: false, error: 'Failed to fetch HubSpot deals' };
		}

		const deals = dealsResult.data.results;

		// Detect changes
		for (const deal of deals) {
			const dealId = deal.id;
			const currentStage = deal.properties?.dealstage || 'unknown';
			const previousStage = previousDealStates[dealId];
			const amount = parseFloat(deal.properties?.amount || '0');

			currentDealStates[dealId] = currentStage;

			// Skip if below minimum amount
			if (amount < inputs.minimumDealAmount) continue;

			// Check if stage changed
			if (previousStage && previousStage !== currentStage) {
				const isWon = currentStage === 'closedwon';
				const isLost = currentStage === 'closedlost';

				// Skip lost deals if not tracking them
				if (isLost && !inputs.trackLostDeals) continue;

				changedDeals.push({
					id: dealId,
					name: deal.properties?.dealname || 'Unnamed Deal',
					amount,
					previousStage,
					currentStage,
					isWon,
					isLost,
				});
			}
		}

		// Process changed deals
		let slackNotifications = 0;
		let notionEntries = 0;

		for (const deal of changedDeals) {
			// 1. Send Slack notification
			const blocks = buildSlackBlocks(deal, inputs.celebrateWins);
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				blocks,
				text: deal.isWon
					? `Deal won: ${deal.name} ($${deal.amount.toLocaleString()})`
					: `Deal moved: ${deal.name}`,
			});
			slackNotifications++;

			// 2. Log to Notion (if configured)
			if (inputs.notionDatabaseId && integrations.notion) {
				await integrations.notion.pages.create({
					parent: { database_id: inputs.notionDatabaseId },
					properties: buildNotionProperties(deal),
				});
				notionEntries++;
			}
		}

		// Save current state
		await storage.set('last-check', {
			timestamp: new Date().toISOString(),
			dealStates: currentDealStates,
		});

		return {
			success: true,
			checked: deals.length,
			changes: changedDeals.length,
			notifications: {
				slack: slackNotifications,
				notion: notionEntries,
			},
			wins: changedDeals.filter((d) => d.isWon).length,
			losses: changedDeals.filter((d) => d.isLost).length,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			text: `:warning: Deal Tracker Error: ${error.message}`,
		});
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface DealChange {
	id: string;
	name: string;
	amount: number;
	previousStage: string;
	currentStage: string;
	isWon: boolean;
	isLost: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getStageLabel(stage: string): string {
	const labels: Record<string, string> = {
		appointmentscheduled: 'Appointment Scheduled',
		qualifiedtobuy: 'Qualified to Buy',
		presentationscheduled: 'Presentation Scheduled',
		decisionmakerboughtin: 'Decision Maker Bought-In',
		contractsent: 'Contract Sent',
		closedwon: 'Closed Won',
		closedlost: 'Closed Lost',
	};
	return labels[stage] || stage.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function getStageEmoji(stage: string, isWon: boolean, isLost: boolean): string {
	if (isWon) return ':tada:';
	if (isLost) return ':disappointed:';

	const emojis: Record<string, string> = {
		appointmentscheduled: ':calendar:',
		qualifiedtobuy: ':mag:',
		presentationscheduled: ':bar_chart:',
		decisionmakerboughtin: ':handshake:',
		contractsent: ':page_facing_up:',
	};
	return emojis[stage] || ':arrow_right:';
}

function buildSlackBlocks(deal: DealChange, celebrateWins: boolean): any[] {
	const emoji = getStageEmoji(deal.currentStage, deal.isWon, deal.isLost);
	const previousLabel = getStageLabel(deal.previousStage);
	const currentLabel = getStageLabel(deal.currentStage);

	const blocks: any[] = [];

	if (deal.isWon && celebrateWins) {
		// Big celebration for wins
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `:tada: :moneybag: *DEAL WON!* :moneybag: :tada:\n\n*${deal.name}*\n$${deal.amount.toLocaleString()}`,
			},
		});
	} else if (deal.isLost) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${emoji} *Deal Lost*\n*${deal.name}* ($${deal.amount.toLocaleString()})`,
			},
		});
	} else {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${emoji} *Deal Moved*\n*${deal.name}*`,
			},
		});

		blocks.push({
			type: 'section',
			fields: [
				{
					type: 'mrkdwn',
					text: `*From:*\n${previousLabel}`,
				},
				{
					type: 'mrkdwn',
					text: `*To:*\n${currentLabel}`,
				},
				{
					type: 'mrkdwn',
					text: `*Amount:*\n$${deal.amount.toLocaleString()}`,
				},
			],
		});
	}

	return blocks;
}

function buildNotionProperties(deal: DealChange): Record<string, any> {
	return {
		Name: {
			title: [{ text: { content: deal.name } }],
		},
		'Deal ID': {
			rich_text: [{ text: { content: deal.id } }],
		},
		Amount: {
			number: deal.amount,
		},
		'Previous Stage': {
			select: { name: getStageLabel(deal.previousStage) },
		},
		'Current Stage': {
			select: { name: getStageLabel(deal.currentStage) },
		},
		Status: {
			select: { name: deal.isWon ? 'Won' : deal.isLost ? 'Lost' : 'In Progress' },
		},
		'Changed At': {
			date: { start: new Date().toISOString() },
		},
	};
}

export const metadata = {
	id: 'deal-tracker',
	category: 'sales-crm',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
