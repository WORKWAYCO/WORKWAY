/**
 * WORKWAY CLI
 *
 * Main entry point for the CLI application
 */

import { Command } from 'commander';
import { loginCommand } from './commands/auth/login.js';
import { logoutCommand } from './commands/auth/logout.js';
import { whoamiCommand } from './commands/auth/whoami.js';
import { workflowInitCommand } from './commands/workflow/init.js';
import { workflowTestCommand } from './commands/workflow/test.js';
import { workflowPublishCommand } from './commands/workflow/publish.js';
import { oauthConnectCommand } from './commands/oauth/connect.js';
import { oauthListCommand } from './commands/oauth/list.js';
import { oauthDisconnectCommand } from './commands/oauth/disconnect.js';
import { Logger } from './utils/logger.js';

// Create CLI program
const program = new Command();

program
	.name('workway')
	.description('WORKWAY CLI - Build, test, and publish workflows and integrations')
	.version('0.2.0');

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
// WORKFLOW COMMANDS (Placeholders for now)
// ============================================================================

const workflowCommand = program.command('workflow').description('Workflow development commands');

workflowCommand
	.command('init [name]')
	.description('Create a new workflow project')
	.action(async (name: string) => {
		try {
			await workflowInitCommand(name);
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
	.command('dev')
	.description('Start development server with hot reload')
	.action(async () => {
		Logger.warn('Workflow commands coming soon!');
	});

workflowCommand
	.command('build')
	.description('Build workflow for production')
	.action(async () => {
		Logger.warn('Workflow commands coming soon!');
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

// ============================================================================
// OAUTH COMMANDS (Placeholders for now)
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
// DEVELOPER COMMANDS (Placeholders for now)
// ============================================================================

const developerCommand = program.command('developer').description('Developer profile management');

developerCommand
	.command('register')
	.description('Register as a workflow developer')
	.action(async () => {
		Logger.warn('Developer commands coming soon!');
	});

developerCommand
	.command('profile')
	.description('View/edit developer profile')
	.action(async () => {
		Logger.warn('Developer commands coming soon!');
	});

developerCommand
	.command('earnings')
	.description('View earnings and payouts')
	.action(async () => {
		Logger.warn('Developer commands coming soon!');
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
