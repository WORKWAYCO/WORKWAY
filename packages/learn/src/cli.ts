#!/usr/bin/env node

/**
 * WORKWAY Learn CLI
 *
 * Commands:
 *   init           Initialize learning environment
 *   init --full    Full scaffolding with CLAUDE.md
 *   status         Show learning progress
 *   clear          Clear cache and credentials
 *   --server       Start MCP server (for Claude Code)
 */

import { Command } from 'commander';
import { initCommand } from './cli/commands/init.js';
import { statusCommand } from './cli/commands/status.js';
import { clearCommand } from './cli/commands/clear.js';

// Check for --server flag before commander parsing
if (process.argv.includes('--server')) {
	import('./server.js').then(({ startServer }) => {
		startServer().catch((error) => {
			console.error('Fatal error:', error);
			process.exit(1);
		});
	});
} else {
	runCLI();
}

function runCLI() {
const program = new Command();

program
	.name('workway-learn')
	.description('WORKWAY learning CLI and MCP server')
	.version('1.0.0');

// Init command
program
	.command('init')
	.description('Initialize learning environment')
	.option('--full', 'Create full project scaffolding')
	.action(async (options) => {
		await initCommand(options);
	});

// Status command
program
	.command('status')
	.description('Show learning progress')
	.action(async () => {
		await statusCommand();
	});

// Clear command
program
	.command('clear')
	.description('Clear cached data')
	.option('--cache', 'Clear lesson cache only')
	.option('--ethos', 'Reset ethos to defaults')
	.option('--all', 'Clear all data including credentials')
	.action(async (options) => {
		await clearCommand(options);
	});

// Parse arguments
program.parse();
}
