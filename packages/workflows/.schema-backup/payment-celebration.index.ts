/**
 * Payment Celebration
 *
 * Payments that celebrate themselves.
 *
 * When a payment lands in Stripe, this workflow orchestrates celebration
 * across your entire stack: Slack wins channel, CRM deal closure, thank-you
 * email draft, and optional QuickBooks reconciliation.
 *
 * Zuhandenheit: The mechanism (Stripe API, Slack, HubSpot, Gmail) recedes.
 * What remains: Revenue celebrated, customer thanked, deal closed.
 *
 * Integrations: Stripe, Slack, HubSpot, Gmail, Workers AI
 * Trigger: Stripe webhook (payment_intent.succeeded)
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Payment Celebration',
	description: 'Payments that celebrate themselves across Slack, CRM, and email',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_payments_arrive',

		outcomeStatement: {
			suggestion: 'Let payments celebrate themselves?',
			explanation: 'When payments succeed, we\'ll announce to Slack, close the CRM deal, draft a thank-you email, and keep your team energized—automatically.',
			outcome: 'Payments that celebrate themselves',
		},

		primaryPair: {
			from: 'stripe',
			to: 'slack',
			workflowId: 'payment-celebration',
			outcome: 'Revenue celebrated, customer thanked',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['stripe', 'slack'],
				workflowId: 'payment-celebration',
				priority: 95,
			},
			{
				trigger: 'event_received',
				eventType: 'stripe.payment_intent.succeeded',
				integrations: ['stripe'],
				workflowId: 'payment-celebration',
				priority: 98,
			},
		],

		smartDefaults: {
			celebrateMinimum: { value: 100 },
			includeMRR: { value: true },
			timezone: { inferFrom: 'user_timezone' },
		},

		essentialFields: ['slackChannel'],

		zuhandenheit: {
			timeToValue: 1,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 9,
		trialDays: 14,
		description: 'Free for first 50 celebrations/month',
	},

	integrations: [
		{ service: 'stripe', scopes: ['read_payments', 'read_customers', 'webhooks'] },
		{ service: 'slack', scopes: ['send_messages'] },
		{ service: 'hubspot', scopes: ['read_deals', 'write_deals'], optional: true },
		{ service: 'gmail', scopes: ['create_drafts'], optional: true },
	],

	inputs: {
		slackChannel: {
			type: 'text',
			label: 'Celebration Channel',
			required: true,
			description: 'Slack channel for win announcements (e.g., #wins, #revenue)',
		},
		celebrateMinimum: {
			type: 'number',
			label: 'Minimum Amount to Celebrate ($)',
			default: 100,
			description: 'Only celebrate payments above this amount',
		},
		includeCustomerDetails: {
			type: 'boolean',
			label: 'Include Customer Name',
			default: true,
			description: 'Show customer name in celebrations',
		},
		closeDealInCRM: {
			type: 'boolean',
			label: 'Auto-close HubSpot Deal',
			default: true,
			description: 'Automatically mark associated deal as closed-won',
		},
		draftThankYouEmail: {
			type: 'boolean',
			label: 'Draft Thank-You Email',
			default: true,
			description: 'Create a draft thank-you email in Gmail',
		},
		customCelebrationEmoji: {
			type: 'text',
			label: 'Celebration Emoji',
			default: '🎉',
			description: 'Emoji prefix for celebration messages',
		},
		includeMRR: {
			type: 'boolean',
			label: 'Show Running MRR',
			default: false,
			description: 'Include monthly recurring revenue running total',
		},
		companyName: {
			type: 'text',
			label: 'Your Company Name',
			description: 'Used in thank-you emails',
		},
	},

	trigger: webhook({
		service: 'stripe',
		events: ['payment_intent.succeeded'],
	}),

	async execute({ trigger, inputs, integrations, storage }) {
		const event = trigger.data;
		const paymentIntent = event.data.object as PaymentIntentData;

		// Extract payment details
		const amount = paymentIntent.amount / 100;
		const currency = paymentIntent.currency.toUpperCase();

		// Skip small payments if configured
		if (amount < inputs.celebrateMinimum) {
			return {
				success: true,
				skipped: true,
				reason: `Payment $${amount} below celebration threshold $${inputs.celebrateMinimum}`,
			};
		}

		// Format currency
		const currencySymbols: Record<string, string> = {
			USD: '$',
			EUR: '€',
			GBP: '£',
			JPY: '¥',
			CAD: 'CA$',
			AUD: 'A$',
		};
		const symbol = currencySymbols[currency] || currency + ' ';
		const displayAmount = `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

		// Get customer details
		let customerName = 'Anonymous Customer';
		let customerEmail: string | null = null;
		let customerCompany: string | null = null;

		if (paymentIntent.customer) {
			const customerResult = await integrations.stripe.customers.retrieve({
				customerId: paymentIntent.customer,
			});
			if (customerResult.success && customerResult.data) {
				customerEmail = customerResult.data.email;
				customerName = customerResult.data.name || customerEmail || 'Customer';
				customerCompany = customerResult.data.metadata?.company || null;
			}
		}

		// Track results
		const results: CelebrationResult = {
			paymentId: paymentIntent.id,
			amount: displayAmount,
			customer: inputs.includeCustomerDetails ? customerName : 'A customer',
			actions: [],
		};

		// 1. Slack Celebration
		const celebrationMessage = buildSlackMessage({
			emoji: inputs.customCelebrationEmoji,
			amount: displayAmount,
			customerName: inputs.includeCustomerDetails ? customerName : null,
			customerCompany,
			description: paymentIntent.description,
		});

		const slackResult = await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			text: celebrationMessage,
		});

		if (slackResult.success) {
			results.actions.push({ action: 'slack_celebration', success: true });
		} else {
			results.actions.push({ action: 'slack_celebration', success: false, error: slackResult.error?.message });
		}

		// 2. Update MRR tracking (if enabled)
		if (inputs.includeMRR) {
			const mrrData = (await storage.get('mrr_tracking')) as MRRTracking | null;
			const currentMonth = new Date().toISOString().slice(0, 7);

			const updatedMRR: MRRTracking = {
				month: currentMonth,
				total: (mrrData?.month === currentMonth ? mrrData.total : 0) + amount,
				count: (mrrData?.month === currentMonth ? mrrData.count : 0) + 1,
			};

			await storage.put('mrr_tracking', updatedMRR);

			// Post MRR update if significant milestone
			if (updatedMRR.total >= 10000 && (!mrrData || mrrData.total < 10000)) {
				await integrations.slack.chat.postMessage({
					channel: inputs.slackChannel,
					text: `📈 *MRR Milestone!* We've crossed ${symbol}10,000 this month! (${updatedMRR.count} payments)`,
				});
			}

			results.mrrTotal = updatedMRR.total;
		}

		// 3. Close HubSpot deal (if enabled and email available)
		if (inputs.closeDealInCRM && customerEmail) {
			try {
				// Search for deals associated with this customer
				const dealsResult = await integrations.hubspot.deals.search({
					query: customerEmail,
					limit: 5,
				});

				if (dealsResult.success && dealsResult.data?.results?.length > 0) {
					// Find open deal
					const openDeal = dealsResult.data.results.find(
						(deal: HubSpotDeal) => deal.properties.dealstage !== 'closedwon' && deal.properties.dealstage !== 'closedlost'
					);

					if (openDeal) {
						const updateResult = await integrations.hubspot.deals.update({
							dealId: openDeal.id,
							properties: {
								dealstage: 'closedwon',
								closedate: new Date().toISOString(),
								amount: amount.toString(),
							},
						});

						if (updateResult.success) {
							results.actions.push({ action: 'hubspot_deal_closed', success: true, dealId: openDeal.id });
						} else {
							results.actions.push({ action: 'hubspot_deal_closed', success: false, error: updateResult.error?.message });
						}
					}
				}
			} catch {
				results.actions.push({ action: 'hubspot_deal_closed', success: false, error: 'HubSpot not configured' });
			}
		}

		// 4. Draft thank-you email (if enabled)
		if (inputs.draftThankYouEmail && customerEmail) {
			try {
				// Use Workers AI to generate personalized thank-you
				let thankYouBody: string;
				let aiGenerated = false;

				try {
					const aiResult = await integrations.ai.generateText({
						model: '@cf/meta/llama-3.1-8b-instruct',
						prompt: `Write a brief, warm thank-you email for a payment received.

Context:
- Company: ${inputs.companyName || 'Our company'}
- Customer: ${customerName}
- Amount: ${displayAmount}
- Product/Service: ${paymentIntent.description || 'services'}

Requirements:
- Keep it under 100 words
- Be genuine and warm, not corporate
- Include a brief mention of next steps or ongoing support
- Don't include subject line
- Don't use placeholder brackets like [Name]

Write only the email body.`,
						max_tokens: 200,
					});

					if (aiResult.success && aiResult.data) {
						thankYouBody = aiResult.data;
						aiGenerated = true;
					} else {
						throw new Error('AI generation failed');
					}
				} catch {
					// Graceful degradation
					thankYouBody = getThankYouTemplate({
						customerName,
						amount: displayAmount,
						companyName: inputs.companyName,
					});
				}

				const draftResult = await integrations.gmail.drafts.create({
					to: customerEmail,
					subject: `Thank you for your payment - ${displayAmount}`,
					body: thankYouBody,
				});

				if (draftResult.success) {
					results.actions.push({
						action: 'gmail_draft_created',
						success: true,
						aiGenerated,
						draftId: draftResult.data?.id,
					});
				} else {
					results.actions.push({ action: 'gmail_draft_created', success: false, error: draftResult.error?.message });
				}
			} catch {
				results.actions.push({ action: 'gmail_draft_created', success: false, error: 'Gmail not configured' });
			}
		}

		return {
			success: true,
			...results,
		};
	},

	onError: async ({ error, trigger, integrations, inputs }) => {
		// Notify on Slack if celebration fails
		try {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `⚠️ Payment celebration failed: ${error.message}\n\nPayment ID: ${trigger.data?.data?.object?.id || 'unknown'}`,
			});
		} catch {
			// Silent fail for error notification
		}
	},
});

// Types
interface PaymentIntentData {
	id: string;
	amount: number;
	currency: string;
	customer: string | null;
	description: string | null;
	metadata: Record<string, string>;
}

interface CelebrationResult {
	paymentId: string;
	amount: string;
	customer: string;
	actions: Array<{
		action: string;
		success: boolean;
		error?: string;
		dealId?: string;
		draftId?: string;
		aiGenerated?: boolean;
	}>;
	mrrTotal?: number;
}

interface MRRTracking {
	month: string;
	total: number;
	count: number;
}

interface HubSpotDeal {
	id: string;
	properties: {
		dealstage: string;
		closedate?: string;
		amount?: string;
	};
}

/**
 * Build Slack celebration message
 */
function buildSlackMessage(data: {
	emoji: string;
	amount: string;
	customerName: string | null;
	customerCompany: string | null;
	description: string | null;
}): string {
	const parts: string[] = [];

	// Header with emoji
	parts.push(`${data.emoji} *New Payment Received!*`);
	parts.push('');

	// Amount (always show)
	parts.push(`*Amount:* ${data.amount}`);

	// Customer info (if provided)
	if (data.customerName) {
		parts.push(`*From:* ${data.customerName}${data.customerCompany ? ` (${data.customerCompany})` : ''}`);
	}

	// Description (if meaningful)
	if (data.description && !data.description.toLowerCase().includes('payment')) {
		parts.push(`*For:* ${data.description}`);
	}

	return parts.join('\n');
}

/**
 * Fallback thank-you template when AI is unavailable
 */
function getThankYouTemplate(data: {
	customerName: string;
	amount: string;
	companyName?: string;
}): string {
	return `Hi ${data.customerName},

Thank you for your payment of ${data.amount}. We really appreciate your business!

If you have any questions or need any assistance, please don't hesitate to reach out. We're here to help.

Best regards,
${data.companyName || 'The Team'}`;
}

export const metadata = {
	id: 'payment-celebration',
	category: 'finance-billing',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
	new: true,
};
