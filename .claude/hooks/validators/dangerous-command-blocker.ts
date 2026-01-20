#!/usr/bin/env npx tsx
/**
 * Dangerous Command Blocker Hook (PreToolUse)
 *
 * Prevents execution of dangerous shell commands.
 * Runs before Bash tool to block destructive operations.
 *
 * Blocks:
 *   - rm -rf with dangerous paths
 *   - git reset --hard
 *   - git push --force to protected branches
 *   - DROP TABLE, DELETE without WHERE
 *   - chmod/chown on sensitive paths
 *
 * Exit codes:
 *   0 = Command is safe
 *   2 = Command is dangerous (blocks execution)
 */

import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(
	process.env.CLAUDE_PROJECT_DIR || process.cwd(),
	'.claude/hooks/validators/dangerous-command-blocker.log'
);

interface HookInput {
	tool_name: string;
	tool_input: {
		command?: string;
	};
}

interface BlockedCommand {
	pattern: RegExp;
	reason: string;
	suggestion: string;
}

const BLOCKED_COMMANDS: BlockedCommand[] = [
	// Destructive file operations
	{
		pattern: /rm\s+(-rf?|--recursive)\s+[\/~]/,
		reason: 'Recursive delete on root or home directory',
		suggestion: 'Specify a more specific path, or use a safer deletion method',
	},
	{
		pattern: /rm\s+(-rf?|--recursive)\s+\*/,
		reason: 'Recursive delete with wildcard',
		suggestion: 'List files first with `ls`, then delete specific items',
	},
	{
		pattern: /rm\s+(-rf?|--recursive)\s+\.\.\//,
		reason: 'Recursive delete on parent directory',
		suggestion: 'Navigate to the directory first and delete from there',
	},
	{
		pattern: /rm\s+(-rf?|--recursive)\s+\.$/,
		reason: 'Recursive delete on current directory',
		suggestion: 'Use `rm -rf ./*` to preserve the directory itself',
	},

	// Dangerous git operations
	{
		pattern: /git\s+reset\s+--hard/,
		reason: 'Hard reset discards all uncommitted changes',
		suggestion: 'Use `git stash` to save changes, or `git reset --soft`',
	},
	{
		pattern: /git\s+push\s+(-f|--force)\s+(origin\s+)?(main|master)/,
		reason: 'Force push to main/master can overwrite shared history',
		suggestion: 'Use `git push --force-with-lease` or create a PR instead',
	},
	{
		pattern: /git\s+push\s+--force(?!\-with\-lease)/,
		reason: 'Force push without lease can overwrite others\' work',
		suggestion: 'Use `git push --force-with-lease` for safer force pushes',
	},
	{
		pattern: /git\s+clean\s+-fd/,
		reason: 'Git clean removes untracked files permanently',
		suggestion: 'Use `git clean -fdn` (dry run) first to see what will be deleted',
	},

	// Database dangers
	{
		pattern: /DROP\s+(TABLE|DATABASE|SCHEMA)/i,
		reason: 'DROP statements permanently delete data',
		suggestion: 'Use migrations or backup before dropping',
	},
	{
		pattern: /DELETE\s+FROM\s+\w+\s*(?!WHERE)/i,
		reason: 'DELETE without WHERE clause deletes all rows',
		suggestion: 'Add a WHERE clause to target specific rows',
	},
	{
		pattern: /TRUNCATE\s+TABLE/i,
		reason: 'TRUNCATE removes all rows without logging',
		suggestion: 'Use DELETE with WHERE for selective removal',
	},

	// Permission dangers
	{
		pattern: /chmod\s+(-R\s+)?777/,
		reason: '777 permissions make files world-writable',
		suggestion: 'Use more restrictive permissions like 755 or 644',
	},
	{
		pattern: /chown\s+-R\s+(root|nobody)/,
		reason: 'Recursive chown to root/nobody can break applications',
		suggestion: 'Specify the exact files/directories to change ownership',
	},

	// Environment dangers
	{
		pattern: /export\s+(PATH|HOME|USER)=/,
		reason: 'Overwriting critical environment variables',
		suggestion: 'Prepend/append to PATH instead: export PATH="$PATH:newpath"',
	},
	{
		pattern: />\s*\/etc\//,
		reason: 'Redirecting output to system configuration files',
		suggestion: 'Use sudo and a text editor for system file changes',
	},

	// Process dangers
	{
		pattern: /kill\s+-9\s+1\b/,
		reason: 'Killing PID 1 (init/systemd) crashes the system',
		suggestion: 'Verify the correct PID before killing',
	},
	{
		pattern: /pkill\s+-9\s+/,
		reason: 'pkill -9 force-kills matching processes without cleanup',
		suggestion: 'Use pkill without -9 first to allow graceful shutdown',
	},

	// Credential dangers
	{
		pattern: /curl\s+.*\|\s*(bash|sh)/,
		reason: 'Piping curl to shell executes remote code',
		suggestion: 'Download the script first, review it, then execute',
	},
	{
		pattern: /echo\s+.*password.*\|/i,
		reason: 'Echoing passwords can leak to shell history',
		suggestion: 'Use environment variables or secure input methods',
	},
];

function log(message: string): void {
	const timestamp = new Date().toISOString();
	fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function checkCommand(command: string): BlockedCommand | null {
	for (const blocked of BLOCKED_COMMANDS) {
		if (blocked.pattern.test(command)) {
			return blocked;
		}
	}
	return null;
}

async function main(): Promise<void> {
	let input = '';
	for await (const chunk of process.stdin) {
		input += chunk;
	}

	let hookInput: HookInput;
	try {
		hookInput = JSON.parse(input);
	} catch {
		log('ERROR: Invalid JSON input');
		process.exit(1);
	}

	// Only check Bash commands
	if (hookInput.tool_name !== 'Bash') {
		process.exit(0);
	}

	const command = hookInput.tool_input?.command;

	if (!command) {
		process.exit(0);
	}

	log(`CHECKING: ${command.slice(0, 100)}${command.length > 100 ? '...' : ''}`);

	const blocked = checkCommand(command);

	if (blocked) {
		log(`BLOCKED: ${blocked.reason}`);
		console.error(`⛔ Blocked dangerous command: ${blocked.reason}`);
		console.error(`   Command: ${command.slice(0, 80)}${command.length > 80 ? '...' : ''}`);
		console.error(`   Suggestion: ${blocked.suggestion}`);
		process.exit(2);
	}

	log('ALLOWED');
	process.exit(0);
}

main().catch((error) => {
	log(`ERROR: ${error.message}`);
	process.exit(1);
});
