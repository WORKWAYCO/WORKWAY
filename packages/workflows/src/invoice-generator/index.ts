/**
 * Invoice Generator
 *
 * Create and send invoices from project completion.
 * Tracks projects in Notion and sends invoices via Stripe/Gmail.
 *
 * Integrations: Stripe, Gmail, Notion
 * Trigger: Notion page status change to "Completed"
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Invoice Generator',
	description: 'Create and send invoices from project completion',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_payments_arrive',

		outcomeStatement: {
			suggestion: 'Generate invoices automatically?',
			explanation: 'When projects are marked complete in Notion, we\'ll create and send invoices through Stripe.',
			outcome: 'Invoices that generate themselves',
		},

		primaryPair: {
			from: 'notion',
			to: 'stripe',
			workflowId: 'invoice-generator',
			outcome: 'Projects that invoice themselves',
		},

		additionalPairs: [
			{ from: 'notion', to: 'gmail', workflowId: 'invoice-generator', outcome: 'Invoice emails sent automatically' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion', 'stripe'],
				workflowId: 'invoice-generator',
				priority: 75,
			},
			{
				trigger: 'event_received',
				eventType: 'notion.page.property_updated',
				integrations: ['notion', 'stripe'],
				workflowId: 'invoice-generator',
				priority: 80,
			},
		],

		smartDefaults: {
			triggerStatus: { value: 'Completed' },
			defaultDueDays: { value: 30 },
		},

		essentialFields: ['projectsDatabase', 'companyName'],

		zuhandenheit: {
			timeToValue: 5,
			worksOutOfBox: true,
			gracefulDegradation: false,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 15,
		trialDays: 14,
		description: 'Unlimited invoices',
	},

	integrations: [
		{ service: 'stripe', scopes: ['create_invoices', 'read_customers'] },
		{ service: 'gmail', scopes: ['send_emails'] },
		{ service: 'notion', scopes: ['read_pages', 'write_pages'] },
	],

	inputs: {
		projectsDatabase: {
			type: 'notion_database_picker',
			label: 'Projects Database',
			required: true,
			description: 'Database with project details',
		},
		triggerStatus: {
			type: 'string',
			label: 'Invoice Trigger Status',
			default: 'Completed',
			description: 'Status that triggers invoice creation',
		},
		companyName: {
			type: 'string',
			label: 'Your Company Name',
			required: true,
		},
		companyEmail: {
			type: 'email',
			label: 'Your Email',
			required: true,
		},
		defaultDueDays: {
			type: 'number',
			label: 'Payment Due (days)',
			default: 30,
		},
		currency: {
			type: 'select',
			label: 'Currency',
			options: ['usd', 'eur', 'gbp'],
			default: 'usd',
		},
		sendViaStripe: {
			type: 'boolean',
			label: 'Create Stripe Invoice',
			default: true,
			description: 'Create official invoice in Stripe',
		},
		sendEmailNotification: {
			type: 'boolean',
			label: 'Send Email Notification',
			default: true,
		},
	},

	trigger: webhook({
		service: 'notion',
		event: 'page.updated',
		filter: { database_id: '{{inputs.projectsDatabase}}' },
	}),

	async execute({ trigger, inputs, integrations }) {
		const page = trigger.data;

		// Check if status changed to trigger status
		const currentStatus = page.properties?.Status?.select?.name;
		if (currentStatus !== inputs.triggerStatus) {
			return { success: true, skipped: true, reason: 'Status not invoice trigger' };
		}

		// Check if already invoiced
		const invoiced = page.properties?.Invoiced?.checkbox;
		if (invoiced) {
			return { success: true, skipped: true, reason: 'Already invoiced' };
		}

		// Extract project details
		const projectName =
			page.properties?.Name?.title?.[0]?.plain_text ||
			page.properties?.Project?.title?.[0]?.plain_text ||
			'Project';
		const clientEmail =
			page.properties?.['Client Email']?.email ||
			page.properties?.Email?.email;
		const clientName =
			page.properties?.['Client Name']?.rich_text?.[0]?.plain_text ||
			page.properties?.Client?.rich_text?.[0]?.plain_text ||
			'Client';
		const amount =
			page.properties?.Amount?.number ||
			page.properties?.Price?.number ||
			page.properties?.Total?.number;
		const description =
			page.properties?.Description?.rich_text?.[0]?.plain_text ||
			`Services for ${projectName}`;

		if (!clientEmail) {
			throw new Error('Client email not found in project');
		}
		if (!amount) {
			throw new Error('Amount not found in project');
		}

		let stripeInvoice: { id: string; hosted_invoice_url: string } | null = null;
		let stripeInvoiceUrl: string | null = null;

		// Create Stripe invoice if enabled
		if (inputs.sendViaStripe) {
			// Find or create customer
			let customerId;
			const existingCustomers = await integrations.stripe.customers.list({
				email: clientEmail,
				limit: 1,
			});

			if (existingCustomers.success && existingCustomers.data?.length > 0) {
				customerId = existingCustomers.data[0].id;
			} else {
				const newCustomer = await integrations.stripe.customers.create({
					email: clientEmail,
					name: clientName,
				});
				if (newCustomer.success) {
					customerId = newCustomer.data.id;
				}
			}

			if (customerId) {
				// Create invoice
				const invoice = await integrations.stripe.invoices.create({
					customer: customerId,
					collection_method: 'send_invoice',
					days_until_due: inputs.defaultDueDays,
					currency: inputs.currency,
				});

				if (invoice.success) {
					// Add line item
					await integrations.stripe.invoiceItems.create({
						customer: customerId,
						invoice: invoice.data.id,
						amount: Math.round(amount * 100), // Convert to cents
						currency: inputs.currency,
						description: `${projectName}: ${description}`,
					});

					// Finalize invoice
					const finalized = await integrations.stripe.invoices.finalize({
						invoiceId: invoice.data.id,
					});

					if (finalized.success) {
						stripeInvoice = finalized.data;
						stripeInvoiceUrl = finalized.data.hosted_invoice_url;

						// Send the invoice
						await integrations.stripe.invoices.send({
							invoiceId: finalized.data.id,
						});
					}
				}
			}
		}

		// Send email notification
		if (inputs.sendEmailNotification) {
			const currencySymbol = { usd: '$', eur: '€', gbp: '£' }[inputs.currency] || '$';
			const dueDate = new Date();
			dueDate.setDate(dueDate.getDate() + inputs.defaultDueDays);

			const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; border-radius: 8px; padding: 30px;">
    <h1 style="color: #333; margin-top: 0;">Invoice from ${inputs.companyName}</h1>

    <p>Hi ${clientName},</p>

    <p>Thank you for your business! Here are the details for your invoice:</p>

    <div style="background: white; border-radius: 4px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Project:</strong></td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${projectName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Description:</strong></td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${description}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 1.2em; color: #2563eb;">${currencySymbol}${amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0;"><strong>Due Date:</strong></td>
          <td style="padding: 10px 0; text-align: right;">${dueDate.toLocaleDateString()}</td>
        </tr>
      </table>
    </div>

    ${stripeInvoiceUrl ? `<p><a href="${stripeInvoiceUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none;">Pay Invoice</a></p>` : ''}

    <p>If you have any questions, please don't hesitate to reach out.</p>

    <p>Best regards,<br>${inputs.companyName}</p>
  </div>
</body>
</html>`;

			await integrations.gmail.messages.send({
				to: clientEmail,
				subject: `Invoice for ${projectName} - ${currencySymbol}${amount.toFixed(2)}`,
				html: emailHtml,
			});
		}

		// Update Notion page
		const updateProperties: Record<string, any> = {
			Invoiced: { checkbox: true },
			'Invoice Date': { date: { start: new Date().toISOString() } },
		};

		if (stripeInvoice) {
			updateProperties['Invoice ID'] = { rich_text: [{ text: { content: stripeInvoice.id } }] };
			updateProperties['Invoice URL'] = { url: stripeInvoiceUrl };
		}

		await integrations.notion.pages.update({
			page_id: page.id,
			properties: updateProperties,
		});

		return {
			success: true,
			projectName,
			clientEmail,
			amount,
			stripeInvoiceId: stripeInvoice?.id,
			stripeInvoiceUrl,
		};
	},
});

export const metadata = {
	id: 'invoice-generator',
	category: 'finance-billing',
	featured: false,
	stats: { rating: 4.9, users: 983, reviews: 67 },
};
