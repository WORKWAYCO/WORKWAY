/**
 * Workflow Install Command Tests
 *
 * Tests for installing workflows from the marketplace.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';

// Mock modules before imports
vi.mock('fs-extra', () => ({
	default: {
		pathExists: vi.fn(),
		ensureDir: vi.fn(),
		writeFile: vi.fn(),
		remove: vi.fn(),
	},
}));

vi.mock('inquirer', () => ({
	default: {
		prompt: vi.fn(),
	},
}));

vi.mock('../../utils/logger.js', () => ({
	Logger: {
		header: vi.fn(),
		blank: vi.fn(),
		log: vi.fn(),
		info: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		code: vi.fn(),
		section: vi.fn(),
		listItem: vi.fn(),
		spinner: vi.fn(() => ({
			succeed: vi.fn(),
			fail: vi.fn(),
			stop: vi.fn(),
		})),
	},
}));

vi.mock('../../utils/auth-client.js', () => ({
	createAuthenticatedClient: vi.fn(),
}));

vi.mock('../../templates/workflow/basic.js', () => ({
	gitignoreTemplate: vi.fn(() => 'node_modules\n.env\n'),
	workwayConfigTemplate: vi.fn(() => '{}'),
}));

// Import after mocks
import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { createAuthenticatedClient } from '../../utils/auth-client.js';
import { workflowInstallCommand } from './install.js';

describe('workflow install command', () => {
	const mockApiClient = {
		getWorkflow: vi.fn(),
		searchWorkflows: vi.fn(),
	};

	const mockWorkflow = {
		id: 'wf_test123',
		name: 'meeting-intelligence',
		description: 'AI-powered meeting transcription',
		status: 'published',
		pricing_model: 'usage',
		base_price: 0,
		install_count: 1000,
		average_rating: 4.8,
		workflow_definition: {
			source: `export default defineWorkflow({ name: 'test' });`,
		},
		required_oauth_providers: ['zoom', 'notion'],
		tags: ['developer:alexchen', 'productivity'],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(createAuthenticatedClient).mockResolvedValue({
			apiClient: mockApiClient,
			token: 'test-token',
			apiUrl: 'https://api.workway.co',
			config: {} as any,
		});
		vi.mocked(fs.pathExists).mockResolvedValue(false);
		vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
		vi.mocked(fs.writeFile).mockResolvedValue(undefined);
		vi.mocked(fs.remove).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('workflow lookup', () => {
		it('should find workflow by ID', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('wf_test123', { force: false });

			expect(mockApiClient.getWorkflow).toHaveBeenCalledWith('wf_test123');
			expect(Logger.success).toHaveBeenCalled();
		});

		it('should find workflow by name via search', async () => {
			mockApiClient.getWorkflow.mockRejectedValue(new Error('Not found'));
			mockApiClient.searchWorkflows.mockResolvedValue([mockWorkflow]);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { force: false });

			expect(mockApiClient.searchWorkflows).toHaveBeenCalledWith('meeting-intelligence');
			expect(Logger.success).toHaveBeenCalled();
		});

		it('should handle workflow not found', async () => {
			mockApiClient.getWorkflow.mockRejectedValue(new Error('Not found'));
			mockApiClient.searchWorkflows.mockResolvedValue([]);

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('nonexistent', { force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith('Could not find: nonexistent');
			exitSpy.mockRestore();
		});
	});

	describe('interactive prompts', () => {
		it('should prompt for workflow name if not provided', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({ workflow: 'meeting-intelligence' })
				.mockResolvedValueOnce({ install: true });

			await workflowInstallCommand(undefined, { force: false });

			expect(inquirer.prompt).toHaveBeenCalledWith([
				expect.objectContaining({
					type: 'input',
					name: 'workflow',
					message: 'Workflow:',
				}),
			]);
		});

		it('should prompt for install confirmation', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { force: false });

			expect(inquirer.prompt).toHaveBeenCalledWith([
				expect.objectContaining({
					type: 'confirm',
					name: 'install',
					message: 'Install this workflow?',
				}),
			]);
		});

		it('should skip confirmation with --force flag', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);

			await workflowInstallCommand('meeting-intelligence', { force: true });

			// Should not prompt for confirmation
			expect(inquirer.prompt).not.toHaveBeenCalled();
			expect(Logger.success).toHaveBeenCalled();
		});

		it('should cancel installation when user declines', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: false });

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', {})).rejects.toThrow('process.exit');

			expect(Logger.warn).toHaveBeenCalledWith('Installation cancelled');
			exitSpy.mockRestore();
		});
	});

	describe('project creation', () => {
		it('should create project directory', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { force: false });

			expect(fs.ensureDir).toHaveBeenCalledWith(
				expect.stringContaining('meeting-intelligence')
			);
		});

		it('should write workflow source file', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { force: false });

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('workflow.ts'),
				mockWorkflow.workflow_definition.source
			);
		});

		it('should write placeholder when source not available', async () => {
			const workflowNoSource = { ...mockWorkflow, workflow_definition: {} };
			mockApiClient.getWorkflow.mockResolvedValue(workflowNoSource);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { force: false });

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('workflow.ts'),
				expect.stringContaining('Installed from:')
			);
		});

		it('should write test-data.json', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { force: false });

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('test-data.json'),
				expect.stringContaining('zoom')
			);
		});

		it('should write package.json', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { force: false });

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('package.json'),
				expect.stringContaining('"name": "meeting-intelligence"')
			);
		});

		it('should write README.md', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { force: false });

			expect(fs.writeFile).toHaveBeenCalledWith(
				expect.stringContaining('README.md'),
				expect.stringContaining('# meeting-intelligence')
			);
		});

		it('should use custom directory name with --dir option', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { dir: 'my-project', force: false });

			expect(fs.ensureDir).toHaveBeenCalledWith(
				expect.stringContaining('my-project')
			);
		});
	});

	describe('error handling', () => {
		it('should fail if directory already exists', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });
			vi.mocked(fs.pathExists).mockResolvedValue(true);

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('already exists'));
			exitSpy.mockRestore();
		});

		it('should clean up on installation failure', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });
			vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { force: true })).rejects.toThrow('process.exit');

			expect(fs.remove).toHaveBeenCalled();
			exitSpy.mockRestore();
		});

		it('should show network error when API is unreachable', async () => {
			const networkError = new Error('fetch failed');
			mockApiClient.getWorkflow.mockRejectedValue(networkError);
			mockApiClient.searchWorkflows.mockRejectedValue(networkError);

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith('Unable to connect to WORKWAY API. Please check your internet connection.');
			exitSpy.mockRestore();
		});

		it('should show network error for ECONNREFUSED', async () => {
			const networkError = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' });
			mockApiClient.getWorkflow.mockRejectedValue(networkError);

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith('Unable to connect to WORKWAY API. Please check your internet connection.');
			exitSpy.mockRestore();
		});

		it('should show network error for ETIMEDOUT', async () => {
			const networkError = Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' });
			mockApiClient.getWorkflow.mockRejectedValue(networkError);

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith('Unable to connect to WORKWAY API. Please check your internet connection.');
			exitSpy.mockRestore();
		});

		it('should show API error for unexpected errors', async () => {
			const apiError = Object.assign(new Error('Internal server error'), { status: 500 });
			mockApiClient.getWorkflow.mockRejectedValue(apiError);
			mockApiClient.searchWorkflows.mockRejectedValue(apiError);

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith('WORKWAY API error: Internal server error');
			exitSpy.mockRestore();
		});
	});

	describe('--dir option validation', () => {
		it('should reject absolute paths', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { dir: '/etc/passwd', force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid directory name'));
			exitSpy.mockRestore();
		});

		it('should reject path traversal attempts', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { dir: '../../../sensitive', force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid directory name'));
			exitSpy.mockRestore();
		});

		it('should reject paths with slashes', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { dir: 'foo/bar', force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid directory name'));
			exitSpy.mockRestore();
		});

		it('should reject paths with special characters', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit');
			});

			await expect(workflowInstallCommand('meeting-intelligence', { dir: 'my@project!', force: true })).rejects.toThrow('process.exit');

			expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid directory name'));
			exitSpy.mockRestore();
		});

		it('should accept valid directory names with hyphens', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { dir: 'my-workflow', force: true });

			expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('my-workflow'));
			expect(Logger.success).toHaveBeenCalled();
		});

		it('should accept valid directory names with underscores', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { dir: 'my_workflow', force: true });

			expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('my_workflow'));
			expect(Logger.success).toHaveBeenCalled();
		});

		it('should accept valid directory names with numbers', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { dir: 'workflow123', force: true });

			expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('workflow123'));
			expect(Logger.success).toHaveBeenCalled();
		});
	});

	describe('authentication', () => {
		it('should require authentication', async () => {
			vi.mocked(createAuthenticatedClient).mockRejectedValue(new Error('Not authenticated'));

			await expect(workflowInstallCommand('meeting-intelligence', { force: true })).rejects.toThrow('Not authenticated');
		});
	});

	describe('next steps', () => {
		it('should show OAuth connection commands for required integrations', async () => {
			mockApiClient.getWorkflow.mockResolvedValue(mockWorkflow);
			vi.mocked(inquirer.prompt).mockResolvedValue({ install: true });

			await workflowInstallCommand('meeting-intelligence', { force: false });

			expect(Logger.code).toHaveBeenCalledWith('workway oauth connect zoom');
			expect(Logger.code).toHaveBeenCalledWith('workway oauth connect notion');
		});
	});
});
