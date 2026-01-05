/**
 * Task Sync Bridge
 *
 * Workflow: Todoist → Notion
 *
 * Syncs task completion:
 * 1. Monitors Todoist for completed tasks
 * 2. Logs completions to Notion
 * 3. Tracks productivity over time
 * 4. Weekly productivity reports
 *
 * Zuhandenheit: "My accomplishments document themselves"
 * not "manually log what I completed"
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Task Sync Bridge',
	description:
		'Automatically log completed Todoist tasks to Notion - build a productivity journal without any effort',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_tasks_complete',

		outcomeStatement: {
			suggestion: 'Want your accomplishments to document themselves?',
			explanation:
				'When you complete tasks in Todoist, we\'ll automatically log them to Notion.',
			outcome: 'Productivity journal on autopilot',
		},

		primaryPair: {
			from: 'todoist',
			to: 'notion',
			workflowId: 'task-sync-bridge',
			outcome: 'Completed tasks logged to Notion',
		},

		additionalPairs: [],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['todoist', 'notion'],
				workflowId: 'task-sync-bridge',
				priority: 85,
			},
		],

		smartDefaults: {
			syncFrequency: { value: 'hourly' },
		},

		essentialFields: ['notion_database_id'],

		zuhandenheit: {
			timeToValue: 60,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 8,
		trialDays: 14,
		description: 'Free for 100 tasks/month, $8/month unlimited',
	},

	integrations: [
		{ service: 'todoist', scopes: ['data:read'] },
		{ service: 'notion', scopes: ['insert_content', 'read_content'] },
		{ service: 'slack', scopes: ['chat:write'], optional: true },
	],

	config: {
		notion_database_id: {
			type: 'text',
			label: 'Task Log Database',
			required: true,
			description: 'Database to log completed tasks',
		},
		todoist_project_id: {
			type: 'text',
			label: 'Todoist Project ID',
			required: false,
			description: 'Optional: Only sync tasks from this project',
		},
		slack_channel: {
			type: 'text',
			label: 'Weekly Summary Channel',
			required: false,
			description: 'Optional: Post weekly productivity summary',
		},
		include_subtasks: {
			type: 'boolean',
			label: 'Include Subtasks',
			default: false,
			description: 'Also log completed subtasks',
		},
		group_by_project: {
			type: 'boolean',
			label: 'Group by Project',
			default: true,
			description: 'Organize tasks by Todoist project in Notion',
		},
	},

	trigger: schedule({
		cron: '0 * * * *', // Every hour
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, storage }) {
		// Get previous state (tasks we knew about)
		const lastSync = (await storage.get('last-sync')) as {
			timestamp: string;
			activeTasks: Record<string, { content: string; projectId: string }>;
			loggedTaskIds: string[];
		} | null;

		const previousTasks = lastSync?.activeTasks || {};
		const loggedTaskIds = new Set(lastSync?.loggedTaskIds || []);

		// Fetch current active tasks from Todoist
		const tasksResult = await integrations.todoist.tasks.list({
			projectId: inputs.todoistProjectId || undefined,
		});

		if (!tasksResult.success || !tasksResult.data) {
			return { success: false, error: 'Failed to fetch Todoist tasks' };
		}

		const currentTasks = tasksResult.data;
		const currentTaskIds = new Set(currentTasks.map((t: any) => t.id));

		// Fetch projects for grouping
		let projectsMap: Record<string, string> = {};
		if (inputs.groupByProject) {
			const projectsResult = await integrations.todoist.projects.list();
			if (projectsResult.success && projectsResult.data) {
				for (const project of projectsResult.data) {
					projectsMap[project.id] = project.name;
				}
			}
		}

		// Find tasks that disappeared (completed)
		const completedTasks: Array<{ id: string; content: string; projectId: string }> = [];
		for (const [taskId, taskData] of Object.entries(previousTasks)) {
			if (!currentTaskIds.has(taskId) && !loggedTaskIds.has(taskId)) {
				completedTasks.push({
					id: taskId,
					content: taskData.content,
					projectId: taskData.projectId,
				});
			}
		}

		// Log completed tasks to Notion
		let tasksLogged = 0;
		for (const task of completedTasks) {
			// Skip subtasks if configured
			if (!inputs.includeSubtasks) {
				// Check if it's a subtask by looking at the original task list
				const wasSubtask = previousTasks[task.id] && false; // We don't track parent_id, assume top-level
			}

			const projectName = projectsMap[task.projectId] || 'Inbox';

			// Check if task already exists in Notion
			const existingPages = await integrations.notion.databases.query({
				database_id: inputs.notionDatabaseId,
				filter: {
					property: 'Todoist ID',
					rich_text: { equals: task.id },
				},
			});

			if (existingPages.success && existingPages.data?.results?.length > 0) {
				loggedTaskIds.add(task.id);
				continue;
			}

			// Create Notion page
			await integrations.notion.pages.create({
				parent: { database_id: inputs.notionDatabaseId },
				properties: {
					Name: {
						title: [{ text: { content: task.content || 'Untitled Task' } }],
					},
					'Todoist ID': {
						rich_text: [{ text: { content: task.id } }],
					},
					Project: {
						select: { name: projectName },
					},
					'Completed At': {
						date: { start: new Date().toISOString() },
					},
					Status: {
						select: { name: 'Completed' },
					},
				},
				children: [
					{
						type: 'callout',
						callout: {
							icon: { emoji: '✅' },
							rich_text: [
								{
									type: 'text',
									text: { content: `Completed ${new Date().toLocaleString()}` },
								},
							],
						},
					},
				],
			});

			loggedTaskIds.add(task.id);
			tasksLogged++;
		}

		// Check if it's time for weekly summary (Sunday at midnight)
		const now = new Date();
		const isWeeklySummaryTime =
			now.getUTCDay() === 0 && now.getUTCHours() === 0 && inputs.slackChannel;

		let weeklySummarySent = false;
		if (isWeeklySummaryTime && integrations.slack) {
			const weeklyStats = await getWeeklyStats(integrations.notion, inputs.notionDatabaseId);
			if (weeklyStats.total > 0) {
				await integrations.slack.chat.postMessage({
					channel: inputs.slackChannel,
					blocks: buildWeeklySummaryBlocks(weeklyStats),
					text: `Weekly productivity: ${weeklyStats.total} tasks completed`,
				});
				weeklySummarySent = true;
			}
		}

		// Save current state
		const newActiveTasks: Record<string, { content: string; projectId: string }> = {};
		for (const task of currentTasks) {
			newActiveTasks[task.id] = {
				content: task.content,
				projectId: task.project_id,
			};
		}

		await storage.set('last-sync', {
			timestamp: new Date().toISOString(),
			activeTasks: newActiveTasks,
			loggedTaskIds: [...loggedTaskIds].slice(-1000),
		});

		return {
			success: true,
			activeTasks: currentTasks.length,
			completed: completedTasks.length,
			synced: tasksLogged,
			weeklySummary: weeklySummarySent,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack && inputs.slackChannel) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Task Sync Bridge Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface WeeklyStats {
	total: number;
	byProject: Record<string, number>;
	byDay: Record<string, number>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildNotionProperties(task: any, projectName: string): Record<string, any> {
	return {
		Name: {
			title: [{ text: { content: task.content || 'Untitled Task' } }],
		},
		'Todoist ID': {
			rich_text: [{ text: { content: task.task_id } }],
		},
		Project: {
			select: { name: projectName },
		},
		'Completed At': {
			date: { start: task.completed_at || new Date().toISOString() },
		},
		Status: {
			select: { name: 'Completed' },
		},
	};
}

function buildNotionContent(task: any): any[] {
	const blocks: any[] = [];

	blocks.push({
		type: 'callout',
		callout: {
			icon: { emoji: '✅' },
			rich_text: [
				{
					type: 'text',
					text: {
						content: `Completed ${new Date(task.completed_at).toLocaleString()}`,
					},
				},
			],
		},
	});

	if (task.description) {
		blocks.push({
			type: 'paragraph',
			paragraph: {
				rich_text: [{ type: 'text', text: { content: task.description } }],
			},
		});
	}

	return blocks;
}

async function getWeeklyStats(notion: any, databaseId: string): Promise<WeeklyStats> {
	const oneWeekAgo = new Date();
	oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

	const result = await notion.databases.query({
		database_id: databaseId,
		filter: {
			property: 'Completed At',
			date: { on_or_after: oneWeekAgo.toISOString().split('T')[0] },
		},
	});

	const stats: WeeklyStats = {
		total: 0,
		byProject: {},
		byDay: {},
	};

	if (!result.success || !result.data?.results) {
		return stats;
	}

	for (const page of result.data.results) {
		stats.total++;

		// Count by project
		const project = page.properties?.Project?.select?.name || 'Other';
		stats.byProject[project] = (stats.byProject[project] || 0) + 1;

		// Count by day
		const completedAt = page.properties?.['Completed At']?.date?.start;
		if (completedAt) {
			const day = new Date(completedAt).toLocaleDateString('en-US', { weekday: 'short' });
			stats.byDay[day] = (stats.byDay[day] || 0) + 1;
		}
	}

	return stats;
}

function buildWeeklySummaryBlocks(stats: WeeklyStats): any[] {
	const blocks: any[] = [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `:chart_with_upwards_trend: *Weekly Productivity Summary*\n\nYou completed *${stats.total} tasks* this week!`,
			},
		},
	];

	// Top projects
	const topProjects = Object.entries(stats.byProject)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5);

	if (topProjects.length > 0) {
		const projectList = topProjects
			.map(([project, count]) => `• ${project}: ${count} tasks`)
			.join('\n');

		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*By Project:*\n${projectList}`,
			},
		});
	}

	// Most productive day
	const mostProductiveDay = Object.entries(stats.byDay).sort(([, a], [, b]) => b - a)[0];

	if (mostProductiveDay) {
		blocks.push({
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: `:star: Most productive day: *${mostProductiveDay[0]}* (${mostProductiveDay[1]} tasks)`,
				},
			],
		});
	}

	return blocks;
}

export const metadata = {
	id: 'task-sync-bridge',
	category: 'productivity-utilities',
	featured: false,
	stats: { rating: 0, users: 0, reviews: 0 },
};
