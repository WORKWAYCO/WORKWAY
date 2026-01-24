/**
 * Workflow Test Command - Test Drive
 *
 * Take your workflow for a spin before shipping.
 * Mock mode: simulated road. Live mode: real traffic.
 */

import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../../utils/logger.js';
import { loadProjectConfig, loadOAuthTokens } from '../../lib/config.js';
import { validateWorkflowProject, getWorkflowPath } from '../../utils/workflow-validation.js';
import { WorkflowRuntime, loadWorkflow } from '../../lib/workflow-runtime.js';

interface TestOptions {
	mock?: boolean;
	live?: boolean;
	data?: string;
}

export async function workflowTestCommand(options: TestOptions): Promise<void> {
	try {
		// Determine test mode
		const mode = options.live ? 'live' : 'mock';

		Logger.header(`Test Drive (${mode} mode)`);

		// Validate workflow project (DRY: shared utility)
		await validateWorkflowProject();
		const workflowPath = getWorkflowPath();

		// Load project config
		const projectConfig = await loadProjectConfig();
		const testDataFile = options.data || projectConfig?.test?.testDataFile || './test-data.json';

		// Load test data
		const testDataPath = path.join(process.cwd(), testDataFile);
		if (!(await fs.pathExists(testDataPath))) {
			Logger.error(`Test data file not found: ${testDataFile}`);
			Logger.log('');
			Logger.log('Create test-data.json with sample trigger data');
			Logger.log('Or specify a different file with: --data <file>');
			process.exit(1);
		}

		const testData = await fs.readJson(testDataPath);

		Logger.section('Test Configuration');
		Logger.listItem(`Mode: ${mode}`);
		Logger.listItem(`Test data: ${testDataFile}`);
		Logger.listItem(`Workflow: workflow.ts`);
		Logger.blank();

		// Show spinner
		const spinner = Logger.spinner('Starting engine...');

		try {
			// Execute workflow test
			const result = await executeWorkflowTest(workflowPath, testData, mode);

			spinner.succeed('Test drive complete');
			Logger.blank();

			// Display results
			displayTestResults(result);

			if (result.success) {
				Logger.blank();
				Logger.success('Test drive passed!');
			} else {
				Logger.blank();
				Logger.error('Test drive failed');
				process.exit(1);
			}
		} catch (error: any) {
			spinner.fail('Engine stalled');
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
	if (mode === 'mock') {
		// Mock mode: simulate workflow execution with fake data
		return await executeMockTest(workflowPath, testData);
	} else {
		// Live mode: execute real workflow with OAuth tokens
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
 *
 * This executes the actual workflow code with real API calls
 * using OAuth tokens stored in ~/.workway/oauth-tokens.json
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
	Logger.log(`Using OAuth accounts: ${providers.join(', ')}`);
	Logger.blank();

	// Display trigger
	Logger.log(`Trigger: ${testData.trigger?.type || 'manual'}`);
	if (testData.trigger?.data) {
		Logger.listItem(`Data: ${JSON.stringify(testData.trigger.data)}`);
	}
	Logger.blank();

	// Load and compile the workflow
	Logger.log('Compiling workflow...');
	const workflow = await loadWorkflow(workflowPath);
	Logger.success(`Loaded: ${workflow.metadata?.name || 'workflow'}`);
	Logger.blank();

	// Check required integrations
	if (workflow.integrations && workflow.integrations.length > 0) {
		Logger.log('Required integrations:');
		for (const integration of workflow.integrations) {
			const hasToken = !!oauthTokens[integration];
			if (hasToken) {
				Logger.success(`  ${integration}: connected`);
			} else {
				Logger.error(`  ${integration}: not connected`);
			}
		}
		Logger.blank();
	}

	// Initialize runtime
	const runtime = new WorkflowRuntime();
	await runtime.initialize();

	// Execute workflow
	Logger.log('Executing workflow...');
	Logger.blank();

	const { result, steps, totalDuration } = await runtime.execute(
		workflow,
		testData,
		testData.config || {}
	);

	// Display step results
	Logger.section('Step Results');
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];

		if (step.status === 'success') {
			Logger.success(`Step ${i + 1}: ${step.actionId} (LIVE)`);
			Logger.listItem(`Duration: ${step.duration}ms`);

			// Show relevant output based on action type
			if (step.output) {
				const outputPreview = JSON.stringify(step.output, null, 2);
				if (outputPreview.length > 200) {
					Logger.listItem(`Output: ${outputPreview.substring(0, 200)}...`);
				} else {
					Logger.listItem(`Output: ${outputPreview}`);
				}
			}
		} else {
			Logger.error(`Step ${i + 1}: ${step.actionId} FAILED`);
			if (step.error) {
				Logger.listItem(`Error: ${step.error}`);
			}
		}

		Logger.blank();
	}

	return {
		success: result.success,
		mode: 'live',
		steps: steps.map((s) => ({
			name: s.actionId,
			status: s.status,
			duration: s.duration,
			output: s.output,
			error: s.error,
		})),
		totalDuration,
		output: result.data,
		error: result.error,
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
