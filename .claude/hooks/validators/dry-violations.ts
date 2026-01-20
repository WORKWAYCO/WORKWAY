#!/usr/bin/env npx tsx
/**
 * DRY Violations Validator Hook
 *
 * Lightweight static analysis to detect obvious DRY violations.
 * Runs after Edit/Write to catch duplication early.
 *
 * Checks:
 *   - Similar function signatures in same package
 *   - Duplicate code blocks (>10 lines identical)
 *   - Repeated patterns (same structure 3+ times)
 *
 * Exit codes:
 *   0 = No critical violations
 *   2 = Critical DRY violation (blocks and provides feedback)
 *
 * Note: This is a fast, lightweight check. For deep analysis,
 * use: node scripts/analyze-dry-violations.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const LOG_FILE = path.join(
	process.env.CLAUDE_PROJECT_DIR || process.cwd(),
	'.claude/hooks/validators/dry-violations.log'
);

interface HookInput {
	tool_name: string;
	tool_input: {
		file_path?: string;
	};
	tool_response?: {
		filePath?: string;
	};
}

interface DryViolation {
	type: 'duplicate_function' | 'duplicate_block' | 'repeated_pattern';
	severity: 'critical' | 'warning';
	description: string;
	files: string[];
	suggestion: string;
}

function log(message: string): void {
	const timestamp = new Date().toISOString();
	fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function getPackageDir(filePath: string): string | null {
	const match = filePath.match(/(packages\/[^/]+)/);
	return match ? match[1] : null;
}

function extractFunctionSignatures(content: string): string[] {
	const signatures: string[] = [];

	// Match function declarations and async functions
	const patterns = [
		/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g,
		/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?:=>|:)/g,
		/(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
	];

	for (const pattern of patterns) {
		let match;
		while ((match = pattern.exec(content)) !== null) {
			const funcName = match[1];
			// Skip common names that are expected to repeat
			if (!['constructor', 'main', 'init', 'setup', 'run'].includes(funcName)) {
				signatures.push(funcName);
			}
		}
	}

	return signatures;
}

function findSimilarFiles(packageDir: string, excludeFile: string): string[] {
	const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
	const fullPackageDir = path.join(projectDir, packageDir);

	try {
		const output = execSync(
			`find "${fullPackageDir}" -name "*.ts" -not -name "*.test.ts" -not -name "*.d.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null`,
			{ encoding: 'utf-8', timeout: 5000 }
		);
		return output
			.split('\n')
			.filter(Boolean)
			.filter((f) => f !== excludeFile);
	} catch {
		return [];
	}
}

function checkDuplicateFunctions(
	filePath: string,
	content: string
): DryViolation[] {
	const violations: DryViolation[] = [];
	const packageDir = getPackageDir(filePath);

	if (!packageDir) return violations;

	const currentSignatures = extractFunctionSignatures(content);
	if (currentSignatures.length === 0) return violations;

	const similarFiles = findSimilarFiles(packageDir, filePath);
	const duplicates: Map<string, string[]> = new Map();

	for (const otherFile of similarFiles.slice(0, 10)) {
		// Limit to 10 files for speed
		try {
			const otherContent = fs.readFileSync(otherFile, 'utf-8');
			const otherSignatures = extractFunctionSignatures(otherContent);

			for (const sig of currentSignatures) {
				if (otherSignatures.includes(sig)) {
					if (!duplicates.has(sig)) {
						duplicates.set(sig, [filePath]);
					}
					duplicates.get(sig)!.push(otherFile);
				}
			}
		} catch {
			continue;
		}
	}

	// Report functions that appear in 3+ files (critical)
	for (const [funcName, files] of duplicates.entries()) {
		if (files.length >= 3) {
			violations.push({
				type: 'duplicate_function',
				severity: 'critical',
				description: `Function "${funcName}" appears in ${files.length} files`,
				files: files.map((f) => path.relative(process.env.CLAUDE_PROJECT_DIR || '', f)),
				suggestion: `Extract "${funcName}" to a shared utility in ${packageDir}/src/utils/`,
			});
		}
	}

	return violations;
}

function checkDuplicateBlocks(content: string, filePath: string): DryViolation[] {
	const violations: DryViolation[] = [];
	const lines = content.split('\n');

	// Look for repeated blocks of 10+ lines
	const blockSize = 10;
	const blocks: Map<string, number[]> = new Map();

	for (let i = 0; i <= lines.length - blockSize; i++) {
		const block = lines
			.slice(i, i + blockSize)
			.map((l) => l.trim())
			.filter((l) => l && !l.startsWith('//') && !l.startsWith('*'))
			.join('\n');

		if (block.length < 100) continue; // Skip small blocks

		if (blocks.has(block)) {
			blocks.get(block)!.push(i + 1);
		} else {
			blocks.set(block, [i + 1]);
		}
	}

	for (const [, lineNumbers] of blocks.entries()) {
		if (lineNumbers.length >= 2) {
			violations.push({
				type: 'duplicate_block',
				severity: 'warning',
				description: `Duplicate code block found at lines ${lineNumbers.join(', ')}`,
				files: [path.relative(process.env.CLAUDE_PROJECT_DIR || '', filePath)],
				suggestion: 'Extract this repeated block into a shared function',
			});
			break; // Only report first duplicate to avoid noise
		}
	}

	return violations;
}

function checkRepeatedPatterns(content: string, filePath: string): DryViolation[] {
	const violations: DryViolation[] = [];

	// Check for repeated error handling patterns
	const errorHandlingPattern = /catch\s*\([^)]*\)\s*\{[^}]+\}/g;
	const errorHandlers = content.match(errorHandlingPattern) || [];

	if (errorHandlers.length >= 5) {
		// Normalize and count unique patterns
		const normalized = errorHandlers.map((h) =>
			h.replace(/\s+/g, ' ').replace(/['"][^'"]+['"]/g, '"..."')
		);
		const counts = new Map<string, number>();
		for (const n of normalized) {
			counts.set(n, (counts.get(n) || 0) + 1);
		}

		for (const [, count] of counts.entries()) {
			if (count >= 3) {
				violations.push({
					type: 'repeated_pattern',
					severity: 'warning',
					description: `Same error handling pattern repeated ${count} times`,
					files: [path.relative(process.env.CLAUDE_PROJECT_DIR || '', filePath)],
					suggestion:
						'Consider centralizing error handling with createErrorHandler()',
				});
				break;
			}
		}
	}

	// Check for repeated fetch/request patterns
	const fetchPattern = /fetch\s*\([^)]+\)/g;
	const fetches = content.match(fetchPattern) || [];

	if (fetches.length >= 4) {
		violations.push({
			type: 'repeated_pattern',
			severity: 'warning',
			description: `${fetches.length} fetch calls in one file - consider using BaseAPIClient`,
			files: [path.relative(process.env.CLAUDE_PROJECT_DIR || '', filePath)],
			suggestion: 'Use BaseAPIClient for consistent HTTP handling',
		});
	}

	return violations;
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

	const filePath =
		hookInput.tool_input?.file_path || hookInput.tool_response?.filePath;

	if (!filePath) {
		process.exit(0);
	}

	// Only check TypeScript files in packages/
	if (!filePath.includes('packages/') || !filePath.endsWith('.ts')) {
		process.exit(0);
	}

	// Skip test files
	if (filePath.includes('.test.') || filePath.includes('.spec.')) {
		process.exit(0);
	}

	if (!fs.existsSync(filePath)) {
		process.exit(0);
	}

	log(`CHECKING: ${filePath}`);

	const content = fs.readFileSync(filePath, 'utf-8');
	const allViolations: DryViolation[] = [];

	// Run checks
	allViolations.push(...checkDuplicateFunctions(filePath, content));
	allViolations.push(...checkDuplicateBlocks(content, filePath));
	allViolations.push(...checkRepeatedPatterns(content, filePath));

	// Separate critical from warnings
	const critical = allViolations.filter((v) => v.severity === 'critical');
	const warnings = allViolations.filter((v) => v.severity === 'warning');

	// Log all violations
	for (const v of allViolations) {
		log(`${v.severity.toUpperCase()}: ${v.description}`);
	}

	// Show warnings (non-blocking)
	for (const w of warnings) {
		console.log(`⚠ DRY: ${w.description}`);
		console.log(`  → ${w.suggestion}`);
	}

	// Critical violations block the operation
	if (critical.length > 0) {
		log(`BLOCKED: ${critical.length} critical DRY violation(s)`);

		console.error(`Resolve DRY violations before continuing:`);
		for (const c of critical) {
			console.error(`• ${c.description}`);
			console.error(`  Files: ${c.files.join(', ')}`);
			console.error(`  Fix: ${c.suggestion}`);
		}
		process.exit(2);
	}

	if (warnings.length === 0) {
		log(`PASSED: ${filePath}`);
	} else {
		log(`PASSED with ${warnings.length} warning(s): ${filePath}`);
	}

	process.exit(0);
}

main().catch((error) => {
	log(`ERROR: ${error.message}`);
	process.exit(1);
});
