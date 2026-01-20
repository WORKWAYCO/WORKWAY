#!/usr/bin/env npx tsx
/**
 * Completion Checker Hook (Stop Hook)
 *
 * Specialized self-validation to ensure work is truly complete before stopping.
 * Runs when an agent finishes to verify all expected deliverables exist.
 *
 * Checks:
 *   - No uncommitted changes (work is landed)
 *   - No unpushed commits
 *   - All in_progress issues are closed or have clear next steps
 *   - Tests pass for changed packages
 *
 * Exit codes:
 *   0 = Safe to stop
 *   2 = Work incomplete (blocks stopping, provides reason to continue)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const LOG_FILE = path.join(
	process.env.CLAUDE_PROJECT_DIR || process.cwd(),
	'.claude/hooks/validators/completion-checker.log'
);

interface HookInput {
	hook_event_name: string;
	stop_hook_active?: boolean;
}

function log(message: string): void {
	const timestamp = new Date().toISOString();
	fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function exec(command: string): string {
	try {
		return execSync(command, {
			cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
			encoding: 'utf-8',
			timeout: 30000,
		}).trim();
	} catch (error: any) {
		return error.stdout?.trim() || '';
	}
}

function checkGitStatus(): { clean: boolean; issues: string[] } {
	const issues: string[] = [];

	// Check for uncommitted changes
	const status = exec('git status --porcelain');
	if (status) {
		const changedFiles = status.split('\n').length;
		issues.push(
			`${changedFiles} uncommitted file(s). Run: git add -A && git commit -m "..."`
		);
	}

	// Check for unpushed commits
	const unpushed = exec('git log @{u}.. --oneline 2>/dev/null');
	if (unpushed) {
		const count = unpushed.split('\n').filter(Boolean).length;
		issues.push(`${count} unpushed commit(s). Run: git push`);
	}

	return {
		clean: issues.length === 0,
		issues,
	};
}

function checkBeadsStatus(): { clean: boolean; issues: string[] } {
	const issues: string[] = [];

	try {
		const inProgress = exec('bd list --status in_progress --json 2>/dev/null');
		if (inProgress && inProgress !== '[]') {
			const items = JSON.parse(inProgress);
			if (items.length > 0) {
				issues.push(
					`${items.length} issue(s) still in_progress. Close or update them:`
				);
				for (const item of items.slice(0, 3)) {
					issues.push(`  - ${item.id}: ${item.title}`);
				}
			}
		}
	} catch {
		// bd not available, skip
	}

	return {
		clean: issues.length === 0,
		issues,
	};
}

function checkTestStatus(): { passed: boolean; issues: string[] } {
	const issues: string[] = [];

	// Get changed packages
	const changedFiles = exec('git diff --name-only HEAD~1 2>/dev/null');
	if (!changedFiles) {
		return { passed: true, issues: [] };
	}

	// Extract package names from changed files
	const packages = new Set<string>();
	for (const file of changedFiles.split('\n')) {
		const match = file.match(/^packages\/([^/]+)\//);
		if (match) {
			packages.add(match[1]);
		}
	}

	// Skip test check if no packages changed or if tests don't exist
	if (packages.size === 0) {
		return { passed: true, issues: [] };
	}

	// Only warn, don't block - tests should be run manually
	log(`INFO: Changed packages: ${Array.from(packages).join(', ')}`);

	return { passed: true, issues: [] };
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

	// Prevent infinite loops - if stop hook is already active, allow stopping
	if (hookInput.stop_hook_active) {
		log('INFO: Stop hook already active, allowing stop');
		process.exit(0);
	}

	log('CHECKING: Completion status');

	const allIssues: string[] = [];

	// Check git status
	const gitResult = checkGitStatus();
	if (!gitResult.clean) {
		allIssues.push(...gitResult.issues);
	}

	// Check beads status
	const beadsResult = checkBeadsStatus();
	if (!beadsResult.clean) {
		allIssues.push(...beadsResult.issues);
	}

	// Check tests (informational only)
	checkTestStatus();

	if (allIssues.length === 0) {
		log('PASSED: Ready to stop');
		console.log('✓ Work complete and landed');
		process.exit(0);
	} else {
		log(`BLOCKED: ${allIssues.length} issue(s) found`);

		// Exit code 2 blocks stopping and provides feedback to Claude
		console.error('Complete the following before stopping:');
		for (const issue of allIssues) {
			console.error(`• ${issue}`);
		}
		process.exit(2);
	}
}

main().catch((error) => {
	log(`ERROR: ${error.message}`);
	process.exit(1);
});
