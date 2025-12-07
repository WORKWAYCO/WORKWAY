/**
 * Meeting Expense Tracker Workflow
 *
 * Track billable meetings and automatically create Stripe invoices
 * or invoice line items. Perfect for consultants, agencies, and
 * freelancers who bill by the hour or meeting.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "My meetings invoice themselves"
 *
 * Integrations: Zoom, Stripe, Notion (optional)
 * Trigger: Zoom webhook (meeting.ended) OR daily cron
 */

import { defineWorkflow, cron, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Meeting Expense Tracker',
	description: 'Meetings that invoice themselves - billable time tracked and invoiced automatically',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'after_meetings',

		outcomeStatement: {
			suggestion: 'Want meetings to track billable time?',
			explanation: 'After meetings end, we calculate billable time and add line items to Stripe invoices.',
			outcome: 'Meetings that invoice themselves',
		},

		primaryPair: {
			from: 'zoom',
			to: 'stripe',
			workflowId: 'meeting-expense-tracker',
			outcome: 'Meetings that invoice themselves',
		},

		additionalPairs: [
			{ from: 'zoom', to: 'notion', workflowId: 'meeting-expense-tracker', outcome: 'Meeting time logged to Notion' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['zoom', 'stripe'],
				workflowId: 'meeting-expense-tracker',
				priority: 85,
			},
			{
				trigger: 'event_received',
				eventType: 'zoom.meeting.ended',
				integrations: ['zoom', 'stripe'],
				workflowId: 'meeting-expense-tracker',
				priority: 90,
			},
		],

		smartDefaults: {
			billByDuration: { value: true },
			roundUpMinutes: { value: 15 },
			defaultHourlyRate: { value: 150 },
			createDraftInvoice: { value: true },
		},

		essentialFields: [],

		zuhandenheit: {
			timeToValue: 3,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.10,
		freeExecutions: 50,
		description: 'Per meeting tracked',
	},

	integrations: [
		{ service: 'zoom', scopes: ['meeting:read', 'report:read:admin'] },
		{ service: 'stripe', scopes: ['invoices', 'customers', 'prices'] },
		{ service: 'notion', scopes: ['read_databases', 'write_databases'], optional: true },
	],

	inputs: {
		// Billing settings
		defaultHourlyRate: {
			type: 'number',
			label: 'Default Hourly Rate',
			default: 150,
			description: 'Default rate in cents (15000 = $150/hr)',
		},
		currency: {
			type: 'select',
			label: 'Currency',
			options: ['usd', 'eur', 'gbp', 'cad', 'aud'],
			default: 'usd',
			description: 'Billing currency',
		},
		roundUpMinutes: {
			type: 'number',
			label: 'Round Up To',
			default: 15,
			description: 'Round meeting duration up to nearest N minutes',
		},
		minimumMinutes: {
			type: 'number',
			label: 'Minimum Billable',
			default: 15,
			description: 'Minimum billable minutes per meeting',
		},

		// Client matching
		clientMatchingMode: {
			type: 'select',
			label: 'Client Matching',
			options: ['email_domain', 'meeting_title', 'manual_mapping'],
			default: 'email_domain',
			description: 'How to match meetings to Stripe customers',
		},
		clientMapping: {
			type: 'json',
			label: 'Client Mapping',
			default: '{}',
			description: 'JSON mapping of domains/keywords to Stripe customer IDs',
		},

		// Invoice settings
		createDraftInvoice: {
			type: 'boolean',
			label: 'Create Draft Invoice',
			default: true,
			description: 'Create invoice if none exists (vs add to existing)',
		},
		autoFinalizeInvoice: {
			type: 'boolean',
			label: 'Auto-Finalize',
			default: false,
			description: 'Automatically finalize and send invoices',
		},
		invoicePrefix: {
			type: 'text',
			label: 'Invoice Description Prefix',
			default: 'Meeting: ',
			description: 'Prefix for invoice line item descriptions',
		},

		// Filtering
		billableKeywords: {
			type: 'text',
			label: 'Billable Keywords',
			default: 'client, consulting, coaching, session',
			description: 'Meeting titles containing these are billable',
		},
		excludeInternalMeetings: {
			type: 'boolean',
			label: 'Exclude Internal',
			default: true,
			description: 'Skip meetings with only internal attendees',
		},
		internalDomains: {
			type: 'text',
			label: 'Internal Domains',
			default: '',
			description: 'Comma-separated internal email domains',
		},

		// Notion tracking
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Time Tracking Database',
			required: false,
			description: 'Notion database for logging billable time',
		},

		// Sync settings
		lookbackDays: {
			type: 'number',
			label: 'Lookback Days',
			default: 1,
			description: 'Days to look back for ended meetings (cron)',
		},
	},

	trigger: cron({
		schedule: '0 20 * * *', // 8 PM UTC daily
		timezone: 'UTC',
	}),

	webhooks: [
		webhook({
			service: 'zoom',
			event: 'meeting.ended',
		}),
	],

	async execute({ trigger, inputs, integrations, env }) {
		const results: Array<{
			meeting: { id: string; topic: string; duration: number };
			billable: boolean;
			amount: number;
			customer: string | null;
			invoiceId: string | null;
			notionPageId: string | null;
		}> = [];

		const isWebhookTrigger = trigger.type === 'webhook';

		// Parse client mapping
		let clientMapping: Record<string, string> = {};
		try {
			clientMapping = JSON.parse(inputs.clientMapping || '{}');
		} catch {
			// Ignore parse errors
		}

		// Parse internal domains
		const internalDomains = (inputs.internalDomains || '')
			.split(',')
			.map((d: string) => d.trim().toLowerCase())
			.filter(Boolean);

		// Parse billable keywords
		const billableKeywords = (inputs.billableKeywords || '')
			.split(',')
			.map((k: string) => k.trim().toLowerCase())
			.filter(Boolean);

		if (isWebhookTrigger) {
			// Single meeting from webhook
			const meeting = trigger.data;
			const result = await processMeeting({
				meeting: {
					id: meeting.id || meeting.uuid,
					topic: meeting.topic,
					duration: meeting.duration,
					startTime: meeting.start_time,
					endTime: meeting.end_time,
					participants: meeting.participants || [],
				},
				inputs,
				integrations,
				env,
				clientMapping,
				internalDomains,
				billableKeywords,
			});
			results.push(result);
		} else {
			// Batch sync from cron - get past meetings
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - inputs.lookbackDays);

			const meetingsResult = await integrations.zoom.getReport({
				type: 'past_meetings',
				from: startDate.toISOString().split('T')[0],
				to: new Date().toISOString().split('T')[0],
			});

			if (meetingsResult.success && meetingsResult.data?.meetings) {
				for (const meeting of meetingsResult.data.meetings) {
					// Check if already processed
					const processedKey = `expense:${meeting.uuid}`;
					const alreadyProcessed = await env.KV?.get(processedKey);
					if (alreadyProcessed) continue;

					const result = await processMeeting({
						meeting: {
							id: meeting.uuid,
							topic: meeting.topic,
							duration: meeting.duration,
							startTime: meeting.start_time,
							endTime: meeting.end_time,
							participants: meeting.participants || [],
						},
						inputs,
						integrations,
						env,
						clientMapping,
						internalDomains,
						billableKeywords,
					});
					results.push(result);

					// Mark as processed
					await env.KV?.put(processedKey, 'true', { expirationTtl: 2592000 }); // 30 days
				}
			}
		}

		// Summary
		const totalBillable = results.filter(r => r.billable).length;
		const totalAmount = results.reduce((sum, r) => sum + r.amount, 0);

		return {
			success: true,
			meetingsProcessed: results.length,
			billableMeetings: totalBillable,
			totalAmount: totalAmount / 100, // Convert to dollars
			currency: inputs.currency,
			results,
		};
	},

	onError: async ({ error }) => {
		console.error('Meeting expense tracker error:', error.message);
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface MeetingData {
	id: string;
	topic: string;
	duration: number;
	startTime: string;
	endTime?: string;
	participants: Array<{ email?: string; name?: string }>;
}

interface ProcessMeetingParams {
	meeting: MeetingData;
	inputs: any;
	integrations: any;
	env: any;
	clientMapping: Record<string, string>;
	internalDomains: string[];
	billableKeywords: string[];
}

async function processMeeting(params: ProcessMeetingParams) {
	const { meeting, inputs, integrations, env, clientMapping, internalDomains, billableKeywords } = params;

	let billable = false;
	let amount = 0;
	let customerId: string | null = null;
	let invoiceId: string | null = null;
	let notionPageId: string | null = null;

	// 1. Check if meeting is billable
	const topicLower = meeting.topic.toLowerCase();
	billable = billableKeywords.some(keyword => topicLower.includes(keyword));

	// Check for internal-only meetings
	if (inputs.excludeInternalMeetings && meeting.participants.length > 0) {
		const allInternal = meeting.participants.every(p => {
			const email = p.email?.toLowerCase() || '';
			const domain = email.split('@')[1];
			return domain && internalDomains.includes(domain);
		});
		if (allInternal) billable = false;
	}

	if (!billable) {
		return {
			meeting: { id: meeting.id, topic: meeting.topic, duration: meeting.duration },
			billable: false,
			amount: 0,
			customer: null,
			invoiceId: null,
			notionPageId: null,
		};
	}

	// 2. Calculate billable amount
	let durationMinutes = meeting.duration;

	// Round up to nearest increment
	if (inputs.roundUpMinutes > 0) {
		durationMinutes = Math.ceil(durationMinutes / inputs.roundUpMinutes) * inputs.roundUpMinutes;
	}

	// Enforce minimum
	durationMinutes = Math.max(durationMinutes, inputs.minimumMinutes);

	// Calculate amount (rate is per hour, in cents)
	const hourlyRate = inputs.defaultHourlyRate * 100; // Convert dollars to cents
	amount = Math.round((durationMinutes / 60) * hourlyRate);

	// 3. Find Stripe customer
	customerId = await findStripeCustomer({
		meeting,
		mode: inputs.clientMatchingMode,
		clientMapping,
		integrations,
	});

	// 4. Create/update Stripe invoice
	if (customerId) {
		invoiceId = await addToInvoice({
			customerId,
			amount,
			description: `${inputs.invoicePrefix}${meeting.topic} (${durationMinutes} min)`,
			currency: inputs.currency,
			createDraft: inputs.createDraftInvoice,
			autoFinalize: inputs.autoFinalizeInvoice,
			integrations,
		});
	}

	// 5. Log to Notion
	if (inputs.notionDatabaseId) {
		try {
			const createResult = await integrations.notion.pages.create({
				parent: { database_id: inputs.notionDatabaseId },
				properties: {
					Name: { title: [{ text: { content: meeting.topic } }] },
					Date: { date: { start: meeting.startTime } },
					Duration: { number: durationMinutes },
					Amount: { number: amount / 100 },
					Customer: customerId ? { rich_text: [{ text: { content: customerId } }] } : undefined,
					'Invoice ID': invoiceId ? { rich_text: [{ text: { content: invoiceId } }] } : undefined,
					Status: { select: { name: invoiceId ? 'Invoiced' : 'Pending' } },
				},
			});
			notionPageId = createResult.data?.id || null;
		} catch {
			// Notion logging failed silently
		}
	}

	return {
		meeting: { id: meeting.id, topic: meeting.topic, duration: durationMinutes },
		billable: true,
		amount,
		customer: customerId,
		invoiceId,
		notionPageId,
	};
}

async function findStripeCustomer(params: {
	meeting: MeetingData;
	mode: string;
	clientMapping: Record<string, string>;
	integrations: any;
}): Promise<string | null> {
	const { meeting, mode, clientMapping, integrations } = params;

	try {
		if (mode === 'manual_mapping') {
			// Check mapping by meeting title keywords
			for (const [keyword, customerId] of Object.entries(clientMapping)) {
				if (meeting.topic.toLowerCase().includes(keyword.toLowerCase())) {
					return customerId;
				}
			}
		} else if (mode === 'email_domain') {
			// Find external participant and match by domain
			for (const participant of meeting.participants) {
				if (participant.email) {
					const domain = participant.email.split('@')[1]?.toLowerCase();
					if (domain) {
						// Check mapping first
						if (clientMapping[domain]) {
							return clientMapping[domain];
						}

						// Search Stripe for customer
						const searchResult = await integrations.stripe.customers.search({
							query: `email~"@${domain}"`,
							limit: 1,
						});
						if (searchResult.success && searchResult.data?.data?.[0]) {
							return searchResult.data.data[0].id;
						}
					}
				}
			}
		} else if (mode === 'meeting_title') {
			// Extract client name from meeting title (e.g., "Client: Acme Corp - Weekly Sync")
			const clientMatch = meeting.topic.match(/(?:client|for|with)[:\s]+([^-–]+)/i);
			if (clientMatch) {
				const clientName = clientMatch[1].trim();

				// Search Stripe for customer
				const searchResult = await integrations.stripe.customers.search({
					query: `name~"${clientName}"`,
					limit: 1,
				});
				if (searchResult.success && searchResult.data?.data?.[0]) {
					return searchResult.data.data[0].id;
				}
			}
		}
	} catch {
		// Customer search failed
	}

	return null;
}

async function addToInvoice(params: {
	customerId: string;
	amount: number;
	description: string;
	currency: string;
	createDraft: boolean;
	autoFinalize: boolean;
	integrations: any;
}): Promise<string | null> {
	const { customerId, amount, description, currency, createDraft, autoFinalize, integrations } = params;

	try {
		// Find existing draft invoice for customer
		const invoicesResult = await integrations.stripe.invoices.list({
			customer: customerId,
			status: 'draft',
			limit: 1,
		});

		let invoiceId: string;

		if (invoicesResult.success && invoicesResult.data?.data?.[0]) {
			invoiceId = invoicesResult.data.data[0].id;
		} else if (createDraft) {
			// Create new draft invoice
			const createResult = await integrations.stripe.invoices.create({
				customer: customerId,
				auto_advance: autoFinalize,
			});
			if (!createResult.success) return null;
			invoiceId = createResult.data.id;
		} else {
			return null;
		}

		// Add line item
		await integrations.stripe.invoiceItems.create({
			customer: customerId,
			invoice: invoiceId,
			amount,
			currency,
			description,
		});

		// Finalize if configured
		if (autoFinalize) {
			await integrations.stripe.invoices.finalizeInvoice(invoiceId);
		}

		return invoiceId;
	} catch {
		return null;
	}
}

export const metadata = {
	id: 'meeting-expense-tracker',
	category: 'finance',
	featured: false,
	stats: { rating: 0, users: 0, reviews: 0 },
};
