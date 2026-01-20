#!/usr/bin/env npx tsx
/**
 * Test Runner Hook (Stop Hook)
 *
 * Runs tests for packages that were modified during the session.
 * Only runs on Stop to avoid slowing down iteration.
 *
 * Checks:
 *   - Identifies changed packages from git diff
 *   - Runs pnpm test --filter=<package> for each
 *   - Reports test failures
 *
 * Exit codes:
 *   0 = Tests pass (or no tests to run)
 *   2 = Tests failed (blocks stopping)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const LOG_FILE = path.join(
	process.env.CLAUDE_PROJECT_DIR || process.cwd(),
	'.claude/hooks/validators/test-runner.log'
);

interface HookInput {
	hook_event_name: string;
	stop_hook_active?: boolean;
}

interface TestResult {
	package: string;
	passed: boolean;
	output: string;
	duration: number;
}

function log(message: string): void {
	const timestamp = new Date().toISOString();
	fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function exec(command: string, timeout = 30000): { success: boolean; output: string } {
	try {
		const output = execSync(command, {
			cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
			encoding: 'utf-8',
			timeout,
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		return { success: true, output: output.trim() };
	} catch (error: any) {
		return {
			success: false,
			output: error.stdout?.trim() || error.stderr?.trim() || error.message,
		};
	}
}

function getChangedPackages(): string[] {
	// Get files changed since last commit (staged + unstaged + committed in session)
	const sources = [
		'git diff --name-only HEAD 2>/dev/null',
		'git diff --name-only --staged 2>/dev/null',
		'git diff --name-only HEAD~1 2>/dev/null',
	];

	const changedFiles = new Set<string>();

	for (const cmd of sources) {
		const result = exec(cmd, 5000);
		if (result.success && result.output) {
			for (const file of result.output.split('\n')) {
				changedFiles.add(file);
			}
		}
	}

	// Extract unique package names
	const packages = new Set<string>();
	for (const file of changedFiles) {
		const match = file.match(/^packages\/([^/]+)\//);
		if (match) {
			packages.add(match[1]);
		}
	}

	return Array.from(packages);
}

function hasTests(packageName: string): boolean {
	const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
	const packageJson = path.join(projectDir, 'packages', packageName, 'package.json');

	try {
		const content = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
		return !!(content.scripts?.test && content.scripts.test !== 'echo "No tests"');
	} catch {
		return false;
	}
}

function runTests(packageName: string): TestResult {
	const startTime = Date.now();
	log(`RUNNING: pnpm test --filter=@workwayco/${packageName}`);

	// Run with timeout of 60 seconds per package
	const result = exec(
		`pnpm test --filter=@workwayco/${packageName} 2>&1`,
		60000
	);

	const duration = Date.now() - startTime;

	return {
		package: packageName,
		passed: result.success,
		output: result.output,
		duration,
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

	// Prevent infinite loops
	if (hookInput.stop_hook_active) {
		log('INFO: Stop hook already active, skipping tests');
		process.exit(0);
	}

	log('CHECKING: Changed packages for testing');

	// Get changed packages
	const changedPackages = getChangedPackages();

	if (changedPackages.length === 0) {
		log('INFO: No packages changed, skipping tests');
		console.log('✓ No changed packages to test');
		process.exit(0);
	}

	log(`INFO: Changed packages: ${changedPackages.join(', ')}`);

	// Filter to packages with tests
	const testablePackages = changedPackages.filter(hasTests);

	if (testablePackages.length === 0) {
		log('INFO: No testable packages changed');
		console.log(`✓ Changed packages (${changedPackages.join(', ')}) have no tests`);
		process.exit(0);
	}

	console.log(`Running tests for: ${testablePackages.join(', ')}`);

	// Run tests for each package
	const results: TestResult[] = [];

	for (const pkg of testablePackages) {
		const result = runTests(pkg);
		results.push(result);

		const icon = result.passed ? '✓' : '✗';
		const time = (result.duration / 1000).toFixed(1);
		console.log(`${icon} ${pkg} (${time}s)`);

		log(
			`${result.passed ? 'PASSED' : 'FAILED'}: ${pkg} in ${result.duration}ms`
		);
	}

	// Check for failures
	const failures = results.filter((r) => !r.passed);

	if (failures.length === 0) {
		log('PASSED: All tests passed');
		console.log(`✓ All ${results.length} package(s) passed tests`);
		process.exit(0);
	}

	// Report failures
	log(`FAILED: ${failures.length}/${results.length} package(s) failed`);

	console.error(`\nTest failures in ${failures.length} package(s):`);
	for (const failure of failures) {
		console.error(`\n• ${failure.package}:`);
		// Show last 20 lines of output (usually contains the error)
		const lines = failure.output.split('\n');
		const relevantLines = lines.slice(-20).join('\n');
		console.error(relevantLines);
	}

	console.error('\nFix test failures before completing work.');
	process.exit(2);
}

main().catch((error) => {
	log(`ERROR: ${error.message}`);
	process.exit(1);
});
