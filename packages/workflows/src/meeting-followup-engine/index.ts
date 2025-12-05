/**
 * Meeting Follow-up Engine
 *
 * Compound workflow: Calendly booking → Todoist tasks + Gmail draft + Notion log + Slack alert
 *
 * The complete meeting automation:
 * 1. Calendly event triggers workflow (scheduled or completed)
 * 2. Creates pre-meeting prep tasks in Todoist
 * 3. Logs meeting in Notion CRM
 * 4. Drafts follow-up email template
 * 5. Notifies team on Slack
 * 6. AI generates meeting agenda/talking points
 *
 * Zuhandenheit: Meetings follow up on themselves
 * not "remember to send that follow-up email"
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Meeting Follow-up Engine',
	description:
		'Automatically create prep tasks before meetings, log meetings in Notion, and draft follow-up emails when meetings are scheduled or completed',
	version: '1.0.0',

	pricing: {
		model: 'freemium',
		pricePerMonth: 15,
		trialDays: 14,
		description: 'Free for 20 meetings/month, then $15/month unlimited',
	},

	integrations: [
		{ service: 'calendly', scopes: ['scheduling:read', 'webhooks:write'] },
		{ service: 'todoist', scopes: ['data:read_write'] },
		{ service: 'notion', scopes: ['write_pages', 'read_databases'], optional: true },
		{ service: 'gmail', scopes: ['gmail.compose'], optional: true },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'], optional: true },
	],

	inputs: {
		todoistProjectId: {
			type: 'todoist_project_picker',
			label: 'Meeting Tasks Project',
			required: true,
			description: 'Todoist project for meeting prep and follow-up tasks',
		},
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Meetings Database',
			required: false,
			description: 'Optional: Notion database to log meetings',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Meeting Notifications',
			required: false,
			description: 'Optional: Channel for meeting alerts',
		},
		triggerOn: {
			type: 'select',
			label: 'Trigger On',
			required: true,
			options: [
				{ value: 'scheduled', label: 'When meeting is scheduled' },
				{ value: 'completed', label: 'After meeting ends' },
				{ value: 'both', label: 'Both scheduled and completed' },
			],
			default: 'both',
			description: 'When to run the workflow',
		},
		createPrepTasks: {
			type: 'boolean',
			label: 'Create Prep Tasks',
			default: true,
			description: 'Create preparation tasks when meeting is scheduled',
		},
		createFollowUpTasks: {
			type: 'boolean',
			label: 'Create Follow-up Tasks',
			default: true,
			description: 'Create follow-up tasks after meeting',
		},
		draftFollowUpEmail: {
			type: 'boolean',
			label: 'Draft Follow-up Email',
			default: true,
			description: 'Create a draft follow-up email after meeting',
		},
		enableAIAgenda: {
			type: 'boolean',
			label: 'AI Meeting Agenda',
			default: true,
			description: 'Use AI to generate meeting agenda and talking points',
		},
		followUpHours: {
			type: 'number',
			label: 'Follow-up Window (hours)',
			default: 24,
			min: 1,
			max: 72,
			description: 'Hours after meeting to complete follow-up tasks',
		},
	},

	trigger: webhook({
		service: 'calendly',
		events: ['invitee.created', 'invitee.canceled'],
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const event = trigger.data;
		const eventType = event.event;

		// Handle cancellations differently
		if (eventType === 'invitee.canceled') {
			return await handleCancellation(event, inputs, integrations);
		}

		// Extract meeting info
		const meeting = extractMeetingInfo(event);
		const isScheduled = eventType === 'invitee.created';

		// Determine what actions to take based on trigger settings
		const shouldCreatePrep = isScheduled && inputs.createPrepTasks;
		const shouldCreateFollowUp = !isScheduled && inputs.createFollowUpTasks;
		const shouldDraftEmail = !isScheduled && inputs.draftFollowUpEmail;

		// Skip if trigger doesn't match settings
		if (inputs.triggerOn === 'scheduled' && !isScheduled) {
			return { success: true, skipped: true, reason: 'Trigger set to scheduled only' };
		}
		if (inputs.triggerOn === 'completed' && isScheduled) {
			return { success: true, skipped: true, reason: 'Trigger set to completed only' };
		}

		// 1. AI-generated agenda/talking points (for scheduled meetings)
		let aiAgenda: string[] = [];
		if (inputs.enableAIAgenda && env.AI && isScheduled) {
			aiAgenda = await generateMeetingAgenda(env.AI, meeting);
		}

		// 2. Create Todoist tasks
		const createdTasks: string[] = [];

		if (shouldCreatePrep) {
			const prepTasks = getPrepTasks(meeting, aiAgenda);
			for (const task of prepTasks) {
				// Prep tasks due before the meeting
				const dueDate = new Date(meeting.startTime);
				dueDate.setHours(dueDate.getHours() - task.hoursBefore);

				const result = await integrations.todoist.tasks.create({
					content: task.title,
					description: task.description,
					projectId: inputs.todoistProjectId,
					priority: task.priority,
					dueDate: dueDate.toISOString().split('T')[0],
					labels: ['meeting-prep', meeting.eventType.toLowerCase().replace(/\s+/g, '-')],
				});

				if (result.success) {
					createdTasks.push(result.data.id);
				}
			}
		}

		if (shouldCreateFollowUp) {
			const followUpTasks = getFollowUpTasks(meeting);
			for (const task of followUpTasks) {
				const dueDate = new Date();
				dueDate.setHours(dueDate.getHours() + inputs.followUpHours * task.urgencyMultiplier);

				const result = await integrations.todoist.tasks.create({
					content: task.title,
					description: task.description,
					projectId: inputs.todoistProjectId,
					priority: task.priority,
					dueDate: dueDate.toISOString().split('T')[0],
					labels: ['meeting-followup', meeting.eventType.toLowerCase().replace(/\s+/g, '-')],
				});

				if (result.success) {
					createdTasks.push(result.data.id);
				}
			}
		}

		// 3. Log in Notion (optional)
		let notionPageId: string | null = null;
		if (inputs.notionDatabaseId && integrations.notion) {
			const page = await integrations.notion.pages.create({
				parent: { database_id: inputs.notionDatabaseId },
				properties: {
					Name: {
						title: [
							{
								text: {
									content: `${meeting.eventType} - ${meeting.inviteeName}`,
								},
							},
						],
					},
					'Invitee Email': { email: meeting.inviteeEmail },
					'Meeting Type': { select: { name: meeting.eventType } },
					'Scheduled Time': { date: { start: meeting.startTime } },
					Status: { select: { name: isScheduled ? 'Scheduled' : 'Completed' } },
					Source: { select: { name: 'Calendly' } },
				},
				children:
					aiAgenda.length > 0
						? [
								{
									object: 'block',
									type: 'heading_2',
									heading_2: {
										rich_text: [{ text: { content: 'Suggested Agenda' } }],
									},
								},
								...aiAgenda.map((item) => ({
									object: 'block',
									type: 'bulleted_list_item',
									bulleted_list_item: {
										rich_text: [{ text: { content: item } }],
									},
								})),
							]
						: undefined,
			});

			if (page.success) {
				notionPageId = page.data.id;
			}
		}

		// 4. Draft follow-up email (optional)
		let emailDraftId: string | null = null;
		if (shouldDraftEmail && integrations.gmail && env.AI) {
			emailDraftId = await draftFollowUpEmail(env.AI, integrations.gmail, meeting);
		}

		// 5. Post to Slack (optional)
		if (inputs.slackChannel && integrations.slack) {
			const emoji = isScheduled ? '📅' : '✅';
			const action = isScheduled ? 'scheduled' : 'completed';

			const blocks = [
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `${emoji} *Meeting ${action}:* ${meeting.eventType}`,
					},
				},
				{
					type: 'section',
					fields: [
						{ type: 'mrkdwn', text: `*With:*\n${meeting.inviteeName}` },
						{ type: 'mrkdwn', text: `*Email:*\n${meeting.inviteeEmail}` },
						{
							type: 'mrkdwn',
							text: `*Time:*\n${formatMeetingTime(meeting.startTime)}`,
						},
						{
							type: 'mrkdwn',
							text: `*Duration:*\n${meeting.duration} minutes`,
						},
					],
				},
			];

			if (createdTasks.length > 0) {
				blocks.push({
					type: 'context',
					elements: [
						{
							type: 'mrkdwn',
							text: `📋 ${createdTasks.length} tasks created in Todoist${notionPageId ? ' • Logged in Notion' : ''}`,
						},
					],
				} as any);
			}

			if (aiAgenda.length > 0 && isScheduled) {
				blocks.push({
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `*AI Agenda:*\n${aiAgenda.map((a) => `• ${a}`).join('\n')}`,
					},
				});
			}

			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				blocks,
				text: `Meeting ${action}: ${meeting.eventType} with ${meeting.inviteeName}`,
			});
		}

		return {
			success: true,
			meeting: {
				eventType: meeting.eventType,
				invitee: meeting.inviteeName,
				email: meeting.inviteeEmail,
				time: meeting.startTime,
				status: isScheduled ? 'scheduled' : 'completed',
			},
			created: {
				todoistTasks: createdTasks,
				notionPageId,
				emailDraftId,
			},
			notifications: {
				slack: !!inputs.slackChannel,
			},
			aiAgenda: aiAgenda.length > 0 ? aiAgenda : undefined,
		};
	},

	onError: async ({ error, trigger, inputs, integrations }) => {
		if (inputs.slackChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Meeting Follow-up Error: ${error.message}\nEvent: ${trigger.data?.event || 'unknown'}`,
			});
		}
	},
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface MeetingInfo {
	eventType: string;
	inviteeName: string;
	inviteeEmail: string;
	startTime: string;
	endTime: string;
	duration: number;
	location?: string;
	notes?: string;
	eventUri: string;
}

function extractMeetingInfo(event: any): MeetingInfo {
	const payload = event.payload || event;
	const scheduledEvent = payload.scheduled_event || payload;
	const invitee = payload.invitee || {};

	const startTime = new Date(scheduledEvent.start_time || scheduledEvent.scheduled_time);
	const endTime = new Date(scheduledEvent.end_time || startTime.getTime() + 30 * 60000);
	const duration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

	return {
		eventType: scheduledEvent.name || scheduledEvent.event_type?.name || 'Meeting',
		inviteeName: invitee.name || 'Unknown',
		inviteeEmail: invitee.email || '',
		startTime: startTime.toISOString(),
		endTime: endTime.toISOString(),
		duration,
		location: scheduledEvent.location?.location || scheduledEvent.location,
		notes: invitee.questions_and_answers?.[0]?.answer || invitee.notes,
		eventUri: scheduledEvent.uri || '',
	};
}

interface TaskTemplate {
	title: string;
	description: string;
	priority: number;
	hoursBefore: number;
}

function getPrepTasks(meeting: MeetingInfo, aiAgenda: string[]): TaskTemplate[] {
	const tasks: TaskTemplate[] = [
		{
			title: `Review background for ${meeting.inviteeName}`,
			description: `Meeting: ${meeting.eventType}\nEmail: ${meeting.inviteeEmail}${meeting.notes ? `\nNotes: ${meeting.notes}` : ''}`,
			priority: 3,
			hoursBefore: 2,
		},
		{
			title: `Prepare for ${meeting.eventType} with ${meeting.inviteeName}`,
			description: aiAgenda.length > 0
				? `Suggested agenda:\n${aiAgenda.map((a) => `• ${a}`).join('\n')}`
				: 'Review meeting objectives and prepare talking points',
			priority: 4,
			hoursBefore: 1,
		},
	];

	return tasks;
}

interface FollowUpTask {
	title: string;
	description: string;
	priority: number;
	urgencyMultiplier: number;
}

function getFollowUpTasks(meeting: MeetingInfo): FollowUpTask[] {
	return [
		{
			title: `Send follow-up email to ${meeting.inviteeName}`,
			description: `After ${meeting.eventType}\nEmail: ${meeting.inviteeEmail}`,
			priority: 4,
			urgencyMultiplier: 0.5, // Due in half the follow-up window
		},
		{
			title: `Update CRM after meeting with ${meeting.inviteeName}`,
			description: `Log meeting notes and outcomes for ${meeting.eventType}`,
			priority: 3,
			urgencyMultiplier: 1,
		},
		{
			title: `Complete action items from ${meeting.eventType}`,
			description: `Review any commitments made during meeting with ${meeting.inviteeName}`,
			priority: 3,
			urgencyMultiplier: 1.5,
		},
	];
}

async function generateMeetingAgenda(ai: any, meeting: MeetingInfo): Promise<string[]> {
	try {
		const prompt = `Generate 3-4 specific agenda items for this meeting.

Meeting Type: ${meeting.eventType}
With: ${meeting.inviteeName}
Duration: ${meeting.duration} minutes
${meeting.notes ? `Context: ${meeting.notes}` : ''}

Generate practical, actionable agenda items appropriate for this meeting type.
Format: Return only a JSON array of strings, like ["item 1", "item 2", "item 3"]`;

		const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 150,
		});

		const text = result.response || '';
		const jsonMatch = text.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]);
		}
	} catch (e) {
		// Graceful degradation
	}
	return [];
}

async function draftFollowUpEmail(
	ai: any,
	gmail: any,
	meeting: MeetingInfo
): Promise<string | null> {
	try {
		const prompt = `Write a brief follow-up email after this meeting.

Meeting: ${meeting.eventType}
With: ${meeting.inviteeName}
Duration: ${meeting.duration} minutes

Guidelines:
- Keep it under 100 words
- Thank them for their time
- Reference the meeting type
- Mention next steps placeholder
- Be professional and warm

Output just the email body, no subject line.`;

		const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 200,
		});

		const emailBody = result.response || '';
		if (!emailBody || emailBody.length < 50) return null;

		const draft = await gmail.drafts.create({
			to: meeting.inviteeEmail,
			subject: `Following up on our ${meeting.eventType}`,
			body: emailBody,
		});

		return draft.success ? draft.data.id : null;
	} catch (e) {
		return null;
	}
}

async function handleCancellation(
	event: any,
	inputs: any,
	integrations: any
): Promise<Record<string, any>> {
	const meeting = extractMeetingInfo(event);

	// Notify on Slack about cancellation
	if (inputs.slackChannel && integrations.slack) {
		await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			text: `❌ Meeting cancelled: ${meeting.eventType} with ${meeting.inviteeName}`,
		});
	}

	return {
		success: true,
		cancelled: true,
		meeting: {
			eventType: meeting.eventType,
			invitee: meeting.inviteeName,
		},
	};
}

function formatMeetingTime(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	});
}

export const metadata = {
	id: 'meeting-followup-engine',
	category: 'productivity',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
