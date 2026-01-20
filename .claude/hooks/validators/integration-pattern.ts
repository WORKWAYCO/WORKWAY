#!/usr/bin/env npx tsx
/**
 * Integration Pattern Validator Hook
 *
 * Specialized self-validation for WORKWAY integrations.
 * Validates that new integrations follow the BaseAPIClient pattern.
 *
 * Checks:
 *   - Extends BaseAPIClient
 *   - Has proper type exports
 *   - Uses ActionResult return types
 *   - Follows directory structure
 *
 * Exit codes:
 *   0 = Valid integration pattern
 *   2 = Pattern violation (blocks and provides feedback to Claude)
 */

import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(
	process.env.CLAUDE_PROJECT_DIR || process.cwd(),
	'.claude/hooks/validators/integration-pattern.log'
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

interface ValidationResult {
	valid: boolean;
	issues: string[];
	warnings: string[];
}

function log(message: string): void {
	const timestamp = new Date().toISOString();
	fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

function validateIntegrationPattern(filePath: string): ValidationResult {
	const issues: string[] = [];
	const warnings: string[] = [];

	// Only validate files in packages/integrations/src/
	if (!filePath.includes('packages/integrations/src/')) {
		return { valid: true, issues: [], warnings: [] };
	}

	// Skip test files and type files
	if (filePath.includes('.test.') || filePath.includes('.types.')) {
		return { valid: true, issues: [], warnings: [] };
	}

	// Skip core utilities
	if (filePath.includes('/core/')) {
		return { valid: true, issues: [], warnings: [] };
	}

	if (!fs.existsSync(filePath)) {
		return { valid: true, issues: [], warnings: [] };
	}

	const content = fs.readFileSync(filePath, 'utf-8');
	const fileName = path.basename(filePath);
	const dirName = path.basename(path.dirname(filePath));

	// Check 1: Main integration file should extend BaseAPIClient
	if (fileName === 'index.ts') {
		if (!content.includes('extends BaseAPIClient')) {
			issues.push(
				`Integration class must extend BaseAPIClient (see packages/integrations/src/core/base-client.ts)`
			);
		}

		// Check for BaseAPIClient import
		if (!content.includes("from '../core") && !content.includes("from '../core/index.js")) {
			issues.push(
				`Missing import from '../core/index.js' - use BaseAPIClient, validateAccessToken, createErrorHandler`
			);
		}
	}

	// Check 2: Should use ActionResult return types
	if (content.includes('async ') && !content.includes('ActionResult')) {
		warnings.push(
			`Methods should return ActionResult<T> for standardized error handling`
		);
	}

	// Check 3: Should have error handler
	if (fileName === 'index.ts' && !content.includes('createErrorHandler')) {
		warnings.push(
			`Integration should use createErrorHandler('${dirName}') for consistent error handling`
		);
	}

	// Check 4: Should have proper type definitions
	if (fileName === 'index.ts') {
		const hasTypeExports =
			content.includes('export interface') || content.includes('export type');
		const hasConfigType = content.includes('Config') && content.includes('interface');

		if (!hasTypeExports) {
			warnings.push(
				`Consider defining TypeScript interfaces for request/response types`
			);
		}
		if (!hasConfigType) {
			warnings.push(
				`Consider defining a ${dirName.charAt(0).toUpperCase() + dirName.slice(1)}Config interface`
			);
		}
	}

	// Check 5: Should validate access token
	if (
		fileName === 'index.ts' &&
		content.includes('constructor') &&
		!content.includes('validateAccessToken')
	) {
		issues.push(
			`Constructor should call validateAccessToken(config.accessToken, '${dirName}')`
		);
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

	const filePath =
		hookInput.tool_input?.file_path || hookInput.tool_response?.filePath;

	if (!filePath) {
		process.exit(0);
	}

	log(`VALIDATING: ${filePath}`);

	const result = validateIntegrationPattern(filePath);

	// Log warnings but don't block
	for (const warning of result.warnings) {
		log(`WARNING: ${warning}`);
		console.log(`⚠ ${warning}`);
	}

	if (result.valid) {
		log(`PASSED: ${filePath}`);
		if (filePath.includes('packages/integrations/src/')) {
			console.log(`✓ Integration pattern valid: ${path.basename(filePath)}`);
		}
		process.exit(0);
	} else {
		log(`FAILED: ${filePath}\n  ${result.issues.join('\n  ')}`);

		console.error(`Resolve integration pattern issues in ${filePath}:`);
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
