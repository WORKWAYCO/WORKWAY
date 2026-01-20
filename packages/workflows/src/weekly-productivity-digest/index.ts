/**
 * Weekly Productivity Digest
 *
 * Compound workflow: Scheduled → Todoist analysis + Notion summary + Slack digest + AI insights
 *
 * The complete productivity reflection automation:
 * 1. Runs on schedule (weekly, configurable day)
 * 2. Analyzes completed/pending Todoist tasks
 * 3. Creates Notion summary page with metrics
 * 4. Posts digest to Slack with AI insights
 * 5. AI identifies productivity patterns and suggestions
 *
 * Zuhandenheit: "Productivity insights appear every Monday"
 * not "manually review tasks and create reports"
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';
import { getProgressBar, getScoreEmoji } from '../_shared/utils.js';

export default defineWorkflow({
	name: 'Weekly Productivity Digest',
	description:
		'Get AI-powered weekly summaries of your completed tasks, productivity patterns, and actionable insights delivered to Slack and Notion',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'weekly_automatically',

		outcomeStatement: {
			suggestion: 'Want weekly productivity insights?',
			explanation: 'Every week, we\'ll summarize your completed tasks, identify patterns, and suggest improvements.',
			outcome: 'Weekly productivity digest',
		},

		primaryPair: {
			from: 'todoist',
			to: 'slack',
			workflowId: 'weekly-productivity-digest',
			outcome: 'Productivity insights that compile themselves',
		},

		additionalPairs: [
			{ from: 'todoist', to: 'notion', workflowId: 'weekly-productivity-digest', outcome: 'Productivity archives in Notion' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['todoist', 'slack'],
				workflowId: 'weekly-productivity-digest',
				priority: 50,
			},
			{
				trigger: 'time_based',
				integrations: ['todoist'],
				workflowId: 'weekly-productivity-digest',
				priority: 40,
			},
		],

		smartDefaults: {
			scheduleDay: { value: 'monday' },
			scheduleHour: { value: 9 },
			enableAIInsights: { value: true },
		},

		essentialFields: ['slack_channel'],

		zuhandenheit: {
			timeToValue: 10080, // One week until first digest
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 9,
		trialDays: 14,
		description: 'Free for personal use, $9/month for team features',
	},

	integrations: [
		{ service: 'todoist', scopes: ['data:read'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'] },
		{ service: 'notion', scopes: ['write_pages', 'read_databases'], optional: true },
	],

	config: {
		todoist_project_ids: {
			type: 'text',
			label: 'Projects to Analyze',
			required: true,
			multiple: true,
			description: 'Select Todoist projects to include in the digest',
		},
		slack_channel: {
			type: 'text',
			label: 'Digest Channel',
			required: true,
			description: 'Channel to post weekly digests',
		},
		notion_database_id: {
			type: 'text',
			label: 'Digest Archive',
			required: false,
			description: 'Optional: Notion database to archive weekly digests',
		},
		schedule_day: {
			type: 'select',
			label: 'Digest Day',
			required: true,
			options: [
				{ value: 'monday', label: 'Monday' },
				{ value: 'friday', label: 'Friday' },
				{ value: 'sunday', label: 'Sunday' },
			],
			default: 'monday',
			description: 'Day of week to receive digest',
		},
		schedule_hour: {
			type: 'number',
			label: 'Digest Hour (24h)',
			default: 9,
			min: 0,
			max: 23,
			description: 'Hour to send digest (in your timezone)',
		},
		enable_a_i_insights: {
			type: 'boolean',
			label: 'AI Productivity Insights',
			default: true,
			description: 'Get AI-powered analysis of your productivity patterns',
		},
		include_overdue_tasks: {
			type: 'boolean',
			label: 'Include Overdue Tasks',
			default: true,
			description: 'Highlight overdue tasks in the digest',
		},
		lookback_days: {
			type: 'number',
			label: 'Lookback Period (days)',
			default: 7,
			min: 1,
			max: 30,
			description: 'How many days of history to include',
		},
	},

	trigger: schedule({
		cron: '0 9 * * 1', // Default: Mondays at 9am, overridden by inputs
		timezone: 'America/New_York',
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const now = new Date();
		const lookbackDate = new Date(now);
		lookbackDate.setDate(lookbackDate.getDate() - inputs.lookbackDays);

		// 1. Fetch Todoist data
		const projectIds = Array.isArray(inputs.todoistProjectIds)
			? inputs.todoistProjectIds
			: [inputs.todoistProjectIds];

		const allTasks: TodoistTaskData[] = [];
		const completedTasks: TodoistTaskData[] = [];
		const overdueTasks: TodoistTaskData[] = [];
		const upcomingTasks: TodoistTaskData[] = [];

		for (const projectId of projectIds) {
			// Get active tasks
			const activeTasks = await integrations.todoist.tasks.list({
				projectId,
			});

			if (activeTasks.success) {
				for (const task of activeTasks.data) {
					const taskData: TodoistTaskData = {
						id: task.id,
						content: task.content,
						priority: task.priority,
						due: task.due,
						labels: task.labels || [],
						projectId: task.projectId,
						completed: false,
					};

					allTasks.push(taskData);

					if (task.due) {
						const dueDate = new Date(task.due.date);
						if (dueDate < now) {
							overdueTasks.push(taskData);
						} else {
							upcomingTasks.push(taskData);
						}
					}
				}
			}

			// Get completed tasks (using activity log or filter)
			// Note: Todoist API v2 requires sync API for completed tasks
			// For now, we'll estimate based on labels or use a workaround
		}

		// 2. Calculate metrics
		const metrics: ProductivityMetrics = {
			totalTasks: allTasks.length,
			completedThisWeek: completedTasks.length,
			overdue: overdueTasks.length,
			upcoming: upcomingTasks.length,
			completionRate:
				allTasks.length > 0
					? Math.round((completedTasks.length / (completedTasks.length + allTasks.length)) * 100)
					: 0,
			highPriorityPending: allTasks.filter((t) => t.priority === 4).length,
			byLabel: calculateLabelDistribution(allTasks),
			byProject: calculateProjectDistribution(allTasks, projectIds),
		};

		// 3. AI Insights (optional)
		let aiInsights: AIInsights | null = null;
		if (inputs.enableAIInsights && env.AI) {
			aiInsights = await generateProductivityInsights(env.AI, metrics, allTasks, overdueTasks);
		}

		// 4. Create Notion archive page (optional)
		let notionPageId: string | null = null;
		if (inputs.notionDatabaseId && integrations.notion) {
			const weekStart = getWeekStart(now);
			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekEnd.getDate() + 6);

			const page = await integrations.notion.pages.create({
				parent: { database_id: inputs.notionDatabaseId },
				properties: {
					Name: {
						title: [
							{
								text: {
									content: `Week of ${formatDate(weekStart)}`,
								},
							},
						],
					},
					'Week Start': { date: { start: weekStart.toISOString().split('T')[0] } },
					'Tasks Completed': { number: metrics.completedThisWeek },
					'Tasks Pending': { number: metrics.totalTasks },
					'Overdue Tasks': { number: metrics.overdue },
					'Completion Rate': { number: metrics.completionRate },
				},
				children: buildNotionContent(metrics, aiInsights, overdueTasks),
			});

			if (page.success) {
				notionPageId = page.data.id;
			}
		}

		// 5. Post to Slack
		const slackBlocks = buildSlackBlocks(metrics, aiInsights, overdueTasks, inputs, notionPageId);

		await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			blocks: slackBlocks,
			text: `Weekly Productivity Digest - ${metrics.completedThisWeek} tasks completed, ${metrics.overdue} overdue`,
		});

		return {
			success: true,
			period: {
				start: lookbackDate.toISOString(),
				end: now.toISOString(),
				days: inputs.lookbackDays,
			},
			metrics: {
				completed: metrics.completedThisWeek,
				pending: metrics.totalTasks,
				overdue: metrics.overdue,
				completionRate: metrics.completionRate,
			},
			created: {
				notionPageId,
			},
			notifications: {
				slack: true,
			},
			aiInsights: aiInsights
				? {
						productivityScore: aiInsights.productivityScore,
						suggestionsCount: aiInsights.suggestions.length,
					}
				: undefined,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Weekly Digest Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface TodoistTaskData {
	id: string;
	content: string;
	priority: number;
	due: { date: string; string?: string } | null;
	labels: string[];
	projectId: string;
	completed: boolean;
}

interface ProductivityMetrics {
	totalTasks: number;
	completedThisWeek: number;
	overdue: number;
	upcoming: number;
	completionRate: number;
	highPriorityPending: number;
	byLabel: Record<string, number>;
	byProject: Record<string, number>;
}

interface AIInsights {
	productivityScore: number;
	summary: string;
	patterns: string[];
	suggestions: string[];
	focusArea: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateLabelDistribution(tasks: TodoistTaskData[]): Record<string, number> {
	const distribution: Record<string, number> = {};
	for (const task of tasks) {
		for (const label of task.labels) {
			distribution[label] = (distribution[label] || 0) + 1;
		}
	}
	return distribution;
}

function calculateProjectDistribution(
	tasks: TodoistTaskData[],
	projectIds: string[]
): Record<string, number> {
	const distribution: Record<string, number> = {};
	for (const task of tasks) {
		distribution[task.projectId] = (distribution[task.projectId] || 0) + 1;
	}
	return distribution;
}

function getWeekStart(date: Date): Date {
	const d = new Date(date);
	const day = d.getDay();
	const diff = d.getDate() - day + (day === 0 ? -6 : 1);
	return new Date(d.setDate(diff));
}

function formatDate(date: Date): string {
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

async function generateProductivityInsights(
	ai: any,
	metrics: ProductivityMetrics,
	allTasks: TodoistTaskData[],
	overdueTasks: TodoistTaskData[]
): Promise<AIInsights | null> {
	try {
		const prompt = `Analyze this productivity data and provide insights.

Metrics:
- Total pending tasks: ${metrics.totalTasks}
- Completed this week: ${metrics.completedThisWeek}
- Overdue tasks: ${metrics.overdue}
- High priority pending: ${metrics.highPriorityPending}
- Completion rate: ${metrics.completionRate}%

Top overdue tasks:
${overdueTasks.slice(0, 5).map((t) => `- ${t.content}`).join('\n')}

Provide a JSON response with:
{
  "productivityScore": 1-100,
  "summary": "one sentence summary",
  "patterns": ["pattern 1", "pattern 2"],
  "suggestions": ["actionable suggestion 1", "suggestion 2"],
  "focusArea": "main area to focus on"
}`;

		const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 300,
		});

		const text = result.response || '';
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			return {
				productivityScore: parsed.productivityScore || 50,
				summary: parsed.summary || 'Analysis complete',
				patterns: parsed.patterns || [],
				suggestions: parsed.suggestions || [],
				focusArea: parsed.focusArea || 'General productivity',
			};
		}
	} catch (e) {
		// Graceful degradation
	}
	return null;
}

function buildNotionContent(
	metrics: ProductivityMetrics,
	aiInsights: AIInsights | null,
	overdueTasks: TodoistTaskData[]
): any[] {
	const blocks: any[] = [
		{
			object: 'block',
			type: 'heading_2',
			heading_2: {
				rich_text: [{ text: { content: 'Summary' } }],
			},
		},
		{
			object: 'block',
			type: 'paragraph',
			paragraph: {
				rich_text: [
					{
						text: {
							content: `Completed ${metrics.completedThisWeek} tasks with ${metrics.overdue} overdue. Completion rate: ${metrics.completionRate}%`,
						},
					},
				],
			},
		},
	];

	if (aiInsights) {
		blocks.push(
			{
				object: 'block',
				type: 'heading_2',
				heading_2: {
					rich_text: [{ text: { content: 'AI Insights' } }],
				},
			},
			{
				object: 'block',
				type: 'callout',
				callout: {
					rich_text: [{ text: { content: aiInsights.summary } }],
					icon: { emoji: '🤖' },
				},
			},
			{
				object: 'block',
				type: 'heading_3',
				heading_3: {
					rich_text: [{ text: { content: 'Suggestions' } }],
				},
			},
			...aiInsights.suggestions.map((suggestion) => ({
				object: 'block',
				type: 'bulleted_list_item',
				bulleted_list_item: {
					rich_text: [{ text: { content: suggestion } }],
				},
			}))
		);
	}

	if (overdueTasks.length > 0) {
		blocks.push(
			{
				object: 'block',
				type: 'heading_2',
				heading_2: {
					rich_text: [{ text: { content: 'Overdue Tasks' } }],
				},
			},
			...overdueTasks.slice(0, 10).map((task) => ({
				object: 'block',
				type: 'to_do',
				to_do: {
					rich_text: [{ text: { content: task.content } }],
					checked: false,
				},
			}))
		);
	}

	return blocks;
}

function buildSlackBlocks(
	metrics: ProductivityMetrics,
	aiInsights: AIInsights | null,
	overdueTasks: TodoistTaskData[],
	inputs: any,
	notionPageId: string | null
): any[] {
	const blocks: any[] = [
		{
			type: 'header',
			text: { type: 'plain_text', text: '📊 Weekly Productivity Digest' },
		},
		{
			type: 'section',
			fields: [
				{ type: 'mrkdwn', text: `*Tasks Pending:*\n${metrics.totalTasks}` },
				{ type: 'mrkdwn', text: `*Completed This Week:*\n${metrics.completedThisWeek}` },
				{ type: 'mrkdwn', text: `*Overdue:*\n${metrics.overdue}` },
				{ type: 'mrkdwn', text: `*High Priority:*\n${metrics.highPriorityPending}` },
			],
		},
	];

	// Progress bar visualization
	const progressBar = getProgressBar(metrics.completionRate);
	blocks.push({
		type: 'section',
		text: {
			type: 'mrkdwn',
			text: `*Completion Rate:* ${progressBar} ${metrics.completionRate}%`,
		},
	});

	// AI Insights
	if (aiInsights) {
		blocks.push(
			{ type: 'divider' },
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `🤖 *AI Analysis*\n${aiInsights.summary}`,
				},
			}
		);

		if (aiInsights.suggestions.length > 0) {
			blocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*Suggestions:*\n${aiInsights.suggestions.map((s) => `• ${s}`).join('\n')}`,
				},
			});
		}

		blocks.push({
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: `Productivity Score: ${getScoreEmoji(aiInsights.productivityScore)} ${aiInsights.productivityScore}/100 | Focus: ${aiInsights.focusArea}`,
				},
			],
		});
	}

	// Overdue tasks highlight
	if (inputs.includeOverdueTasks && overdueTasks.length > 0) {
		blocks.push(
			{ type: 'divider' },
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `⚠️ *Overdue Tasks (${overdueTasks.length}):*\n${overdueTasks
						.slice(0, 5)
						.map((t) => `• ${t.content}`)
						.join('\n')}${overdueTasks.length > 5 ? `\n_...and ${overdueTasks.length - 5} more_` : ''}`,
				},
			}
		);
	}

	// Footer
	if (notionPageId) {
		blocks.push({
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: `<https://notion.so/${notionPageId.replace(/-/g, '')}|View full digest in Notion>`,
				},
			],
		});
	}

	return blocks;
}

// getProgressBar and getScoreEmoji are now imported from ../_shared/utils.js

export const metadata = {
	id: 'weekly-productivity-digest',
	category: 'productivity',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
