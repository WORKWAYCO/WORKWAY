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
import { aiModelsCommand } from './commands/ai/models.js';
import { aiTestCommand } from './commands/ai/test.js';
import { aiEstimateCommand } from './commands/ai/estimate.js';
import { createCommand } from './commands/agentic/create.js';
import { explainCommand } from './commands/agentic/explain.js';
import { modifyCommand } from './commands/agentic/modify.js';
import { marketplaceNeedsCommand, marketplaceSearchCommand, marketplaceBrowseCommand, marketplaceInfoCommand } from './commands/marketplace/index.js';
import { dbCheckCommand } from './commands/db/check.js';
import { Logger } from './utils/logger.js';
import { handleCommand, handleCommandError } from './utils/command-handler.js';

// Create CLI program
const program = new Command();

program
	.name('workway')
	.description('WORKWAY CLI - Build, test, and publish workflows and integrations')
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
	.option('--ai', 'Create AI-powered workflow using Cloudflare Workers AI')
	.action(handleCommand(workflowInitCommand));

workflowCommand
	.command('test')
	.description('Test workflow execution')
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
	.description('Start development server with hot reload')
	.option('--port <port>', 'Port number')
	.option('--mock', 'Use mock mode')
	.option('--no-mock', 'Use live OAuth connections')
	.action(handleCommand(workflowDevCommand));

workflowCommand
	.command('build')
	.description('Build workflow for production')
	.option('--out-dir <dir>', 'Output directory')
	.option('--minify', 'Minify output')
	.option('--no-minify', 'Disable minification')
	.option('--sourcemap', 'Generate sourcemaps')
	.action(handleCommand(workflowBuildCommand));

workflowCommand
	.command('publish')
	.description('Publish workflow to marketplace')
	.option('--draft', 'Publish as draft (not public)')
	.action(handleCommand(workflowPublishCommand));

workflowCommand
	.command('validate [file]')
	.description('Validate workflow schema without building')
	.option('--strict', 'Treat warnings as errors')
	.option('--json', 'Output as JSON (for CI/CD)')
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
	.description('Fork a workflow from the marketplace')
	.action(handleCommand(workflowForkCommand));

workflowCommand
	.command('lineage [workflow]')
	.description('View fork lineage and ancestry')
	.action(handleCommand(workflowLineageCommand));

workflowCommand
	.command('delete [workflow-id]')
	.description('Permanently delete an inactive workflow')
	.option('--force', 'Skip confirmation prompt')
	.option('--path <path>', 'Path to workflow file')
	.option('--keep-data', 'Keep stored data (only remove workflow)')
	.action(handleCommand(async (workflowId: string, options: any) => {
		await workflowDeleteCommand(workflowId, options);
	}));

// ============================================================================
// MARKETPLACE COMMANDS
// ============================================================================

const marketplaceCommand = program.command('marketplace').description('Discover and explore workflows');

// Primary discovery command (Pathway Model)
marketplaceCommand
	.command('needs')
	.description('Discover workflows based on your needs (recommended)')
	.option('--from <integration>', 'Source integration (e.g., zoom, stripe)')
	.option('--to <integration>', 'Target integration (e.g., notion, slack)')
	.option('--after <outcome>', 'Outcome frame (e.g., meetings, calls)')
	.option('--show-outcomes', 'Show available outcome frames')
	.action(handleCommand(async (options: any) => {
		await marketplaceNeedsCommand({
			from: options.from,
			to: options.to,
			after: options.after,
			showOutcomes: options.showOutcomes,
		});
	}));

// Legacy commands (consider using 'needs' instead)
marketplaceCommand
	.command('search [query]')
	.description('Search workflows in the marketplace (legacy)')
	.option('--category <category>', 'Filter by category')
	.option('--developer <developer>', 'Filter by developer')
	.option('--sort <sort>', 'Sort by: relevance, popular, recent, rating')
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
	.description('Browse workflows by category (legacy - use "needs" instead)')
	.option('--category <category>', 'Browse specific category')
	.option('--featured', 'Show featured workflows')
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
	.description('View detailed workflow information')
	.action(handleCommand(marketplaceInfoCommand));

// ============================================================================
// TOP-LEVEL DISCOVERY (Pathway Model Shortcut)
// ============================================================================

// Allow `workway needs` as shortcut for `workway marketplace needs`
program
	.command('needs')
	.description('Discover workflows based on your needs')
	.option('--from <integration>', 'Source integration (e.g., zoom, stripe)')
	.option('--to <integration>', 'Target integration (e.g., notion, slack)')
	.option('--after <outcome>', 'Outcome frame (e.g., meetings, calls)')
	.option('--show-outcomes', 'Show available outcome frames')
	.action(handleCommand(async (options: any) => {
		await marketplaceNeedsCommand({
			from: options.from,
			to: options.to,
			after: options.after,
			showOutcomes: options.showOutcomes,
		});
	}));

// ============================================================================
// AI COMMANDS - Cloudflare Workers AI
// ============================================================================

const aiCommand = program.command('ai').description('Cloudflare Workers AI tools');

aiCommand
	.command('models')
	.description('List available AI models with costs')
	.option('--type <type>', 'Filter by type (text, embeddings, image, audio, translation, classification)')
	.option('--json', 'Output as JSON')
	.action(handleCommand(aiModelsCommand));

aiCommand
	.command('test [prompt]')
	.description('Test AI model with a prompt')
	.option('--model <model>', 'Model to use (e.g., LLAMA_3_8B)')
	.option('--mock', 'Use mock response (no API call)')
	.option('--json', 'Output as JSON')
	.action(handleCommand(aiTestCommand));

aiCommand
	.command('estimate')
	.description('Estimate AI workflow costs')
	.option('--executions <n>', 'Monthly executions', parseInt)
	.option('--tokens <n>', 'Tokens per execution', parseInt)
	.option('--model <model>', 'Model to estimate (e.g., LLAMA_3_8B)')
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

const oauthCommand = program.command('oauth').description('OAuth connection management');

oauthCommand
	.command('connect [provider]')
	.description('Connect an OAuth account for testing')
	.action(handleCommand(oauthConnectCommand));

oauthCommand
	.command('list')
	.description('List connected OAuth accounts')
	.action(handleCommand(oauthListCommand));

oauthCommand
	.command('disconnect [provider]')
	.description('Disconnect an OAuth account')
	.action(handleCommand(oauthDisconnectCommand));

// ============================================================================
// STATUS & LOGS COMMANDS
// ============================================================================

program
	.command('status')
	.description('Show developer dashboard and status')
	.action(handleCommand(statusCommand));

program
	.command('logs')
	.description('View production workflow execution logs')
	.option('--workflow <id>', 'Filter by workflow ID')
	.option('--limit <n>', 'Number of logs to show', '20')
	.option('--follow', 'Follow logs in real-time')
	.option('--status <status>', 'Filter by status (completed/failed/running)')
	.action(handleCommand(logsCommand));

// ============================================================================
// DEVELOPER COMMANDS
// ============================================================================

const developerCommand = program.command('developer').description('System Architect profile and marketplace access');

// Waitlist flow commands
developerCommand
	.command('init')
	.description('Create your System Architect profile')
	.action(handleCommand(developerInitCommand));

developerCommand
	.command('submit')
	.description('Submit profile for marketplace review')
	.action(handleCommand(developerSubmitCommand));

developerCommand
	.command('status')
	.description('Check application status')
	.action(handleCommand(developerStatusCommand));

// Legacy/approved developer commands
developerCommand
	.command('register')
	.description('Register as a workflow developer (legacy)')
	.action(handleCommand(developerRegisterCommand));

developerCommand
	.command('profile')
	.description('View/edit developer profile (requires approval)')
	.option('--edit', 'Edit profile interactively')
	.action(handleCommand(developerProfileCommand));

developerCommand
	.command('earnings')
	.description('View earnings and payouts')
	.option('--setup', 'Set up Stripe Connect for payouts')
	.option('--period <period>', 'Time period (week/month/year)')
	.action(handleCommand(developerEarningsCommand));

developerCommand
	.command('stripe [action]')
	.description('Manage Stripe Connect for receiving payments (setup/status/refresh)')
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

// ============================================================================
// DATABASE COMMANDS
// ============================================================================

const dbCommand = program.command('db').description('Database management and debugging tools');

dbCommand
	.command('check')
	.description('Check D1 schema against Drizzle definitions')
	.option('--table <table>', 'Check specific table only')
	.option('--generate-migration', 'Generate SQL to fix drift')
	.option('--local', 'Check local database instead of remote')
	.option('--config <path>', 'Path to wrangler config file')
	.action(handleCommand(async (options: any) => {
		await dbCheckCommand({
			table: options.table,
			generateMigration: options.generateMigration,
			remote: !options.local,
			config: options.config,
		});
	}));

// ============================================================================
// AGENTIC COMMANDS - AI-Assisted Workflow Creation
// ============================================================================

program
	.command('create [prompt]')
	.description('Create a workflow from natural language description')
	.action(handleCommand(createCommand));

program
	.command('explain [file]')
	.description('Explain what a workflow does in plain English')
	.action(handleCommand(explainCommand));

program
	.command('modify [file] [request]')
	.description('Modify a workflow using natural language')
	.action(async (file: string, request: string) => {
		try {
			await modifyCommand(file, request);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

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
