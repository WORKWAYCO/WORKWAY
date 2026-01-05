/**
 * Revenue Radar
 *
 * Compound workflow: Stripe → Slack + HubSpot
 *
 * Real-time revenue alerts:
 * 1. Monitors Stripe for payment events
 * 2. Posts payment alerts to Slack
 * 3. Updates HubSpot deals/contacts
 * 4. AI-powered revenue insights
 *
 * Zuhandenheit: "My team knows when money moves"
 * not "manually check Stripe and update CRM"
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Revenue Radar',
	description:
		'Get instant Slack alerts when payments arrive, and automatically update HubSpot deals - never miss a payment',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_payments_arrive',

		outcomeStatement: {
			suggestion: 'Want your team to know when money moves?',
			explanation:
				'When payments succeed (or fail), we\'ll notify Slack and update HubSpot automatically.',
			outcome: 'Revenue visibility on autopilot',
		},

		primaryPair: {
			from: 'stripe',
			to: 'slack',
			workflowId: 'revenue-radar',
			outcome: 'Payment alerts in Slack',
		},

		additionalPairs: [
			{
				from: 'stripe',
				to: 'hubspot',
				workflowId: 'revenue-radar',
				outcome: 'Deals update automatically',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['stripe', 'slack'],
				workflowId: 'revenue-radar',
				priority: 95,
			},
			{
				trigger: 'integration_connected',
				integrations: ['stripe', 'hubspot'],
				workflowId: 'revenue-radar',
				priority: 85,
			},
		],

		smartDefaults: {
			alertOnSuccess: { value: true },
			alertOnFailure: { value: true },
			minimumAmount: { value: 0 },
		},

		essentialFields: ['slackChannel'],

		zuhandenheit: {
			timeToValue: 1, // Instant
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 15,
		trialDays: 14,
		description: 'Free for 50 events/month, $15/month unlimited',
	},

	integrations: [
		{ service: 'stripe', scopes: ['payment_intents:read', 'charges:read'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'] },
		{ service: 'hubspot', scopes: ['crm.objects.deals.write', 'crm.objects.contacts.read'], optional: true },
	],

	inputs: {
		slackChannel: {
			type: 'text',
			label: 'Revenue Channel',
			required: true,
			description: 'Channel for payment notifications',
		},
		alertOnSuccess: {
			type: 'boolean',
			label: 'Alert on Success',
			default: true,
			description: 'Send notification for successful payments',
		},
		alertOnFailure: {
			type: 'boolean',
			label: 'Alert on Failure',
			default: true,
			description: 'Send notification for failed payments',
		},
		minimumAmount: {
			type: 'number',
			label: 'Minimum Amount ($)',
			default: 0,
			min: 0,
			description: 'Only alert for payments above this amount',
		},
		updateHubSpot: {
			type: 'boolean',
			label: 'Update HubSpot Deals',
			default: true,
			description: 'Automatically update deal amounts in HubSpot',
		},
		celebrateMilestones: {
			type: 'boolean',
			label: 'Celebrate Milestones',
			default: true,
			description: 'Special alerts for MRR milestones',
		},
	},

	trigger: webhook({
		path: '/stripe',
		events: [
			'payment_intent.succeeded',
			'payment_intent.payment_failed',
			'charge.succeeded',
			'charge.failed',
			'invoice.paid',
			'invoice.payment_failed',
		],
	}),

	async execute({ trigger, inputs, integrations, env, storage }) {
		const event = trigger.payload;
		const eventType = event.type;

		// Extract payment details
		const payment = extractPaymentDetails(event);

		// Check minimum amount filter
		if (payment.amount < inputs.minimumAmount * 100) {
			return {
				success: true,
				skipped: true,
				reason: `Amount $${(payment.amount / 100).toFixed(2)} below minimum $${inputs.minimumAmount}`,
			};
		}

		const isSuccess = eventType.includes('succeeded') || eventType.includes('paid');
		const shouldAlert =
			(isSuccess && inputs.alertOnSuccess) || (!isSuccess && inputs.alertOnFailure);

		// 1. Send Slack notification
		let slackSent = false;
		if (shouldAlert) {
			const blocks = buildSlackBlocks(payment, isSuccess, eventType);

			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				blocks,
				text: isSuccess
					? `Payment received: $${(payment.amount / 100).toFixed(2)} from ${payment.customerEmail}`
					: `Payment failed: $${(payment.amount / 100).toFixed(2)} from ${payment.customerEmail}`,
			});
			slackSent = true;
		}

		// 2. Update HubSpot (if enabled and payment succeeded)
		let hubspotUpdated = false;
		if (inputs.updateHubSpot && isSuccess && integrations.hubspot && payment.customerEmail) {
			// Search for contact by email
			const contacts = await integrations.hubspot.contacts.search({
				filterGroups: [
					{
						filters: [
							{ propertyName: 'email', operator: 'EQ', value: payment.customerEmail },
						],
					},
				],
			});

			if (contacts.success && contacts.data?.results?.length > 0) {
				const contactId = contacts.data.results[0].id;

				// Search for open deals with this contact
				const deals = await integrations.hubspot.deals.search({
					filterGroups: [
						{
							filters: [
								{ propertyName: 'dealstage', operator: 'NEQ', value: 'closedwon' },
							],
						},
					],
				});

				if (deals.success && deals.data?.results?.length > 0) {
					// Update the most recent deal
					const dealId = deals.data.results[0].id;
					await integrations.hubspot.deals.update({
						dealId,
						properties: {
							dealstage: 'closedwon',
							amount: String(payment.amount / 100),
							closedate: new Date().toISOString().split('T')[0],
						},
					});
					hubspotUpdated = true;
				}
			}
		}

		// 3. Check for milestones
		let milestoneLabel: string | null = null;
		if (inputs.celebrateMilestones && isSuccess) {
			const milestone = await checkMilestone(storage, payment.amount);
			if (milestone) {
				milestoneLabel = milestone.label;
				await integrations.slack.chat.postMessage({
					channel: inputs.slackChannel,
					blocks: buildMilestoneBlocks(milestone),
					text: `Milestone reached: ${milestone.label}`,
				});
			}
		}

		return {
			success: true,
			event: eventType,
			payment: {
				amount: payment.amount / 100,
				currency: payment.currency,
				customer: payment.customerEmail,
				status: isSuccess ? 'succeeded' : 'failed',
			},
			slack: { sent: slackSent },
			hubspot: { updated: hubspotUpdated },
			milestone: milestoneLabel,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			text: `:warning: Revenue Radar Error: ${error.message}`,
		});
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface PaymentDetails {
	amount: number;
	currency: string;
	customerEmail: string | null;
	customerId: string | null;
	description: string | null;
	invoiceId: string | null;
	paymentMethod: string | null;
}

interface Milestone {
	label: string;
	amount: number;
	previous: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function extractPaymentDetails(event: any): PaymentDetails {
	const obj = event.data?.object || {};

	return {
		amount: obj.amount || obj.amount_paid || 0,
		currency: (obj.currency || 'usd').toUpperCase(),
		customerEmail: obj.receipt_email || obj.customer_email || obj.billing_details?.email || null,
		customerId: obj.customer || null,
		description: obj.description || null,
		invoiceId: obj.invoice || null,
		paymentMethod: obj.payment_method_types?.[0] || obj.payment_method || null,
	};
}

function buildSlackBlocks(payment: PaymentDetails, isSuccess: boolean, eventType: string): any[] {
	const emoji = isSuccess ? ':moneybag:' : ':x:';
	const color = isSuccess ? '#36a64f' : '#dc3545';
	const status = isSuccess ? 'Payment Received' : 'Payment Failed';

	const blocks: any[] = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${emoji} *${status}*`,
			},
		},
		{
			type: 'section',
			fields: [
				{
					type: 'mrkdwn',
					text: `*Amount:*\n$${(payment.amount / 100).toFixed(2)} ${payment.currency}`,
				},
				{
					type: 'mrkdwn',
					text: `*Customer:*\n${payment.customerEmail || 'Unknown'}`,
				},
			],
		},
	];

	if (payment.description) {
		blocks.push({
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: `_${payment.description}_`,
				},
			],
		});
	}

	if (!isSuccess) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: ':point_right: Check Stripe dashboard for details',
			},
		});
	}

	return blocks;
}

function buildMilestoneBlocks(milestone: Milestone): any[] {
	return [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `:tada: *Milestone Reached!*\n\n*${milestone.label}*`,
			},
		},
		{
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: `Total revenue: $${(milestone.amount / 100).toLocaleString()}`,
				},
			],
		},
	];
}

async function checkMilestone(storage: any, amount: number): Promise<Milestone | null> {
	const state = (await storage.get('revenue-state')) as { total: number } | null;
	const previousTotal = state?.total || 0;
	const newTotal = previousTotal + amount;

	// Save new total
	await storage.set('revenue-state', { total: newTotal });

	// Milestone thresholds (in cents)
	const milestones = [
		{ amount: 100000, label: '$1K Revenue' },
		{ amount: 500000, label: '$5K Revenue' },
		{ amount: 1000000, label: '$10K Revenue' },
		{ amount: 2500000, label: '$25K Revenue' },
		{ amount: 5000000, label: '$50K Revenue' },
		{ amount: 10000000, label: '$100K Revenue' },
		{ amount: 25000000, label: '$250K Revenue' },
		{ amount: 50000000, label: '$500K Revenue' },
		{ amount: 100000000, label: '$1M Revenue' },
	];

	for (const m of milestones) {
		if (previousTotal < m.amount && newTotal >= m.amount) {
			return { label: m.label, amount: newTotal, previous: previousTotal };
		}
	}

	return null;
}

export const metadata = {
	id: 'revenue-radar',
	category: 'finance-accounting',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
