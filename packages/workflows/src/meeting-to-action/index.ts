/**
 * Meeting to Action Workflow
 *
 * Automatically extract action items from Zoom meeting transcripts
 * and create tasks in Todoist or Linear. Never lose an action item again.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "My meetings assign themselves"
 *
 * Integrations: Zoom, Todoist, Linear, Slack (optional)
 * Trigger: Zoom webhook (recording.completed) OR daily cron
 */

import { defineWorkflow, cron, webhook } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

// Schema for AI action item extraction
const ActionItemSchema = {
	task: 'string',
	assignee: 'string | null',
	dueDate: 'string | null',
	priority: "'high' | 'medium' | 'low'",
	context: 'string',
} as const;

export default defineWorkflow({
	name: 'Meeting to Action',
	description: 'Meetings that assign themselves - action items extracted and tasks created automatically',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'after_meetings',

		outcomeStatement: {
			suggestion: 'Want action items tracked automatically?',
			explanation: 'After Zoom meetings, we extract action items and create tasks in Todoist or Linear.',
			outcome: 'Meetings that assign themselves',
		},

		primaryPair: {
			from: 'zoom',
			to: 'todoist',
			workflowId: 'meeting-to-action',
			outcome: 'Meetings that assign themselves',
		},

		additionalPairs: [
			{ from: 'zoom', to: 'linear', workflowId: 'meeting-to-action', outcome: 'Meeting action items in Linear' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['zoom', 'todoist'],
				workflowId: 'meeting-to-action',
				priority: 95,
			},
			{
				trigger: 'integration_connected',
				integrations: ['zoom', 'linear'],
				workflowId: 'meeting-to-action',
				priority: 95,
			},
			{
				trigger: 'event_received',
				eventType: 'zoom.recording.completed',
				integrations: ['zoom', 'todoist'],
				workflowId: 'meeting-to-action',
				priority: 100,
			},
		],

		smartDefaults: {
			taskDestination: { value: 'todoist' },
			minimumConfidence: { value: 0.7 },
			createSubtasks: { value: true },
			postToSlack: { value: true },
			defaultPriority: { value: 'medium' },
		},

		essentialFields: [],

		zuhandenheit: {
			timeToValue: 2,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.15,
		freeExecutions: 30,
		description: 'Per meeting processed (includes AI extraction)',
	},

	integrations: [
		{ service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
		{ service: 'todoist', scopes: ['data:read_write'], optional: true },
		{ service: 'linear', scopes: ['read', 'write', 'issues:create'], optional: true },
		{ service: 'slack', scopes: ['send_messages'], optional: true },
	],

	inputs: {
		// Task destination
		taskDestination: {
			type: 'select',
			label: 'Create Tasks In',
			options: ['todoist', 'linear', 'both'],
			default: 'todoist',
			description: 'Where to create extracted action items',
		},

		// Todoist settings
		todoistProject: {
			type: 'text',
			label: 'Todoist Project',
			required: false,
			description: 'Project for meeting tasks (defaults to Inbox)',
		},

		// Linear settings
		linearTeam: {
			type: 'text',
			label: 'Linear Team',
			required: false,
			description: 'Team to create issues in',
		},
		linearProject: {
			type: 'text',
			label: 'Linear Project',
			required: false,
			description: 'Optional project for issues',
		},

		// Extraction settings
		minimumConfidence: {
			type: 'number',
			label: 'Minimum Confidence',
			default: 0.7,
			description: 'Only create tasks with AI confidence above this threshold (0.0-1.0)',
		},
		createSubtasks: {
			type: 'boolean',
			label: 'Group as Subtasks',
			default: true,
			description: 'Create a parent task for the meeting with action items as subtasks',
		},
		defaultPriority: {
			type: 'select',
			label: 'Default Priority',
			options: ['high', 'medium', 'low'],
			default: 'medium',
			description: 'Priority for tasks without explicit priority',
		},

		// Assignee matching
		matchAssignees: {
			type: 'boolean',
			label: 'Match Assignees',
			default: true,
			description: 'Try to match mentioned names to team members',
		},
		teamMemberMapping: {
			type: 'json',
			label: 'Name to ID Mapping',
			default: '{}',
			description: 'JSON object mapping names to Todoist/Linear user IDs',
		},

		// Notification settings
		slackChannel: {
			type: 'text',
			label: 'Action Item Notifications',
			required: false,
			description: 'Channel to post extracted action items',
		},
		postToSlack: {
			type: 'boolean',
			label: 'Post to Slack',
			default: true,
			description: 'Notify about extracted action items',
		},

		// Sync settings (for cron trigger)
		lookbackDays: {
			type: 'number',
			label: 'Days to Look Back',
			default: 1,
			description: 'How many days of meetings to process (for daily cron)',
		},
	},

	// Support both cron and webhook triggers
	trigger: cron({
		schedule: '0 8 * * *', // 8 AM UTC daily
		timezone: 'UTC',
	}),

	webhooks: [
		webhook({
			service: 'zoom',
			event: 'recording.completed',
		}),
	],

	async execute({ trigger, inputs, integrations, env }) {
		const results: Array<{
			meeting: { id: string; topic: string };
			actionItems: Array<{ task: string; created: boolean; destination: string }>;
			slackPosted: boolean;
		}> = [];

		const isWebhookTrigger = trigger.type === 'webhook';

		// Parse team member mapping
		let teamMapping: Record<string, string> = {};
		try {
			teamMapping = JSON.parse(inputs.teamMemberMapping || '{}');
		} catch {
			// Ignore parse errors
		}

		if (isWebhookTrigger) {
			// Single meeting from webhook
			const recording = trigger.data;
			const meetingResult = await processMeeting({
				meetingId: recording.meeting_id || recording.id,
				topic: recording.topic,
				shareUrl: recording.share_url,
				inputs,
				integrations,
				env,
				teamMapping,
			});
			results.push(meetingResult);
		} else {
			// Batch sync from cron
			const meetingsResult = await integrations.zoom.getMeetings({
				days: inputs.lookbackDays || 1,
				type: 'previous_meetings',
			});

			if (meetingsResult.success && meetingsResult.data) {
				for (const meeting of meetingsResult.data) {
					// Check if already processed (idempotency)
					const processedKey = `action:${meeting.id}`;
					const alreadyProcessed = await env.KV?.get(processedKey);
					if (alreadyProcessed) continue;

					const meetingResult = await processMeeting({
						meetingId: String(meeting.id),
						topic: meeting.topic,
						shareUrl: meeting.join_url,
						inputs,
						integrations,
						env,
						teamMapping,
					});
					results.push(meetingResult);

					// Mark as processed (TTL: 7 days)
					await env.KV?.put(processedKey, 'true', { expirationTtl: 604800 });
				}
			}
		}

		// Summary
		const totalMeetings = results.length;
		const totalActions = results.reduce((sum, r) => sum + r.actionItems.length, 0);
		const totalCreated = results.reduce(
			(sum, r) => sum + r.actionItems.filter(a => a.created).length,
			0
		);

		return {
			success: true,
			processed: totalMeetings,
			actionItemsFound: totalActions,
			tasksCreated: totalCreated,
			results,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (inputs.slackChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `Meeting to Action failed: ${error.message}`,
			});
		}
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface ActionItem {
	task: string;
	assignee: string | null;
	dueDate: string | null;
	priority: 'high' | 'medium' | 'low';
	context: string;
	confidence: number;
}

interface ProcessMeetingParams {
	meetingId: string;
	topic: string;
	shareUrl?: string;
	inputs: any;
	integrations: any;
	env: any;
	teamMapping: Record<string, string>;
}

async function processMeeting(params: ProcessMeetingParams) {
	const { meetingId, topic, shareUrl, inputs, integrations, env, teamMapping } = params;

	// 1. Get transcript
	let transcript: string | null = null;
	const transcriptResult = await integrations.zoom.getTranscript({
		meetingId,
		fallbackToBrowser: true,
		shareUrl,
	});

	if (transcriptResult.success && transcriptResult.data) {
		transcript = transcriptResult.data.transcript_text;
	}

	// 2. Extract action items with AI
	let actionItems: ActionItem[] = [];
	if (transcript && transcript.length > 100) {
		actionItems = await extractActionItems({
			transcript,
			topic,
			minimumConfidence: inputs.minimumConfidence,
			defaultPriority: inputs.defaultPriority,
			integrations,
			env,
		});
	}

	// 3. Create tasks
	const createdItems: Array<{ task: string; created: boolean; destination: string }> = [];

	for (const item of actionItems) {
		// Match assignee to team member ID
		let assigneeId: string | null = null;
		if (inputs.matchAssignees && item.assignee) {
			const normalizedName = item.assignee.toLowerCase().trim();
			for (const [name, id] of Object.entries(teamMapping)) {
				if (name.toLowerCase().includes(normalizedName) ||
					normalizedName.includes(name.toLowerCase())) {
					assigneeId = id;
					break;
				}
			}
		}

		const createInTodoist = inputs.taskDestination === 'todoist' || inputs.taskDestination === 'both';
		const createInLinear = inputs.taskDestination === 'linear' || inputs.taskDestination === 'both';

		// Create in Todoist
		if (createInTodoist && integrations.todoist) {
			try {
				const todoistResult = await integrations.todoist.createTask({
					content: item.task,
					project_id: inputs.todoistProject || undefined,
					priority: mapPriorityToTodoist(item.priority),
					due_string: item.dueDate || undefined,
					description: `From meeting: ${topic}\n\n${item.context}`,
				});

				createdItems.push({
					task: item.task,
					created: todoistResult.success,
					destination: 'todoist',
				});
			} catch {
				createdItems.push({ task: item.task, created: false, destination: 'todoist' });
			}
		}

		// Create in Linear
		if (createInLinear && integrations.linear) {
			try {
				const linearResult = await integrations.linear.createIssue({
					title: item.task,
					teamId: inputs.linearTeam,
					projectId: inputs.linearProject || undefined,
					priority: mapPriorityToLinear(item.priority),
					dueDate: item.dueDate || undefined,
					description: `From meeting: ${topic}\n\n${item.context}`,
					assigneeId: assigneeId || undefined,
				});

				createdItems.push({
					task: item.task,
					created: linearResult.success,
					destination: 'linear',
				});
			} catch {
				createdItems.push({ task: item.task, created: false, destination: 'linear' });
			}
		}
	}

	// 4. Post to Slack
	let slackPosted = false;
	if (inputs.postToSlack && inputs.slackChannel && actionItems.length > 0) {
		slackPosted = await postActionItemsToSlack({
			channel: inputs.slackChannel,
			topic,
			actionItems,
			createdItems,
			integrations,
		});
	}

	return {
		meeting: { id: meetingId, topic },
		actionItems: createdItems,
		slackPosted,
	};
}

async function extractActionItems(params: {
	transcript: string;
	topic: string;
	minimumConfidence: number;
	defaultPriority: string;
	integrations: any;
	env: any;
}): Promise<ActionItem[]> {
	const { transcript, topic, minimumConfidence, defaultPriority, integrations } = params;

	try {
		const result = await integrations.ai.generateText({
			model: AIModels.LLAMA_3_8B,
			system: `You are an action item extractor. Analyze meeting transcripts and extract concrete, actionable tasks.

For each action item, identify:
- The specific task to be done
- Who is responsible (if mentioned)
- Any due dates mentioned
- Priority (high/medium/low based on urgency language)
- Brief context for why this task matters
- Your confidence score (0.0-1.0)

Return ONLY valid JSON array. Example:
[
  {
    "task": "Send proposal to client by Friday",
    "assignee": "Sarah",
    "dueDate": "2024-12-13",
    "priority": "high",
    "context": "Client is waiting for pricing before board meeting",
    "confidence": 0.95
  }
]

Rules:
- Only extract concrete, actionable items
- Skip vague discussions or ideas without clear next steps
- If no assignee is clear, use null
- If no due date, use null
- Be conservative - only high confidence items`,
			prompt: `Meeting: ${topic}

Transcript:
${transcript.slice(0, 10000)}

Extract action items:`,
			temperature: 0.3,
			max_tokens: 1500,
		});

		const responseText = result.data?.response || '[]';
		const jsonMatch = responseText.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			const items = JSON.parse(jsonMatch[0]);
			return items
				.filter((item: ActionItem) => item.confidence >= minimumConfidence)
				.map((item: ActionItem) => ({
					...item,
					priority: item.priority || defaultPriority,
				}));
		}

		return [];
	} catch (error) {
		console.error('Action item extraction failed:', error);
		return [];
	}
}

function mapPriorityToTodoist(priority: string): number {
	// Todoist: 1 (normal) to 4 (urgent)
	switch (priority) {
		case 'high': return 4;
		case 'medium': return 2;
		case 'low': return 1;
		default: return 2;
	}
}

function mapPriorityToLinear(priority: string): number {
	// Linear: 0 (no priority) to 4 (urgent)
	switch (priority) {
		case 'high': return 1;
		case 'medium': return 2;
		case 'low': return 3;
		default: return 2;
	}
}

async function postActionItemsToSlack(params: {
	channel: string;
	topic: string;
	actionItems: ActionItem[];
	createdItems: Array<{ task: string; created: boolean; destination: string }>;
	integrations: any;
}): Promise<boolean> {
	const { channel, topic, actionItems, createdItems, integrations } = params;

	const successCount = createdItems.filter(i => i.created).length;

	const itemsList = actionItems
		.map((item, i) => {
			const created = createdItems[i]?.created ? '' : ' (failed)';
			const assignee = item.assignee ? ` @${item.assignee}` : '';
			const priority = item.priority === 'high' ? '' : '';
			return `${priority}${item.task}${assignee}${created}`;
		})
		.join('\n');

	const blocks: any[] = [
		{
			type: 'header',
			text: { type: 'plain_text', text: `Action Items: ${topic}`, emoji: true },
		},
		{
			type: 'context',
			elements: [
				{ type: 'mrkdwn', text: `${successCount}/${actionItems.length} tasks created` },
			],
		},
		{
			type: 'section',
			text: { type: 'mrkdwn', text: itemsList },
		},
	];

	try {
		await integrations.slack.chat.postMessage({
			channel,
			text: `${actionItems.length} action items from: ${topic}`,
			blocks,
		});
		return true;
	} catch {
		return false;
	}
}

export const metadata = {
	id: 'meeting-to-action',
	category: 'productivity',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
