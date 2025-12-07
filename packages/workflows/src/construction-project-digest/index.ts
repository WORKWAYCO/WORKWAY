/**
 * Construction Project Status Digest
 *
 * Compound workflow: Procore → Slack + Notion
 *
 * Zuhandenheit: "Projects that report themselves" not "construction analytics dashboard"
 *
 * The workflow that keeps stakeholders informed:
 * 1. Aggregates RFIs, submittals, change orders, budget status
 * 2. Calculates project health score
 * 3. Sends weekly digest to stakeholders
 * 4. Flags projects at risk
 * 5. Archives reports to Notion for history
 *
 * Outcome: Stakeholders who stay informed.
 */

import { defineWorkflow, cron } from '@workwayco/sdk';

// Types inline to avoid build dependency issues
interface ProcoreProject {
	id: number;
	name: string;
	display_name?: string;
	project_number?: string;
	stage?: string;
	start_date?: string;
	completion_date?: string;
	active: boolean;
}

interface ProjectHealth {
	projectId: string;
	projectName: string;
	healthScore: number;
	status: 'healthy' | 'at_risk' | 'critical';
	metrics: {
		openRFIs: number;
		overdueRFIs: number;
		openSubmittals: number;
		overdueSubmittals: number;
		pendingChangeOrders: number;
		budgetVariance: number;
	};
	risks: string[];
}

export default defineWorkflow({
	name: 'Construction Project Status Digest',
	description:
		'Weekly project health reports. Aggregated metrics across RFIs, submittals, change orders, and budget. Stakeholders stay informed without chasing updates.',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'weekly_automatically',

		outcomeStatement: {
			suggestion: 'Want stakeholders who stay informed?',
			explanation:
				'Weekly digest with project health score, open items, and risk flags. No more status meetings.',
			outcome: 'Projects that report themselves',
		},

		primaryPair: {
			from: 'procore',
			to: 'slack',
			workflowId: 'construction-project-digest',
			outcome: 'Weekly project health in Slack',
		},

		additionalPairs: [
			{
				from: 'procore',
				to: 'notion',
				workflowId: 'construction-project-digest',
				outcome: 'Project reports archived to Notion',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['procore'],
				workflowId: 'construction-project-digest',
				priority: 85,
			},
		],

		smartDefaults: {
			weeklyDigest: { value: true },
			includeAllProjects: { value: true },
			riskAlerts: { value: true },
		},

		essentialFields: ['companyId'],

		zuhandenheit: {
			timeToValue: 7, // Weekly cadence
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'subscription',
		pricePerMonth: 99,
		trialDays: 14,
		description: '$99/month. Unlimited projects.',
	},

	integrations: [
		{ service: 'procore', scopes: ['read_projects', 'read_rfis', 'read_submittals', 'read_change_orders', 'read_budget'] },
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
		projectIds: {
			type: 'text',
			label: 'Project IDs (comma-separated)',
			required: false,
			description: 'Specific projects to track. Leave blank for all active projects.',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Digest Channel',
			required: true,
			description: 'Channel for weekly project digests',
		},
		executiveChannel: {
			type: 'slack_channel_picker',
			label: 'Executive Summary Channel',
			required: false,
			description: 'Optional channel for executive-level summary',
		},
		weeklyDigest: {
			type: 'boolean',
			label: 'Weekly Digest',
			default: true,
			description: 'Send comprehensive weekly digest every Monday',
		},
		riskAlerts: {
			type: 'boolean',
			label: 'Risk Alerts',
			default: true,
			description: 'Send immediate alerts when projects become at-risk',
		},
		healthThreshold: {
			type: 'number',
			label: 'At-Risk Threshold',
			default: 70,
			description: 'Health score below which project is flagged as at-risk',
		},
		criticalThreshold: {
			type: 'number',
			label: 'Critical Threshold',
			default: 50,
			description: 'Health score below which project is flagged as critical',
		},
		archiveToNotion: {
			type: 'boolean',
			label: 'Archive Reports',
			default: true,
			description: 'Archive weekly reports to Notion',
		},
		notionDatabaseId: {
			type: 'text',
			label: 'Notion Database ID',
			required: false,
			description: 'Notion database for report archives',
		},
	},

	// Run every Monday at 8 AM
	trigger: cron({
		schedule: '0 8 * * 1', // 8 AM on Mondays
	}),

	async execute({ trigger, inputs, integrations }) {
		const now = new Date();
		const weekOf = now.toISOString().split('T')[0];

		// Get projects to analyze
		let projectIds: string[] = [];
		if (inputs.projectIds) {
			projectIds = inputs.projectIds.split(',').map((id: string) => id.trim());
		} else {
			// Get all active projects
			const projectsResult = await integrations.procore.getProjects({ active: true });
			if (projectsResult.success) {
				projectIds = projectsResult.data.map((p: ProcoreProject) => String(p.id));
			}
		}

		if (projectIds.length === 0) {
			return {
				success: true,
				summary: { message: 'No projects to analyze' },
			};
		}

		// Analyze each project
		const projectHealths: ProjectHealth[] = [];

		for (const projectId of projectIds) {
			const health = await analyzeProjectHealth({
				projectId,
				inputs,
				integrations,
			});
			projectHealths.push(health);
		}

		// Calculate portfolio-level metrics
		const portfolioMetrics = calculatePortfolioMetrics(projectHealths);

		// Send weekly digest
		if (inputs.weeklyDigest) {
			await sendWeeklyDigest({
				weekOf,
				projectHealths,
				portfolioMetrics,
				inputs,
				integrations,
			});
		}

		// Send executive summary if configured
		if (inputs.executiveChannel) {
			await sendExecutiveSummary({
				weekOf,
				projectHealths,
				portfolioMetrics,
				inputs,
				integrations,
			});
		}

		// Send risk alerts for critical projects
		if (inputs.riskAlerts) {
			const criticalProjects = projectHealths.filter((p) => p.status === 'critical');
			if (criticalProjects.length > 0) {
				await sendRiskAlerts({
					criticalProjects,
					inputs,
					integrations,
				});
			}
		}

		// Archive to Notion
		if (inputs.archiveToNotion && inputs.notionDatabaseId && integrations.notion) {
			await archiveReportToNotion({
				weekOf,
				projectHealths,
				portfolioMetrics,
				inputs,
				integrations,
			});
		}

		return {
			success: true,
			summary: {
				weekOf,
				projectsAnalyzed: projectHealths.length,
				healthyProjects: projectHealths.filter((p) => p.status === 'healthy').length,
				atRiskProjects: projectHealths.filter((p) => p.status === 'at_risk').length,
				criticalProjects: projectHealths.filter((p) => p.status === 'critical').length,
				averageHealthScore: portfolioMetrics.averageHealth,
			},
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack && inputs.slackChannel) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Project Digest Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function analyzeProjectHealth({
	projectId,
	inputs,
	integrations,
}: {
	projectId: string;
	inputs: any;
	integrations: any;
}): Promise<ProjectHealth> {
	// Get project details
	const projectResult = await integrations.procore.getProject(projectId);
	const projectName = projectResult.success
		? projectResult.data.name
		: `Project ${projectId}`;

	// Get RFIs
	const rfisResult = await integrations.procore.getRFIs({
		projectId,
		status: 'open',
	});
	const openRFIs = rfisResult.success ? rfisResult.data : [];
	const now = new Date();
	const overdueRFIs = openRFIs.filter((rfi: any) => {
		if (!rfi.due_date) return false;
		return new Date(rfi.due_date) < now;
	});

	// Get submittals
	const submittalsResult = await integrations.procore.getSubmittals({
		projectId,
	});
	const openSubmittals = submittalsResult.success ? submittalsResult.data : [];
	const overdueSubmittals = openSubmittals.filter((sub: any) => {
		if (!sub.due_date) return false;
		return new Date(sub.due_date) < now;
	});

	// Get change orders
	const changeOrdersResult = await integrations.procore.getChangeOrders({
		projectId,
	});
	const changeOrders = changeOrdersResult.success ? changeOrdersResult.data : [];
	const pendingChangeOrders = changeOrders.filter((co: any) =>
		['draft', 'pending', 'pending_approval'].includes(co.status?.toLowerCase())
	);

	// Get budget (simplified - actual implementation would use budget snapshots)
	const budgetResult = await integrations.procore.getBudget({
		projectId,
		includePending: true,
	});
	let budgetVariance = 0;
	if (budgetResult.success && budgetResult.data.length > 0) {
		const totalVariance = budgetResult.data.reduce(
			(sum: number, line: any) => sum + (line.projected_over_under || 0),
			0
		);
		budgetVariance = totalVariance;
	}

	// Calculate health score
	const metrics = {
		openRFIs: openRFIs.length,
		overdueRFIs: overdueRFIs.length,
		openSubmittals: openSubmittals.length,
		overdueSubmittals: overdueSubmittals.length,
		pendingChangeOrders: pendingChangeOrders.length,
		budgetVariance,
	};

	const { score, risks } = calculateHealthScore(metrics, inputs);

	let status: ProjectHealth['status'] = 'healthy';
	if (score < inputs.criticalThreshold) {
		status = 'critical';
	} else if (score < inputs.healthThreshold) {
		status = 'at_risk';
	}

	return {
		projectId,
		projectName,
		healthScore: score,
		status,
		metrics,
		risks,
	};
}

function calculateHealthScore(
	metrics: ProjectHealth['metrics'],
	inputs: any
): { score: number; risks: string[] } {
	let score = 100;
	const risks: string[] = [];

	// Overdue RFIs (major impact)
	if (metrics.overdueRFIs > 0) {
		score -= metrics.overdueRFIs * 5;
		risks.push(`${metrics.overdueRFIs} overdue RFI${metrics.overdueRFIs > 1 ? 's' : ''}`);
	}

	// Open RFIs (minor impact)
	if (metrics.openRFIs > 10) {
		score -= 5;
		risks.push(`High RFI count (${metrics.openRFIs})`);
	}

	// Overdue submittals (major impact)
	if (metrics.overdueSubmittals > 0) {
		score -= metrics.overdueSubmittals * 5;
		risks.push(`${metrics.overdueSubmittals} overdue submittal${metrics.overdueSubmittals > 1 ? 's' : ''}`);
	}

	// Pending change orders (moderate impact)
	if (metrics.pendingChangeOrders > 5) {
		score -= 10;
		risks.push(`${metrics.pendingChangeOrders} pending change orders`);
	}

	// Budget variance (major impact)
	if (metrics.budgetVariance > 0) {
		// Over budget
		const overBudgetPct = Math.min(metrics.budgetVariance / 100000, 30); // Cap at 30 points
		score -= overBudgetPct;
		risks.push(`$${(metrics.budgetVariance / 1000).toFixed(0)}K over budget`);
	}

	return {
		score: Math.max(0, Math.round(score)),
		risks,
	};
}

function calculatePortfolioMetrics(projectHealths: ProjectHealth[]) {
	const totalProjects = projectHealths.length;
	const averageHealth = Math.round(
		projectHealths.reduce((sum, p) => sum + p.healthScore, 0) / totalProjects
	);

	const totalOpenRFIs = projectHealths.reduce((sum, p) => sum + p.metrics.openRFIs, 0);
	const totalOverdueRFIs = projectHealths.reduce((sum, p) => sum + p.metrics.overdueRFIs, 0);
	const totalOpenSubmittals = projectHealths.reduce((sum, p) => sum + p.metrics.openSubmittals, 0);
	const totalPendingCOs = projectHealths.reduce((sum, p) => sum + p.metrics.pendingChangeOrders, 0);
	const totalBudgetVariance = projectHealths.reduce((sum, p) => sum + p.metrics.budgetVariance, 0);

	return {
		totalProjects,
		averageHealth,
		totalOpenRFIs,
		totalOverdueRFIs,
		totalOpenSubmittals,
		totalPendingCOs,
		totalBudgetVariance,
	};
}

async function sendWeeklyDigest({
	weekOf,
	projectHealths,
	portfolioMetrics,
	inputs,
	integrations,
}: {
	weekOf: string;
	projectHealths: ProjectHealth[];
	portfolioMetrics: ReturnType<typeof calculatePortfolioMetrics>;
	inputs: any;
	integrations: any;
}) {
	const healthEmoji = (status: ProjectHealth['status']) => {
		switch (status) {
			case 'healthy': return '🟢';
			case 'at_risk': return '🟡';
			case 'critical': return '🔴';
		}
	};

	const blocks: any[] = [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: `📊 Weekly Project Status Digest`,
			},
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*Week of ${weekOf}*`,
			},
		},
		{
			type: 'section',
			fields: [
				{
					type: 'mrkdwn',
					text: `*Portfolio Health:*\n${portfolioMetrics.averageHealth}%`,
				},
				{
					type: 'mrkdwn',
					text: `*Active Projects:*\n${portfolioMetrics.totalProjects}`,
				},
				{
					type: 'mrkdwn',
					text: `*Open RFIs:*\n${portfolioMetrics.totalOpenRFIs} (${portfolioMetrics.totalOverdueRFIs} overdue)`,
				},
				{
					type: 'mrkdwn',
					text: `*Pending COs:*\n${portfolioMetrics.totalPendingCOs}`,
				},
			],
		},
		{ type: 'divider' },
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: '*Project Status:*',
			},
		},
	];

	// Sort by health score ascending (worst first)
	const sortedProjects = [...projectHealths].sort((a, b) => a.healthScore - b.healthScore);

	for (const project of sortedProjects.slice(0, 15)) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: [
					`${healthEmoji(project.status)} *${project.projectName}* - ${project.healthScore}%`,
					project.risks.length > 0 ? `  _${project.risks.slice(0, 2).join(', ')}_` : '',
				].filter(Boolean).join('\n'),
			},
		});
	}

	if (sortedProjects.length > 15) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `_...and ${sortedProjects.length - 15} more projects_`,
			},
		});
	}

	await integrations.slack.chat.postMessage({
		channel: inputs.slackChannel,
		blocks,
		text: `Weekly Project Digest: ${portfolioMetrics.totalProjects} projects, ${portfolioMetrics.averageHealth}% average health`,
	});
}

async function sendExecutiveSummary({
	weekOf,
	projectHealths,
	portfolioMetrics,
	inputs,
	integrations,
}: {
	weekOf: string;
	projectHealths: ProjectHealth[];
	portfolioMetrics: ReturnType<typeof calculatePortfolioMetrics>;
	inputs: any;
	integrations: any;
}) {
	const criticalCount = projectHealths.filter((p) => p.status === 'critical').length;
	const atRiskCount = projectHealths.filter((p) => p.status === 'at_risk').length;
	const healthyCount = projectHealths.filter((p) => p.status === 'healthy').length;

	const budgetStatus = portfolioMetrics.totalBudgetVariance > 0
		? `$${(portfolioMetrics.totalBudgetVariance / 1000).toFixed(0)}K over`
		: portfolioMetrics.totalBudgetVariance < 0
			? `$${(Math.abs(portfolioMetrics.totalBudgetVariance) / 1000).toFixed(0)}K under`
			: 'On budget';

	await integrations.slack.chat.postMessage({
		channel: inputs.executiveChannel,
		blocks: [
			{
				type: 'header',
				text: {
					type: 'plain_text',
					text: `📈 Executive Summary - Week of ${weekOf}`,
				},
			},
			{
				type: 'section',
				fields: [
					{
						type: 'mrkdwn',
						text: `*Portfolio Health:*\n${portfolioMetrics.averageHealth}%`,
					},
					{
						type: 'mrkdwn',
						text: `*Budget Status:*\n${budgetStatus}`,
					},
				],
			},
			{
				type: 'section',
				fields: [
					{
						type: 'mrkdwn',
						text: `*🟢 Healthy:*\n${healthyCount}`,
					},
					{
						type: 'mrkdwn',
						text: `*🟡 At Risk:*\n${atRiskCount}`,
					},
					{
						type: 'mrkdwn',
						text: `*🔴 Critical:*\n${criticalCount}`,
					},
				],
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*Key Items:* ${portfolioMetrics.totalOverdueRFIs} overdue RFIs, ${portfolioMetrics.totalPendingCOs} pending change orders`,
				},
			},
		],
		text: `Executive Summary: ${portfolioMetrics.totalProjects} projects, ${portfolioMetrics.averageHealth}% health`,
	});
}

async function sendRiskAlerts({
	criticalProjects,
	inputs,
	integrations,
}: {
	criticalProjects: ProjectHealth[];
	inputs: any;
	integrations: any;
}) {
	await integrations.slack.chat.postMessage({
		channel: inputs.slackChannel,
		blocks: [
			{
				type: 'header',
				text: {
					type: 'plain_text',
					text: `🚨 Critical Project Alert`,
				},
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*${criticalProjects.length} project${criticalProjects.length > 1 ? 's' : ''} require${criticalProjects.length === 1 ? 's' : ''} immediate attention:*`,
				},
			},
			...criticalProjects.map((project) => ({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: [
						`🔴 *${project.projectName}* - ${project.healthScore}% health`,
						`Risks: ${project.risks.join(', ')}`,
					].join('\n'),
				},
			})),
		],
		text: `ALERT: ${criticalProjects.length} critical projects need attention`,
	});
}

async function archiveReportToNotion({
	weekOf,
	projectHealths,
	portfolioMetrics,
	inputs,
	integrations,
}: {
	weekOf: string;
	projectHealths: ProjectHealth[];
	portfolioMetrics: ReturnType<typeof calculatePortfolioMetrics>;
	inputs: any;
	integrations: any;
}) {
	const criticalCount = projectHealths.filter((p) => p.status === 'critical').length;
	const atRiskCount = projectHealths.filter((p) => p.status === 'at_risk').length;

	await integrations.notion.pages.create({
		parent: { database_id: inputs.notionDatabaseId },
		properties: {
			Name: {
				title: [{ text: { content: `Weekly Report - ${weekOf}` } }],
			},
			Date: {
				date: { start: weekOf },
			},
			'Projects Analyzed': {
				number: portfolioMetrics.totalProjects,
			},
			'Average Health': {
				number: portfolioMetrics.averageHealth,
			},
			'Critical Projects': {
				number: criticalCount,
			},
			'At-Risk Projects': {
				number: atRiskCount,
			},
			'Open RFIs': {
				number: portfolioMetrics.totalOpenRFIs,
			},
			'Overdue RFIs': {
				number: portfolioMetrics.totalOverdueRFIs,
			},
			'Budget Variance': {
				number: portfolioMetrics.totalBudgetVariance,
			},
		},
	});
}

export const metadata = {
	id: 'construction-project-digest',
	category: 'construction',
	industry: 'construction',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
