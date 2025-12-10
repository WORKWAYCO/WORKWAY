/**
 * Construction Daily Log Autopilot
 *
 * Compound workflow: Procore → Slack + Notion
 *
 * Zuhandenheit: "Daily logs that write themselves" not "field reporting software"
 *
 * The workflow that makes documentation effortless:
 * 1. Reminds superintendents to submit daily logs
 * 2. Aggregates manpower, weather, and work completed
 * 3. Posts daily summary to Slack for stakeholder visibility
 * 4. Archives to Notion for project documentation
 * 5. Flags missing logs for compliance
 *
 * Outcome: Jobsites that document themselves.
 */

import { defineWorkflow, cron } from '@workwayco/sdk';

// Types inline to avoid build dependency issues
interface ProcoreDailyLog {
	id: number;
	log_date: string;
	project_id: number;
	created_at: string;
	updated_at: string;
	weather_conditions?: {
		temperature_high?: number;
		temperature_low?: number;
		conditions?: string;
		precipitation?: string;
	};
	notes?: string;
}

interface ProcoreManpowerLog {
	id: number;
	daily_log_id: number;
	vendor?: {
		id: number;
		name: string;
	};
	num_workers: number;
	hours_worked?: number;
	notes?: string;
}

interface ProcoreProject {
	id: number;
	name: string;
	display_name?: string;
	project_number?: string;
}

export default defineWorkflow({
	name: 'Construction Daily Log Autopilot',
	description:
		'Daily logs that write themselves. Automated reminders, aggregated summaries, and Notion archival for project documentation.',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'end_of_day',

		outcomeStatement: {
			suggestion: 'Want jobsites that document themselves?',
			explanation:
				'Automatic daily log reminders, aggregated crew counts, weather tracking, and Slack summaries.',
			outcome: 'Daily logs that write themselves',
		},

		primaryPair: {
			from: 'procore',
			to: 'slack',
			workflowId: 'construction-daily-log',
			outcome: 'Daily site reports in Slack',
		},

		additionalPairs: [
			{
				from: 'procore',
				to: 'notion',
				workflowId: 'construction-daily-log',
				outcome: 'Daily logs archived to Notion',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['procore'],
				workflowId: 'construction-daily-log',
				priority: 90,
			},
		],

		smartDefaults: {
			morningReminder: { value: true },
			eveningSummary: { value: true },
			archiveToNotion: { value: true },
		},

		essentialFields: ['companyId', 'projectId'],

		zuhandenheit: {
			timeToValue: 1,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'subscription',
		pricePerMonth: 49,
		trialDays: 14,
		description: '$49/month per project. Unlimited daily logs.',
	},

	integrations: [
		{ service: 'procore', scopes: ['read_daily_logs', 'read_projects'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'] },
		{ service: 'notion', scopes: ['read_content', 'insert_content'], optional: true },
	],

	inputs: {
		companyId: {
			type: 'text',
			label: 'Procore Company ID',
			required: true,
			description: 'Your company ID from Procore',
		},
		projectId: {
			type: 'text',
			label: 'Procore Project ID',
			required: true,
			description: 'The project to track daily logs for',
		},
		slackChannel: {
			type: 'text',
			label: 'Daily Log Channel',
			required: true,
			description: 'Channel for daily log summaries',
		},
		morningReminder: {
			type: 'boolean',
			label: 'Morning Reminder',
			default: true,
			description: 'Send reminder at start of day to submit logs',
		},
		morningReminderTime: {
			type: 'text',
			label: 'Morning Reminder Time',
			default: '07:00',
			description: 'Time to send morning reminder (24h format)',
		},
		eveningSummary: {
			type: 'boolean',
			label: 'Evening Summary',
			default: true,
			description: 'Send aggregated daily summary at end of day',
		},
		eveningSummaryTime: {
			type: 'text',
			label: 'Evening Summary Time',
			default: '17:00',
			description: 'Time to send evening summary (24h format)',
		},
		archiveToNotion: {
			type: 'boolean',
			label: 'Archive to Notion',
			default: true,
			description: 'Archive daily logs to Notion database',
		},
		notionDatabaseId: {
			type: 'text',
			label: 'Notion Database ID',
			required: false,
			description: 'Notion database for daily log archives',
		},
		flagMissingLogs: {
			type: 'boolean',
			label: 'Flag Missing Logs',
			default: true,
			description: 'Alert when no daily log is submitted for a workday',
		},
	},

	// Run at 7 AM for reminders and 5 PM for summaries
	trigger: cron({
		schedule: '0 7,17 * * 1-5', // 7 AM and 5 PM on weekdays
	}),

	async execute({ trigger, inputs, integrations }) {
		const now = new Date();
		const hour = now.getHours();
		const today = now.toISOString().split('T')[0];

		// Get project info
		const projectResult = await integrations.procore.getProject(inputs.projectId);
		const projectName = projectResult.success
			? projectResult.data.name
			: `Project ${inputs.projectId}`;

		// Morning: Send reminder
		if (hour < 12 && inputs.morningReminder) {
			await sendMorningReminder({
				projectName,
				inputs,
				integrations,
			});

			return {
				success: true,
				action: 'morning_reminder',
				summary: { projectName, sentAt: now.toISOString() },
			};
		}

		// Evening: Send summary
		if (hour >= 12 && inputs.eveningSummary) {
			// Get today's daily log
			const logsResult = await integrations.procore.getDailyLogs({
				projectId: inputs.projectId,
				date: now,
			});

			if (!logsResult.success) {
				throw new Error(`Failed to fetch daily logs: ${logsResult.error?.message}`);
			}

			const todaysLogs = logsResult.data;

			// Check if log exists for today
			if (todaysLogs.length === 0 && inputs.flagMissingLogs) {
				await sendMissingLogAlert({
					projectName,
					date: today,
					inputs,
					integrations,
				});

				return {
					success: true,
					action: 'missing_log_alert',
					summary: { projectName, date: today },
				};
			}

			// Get manpower data for today's log
			let manpowerData: ProcoreManpowerLog[] = [];
			if (todaysLogs.length > 0) {
				const manpowerResult = await integrations.procore.getManpowerLogs(
					inputs.projectId,
					todaysLogs[0].id
				);
				if (manpowerResult.success) {
					manpowerData = manpowerResult.data;
				}
			}

			// Send evening summary
			await sendEveningSummary({
				projectName,
				date: today,
				dailyLog: todaysLogs[0] || null,
				manpower: manpowerData,
				inputs,
				integrations,
			});

			// Archive to Notion if enabled
			if (inputs.archiveToNotion && inputs.notionDatabaseId && todaysLogs.length > 0) {
				await archiveToNotion({
					projectName,
					dailyLog: todaysLogs[0],
					manpower: manpowerData,
					inputs,
					integrations,
				});
			}

			return {
				success: true,
				action: 'evening_summary',
				summary: {
					projectName,
					date: today,
					logFound: todaysLogs.length > 0,
					totalWorkers: manpowerData.reduce((sum, m) => sum + m.num_workers, 0),
					totalHours: manpowerData.reduce((sum, m) => sum + (m.hours_worked || 0), 0),
				},
			};
		}

		return {
			success: true,
			action: 'no_action',
			summary: { hour, message: 'Outside scheduled times' },
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack && inputs.slackChannel) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Daily Log Autopilot Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function sendMorningReminder({
	projectName,
	inputs,
	integrations,
}: {
	projectName: string;
	inputs: any;
	integrations: any;
}) {
	const today = new Date().toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
	});

	await integrations.slack.chat.postMessage({
		channel: inputs.slackChannel,
		blocks: [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `☀️ *Good morning!* Time to start today's daily log for *${projectName}*`,
				},
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `📅 ${today}\n\nRemember to log:\n• Weather conditions\n• Crew counts and hours\n• Work completed\n• Any delays or issues`,
				},
			},
			{
				type: 'actions',
				elements: [
					{
						type: 'button',
						text: { type: 'plain_text', text: 'Open Daily Log in Procore' },
						url: `https://app.procore.com/projects/${inputs.projectId}/daily_logs`,
						style: 'primary',
					},
				],
			},
		],
		text: `Good morning! Time to start today's daily log for ${projectName}`,
	});
}

async function sendMissingLogAlert({
	projectName,
	date,
	inputs,
	integrations,
}: {
	projectName: string;
	date: string;
	inputs: any;
	integrations: any;
}) {
	await integrations.slack.chat.postMessage({
		channel: inputs.slackChannel,
		blocks: [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `⚠️ *Missing Daily Log Alert*\n\nNo daily log has been submitted for *${projectName}* today (${date}).`,
				},
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `Please submit a daily log to maintain project documentation compliance.`,
				},
			},
			{
				type: 'actions',
				elements: [
					{
						type: 'button',
						text: { type: 'plain_text', text: 'Create Daily Log' },
						url: `https://app.procore.com/projects/${inputs.projectId}/daily_logs/new`,
						style: 'danger',
					},
				],
			},
		],
		text: `Missing daily log for ${projectName} on ${date}`,
	});
}

async function sendEveningSummary({
	projectName,
	date,
	dailyLog,
	manpower,
	inputs,
	integrations,
}: {
	projectName: string;
	date: string;
	dailyLog: ProcoreDailyLog | null;
	manpower: ProcoreManpowerLog[];
	inputs: any;
	integrations: any;
}) {
	const totalWorkers = manpower.reduce((sum, m) => sum + m.num_workers, 0);
	const totalHours = manpower.reduce((sum, m) => sum + (m.hours_worked || 0), 0);

	const blocks: any[] = [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: `📊 Daily Log Summary: ${projectName}`,
			},
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Date:* ${date}`,
			},
		},
	];

	// Weather section
	if (dailyLog?.weather_conditions) {
		const weather = dailyLog.weather_conditions;
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Weather:* ${weather.conditions || 'Not recorded'}\n` +
					`🌡️ High: ${weather.temperature_high || '--'}°F | Low: ${weather.temperature_low || '--'}°F\n` +
					`💧 Precipitation: ${weather.precipitation || 'None'}`,
			},
		});
	}

	// Manpower section
	blocks.push(
		{ type: 'divider' },
		{
			type: 'section',
			fields: [
				{
					type: 'mrkdwn',
					text: `*Total Workers:*\n${totalWorkers}`,
				},
				{
					type: 'mrkdwn',
					text: `*Total Hours:*\n${totalHours.toFixed(1)}`,
				},
			],
		}
	);

	// Breakdown by contractor
	if (manpower.length > 0) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: '*Crew Breakdown:*',
			},
		});

		for (const crew of manpower.slice(0, 10)) {
			blocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `• ${crew.vendor?.name || 'Unknown'}: ${crew.num_workers} workers, ${crew.hours_worked || 0} hrs${crew.notes ? ` - _${crew.notes}_` : ''}`,
				},
			});
		}
	}

	// Notes section
	if (dailyLog?.notes) {
		blocks.push(
			{ type: 'divider' },
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*Notes:*\n${dailyLog.notes}`,
				},
			}
		);
	}

	await integrations.slack.chat.postMessage({
		channel: inputs.slackChannel,
		blocks,
		text: `Daily Log Summary for ${projectName}: ${totalWorkers} workers, ${totalHours} hours`,
	});
}

async function archiveToNotion({
	projectName,
	dailyLog,
	manpower,
	inputs,
	integrations,
}: {
	projectName: string;
	dailyLog: ProcoreDailyLog;
	manpower: ProcoreManpowerLog[];
	inputs: any;
	integrations: any;
}) {
	const totalWorkers = manpower.reduce((sum, m) => sum + m.num_workers, 0);
	const totalHours = manpower.reduce((sum, m) => sum + (m.hours_worked || 0), 0);

	const crewBreakdown = manpower
		.map((m) => `${m.vendor?.name || 'Unknown'}: ${m.num_workers} workers`)
		.join('\n');

	await integrations.notion.pages.create({
		parent: { database_id: inputs.notionDatabaseId },
		properties: {
			Name: {
				title: [{ text: { content: `${projectName} - ${dailyLog.log_date}` } }],
			},
			Date: {
				date: { start: dailyLog.log_date },
			},
			Project: {
				rich_text: [{ text: { content: projectName } }],
			},
			'Total Workers': {
				number: totalWorkers,
			},
			'Total Hours': {
				number: totalHours,
			},
			Weather: {
				rich_text: [{
					text: {
						content: dailyLog.weather_conditions?.conditions || 'Not recorded',
					},
				}],
			},
			'Temperature High': {
				number: dailyLog.weather_conditions?.temperature_high || null,
			},
			'Temperature Low': {
				number: dailyLog.weather_conditions?.temperature_low || null,
			},
			Notes: {
				rich_text: [{ text: { content: dailyLog.notes || '' } }],
			},
		},
		children: [
			{
				object: 'block',
				type: 'heading_2',
				heading_2: {
					rich_text: [{ type: 'text', text: { content: 'Crew Breakdown' } }],
				},
			},
			{
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{ type: 'text', text: { content: crewBreakdown || 'No crew data' } }],
				},
			},
		],
	});
}

export const metadata = {
	id: 'construction-daily-log',
	category: 'construction',
	industry: 'construction',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
