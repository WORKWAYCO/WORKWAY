/**
 * Database Workflow Sync Command
 *
 * Syncs workflows from the @workwayco/workflows package to the D1 database.
 * This ensures the marketplace always reflects the available workflows.
 *
 * ZUHANDENHEIT: The deployment should just work.
 * This command prevents the miss where workflow code exists but isn't in D1.
 *
 * @example
 * ```bash
 * # Check what workflows need syncing (dry run)
 * workway db sync-workflows --dry-run
 *
 * # Sync workflows to production
 * workway db sync-workflows
 *
 * # Sync to local database
 * workway db sync-workflows --local
 * ```
 */

import { Logger } from '../../utils/logger.js';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

interface SyncOptions {
	dryRun?: boolean;
	local?: boolean;
	config?: string;
}

interface WorkflowMetadata {
	id: string;
	name: string;
	description: string;
	outcomeFrame: string;
	integrations: string[];
	pricingModel: string;
	category: string;
	tagline: string;
}

// Workflow registry - maps workflow IDs to their metadata
// This should be auto-generated from @workwayco/workflows in the future
const WORKFLOW_REGISTRY: WorkflowMetadata[] = [
	// Finance & Payments
	{
		id: 'stripe-to-notion',
		name: 'Stripe to Notion Invoice Tracker',
		description: 'Track Stripe payments automatically in Notion.',
		tagline: 'Payments tracked automatically',
		outcomeFrame: 'when_payments_arrive',
		integrations: ['stripe', 'notion'],
		pricingModel: 'freemium',
		category: 'finance',
	},
	{
		id: 'invoice-generator',
		name: 'Invoice Generator',
		description: 'Generate invoices from Notion projects via Stripe.',
		tagline: 'Projects that invoice themselves',
		outcomeFrame: 'when_payments_arrive',
		integrations: ['notion', 'stripe'],
		pricingModel: 'freemium',
		category: 'finance',
	},
	// Meetings & Productivity
	{
		id: 'meeting-intelligence',
		name: 'Meeting Intelligence',
		description: 'Automatically extract notes, action items, and summaries from Zoom meetings into Notion.',
		tagline: 'Zoom meetings that write their own notes',
		outcomeFrame: 'after_meetings',
		integrations: ['zoom', 'notion'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	{
		id: 'meeting-summarizer',
		name: 'Meeting Summarizer',
		description: 'AI-powered meeting summaries automatically posted to Slack channels after meetings end.',
		tagline: 'Meeting summaries posted to Slack',
		outcomeFrame: 'after_meetings',
		integrations: ['zoom', 'slack'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	{
		id: 'meeting-followup-engine',
		name: 'Meeting Followup Engine',
		description: 'Automatically create follow-up tasks in Todoist when Calendly meetings are scheduled.',
		tagline: 'Meetings that create their own tasks',
		outcomeFrame: 'after_calls',
		integrations: ['calendly', 'todoist'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	{
		id: 'calendar-meeting-prep',
		name: 'Calendar Meeting Prep',
		description: 'Before meetings, automatically gather context from Notion and prepare talking points.',
		tagline: 'Meetings that brief themselves',
		outcomeFrame: 'before_meetings',
		integrations: ['google-calendar', 'notion'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	{
		id: 'meeting-to-action',
		name: 'Meeting to Action',
		description: 'Extract action items from Zoom meetings and create tasks in Todoist automatically.',
		tagline: 'Meetings that assign themselves',
		outcomeFrame: 'after_meetings',
		integrations: ['zoom', 'todoist'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	{
		id: 'weekly-productivity-digest',
		name: 'Weekly Productivity Digest',
		description: 'Weekly summary of completed tasks and productivity metrics.',
		tagline: 'Productivity insights weekly',
		outcomeFrame: 'weekly_automatically',
		integrations: ['todoist', 'slack'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	// Team & Communication
	{
		id: 'team-digest',
		name: 'Team Digest',
		description: 'Daily digest of team activity across Notion and Slack.',
		tagline: 'Team activity digest every morning',
		outcomeFrame: 'every_morning',
		integrations: ['notion', 'slack'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	{
		id: 'standup-bot',
		name: 'Standup Bot',
		description: 'Collect daily standups via Slack and archive to Notion.',
		tagline: 'Standups that collect themselves',
		outcomeFrame: 'every_morning',
		integrations: ['slack', 'notion'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	{
		id: 'support-ticket-router',
		name: 'Support Ticket Router',
		description: 'Route support tickets from Slack to the right team.',
		tagline: 'Tickets routed to the right team',
		outcomeFrame: 'when_tickets_arrive',
		integrations: ['slack'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	// Sales & Onboarding
	{
		id: 'sales-lead-pipeline',
		name: 'Sales Lead Pipeline',
		description: 'Automatically route Typeform leads to HubSpot CRM with lead scoring and assignment.',
		tagline: 'Leads that route themselves',
		outcomeFrame: 'when_leads_come_in',
		integrations: ['typeform', 'hubspot'],
		pricingModel: 'freemium',
		category: 'sales',
	},
	{
		id: 'client-onboarding',
		name: 'Client Onboarding',
		description: 'When new Stripe payments arrive, create onboarding tasks and workflows automatically.',
		tagline: 'Clients onboarded automatically',
		outcomeFrame: 'when_clients_onboard',
		integrations: ['stripe', 'todoist'],
		pricingModel: 'freemium',
		category: 'sales',
	},
	{
		id: 'onboarding',
		name: 'Onboarding Automation',
		description: 'Automate team member onboarding with tasks, documentation, and notifications.',
		tagline: 'New hires onboarded automatically',
		outcomeFrame: 'when_clients_onboard',
		integrations: ['slack', 'notion'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	// Dev Team & Data
	{
		id: 'sprint-progress-tracker',
		name: 'Sprint Progress Tracker',
		description: 'Daily sprint updates posted to Slack from Linear.',
		tagline: 'Sprint updates every morning',
		outcomeFrame: 'every_morning',
		integrations: ['linear', 'slack'],
		pricingModel: 'freemium',
		category: 'developer',
	},
	{
		id: 'spreadsheet-sync',
		name: 'Spreadsheet Sync',
		description: 'Keep Google Sheets and Airtable bases in sync automatically.',
		tagline: 'Spreadsheets synced to Airtable',
		outcomeFrame: 'when_data_changes',
		integrations: ['google-sheets', 'airtable'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	{
		id: 'content-calendar',
		name: 'Content Calendar',
		description: 'Content reminders and publishing schedule via Slack.',
		tagline: 'Content reminders in Slack',
		outcomeFrame: 'every_morning',
		integrations: ['airtable', 'slack'],
		pricingModel: 'freemium',
		category: 'marketing',
	},
	// Error Tracking
	{
		id: 'error-incident-manager',
		name: 'Error Incident Manager',
		description: 'Track Sentry errors in Notion and alert Slack.',
		tagline: 'Errors that document themselves',
		outcomeFrame: 'when_errors_happen',
		integrations: ['sentry', 'notion', 'slack'],
		pricingModel: 'freemium',
		category: 'developer',
	},
	// Design & Creative
	{
		id: 'design-portfolio-sync',
		name: 'Design Portfolio Sync',
		description: 'Sync Dribbble shots to Notion portfolio automatically.',
		tagline: 'Portfolio that updates itself',
		outcomeFrame: 'after_publishing',
		integrations: ['dribbble', 'notion'],
		pricingModel: 'freemium',
		category: 'marketing',
	},
	// Scheduling
	{
		id: 'scheduling-autopilot',
		name: 'Scheduling Autopilot',
		description: 'Log Calendly bookings to Notion and notify Slack.',
		tagline: 'Meetings logged automatically',
		outcomeFrame: 'when_meetings_booked',
		integrations: ['calendly', 'notion', 'slack'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	// Revenue
	{
		id: 'revenue-radar',
		name: 'Revenue Radar',
		description: 'Real-time payment notifications and revenue tracking in Slack.',
		tagline: 'Payment alerts in Slack',
		outcomeFrame: 'when_payments_arrive',
		integrations: ['stripe', 'slack'],
		pricingModel: 'freemium',
		category: 'finance',
	},
	// Forms
	{
		id: 'form-response-hub',
		name: 'Form Response Hub',
		description: 'Automatically log Typeform responses to a Notion database with analysis.',
		tagline: 'Responses logged to Notion',
		outcomeFrame: 'when_forms_submitted',
		integrations: ['typeform', 'notion'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	// CRM
	{
		id: 'deal-tracker',
		name: 'Deal Tracker',
		description: 'Track HubSpot deals and alert Slack on progress.',
		tagline: 'Deal alerts in Slack',
		outcomeFrame: 'when_deals_progress',
		integrations: ['hubspot', 'slack'],
		pricingModel: 'freemium',
		category: 'sales',
	},
	// Tasks
	{
		id: 'task-sync-bridge',
		name: 'Task Sync Bridge',
		description: 'Sync completed Todoist tasks to Notion.',
		tagline: 'Completed tasks logged to Notion',
		outcomeFrame: 'when_tasks_complete',
		integrations: ['todoist', 'notion'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	// Developer Tools
	{
		id: 'github-to-linear',
		name: 'GitHub to Linear',
		description: 'Sync GitHub issues and PRs to Linear for unified project management.',
		tagline: 'Issues synced to Linear',
		outcomeFrame: 'when_issues_arrive',
		integrations: ['github', 'linear'],
		pricingModel: 'freemium',
		category: 'developer',
	},
	{
		id: 'pr-review-notifier',
		name: 'PR Review Notifier',
		description: 'Get notified in Slack when PRs need review or are approved.',
		tagline: 'PR alerts in Slack',
		outcomeFrame: 'when_code_changes',
		integrations: ['github', 'slack'],
		pricingModel: 'freemium',
		category: 'developer',
	},
	// Team Collaboration
	{
		id: 'discord-standup-bot',
		name: 'Discord Standup Bot',
		description: 'Collect daily standups in Discord and archive them to Notion.',
		tagline: 'Standups archived to Notion',
		outcomeFrame: 'every_morning',
		integrations: ['discord', 'notion'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	// Google Drive
	{
		id: 'drive-document-hub',
		name: 'Drive Document Hub',
		description: 'Automatically organize Google Drive documents in Notion with smart categorization.',
		tagline: 'Documents that organize themselves',
		outcomeFrame: 'when_files_change',
		integrations: ['google-drive', 'notion'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	{
		id: 'document-approval-flow',
		name: 'Document Approval Flow',
		description: 'Slack-based approval workflow for Google Drive documents with tracking.',
		tagline: 'Documents that approve themselves',
		outcomeFrame: 'when_approval_needed',
		integrations: ['google-drive', 'slack'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	// Calendar & Status
	{
		id: 'calendar-availability-sync',
		name: 'Calendar Availability Sync',
		description: 'Automatically update Slack status based on Google Calendar events.',
		tagline: 'Status that updates itself',
		outcomeFrame: 'always_current',
		integrations: ['google-calendar', 'slack'],
		pricingModel: 'free',
		category: 'productivity',
	},
	// Billing & Time Tracking
	{
		id: 'meeting-expense-tracker',
		name: 'Meeting Expense Tracker',
		description: 'Track billable meetings and automatically create Stripe invoices.',
		tagline: 'Meetings that invoice themselves',
		outcomeFrame: 'after_meetings',
		integrations: ['zoom', 'stripe'],
		pricingModel: 'freemium',
		category: 'finance',
	},
	{
		id: 'project-time-tracker',
		name: 'Project Time Tracker',
		description: 'Automatically track time spent on Linear issues and sync to Google Sheets.',
		tagline: 'Time that tracks itself',
		outcomeFrame: 'when_work_completes',
		integrations: ['linear', 'google-sheets'],
		pricingModel: 'freemium',
		category: 'productivity',
	},
	// Dental / Healthcare
	{
		id: 'dental-appointment-autopilot',
		name: 'Dental Appointment Autopilot',
		description: 'Smart appointment reminders for dental practices via SMS and Slack.',
		tagline: 'No-shows that prevent themselves',
		outcomeFrame: 'when_appointments_scheduled',
		integrations: ['sikka', 'twilio'],
		pricingModel: 'freemium',
		category: 'healthcare',
	},
	{
		id: 'dental-review-booster',
		name: 'Dental Review Booster',
		description: 'Automatically request reviews from satisfied dental patients.',
		tagline: 'Visits become Google reviews',
		outcomeFrame: 'after_appointments',
		integrations: ['sikka', 'google-business'],
		pricingModel: 'freemium',
		category: 'healthcare',
	},
];

/**
 * Find wrangler config file
 */
function findWranglerConfig(): string | null {
	const candidates = [
		'wrangler.jsonc',
		'wrangler.json',
		'wrangler.toml',
		'../workway-platform/apps/api/wrangler.jsonc',
		'../../workway-platform/apps/api/wrangler.jsonc',
	];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

/**
 * Get database name from wrangler config
 */
function getDatabaseName(configPath: string): string | null {
	try {
		const content = readFileSync(configPath, 'utf-8');

		if (configPath.endsWith('.jsonc') || configPath.endsWith('.json')) {
			const jsonContent = content
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/\/\/.*/g, '');
			const config = JSON.parse(jsonContent);

			if (config.d1_databases && config.d1_databases[0]) {
				return config.d1_databases[0].database_name;
			}
		}

		if (configPath.endsWith('.toml')) {
			const match = content.match(/database_name\s*=\s*"([^"]+)"/);
			if (match) {
				return match[1];
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Get existing workflows from D1
 */
function getExistingWorkflows(dbName: string, options: SyncOptions): string[] {
	try {
		const remoteFlag = options.local ? '--local' : '--remote';
		const configPath = findWranglerConfig();
		const configFlag = configPath ? `--config "${configPath}"` : '';

		const cmd = `npx wrangler d1 execute ${dbName} ${remoteFlag} ${configFlag} --command "SELECT id FROM marketplace_integrations" --json`;

		const output = execSync(cmd, {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe'],
			cwd: path.resolve(process.cwd(), '../workway-platform/apps/api'),
		});

		const result = JSON.parse(output);
		if (result && result[0] && result[0].results) {
			return result[0].results.map((r: any) => r.id.replace('int_', ''));
		}
		return [];
	} catch (error: any) {
		Logger.debug(`Failed to get existing workflows: ${error.message}`);
		return [];
	}
}

/**
 * Generate INSERT statement for missing workflows
 */
function generateInsertSQL(workflows: WorkflowMetadata[]): string {
	if (workflows.length === 0) return '';

	const now = Date.now();
	const values = workflows.map((w) => {
		const id = `int_${w.id.replace(/-/g, '_')}`;
		const tags = JSON.stringify([...w.integrations, ...w.id.split('-')]);
		const providers = JSON.stringify(w.integrations);

		return `('${id}', 'dev_workway_official', '${w.name.replace(/'/g, "''")}',
 '${w.tagline.replace(/'/g, "''")}',
 '${w.description.replace(/'/g, "''")}',
 'published', '${w.pricingModel}', ${w.pricingModel === 'free' ? 0 : 500}, 'light',
 '${providers}', '${tags}', '["business"]',
 '${w.outcomeFrame}', ${now}, ${now})`;
	});

	return `INSERT INTO marketplace_integrations (
  id, developer_id, name, tagline, description,
  status, pricing_model, base_price, complexity_tier,
  required_oauth_providers, tags, target_audience,
  outcome_frame, created_at, updated_at
) VALUES
${values.join(',\n')};`;
}

/**
 * Main command handler
 */
export async function dbSyncWorkflowsCommand(options: SyncOptions): Promise<void> {
	Logger.log('');
	Logger.log('🔄 Syncing workflows to D1 database...');
	Logger.log('');

	const configPath = findWranglerConfig();
	if (!configPath) {
		Logger.error('Could not find wrangler configuration file');
		Logger.log('');
		Logger.log('Make sure you are in the WORKWAY project root or have access to wrangler.jsonc');
		process.exit(1);
	}

	const dbName = getDatabaseName(configPath);
	if (!dbName) {
		Logger.error('Could not find D1 database name in wrangler config');
		process.exit(1);
	}

	Logger.log(`📊 Database: ${dbName}`);
	Logger.log(`📁 Config: ${configPath}`);
	Logger.log('');

	// Get existing workflows
	const existing = getExistingWorkflows(dbName, options);
	Logger.log(`📦 Found ${existing.length} workflows in database`);
	Logger.log(`📋 Registry has ${WORKFLOW_REGISTRY.length} workflows`);
	Logger.log('');

	// Find missing workflows
	const missing = WORKFLOW_REGISTRY.filter(
		(w) => !existing.includes(w.id) && !existing.includes(w.id.replace(/-/g, '_'))
	);

	if (missing.length === 0) {
		Logger.success('All workflows are synced!');
		return;
	}

	Logger.warn(`⚠️  ${missing.length} workflows need syncing:`);
	for (const w of missing) {
		Logger.log(`   - ${w.id}: ${w.name}`);
	}
	Logger.log('');

	if (options.dryRun) {
		Logger.log('🔍 Dry run - no changes made');
		Logger.log('');
		Logger.log('SQL that would be executed:');
		Logger.log('');
		Logger.log(generateInsertSQL(missing));
		return;
	}

	// Execute the insert
	try {
		const sql = generateInsertSQL(missing);
		const remoteFlag = options.local ? '--local' : '--remote';

		// Write SQL to temp file and execute
		const tempFile = `/tmp/workway-sync-${Date.now()}.sql`;
		require('fs').writeFileSync(tempFile, sql);

		const cmd = `npx wrangler d1 execute ${dbName} ${remoteFlag} --config "${configPath}" --file="${tempFile}"`;

		Logger.log('🚀 Executing sync...');

		execSync(cmd, {
			encoding: 'utf-8',
			stdio: 'inherit',
			cwd: path.resolve(process.cwd(), '../workway-platform/apps/api'),
		});

		// Clean up
		require('fs').unlinkSync(tempFile);

		Logger.log('');
		Logger.success(`✅ Synced ${missing.length} workflows to database!`);
	} catch (error: any) {
		Logger.error(`Sync failed: ${error.message}`);
		process.exit(1);
	}
}
