/**
 * Sales Lead Pipeline
 *
 * Compound workflow: Form submission → AI Lead Scoring → CRM + Task + Slack + Email
 *
 * The complete lead capture automation:
 * 1. Typeform submission triggers workflow
 * 2. AI scores lead quality (hot/warm/cold)
 * 3. Creates HubSpot contact with enriched data
 * 4. Notifies sales team on Slack with context
 * 5. Creates follow-up task in Todoist with deadline
 * 6. Logs lead in Notion pipeline database
 * 7. Drafts personalized outreach email
 *
 * Zuhandenheit: Sales team thinks "leads appear, ready to work"
 * not "manually copy form data to 5 different tools"
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Sales Lead Pipeline',
	description:
		'Automatically route form leads to your CRM, notify sales on Slack, create follow-up tasks, and draft outreach emails',
	version: '1.0.0',

	pricing: {
		model: 'freemium',
		pricePerMonth: 19,
		trialDays: 14,
		description: 'Free for 50 leads/month, then $19/month unlimited',
	},

	integrations: [
		{ service: 'typeform', scopes: ['responses:read', 'webhooks:write'] },
		{ service: 'hubspot', scopes: ['crm.objects.contacts.write', 'crm.objects.deals.write'], optional: true },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'] },
		{ service: 'todoist', scopes: ['data:read_write'] },
		{ service: 'notion', scopes: ['write_pages', 'read_databases'], optional: true },
		{ service: 'gmail', scopes: ['gmail.compose'], optional: true },
	],

	inputs: {
		typeformId: {
			type: 'typeform_form_picker',
			label: 'Lead Capture Form',
			required: true,
			description: 'Select the Typeform that captures leads',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Sales Notifications Channel',
			required: true,
			description: 'Channel where lead alerts will be posted',
		},
		todoistProjectId: {
			type: 'todoist_project_picker',
			label: 'Follow-up Tasks Project',
			required: true,
			description: 'Todoist project for follow-up tasks',
		},
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Lead Pipeline Database',
			required: false,
			description: 'Optional: Notion database to track leads',
		},
		enableCRM: {
			type: 'boolean',
			label: 'Create HubSpot Contacts',
			default: true,
			description: 'Automatically create contacts in HubSpot',
		},
		enableEmailDraft: {
			type: 'boolean',
			label: 'Draft Outreach Email',
			default: false,
			description: 'Create a draft email for personalized follow-up',
		},
		enableAIScoring: {
			type: 'boolean',
			label: 'AI Lead Scoring',
			default: true,
			description: 'Use AI to score lead quality (hot/warm/cold)',
		},
		followUpDays: {
			type: 'number',
			label: 'Follow-up Deadline (days)',
			default: 1,
			min: 1,
			max: 14,
			description: 'Days until follow-up task is due',
		},
		assigneeEmail: {
			type: 'email',
			label: 'Default Assignee Email',
			required: false,
			description: 'Email of sales rep to assign tasks (optional)',
		},
	},

	trigger: webhook({
		service: 'typeform',
		events: ['form_response'],
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const response = trigger.data;

		// 1. Extract form answers
		const answers = extractFormAnswers(response);
		const { email, name, company, phone, message, budget, timeline } = answers;

		if (!email) {
			return { success: false, error: 'No email found in form response' };
		}

		// 2. AI Lead Scoring (optional)
		let leadScore = 'warm';
		let scoreReason = 'Default scoring';

		if (inputs.enableAIScoring && env.AI) {
			const scoring = await scoreLeadWithAI(env.AI, answers);
			leadScore = scoring.score;
			scoreReason = scoring.reason;
		}

		// 3. Create HubSpot contact (optional)
		let hubspotContactId: string | null = null;
		if (inputs.enableCRM && integrations.hubspot) {
			const contact = await integrations.hubspot.contacts.create({
				properties: {
					email,
					firstname: name?.split(' ')[0] || '',
					lastname: name?.split(' ').slice(1).join(' ') || '',
					company: company || '',
					phone: phone || '',
					hs_lead_status: leadScoreToHubSpot(leadScore),
					message: message || '',
				},
			});
			if (contact.success) {
				hubspotContactId = contact.data.id;
			}
		}

		// 4. Create Todoist follow-up task
		const dueDate = new Date();
		dueDate.setDate(dueDate.getDate() + inputs.followUpDays);

		const taskPriority = leadScore === 'hot' ? 4 : leadScore === 'warm' ? 3 : 2;
		const taskContent = `Follow up with ${name || email} ${company ? `from ${company}` : ''}`;
		const taskDescription = [
			`**Lead Score:** ${leadScore.toUpperCase()} - ${scoreReason}`,
			`**Email:** ${email}`,
			phone ? `**Phone:** ${phone}` : null,
			budget ? `**Budget:** ${budget}` : null,
			timeline ? `**Timeline:** ${timeline}` : null,
			message ? `\n**Message:**\n${message}` : null,
		]
			.filter(Boolean)
			.join('\n');

		const task = await integrations.todoist.tasks.create({
			content: taskContent,
			description: taskDescription,
			projectId: inputs.todoistProjectId,
			priority: taskPriority,
			dueDate: dueDate.toISOString().split('T')[0],
			labels: [`lead-${leadScore}`, 'sales'],
		});

		// 5. Post to Slack
		const slackEmoji = leadScore === 'hot' ? ':fire:' : leadScore === 'warm' ? ':sunny:' : ':snowflake:';
		const slackBlocks = [
			{
				type: 'header',
				text: { type: 'plain_text', text: `${slackEmoji} New ${leadScore.toUpperCase()} Lead` },
			},
			{
				type: 'section',
				fields: [
					{ type: 'mrkdwn', text: `*Name:*\n${name || 'Not provided'}` },
					{ type: 'mrkdwn', text: `*Email:*\n${email}` },
					{ type: 'mrkdwn', text: `*Company:*\n${company || 'Not provided'}` },
					{ type: 'mrkdwn', text: `*Score Reason:*\n${scoreReason}` },
				],
			},
			message
				? {
						type: 'section',
						text: { type: 'mrkdwn', text: `*Message:*\n>${message.slice(0, 200)}${message.length > 200 ? '...' : ''}` },
					}
				: null,
			{
				type: 'context',
				elements: [
					{
						type: 'mrkdwn',
						text: `Task created in Todoist • Due ${dueDate.toLocaleDateString()}${hubspotContactId ? ' • Added to HubSpot' : ''}`,
					},
				],
			},
		].filter(Boolean);

		await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			blocks: slackBlocks,
			text: `New ${leadScore} lead: ${name || email}`,
		});

		// 6. Log in Notion (optional)
		let notionPageId: string | null = null;
		if (inputs.notionDatabaseId && integrations.notion) {
			const page = await integrations.notion.pages.create({
				parent: { database_id: inputs.notionDatabaseId },
				properties: {
					Name: { title: [{ text: { content: name || email } }] },
					Email: { email },
					Company: company ? { rich_text: [{ text: { content: company } }] } : undefined,
					'Lead Score': { select: { name: leadScore.charAt(0).toUpperCase() + leadScore.slice(1) } },
					Status: { select: { name: 'New' } },
					Source: { select: { name: 'Typeform' } },
					'Created Date': { date: { start: new Date().toISOString() } },
					Budget: budget ? { rich_text: [{ text: { content: budget } }] } : undefined,
					Timeline: timeline ? { rich_text: [{ text: { content: timeline } }] } : undefined,
				},
			});
			if (page.success) {
				notionPageId = page.data.id;
			}
		}

		// 7. Draft outreach email (optional)
		let emailDraftId: string | null = null;
		if (inputs.enableEmailDraft && integrations.gmail && env.AI) {
			const emailDraft = await draftOutreachEmail(env.AI, integrations.gmail, answers, leadScore);
			emailDraftId = emailDraft?.draftId || null;
		}

		return {
			success: true,
			lead: {
				email,
				name,
				company,
				score: leadScore,
				scoreReason,
			},
			created: {
				todoistTaskId: task.success ? task.data.id : null,
				hubspotContactId,
				notionPageId,
				emailDraftId,
			},
			notifications: {
				slack: true,
			},
		};
	},

	onError: async ({ error, trigger, inputs, integrations }) => {
		// Notify Slack on failure
		if (integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Lead Pipeline Error: ${error.message}\nForm response ID: ${trigger.data?.response_id || 'unknown'}`,
			});
		}
	},
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface FormAnswers {
	email: string | null;
	name: string | null;
	company: string | null;
	phone: string | null;
	message: string | null;
	budget: string | null;
	timeline: string | null;
	[key: string]: string | null;
}

function extractFormAnswers(response: any): FormAnswers {
	const answers: FormAnswers = {
		email: null,
		name: null,
		company: null,
		phone: null,
		message: null,
		budget: null,
		timeline: null,
	};

	// Typeform answer structure
	const formAnswers = response.form_response?.answers || response.answers || [];

	for (const answer of formAnswers) {
		const fieldTitle = answer.field?.title?.toLowerCase() || '';
		const value = answer.text || answer.email || answer.phone_number || answer.choice?.label || answer.number;

		if (!value) continue;

		// Map common field names
		if (fieldTitle.includes('email') || answer.type === 'email') {
			answers.email = value;
		} else if (fieldTitle.includes('name') && !fieldTitle.includes('company')) {
			answers.name = value;
		} else if (fieldTitle.includes('company') || fieldTitle.includes('organization')) {
			answers.company = value;
		} else if (fieldTitle.includes('phone') || answer.type === 'phone_number') {
			answers.phone = value;
		} else if (fieldTitle.includes('message') || fieldTitle.includes('question') || fieldTitle.includes('help')) {
			answers.message = value;
		} else if (fieldTitle.includes('budget')) {
			answers.budget = value;
		} else if (fieldTitle.includes('timeline') || fieldTitle.includes('when')) {
			answers.timeline = value;
		}
	}

	return answers;
}

async function scoreLeadWithAI(
	ai: any,
	answers: FormAnswers
): Promise<{ score: 'hot' | 'warm' | 'cold'; reason: string }> {
	try {
		const prompt = `Score this sales lead as HOT, WARM, or COLD based on the information provided.

Lead Information:
- Email: ${answers.email || 'Not provided'}
- Name: ${answers.name || 'Not provided'}
- Company: ${answers.company || 'Not provided'}
- Budget: ${answers.budget || 'Not provided'}
- Timeline: ${answers.timeline || 'Not provided'}
- Message: ${answers.message || 'Not provided'}

Scoring criteria:
- HOT: Has budget, urgent timeline, clear need, business email domain
- WARM: Some signals of interest but missing urgency or budget clarity
- COLD: Generic inquiry, free email domain, vague requirements

Respond with JSON only: {"score": "hot|warm|cold", "reason": "brief explanation"}`;

		const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 100,
		});

		const text = result.response || '';
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			return {
				score: parsed.score?.toLowerCase() || 'warm',
				reason: parsed.reason || 'AI analysis',
			};
		}
	} catch (e) {
		// Graceful degradation
	}

	// Fallback: simple heuristic scoring
	let score: 'hot' | 'warm' | 'cold' = 'warm';
	let reason = 'Heuristic scoring';

	const email = answers.email || '';
	const hasBudget = !!answers.budget;
	const hasTimeline = !!answers.timeline;
	const isBusinessEmail = !email.match(/@(gmail|yahoo|hotmail|outlook)\./i);

	if (hasBudget && hasTimeline && isBusinessEmail) {
		score = 'hot';
		reason = 'Has budget, timeline, and business email';
	} else if (hasBudget || (hasTimeline && isBusinessEmail)) {
		score = 'warm';
		reason = isBusinessEmail ? 'Business email with some intent signals' : 'Shows budget or timeline';
	} else if (!isBusinessEmail && !hasBudget) {
		score = 'cold';
		reason = 'Personal email, no budget indicated';
	}

	return { score, reason };
}

function leadScoreToHubSpot(score: string): string {
	switch (score) {
		case 'hot':
			return 'OPEN_DEAL';
		case 'warm':
			return 'IN_PROGRESS';
		default:
			return 'NEW';
	}
}

async function draftOutreachEmail(
	ai: any,
	gmail: any,
	answers: FormAnswers,
	leadScore: string
): Promise<{ draftId: string } | null> {
	try {
		const prompt = `Write a brief, personalized sales follow-up email for this lead.

Lead: ${answers.name || 'there'}
Company: ${answers.company || 'your company'}
Their message: ${answers.message || 'They expressed interest in our services'}
Lead score: ${leadScore}

Guidelines:
- Keep it under 100 words
- Be warm but professional
- Reference their specific inquiry if provided
- Include a clear call to action (schedule a call)
- Don't be pushy

Output just the email body, no subject line.`;

		const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 200,
		});

		const emailBody = result.response || '';
		if (!emailBody || emailBody.length < 50) return null;

		const draft = await gmail.drafts.create({
			to: answers.email,
			subject: `Following up on your inquiry${answers.company ? ` from ${answers.company}` : ''}`,
			body: emailBody,
		});

		return draft.success ? { draftId: draft.data.id } : null;
	} catch (e) {
		return null;
	}
}

export const metadata = {
	id: 'sales-lead-pipeline',
	category: 'sales',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
