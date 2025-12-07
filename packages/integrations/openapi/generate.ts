#!/usr/bin/env npx tsx
/**
 * OpenAPI Type Generator for WORKWAY Integrations
 *
 * Generates TypeScript types from OpenAPI specifications.
 * These serve as reference documentation - WORKWAY uses hand-crafted types
 * in production for ActionResult compatibility.
 *
 * Usage:
 *   npx tsx generate.ts           # Generate all
 *   npx tsx generate.ts stripe    # Generate specific integration
 *
 * @example
 * ```bash
 * cd packages/integrations/openapi
 * npx tsx generate.ts stripe
 * ```
 */

import { exec } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));

interface IntegrationSource {
	name: string;
	url: string;
	output: string;
	official: boolean;
	note?: string;
}

interface SourcesConfig {
	integrations: Record<string, IntegrationSource>;
	unsupported: Record<string, string>;
}

async function generateTypes(integrationId?: string): Promise<void> {
	// Load sources config
	const sourcesPath = join(__dirname, 'sources.json');
	const sources: SourcesConfig = JSON.parse(readFileSync(sourcesPath, 'utf-8'));

	// Create generated directory
	const generatedDir = join(__dirname, 'generated');
	if (!existsSync(generatedDir)) {
		mkdirSync(generatedDir, { recursive: true });
	}

	// Filter integrations
	const integrations = integrationId
		? { [integrationId]: sources.integrations[integrationId] }
		: sources.integrations;

	if (integrationId && !sources.integrations[integrationId]) {
		if (sources.unsupported[integrationId]) {
			console.error(`❌ ${integrationId}: ${sources.unsupported[integrationId]}`);
			process.exit(1);
		}
		console.error(`❌ Unknown integration: ${integrationId}`);
		console.log('\nAvailable integrations:');
		for (const id of Object.keys(sources.integrations)) {
			console.log(`  - ${id}`);
		}
		process.exit(1);
	}

	console.log('🔄 Generating TypeScript types from OpenAPI specs...\n');

	const results: { id: string; success: boolean; error?: string }[] = [];

	for (const [id, config] of Object.entries(integrations)) {
		if (!config) continue;

		const outputPath = join(generatedDir, config.output);
		console.log(`📦 ${config.name} (${id})`);
		console.log(`   Source: ${config.url}`);
		console.log(`   Output: ${outputPath}`);

		try {
			const command = `npx openapi-typescript "${config.url}" -o "${outputPath}"`;
			const { stdout, stderr } = await execAsync(command, {
				cwd: join(__dirname, '..', '..', '..'),
				timeout: 60000, // 60 second timeout
			});

			if (stderr && !stderr.includes('Done!')) {
				console.log(`   ⚠️  Warning: ${stderr.trim()}`);
			}

			console.log(`   ✅ Generated successfully\n`);
			results.push({ id, success: true });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.log(`   ❌ Failed: ${errorMessage}\n`);
			results.push({ id, success: false, error: errorMessage });
		}
	}

	// Summary
	console.log('━'.repeat(50));
	console.log('Summary:');
	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);

	if (successful.length > 0) {
		console.log(`  ✅ ${successful.length} generated: ${successful.map((r) => r.id).join(', ')}`);
	}
	if (failed.length > 0) {
		console.log(`  ❌ ${failed.length} failed: ${failed.map((r) => r.id).join(', ')}`);
	}

	console.log('\n💡 Note: Generated types are for reference. WORKWAY uses hand-crafted');
	console.log('   types in packages/integrations/src/{integration}/ for ActionResult');
	console.log('   compatibility and focused API coverage.\n');

	if (failed.length > 0) {
		process.exit(1);
	}
}

// Run
const targetIntegration = process.argv[2];
generateTypes(targetIntegration).catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
