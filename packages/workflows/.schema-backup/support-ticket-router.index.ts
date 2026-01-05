/**
 * Smart Support Ticket Router
 *
 * AI categorizes support tickets and routes them automatically.
 * Demonstrates AI + Slack integration.
 *
 * Integrations: Slack, Workers AI
 * Trigger: Slack message in support channel
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Smart Support Ticket Router',
	description: 'AI categorizes support tickets and routes them automatically',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_tickets_arrive',

		outcomeStatement: {
			suggestion: 'Route support tickets automatically?',
			explanation: 'When messages arrive in your support channel, AI categorizes them and routes to the right team.',
			outcome: 'Tickets routed to the right team',
		},

		primaryPair: {
			from: 'slack',
			to: 'slack',
			workflowId: 'support-ticket-router',
			outcome: 'Support tickets that route themselves',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['slack'],
				workflowId: 'support-ticket-router',
				priority: 60, // Lower priority - requires specific use case
			},
			{
				trigger: 'pattern_detected',
				integrations: ['slack'],
				workflowId: 'support-ticket-router',
				priority: 90,
				pattern: {
					action: 'manual_message_forwarding',
					threshold: 5,
					period: 'week',
				},
			},
		],

		smartDefaults: {
			urgencyThreshold: { value: 'critical' },
		},

		essentialFields: ['supportChannel'],

		zuhandenheit: {
			timeToValue: 3,
			worksOutOfBox: false, // Requires routing channel setup
			gracefulDegradation: false,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 19,
		trialDays: 7,
		description: 'Includes AI processing for unlimited tickets',
	},

	integrations: [
		{ service: 'slack', scopes: ['read_messages', 'send_messages', 'reactions'] },
	],

	inputs: {
		supportChannel: {
			type: 'text',
			label: 'Support Intake Channel',
			required: true,
			description: 'Channel where support requests come in',
		},
		routingChannels: {
			type: 'object',
			label: 'Routing Channels',
			properties: {
				billing: { type: 'text', label: 'Billing Issues' },
				technical: { type: 'text', label: 'Technical Support' },
				sales: { type: 'text', label: 'Sales Questions' },
				general: { type: 'text', label: 'General Inquiries' },
			},
		},
		urgencyThreshold: {
			type: 'select',
			label: 'Auto-escalate Urgency',
			options: ['high', 'critical', 'never'],
			default: 'critical',
		},
	},

	trigger: webhook({
		service: 'slack',
		event: 'message.received',
		filter: { channel: '{{inputs.supportChannel}}' },
	}),

	async execute({ trigger, inputs, integrations, env, storage }) {
		const message = trigger.data;

		// Skip bot messages and thread replies
		if (message.bot_id || message.thread_ts) {
			return { success: true, skipped: true, reason: 'Bot or thread message' };
		}

		// Extract unique identifier for idempotency check
		// Slack uses a combination of channel + timestamp as unique identifier
		const messageId = `${message.channel}:${message.ts}`;
		if (!message.ts) {
			return { success: false, error: 'Missing message timestamp in Slack event' };
		}

		// Idempotency check: verify this message hasn't already been processed
		// This prevents duplicate ticket routing when Slack retries webhook delivery
		const processedKey = `processed:slack:${messageId}`;
		const alreadyProcessed = await storage.get(processedKey);

		if (alreadyProcessed) {
			return {
				success: true,
				skipped: true,
				reason: 'Message already processed (idempotency check)',
				messageId,
			};
		}

		// AI Classification
		const classification = await integrations.ai.generateText({
			model: AIModels.LLAMA_3_8B,
			system: `You are a support ticket classifier. Analyze the message and return JSON:
{
  "category": "billing" | "technical" | "sales" | "general",
  "urgency": "low" | "medium" | "high" | "critical",
  "summary": "one sentence summary",
  "suggestedResponse": "brief suggested response"
}`,
			prompt: `Classify this support message:\n\n${message.text}`,
			temperature: 0.3,
			max_tokens: 200,
		});

		let parsed;
		try {
			parsed = JSON.parse(classification.data?.response || '{}');
		} catch {
			parsed = { category: 'general', urgency: 'medium', summary: 'Unable to classify' };
		}

		const { category, urgency, summary, suggestedResponse } = parsed;

		// Determine target channel
		const targetChannel = inputs.routingChannels[category] || inputs.routingChannels.general;

		// Add reaction to original message
		const urgencyEmoji = {
			low: 'white_circle',
			medium: 'large_blue_circle',
			high: 'large_orange_circle',
			critical: 'red_circle',
		};

		await integrations.slack.reactions.add({
			channel: message.channel,
			timestamp: message.ts,
			name: urgencyEmoji[urgency] || 'white_circle',
		});

		// Route to appropriate channel
		const routedMessage = await integrations.slack.chat.postMessage({
			channel: targetChannel,
			text: `🎫 New ${category} ticket (${urgency} priority)`,
			blocks: [
				{
					type: 'header',
					text: {
						type: 'plain_text',
						text: `🎫 ${category.charAt(0).toUpperCase() + category.slice(1)} Ticket`,
					},
				},
				{
					type: 'section',
					fields: [
						{ type: 'mrkdwn', text: `*Priority:*\n${urgency.toUpperCase()}` },
						{ type: 'mrkdwn', text: `*From:*\n<@${message.user}>` },
					],
				},
				{
					type: 'section',
					text: { type: 'mrkdwn', text: `*Summary:*\n${summary}` },
				},
				{
					type: 'section',
					text: { type: 'mrkdwn', text: `*Original Message:*\n>${message.text.slice(0, 500)}` },
				},
				{
					type: 'section',
					text: { type: 'mrkdwn', text: `*Suggested Response:*\n_${suggestedResponse}_` },
				},
				{
					type: 'actions',
					elements: [
						{
							type: 'button',
							text: { type: 'plain_text', text: 'View Thread' },
							url: `https://slack.com/archives/${message.channel}/p${message.ts.replace('.', '')}`,
						},
						{
							type: 'button',
							text: { type: 'plain_text', text: 'Claim Ticket' },
							action_id: 'claim_ticket',
							style: 'primary',
						},
					],
				},
			],
		});

		// Auto-escalate if configured
		const shouldEscalate =
			(inputs.urgencyThreshold === 'high' && ['high', 'critical'].includes(urgency)) ||
			(inputs.urgencyThreshold === 'critical' && urgency === 'critical');

		if (shouldEscalate) {
			await integrations.slack.chat.postMessage({
				channel: targetChannel,
				thread_ts: routedMessage.data?.ts,
				text: `⚠️ *AUTO-ESCALATED* - This ticket requires immediate attention!`,
			});
		}

		// Mark message as processed for idempotency
		// Store with 30-day TTL to prevent unbounded storage growth
		await storage.set(processedKey, {
			processedAt: new Date().toISOString(),
			category,
			urgency,
		});

		return {
			success: true,
			ticketId: message.ts,
			category,
			urgency,
			routedTo: targetChannel,
			escalated: shouldEscalate,
			summary,
		};
	},
});

export const metadata = {
	id: 'smart-support-ticket-router',
	category: 'communication',
	featured: false,
	stats: { rating: 4.7, users: 678, reviews: 34 },
};
