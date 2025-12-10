/**
 * Construction RFI Tracker
 *
 * Compound workflow: Procore → Slack + Notion
 *
 * Zuhandenheit: "RFIs that get answered" not "RFI management dashboard"
 *
 * The workflow that prevents delays:
 * 1. Monitors open RFIs in Procore
 * 2. Alerts ball-in-court assignees via Slack
 * 3. Escalates overdue RFIs to project managers
 * 4. Logs RFI history to Notion for documentation
 * 5. Tracks response times and identifies bottlenecks
 *
 * Outcome: Questions that answer themselves.
 */

import { defineWorkflow, cron } from '@workwayco/sdk';

// Types inline to avoid build dependency issues
interface ProcoreRFI {
	id: number;
	number: string;
	subject: string;
	status: 'draft' | 'open' | 'closed';
	question?: {
		body?: string;
		plain_text_body?: string;
	};
	answer?: {
		body?: string;
		plain_text_body?: string;
	};
	due_date?: string;
	ball_in_court?: {
		id: number;
		name: string;
		email_address?: string;
	};
	responsible_contractor?: {
		id: number;
		name: string;
	};
	created_at: string;
	updated_at: string;
	closed_at?: string;
	cost_impact?: 'yes' | 'no' | 'tbd' | 'n/a';
	cost_impact_amount?: number;
	schedule_impact?: 'yes' | 'no' | 'tbd' | 'n/a';
	schedule_impact_days?: number;
}

interface ProcoreProject {
	id: number;
	name: string;
	display_name?: string;
	project_number?: string;
}

export default defineWorkflow({
	name: 'Construction RFI Tracker',
	description:
		'Never miss an RFI deadline. Automatic Slack alerts for open RFIs, escalation for overdue items, and Notion documentation.',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_rfis_need_answers',

		outcomeStatement: {
			suggestion: 'Want RFIs that actually get answered?',
			explanation:
				'Daily alerts for open RFIs, escalation for overdue items, automatic Notion logging for documentation.',
			outcome: 'Questions that answer themselves',
		},

		primaryPair: {
			from: 'procore',
			to: 'slack',
			workflowId: 'construction-rfi-tracker',
			outcome: 'RFI reminders that prevent delays',
		},

		additionalPairs: [
			{
				from: 'procore',
				to: 'notion',
				workflowId: 'construction-rfi-tracker',
				outcome: 'RFI history documented automatically',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['procore'],
				workflowId: 'construction-rfi-tracker',
				priority: 95, // High priority - core construction use case
			},
		],

		smartDefaults: {
			dailyDigest: { value: true },
			overdueAlerts: { value: true },
			escalationDays: { value: 3 },
			logToNotion: { value: true },
		},

		essentialFields: ['companyId', 'projectId'],

		zuhandenheit: {
			timeToValue: 1, // Immediate - runs on schedule
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'subscription',
		pricePerMonth: 79,
		trialDays: 14,
		description: '$79/month per project. Unlimited RFIs.',
	},

	integrations: [
		{ service: 'procore', scopes: ['read_rfis', 'read_projects'] },
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
			description: 'The project to track RFIs for',
		},
		slackChannel: {
			type: 'text',
			label: 'RFI Alerts Channel',
			required: true,
			description: 'Channel for RFI notifications',
		},
		escalationChannel: {
			type: 'text',
			label: 'Escalation Channel',
			required: false,
			description: 'Channel for overdue RFI escalations (defaults to main channel)',
		},
		dailyDigest: {
			type: 'boolean',
			label: 'Daily RFI Digest',
			default: true,
			description: 'Send daily summary of open RFIs every morning',
		},
		overdueAlerts: {
			type: 'boolean',
			label: 'Overdue Alerts',
			default: true,
			description: 'Send immediate alerts when RFIs become overdue',
		},
		escalationDays: {
			type: 'number',
			label: 'Escalation Threshold (Days)',
			default: 3,
			description: 'Days overdue before escalating to PM',
		},
		logToNotion: {
			type: 'boolean',
			label: 'Log to Notion',
			default: true,
			description: 'Log RFI activity to a Notion database for documentation',
		},
		notionDatabaseId: {
			type: 'text',
			label: 'Notion Database ID',
			required: false,
			description: 'Notion database for RFI documentation (if logging enabled)',
		},
	},

	// Run every morning at 8 AM and check for overdue throughout the day
	trigger: cron({
		schedule: '0 8,12,16 * * 1-5', // 8 AM, 12 PM, 4 PM on weekdays
	}),

	async execute({ trigger, inputs, integrations }) {
		const now = new Date();
		const results = {
			openRFIs: [] as RFIStatus[],
			overdueRFIs: [] as RFIStatus[],
			criticalRFIs: [] as RFIStatus[], // Severely overdue
			newlyClosed: [] as RFIStatus[],
			notionLogged: 0,
		};

		// Get project info for context
		const projectResult = await integrations.procore.getProject(inputs.projectId);
		const projectName = projectResult.success
			? projectResult.data.name
			: `Project ${inputs.projectId}`;

		// Get all open RFIs
		const rfisResult = await integrations.procore.getRFIs({
			projectId: inputs.projectId,
			status: 'open',
		});

		if (!rfisResult.success) {
			throw new Error(`Failed to fetch RFIs: ${rfisResult.error?.message}`);
		}

		const openRFIs = rfisResult.data;

		// Categorize RFIs by urgency
		for (const rfi of openRFIs) {
			const rfiStatus = analyzeRFI(rfi, now, inputs.escalationDays);
			results.openRFIs.push(rfiStatus);

			if (rfiStatus.daysOverdue > 0) {
				results.overdueRFIs.push(rfiStatus);
			}
			if (rfiStatus.daysOverdue >= inputs.escalationDays) {
				results.criticalRFIs.push(rfiStatus);
			}
		}

		// Send daily digest at 8 AM
		const hour = now.getHours();
		if (inputs.dailyDigest && hour < 9) {
			await sendDailyDigest({
				projectName,
				results,
				inputs,
				integrations,
			});
		}

		// Send overdue alerts
		if (inputs.overdueAlerts && results.overdueRFIs.length > 0) {
			await sendOverdueAlerts({
				projectName,
				overdueRFIs: results.overdueRFIs,
				inputs,
				integrations,
			});
		}

		// Escalate critical RFIs
		if (results.criticalRFIs.length > 0) {
			await sendEscalation({
				projectName,
				criticalRFIs: results.criticalRFIs,
				inputs,
				integrations,
			});
		}

		// Log to Notion if enabled
		if (inputs.logToNotion && inputs.notionDatabaseId && integrations.notion) {
			for (const rfi of results.openRFIs) {
				try {
					await logRFIToNotion({
						rfi,
						projectName,
						inputs,
						integrations,
					});
					results.notionLogged++;
				} catch (error) {
					console.error(`Failed to log RFI ${rfi.number} to Notion:`, error);
				}
			}
		}

		return {
			success: true,
			summary: {
				projectName,
				openRFIs: results.openRFIs.length,
				overdueRFIs: results.overdueRFIs.length,
				criticalRFIs: results.criticalRFIs.length,
				notionLogged: results.notionLogged,
			},
			details: results,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack && inputs.slackChannel) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Construction RFI Tracker Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface RFIStatus {
	id: number;
	number: string;
	subject: string;
	ballInCourt: string;
	ballInCourtEmail?: string;
	responsibleContractor: string;
	dueDate: string | null;
	daysOverdue: number;
	daysSinceCreated: number;
	costImpact: string;
	scheduleImpact: string;
	urgency: 'normal' | 'approaching' | 'overdue' | 'critical';
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function analyzeRFI(rfi: ProcoreRFI, now: Date, escalationDays: number): RFIStatus {
	const dueDate = rfi.due_date ? new Date(rfi.due_date) : null;
	const createdDate = new Date(rfi.created_at);

	const daysSinceCreated = Math.floor(
		(now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
	);

	let daysOverdue = 0;
	if (dueDate) {
		daysOverdue = Math.floor(
			(now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
		);
	}

	let urgency: RFIStatus['urgency'] = 'normal';
	if (daysOverdue >= escalationDays) {
		urgency = 'critical';
	} else if (daysOverdue > 0) {
		urgency = 'overdue';
	} else if (dueDate) {
		const daysUntilDue = -daysOverdue;
		if (daysUntilDue <= 2) {
			urgency = 'approaching';
		}
	}

	return {
		id: rfi.id,
		number: rfi.number,
		subject: rfi.subject,
		ballInCourt: rfi.ball_in_court?.name || 'Unassigned',
		ballInCourtEmail: rfi.ball_in_court?.email_address,
		responsibleContractor: rfi.responsible_contractor?.name || 'N/A',
		dueDate: rfi.due_date || null,
		daysOverdue: Math.max(0, daysOverdue),
		daysSinceCreated,
		costImpact: formatImpact(rfi.cost_impact, rfi.cost_impact_amount, 'cost'),
		scheduleImpact: formatImpact(rfi.schedule_impact, rfi.schedule_impact_days, 'schedule'),
		urgency,
	};
}

function formatImpact(
	impact: string | undefined,
	amount: number | undefined,
	type: 'cost' | 'schedule'
): string {
	if (!impact || impact === 'n/a') return 'N/A';
	if (impact === 'tbd') return 'TBD';
	if (impact === 'no') return 'None';
	if (impact === 'yes' && amount) {
		return type === 'cost' ? `$${amount.toLocaleString()}` : `${amount} days`;
	}
	return 'Yes';
}

async function sendDailyDigest({
	projectName,
	results,
	inputs,
	integrations,
}: {
	projectName: string;
	results: {
		openRFIs: RFIStatus[];
		overdueRFIs: RFIStatus[];
		criticalRFIs: RFIStatus[];
	};
	inputs: any;
	integrations: any;
}) {
	const blocks: any[] = [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: `📋 RFI Daily Digest: ${projectName}`,
			},
		},
		{
			type: 'section',
			fields: [
				{
					type: 'mrkdwn',
					text: `*Open RFIs:*\n${results.openRFIs.length}`,
				},
				{
					type: 'mrkdwn',
					text: `*Overdue:*\n${results.overdueRFIs.length}`,
				},
				{
					type: 'mrkdwn',
					text: `*Critical:*\n${results.criticalRFIs.length}`,
				},
			],
		},
	];

	// Add approaching deadlines
	const approaching = results.openRFIs.filter((r) => r.urgency === 'approaching');
	if (approaching.length > 0) {
		blocks.push(
			{ type: 'divider' },
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: '*⏰ Approaching Deadlines (within 2 days):*',
				},
			}
		);

		for (const rfi of approaching.slice(0, 5)) {
			blocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `• *RFI #${rfi.number}:* ${rfi.subject}\n  Ball in court: ${rfi.ballInCourt} | Due: ${rfi.dueDate}`,
				},
			});
		}
	}

	// Add overdue list
	if (results.overdueRFIs.length > 0) {
		blocks.push(
			{ type: 'divider' },
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: '*🚨 Overdue RFIs:*',
				},
			}
		);

		for (const rfi of results.overdueRFIs.slice(0, 10)) {
			const emoji = rfi.urgency === 'critical' ? '🔴' : '🟡';
			blocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `${emoji} *RFI #${rfi.number}:* ${rfi.subject}\n  Ball in court: ${rfi.ballInCourt} | ${rfi.daysOverdue} days overdue`,
				},
			});
		}
	}

	await integrations.slack.chat.postMessage({
		channel: inputs.slackChannel,
		blocks,
		text: `RFI Digest: ${results.openRFIs.length} open, ${results.overdueRFIs.length} overdue`,
	});
}

async function sendOverdueAlerts({
	projectName,
	overdueRFIs,
	inputs,
	integrations,
}: {
	projectName: string;
	overdueRFIs: RFIStatus[];
	inputs: any;
	integrations: any;
}) {
	// Group by ball in court
	const byAssignee = new Map<string, RFIStatus[]>();
	for (const rfi of overdueRFIs) {
		const existing = byAssignee.get(rfi.ballInCourt) || [];
		existing.push(rfi);
		byAssignee.set(rfi.ballInCourt, existing);
	}

	for (const [assignee, rfis] of byAssignee) {
		const blocks: any[] = [
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*🔔 ${assignee}:* You have ${rfis.length} overdue RFI${rfis.length > 1 ? 's' : ''} on ${projectName}`,
				},
			},
		];

		for (const rfi of rfis.slice(0, 5)) {
			blocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `• *RFI #${rfi.number}:* ${rfi.subject} (${rfi.daysOverdue} days overdue)`,
				},
				accessory: {
					type: 'button',
					text: { type: 'plain_text', text: 'View in Procore' },
					url: `https://app.procore.com/rfis/${rfi.id}`,
					action_id: `view_rfi_${rfi.id}`,
				},
			});
		}

		await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			blocks,
			text: `${assignee}: ${rfis.length} overdue RFIs need attention`,
		});
	}
}

async function sendEscalation({
	projectName,
	criticalRFIs,
	inputs,
	integrations,
}: {
	projectName: string;
	criticalRFIs: RFIStatus[];
	inputs: any;
	integrations: any;
}) {
	const channel = inputs.escalationChannel || inputs.slackChannel;

	const totalCostImpact = criticalRFIs
		.filter((r) => r.costImpact.startsWith('$'))
		.reduce((sum, r) => sum + parseInt(r.costImpact.replace(/[$,]/g, ''), 10), 0);

	const totalScheduleImpact = criticalRFIs
		.filter((r) => r.scheduleImpact.includes('days'))
		.reduce((sum, r) => sum + parseInt(r.scheduleImpact, 10), 0);

	const blocks: any[] = [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: `⚠️ ESCALATION: ${criticalRFIs.length} Critical RFIs on ${projectName}`,
			},
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `These RFIs have been overdue for *${inputs.escalationDays}+ days* and require immediate attention.`,
			},
		},
	];

	if (totalCostImpact > 0 || totalScheduleImpact > 0) {
		blocks.push({
			type: 'section',
			fields: [
				{
					type: 'mrkdwn',
					text: `*Potential Cost Impact:*\n$${totalCostImpact.toLocaleString()}`,
				},
				{
					type: 'mrkdwn',
					text: `*Potential Schedule Impact:*\n${totalScheduleImpact} days`,
				},
			],
		});
	}

	blocks.push({ type: 'divider' });

	for (const rfi of criticalRFIs.slice(0, 10)) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: [
					`*RFI #${rfi.number}:* ${rfi.subject}`,
					`Ball in court: ${rfi.ballInCourt} | Contractor: ${rfi.responsibleContractor}`,
					`Overdue: ${rfi.daysOverdue} days | Cost: ${rfi.costImpact} | Schedule: ${rfi.scheduleImpact}`,
				].join('\n'),
			},
		});
	}

	await integrations.slack.chat.postMessage({
		channel,
		blocks,
		text: `ESCALATION: ${criticalRFIs.length} critical RFIs on ${projectName}`,
	});
}

async function logRFIToNotion({
	rfi,
	projectName,
	inputs,
	integrations,
}: {
	rfi: RFIStatus;
	projectName: string;
	inputs: any;
	integrations: any;
}) {
	await integrations.notion.pages.create({
		parent: { database_id: inputs.notionDatabaseId },
		properties: {
			Name: {
				title: [{ text: { content: `RFI #${rfi.number}: ${rfi.subject}` } }],
			},
			Project: {
				rich_text: [{ text: { content: projectName } }],
			},
			'RFI Number': {
				rich_text: [{ text: { content: rfi.number } }],
			},
			'Ball in Court': {
				rich_text: [{ text: { content: rfi.ballInCourt } }],
			},
			Contractor: {
				rich_text: [{ text: { content: rfi.responsibleContractor } }],
			},
			'Due Date': rfi.dueDate
				? { date: { start: rfi.dueDate } }
				: { date: null },
			Status: {
				select: { name: rfi.urgency === 'critical' ? 'Critical' : rfi.urgency === 'overdue' ? 'Overdue' : 'Open' },
			},
			'Days Overdue': {
				number: rfi.daysOverdue,
			},
			'Cost Impact': {
				rich_text: [{ text: { content: rfi.costImpact } }],
			},
			'Schedule Impact': {
				rich_text: [{ text: { content: rfi.scheduleImpact } }],
			},
		},
	});
}

export const metadata = {
	id: 'construction-rfi-tracker',
	category: 'construction',
	industry: 'construction',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
