/**
 * Payment Reminder System
 *
 * Send automated payment reminders to clients.
 * Monitors Stripe for overdue invoices and sends reminders.
 *
 * Integrations: Stripe, Gmail
 * Trigger: Scheduled (daily check for overdue invoices)
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Payment Reminder System',
	description: 'Send automated payment reminders to clients',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_payments_arrive',

		outcomeStatement: {
			suggestion: 'Send payment reminders automatically?',
			explanation: 'We\'ll check for overdue invoices daily and send reminder emails to clients at the right intervals.',
			outcome: 'Payment reminders that send themselves',
		},

		primaryPair: {
			from: 'stripe',
			to: 'gmail',
			workflowId: 'payment-reminders',
			outcome: 'Invoices that chase themselves',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['stripe', 'gmail'],
				workflowId: 'payment-reminders',
				priority: 70, // Lower than payments-tracked for tracking
			},
		],

		smartDefaults: {
			reminderDays: { value: [1, 7, 14, 30] },
			checkTime: { value: '09:00' },
			timezone: { inferFrom: 'user_timezone' },
		},

		essentialFields: ['companyName', 'companyEmail'],

		zuhandenheit: {
			timeToValue: 1440, // 24 hours until first check
			worksOutOfBox: true,
			gracefulDegradation: false,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 12,
		trialDays: 7,
		description: 'Automated payment collection',
	},

	integrations: [
		{ service: 'stripe', scopes: ['read_invoices', 'read_customers'] },
		{ service: 'gmail', scopes: ['send_emails'] },
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
		escalationEmail: {
			type: 'email',
			label: 'Escalation Email',
			description: 'Notify when invoice is 30+ days overdue',
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

	async execute({ inputs, integrations }) {
		// Get all open invoices
		const invoices = await integrations.stripe.invoices.list({
			status: 'open',
			limit: 100,
		});

		if (!invoices.success || !invoices.data?.length) {
			return { success: true, message: 'No open invoices', reminders: 0 };
		}

		const now = new Date();
		const results: Array<{
			invoiceId: string;
			invoiceNumber: string;
			customerEmail: string;
			amount: string;
			daysOverdue: number;
			urgencyLevel: 'friendly' | 'firm' | 'urgent' | 'final';
		}> = [];

		for (const invoice of invoices.data) {
			const dueDate = new Date(invoice.due_date * 1000);
			const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

			// Skip if not overdue
			if (daysOverdue < 0) continue;

			// Check if we should send reminder today
			const shouldRemind = inputs.reminderDays.includes(daysOverdue);
			if (!shouldRemind) continue;

			// Get customer details
			const customer = await integrations.stripe.customers.retrieve({
				customerId: invoice.customer,
			});

			if (!customer.success || !customer.data?.email) continue;

			const customerEmail = customer.data.email;
			const customerName = customer.data.name || 'Valued Customer';
			const amount = (invoice.amount_due / 100).toFixed(2);
			const currency = invoice.currency.toUpperCase();
			const currencySymbol = { USD: '$', EUR: '€', GBP: '£' }[currency] || currency;

			// Determine reminder urgency
			let urgencyLevel: 'friendly' | 'firm' | 'urgent' | 'final';
			let subject: string;

			if (daysOverdue <= 3) {
				urgencyLevel = 'friendly';
				subject = `Friendly Reminder: Invoice #${invoice.number} is due`;
			} else if (daysOverdue <= 14) {
				urgencyLevel = 'firm';
				subject = `Payment Reminder: Invoice #${invoice.number} is ${daysOverdue} days overdue`;
			} else if (daysOverdue <= 30) {
				urgencyLevel = 'urgent';
				subject = `Urgent: Invoice #${invoice.number} is ${daysOverdue} days overdue`;
			} else {
				urgencyLevel = 'final';
				subject = `Final Notice: Invoice #${invoice.number} - Immediate Action Required`;
			}

			const templates = {
				friendly: `
<p>Hi ${customerName},</p>
<p>This is a friendly reminder that invoice #${invoice.number} for ${currencySymbol}${amount} was due on ${dueDate.toLocaleDateString()}.</p>
<p>If you've already sent payment, please disregard this message. Otherwise, we'd appreciate if you could process this at your earliest convenience.</p>
`,
				firm: `
<p>Hi ${customerName},</p>
<p>Our records show that invoice #${invoice.number} for ${currencySymbol}${amount} is now ${daysOverdue} days past due.</p>
<p>Please arrange for payment as soon as possible. If you're experiencing any issues, let us know so we can work together on a solution.</p>
`,
				urgent: `
<p>Hi ${customerName},</p>
<p>Invoice #${invoice.number} for ${currencySymbol}${amount} is now ${daysOverdue} days overdue and requires immediate attention.</p>
<p>Please process payment today to avoid any service interruptions. Contact us immediately if there are any issues preventing payment.</p>
`,
				final: `
<p>Hi ${customerName},</p>
<p><strong>This is a final notice.</strong></p>
<p>Invoice #${invoice.number} for ${currencySymbol}${amount} is now ${daysOverdue} days overdue. Unless payment is received within 48 hours, we may need to take additional collection measures.</p>
<p>Please contact us immediately at ${inputs.companyEmail} to resolve this matter.</p>
`,
			};

			const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${urgencyLevel === 'final' ? '#fee2e2' : urgencyLevel === 'urgent' ? '#fef3c7' : '#f8f9fa'}; border-radius: 8px; padding: 30px;">
    <h2 style="color: #333; margin-top: 0;">${subject}</h2>

    ${templates[urgencyLevel]}

    <div style="background: white; border-radius: 4px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%;">
        <tr>
          <td><strong>Invoice:</strong></td>
          <td style="text-align: right;">#${invoice.number}</td>
        </tr>
        <tr>
          <td><strong>Amount:</strong></td>
          <td style="text-align: right; font-size: 1.2em; color: #dc2626;">${currencySymbol}${amount}</td>
        </tr>
        <tr>
          <td><strong>Due Date:</strong></td>
          <td style="text-align: right;">${dueDate.toLocaleDateString()}</td>
        </tr>
        <tr>
          <td><strong>Days Overdue:</strong></td>
          <td style="text-align: right;">${daysOverdue} days</td>
        </tr>
      </table>
    </div>

    <p><a href="${invoice.hosted_invoice_url}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none;">Pay Now</a></p>

    <p style="color: #666; font-size: 14px;">Thank you for your prompt attention to this matter.</p>

    <p>Best regards,<br>${inputs.companyName}</p>
  </div>
</body>
</html>`;

			// Send reminder
			await integrations.gmail.messages.send({
				to: customerEmail,
				subject,
				html: emailHtml,
				replyTo: inputs.companyEmail,
			});

			// Escalate if severely overdue
			if (daysOverdue >= 30 && inputs.escalationEmail) {
				await integrations.gmail.messages.send({
					to: inputs.escalationEmail,
					subject: `⚠️ Escalation: Invoice #${invoice.number} is ${daysOverdue} days overdue`,
					body: `
Invoice #${invoice.number} from ${customerName} (${customerEmail}) is ${daysOverdue} days overdue.

Amount: ${currencySymbol}${amount}
Due Date: ${dueDate.toLocaleDateString()}

This may require manual intervention.

Invoice URL: ${invoice.hosted_invoice_url}
					`,
				});
			}

			results.push({
				invoiceId: invoice.id,
				invoiceNumber: invoice.number,
				customerEmail,
				amount: `${currencySymbol}${amount}`,
				daysOverdue,
				urgencyLevel,
			});
		}

		return {
			success: true,
			reminders: results.length,
			results,
		};
	},
});

export const metadata = {
	id: 'payment-reminder-system',
	category: 'finance-billing',
	featured: false,
	stats: { rating: 4.7, users: 812, reviews: 42 },
};
