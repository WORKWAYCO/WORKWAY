/**
 * Form Response Hub
 *
 * Compound workflow: Typeform → Notion + Airtable + Slack
 *
 * Centralizes form responses:
 * 1. Form submitted on Typeform
 * 2. Creates Notion page with responses
 * 3. Adds row to Airtable for analytics
 * 4. Notifies team in Slack
 *
 * Zuhandenheit: "Responses organize themselves"
 * not "manually export and import form data"
 */

import { defineWorkflow, webhook, createStepExecutor } from '@workwayco/sdk';
import { Typeform } from '@workwayco/integrations';

export default defineWorkflow({
	name: 'Form Response Hub',
	description:
		'When Typeform responses arrive, automatically create Notion pages, add Airtable rows, and notify your team',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_forms_submitted',

		outcomeStatement: {
			suggestion: 'Want form responses to organize themselves?',
			explanation:
				'When someone submits a form, we\'ll log it to Notion, add it to Airtable, and notify you in Slack.',
			outcome: 'Responses on autopilot',
		},

		primaryPair: {
			from: 'typeform',
			to: 'notion',
			workflowId: 'form-response-hub',
			outcome: 'Responses logged to Notion',
		},

		additionalPairs: [
			{
				from: 'typeform',
				to: 'airtable',
				workflowId: 'form-response-hub',
				outcome: 'Responses in Airtable',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['typeform', 'notion'],
				workflowId: 'form-response-hub',
				priority: 90,
			},
			{
				trigger: 'integration_connected',
				integrations: ['typeform', 'airtable'],
				workflowId: 'form-response-hub',
				priority: 85,
			},
		],

		smartDefaults: {
			notifyOnResponse: { value: true },
		},

		essentialFields: ['typeform_form_id'],

		zuhandenheit: {
			timeToValue: 1,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 12,
		trialDays: 14,
		description: 'Free for 50 responses/month, $12/month unlimited',
	},

	integrations: [
		{ service: 'typeform', scopes: ['responses:read', 'webhooks:write'] },
		{ service: 'notion', scopes: ['insert_content'], optional: true },
		{ service: 'airtable', scopes: ['data.records:write'], optional: true },
		{ service: 'slack', scopes: ['chat:write'], optional: true },
	],

	// Weniger, aber besser: 2 essential fields
	// Destinations auto-detect from connected integrations
	config: {
		typeform_form_id: {
			type: 'text',
			label: 'Form to Monitor',
			required: true,
			description: 'The Typeform form to monitor for responses',
		},
		slack_channel: {
			type: 'text',
			label: 'Notification Channel',
			required: false,
			description: 'Channel for response notifications (optional)',
		},
	},

	trigger: webhook({
		path: '/typeform',
		events: ['form_response'],
	}),

	async execute({ trigger, inputs, integrations, storage }) {
		const event = trigger.payload as any;
		const formResponse = event.form_response;

		if (!formResponse) {
			return { success: false, error: 'Invalid Typeform webhook payload' };
		}

		// Extract response ID for idempotency check
		// Typeform uses `token` as the unique response identifier
		const responseId = formResponse.token || formResponse.response_id;
		if (!responseId) {
			return { success: false, error: 'Missing response ID in webhook payload' };
		}

		// Create StepExecutor for atomic step tracking
		// On retry: completed steps are skipped, failed steps are re-executed
		const executor = createStepExecutor(storage, `form-response:${responseId}`, {
			throwOnFailure: false, // Graceful degradation for optional destinations
		});

		// Check if execution already completed
		const progress = await executor.getProgress();
		if (progress.isComplete) {
			return {
				success: true,
				skipped: true,
				reason: 'Response already processed (idempotency check)',
				responseId,
			};
		}

		// Extract answers
		const answers = Typeform.extractAnswers(formResponse);
		const submittedAt = new Date(formResponse.submitted_at);

		// Build a summary of the response
		const responseSummary = buildResponseSummary(answers, formResponse.definition?.fields || []);

		// Step 1: Create Notion page (auto-detect first available database)
		const notionResult = await executor.stepIf(
			!!integrations.notion,
			'create-notion-page',
			async () => {
				// Auto-detect: find first database user has access to
				const databases = await integrations.notion!.search({
					filter: { property: 'object', value: 'database' },
					page_size: 1,
				});

				if (databases.success && databases.data.results.length > 0) {
					const databaseId = databases.data.results[0].id;
					const properties = buildNotionProperties(answers, responseSummary, submittedAt);
					const content = buildNotionContent(answers, formResponse);

					const result = await integrations.notion!.pages.create({
						parent: { database_id: databaseId },
						properties,
						children: content,
					});
					return { created: true, pageId: result.data?.id };
				}
				return { created: false, reason: 'No database found' };
			}
		);

		// Step 2: Create Airtable record (auto-detect first base and table)
		const airtableResult = await executor.stepIf(
			!!integrations.airtable,
			'create-airtable-record',
			async () => {
				// Auto-detect: use first available base and table
				const bases = await integrations.airtable!.bases.list();
				if (bases.success && bases.data.bases.length > 0) {
					const baseId = bases.data.bases[0].id;
					const tables = await integrations.airtable!.tables.list({ baseId });

					if (tables.success && tables.data.tables.length > 0) {
						const tableId = tables.data.tables[0].id;
						const fields = buildAirtableFields(answers, responseSummary, submittedAt);

						const result = await integrations.airtable!.records.create({
							baseId,
							tableId,
							fields,
						});
						return { created: true, recordId: result.data?.id };
					}
				}
				return { created: false, reason: 'No base/table found' };
			}
		);

		// Step 3: Send Slack notification
		const slackResult = await executor.stepIf(
			!!inputs.slackChannel && !!integrations.slack,
			'send-slack-notification',
			async () => {
				const result = await integrations.slack!.chat.postMessage({
					channel: inputs.slackChannel as string,
					blocks: buildSlackBlocks(answers, responseSummary, formResponse),
					text: `New form response: ${responseSummary.title}`,
				});
				return { sent: true, messageTs: result.data?.ts };
			}
		);

		// Mark execution as complete (keeps step state for debugging/auditing)
		await executor.complete();

		return {
			success: true,
			responseId,
			response: {
				submittedAt: submittedAt.toISOString(),
				answersCount: Object.keys(answers).length,
				summary: responseSummary.title,
			},
			destinations: {
				notion: notionResult?.created ?? false,
				airtable: airtableResult?.created ?? false,
				slack: slackResult?.sent ?? false,
			},
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack && inputs.slackChannel) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Form Response Hub Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface ResponseSummary {
	title: string;
	email: string | null;
	name: string | null;
	highlights: Array<{ label: string; value: string }>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildResponseSummary(answers: Record<string, any>, fields: any[]): ResponseSummary {
	// Try to find email and name
	let email: string | null = null;
	let name: string | null = null;
	const highlights: Array<{ label: string; value: string }> = [];

	for (const [fieldId, answer] of Object.entries(answers)) {
		const field = fields.find((f: any) => f.id === fieldId);
		const fieldTitle = field?.title || fieldId;

		// Detect email
		if (
			!email &&
			(field?.type === 'email' ||
				fieldTitle.toLowerCase().includes('email') ||
				(typeof answer === 'string' && answer.includes('@')))
		) {
			email = String(answer);
		}

		// Detect name
		if (
			!name &&
			(fieldTitle.toLowerCase().includes('name') ||
				fieldTitle.toLowerCase() === 'your name' ||
				fieldTitle.toLowerCase() === 'full name')
		) {
			name = String(answer);
		}

		// Add to highlights (first 5 non-empty answers)
		if (highlights.length < 5 && answer !== null && answer !== undefined && answer !== '') {
			highlights.push({
				label: fieldTitle,
				value: typeof answer === 'object' ? JSON.stringify(answer) : String(answer),
			});
		}
	}

	// Build title
	let title = 'Form Response';
	if (name) {
		title = `Response from ${name}`;
	} else if (email) {
		title = `Response from ${email}`;
	}

	return { title, email, name, highlights };
}

function buildNotionProperties(
	answers: Record<string, any>,
	summary: ResponseSummary,
	submittedAt: Date
): Record<string, any> {
	const properties: Record<string, any> = {
		Name: {
			title: [{ text: { content: summary.title } }],
		},
		'Submitted At': {
			date: { start: submittedAt.toISOString() },
		},
	};

	if (summary.email) {
		properties['Email'] = { email: summary.email };
	}

	if (summary.name) {
		properties['Respondent Name'] = {
			rich_text: [{ text: { content: summary.name } }],
		};
	}

	return properties;
}

function buildNotionContent(answers: Record<string, any>, formResponse: any): any[] {
	const blocks: any[] = [];
	const fields = formResponse.definition?.fields || [];

	blocks.push({
		type: 'callout',
		callout: {
			icon: { emoji: '📝' },
			rich_text: [
				{
					type: 'text',
					text: { content: `Submitted on ${new Date(formResponse.submitted_at).toLocaleString()}` },
				},
			],
		},
	});

	blocks.push({
		type: 'heading_2',
		heading_2: {
			rich_text: [{ type: 'text', text: { content: 'Responses' } }],
		},
	});

	for (const [fieldId, answer] of Object.entries(answers)) {
		const field = fields.find((f: any) => f.id === fieldId);
		const fieldTitle = field?.title || fieldId;
		const answerText = typeof answer === 'object' ? JSON.stringify(answer, null, 2) : String(answer);

		blocks.push({
			type: 'paragraph',
			paragraph: {
				rich_text: [
					{ type: 'text', text: { content: `${fieldTitle}: ` }, annotations: { bold: true } },
					{ type: 'text', text: { content: answerText } },
				],
			},
		});
	}

	return blocks;
}

function buildAirtableFields(
	answers: Record<string, any>,
	summary: ResponseSummary,
	submittedAt: Date
): Record<string, any> {
	const fields: Record<string, any> = {
		'Submitted At': submittedAt.toISOString(),
	};

	if (summary.name) {
		fields['Name'] = summary.name;
	}

	if (summary.email) {
		fields['Email'] = summary.email;
	}

	// Add first 10 answers as fields
	let count = 0;
	for (const [fieldId, answer] of Object.entries(answers)) {
		if (count >= 10) break;
		const value = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
		fields[`Answer ${count + 1}`] = value.slice(0, 1000); // Airtable field limit
		count++;
	}

	return fields;
}

function buildSlackBlocks(
	answers: Record<string, any>,
	summary: ResponseSummary,
	formResponse: any
): any[] {
	const blocks: any[] = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `:incoming_envelope: *New Form Response*\n${summary.title}`,
			},
		},
	];

	// Add highlights
	if (summary.highlights.length > 0) {
		const fields = summary.highlights.slice(0, 4).map((h) => ({
			type: 'mrkdwn',
			text: `*${h.label}:*\n${h.value.slice(0, 100)}${h.value.length > 100 ? '...' : ''}`,
		}));

		blocks.push({
			type: 'section',
			fields,
		});
	}

	blocks.push({
		type: 'context',
		elements: [
			{
				type: 'mrkdwn',
				text: `Submitted ${new Date(formResponse.submitted_at).toLocaleString()} • ${Object.keys(answers).length} answers`,
			},
		],
	});

	return blocks;
}

export const metadata = {
	id: 'form-response-hub',
	category: 'marketing-social',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
