/**
 * QuickBooks Cash Flow Monitor
 *
 * Cash flow that watches itself.
 *
 * Daily monitoring of receivables aging, payment velocity, and cash position.
 * Alerts on concerning patterns before they become problems.
 *
 * Zuhandenheit: The mechanism (QuickBooks API, aging reports, Slack) recedes.
 * What remains: You know your cash position without checking.
 *
 * Integrations: QuickBooks, Slack, Notion (optional)
 * Trigger: Scheduled (daily morning report)
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'QuickBooks Cash Flow Monitor',
	description: 'Daily cash flow intelligence with aging alerts',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_cash_flows',

		outcomeStatement: {
			suggestion: 'Let cash flow watch itself?',
			explanation: 'We\'ll monitor your receivables aging daily, alert on concerning patterns, and keep you informed about your cash position—without you having to check.',
			outcome: 'Cash flow that watches itself',
		},

		primaryPair: {
			from: 'quickbooks',
			to: 'slack',
			workflowId: 'quickbooks-cash-flow-monitor',
			outcome: 'Know your cash position without checking',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['quickbooks', 'slack'],
				workflowId: 'quickbooks-cash-flow-monitor',
				priority: 88,
			},
		],

		smartDefaults: {
			reportTime: { value: '08:00' },
			alertThreshold: { value: 10000 },
			timezone: { inferFrom: 'user_timezone' },
		},

		essentialFields: ['slackChannel'],

		zuhandenheit: {
			timeToValue: 1440,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 15,
		trialDays: 14,
		description: 'Daily cash flow intelligence',
	},

	integrations: [
		{ service: 'quickbooks', scopes: ['read_invoices', 'read_payments', 'read_accounts'] },
		{ service: 'slack', scopes: ['send_messages'] },
		{ service: 'notion', scopes: ['write_pages'], optional: true },
	],

	inputs: {
		slackChannel: {
			type: 'text',
			label: 'Finance Channel',
			required: true,
			description: 'Slack channel for daily reports (e.g., #finance)',
		},
		reportTime: {
			type: 'time',
			label: 'Daily Report Time',
			default: '08:00',
		},
		timezone: {
			type: 'timezone',
			label: 'Timezone',
			default: 'America/New_York',
		},
		alertThreshold: {
			type: 'number',
			label: 'Alert Threshold ($)',
			default: 10000,
			description: 'Alert when receivables over 60 days exceed this amount',
		},
		criticalAgingDays: {
			type: 'number',
			label: 'Critical Aging (days)',
			default: 60,
			description: 'Invoices older than this trigger alerts',
		},
		includeCustomerBreakdown: {
			type: 'boolean',
			label: 'Include Customer Breakdown',
			default: true,
			description: 'Show top customers with outstanding balances',
		},
		notionDatabaseId: {
			type: 'text',
			label: 'Notion Database (optional)',
			description: 'Log daily reports to Notion for tracking',
		},
	},

	trigger: schedule({
		cron: '0 {{inputs.reportTime.hour}} * * *',
		timezone: '{{inputs.timezone}}',
	}),

	async execute({ inputs, integrations, storage }) {
		const now = new Date();
		const results: MonitorResult = {
			date: now.toISOString().split('T')[0],
			alerts: [],
			actions: [],
		};

		// 1. Get receivables aging
		const agingResult = await integrations.quickbooks.getReceivablesAging();

		if (!agingResult.success) {
			return {
				success: false,
				error: 'Failed to fetch receivables aging',
				details: agingResult.error,
			};
		}

		const aging = agingResult.data;
		results.aging = aging;

		// 2. Get overdue invoices for detail
		const overdueResult = await integrations.quickbooks.getOverdueInvoices();
		const overdueInvoices = overdueResult.success ? overdueResult.data || [] : [];

		// 3. Get recent payments for velocity tracking
		const paymentsResult = await integrations.quickbooks.listPayments(30);
		const recentPayments = paymentsResult.success ? paymentsResult.data || [] : [];

		// Calculate payment velocity (last 7 days vs previous 7 days)
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

		const thisWeekPayments = recentPayments.filter(
			p => new Date(p.TxnDate) >= sevenDaysAgo
		);
		const lastWeekPayments = recentPayments.filter(
			p => new Date(p.TxnDate) >= fourteenDaysAgo && new Date(p.TxnDate) < sevenDaysAgo
		);

		const thisWeekTotal = thisWeekPayments.reduce((sum, p) => sum + p.TotalAmt, 0);
		const lastWeekTotal = lastWeekPayments.reduce((sum, p) => sum + p.TotalAmt, 0);
		const velocityChange = lastWeekTotal > 0
			? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100
			: 0;

		results.paymentVelocity = {
			thisWeek: thisWeekTotal,
			lastWeek: lastWeekTotal,
			changePercent: velocityChange,
		};

		// 4. Generate alerts
		const criticalAging = aging.days61to90 + aging.over90;
		if (criticalAging > inputs.alertThreshold) {
			results.alerts.push({
				level: 'warning',
				message: `$${criticalAging.toLocaleString()} in receivables over 60 days`,
			});
		}

		if (aging.over90 > inputs.alertThreshold / 2) {
			results.alerts.push({
				level: 'critical',
				message: `$${aging.over90.toLocaleString()} in receivables over 90 days - immediate attention needed`,
			});
		}

		if (velocityChange < -30) {
			results.alerts.push({
				level: 'warning',
				message: `Payment velocity down ${Math.abs(velocityChange).toFixed(0)}% from last week`,
			});
		}

		// 5. Build customer breakdown if enabled
		let customerBreakdown = '';
		if (inputs.includeCustomerBreakdown && overdueInvoices.length > 0) {
			// Group by customer
			const customerTotals = new Map<string, { name: string; total: number; count: number }>();

			for (const invoice of overdueInvoices) {
				const customerId = invoice.CustomerRef.value;
				const customerName = invoice.CustomerRef.name || 'Unknown';
				const existing = customerTotals.get(customerId) || { name: customerName, total: 0, count: 0 };
				existing.total += invoice.Balance;
				existing.count += 1;
				customerTotals.set(customerId, existing);
			}

			// Sort by total descending
			const sorted = Array.from(customerTotals.values())
				.sort((a, b) => b.total - a.total)
				.slice(0, 5);

			customerBreakdown = sorted
				.map(c => `• ${c.name}: $${c.total.toLocaleString()} (${c.count} invoice${c.count > 1 ? 's' : ''})`)
				.join('\n');
		}

		// 6. Build and send Slack report
		const alertEmoji = results.alerts.some(a => a.level === 'critical') ? '🚨' :
			results.alerts.length > 0 ? '⚠️' : '✅';

		const velocityEmoji = velocityChange >= 0 ? '📈' : '📉';

		let slackMessage = `${alertEmoji} *Daily Cash Flow Report - ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}*\n\n`;

		slackMessage += `*Receivables Aging*\n`;
		slackMessage += `• Current: $${aging.current.toLocaleString()}\n`;
		slackMessage += `• 1-30 days: $${aging.days1to30.toLocaleString()}\n`;
		slackMessage += `• 31-60 days: $${aging.days31to60.toLocaleString()}\n`;
		slackMessage += `• 61-90 days: $${aging.days61to90.toLocaleString()}\n`;
		slackMessage += `• Over 90 days: $${aging.over90.toLocaleString()}\n`;
		slackMessage += `• *Total Outstanding: $${aging.total.toLocaleString()}*\n\n`;

		slackMessage += `*Payment Velocity* ${velocityEmoji}\n`;
		slackMessage += `• This week: $${thisWeekTotal.toLocaleString()}\n`;
		slackMessage += `• Last week: $${lastWeekTotal.toLocaleString()}\n`;
		slackMessage += `• Change: ${velocityChange >= 0 ? '+' : ''}${velocityChange.toFixed(1)}%\n\n`;

		if (customerBreakdown) {
			slackMessage += `*Top Overdue Customers*\n${customerBreakdown}\n\n`;
		}

		if (results.alerts.length > 0) {
			slackMessage += `*Alerts*\n`;
			for (const alert of results.alerts) {
				const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
				slackMessage += `${emoji} ${alert.message}\n`;
			}
		}

		const slackResult = await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			text: slackMessage,
		});

		if (slackResult.success) {
			results.actions.push({ action: 'slack_report', success: true });
		} else {
			results.actions.push({ action: 'slack_report', success: false, error: slackResult.error?.message });
		}

		// 7. Log to Notion if configured
		if (inputs.notionDatabaseId) {
			try {
				const notionResult = await integrations.notion.pages.create({
					parent: { database_id: inputs.notionDatabaseId },
					properties: {
						Name: {
							title: [{ text: { content: `Cash Flow Report - ${results.date}` } }],
						},
						Date: {
							date: { start: results.date },
						},
						'Total Outstanding': {
							number: aging.total,
						},
						'Over 60 Days': {
							number: criticalAging,
						},
						'Payment Velocity': {
							number: thisWeekTotal,
						},
						'Alerts': {
							number: results.alerts.length,
						},
					},
				});

				if (notionResult.success) {
					results.actions.push({ action: 'notion_log', success: true });
				}
			} catch {
				results.actions.push({ action: 'notion_log', success: false, error: 'Notion not configured' });
			}
		}

		// 8. Store for trend tracking
		const history = (await storage.get('report_history')) as ReportHistory[] | null || [];
		history.push({
			date: results.date,
			total: aging.total,
			criticalAging,
			paymentVelocity: thisWeekTotal,
		});

		// Keep last 90 days
		const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
		const filteredHistory = history.filter(h => new Date(h.date) >= ninetyDaysAgo);
		await storage.put('report_history', filteredHistory);

		return {
			success: true,
			...results,
			overdueCount: overdueInvoices.length,
		};
	},
});

// Types
interface MonitorResult {
	date: string;
	aging?: {
		current: number;
		days1to30: number;
		days31to60: number;
		days61to90: number;
		over90: number;
		total: number;
	};
	paymentVelocity?: {
		thisWeek: number;
		lastWeek: number;
		changePercent: number;
	};
	alerts: Array<{
		level: 'warning' | 'critical';
		message: string;
	}>;
	actions: Array<{
		action: string;
		success: boolean;
		error?: string;
	}>;
}

interface ReportHistory {
	date: string;
	total: number;
	criticalAging: number;
	paymentVelocity: number;
}

export const metadata = {
	id: 'quickbooks-cash-flow-monitor',
	category: 'finance-billing',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
	new: true,
};
