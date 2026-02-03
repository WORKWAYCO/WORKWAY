/**
 * WORKWAY CLI
 *
 * Build, test, and publish workflows and integrations.
 * Cloudflare-native. Less, but better.
 */

import { Command } from 'commander';
import { loginCommand } from './commands/auth/login.js';
import { logoutCommand } from './commands/auth/logout.js';
import { whoamiCommand } from './commands/auth/whoami.js';
import { workflowInitCommand } from './commands/workflow/init.js';
import { workflowTestCommand } from './commands/workflow/test.js';
import { workflowRunCommand } from './commands/workflow/run.js';
import { workflowDevCommand } from './commands/workflow/dev.js';
import { workflowBuildCommand } from './commands/workflow/build.js';
import { workflowPublishCommand } from './commands/workflow/publish.js';
import { workflowValidateCommand } from './commands/workflow/validate.js';
import { workflowForkCommand } from './commands/workflow/fork.js';
import { workflowLineageCommand } from './commands/workflow/lineage.js';
import { workflowDeleteCommand } from './commands/workflow/delete.js';
import { workflowInstallCommand } from './commands/workflow/install.js';
import {
	workflowAccessGrantListCommand,
	workflowAccessGrantCreateCommand,
	workflowAccessGrantRevokeCommand,
} from './commands/workflow/access-grants.js';
import { workflowVersionCommand } from './commands/workflow/version.js';
import { oauthConnectCommand } from './commands/oauth/connect.js';
import { oauthListCommand } from './commands/oauth/list.js';
import { oauthDisconnectCommand } from './commands/oauth/disconnect.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { developerRegisterCommand } from './commands/developer/register.js';
import { developerProfileCommand } from './commands/developer/profile.js';
import { developerEarningsCommand } from './commands/developer/earnings.js';
import { developerStripeCommand } from './commands/developer/stripe.js';
import { developerInitCommand } from './commands/developer/init.js';
import { developerSubmitCommand } from './commands/developer/submit.js';
import { developerStatusCommand } from './commands/developer/status.js';
import {
	developerOAuthListCommand,
	developerOAuthAddCommand,
	developerOAuthRemoveCommand,
	developerOAuthTestCommand,
	developerOAuthPromoteCommand,
} from './commands/developer/oauth.js';
import { aiModelsCommand } from './commands/ai/models.js';
import { aiTestCommand } from './commands/ai/test.js';
import { aiEstimateCommand } from './commands/ai/estimate.js';
import { createCommand } from './commands/agentic/create.js';
import { explainCommand } from './commands/agentic/explain.js';
import { modifyCommand } from './commands/agentic/modify.js';
import { diagnoseCommand } from './commands/agentic/diagnose.js';
import { marketplaceNeedsCommand, marketplaceSearchCommand, marketplaceBrowseCommand, marketplaceInfoCommand } from './commands/marketplace/index.js';
import { requestsCommand } from './commands/requests.js';
import { dbCheckCommand } from './commands/db/check.js';
import { dbSyncWorkflowsCommand } from './commands/db/sync-workflows.js';
import { beadsNotionInitCommand } from './commands/beads/notion-init.js';
import { beadsNotionSyncCommand } from './commands/beads/notion.js';
import { registerSLICommand } from './commands/sli/index.js';
import { rlmAssessCommand } from './commands/rlm/index.js';
import { Logger } from './utils/logger.js';
import { handleCommand, handleCommandError } from './utils/command-handler.js';

// Create CLI program
const program = new Command();

program
	.name('workway')
	.description('WORKWAY CLI - Build, test, and publish workflows')
	.version('0.3.5');

// ============================================================================
// AUTHENTICATION COMMANDS
// ============================================================================

program
	.command('login')
	.description('Authenticate with WORKWAY platform')
	.action(handleCommand(loginCommand));

program
	.command('logout')
	.description('Clear local authentication')
	.action(handleCommand(logoutCommand));

program
	.command('whoami')
	.description('Display current authenticated user')
	.action(handleCommand(whoamiCommand));

// ============================================================================
// WORKFLOW COMMANDS
// ============================================================================

const workflowCommand = program.command('workflow').description('Workflow development commands');

workflowCommand
	.command('init [name]')
	.description('Create a new workflow project')
	.option('--ai', 'Use Workers AI template')
	.option('--with-claude', 'Include .claude/ directory')
	.action(handleCommand(workflowInitCommand));

workflowCommand
	.command('test')
	.description('Run workflow tests')
	.option('--mock', 'Use mocked integrations')
	.option('--live', 'Use live OAuth connections')
	.option('--data <file>', 'Path to test data file')
	.action(handleCommand(workflowTestCommand));

workflowCommand
	.command('run')
	.description('Execute workflow locally')
	.option('--input <file>', 'Path to input data file')
	.option('--env <env>', 'Environment (development/production)')
	.option('--verbose', 'Show verbose output')
	.option('--timeout <ms>', 'Execution timeout in milliseconds')
	.action(handleCommand(workflowRunCommand));

workflowCommand
	.command('dev')
	.description('Start dev server with hot reload')
	.option('--port <port>', 'Port number')
	.option('--mock', 'Use mock mode')
	.option('--no-mock', 'Use live OAuth connections')
	.action(handleCommand(workflowDevCommand));

workflowCommand
	.command('build')
	.description('Build workflow for deployment')
	.option('--out-dir <dir>', 'Output directory')
	.option('--minify', 'Minify output')
	.option('--no-minify', 'Disable minification')
	.option('--sourcemap', 'Generate sourcemaps')
	.action(handleCommand(workflowBuildCommand));

workflowCommand
	.command('publish')
	.description('Publish workflow to marketplace')
	.option('--draft', 'Publish as draft')
	.option('--notes <text>', 'Version notes')
	.action(handleCommand(workflowPublishCommand));

workflowCommand
	.command('validate [file]')
	.description('Validate workflow schema')
	.option('--strict', 'Treat warnings as errors')
	.option('--json', 'Output as JSON')
	.option('--benchmark', 'Show timing info')
	.option('--iterations <n>', 'Benchmark iterations', (v) => parseInt(v, 10))
	.option('--wasm', 'Force WASM validator')
	.option('--no-wasm', 'Force TypeScript validator')
	.option('--compare-validators', 'Compare validator performance')
	.action(async (file: string, options: any) => {
		try {
			await workflowValidateCommand(file, options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

workflowCommand
	.command('fork [workflow]')
	.description('Fork a marketplace workflow')
	.action(handleCommand(workflowForkCommand));

workflowCommand
	.command('install [workflow]')
	.description('Install a marketplace workflow')
	.option('--dir <name>', 'Custom directory name')
	.option('--force', 'Skip confirmation')
	.action(handleCommand(async (workflow: string | undefined, options: any) => {
		await workflowInstallCommand(workflow, {
			dir: options.dir,
			force: options.force,
		});
	}));

workflowCommand
	.command('lineage [workflow]')
	.description('View fork history')
	.action(handleCommand(workflowLineageCommand));

workflowCommand
	.command('delete [workflow-id]')
	.description('Delete an inactive workflow')
	.option('--force', 'Skip confirmation')
	.option('--path <path>', 'Path to workflow file')
	.option('--keep-data', 'Keep stored data')
	.action(handleCommand(async (workflowId: string, options: any) => {
		await workflowDeleteCommand(workflowId, options);
	}));

// Version management subcommand
const versionCommand = workflowCommand.command('version').description('Manage workflow versions');

versionCommand
	.command('list')
	.description('List all versions')
	.action(handleCommand(async () => {
		await workflowVersionCommand('list', {});
	}));

versionCommand
	.command('show')
	.description('Show current version')
	.action(handleCommand(async () => {
		await workflowVersionCommand('show', {});
	}));

versionCommand
	.command('bump [type]')
	.description('Bump version (patch, minor, major)')
	.action(handleCommand(async (type: string | undefined) => {
		await workflowVersionCommand('bump', { type: type as any });
	}));

versionCommand
	.command('rollback [versionId]')
	.description('Create draft from old version')
	.action(handleCommand(async (versionId: string | undefined) => {
		await workflowVersionCommand('rollback', { versionId });
	}));

versionCommand
	.command('pin [installationId]')
	.description('Pin installation to specific version')
	.option('--version <versionId>', 'Version ID')
	.option('--reason <text>', 'Reason for pinning')
	.action(handleCommand(async (installationId: string | undefined, options: any) => {
		await workflowVersionCommand('pin', {
			installationId,
			versionId: options.version,
			reason: options.reason,
		});
	}));

versionCommand
	.command('deprecate [versionId]')
	.description('Deprecate a version')
	.option('--reason <text>', 'Reason')
	.action(handleCommand(async (versionId: string | undefined, options: any) => {
		await workflowVersionCommand('deprecate', {
			versionId,
			reason: options.reason,
		});
	}));

versionCommand
	.command('approve [versionId]')
	.description('Approve pending version')
	.option('--notes <text>', 'Notes')
	.option('--publish', 'Publish immediately')
	.action(handleCommand(async (versionId: string | undefined, options: any) => {
		await workflowVersionCommand('approve', {
			versionId,
			reason: options.notes,
			autoPublish: options.publish,
		});
	}));

versionCommand
	.command('reject [versionId]')
	.description('Reject pending version')
	.option('--reason <text>', 'Reason')
	.action(handleCommand(async (versionId: string | undefined, options: any) => {
		await workflowVersionCommand('reject', {
			versionId,
			reason: options.reason,
		});
	}));

// Access Grants subcommand (Private Workflows)
const accessGrantsCommand = workflowCommand.command('access-grants').description('Manage access grants');

accessGrantsCommand
	.command('list [workflow-id]')
	.description('List access grants')
	.action(handleCommand(async (workflowId: string | undefined, options: any) => {
		await workflowAccessGrantListCommand(workflowId, options);
	}));

accessGrantsCommand
	.command('create [workflow-id]')
	.description('Create access grant')
	.option('--grant-type <type>', 'Type: user, email_domain, access_code')
	.option('--grant-value <value>', 'Email, domain, or code')
	.option('--max-installs <n>', 'Max installations', parseInt)
	.option('--expires <date>', 'Expiration date (ISO)')
	.option('--notes <text>', 'Internal notes')
	.action(handleCommand(async (workflowId: string | undefined, options: any) => {
		await workflowAccessGrantCreateCommand(workflowId, {
			grantType: options.grantType,
			grantValue: options.grantValue,
			maxInstalls: options.maxInstalls,
			expires: options.expires,
			notes: options.notes,
		});
	}));

accessGrantsCommand
	.command('revoke [grant-id]')
	.description('Revoke access grant')
	.option('--workflow-id <id>', 'Workflow ID')
	.action(handleCommand(async (grantId: string | undefined, options: any) => {
		await workflowAccessGrantRevokeCommand(grantId, { workflowId: options.workflowId });
	}));

// ============================================================================
// MARKETPLACE COMMANDS
// ============================================================================

const marketplaceCommand = program.command('marketplace').description('Browse and search workflows');

// Primary discovery command (Pathway Model)
marketplaceCommand
	.command('needs')
	.description('Find workflows by outcome')
	.option('--from <integration>', 'Source integration')
	.option('--to <integration>', 'Target integration')
	.option('--after <outcome>', 'Outcome frame')
	.option('--show-outcomes', 'List outcome frames')
	.action(handleCommand(async (options: any) => {
		await marketplaceNeedsCommand({
			from: options.from,
			to: options.to,
			after: options.after,
			showOutcomes: options.showOutcomes,
		});
	}));

marketplaceCommand
	.command('search [query]')
	.description('Search workflows')
	.option('--category <category>', 'Filter by category')
	.option('--developer <developer>', 'Filter by developer')
	.option('--sort <sort>', 'Sort: relevance, popular, recent, rating')
	.option('--limit <n>', 'Limit results', parseInt)
	.action(handleCommand(async (query: string, options: any) => {
		await marketplaceSearchCommand(query, {
			category: options.category,
			developer: options.developer,
			sortBy: options.sort,
			limit: options.limit,
		});
	}));

marketplaceCommand
	.command('browse')
	.description('Browse by category')
	.option('--category <category>', 'Category')
	.option('--featured', 'Featured only')
	.option('--limit <n>', 'Limit results', parseInt)
	.action(handleCommand(async (options: any) => {
		await marketplaceBrowseCommand({
			category: options.category,
			featured: options.featured,
			limit: options.limit,
		});
	}));

marketplaceCommand
	.command('info [workflow]')
	.description('View workflow details')
	.action(handleCommand(marketplaceInfoCommand));

// ============================================================================
// TOP-LEVEL DISCOVERY (Pathway Model Shortcut)
// ============================================================================

// Allow `workway needs` as shortcut for `workway marketplace needs`
program
	.command('needs')
	.description('Find workflows by outcome')
	.option('--from <integration>', 'Source integration')
	.option('--to <integration>', 'Target integration')
	.option('--after <outcome>', 'Outcome frame')
	.option('--show-outcomes', 'List outcome frames')
	.action(handleCommand(async (options: any) => {
		await marketplaceNeedsCommand({
			from: options.from,
			to: options.to,
			after: options.after,
			showOutcomes: options.showOutcomes,
		});
	}));

// ============================================================================
// ENTERPRISE REQUESTS COMMANDS
// ============================================================================

const requestsCommandGroup = program.command('requests').description('Manage workflow requests');

requestsCommandGroup
	.command('list')
	.description('List requests')
	.option('--status <status>', 'Filter by status')
	.option('--assigned-to-me', 'Show my requests')
	.option('--available', 'Show claimable requests')
	.action(handleCommand(async (options: { status?: string; assignedToMe?: boolean; available?: boolean }) => {
		await requestsCommand('list', undefined, {
			status: options.status,
			assignedToMe: options.assignedToMe,
			available: options.available,
		});
	}));

requestsCommandGroup
	.command('show [id]')
	.description('Show request details')
	.action(handleCommand(async (id?: string) => {
		await requestsCommand('show', id);
	}));

requestsCommandGroup
	.command('claim [id]')
	.description('Claim an unassigned request')
	.action(handleCommand(async (id?: string) => {
		await requestsCommand('claim', id);
	}));

requestsCommandGroup
	.command('start [id]')
	.description('Mark request as in progress')
	.action(handleCommand(async (id?: string) => {
		await requestsCommand('start', id);
	}));

requestsCommandGroup
	.command('complete [id]')
	.description('Complete request')
	.option('--workflow <id>', 'Link workflow')
	.action(handleCommand(async (id?: string, options?: { workflow?: string }) => {
		await requestsCommand('complete', id, { integrationId: options?.workflow });
	}));

requestsCommandGroup
	.command('comment [id]')
	.description('Add comment')
	.option('--question', 'Mark as question')
	.action(handleCommand(async (id?: string, options?: { question?: boolean }) => {
		await requestsCommand('comment', id, { isQuestion: options?.question });
	}));

// ============================================================================
// AI COMMANDS - Cloudflare Workers AI
// ============================================================================

const aiCommand = program.command('ai').description('Workers AI tools');

aiCommand
	.command('models')
	.description('List AI models')
	.option('--type <type>', 'Filter by type')
	.option('--json', 'Output as JSON')
	.action(handleCommand(aiModelsCommand));

aiCommand
	.command('test [prompt]')
	.description('Test AI model')
	.option('--model <model>', 'Model name')
	.option('--mock', 'Use mock response')
	.option('--json', 'Output as JSON')
	.action(handleCommand(aiTestCommand));

aiCommand
	.command('estimate')
	.description('Estimate AI costs')
	.option('--executions <n>', 'Monthly executions', parseInt)
	.option('--tokens <n>', 'Tokens per execution', parseInt)
	.option('--model <model>', 'Model name')
	.action(
		handleCommand(async (options: any) => {
			await aiEstimateCommand({
				executions: options.executions,
				tokensPerExecution: options.tokens,
				model: options.model,
			});
		})
	);

// ============================================================================
// OAUTH COMMANDS
// ============================================================================

const oauthCommand = program.command('oauth').description('Manage OAuth connections');

oauthCommand
	.command('connect [provider]')
	.description('Connect OAuth account')
	.action(handleCommand(oauthConnectCommand));

oauthCommand
	.command('list')
	.description('List connections')
	.action(handleCommand(oauthListCommand));

oauthCommand
	.command('disconnect [provider]')
	.description('Remove connection')
	.action(handleCommand(oauthDisconnectCommand));

// ============================================================================
// STATUS & LOGS COMMANDS
// ============================================================================

program
	.command('status')
	.description('Show account status')
	.action(handleCommand(statusCommand));

program
	.command('logs')
	.description('View execution logs')
	.option('--workflow <id>', 'Filter by workflow')
	.option('--limit <n>', 'Number of logs', '20')
	.option('--follow', 'Stream logs')
	.option('--status <status>', 'Filter: completed/failed/running')
	.action(handleCommand(logsCommand));

// ============================================================================
// DEVELOPER COMMANDS
// ============================================================================

const developerCommand = program.command('developer').description('Developer account management');

// Waitlist flow commands
developerCommand
	.command('init')
	.description('Create developer profile')
	.action(handleCommand(developerInitCommand));

developerCommand
	.command('submit')
	.description('Submit for review')
	.action(handleCommand(developerSubmitCommand));

developerCommand
	.command('status')
	.description('Check application status')
	.action(handleCommand(developerStatusCommand));

// Legacy/approved developer commands
developerCommand
	.command('register')
	.description('Register as developer')
	.action(handleCommand(developerRegisterCommand));

developerCommand
	.command('profile')
	.description('View or edit profile')
	.option('--edit', 'Edit interactively')
	.action(handleCommand(developerProfileCommand));

developerCommand
	.command('earnings')
	.description('View earnings')
	.option('--setup', 'Set up Stripe Connect')
	.option('--period <period>', 'Period: week/month/year')
	.action(handleCommand(developerEarningsCommand));

developerCommand
	.command('stripe [action]')
	.description('Manage Stripe Connect')
	.action(async (action: string = 'status') => {
		try {
			const validActions = ['setup', 'status', 'refresh'];
			if (!validActions.includes(action)) {
				Logger.error(`Invalid action: ${action}`);
				Logger.log('');
				Logger.log('Valid actions: setup, status, refresh');
				process.exit(1);
			}
			await developerStripeCommand({ action: action as 'setup' | 'status' | 'refresh' });
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

// OAuth Apps subcommand (BYOO - Bring Your Own OAuth)
const developerOAuthCommand = developerCommand.command('oauth').description('Manage OAuth apps');

developerOAuthCommand
	.command('list')
	.description('List OAuth apps')
	.action(handleCommand(developerOAuthListCommand));

developerOAuthCommand
	.command('add [provider]')
	.description('Add OAuth credentials')
	.option('--force', 'Overwrite existing')
	.action(handleCommand(async (provider: string | undefined, options: any) => {
		await developerOAuthAddCommand({ provider, force: options.force });
	}));

developerOAuthCommand
	.command('remove [provider]')
	.description('Remove OAuth app')
	.option('--force', 'Skip confirmation')
	.action(handleCommand(async (provider: string | undefined, options: any) => {
		await developerOAuthRemoveCommand({ provider, force: options.force });
	}));

developerOAuthCommand
	.command('test [provider]')
	.description('Test credentials')
	.action(handleCommand(async (provider: string | undefined) => {
		await developerOAuthTestCommand({ provider });
	}));

developerOAuthCommand
	.command('promote [provider]')
	.description('Promote to production')
	.action(handleCommand(async (provider: string | undefined) => {
		await developerOAuthPromoteCommand({ provider });
	}));

// ============================================================================
// DATABASE COMMANDS
// ============================================================================

const dbCommand = program.command('db').description('Database tools');

dbCommand
	.command('check')
	.description('Check schema drift')
	.option('--table <table>', 'Check specific table')
	.option('--generate-migration', 'Generate fix SQL')
	.option('--local', 'Check local database')
	.option('--config <path>', 'Wrangler config path')
	.action(handleCommand(async (options: any) => {
		await dbCheckCommand({
			table: options.table,
			generateMigration: options.generateMigration,
			remote: !options.local,
			config: options.config,
		});
	}));

dbCommand
	.command('sync-workflows')
	.description('Sync workflows to D1')
	.option('--dry-run', 'Preview changes')
	.option('--local', 'Use local database')
	.option('--config <path>', 'Wrangler config path')
	.action(handleCommand(async (options: any) => {
		await dbSyncWorkflowsCommand({
			dryRun: options.dryRun,
			local: options.local,
			config: options.config,
		});
	}));

// ============================================================================
// BEADS COMMANDS - Issue Tracking Integration
// ============================================================================

const beadsCommand = program.command('beads').description('Issue tracking');

const beadsNotionCommand = beadsCommand.command('notion').description('Notion sync');

beadsNotionCommand
	.command('init')
	.description('Set up Notion database')
	.option('--parent-page-id <id>', 'Parent page ID')
	.option('--title <title>', 'Database title')
	.option('--token <token>', 'Notion token')
	.action(handleCommand(async (options: any) => {
		await beadsNotionInitCommand({
			parentPageId: options.parentPageId,
			title: options.title,
			token: options.token,
		});
	}));

beadsNotionCommand
	.command('sync')
	.description('Sync issues to Notion')
	.option('--dry-run', 'Preview changes')
	.option('--force', 'Force update all')
	.action(handleCommand(async (options: any) => {
		await beadsNotionSyncCommand({
			dryRun: options.dryRun,
			force: options.force,
		});
	}));

// ============================================================================
// AGENTIC COMMANDS - AI-Assisted Workflow Creation
// ============================================================================

program
	.command('create [prompt]')
	.description('Create workflow from description')
	.action(handleCommand(createCommand));

program
	.command('explain [file]')
	.description('Explain workflow in plain English')
	.action(handleCommand(explainCommand));

program
	.command('modify [file] [request]')
	.description('Modify workflow with natural language')
	.action(async (file: string, request: string) => {
		try {
			await modifyCommand(file, request);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

program
	.command('diagnose [file]')
	.description('Analyze workflow for issues')
	.option('--verbose', 'Show all issues')
	.option('--json', 'Output as JSON')
	.action(handleCommand(async (file: string, options: { verbose?: boolean; json?: boolean }) => {
		await diagnoseCommand(file, options);
	}));

// ============================================================================
// LEARN ALIAS - Quick access to learning resources
// ============================================================================

program
	.command('learn')
	.description('Open learning resources')
	.action(() => {
		Logger.header('WORKWAY Learn');
		Logger.blank();
		Logger.log('Documentation: https://learn.workway.co');
		Logger.blank();
		Logger.log('Install CLI:');
		Logger.log('  npm install -g @workway/learn');
		Logger.blank();
		Logger.log('MCP server:');
		Logger.log('  npx @workway/learn --server');
	});

// ============================================================================
// SLI COMMANDS - Service Level Indicators
// ============================================================================

registerSLICommand(program);

// ============================================================================
// RLM COMMANDS - Recursive Language Model Assessment
// ============================================================================

const rlmCommand = program.command('rlm').description('RLM quality assessment');

rlmCommand
	.command('assess')
	.description('Assess worker outputs')
	.option('--workers <ids>', 'Worker IDs (comma-separated)')
	.option('--json', 'Output as JSON')
	.option('--verbose', 'Show details')
	.option('--output-dir <dir>', 'Output directory')
	.action(handleCommand(async (options: any) => {
		await rlmAssessCommand({
			workers: options.workers,
			json: options.json,
			verbose: options.verbose,
			outputDir: options.outputDir,
		});
	}));

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Handle unknown commands
program.on('command:*', (operands) => {
	Logger.error(`Unknown command: ${operands[0]}`);
	Logger.log('');
	Logger.log('Run `workway --help` to see available commands');
	process.exit(1);
});

// ============================================================================
// RUN CLI
// ============================================================================

export async function run(): Promise<void> {
	try {
		await program.parseAsync(process.argv);
	} catch (error: unknown) {
		handleCommandError(error);
	}
}

// If run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
	run();
}
