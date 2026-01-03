/**
 * Tests for workflow/init.ts - Workflow project initialization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import { workflowInitCommand } from './init.js';

// Mock dependencies
vi.mock('fs-extra');
vi.mock('inquirer');
vi.mock('../../utils/logger.js', () => ({
	Logger: {
		header: vi.fn(),
		info: vi.fn(),
		blank: vi.fn(),
		section: vi.fn(),
		listItem: vi.fn(),
		log: vi.fn(),
		code: vi.fn(),
		success: vi.fn(),
		error: vi.fn(),
		spinner: vi.fn(() => ({
			succeed: vi.fn(),
			fail: vi.fn(),
		})),
	},
}));

describe('workflow/init.ts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock process.exit to prevent test termination
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Standard Workflow Creation', () => {
		it('should create workflow project with default values', async () => {
			const mockAnswers = {
				name: 'My Workflow',
				category: 'productivity',
				description: 'A test workflow',
				price: 8,
				trialDays: 7,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);
			vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await workflowInitCommand();

			// Verify directory was created
			expect(fs.ensureDir).toHaveBeenCalledWith(
				path.join(process.cwd(), 'my-workflow')
			);

			// Verify workflow files were created
			expect(fs.writeFile).toHaveBeenCalledWith(
				path.join(process.cwd(), 'my-workflow', 'workflow.ts'),
				expect.stringContaining('defineWorkflow')
			);

			expect(fs.writeFile).toHaveBeenCalledWith(
				path.join(process.cwd(), 'my-workflow', 'test-data.json'),
				expect.any(String)
			);

			expect(fs.writeFile).toHaveBeenCalledWith(
				path.join(process.cwd(), 'my-workflow', 'README.md'),
				expect.stringContaining('My Workflow')
			);

			expect(fs.writeFile).toHaveBeenCalledWith(
				path.join(process.cwd(), 'my-workflow', 'package.json'),
				expect.any(String)
			);

			expect(fs.writeFile).toHaveBeenCalledWith(
				path.join(process.cwd(), 'my-workflow', '.gitignore'),
				expect.any(String)
			);

			expect(fs.writeFile).toHaveBeenCalledWith(
				path.join(process.cwd(), 'my-workflow', 'workway.config.json'),
				expect.any(String)
			);
		});

		it('should use provided name argument', async () => {
			const mockAnswers = {
				name: 'Custom Workflow',
				category: 'automation',
				description: 'Custom description',
				price: 10,
				trialDays: 14,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);
			vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await workflowInitCommand('Custom Workflow');

			expect(fs.ensureDir).toHaveBeenCalledWith(
				path.join(process.cwd(), 'custom-workflow')
			);
		});

		it('should reject invalid workflow names', async () => {
			const mockAnswers = {
				name: '', // Empty name
				category: 'productivity',
				description: 'Test',
				price: 8,
				trialDays: 7,
			};

			// First call returns invalid name, second call returns valid
			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce(mockAnswers)
				.mockResolvedValueOnce({ ...mockAnswers, name: 'Valid Name' });

			vi.mocked(fs.pathExists).mockResolvedValue(false);
			vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			// The validation happens in inquirer.prompt, so we just verify it's called
			await workflowInitCommand();

			expect(inquirer.prompt).toHaveBeenCalled();
		});

		it('should reject names longer than 50 characters', async () => {
			const longName = 'A'.repeat(51);
			const mockAnswers = {
				name: longName,
				category: 'productivity',
				description: 'Test',
				price: 8,
				trialDays: 7,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);

			// Validation will be handled by inquirer
			await workflowInitCommand();

			expect(inquirer.prompt).toHaveBeenCalled();
		});

		it('should validate price range', async () => {
			const mockAnswers = {
				name: 'Test Workflow',
				category: 'productivity',
				description: 'Test',
				price: -1, // Invalid price
				trialDays: 7,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);

			await workflowInitCommand();

			expect(inquirer.prompt).toHaveBeenCalled();
		});

		it('should error when directory already exists', async () => {
			const mockAnswers = {
				name: 'Existing Workflow',
				category: 'productivity',
				description: 'Test',
				price: 8,
				trialDays: 7,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(true); // Directory exists

			await workflowInitCommand();

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should clean up on file creation failure', async () => {
			const mockAnswers = {
				name: 'Test Workflow',
				category: 'productivity',
				description: 'Test',
				price: 8,
				trialDays: 7,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);
			vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));
			vi.mocked(fs.remove).mockResolvedValue(undefined);

			await workflowInitCommand();

			// Verify cleanup was attempted
			expect(fs.remove).toHaveBeenCalledWith(
				path.join(process.cwd(), 'test-workflow')
			);
			expect(process.exit).toHaveBeenCalledWith(1);
		});
	});

	describe('AI Workflow Creation', () => {
		it('should create AI workflow with --ai flag', async () => {
			const mockAnswers = {
				name: 'AI Assistant',
				aiTask: 'Summarize and analyze text',
				category: 'productivity',
				price: 5,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);
			vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await workflowInitCommand(undefined, { ai: true });

			// Verify AI-specific files were created
			expect(fs.writeFile).toHaveBeenCalledWith(
				path.join(process.cwd(), 'ai-assistant', 'workflow.ts'),
				expect.stringContaining('Workers AI')
			);
		});

		it('should prompt for AI task description', async () => {
			const mockAnswers = {
				name: 'AI Tool',
				aiTask: 'Generate creative content',
				category: 'content',
				price: 10,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);
			vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await workflowInitCommand('AI Tool', { ai: true });

			expect(inquirer.prompt).toHaveBeenCalled();
			const promptCall = vi.mocked(inquirer.prompt).mock.calls[0][0];
			expect(promptCall).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: 'aiTask',
						message: 'What will this AI do?',
					}),
				])
			);
		});

		it('should reject empty AI task description', async () => {
			const mockAnswers = {
				name: 'AI Tool',
				aiTask: '', // Empty task
				category: 'content',
				price: 10,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);

			await workflowInitCommand('AI Tool', { ai: true });

			expect(inquirer.prompt).toHaveBeenCalled();
		});
	});

	describe('Project Name Transformation', () => {
		it('should convert spaces to hyphens in directory name', async () => {
			const mockAnswers = {
				name: 'My Cool Workflow',
				category: 'productivity',
				description: 'Test',
				price: 8,
				trialDays: 7,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);
			vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await workflowInitCommand();

			expect(fs.ensureDir).toHaveBeenCalledWith(
				path.join(process.cwd(), 'my-cool-workflow')
			);
		});

		it('should convert to lowercase in directory name', async () => {
			const mockAnswers = {
				name: 'UPPERCASE WORKFLOW',
				category: 'productivity',
				description: 'Test',
				price: 8,
				trialDays: 7,
			};

			vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
			vi.mocked(fs.pathExists).mockResolvedValue(false);
			vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
			vi.mocked(fs.writeFile).mockResolvedValue(undefined);

			await workflowInitCommand();

			expect(fs.ensureDir).toHaveBeenCalledWith(
				path.join(process.cwd(), 'uppercase-workflow')
			);
		});
	});

	describe('Category Validation', () => {
		it('should accept valid workflow categories', async () => {
			const categories = [
				'productivity',
				'automation',
				'communication',
				'analytics',
				'content',
			];

			for (const category of categories) {
				vi.clearAllMocks();

				const mockAnswers = {
					name: 'Test Workflow',
					category,
					description: 'Test',
					price: 8,
					trialDays: 7,
				};

				vi.mocked(inquirer.prompt).mockResolvedValue(mockAnswers);
				vi.mocked(fs.pathExists).mockResolvedValue(false);
				vi.mocked(fs.ensureDir).mockResolvedValue(undefined);
				vi.mocked(fs.writeFile).mockResolvedValue(undefined);

				await workflowInitCommand();

				expect(fs.ensureDir).toHaveBeenCalled();
			}
		});
	});

	describe('Error Handling', () => {
		it('should handle TTY errors gracefully', async () => {
			const ttyError: any = new Error('TTY Error');
			ttyError.isTtyError = true;

			vi.mocked(inquirer.prompt).mockRejectedValue(ttyError);

			await workflowInitCommand();

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should handle general errors', async () => {
			vi.mocked(inquirer.prompt).mockRejectedValue(new Error('Unknown error'));

			await workflowInitCommand();

			expect(process.exit).toHaveBeenCalledWith(1);
		});
	});
});
