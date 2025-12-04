/**
 * Stripe to Notion Invoice Tracker
 *
 * Automatically logs all Stripe payments to your Notion database.
 * Featured template - high demand, production-ready.
 *
 * Integrations: Stripe, Notion
 * Trigger: Stripe webhook (payment_intent.succeeded)
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Stripe to Notion Invoice Tracker',
	description: 'Automatically log all Stripe payments to your Notion database',
	version: '1.0.0',

	pricing: {
		model: 'freemium',
		pricePerMonth: 9,
		trialDays: 14,
		description: 'Free for first 100 payments/month, then $9/month',
	},

	integrations: [
		{ service: 'stripe', scopes: ['read_payments', 'webhooks'] },
		{ service: 'notion', scopes: ['write_pages', 'read_databases'] },
	],

	inputs: {
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Notion Database for Payments',
			required: true,
			description: 'Select the database where payments will be logged',
		},
		includeRefunds: {
			type: 'boolean',
			label: 'Track Refunds',
			default: true,
			description: 'Also log refunds to the database',
		},
		currencyFormat: {
			type: 'select',
			label: 'Currency Display',
			options: ['symbol', 'code', 'both'],
			default: 'symbol',
		},
	},

	trigger: webhook({
		service: 'stripe',
		events: ['payment_intent.succeeded', 'charge.refunded'],
	}),

	async execute({ trigger, inputs, integrations }) {
		const event = trigger.data;
		const isRefund = event.type === 'charge.refunded';

		// Skip refunds if not configured
		if (isRefund && !inputs.includeRefunds) {
			return { success: true, skipped: true, reason: 'Refunds disabled' };
		}

		// Extract payment details
		const paymentData = isRefund ? event.data.object : event.data.object;
		const amount = paymentData.amount / 100; // Convert from cents
		const currency = paymentData.currency.toUpperCase();

		// Format currency display
		const currencySymbols: Record<string, string> = {
			USD: '$',
			EUR: '€',
			GBP: '£',
			JPY: '¥',
		};
		const symbol = currencySymbols[currency] || currency;
		let displayAmount: string;
		switch (inputs.currencyFormat) {
			case 'symbol':
				displayAmount = `${symbol}${amount.toFixed(2)}`;
				break;
			case 'code':
				displayAmount = `${amount.toFixed(2)} ${currency}`;
				break;
			default:
				displayAmount = `${symbol}${amount.toFixed(2)} ${currency}`;
		}

		// Get customer details if available
		let customerEmail = 'Unknown';
		let customerName = 'Unknown';
		if (paymentData.customer) {
			const customer = await integrations.stripe.customers.retrieve({
				customerId: paymentData.customer,
			});
			if (customer.success) {
				customerEmail = customer.data.email || 'Unknown';
				customerName = customer.data.name || 'Unknown';
			}
		}

		// Create Notion page
		const notionPage = await integrations.notion.pages.create({
			parent: { database_id: inputs.notionDatabaseId },
			properties: {
				Name: {
					title: [
						{
							text: {
								content: `${isRefund ? '🔄 Refund' : '💰 Payment'}: ${displayAmount}`,
							},
						},
					],
				},
				Amount: {
					number: isRefund ? -amount : amount,
				},
				Currency: {
					select: { name: currency },
				},
				Status: {
					select: { name: isRefund ? 'Refunded' : 'Completed' },
				},
				Customer: {
					email: customerEmail,
				},
				'Customer Name': {
					rich_text: [{ text: { content: customerName } }],
				},
				'Payment ID': {
					rich_text: [{ text: { content: paymentData.id } }],
				},
				Date: {
					date: { start: new Date(paymentData.created * 1000).toISOString() },
				},
				Source: {
					select: { name: 'Stripe' },
				},
			},
		});

		if (!notionPage.success) {
			throw new Error(`Failed to create Notion page: ${notionPage.error?.message}`);
		}

		return {
			success: true,
			paymentId: paymentData.id,
			notionPageId: notionPage.data.id,
			notionUrl: notionPage.data.url,
			amount: displayAmount,
			type: isRefund ? 'refund' : 'payment',
			customer: { email: customerEmail, name: customerName },
		};
	},

	onError: async ({ error, trigger }) => {
		console.error('Stripe to Notion sync failed:', error.message);
		console.error('Event:', trigger.data.type, trigger.data.id);
	},
});

export const metadata = {
	id: 'stripe-to-notion-invoice',
	category: 'productivity',
	featured: true,
	stats: { rating: 4.9, users: 1247, reviews: 89 },
};
