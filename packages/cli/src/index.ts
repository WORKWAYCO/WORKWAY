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
import { oauthConnectCommand } from './commands/oauth/connect.js';
import { oauthListCommand } from './commands/oauth/list.js';
import { oauthDisconnectCommand } from './commands/oauth/disconnect.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { developerRegisterCommand } from './commands/developer/register.js';
import { developerProfileCommand } from './commands/developer/profile.js';
import { developerEarningsCommand } from './commands/developer/earnings.js';
import { developerStripeCommand } from './commands/developer/stripe.js';
import { aiModelsCommand } from './commands/ai/models.js';
import { aiTestCommand } from './commands/ai/test.js';
import { aiEstimateCommand } from './commands/ai/estimate.js';
import { Logger } from './utils/logger.js';

// Create CLI program
const program = new Command();

program
	.name('workway')
	.description('WORKWAY CLI - Build, test, and publish workflows and integrations')
	.version('0.3.0');

// ============================================================================
// AUTHENTICATION COMMANDS
// ============================================================================

program
	.command('login')
	.description('Authenticate with WORKWAY platform')
	.action(async () => {
		try {
			await loginCommand();
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

program
	.command('logout')
	.description('Clear local authentication')
	.action(async () => {
		try {
			await logoutCommand();
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

program
	.command('whoami')
	.description('Display current authenticated user')
	.action(async () => {
		try {
			await whoamiCommand();
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

// ============================================================================
// WORKFLOW COMMANDS
// ============================================================================

const workflowCommand = program.command('workflow').description('Workflow development commands');

workflowCommand
	.command('init [name]')
	.description('Create a new workflow project')
	.option('--ai', 'Create AI-powered workflow using Cloudflare Workers AI')
	.action(async (name: string, options: { ai?: boolean }) => {
		try {
			await workflowInitCommand(name, options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

workflowCommand
	.command('test')
	.description('Test workflow execution')
	.option('--mock', 'Use mocked integrations')
	.option('--live', 'Use live OAuth connections')
	.option('--data <file>', 'Path to test data file')
	.action(async (options: any) => {
		try {
			await workflowTestCommand(options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

workflowCommand
	.command('run')
	.description('Execute workflow locally')
	.option('--input <file>', 'Path to input data file')
	.option('--env <env>', 'Environment (development/production)')
	.option('--verbose', 'Show verbose output')
	.option('--timeout <ms>', 'Execution timeout in milliseconds')
	.action(async (options: any) => {
		try {
			await workflowRunCommand(options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

workflowCommand
	.command('dev')
	.description('Start development server with hot reload')
	.option('--port <port>', 'Port number')
	.option('--mock', 'Use mock mode')
	.option('--no-mock', 'Use live OAuth connections')
	.action(async (options: any) => {
		try {
			await workflowDevCommand(options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

workflowCommand
	.command('build')
	.description('Build workflow for production')
	.option('--out-dir <dir>', 'Output directory')
	.option('--minify', 'Minify output')
	.option('--no-minify', 'Disable minification')
	.option('--sourcemap', 'Generate sourcemaps')
	.action(async (options: any) => {
		try {
			await workflowBuildCommand(options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

workflowCommand
	.command('publish')
	.description('Publish workflow to marketplace')
	.option('--draft', 'Publish as draft (not public)')
	.action(async (options: any) => {
		try {
			await workflowPublishCommand(options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

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

// ============================================================================
// AI COMMANDS - Cloudflare Workers AI
// ============================================================================

const aiCommand = program.command('ai').description('Cloudflare Workers AI tools');

aiCommand
	.command('models')
	.description('List available AI models with costs')
	.option('--type <type>', 'Filter by type (text, embeddings, image, audio, translation, classification)')
	.option('--json', 'Output as JSON')
	.action(async (options: any) => {
		try {
			await aiModelsCommand(options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

aiCommand
	.command('test [prompt]')
	.description('Test AI model with a prompt')
	.option('--model <model>', 'Model to use (e.g., LLAMA_3_8B)')
	.option('--mock', 'Use mock response (no API call)')
	.option('--json', 'Output as JSON')
	.action(async (prompt: string, options: any) => {
		try {
			await aiTestCommand(prompt, options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

aiCommand
	.command('estimate')
	.description('Estimate AI workflow costs')
	.option('--executions <n>', 'Monthly executions', parseInt)
	.option('--tokens <n>', 'Tokens per execution', parseInt)
	.option('--model <model>', 'Model to estimate (e.g., LLAMA_3_8B)')
	.action(async (options: any) => {
		try {
			await aiEstimateCommand({
				executions: options.executions,
				tokensPerExecution: options.tokens,
				model: options.model,
			});
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

// ============================================================================
// OAUTH COMMANDS
// ============================================================================

const oauthCommand = program.command('oauth').description('OAuth connection management');

oauthCommand
	.command('connect [provider]')
	.description('Connect an OAuth account for testing')
	.action(async (provider: string) => {
		try {
			await oauthConnectCommand(provider);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

oauthCommand
	.command('list')
	.description('List connected OAuth accounts')
	.action(async () => {
		try {
			await oauthListCommand();
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

oauthCommand
	.command('disconnect [provider]')
	.description('Disconnect an OAuth account')
	.action(async (provider: string) => {
		try {
			await oauthDisconnectCommand(provider);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

// ============================================================================
// STATUS & LOGS COMMANDS
// ============================================================================

program
	.command('status')
	.description('Show developer dashboard and status')
	.action(async () => {
		try {
			await statusCommand();
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

program
	.command('logs')
	.description('View production workflow execution logs')
	.option('--workflow <id>', 'Filter by workflow ID')
	.option('--limit <n>', 'Number of logs to show', '20')
	.option('--follow', 'Follow logs in real-time')
	.option('--status <status>', 'Filter by status (completed/failed/running)')
	.action(async (options: any) => {
		try {
			await logsCommand(options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

// ============================================================================
// DEVELOPER COMMANDS
// ============================================================================

const developerCommand = program.command('developer').description('Developer profile management');

developerCommand
	.command('register')
	.description('Register as a workflow developer')
	.action(async () => {
		try {
			await developerRegisterCommand();
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

developerCommand
	.command('profile')
	.description('View/edit developer profile')
	.option('--edit', 'Edit profile interactively')
	.action(async (options: any) => {
		try {
			await developerProfileCommand(options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

developerCommand
	.command('earnings')
	.description('View earnings and payouts')
	.option('--setup', 'Set up Stripe Connect for payouts')
	.option('--period <period>', 'Time period (week/month/year)')
	.action(async (options: any) => {
		try {
			await developerEarningsCommand(options);
		} catch (error: any) {
			Logger.error(error.message);
			process.exit(1);
		}
	});

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
	} catch (error: any) {
		Logger.error(error.message);
		if (error.stack && process.env.DEBUG) {
			Logger.debug(error.stack);
		}
		process.exit(1);
	}
}

// If run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
	run();
}
