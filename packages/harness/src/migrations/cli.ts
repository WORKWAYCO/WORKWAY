#!/usr/bin/env tsx

/**
 * Schema Consistency Migration CLI
 *
 * Usage:
 *   pnpm migrate:schema --dry-run              # Preview changes
 *   pnpm migrate:schema                        # Apply fixes
 *   pnpm migrate:schema --rollback             # Rollback changes
 *   pnpm migrate:schema --subset 5             # Test on 5 workflows first
 */

import { Command } from 'commander';
import { runMigration } from './schema-consistency-fixer.js';
import * as path from 'path';

const program = new Command();

program
	.name('schema-consistency-migration')
	.description('Auto-fix schema consistency findings in workflow files')
	.version('1.0.0');

program
	.option('--dry-run', 'Preview changes without applying them', false)
	.option('--rollback', 'Rollback previous migration', false)
	.option(
		'--findings <path>',
		'Path to schema-consistency-report.json',
		path.join(process.cwd(), '../../audit-reports/schema-consistency-report.json')
	)
	.option(
		'--workflows <path>',
		'Path to workflows directory',
		path.join(process.cwd(), '../../packages/workflows/src')
	)
	.option('--subset <count>', 'Test on first N workflows only', undefined)
	.action(async options => {
		try {
			// If subset is specified, create a temporary findings file with limited workflows
			let findingsPath = options.findings;

			if (options.subset) {
				const fs = await import('fs/promises');
				const originalFindings = JSON.parse(
					await fs.readFile(options.findings, 'utf-8')
				);

				// Get unique workflow IDs
				const workflowIds = new Set<string>();
				const limitedFindings = [];

				for (const finding of originalFindings.findings) {
					if (workflowIds.size < parseInt(options.subset, 10)) {
						workflowIds.add(finding.workflowId);
						limitedFindings.push(finding);
					} else if (workflowIds.has(finding.workflowId)) {
						limitedFindings.push(finding);
					}
				}

				const limitedReport = {
					...originalFindings,
					findings: limitedFindings,
					findingsCount: limitedFindings.length,
				};

				// Save temporary report
				findingsPath = options.findings.replace('.json', '-subset.json');
				await fs.writeFile(findingsPath, JSON.stringify(limitedReport, null, 2));

				console.log(
					`\n📌 Testing on ${workflowIds.size} workflows (${limitedFindings.length} findings)\n`
				);
			}

			await runMigration({
				dryRun: options.dryRun,
				rollback: options.rollback,
				findingsPath,
				workflowsPath: options.workflows,
			});
		} catch (error) {
			console.error('\n❌ Migration failed:', error);
			process.exit(1);
		}
	});

program.parse();
