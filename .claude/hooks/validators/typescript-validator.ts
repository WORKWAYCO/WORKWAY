#!/usr/bin/env npx tsx
/**
 * TypeScript Validator Hook
 *
 * Specialized self-validation for TypeScript files.
 * Runs after Edit/Write operations to catch syntax errors immediately.
 *
 * Exit codes:
 *   0 = Valid TypeScript
 *   2 = Invalid TypeScript (blocks and provides feedback to Claude)
 *
 * Usage in agent frontmatter:
 *   hooks:
 *     PostToolUse:
 *       - matcher: "Edit|Write"
 *         hooks:
 *           - type: command
 *             command: "npx tsx \"$CLAUDE_PROJECT_DIR/.claude/hooks/validators/typescript-validator.ts\""
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Log file for observability
const LOG_FILE = path.join(
	process.env.CLAUDE_PROJECT_DIR || process.cwd(),
	'.claude/hooks/validators/typescript-validator.log'
);

interface HookInput {
	tool_name: string;
	tool_input: {
		file_path?: string;
		content?: string;
	};
	tool_response?: {
		filePath?: string;
		success?: boolean;
	};
}

function log(message: string): void {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] ${message}\n`;
	fs.appendFileSync(LOG_FILE, logMessage);
}

function validateTypeScript(filePath: string): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Only validate .ts and .tsx files
	if (!filePath.match(/\.tsx?$/)) {
		return { valid: true, errors: [] };
	}

	// Check if file exists
	if (!fs.existsSync(filePath)) {
		return { valid: true, errors: [] }; // File doesn't exist yet, skip
	}

	// Read and do basic syntax validation
	const content = fs.readFileSync(filePath, 'utf-8');

	// Check for common syntax errors that break parsing
	const syntaxIssues: string[] = [];

	// Check for unmatched braces (simple heuristic)
	const openBraces = (content.match(/\{/g) || []).length;
	const closeBraces = (content.match(/\}/g) || []).length;
	if (openBraces !== closeBraces) {
		syntaxIssues.push(`Unmatched braces: ${openBraces} open, ${closeBraces} close`);
	}

	// Check for unmatched parentheses
	const openParens = (content.match(/\(/g) || []).length;
	const closeParens = (content.match(/\)/g) || []).length;
	if (openParens !== closeParens) {
		syntaxIssues.push(`Unmatched parentheses: ${openParens} open, ${closeParens} close`);
	}

	// Check for unmatched brackets
	const openBrackets = (content.match(/\[/g) || []).length;
	const closeBrackets = (content.match(/\]/g) || []).length;
	if (openBrackets !== closeBrackets) {
		syntaxIssues.push(`Unmatched brackets: ${openBrackets} open, ${closeBrackets} close`);
	}

	// Check for obvious syntax errors using tsc but only for critical errors
	try {
		// Use tsc with very lenient settings - only catch parse errors
		execSync(
			`npx tsc --noEmit --skipLibCheck --noResolve --isolatedModules --target ESNext --allowJs "${filePath}" 2>&1`,
			{
				cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
				encoding: 'utf-8',
				timeout: 30000,
			}
		);
	} catch (error: any) {
		const output = error.stdout || error.message || '';
		
		// Only catch actual syntax/parse errors (TS1xxx series)
		// Skip type errors (TS2xxx), which require full project context
		const parseErrors = output
			.split('\n')
			.filter((line: string) => {
				if (!line.includes('error TS1')) return false; // Only TS1xxx (syntax errors)
				if (line.includes('node_modules/')) return false;
				return true;
			})
			.slice(0, 5);

		if (parseErrors.length > 0) {
			errors.push(...parseErrors);
		}
	}

	// Combine syntax issues and parse errors
	const allErrors = [...syntaxIssues, ...errors];

	if (allErrors.length === 0) {
		return { valid: true, errors: [] };
	}

	return { valid: false, errors: allErrors };
}

async function main(): Promise<void> {
	// Read hook input from stdin
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

	// Get file path from tool input or response
	const filePath =
		hookInput.tool_input?.file_path ||
		hookInput.tool_response?.filePath;

	if (!filePath) {
		log('INFO: No file path in hook input, skipping');
		process.exit(0);
	}

	log(`VALIDATING: ${filePath}`);

	const result = validateTypeScript(filePath);

	if (result.valid) {
		log(`PASSED: ${filePath}`);
		console.log(`✓ TypeScript valid: ${path.basename(filePath)}`);
		process.exit(0);
	} else {
		log(`FAILED: ${filePath}\n  ${result.errors.join('\n  ')}`);

		// Exit code 2 blocks the operation and provides feedback to Claude
		console.error(`Resolve TypeScript errors in ${filePath}:`);
		for (const error of result.errors) {
			console.error(`• ${error}`);
		}
		process.exit(2);
	}
}

main().catch((error) => {
	log(`ERROR: ${error.message}`);
	process.exit(1);
});
