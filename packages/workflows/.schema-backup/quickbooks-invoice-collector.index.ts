/**
 * QuickBooks Invoice Collector
 *
 * Invoices that chase themselves.
 *
 * Uses Workers AI to generate personalized, context-aware payment reminders
 * based on customer history and invoice details. Automatically escalates
 * through friendly → firm → urgent → final notice progression.
 *
 * Zuhandenheit: The mechanism (AI, QuickBooks API, email) recedes.
 * What remains: Invoices get paid without manual follow-up.
 *
 * Integrations: QuickBooks, Gmail, Slack, Workers AI
 * Trigger: Scheduled (daily check for overdue invoices)
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'QuickBooks Invoice Collector',
	description: 'AI-powered payment reminders that adapt to customer context',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_payments_arrive',

		outcomeStatement: {
			suggestion: 'Let invoices chase themselves?',
			explanation: 'We\'ll monitor QuickBooks for overdue invoices, use AI to craft personalized reminders based on customer history, and handle the entire collection flow automatically.',
			outcome: 'Invoices that chase themselves',
		},

		primaryPair: {
			from: 'quickbooks',
			to: 'gmail',
			workflowId: 'quickbooks-invoice-collector',
			outcome: 'Overdue invoices become paid invoices',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['quickbooks', 'gmail'],
				workflowId: 'quickbooks-invoice-collector',
				priority: 85,
			},
			{
				trigger: 'pattern_detected',
				integrations: ['quickbooks'],
				workflowId: 'quickbooks-invoice-collector',
				priority: 95,
			},
		],

		smartDefaults: {
			reminderDays: { value: [1, 7, 14, 30] },
			checkTime: { value: '09:00' },
			timezone: { inferFrom: 'user_timezone' },
			tone: { value: 'professional' },
		},

		essentialFields: ['companyName', 'companyEmail'],

		zuhandenheit: {
			timeToValue: 1440, // 24 hours until first check
			worksOutOfBox: true,
			gracefulDegradation: true, // Falls back to template if AI fails
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 19,
		trialDays: 14,
		description: 'AI-powered invoice collection',
	},

	integrations: [
		{ service: 'quickbooks', scopes: ['read_invoices', 'read_customers', 'read_payments'] },
		{ service: 'gmail', scopes: ['send_emails'] },
		{ service: 'slack', scopes: ['send_messages'], optional: true },
	],

	inputs: {
		companyName: {
			type: 'string',
			label: 'Your Company Name',
			required: true,
		},
		companyEmail: {
			type: 'email',
			label: 'Reply-to Email',
			required: true,
		},
		reminderDays: {
			type: 'array',
			label: 'Reminder Schedule (days overdue)',
			items: { type: 'number' },
			default: [1, 7, 14, 30],
		},
		tone: {
			type: 'select',
			label: 'Communication Tone',
			options: [
				{ value: 'friendly', label: 'Friendly & Casual' },
				{ value: 'professional', label: 'Professional' },
				{ value: 'formal', label: 'Formal & Direct' },
			],
			default: 'professional',
		},
		slackChannel: {
			type: 'string',
			label: 'Slack Channel for Escalations',
			description: 'Get notified when invoices are 30+ days overdue',
		},
		checkTime: {
			type: 'time',
			label: 'Daily Check Time',
			default: '09:00',
		},
		timezone: {
			type: 'timezone',
			label: 'Timezone',
			default: 'America/New_York',
		},
	},

	trigger: schedule({
		cron: '0 {{inputs.checkTime.hour}} * * *',
		timezone: '{{inputs.timezone}}',
	}),

	async execute({ inputs, integrations, storage }) {
		// Get overdue invoices from QuickBooks
		const overdueResult = await integrations.quickbooks.getOverdueInvoices();

		if (!overdueResult.success) {
			return {
				success: false,
				error: 'Failed to fetch overdue invoices',
				details: overdueResult.error,
			};
		}

		const overdueInvoices = overdueResult.data || [];

		if (overdueInvoices.length === 0) {
			return { success: true, message: 'No overdue invoices', reminders: 0 };
		}

		const results: Array<{
			invoiceId: string;
			invoiceNumber: string;
			customerName: string;
			customerEmail: string;
			amount: number;
			daysOverdue: number;
			urgencyLevel: string;
			aiGenerated: boolean;
		}> = [];

		const now = new Date();

		for (const invoice of overdueInvoices) {
			// Calculate days overdue
			const dueDate = invoice.DueDate ? new Date(invoice.DueDate) : new Date(invoice.TxnDate);
			const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

			// Check if we should send reminder today based on schedule
			const shouldRemind = inputs.reminderDays.some((day: number) => daysOverdue === day);
			if (!shouldRemind && daysOverdue % 7 !== 0) continue; // Also remind weekly after schedule

			// Get customer details
			const customerResult = await integrations.quickbooks.getCustomer(invoice.CustomerRef.value);
			if (!customerResult.success || !customerResult.data) continue;

			const customer = customerResult.data;
			const customerEmail = customer.PrimaryEmailAddr?.Address;

			if (!customerEmail) {
				// Log but continue - can't send email without address
				continue;
			}

			// Determine urgency level
			let urgencyLevel: 'friendly' | 'firm' | 'urgent' | 'final';
			if (daysOverdue <= 3) {
				urgencyLevel = 'friendly';
			} else if (daysOverdue <= 14) {
				urgencyLevel = 'firm';
			} else if (daysOverdue <= 30) {
				urgencyLevel = 'urgent';
			} else {
				urgencyLevel = 'final';
			}

			// Get customer payment history for AI context
			const paymentsResult = await integrations.quickbooks.listPayments(10);
			const customerPayments = paymentsResult.success
				? (paymentsResult.data || []).filter(p => p.CustomerRef.value === customer.Id)
				: [];

			const paymentHistory = customerPayments.length > 0
				? `Customer has ${customerPayments.length} previous payments on record.`
				: 'This appears to be a new customer with no payment history.';

			// Use Workers AI to generate personalized reminder
			let emailContent: string;
			let aiGenerated = false;

			try {
				const aiPrompt = `Generate a ${urgencyLevel} payment reminder email for an overdue invoice.

Context:
- Company: ${inputs.companyName}
- Customer: ${customer.DisplayName}
- Invoice Number: ${invoice.DocNumber || invoice.Id}
- Amount Due: $${invoice.Balance.toFixed(2)}
- Days Overdue: ${daysOverdue}
- Original Due Date: ${dueDate.toLocaleDateString()}
- Payment History: ${paymentHistory}
- Desired Tone: ${inputs.tone}
- Urgency Level: ${urgencyLevel}

Requirements:
- Keep it concise (under 200 words)
- Be ${inputs.tone} in tone
- Include clear call to action
- For ${urgencyLevel} level:
  ${urgencyLevel === 'friendly' ? '- Assume it might be an oversight, be warm' : ''}
  ${urgencyLevel === 'firm' ? '- Be clear about expectations, mention this is a follow-up' : ''}
  ${urgencyLevel === 'urgent' ? '- Express concern, mention potential consequences' : ''}
  ${urgencyLevel === 'final' ? '- Final notice tone, mention this is last attempt before escalation' : ''}
- Do NOT include subject line (will be added separately)
- Format as plain text that can be rendered in email

Write only the email body, nothing else.`;

				const aiResult = await integrations.ai.generateText({
					model: '@cf/meta/llama-3.1-8b-instruct',
					prompt: aiPrompt,
					max_tokens: 500,
				});

				if (aiResult.success && aiResult.data) {
					emailContent = aiResult.data;
					aiGenerated = true;
				} else {
					throw new Error('AI generation failed');
				}
			} catch {
				// Graceful degradation: fall back to template
				emailContent = getFallbackTemplate(urgencyLevel, {
					customerName: customer.DisplayName,
					invoiceNumber: invoice.DocNumber || invoice.Id,
					amount: invoice.Balance,
					daysOverdue,
					dueDate,
					companyName: inputs.companyName,
				});
			}

			// Build subject line
			const subjects: Record<string, string> = {
				friendly: `Friendly Reminder: Invoice #${invoice.DocNumber || invoice.Id} from ${inputs.companyName}`,
				firm: `Payment Reminder: Invoice #${invoice.DocNumber || invoice.Id} is ${daysOverdue} days overdue`,
				urgent: `Urgent: Invoice #${invoice.DocNumber || invoice.Id} requires immediate attention`,
				final: `Final Notice: Invoice #${invoice.DocNumber || invoice.Id} - Action Required`,
			};

			// Send email via Gmail
			await integrations.gmail.messages.send({
				to: customerEmail,
				subject: subjects[urgencyLevel],
				body: emailContent,
				replyTo: inputs.companyEmail,
			});

			// Escalate to Slack if severely overdue
			if (daysOverdue >= 30 && inputs.slackChannel) {
				await integrations.slack.chat.postMessage({
					channel: inputs.slackChannel,
					text: `⚠️ *Invoice Escalation*\n\nInvoice #${invoice.DocNumber || invoice.Id} from *${customer.DisplayName}* is now *${daysOverdue} days overdue*.\n\nAmount: $${invoice.Balance.toFixed(2)}\nEmail: ${customerEmail}\n\nThis may require manual follow-up.`,
				});
			}

			results.push({
				invoiceId: invoice.Id,
				invoiceNumber: invoice.DocNumber || invoice.Id,
				customerName: customer.DisplayName,
				customerEmail,
				amount: invoice.Balance,
				daysOverdue,
				urgencyLevel,
				aiGenerated,
			});
		}

		// Store execution summary
		await storage.put('last_run', {
			timestamp: now.toISOString(),
			remindersSent: results.length,
			overdueCount: overdueInvoices.length,
		});

		return {
			success: true,
			reminders: results.length,
			overdueTotal: overdueInvoices.length,
			results,
			aiGeneratedCount: results.filter(r => r.aiGenerated).length,
		};
	},
});

/**
 * Fallback templates when AI is unavailable
 * Graceful degradation maintains Zuhandenheit
 */
function getFallbackTemplate(
	level: 'friendly' | 'firm' | 'urgent' | 'final',
	data: {
		customerName: string;
		invoiceNumber: string;
		amount: number;
		daysOverdue: number;
		dueDate: Date;
		companyName: string;
	}
): string {
	const templates = {
		friendly: `Hi ${data.customerName},

This is a friendly reminder that invoice #${data.invoiceNumber} for $${data.amount.toFixed(2)} was due on ${data.dueDate.toLocaleDateString()}.

If you've already sent payment, please disregard this message. Otherwise, we'd appreciate if you could process this at your earliest convenience.

Thank you for your business!

Best regards,
${data.companyName}`,

		firm: `Hi ${data.customerName},

Our records show that invoice #${data.invoiceNumber} for $${data.amount.toFixed(2)} is now ${data.daysOverdue} days past due.

Please arrange for payment as soon as possible. If you're experiencing any issues, please let us know so we can work together on a solution.

Thank you,
${data.companyName}`,

		urgent: `Hi ${data.customerName},

Invoice #${data.invoiceNumber} for $${data.amount.toFixed(2)} is now ${data.daysOverdue} days overdue and requires immediate attention.

Please process payment today to avoid any service interruptions. Contact us immediately if there are any issues preventing payment.

Regards,
${data.companyName}`,

		final: `Hi ${data.customerName},

This is a final notice regarding invoice #${data.invoiceNumber} for $${data.amount.toFixed(2)}, which is now ${data.daysOverdue} days overdue.

Unless payment is received within 48 hours, we may need to take additional collection measures.

Please contact us immediately to resolve this matter.

${data.companyName}`,
	};

	return templates[level];
}

export const metadata = {
	id: 'quickbooks-invoice-collector',
	category: 'finance-billing',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
	new: true,
};
