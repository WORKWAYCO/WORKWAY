#!/usr/bin/env npx tsx
/**
 * Workflow Structure Validator Hook
 *
 * Specialized self-validation for WORKWAY workflow definitions.
 * Ensures workflows follow the compound workflow pattern.
 *
 * Checks:
 *   - Has defineWorkflow call
 *   - Has required fields (id, name, trigger, steps)
 *   - Steps have proper structure
 *   - Pricing tier is specified
 *   - Follows Zuhandenheit naming (outcome-focused)
 *
 * Exit codes:
 *   0 = Valid workflow structure
 *   2 = Structure violation (blocks and provides feedback)
 */

import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(
	process.env.CLAUDE_PROJECT_DIR || process.cwd(),
	'.claude/hooks/validators/workflow-structure.log'
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

function validateWorkflowStructure(filePath: string): ValidationResult {
	const issues: string[] = [];
	const warnings: string[] = [];

	// Only validate files in packages/workflows/src/
	if (!filePath.includes('packages/workflows/src/')) {
		return { valid: true, issues: [], warnings: [] };
	}

	// Only validate index.ts files (main workflow definitions)
	if (!filePath.endsWith('/index.ts')) {
		return { valid: true, issues: [], warnings: [] };
	}

	if (!fs.existsSync(filePath)) {
		return { valid: true, issues: [], warnings: [] };
	}

	const content = fs.readFileSync(filePath, 'utf-8');
	const dirName = path.basename(path.dirname(filePath));

	// Check 1: Has defineWorkflow
	if (!content.includes('defineWorkflow')) {
		issues.push(
			`Workflow must use defineWorkflow() from @workwayco/sdk`
		);
	}

	// Check 2: Has required fields
	const requiredFields = ['id:', 'name:', 'trigger:', 'steps:'];
	for (const field of requiredFields) {
		if (!content.includes(field)) {
			issues.push(`Workflow missing required field: ${field.replace(':', '')}`);
		}
	}

	// Check 3: Has pricing configuration
	// Note: Pricing is flexible - workflows can define custom pricePerExecution
	// Default tiers: 'light' (standard) or 'heavy' (advanced)
	if (!content.includes('pricing:') && !content.includes('tier:') && !content.includes('pricePerExecution')) {
		warnings.push(
			`Workflow should specify pricing (pricePerExecution or tier: 'light'/'heavy')`
		);
	}

	// Check 4: Steps have proper structure
	if (content.includes('steps:')) {
		const hasStepId = content.includes("id: '") || content.includes('id: "');
		const hasStepType = content.includes("type: '") || content.includes('type: "');

		if (!hasStepId) {
			issues.push(`Workflow steps must have unique id fields`);
		}
		if (!hasStepType) {
			issues.push(`Workflow steps must have type fields (e.g., 'notion.createPage')`);
		}
	}

	// Check 5: Zuhandenheit naming check
	// Bad patterns: "X to Y Sync", "X-Y Integration"
	const badNamePatterns = [
		/name:\s*['"][^'"]*to[^'"]*Sync['"]/i,
		/name:\s*['"][^'"]*Integration['"]/i,
	];

	for (const pattern of badNamePatterns) {
		if (pattern.test(content)) {
			warnings.push(
				`Workflow name should focus on outcome, not mechanism. Use "Meeting Follow-up" not "Zoom to Notion Sync"`
			);
			break;
		}
	}

	// Check 6: Should be compound (multiple steps)
	const stepMatches = content.match(/{\s*id:/g);
	const stepCount = stepMatches?.length || 0;

	if (stepCount < 2) {
		warnings.push(
			`Workflow has only ${stepCount} step(s). WORKWAY differentiates with compound workflows - consider adding notification, follow-up, or CRM update steps.`
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

	const result = validateWorkflowStructure(filePath);

	// Log and show warnings
	for (const warning of result.warnings) {
		log(`WARNING: ${warning}`);
		console.log(`⚠ ${warning}`);
	}

	if (result.valid) {
		log(`PASSED: ${filePath}`);
		if (filePath.includes('packages/workflows/src/')) {
			console.log(`✓ Workflow structure valid: ${path.basename(path.dirname(filePath))}`);
		}
		process.exit(0);
	} else {
		log(`FAILED: ${filePath}\n  ${result.issues.join('\n  ')}`);

		console.error(`Resolve workflow structure issues in ${filePath}:`);
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
