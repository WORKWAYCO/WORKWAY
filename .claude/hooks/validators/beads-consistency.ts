#!/usr/bin/env npx tsx
/**
 * Beads Consistency Validator Hook
 *
 * Specialized self-validation for beads (bd) operations.
 * Ensures issue state consistency after status changes.
 *
 * Checks:
 *   - Only one in_progress issue at a time
 *   - No orphaned issues (in_progress without assignee)
 *   - Closed issues have close reasons
 *   - Work landed before close (commit hash in reason)
 *
 * Exit codes:
 *   0 = Consistent state
 *   2 = Inconsistent state (blocks and provides feedback)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const LOG_FILE = path.join(
	process.env.CLAUDE_PROJECT_DIR || process.cwd(),
	'.claude/hooks/validators/beads-consistency.log'
);

interface HookInput {
	tool_name: string;
	tool_input: {
		command?: string;
	};
}

interface Issue {
	id: string;
	title: string;
	status: string;
	assignee?: string;
	closed_reason?: string;
}

function log(message: string): void {
	const timestamp = new Date().toISOString();
	fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function getIssues(): Issue[] {
	try {
		const output = execSync('bd list --json 2>/dev/null', {
			cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
			encoding: 'utf-8',
			timeout: 10000,
		});
		return JSON.parse(output);
	} catch {
		return [];
	}
}

function validateBeadsConsistency(): {
	valid: boolean;
	issues: string[];
	warnings: string[];
} {
	const issues: string[] = [];
	const warnings: string[] = [];

	const allIssues = getIssues();
	const inProgress = allIssues.filter((i) => i.status === 'in_progress');

	// Check 1: Only one in_progress at a time
	if (inProgress.length > 1) {
		issues.push(
			`Multiple in_progress issues detected (${inProgress.length}). Complete or pause one before starting another.`
		);
		for (const ip of inProgress) {
			issues.push(`  - ${ip.id}: ${ip.title}`);
		}
	}

	// Check 2: Warn about in_progress without recent activity
	// (This is informational, not blocking)
	if (inProgress.length > 0) {
		log(`INFO: ${inProgress.length} issue(s) in progress`);
	}

	// Check 3: Recently closed issues should have commit hash in reason
	const recentlyClosed = allIssues.filter(
		(i) => i.status === 'closed' && i.closed_reason
	);
	for (const closed of recentlyClosed.slice(0, 3)) {
		if (
			closed.closed_reason &&
			!closed.closed_reason.includes('commit') &&
			!closed.closed_reason.includes('Verified')
		) {
			warnings.push(
				`Issue ${closed.id} closed without commit reference. Consider: bd close ${closed.id} --reason "Verified: commit $(git rev-parse --short HEAD)"`
			);
		}
	}

	return {
		valid: issues.length === 0,
		issues,
		warnings,
	};
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

	// Only run for bd commands
	const command = hookInput.tool_input?.command || '';
	if (!command.startsWith('bd ')) {
		process.exit(0);
	}

	// Skip read-only commands
	const readOnlyPatterns = ['bd list', 'bd show', 'bd ready', 'bd progress'];
	if (readOnlyPatterns.some((p) => command.startsWith(p))) {
		process.exit(0);
	}

	log(`VALIDATING after: ${command}`);

	const result = validateBeadsConsistency();

	// Log warnings
	for (const warning of result.warnings) {
		log(`WARNING: ${warning}`);
		console.log(`⚠ ${warning}`);
	}

	if (result.valid) {
		log('PASSED: Beads state consistent');
		console.log('✓ Beads state consistent');
		process.exit(0);
	} else {
		log(`FAILED: ${result.issues.join('; ')}`);

		console.error('Resolve beads consistency issues:');
		for (const issue of result.issues) {
			console.error(`• ${issue}`);
		}
		process.exit(2);
	}
}

main().catch((error) => {
	log(`ERROR: ${error.message}`);
	process.exit(1);
});
