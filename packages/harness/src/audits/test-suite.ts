#!/usr/bin/env node
/**
 * Test Suite Verification
 *
 * Quick smoke test to verify all 8 auditors are registered and executable.
 */

import { runAllAudits } from './coordinator';
import * as path from 'path';

async function testSuite() {
	console.log('🧪 Testing Workflow Audit Suite...\n');

	const config = {
		workflowsPath: path.resolve(process.cwd(), '../workflows/src'),
		outputPath: path.resolve(process.cwd(), '../../audit-reports-test'),
		createBeadsIssues: false,
		autoFix: false,
		dryRun: true, // Don't write files
		parallel: true,
		maxWorkers: 4,
		generateMarkdownReports: false,
		generateJsonReports: false,
	};

	try {
		console.log('📁 Workflows path:', config.workflowsPath);
		console.log('📊 Output path:', config.outputPath);
		console.log('⚙️  Mode: Parallel (dry run)\n');

		const reports = await runAllAudits(config);

		console.log('\n✅ Test Results:\n');
		console.log('Total Audits Executed:', reports.size);
		console.log('Expected:', 8);
		console.log('Match:', reports.size === 8 ? '✅ YES' : '❌ NO');
		console.log('\nAudit Breakdown:');

		const auditNames = [
			'scoring-rules',
			'required-properties',
			'api-endpoint-health',
			'oauth-provider-coverage',
			'user-input-field-quality',
			'error-message-helpfulness',
			'schema-consistency',
			'field-mapping-completeness',
		];

		let allPresent = true;
		for (const name of auditNames) {
			const present = reports.has(name);
			const report = reports.get(name);
			console.log(`  ${present ? '✅' : '❌'} ${name.padEnd(35)} ${present ? `(${report!.findingsCount} findings)` : 'MISSING'}`);
			if (!present) allPresent = false;
		}

		console.log('\nOverall Status:', allPresent ? '✅ ALL AUDITS OPERATIONAL' : '❌ SOME AUDITS MISSING');

		if (allPresent) {
			console.log('\n🎉 Workflow Audit Suite: 100% Complete\n');
			process.exit(0);
		} else {
			console.log('\n❌ Test failed: Not all audits registered\n');
			process.exit(1);
		}
	} catch (error) {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	}
}

testSuite();
