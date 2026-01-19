/**
 * Project Time Tracker Workflow
 *
 * Automatically track time spent on Linear issues and sync to
 * Google Sheets for reporting, billing, or project management.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "My time tracks itself"
 *
 * Integrations: Linear, Google Sheets, Slack (optional)
 * Trigger: Linear webhooks (issue state changes) OR weekly cron
 */

import { defineWorkflow, cron, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Project Time Tracker',
	description: 'Time that tracks itself - Linear issue time synced to Google Sheets automatically',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_work_completes',

		outcomeStatement: {
			suggestion: 'Want project time tracked automatically?',
			explanation: 'When Linear issues change state, we calculate time spent and sync to Google Sheets.',
			outcome: 'Time that tracks itself',
		},

		primaryPair: {
			from: 'linear',
			to: 'google-sheets',
			workflowId: 'project-time-tracker',
			outcome: 'Time that tracks itself',
		},

		additionalPairs: [
			{ from: 'linear', to: 'slack', workflowId: 'project-time-tracker', outcome: 'Time reports in Slack' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['linear', 'google-sheets'],
				workflowId: 'project-time-tracker',
				priority: 85,
			},
		],

		smartDefaults: {
			trackByIssue: { value: true },
			groupByProject: { value: true },
			weeklyDigest: { value: true },
		},

		essentialFields: ['spreadsheet_id'],

		zuhandenheit: {
			timeToValue: 3,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.05,
		freeExecutions: 100,
		description: 'Per issue tracked',
	},

	integrations: [
		{ service: 'linear', scopes: ['read', 'issues:read'] },
		{ service: 'google-sheets', scopes: ['spreadsheets'] },
		{ service: 'slack', scopes: ['send_messages'], optional: true },
	],

	config: {
		// Spreadsheet settings
		spreadsheet_id: {
			type: 'text',
			label: 'Google Spreadsheet ID',
			required: true,
			description: 'ID from the spreadsheet URL',
		},
		sheet_name: {
			type: 'text',
			label: 'Sheet Name',
			default: 'Time Tracking',
			description: 'Name of the sheet tab',
		},

		// Tracking settings
		track_by_issue: {
			type: 'boolean',
			label: 'Track by Issue',
			default: true,
			description: 'Create a row for each issue',
		},
		group_by_project: {
			type: 'boolean',
			label: 'Group by Project',
			default: true,
			description: 'Include project column for grouping',
		},
		include_estimates: {
			type: 'boolean',
			label: 'Include Estimates',
			default: true,
			description: 'Track estimated vs actual time',
		},

		// Time calculation
		use_linear_estimates: {
			type: 'boolean',
			label: 'Use Linear Estimates',
			default: true,
			description: 'Use Linear\'s estimate field for time',
		},
		estimate_to_hours: {
			type: 'json',
			label: 'Estimate Mapping',
			default: '{"0": 0, "1": 1, "2": 2, "3": 4, "5": 8, "8": 16}',
			description: 'Map Linear estimates to hours',
		},
		track_cycle_time: {
			type: 'boolean',
			label: 'Track Cycle Time',
			default: true,
			description: 'Calculate time from start to completion',
		},

		// Filtering
		team_ids: {
			type: 'text',
			label: 'Teams to Track',
			required: false,
			description: 'Limit to specific teams (empty = all)',
		},
		project_ids: {
			type: 'text',
			label: 'Projects to Track',
			required: false,
			description: 'Limit to specific projects (empty = all)',
		},
		completed_states: {
			type: 'text',
			label: 'Completed States',
			default: 'Done, Deployed, Released',
			description: 'State names that indicate completion',
		},

		// Slack settings
		slack_channel: {
			type: 'text',
			label: 'Weekly Digest Channel',
			required: false,
			description: 'Channel for weekly time summary',
		},
		weekly_digest: {
			type: 'boolean',
			label: 'Send Weekly Digest',
			default: true,
			description: 'Post weekly summary to Slack',
		},
	},

	trigger: cron({
		schedule: '0 9 * * 1', // 9 AM UTC every Monday
		timezone: 'UTC',
	}),

	webhooks: [
		webhook({
			service: 'linear',
			event: 'Issue.update',
		}),
	],

	async execute({ trigger, inputs, integrations, env }) {
		const results: Array<{
			issue: { id: string; identifier: string; title: string };
			project: string | null;
			estimatedHours: number;
			actualHours: number;
			syncedToSheet: boolean;
		}> = [];

		const isWebhookTrigger = trigger.type === 'webhook';

		// Parse estimate mapping
		let estimateMapping: Record<string, number> = {};
		try {
			estimateMapping = JSON.parse(inputs.estimateToHours || '{}');
		} catch {
			estimateMapping = { '0': 0, '1': 1, '2': 2, '3': 4, '5': 8, '8': 16 };
		}

		// Parse completed states
		const completedStates = (inputs.completedStates || 'Done')
			.split(',')
			.map((s: string) => s.trim().toLowerCase());

		if (isWebhookTrigger) {
			// Single issue update from webhook
			const issueUpdate = trigger.data;
			const issue = issueUpdate.data;

			// Check if state changed to completed
			const newState = issue.state?.name?.toLowerCase();
			if (newState && completedStates.includes(newState)) {
				const result = await processIssue({
					issue,
					inputs,
					integrations,
					env,
					estimateMapping,
				});
				results.push(result);
			}
		} else {
			// Weekly sync - get all completed issues from past week
			const oneWeekAgo = new Date();
			oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

			const issuesResult = await integrations.linear.issues({
				filter: {
					completedAt: { gte: oneWeekAgo.toISOString() },
					team: inputs.teamIds ? { id: { in: inputs.teamIds } } : undefined,
					project: inputs.projectIds ? { id: { in: inputs.projectIds } } : undefined,
				},
			});

			if (issuesResult.success && issuesResult.data?.nodes) {
				for (const issue of issuesResult.data.nodes) {
					const result = await processIssue({
						issue,
						inputs,
						integrations,
						env,
						estimateMapping,
					});
					results.push(result);
				}
			}

			// Send weekly digest
			if (inputs.weeklyDigest && inputs.slackChannel && results.length > 0) {
				await sendWeeklyDigest({
					results,
					channel: inputs.slackChannel,
					integrations,
				});
			}
		}

		// Summary
		const totalEstimated = results.reduce((sum, r) => sum + r.estimatedHours, 0);
		const totalActual = results.reduce((sum, r) => sum + r.actualHours, 0);
		const syncedCount = results.filter(r => r.syncedToSheet).length;

		return {
			success: true,
			issuesProcessed: results.length,
			syncedToSheet: syncedCount,
			totalEstimatedHours: totalEstimated,
			totalActualHours: totalActual,
			results,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (inputs.slackChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `Project Time Tracker error: ${error.message}`,
			});
		}
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface ProcessIssueParams {
	issue: any;
	inputs: any;
	integrations: any;
	env: any;
	estimateMapping: Record<string, number>;
}

async function processIssue(params: ProcessIssueParams) {
	const { issue, inputs, integrations, env, estimateMapping } = params;

	// Calculate estimated hours
	let estimatedHours = 0;
	if (inputs.useLinearEstimates && issue.estimate !== undefined) {
		estimatedHours = estimateMapping[String(issue.estimate)] || 0;
	}

	// Calculate actual hours (cycle time)
	let actualHours = 0;
	if (inputs.trackCycleTime && issue.startedAt && issue.completedAt) {
		const startTime = new Date(issue.startedAt);
		const endTime = new Date(issue.completedAt);
		actualHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
		// Cap at reasonable amount and round
		actualHours = Math.min(actualHours, 200);
		actualHours = Math.round(actualHours * 10) / 10;
	}

	// Sync to Google Sheets
	let syncedToSheet = false;
	if (inputs.spreadsheetId) {
		try {
			// Prepare row data
			const rowData = [
				issue.identifier,
				issue.title,
				issue.project?.name || '',
				issue.team?.name || '',
				issue.assignee?.name || '',
				estimatedHours,
				actualHours,
				issue.completedAt ? new Date(issue.completedAt).toISOString().split('T')[0] : '',
				issue.state?.name || '',
				issue.url || '',
			];

			// Check if row already exists
			const existingRow = await findExistingRow({
				spreadsheetId: inputs.spreadsheetId,
				sheetName: inputs.sheetName,
				issueIdentifier: issue.identifier,
				integrations,
			});

			if (existingRow) {
				// Update existing row
				await integrations['google-sheets'].spreadsheets.values.update({
					spreadsheetId: inputs.spreadsheetId,
					range: `${inputs.sheetName}!A${existingRow}:J${existingRow}`,
					valueInputOption: 'USER_ENTERED',
					requestBody: { values: [rowData] },
				});
			} else {
				// Append new row
				await integrations['google-sheets'].spreadsheets.values.append({
					spreadsheetId: inputs.spreadsheetId,
					range: `${inputs.sheetName}!A:J`,
					valueInputOption: 'USER_ENTERED',
					insertDataOption: 'INSERT_ROWS',
					requestBody: { values: [rowData] },
				});
			}

			syncedToSheet = true;
		} catch {
			// Sheet sync failed
		}
	}

	return {
		issue: { id: issue.id, identifier: issue.identifier, title: issue.title },
		project: issue.project?.name || null,
		estimatedHours,
		actualHours,
		syncedToSheet,
	};
}

async function findExistingRow(params: {
	spreadsheetId: string;
	sheetName: string;
	issueIdentifier: string;
	integrations: any;
}): Promise<number | null> {
	const { spreadsheetId, sheetName, issueIdentifier, integrations } = params;

	try {
		const result = await integrations['google-sheets'].spreadsheets.values.get({
			spreadsheetId,
			range: `${sheetName}!A:A`,
		});

		if (result.success && result.data?.values) {
			const rowIndex = result.data.values.findIndex((row: string[]) => row[0] === issueIdentifier);
			if (rowIndex !== -1) {
				return rowIndex + 1; // 1-indexed
			}
		}
	} catch {
		// Search failed
	}

	return null;
}

async function sendWeeklyDigest(params: {
	results: Array<{
		issue: { identifier: string; title: string };
		project: string | null;
		estimatedHours: number;
		actualHours: number;
	}>;
	channel: string;
	integrations: any;
}): Promise<boolean> {
	const { results, channel, integrations } = params;

	// Group by project
	const byProject: Record<string, typeof results> = {};
	for (const result of results) {
		const project = result.project || 'No Project';
		if (!byProject[project]) byProject[project] = [];
		byProject[project].push(result);
	}

	const totalEstimated = results.reduce((sum, r) => sum + r.estimatedHours, 0);
	const totalActual = results.reduce((sum, r) => sum + r.actualHours, 0);
	const variance = totalActual - totalEstimated;
	const variancePercent = totalEstimated > 0
		? Math.round((variance / totalEstimated) * 100)
		: 0;

	const projectSummary = Object.entries(byProject)
		.map(([project, issues]) => {
			const est = issues.reduce((s, i) => s + i.estimatedHours, 0);
			const act = issues.reduce((s, i) => s + i.actualHours, 0);
			return `• *${project}*: ${issues.length} issues, ${act.toFixed(1)}h actual / ${est.toFixed(1)}h estimated`;
		})
		.join('\n');

	const blocks: any[] = [
		{
			type: 'header',
			text: { type: 'plain_text', text: 'Weekly Time Report', emoji: true },
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*${results.length} issues completed*\n\n*Total Time:*\n• Estimated: ${totalEstimated.toFixed(1)} hours\n• Actual: ${totalActual.toFixed(1)} hours\n• Variance: ${variance > 0 ? '+' : ''}${variance.toFixed(1)} hours (${variancePercent > 0 ? '+' : ''}${variancePercent}%)`,
			},
		},
		{
			type: 'section',
			text: { type: 'mrkdwn', text: `*By Project:*\n${projectSummary}` },
		},
	];

	try {
		await integrations.slack.chat.postMessage({
			channel,
			text: `Weekly time report: ${results.length} issues completed`,
			blocks,
		});
		return true;
	} catch {
		return false;
	}
}

export const metadata = {
	id: 'project-time-tracker',
	category: 'productivity',
	featured: false,
	stats: { rating: 0, users: 0, reviews: 0 },
};
