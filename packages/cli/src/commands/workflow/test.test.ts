/**
 * Tests for workflow/test.ts - Workflow testing with mock/live modes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { workflowTestCommand } from './test.js';

// Mock dependencies
vi.mock('fs-extra');
vi.mock('../../utils/logger.js', () => ({
	Logger: {
		header: vi.fn(),
		section: vi.fn(),
		listItem: vi.fn(),
		blank: vi.fn(),
		log: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		spinner: vi.fn(() => ({
			succeed: vi.fn(),
			fail: vi.fn(),
			text: '',
		})),
	},
}));
vi.mock('../../lib/config.js');
vi.mock('../../utils/workflow-validation.js');
vi.mock('../../lib/workflow-runtime.js');

describe('workflow/test.ts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Mock Mode Testing', () => {
		it('should test workflow in mock mode by default', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig } = await import('../../lib/config.js');

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue({
				dev: { port: 3000, hotReload: true, mockMode: true },
				test: { testDataFile: './test-data.json', timeout: 30000 },
				build: { outDir: './dist', minify: false },
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: {
					type: 'manual',
					data: {
						from: 'test@example.com',
						subject: 'Test Email',
					},
				},
			});

			await workflowTestCommand({ mock: true });

			expect(validateWorkflowProject).toHaveBeenCalled();
			expect(getWorkflowPath).toHaveBeenCalled();
		});

		it('should load test data from default file', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig } = await import('../../lib/config.js');

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue({
				dev: { port: 3000, hotReload: true, mockMode: true },
				test: { testDataFile: './test-data.json', timeout: 30000 },
				build: { outDir: './dist', minify: false },
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: { type: 'manual' },
			});

			await workflowTestCommand({ mock: true });

			expect(fs.readJson).toHaveBeenCalledWith(
				path.join(process.cwd(), './test-data.json')
			);
		});

		it('should load test data from custom file', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig } = await import('../../lib/config.js');

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: { type: 'manual' },
			});

			await workflowTestCommand({ mock: true, data: './custom-data.json' });

			expect(fs.readJson).toHaveBeenCalledWith(
				path.join(process.cwd(), './custom-data.json')
			);
		});

		it('should error when test data file does not exist', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig } = await import('../../lib/config.js');

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);
			vi.mocked(fs.pathExists).mockResolvedValue(false);

			await workflowTestCommand({ mock: true });

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should simulate workflow steps in mock mode', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig } = await import('../../lib/config.js');

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: {
					type: 'email',
					data: {
						from: 'test@example.com',
						subject: 'Test',
					},
				},
				config: {
					slackChannel: '#test',
				},
			});

			await workflowTestCommand({ mock: true });

			// Test passes through mock simulation
			expect(process.exit).not.toHaveBeenCalled();
		});
	});

	describe('Live Mode Testing', () => {
		it('should test workflow in live mode when --live flag is set', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig, loadOAuthTokens } = await import(
				'../../lib/config.js'
			);
			const { loadWorkflow, WorkflowRuntime } = await import(
				'../../lib/workflow-runtime.js'
			);

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);
			vi.mocked(loadOAuthTokens).mockResolvedValue({
				gmail: { access_token: 'gmail-token' },
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: { type: 'manual' },
			});

			const mockWorkflow = {
				metadata: { name: 'Test Workflow' },
				integrations: ['gmail'],
				execute: vi.fn(),
			};

			vi.mocked(loadWorkflow).mockResolvedValue(mockWorkflow);

			const mockRuntime = {
				initialize: vi.fn(),
				execute: vi.fn().mockResolvedValue({
					result: { success: true, data: {} },
					steps: [
						{
							actionId: 'gmail.fetch',
							status: 'success',
							duration: 100,
							output: { subject: 'Test' },
						},
					],
					totalDuration: 100,
				}),
			};

			vi.mocked(WorkflowRuntime).mockImplementation(() => mockRuntime as any);

			await workflowTestCommand({ live: true });

			expect(loadOAuthTokens).toHaveBeenCalled();
			expect(loadWorkflow).toHaveBeenCalled();
			expect(mockRuntime.initialize).toHaveBeenCalled();
			expect(mockRuntime.execute).toHaveBeenCalled();
		});

		it('should error when no OAuth accounts are connected', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig, loadOAuthTokens } = await import(
				'../../lib/config.js'
			);

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);
			vi.mocked(loadOAuthTokens).mockResolvedValue({});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: { type: 'manual' },
			});

			await workflowTestCommand({ live: true });

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should show connected OAuth providers', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig, loadOAuthTokens } = await import(
				'../../lib/config.js'
			);
			const { loadWorkflow, WorkflowRuntime } = await import(
				'../../lib/workflow-runtime.js'
			);

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);
			vi.mocked(loadOAuthTokens).mockResolvedValue({
				gmail: { access_token: 'gmail-token' },
				slack: { access_token: 'slack-token' },
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: { type: 'manual' },
			});

			const mockWorkflow = {
				metadata: { name: 'Test Workflow' },
				integrations: ['gmail', 'slack'],
				execute: vi.fn(),
			};

			vi.mocked(loadWorkflow).mockResolvedValue(mockWorkflow);

			const mockRuntime = {
				initialize: vi.fn(),
				execute: vi.fn().mockResolvedValue({
					result: { success: true, data: {} },
					steps: [],
					totalDuration: 0,
				}),
			};

			vi.mocked(WorkflowRuntime).mockImplementation(() => mockRuntime as any);

			await workflowTestCommand({ live: true });

			expect(loadOAuthTokens).toHaveBeenCalled();
		});

		it('should display step results after execution', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig, loadOAuthTokens } = await import(
				'../../lib/config.js'
			);
			const { loadWorkflow, WorkflowRuntime } = await import(
				'../../lib/workflow-runtime.js'
			);

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);
			vi.mocked(loadOAuthTokens).mockResolvedValue({
				gmail: { access_token: 'token' },
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: { type: 'manual' },
			});

			const mockWorkflow = {
				metadata: { name: 'Test Workflow' },
				integrations: ['gmail'],
				execute: vi.fn(),
			};

			vi.mocked(loadWorkflow).mockResolvedValue(mockWorkflow);

			const mockRuntime = {
				initialize: vi.fn(),
				execute: vi.fn().mockResolvedValue({
					result: { success: true, data: { processed: true } },
					steps: [
						{
							actionId: 'step1',
							status: 'success',
							duration: 100,
							output: { data: 'test' },
						},
					],
					totalDuration: 100,
				}),
			};

			vi.mocked(WorkflowRuntime).mockImplementation(() => mockRuntime as any);

			await workflowTestCommand({ live: true });

			expect(mockRuntime.execute).toHaveBeenCalled();
		});
	});

	describe('Error Handling', () => {
		it('should handle workflow validation errors', async () => {
			const { validateWorkflowProject } = await import(
				'../../utils/workflow-validation.js'
			);

			vi.mocked(validateWorkflowProject).mockRejectedValue(
				new Error('Invalid workflow')
			);

			await workflowTestCommand({ mock: true });

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should handle workflow execution errors', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig } = await import('../../lib/config.js');

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: { type: 'manual' },
			});

			// Simulate error during execution
			const originalSetTimeout = global.setTimeout;
			global.setTimeout = ((cb: any) => {
				throw new Error('Execution failed');
			}) as any;

			await workflowTestCommand({ mock: true });

			global.setTimeout = originalSetTimeout;

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should show debug stack trace when DEBUG env is set', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig } = await import('../../lib/config.js');

			process.env.DEBUG = '1';

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockRejectedValue(new Error('Parse error'));

			await workflowTestCommand({ mock: true });

			delete process.env.DEBUG;

			expect(process.exit).toHaveBeenCalledWith(1);
		});
	});

	describe('Test Results Display', () => {
		it('should display test success results', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig } = await import('../../lib/config.js');

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: { type: 'manual' },
			});

			await workflowTestCommand({ mock: true });

			// Success case should not call process.exit(1)
			expect(process.exit).not.toHaveBeenCalledWith(1);
		});

		it('should display test failure results', async () => {
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);
			const { loadProjectConfig, loadOAuthTokens } = await import(
				'../../lib/config.js'
			);
			const { loadWorkflow, WorkflowRuntime } = await import(
				'../../lib/workflow-runtime.js'
			);

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(loadProjectConfig).mockResolvedValue(null);
			vi.mocked(loadOAuthTokens).mockResolvedValue({
				gmail: { access_token: 'token' },
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(fs.readJson).mockResolvedValue({
				trigger: { type: 'manual' },
			});

			const mockWorkflow = {
				metadata: { name: 'Test Workflow' },
				integrations: [],
				execute: vi.fn(),
			};

			vi.mocked(loadWorkflow).mockResolvedValue(mockWorkflow);

			const mockRuntime = {
				initialize: vi.fn(),
				execute: vi.fn().mockResolvedValue({
					result: { success: false, error: 'Test failed' },
					steps: [
						{
							actionId: 'step1',
							status: 'error',
							duration: 50,
							error: 'Step failed',
						},
					],
					totalDuration: 50,
				}),
			};

			vi.mocked(WorkflowRuntime).mockImplementation(() => mockRuntime as any);

			await workflowTestCommand({ live: true });

			expect(process.exit).toHaveBeenCalledWith(1);
		});
	});
});
