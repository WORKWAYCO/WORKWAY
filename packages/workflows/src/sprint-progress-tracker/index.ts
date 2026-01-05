/**
 * Sprint Progress Tracker
 *
 * Compound workflow: Linear → Slack + Notion (dev team updates)
 *
 * Automates sprint visibility:
 * 1. Polls Linear for sprint/cycle updates
 * 2. Posts daily progress to Slack with burndown stats
 * 3. Logs sprint history in Notion
 * 4. AI identifies blockers and suggests prioritization
 *
 * Zuhandenheit: "Sprint progress appears in Slack every morning"
 * not "manually check Linear and post updates"
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Sprint Progress Tracker',
	description:
		'Automatically post daily sprint progress to Slack, track velocity in Notion, and get AI-powered blocker alerts',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'every_morning',

		outcomeStatement: {
			suggestion: 'Want sprint updates that post themselves?',
			explanation: 'Every morning, we\'ll summarize sprint progress, highlight blockers, and post to Slack.',
			outcome: 'Sprint updates on autopilot',
		},

		primaryPair: {
			from: 'linear',
			to: 'slack',
			workflowId: 'sprint-progress-tracker',
			outcome: 'Sprint progress in Slack every morning',
		},

		additionalPairs: [
			{ from: 'linear', to: 'notion', workflowId: 'sprint-progress-tracker', outcome: 'Sprint history in Notion' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['linear', 'slack'],
				workflowId: 'sprint-progress-tracker',
				priority: 85,
			},
			{
				trigger: 'time_based',
				integrations: ['linear'],
				workflowId: 'sprint-progress-tracker',
				priority: 70,
			},
		],

		smartDefaults: {
			scheduleHour: { value: 9 },
			includeBlockers: { value: true },
			enableAIInsights: { value: true },
		},

		essentialFields: ['slack_channel'],

		zuhandenheit: {
			timeToValue: 1440, // Next morning
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 12,
		trialDays: 14,
		description: 'Free for 1 team, $12/month for unlimited teams',
	},

	integrations: [
		{ service: 'linear', scopes: ['read'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'] },
		{ service: 'notion', scopes: ['write_pages', 'read_databases'], optional: true },
	],

	config: {
		linear_team_id: {
			type: 'text',
			label: 'Linear Team',
			required: true,
			description: 'Select the Linear team to track',
		},
		slack_channel: {
			type: 'text',
			label: 'Updates Channel',
			required: true,
			description: 'Channel for daily sprint updates',
		},
		notion_database_id: {
			type: 'text',
			label: 'Sprint History Database',
			required: false,
			description: 'Optional: Notion database to log sprint metrics',
		},
		schedule_hour: {
			type: 'number',
			label: 'Update Hour (24h)',
			default: 9,
			min: 0,
			max: 23,
			description: 'Hour to post daily update',
		},
		include_blockers: {
			type: 'boolean',
			label: 'Highlight Blockers',
			default: true,
			description: 'Flag issues marked as blocked',
		},
		include_velocity: {
			type: 'boolean',
			label: 'Show Velocity Stats',
			default: true,
			description: 'Include points completed vs planned',
		},
		enable_a_i_insights: {
			type: 'boolean',
			label: 'AI Sprint Insights',
			default: true,
			description: 'Get AI analysis of sprint health and suggestions',
		},
	},

	trigger: schedule({
		cron: '0 9 * * 1-5', // Weekdays at 9am
		timezone: 'America/New_York',
	}),

	async execute({ trigger, inputs, integrations, env }) {
		// 1. Fetch current cycle/sprint from Linear
		const cycleData = await integrations.linear.cycles.getCurrent({
			teamId: inputs.linearTeamId,
		});

		if (!cycleData.success || !cycleData.data) {
			// No active cycle, post simple status
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: '📊 No active sprint cycle found in Linear',
			});
			return { success: true, noCycle: true };
		}

		const cycle = cycleData.data;

		// 2. Get issues in current cycle
		const issuesData = await integrations.linear.issues.list({
			teamId: inputs.linearTeamId,
			cycleId: cycle.id,
		});

		const issues = issuesData.success ? issuesData.data : [];

		// 3. Calculate metrics
		const metrics = calculateSprintMetrics(issues, cycle);

		// 4. AI Insights (optional)
		let aiInsights: AISprintInsights | null = null;
		if (inputs.enableAIInsights && env.AI) {
			aiInsights = await generateSprintInsights(env.AI, metrics, issues);
		}

		// 5. Post to Slack
		const slackBlocks = buildSlackBlocks(cycle, metrics, aiInsights, inputs);

		await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			blocks: slackBlocks,
			text: `Sprint Update: ${metrics.completedPoints}/${metrics.totalPoints} points complete`,
		});

		// 6. Log to Notion (optional)
		let notionPageId: string | null = null;
		if (inputs.notionDatabaseId && integrations.notion) {
			const page = await integrations.notion.pages.create({
				parent: { database_id: inputs.notionDatabaseId },
				properties: {
					Name: {
						title: [{ text: { content: `Sprint ${cycle.number} - ${new Date().toLocaleDateString()}` } }],
					},
					'Sprint Number': { number: cycle.number },
					Date: { date: { start: new Date().toISOString().split('T')[0] } },
					'Points Completed': { number: metrics.completedPoints },
					'Points Total': { number: metrics.totalPoints },
					'Completion %': { number: metrics.completionPercentage },
					'Issues Completed': { number: metrics.completedCount },
					'Issues In Progress': { number: metrics.inProgressCount },
					'Blockers': { number: metrics.blockedCount },
				},
			});

			if (page.success) {
				notionPageId = page.data.id;
			}
		}

		return {
			success: true,
			sprint: {
				number: cycle.number,
				name: cycle.name,
				startsAt: cycle.startsAt,
				endsAt: cycle.endsAt,
			},
			metrics: {
				completedPoints: metrics.completedPoints,
				totalPoints: metrics.totalPoints,
				completionPercentage: metrics.completionPercentage,
				blockedCount: metrics.blockedCount,
			},
			created: {
				notionPageId,
			},
			notifications: {
				slack: true,
			},
			aiInsights: aiInsights ? {
				health: aiInsights.health,
				suggestionsCount: aiInsights.suggestions.length,
			} : undefined,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Sprint Tracker Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface SprintMetrics {
	totalPoints: number;
	completedPoints: number;
	inProgressPoints: number;
	completionPercentage: number;
	totalCount: number;
	completedCount: number;
	inProgressCount: number;
	blockedCount: number;
	blockedIssues: Array<{ title: string; assignee?: string }>;
	byAssignee: Record<string, { completed: number; total: number }>;
}

interface AISprintInsights {
	health: 'on-track' | 'at-risk' | 'behind';
	summary: string;
	blockerAnalysis: string;
	suggestions: string[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateSprintMetrics(issues: any[], cycle: any): SprintMetrics {
	let totalPoints = 0;
	let completedPoints = 0;
	let inProgressPoints = 0;
	let completedCount = 0;
	let inProgressCount = 0;
	let blockedCount = 0;
	const blockedIssues: Array<{ title: string; assignee?: string }> = [];
	const byAssignee: Record<string, { completed: number; total: number }> = {};

	for (const issue of issues) {
		const points = issue.estimate || 1;
		const assignee = issue.assignee?.name || 'Unassigned';

		totalPoints += points;

		if (!byAssignee[assignee]) {
			byAssignee[assignee] = { completed: 0, total: 0 };
		}
		byAssignee[assignee].total += points;

		const state = issue.state?.name?.toLowerCase() || '';

		if (state.includes('done') || state.includes('complete') || state.includes('closed')) {
			completedPoints += points;
			completedCount++;
			byAssignee[assignee].completed += points;
		} else if (state.includes('progress') || state.includes('review')) {
			inProgressPoints += points;
			inProgressCount++;
		}

		if (issue.labels?.some((l: any) => l.name?.toLowerCase().includes('block'))) {
			blockedCount++;
			blockedIssues.push({
				title: issue.title,
				assignee: issue.assignee?.name,
			});
		}
	}

	return {
		totalPoints,
		completedPoints,
		inProgressPoints,
		completionPercentage: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0,
		totalCount: issues.length,
		completedCount,
		inProgressCount,
		blockedCount,
		blockedIssues,
		byAssignee,
	};
}

async function generateSprintInsights(
	ai: any,
	metrics: SprintMetrics,
	issues: any[]
): Promise<AISprintInsights | null> {
	try {
		const prompt = `Analyze this sprint progress and provide insights.

Sprint Metrics:
- Completion: ${metrics.completionPercentage}% (${metrics.completedPoints}/${metrics.totalPoints} points)
- In Progress: ${metrics.inProgressCount} issues (${metrics.inProgressPoints} points)
- Blocked: ${metrics.blockedCount} issues
${metrics.blockedIssues.length > 0 ? `\nBlocked Issues:\n${metrics.blockedIssues.map(i => `- ${i.title} (${i.assignee || 'Unassigned'})`).join('\n')}` : ''}

Provide a JSON response:
{
  "health": "on-track" | "at-risk" | "behind",
  "summary": "one sentence sprint health summary",
  "blockerAnalysis": "analysis of blockers if any",
  "suggestions": ["actionable suggestion 1", "suggestion 2"]
}`;

		const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 250,
		});

		const text = result.response || '';
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]);
		}
	} catch (e) {
		// Graceful degradation
	}
	return null;
}

function buildSlackBlocks(
	cycle: any,
	metrics: SprintMetrics,
	aiInsights: AISprintInsights | null,
	inputs: any
): any[] {
	const healthEmoji = aiInsights
		? aiInsights.health === 'on-track' ? '🟢' : aiInsights.health === 'at-risk' ? '🟡' : '🔴'
		: '📊';

	const progressBar = getProgressBar(metrics.completionPercentage);

	const blocks: any[] = [
		{
			type: 'header',
			text: { type: 'plain_text', text: `${healthEmoji} Sprint ${cycle.number} Progress` },
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Progress:* ${progressBar} ${metrics.completionPercentage}%\n*Points:* ${metrics.completedPoints}/${metrics.totalPoints} complete`,
			},
		},
		{
			type: 'section',
			fields: [
				{ type: 'mrkdwn', text: `*Completed:*\n${metrics.completedCount} issues` },
				{ type: 'mrkdwn', text: `*In Progress:*\n${metrics.inProgressCount} issues` },
				{ type: 'mrkdwn', text: `*Blocked:*\n${metrics.blockedCount} issues` },
				{ type: 'mrkdwn', text: `*Days Left:*\n${getDaysRemaining(cycle.endsAt)}` },
			],
		},
	];

	// Add blockers if enabled
	if (inputs.includeBlockers && metrics.blockedIssues.length > 0) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `🚧 *Blockers:*\n${metrics.blockedIssues.slice(0, 3).map(i => `• ${i.title}`).join('\n')}`,
			},
		});
	}

	// Add AI insights
	if (aiInsights) {
		blocks.push(
			{ type: 'divider' },
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `🤖 *AI Analysis:* ${aiInsights.summary}`,
				},
			}
		);

		if (aiInsights.suggestions.length > 0) {
			blocks.push({
				type: 'context',
				elements: [
					{
						type: 'mrkdwn',
						text: `💡 ${aiInsights.suggestions[0]}`,
					},
				],
			});
		}
	}

	return blocks;
}

function getProgressBar(percentage: number): string {
	const filled = Math.round(percentage / 10);
	const empty = 10 - filled;
	return '█'.repeat(filled) + '░'.repeat(empty);
}

function getDaysRemaining(endDate: string): string {
	const end = new Date(endDate);
	const now = new Date();
	const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
	return days <= 0 ? 'Sprint ended' : `${days} days`;
}

export const metadata = {
	id: 'sprint-progress-tracker',
	category: 'team-management',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
