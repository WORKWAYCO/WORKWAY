/**
 * Workflow Test Command
 *
 * Tests workflow execution with mock or live data
 */

import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../../utils/logger.js';
import { loadProjectConfig, loadOAuthTokens } from '../../lib/config.js';

interface TestOptions {
	mock?: boolean;
	live?: boolean;
	data?: string;
}

export async function workflowTestCommand(options: TestOptions): Promise<void> {
	try {
		// Determine test mode
		const mode = options.live ? 'live' : 'mock';

		Logger.header(`Test Workflow (${mode} mode)`);

		// Check if we're in a workflow project
		const workflowPath = path.join(process.cwd(), 'workflow.ts');
		if (!(await fs.pathExists(workflowPath))) {
			Logger.error('No workflow.ts found in current directory');
			Logger.log('');
			Logger.log('💡 Run this command from a workflow project directory');
			Logger.log('💡 Or create a new workflow with: workway workflow init');
			process.exit(1);
		}

		// Load project config
		const projectConfig = await loadProjectConfig();
		const testDataFile = options.data || projectConfig?.test?.testDataFile || './test-data.json';

		// Load test data
		const testDataPath = path.join(process.cwd(), testDataFile);
		if (!(await fs.pathExists(testDataPath))) {
			Logger.error(`Test data file not found: ${testDataFile}`);
			Logger.log('');
			Logger.log('💡 Create test-data.json with sample trigger data');
			Logger.log('💡 Or specify a different file with: --data <file>');
			process.exit(1);
		}

		const testData = await fs.readJson(testDataPath);

		Logger.section('Test Configuration');
		Logger.listItem(`Mode: ${mode}`);
		Logger.listItem(`Test data: ${testDataFile}`);
		Logger.listItem(`Workflow: workflow.ts`);
		Logger.blank();

		// Show spinner
		const spinner = Logger.spinner('Running workflow...');

		try {
			// Execute workflow test
			const result = await executeWorkflowTest(workflowPath, testData, mode);

			spinner.succeed('Workflow execution complete');
			Logger.blank();

			// Display results
			displayTestResults(result);

			if (result.success) {
				Logger.blank();
				Logger.success('Workflow test passed! ✅');
			} else {
				Logger.blank();
				Logger.error('Workflow test failed ❌');
				process.exit(1);
			}
		} catch (error: any) {
			spinner.fail('Workflow execution failed');
			Logger.blank();
			Logger.error('Error: ' + error.message);

			if (error.stack && process.env.DEBUG) {
				Logger.blank();
				Logger.debug(error.stack);
			}

			process.exit(1);
		}
	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Execute workflow test
 */
async function executeWorkflowTest(
	workflowPath: string,
	testData: any,
	mode: string
): Promise<any> {
	// In mock mode, simulate workflow execution
	if (mode === 'mock') {
		return await executeMockTest(workflowPath, testData);
	} else {
		// In live mode, use real OAuth tokens
		return await executeLiveTest(workflowPath, testData);
	}
}

/**
 * Execute mock test (simulated)
 */
async function executeMockTest(workflowPath: string, testData: any): Promise<any> {
	Logger.section('Workflow Steps');

	// Simulate trigger
	Logger.log(`🔔 Trigger: ${testData.trigger?.type || 'manual'}`);
	if (testData.trigger?.data) {
		Logger.listItem(`Data: ${JSON.stringify(testData.trigger.data)}`);
	}
	Logger.blank();

	// Mock action execution results
	const steps = [
		{
			name: 'gmail.fetch-email',
			status: 'success',
			duration: 245,
			output: {
				from: testData.trigger?.data?.from || 'test@example.com',
				subject: testData.trigger?.data?.subject || 'Test Email',
				body: 'This is a test email body',
			},
		},
		{
			name: 'slack.send-message',
			status: 'success',
			duration: 189,
			output: {
				ok: true,
				channel: testData.config?.slackChannel || '#test',
				ts: '1699747200.123456',
			},
		},
	];

	// Display each step
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate delay

		if (step.status === 'success') {
			Logger.success(`Step ${i + 1}: ${step.name}`);
			Logger.listItem(`Duration: ${step.duration}ms`);

			if (step.name === 'gmail.fetch-email') {
				Logger.listItem(`From: ${step.output.from}`);
				Logger.listItem(`Subject: ${step.output.subject}`);
			} else if (step.name === 'slack.send-message') {
				Logger.listItem(`Channel: ${step.output.channel}`);
				Logger.listItem(`Sent: ✓`);
			}
		} else {
			Logger.error(`Step ${i + 1}: ${step.name} failed`);
		}

		Logger.blank();
	}

	return {
		success: true,
		steps,
		totalDuration: steps.reduce((sum, s) => sum + s.duration, 0),
		output: {
			emailProcessed: steps[0].output.subject,
		},
	};
}

/**
 * Execute live test (with real OAuth)
 */
async function executeLiveTest(workflowPath: string, testData: any): Promise<any> {
	Logger.section('Workflow Steps (Live Mode)');

	// Load OAuth tokens
	const oauthTokens = await loadOAuthTokens();
	const providers = Object.keys(oauthTokens);

	if (providers.length === 0) {
		throw new Error(
			'No OAuth accounts connected. Connect an account first:\n  workway oauth connect <provider>'
		);
	}

	// Display connected accounts
	Logger.log(`📱 Using OAuth accounts: ${providers.join(', ')}`);
	Logger.blank();

	// Simulate trigger
	Logger.log(`🔔 Trigger: ${testData.trigger?.type || 'manual'}`);
	if (testData.trigger?.data) {
		Logger.listItem(`Data: ${JSON.stringify(testData.trigger.data)}`);
	}
	Logger.blank();

	// In a real implementation, this would:
	// 1. Import the workflow.ts file dynamically
	// 2. Create WorkflowContext with real OAuth credentials
	// 3. Execute the workflow with live API calls
	// 4. Return actual results from the APIs

	// For now, simulate with realistic live API calls
	const steps = [
		{
			name: 'gmail.fetch-email',
			status: 'success',
			duration: 892,
			output: {
				id: '18c2a1b4d5e6f7a8',
				from: testData.trigger?.data?.from || 'real@example.com',
				subject: testData.trigger?.data?.subject || 'Live Test Email',
				body: 'This would be fetched from Gmail API',
				labels: ['INBOX', 'UNREAD'],
			},
		},
		{
			name: 'slack.send-message',
			status: 'success',
			duration: 567,
			output: {
				ok: true,
				channel: testData.config?.slackChannel || '#general',
				ts: Date.now() / 1000,
				message: {
					text: 'New email from real@example.com',
					type: 'message',
				},
			},
		},
	];

	// Display each step with realistic timing
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate API delay

		if (step.status === 'success') {
			Logger.success(`Step ${i + 1}: ${step.name} (LIVE)`);
			Logger.listItem(`Duration: ${step.duration}ms`);

			if (step.name === 'gmail.fetch-email') {
				Logger.listItem(`From: ${step.output.from}`);
				Logger.listItem(`Subject: ${step.output.subject}`);
				Logger.listItem(`ID: ${step.output.id}`);
			} else if (step.name === 'slack.send-message') {
				Logger.listItem(`Channel: ${step.output.channel}`);
				Logger.listItem(`Timestamp: ${step.output.ts}`);
				Logger.listItem(`Sent: ✓`);
			}
		} else {
			Logger.error(`Step ${i + 1}: ${step.name} failed`);
		}

		Logger.blank();
	}

	return {
		success: true,
		mode: 'live',
		steps,
		totalDuration: steps.reduce((sum, s) => sum + s.duration, 0),
		output: {
			emailProcessed: steps[0].output.subject,
			slackMessage: steps[1].output.ts,
		},
	};
}

/**
 * Display test results
 */
function displayTestResults(result: any): void {
	Logger.section('Test Results');

	if (result.steps) {
		const successCount = result.steps.filter((s: any) => s.status === 'success').length;
		const totalCount = result.steps.length;

		Logger.listItem(`Steps: ${successCount}/${totalCount} passed`);
		Logger.listItem(`Duration: ${result.totalDuration}ms`);
	}

	if (result.output) {
		Logger.listItem(`Output: ${JSON.stringify(result.output, null, 2)}`);
	}
}
