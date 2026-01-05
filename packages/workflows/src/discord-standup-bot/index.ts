/**
 * Discord Standup Bot
 *
 * Automated daily standup collection and summarization for Discord.
 * Posts standup prompts, collects responses, and summarizes for the team.
 *
 * Zuhandenheit: Team leads don't manage standups - they just read the summary.
 * The standup process becomes invisible; only the insights remain.
 *
 * Integrations: Discord, Notion (optional), Slack (optional cross-post)
 * Trigger: CRON schedule (weekday mornings)
 */

import { defineWorkflow, schedule, webhook } from '@workwayco/sdk';

// Standard standup questions
const DEFAULT_QUESTIONS = [
	"What did you accomplish yesterday?",
	"What are you working on today?",
	"Any blockers or concerns?",
];

export default defineWorkflow({
	name: 'Discord Standup Bot',
	description: 'Automated daily standup collection with AI-powered summaries',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'after_meetings',

		outcomeStatement: {
			suggestion: 'Automate your Discord standups?',
			explanation: 'We\'ll post standup prompts, collect responses, and generate a team summary - all automatically.',
			outcome: 'Standups that run themselves',
		},

		primaryPair: {
			from: 'discord',
			to: 'notion',
			workflowId: 'discord-standup-bot',
			outcome: 'Standups that run themselves',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['discord'],
				workflowId: 'discord-standup-bot',
				priority: 75,
			},
			{
				trigger: 'time_based',
				integrations: ['discord'],
				workflowId: 'discord-standup-bot',
				priority: 80,
			},
		],

		smartDefaults: {
			standupTime: { value: '09:00' },
			timezone: { value: 'America/New_York' },
			collectDuration: { value: 60 },
		},

		essentialFields: ['discord_channel_id'],

		zuhandenheit: {
			timeToValue: 5,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 12,
		trialDays: 14,
		description: 'Free for teams up to 5, then $12/month',
	},

	integrations: [
		{ service: 'discord', scopes: ['bot', 'messages.read', 'messages.write'] },
		{ service: 'notion', scopes: ['write_pages'], optional: true },
		{ service: 'workers-ai', scopes: ['text-generation'], optional: true },
	],

	config: {
		discord_channel_id: {
			type: 'text',
			label: 'Standup Channel',
			required: true,
			description: 'Channel where standups will be posted',
		},
		standup_time: {
			type: 'time',
			label: 'Standup Time',
			default: '09:00',
			description: 'When to post the standup prompt (local time)',
		},
		timezone: {
			type: 'text',
			label: 'Timezone',
			default: 'America/New_York',
			description: 'Your team\'s timezone',
		},
		collect_duration: {
			type: 'number',
			label: 'Collection Window (minutes)',
			default: 60,
			description: 'How long to wait for responses before summarizing',
		},
		custom_questions: {
			type: 'text_list',
			label: 'Custom Questions',
			required: false,
			description: 'Override default standup questions (one per line)',
		},
		notion_database_id: {
			type: 'text',
			label: 'Archive to Notion (optional)',
			required: false,
			description: 'Optionally save standup summaries to Notion',
		},
		mention_role: {
			type: 'text',
			label: 'Role to Mention',
			required: false,
			description: 'Role to @mention when posting standup prompt',
		},
		skip_weekends: {
			type: 'boolean',
			label: 'Skip Weekends',
			default: true,
			description: 'Don\'t post standups on Saturday/Sunday',
		},
		enable_a_i_summary: {
			type: 'boolean',
			label: 'AI Summary',
			default: true,
			description: 'Generate AI-powered summary of responses',
		},
	},

	// Dual trigger: scheduled start + webhook for response collection
	trigger: schedule({
		cron: '0 9 * * 1-5', // Default: 9 AM weekdays (overridden by standupTime input)
		timezone: 'America/New_York',
	}),

	async execute({ trigger, inputs, integrations, storage }) {
		const today = new Date().toISOString().split('T')[0];
		const storageKey = `standup:${inputs.discordChannelId}:${today}`;

		// Check if we're in "post prompt" mode or "collect and summarize" mode
		const standupState = await storage.get(storageKey);

		if (!standupState) {
			// Phase 1: Post the standup prompt
			return await postStandupPrompt({
				today,
				inputs,
				integrations,
				storage,
				storageKey,
			});
		} else if (standupState.phase === 'collecting') {
			// Phase 2: Collect responses and summarize
			return await collectAndSummarize({
				today,
				standupState,
				inputs,
				integrations,
				storage,
				storageKey,
			});
		}

		return {
			success: true,
			skipped: true,
			reason: 'Standup already completed for today',
		};
	},

	onError: async ({ error, trigger }) => {
		console.error('Discord Standup Bot failed:', error.message);
	},
});

// ============================================================================
// PHASE HANDLERS
// ============================================================================

interface StandupContext {
	today: string;
	inputs: any;
	integrations: any;
	storage: any;
	storageKey: string;
}

/**
 * Phase 1: Post the standup prompt to Discord
 */
async function postStandupPrompt(ctx: StandupContext) {
	const { today, inputs, integrations, storage, storageKey } = ctx;

	const questions = inputs.customQuestions?.length > 0
		? inputs.customQuestions
		: DEFAULT_QUESTIONS;

	// Build the standup prompt message
	const questionList = questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n');

	const mention = inputs.mentionRole ? `<@&${inputs.mentionRole}> ` : '';
	const content = `${mention}Good morning! Time for standup.\n\nPlease reply with your update:\n${questionList}\n\nResponses will be collected for the next ${inputs.collectDuration} minutes.`;

	// Post the prompt
	const promptMessage = await integrations.discord.channels.sendMessage({
		channelId: inputs.discordChannelId,
		content,
		embeds: [{
			title: `Daily Standup - ${today}`,
			color: 0x5865F2, // Discord blurple
			footer: {
				text: 'Reply to this message with your standup update',
			},
		}],
	});

	if (!promptMessage.success) {
		throw new Error(`Failed to post standup prompt: ${promptMessage.error?.message}`);
	}

	// Store state for phase 2
	await storage.set(storageKey, {
		phase: 'collecting',
		promptMessageId: promptMessage.data.id,
		postedAt: Date.now(),
		collectUntil: Date.now() + (inputs.collectDuration * 60 * 1000),
		questions,
	});

	// Schedule phase 2 (collect and summarize)
	// In production, this would use Cloudflare Durable Objects alarms
	// For now, we rely on the next scheduled trigger or webhook

	return {
		success: true,
		phase: 'prompt_posted',
		messageId: promptMessage.data.id,
		collectUntil: new Date(Date.now() + (inputs.collectDuration * 60 * 1000)).toISOString(),
	};
}

/**
 * Phase 2: Collect responses and generate summary
 */
async function collectAndSummarize(ctx: StandupContext & { standupState: any }) {
	const { today, standupState, inputs, integrations, storage, storageKey } = ctx;

	// Fetch messages from the channel since the prompt was posted
	const messages = await integrations.discord.channels.getMessages({
		channelId: inputs.discordChannelId,
		after: standupState.promptMessageId,
		limit: 100,
	});

	if (!messages.success) {
		throw new Error(`Failed to fetch messages: ${messages.error?.message}`);
	}

	// Filter to only user responses (not bot messages, not the original prompt)
	const responses = messages.data.items.filter((msg: any) =>
		!msg.author.bot &&
		msg.id !== standupState.promptMessageId &&
		msg.content.trim().length > 0
	);

	if (responses.length === 0) {
		// No responses - post a reminder or skip
		await integrations.discord.channels.sendMessage({
			channelId: inputs.discordChannelId,
			content: `No standup responses received today. Don't forget to update the team tomorrow!`,
		});

		await storage.set(storageKey, { ...standupState, phase: 'completed', responses: 0 });

		return {
			success: true,
			phase: 'completed',
			responseCount: 0,
			skipped: true,
			reason: 'No responses received',
		};
	}

	// Format responses for summary
	const formattedResponses = responses.map((msg: any) => ({
		user: msg.author.username,
		userId: msg.author.id,
		content: msg.content,
		timestamp: msg.timestamp,
	}));

	// Generate summary
	let summary: string;
	if (inputs.enableAISummary && integrations.workersAi) {
		summary = await generateAISummary(formattedResponses, standupState.questions, integrations);
	} else {
		summary = generateBasicSummary(formattedResponses);
	}

	// Post summary to Discord
	const summaryMessage = await integrations.discord.channels.sendMessage({
		channelId: inputs.discordChannelId,
		embeds: [{
			title: `Standup Summary - ${today}`,
			description: summary,
			color: 0x57F287, // Green
			fields: [
				{
					name: 'Participants',
					value: [...new Set(formattedResponses.map((r: any) => r.user))].join(', '),
					inline: true,
				},
				{
					name: 'Responses',
					value: responses.length.toString(),
					inline: true,
				},
			],
			footer: {
				text: 'Powered by WORKWAY',
			},
		}],
	});

	// Archive to Notion if configured
	let notionPageId: string | undefined;
	if (inputs.notionDatabaseId) {
		const notionPage = await archiveToNotion({
			today,
			summary,
			responses: formattedResponses,
			inputs,
			integrations,
		});
		notionPageId = notionPage?.id;
	}

	// Mark as completed
	await storage.set(storageKey, {
		...standupState,
		phase: 'completed',
		responses: responses.length,
		summaryMessageId: summaryMessage.data?.id,
		notionPageId,
	});

	return {
		success: true,
		phase: 'completed',
		responseCount: responses.length,
		participants: [...new Set(formattedResponses.map((r: any) => r.user))],
		summaryMessageId: summaryMessage.data?.id,
		notionPageId,
	};
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate AI-powered summary using Workers AI
 */
async function generateAISummary(
	responses: Array<{ user: string; content: string }>,
	questions: string[],
	integrations: any
): Promise<string> {
	const responsesText = responses
		.map(r => `**${r.user}**: ${r.content}`)
		.join('\n\n');

	const prompt = `You are a helpful assistant that summarizes team standup meetings.

The standup questions were:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Here are the team's responses:
${responsesText}

Please provide a brief summary (2-3 paragraphs) that:
1. Highlights key accomplishments from yesterday
2. Notes what the team is focused on today
3. Calls out any blockers or concerns that need attention

Keep the tone professional but friendly. Use bullet points where helpful.`;

	try {
		const result = await integrations.workersAi.textGeneration({
			model: '@cf/meta/llama-3-8b-instruct',
			prompt,
			max_tokens: 500,
		});

		if (result.success) {
			return result.data.response;
		}
	} catch (error) {
		console.error('AI summary failed, falling back to basic:', error);
	}

	// Fallback to basic summary
	return generateBasicSummary(responses);
}

/**
 * Generate a basic summary without AI
 */
function generateBasicSummary(responses: Array<{ user: string; content: string }>): string {
	const participants = [...new Set(responses.map(r => r.user))];

	return `**${participants.length} team members** shared their updates today.\n\n` +
		responses.map(r => `- **${r.user}**: ${r.content.substring(0, 150)}${r.content.length > 150 ? '...' : ''}`).join('\n');
}

/**
 * Archive standup to Notion
 */
async function archiveToNotion(ctx: {
	today: string;
	summary: string;
	responses: Array<{ user: string; content: string }>;
	inputs: any;
	integrations: any;
}): Promise<{ id: string } | undefined> {
	const { today, summary, responses, inputs, integrations } = ctx;

	try {
		const page = await integrations.notion.pages.create({
			parent: { database_id: inputs.notionDatabaseId },
			properties: {
				Name: {
					title: [{ text: { content: `Standup - ${today}` } }],
				},
				Date: {
					date: { start: today },
				},
				Participants: {
					number: [...new Set(responses.map(r => r.user))].length,
				},
			},
			children: [
				{
					type: 'heading_2',
					heading_2: {
						rich_text: [{ type: 'text', text: { content: 'Summary' } }],
					},
				},
				{
					type: 'paragraph',
					paragraph: {
						rich_text: [{ type: 'text', text: { content: summary } }],
					},
				},
				{
					type: 'heading_2',
					heading_2: {
						rich_text: [{ type: 'text', text: { content: 'Individual Updates' } }],
					},
				},
				...responses.map(r => ({
					type: 'callout' as const,
					callout: {
						rich_text: [{ type: 'text' as const, text: { content: r.content } }],
						icon: { type: 'emoji' as const, emoji: '👤' as const },
					},
				})),
			],
		});

		if (page.success) {
			return { id: page.data.id };
		}
	} catch (error) {
		console.error('Failed to archive to Notion:', error);
	}

	return undefined;
}

export const metadata = {
	id: 'discord-standup-bot',
	category: 'team-collaboration',
	featured: true,
	stats: { rating: 4.7, users: 523, reviews: 38 },
};
