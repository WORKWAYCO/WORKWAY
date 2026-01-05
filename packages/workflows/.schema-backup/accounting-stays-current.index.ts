/**
 * Stripe to QuickBooks Payment Sync
 *
 * Books that reconcile themselves.
 *
 * When Stripe payments land, automatically record them in QuickBooks,
 * match to existing invoices, and keep your books perpetually reconciled.
 *
 * Zuhandenheit: The mechanism (Stripe webhooks, QuickBooks API, matching logic) recedes.
 * What remains: Stripe payments appear in QuickBooks without manual entry.
 *
 * Integrations: Stripe, QuickBooks, Slack (optional)
 * Trigger: Stripe webhook (payment_intent.succeeded)
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Stripe to QuickBooks Payment Sync',
	description: 'Automatically record Stripe payments in QuickBooks',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_payments_arrive',

		outcomeStatement: {
			suggestion: 'Let books reconcile themselves?',
			explanation: 'When Stripe payments succeed, we\'ll automatically record them in QuickBooks, match to existing invoices when possible, and keep your accounting in sync.',
			outcome: 'Books that reconcile themselves',
		},

		primaryPair: {
			from: 'stripe',
			to: 'quickbooks',
			workflowId: 'accounting-stays-current',
			outcome: 'Stripe payments appear in QuickBooks automatically',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['stripe', 'quickbooks'],
				workflowId: 'accounting-stays-current',
				priority: 95,
			},
			{
				trigger: 'event_received',
				eventType: 'stripe.payment_intent.succeeded',
				integrations: ['stripe', 'quickbooks'],
				workflowId: 'accounting-stays-current',
				priority: 98,
			},
		],

		smartDefaults: {
			autoMatchInvoices: { value: true },
			createCustomerIfMissing: { value: true },
		},

		essentialFields: [],

		zuhandenheit: {
			timeToValue: 1,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 19,
		trialDays: 14,
		description: 'Automatic payment reconciliation',
	},

	integrations: [
		{ service: 'stripe', scopes: ['read_payments', 'read_customers', 'webhooks'] },
		{ service: 'quickbooks', scopes: ['read_invoices', 'write_payments', 'read_customers', 'write_customers'] },
		{ service: 'slack', scopes: ['send_messages'], optional: true },
	],

	config: {
		auto_match_invoices: {
			type: 'boolean',
			label: 'Auto-match to Invoices',
			default: true,
			description: 'Attempt to match payments to existing QuickBooks invoices',
		},
		create_customer_if_missing: {
			type: 'boolean',
			label: 'Create Customer if Missing',
			default: true,
			description: 'Create QuickBooks customer if not found',
		},
		deposit_account_id: {
			type: 'text',
			label: 'Deposit Account ID',
			description: 'QuickBooks account to deposit payments (leave empty for Undeposited Funds)',
		},
		payment_method_id: {
			type: 'text',
			label: 'Payment Method ID',
			description: 'QuickBooks payment method for Stripe payments',
		},
		slack_channel: {
			type: 'text',
			label: 'Notification Channel (optional)',
			description: 'Slack channel for sync notifications',
		},
		minimum_amount: {
			type: 'number',
			label: 'Minimum Amount ($)',
			default: 0,
			description: 'Only sync payments above this amount',
		},
	},

	trigger: webhook({
		service: 'stripe',
		events: ['payment_intent.succeeded'],
	}),

	async execute({ trigger, inputs, integrations, storage }) {
		const event = trigger.data;
		const paymentIntent = event.data.object as StripePaymentIntent;

		// Extract payment details
		const amount = paymentIntent.amount / 100;
		const currency = paymentIntent.currency.toUpperCase();

		// Skip small payments if configured
		if (amount < inputs.minimumAmount) {
			return {
				success: true,
				skipped: true,
				reason: `Payment $${amount} below minimum threshold $${inputs.minimumAmount}`,
			};
		}

		const results: SyncResult = {
			stripePaymentId: paymentIntent.id,
			amount,
			currency,
			actions: [],
		};

		// Check if already synced (idempotency)
		const syncKey = `synced:${paymentIntent.id}`;
		const alreadySynced = await storage.get(syncKey);
		if (alreadySynced) {
			return {
				success: true,
				skipped: true,
				reason: 'Payment already synced (idempotency check)',
				quickbooksPaymentId: (alreadySynced as { qbPaymentId: string }).qbPaymentId,
			};
		}

		// 1. Get Stripe customer details
		let stripeCustomer: StripeCustomer | null = null;
		if (paymentIntent.customer) {
			const customerResult = await integrations.stripe.customers.retrieve({
				customerId: paymentIntent.customer,
			});
			if (customerResult.success && customerResult.data) {
				stripeCustomer = customerResult.data;
			}
		}

		// 2. Find or create QuickBooks customer
		let qbCustomerId: string | null = null;

		if (stripeCustomer?.email) {
			// Search by email
			const searchResult = await integrations.quickbooks.searchCustomers(stripeCustomer.email);
			if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
				qbCustomerId = searchResult.data[0].Id;
				results.actions.push({ action: 'customer_matched', success: true, customerId: qbCustomerId || undefined });
			}
		}

		if (!qbCustomerId && stripeCustomer?.name) {
			// Search by name
			const searchResult = await integrations.quickbooks.searchCustomers(stripeCustomer.name);
			if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
				qbCustomerId = searchResult.data[0].Id;
				results.actions.push({ action: 'customer_matched', success: true, customerId: qbCustomerId || undefined });
			}
		}

		// Create customer if not found and enabled
		if (!qbCustomerId && inputs.createCustomerIfMissing && stripeCustomer) {
			const createResult = await integrations.quickbooks.createCustomer({
				displayName: stripeCustomer.name || stripeCustomer.email || `Stripe Customer ${paymentIntent.customer}`,
				email: stripeCustomer.email || undefined,
				phone: stripeCustomer.phone || undefined,
			});

			if (createResult.success && createResult.data) {
				qbCustomerId = createResult.data.Id;
				results.actions.push({ action: 'customer_created', success: true, customerId: qbCustomerId || undefined });
			} else {
				results.actions.push({ action: 'customer_created', success: false, error: createResult.error?.message });
			}
		}

		if (!qbCustomerId) {
			// Can't proceed without a customer
			return {
				success: false,
				error: 'Could not find or create QuickBooks customer',
				stripeCustomer: stripeCustomer?.email || stripeCustomer?.name,
				...results,
			};
		}

		results.quickbooksCustomerId = qbCustomerId;

		// 3. Try to match to existing invoice
		let matchedInvoiceId: string | null = null;

		if (inputs.autoMatchInvoices) {
			// Look for open invoices for this customer with matching amount
			const invoicesResult = await integrations.quickbooks.listInvoices({
				customerId: qbCustomerId,
				status: 'open',
			});

			if (invoicesResult.success && invoicesResult.data) {
				// Try exact amount match first
				const exactMatch = invoicesResult.data.find(inv => Math.abs(inv.Balance - amount) < 0.01);
				if (exactMatch) {
					matchedInvoiceId = exactMatch.Id;
					results.actions.push({
						action: 'invoice_matched',
						success: true,
						invoiceId: matchedInvoiceId || undefined,
						matchType: 'exact_amount',
					});
				} else {
					// Try to find invoice with balance >= payment (partial payment)
					const partialMatch = invoicesResult.data.find(inv => inv.Balance >= amount);
					if (partialMatch) {
						matchedInvoiceId = partialMatch.Id;
						results.actions.push({
							action: 'invoice_matched',
							success: true,
							invoiceId: matchedInvoiceId || undefined,
							matchType: 'partial_payment',
						});
					}
				}
			}
		}

		// 4. Record payment in QuickBooks
		const paymentResult = await integrations.quickbooks.recordPayment({
			customerId: qbCustomerId,
			amount,
			invoiceId: matchedInvoiceId || undefined,
			paymentDate: new Date(paymentIntent.created * 1000).toISOString().split('T')[0],
			paymentMethodId: inputs.paymentMethodId || undefined,
			depositAccountId: inputs.depositAccountId || undefined,
		});

		if (!paymentResult.success) {
			results.actions.push({ action: 'payment_recorded', success: false, error: paymentResult.error?.message });
			return {
				success: false,
				error: 'Failed to record payment in QuickBooks',
				details: paymentResult.error,
				...results,
			};
		}

		const qbPayment = paymentResult.data;
		results.quickbooksPaymentId = qbPayment.Id;
		results.actions.push({ action: 'payment_recorded', success: true, paymentId: qbPayment.Id });

		// 5. Store sync record for idempotency
		await storage.put(syncKey, {
			qbPaymentId: qbPayment.Id,
			syncedAt: new Date().toISOString(),
		});

		// 6. Notify on Slack if configured
		if (inputs.slackChannel) {
			const customerName = stripeCustomer?.name || stripeCustomer?.email || 'Customer';
			const invoiceNote = matchedInvoiceId ? ` (applied to invoice)` : ' (unapplied)';

			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `✅ *Stripe → QuickBooks Sync*\n\n• Payment: $${amount.toLocaleString()} ${currency}\n• From: ${customerName}\n• QuickBooks ID: ${qbPayment.Id}${invoiceNote}`,
			});

			results.actions.push({ action: 'slack_notification', success: true });
		}

		return {
			success: true,
			...results,
			invoiceMatched: !!matchedInvoiceId,
		};
	},

	onError: async ({ error, trigger, integrations, inputs }) => {
		if (inputs.slackChannel) {
			try {
				await integrations.slack.chat.postMessage({
					channel: inputs.slackChannel,
					text: `⚠️ *Stripe → QuickBooks Sync Failed*\n\nPayment ID: ${trigger.data?.data?.object?.id || 'unknown'}\nError: ${error.message}`,
				});
			} catch {
				// Silent fail for error notification
			}
		}
	},
});

// Types
interface StripePaymentIntent {
	id: string;
	amount: number;
	currency: string;
	customer: string | null;
	description: string | null;
	metadata: Record<string, string>;
	created: number;
}

interface StripeCustomer {
	id: string;
	email: string | null;
	name: string | null;
	phone: string | null;
}

interface SyncResult {
	stripePaymentId: string;
	amount: number;
	currency: string;
	quickbooksCustomerId?: string;
	quickbooksPaymentId?: string;
	actions: Array<{
		action: string;
		success: boolean;
		error?: string;
		customerId?: string;
		paymentId?: string;
		invoiceId?: string;
		matchType?: string;
	}>;
}

export const metadata = {
	id: 'accounting-stays-current',
	category: 'finance-billing',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
	new: true,
};
