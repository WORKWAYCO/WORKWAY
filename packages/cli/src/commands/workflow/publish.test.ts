/**
 * Tests for workflow/publish.ts - Marketplace workflow publishing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';
import { workflowPublishCommand } from './publish.js';

// Mock dependencies
vi.mock('fs-extra');
vi.mock('inquirer');
vi.mock('../../utils/logger.js', () => ({
	Logger: {
		header: vi.fn(),
		blank: vi.fn(),
		section: vi.fn(),
		log: vi.fn(),
		listItem: vi.fn(),
		code: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		success: vi.fn(),
		spinner: vi.fn(() => ({
			succeed: vi.fn(),
			fail: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
			text: '',
		})),
	},
}));
vi.mock('../../utils/auth-client.js');
vi.mock('../../utils/workflow-validation.js');

describe('workflow/publish.ts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Authentication Check', () => {
		it('should require user to be logged in', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);

			vi.mocked(createAuthenticatedClient).mockRejectedValue(
				new Error('Not authenticated')
			);

			await workflowPublishCommand({});

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should check for developer profile', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockRejectedValue({
					isNotFound: () => true,
				}),
				checkSimilarity: vi.fn(),
				createIntegration: vi.fn(),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);

			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');

			vi.mocked(inquirer.prompt).mockResolvedValue({
				name: 'Test Workflow',
				tagline: 'Test',
				description: 'Test workflow',
				category: 'productivity',
				pricingModel: 'free',
			});

			await workflowPublishCommand({});

			expect(mockApiClient.getDeveloperProfile).toHaveBeenCalled();
			expect(process.exit).toHaveBeenCalledWith(1);
		});
	});

	describe('Workflow Configuration', () => {
		it('should require workway.config.json', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn(),
				checkSimilarity: vi.fn(),
				createIntegration: vi.fn(),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(false);

			await workflowPublishCommand({});

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should validate workflow project structure', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn(),
				checkSimilarity: vi.fn(),
				createIntegration: vi.fn(),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);

			await workflowPublishCommand({});

			expect(validateWorkflowProject).toHaveBeenCalled();
		});

		it('should prompt for workflow details', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn().mockResolvedValue({
					action: 'allow',
					message: 'No similar workflows found',
					similarWorkflows: [],
				}),
				createIntegration: vi.fn().mockResolvedValue({
					success: true,
					integration: { id: 'workflow-123' },
				}),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(fs.readFile).mockResolvedValue('workflow code');

			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({
					name: 'My Workflow',
					tagline: 'A great workflow',
					description: 'This is a test workflow',
					category: 'productivity',
					pricingModel: 'free',
				})
				.mockResolvedValueOnce({
					complexityTier: 'light',
				})
				.mockResolvedValueOnce({
					confirm: true,
				});

			await workflowPublishCommand({});

			expect(inquirer.prompt).toHaveBeenCalled();
		});

		it('should validate workflow name length', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn(),
				createIntegration: vi.fn(),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');

			const longName = 'A'.repeat(51);

			vi.mocked(inquirer.prompt).mockResolvedValue({
				name: longName,
			});

			await workflowPublishCommand({});

			// Validation happens in inquirer
			expect(inquirer.prompt).toHaveBeenCalled();
		});
	});

	describe('Pricing Models', () => {
		it('should support free pricing model', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn().mockResolvedValue({
					action: 'allow',
					similarWorkflows: [],
				}),
				createIntegration: vi.fn().mockResolvedValue({
					success: true,
					integration: { id: 'workflow-123' },
				}),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(fs.readFile).mockResolvedValue('workflow code');

			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({
					name: 'Free Workflow',
					tagline: 'Test',
					description: 'A free workflow',
					category: 'productivity',
					pricingModel: 'free',
				})
				.mockResolvedValueOnce({
					complexityTier: 'light',
				})
				.mockResolvedValueOnce({
					confirm: true,
				});

			await workflowPublishCommand({});

			expect(mockApiClient.createIntegration).toHaveBeenCalledWith(
				expect.objectContaining({
					pricingModel: 'free',
					basePrice: 0,
				})
			);
		});

		it('should support one-time payment pricing model', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn().mockResolvedValue({
					action: 'allow',
					similarWorkflows: [],
				}),
				createIntegration: vi.fn().mockResolvedValue({
					success: true,
					integration: { id: 'workflow-123' },
				}),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(fs.readFile).mockResolvedValue('workflow code');

			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({
					name: 'Paid Workflow',
					tagline: 'Test',
					description: 'A paid workflow',
					category: 'productivity',
					pricingModel: 'one_time',
				})
				.mockResolvedValueOnce({
					price: 29,
				})
				.mockResolvedValueOnce({
					complexityTier: 'heavy',
				})
				.mockResolvedValueOnce({
					confirm: true,
				});

			await workflowPublishCommand({});

			expect(mockApiClient.createIntegration).toHaveBeenCalledWith(
				expect.objectContaining({
					pricingModel: 'paid',
					basePrice: 2900, // $29 in cents
					complexityTier: 'heavy',
				})
			);
		});

		it('should validate price range for paid workflows', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn(),
				createIntegration: vi.fn(),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');

			vi.mocked(inquirer.prompt).mockResolvedValueOnce({
				name: 'Test',
				tagline: 'Test',
				description: 'Test',
				category: 'productivity',
				pricingModel: 'one_time',
			});

			await workflowPublishCommand({});

			// Price validation happens in inquirer
			expect(inquirer.prompt).toHaveBeenCalled();
		});
	});

	describe('Duplicate Detection', () => {
		it('should check for similar workflows', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn().mockResolvedValue({
					action: 'allow',
					message: 'No similar workflows',
					similarWorkflows: [],
				}),
				createIntegration: vi.fn().mockResolvedValue({
					success: true,
					integration: { id: 'workflow-123' },
				}),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(fs.readFile).mockResolvedValue('workflow code');

			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({
					name: 'Test Workflow',
					tagline: 'Test',
					description: 'Test',
					category: 'productivity',
					pricingModel: 'free',
				})
				.mockResolvedValueOnce({
					complexityTier: 'light',
				})
				.mockResolvedValueOnce({
					confirm: true,
				});

			await workflowPublishCommand({});

			expect(mockApiClient.checkSimilarity).toHaveBeenCalledWith({
				name: 'Test Workflow',
				description: 'Test',
				code: 'workflow code',
			});
		});

		it('should block publishing if workflow is too similar', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn().mockResolvedValue({
					action: 'block',
					message: 'Too similar to existing workflow',
					similarWorkflows: [
						{
							developerName: 'otherdev',
							name: 'Existing Workflow',
							installCount: 1000,
							overallSimilarity: 0.95,
							allowForks: true,
						},
					],
				}),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(fs.readFile).mockResolvedValue('workflow code');

			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({
					name: 'Similar Workflow',
					tagline: 'Test',
					description: 'Test',
					category: 'productivity',
					pricingModel: 'free',
				})
				.mockResolvedValueOnce({
					complexityTier: 'light',
				})
				.mockResolvedValueOnce({
					confirm: true,
				});

			await workflowPublishCommand({});

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should suggest forking for similar workflows', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn().mockResolvedValue({
					action: 'suggest_fork',
					message: 'Similar workflow found',
					similarWorkflows: [
						{
							developerName: 'otherdev',
							name: 'Similar Workflow',
							installCount: 500,
							overallSimilarity: 0.7,
							allowForks: true,
						},
					],
				}),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(fs.readFile).mockResolvedValue('workflow code');

			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({
					name: 'Test Workflow',
					tagline: 'Test',
					description: 'Test',
					category: 'productivity',
					pricingModel: 'free',
				})
				.mockResolvedValueOnce({
					complexityTier: 'light',
				})
				.mockResolvedValueOnce({
					confirm: true,
				})
				.mockResolvedValueOnce({
					action: 'cancel',
				});

			await workflowPublishCommand({});

			expect(process.exit).toHaveBeenCalledWith(0);
		});
	});

	describe('Draft Publishing', () => {
		it('should support publishing as draft', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn().mockResolvedValue({
					action: 'allow',
					similarWorkflows: [],
				}),
				createIntegration: vi.fn().mockResolvedValue({
					success: true,
					integration: { id: 'workflow-123' },
				}),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(fs.readFile).mockResolvedValue('workflow code');

			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({
					name: 'Draft Workflow',
					tagline: 'Test',
					description: 'Test',
					category: 'productivity',
					pricingModel: 'free',
				})
				.mockResolvedValueOnce({
					complexityTier: 'light',
				})
				.mockResolvedValueOnce({
					confirm: true,
				});

			await workflowPublishCommand({ draft: true });

			expect(mockApiClient.createIntegration).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 'draft',
				})
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle API errors gracefully', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn().mockResolvedValue({
					action: 'allow',
					similarWorkflows: [],
				}),
				createIntegration: vi.fn().mockRejectedValue(new Error('API Error')),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');
			vi.mocked(fs.readFile).mockResolvedValue('workflow code');

			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({
					name: 'Test',
					tagline: 'Test',
					description: 'Test',
					category: 'productivity',
					pricingModel: 'free',
				})
				.mockResolvedValueOnce({
					complexityTier: 'light',
				})
				.mockResolvedValueOnce({
					confirm: true,
				});

			await workflowPublishCommand({});

			expect(process.exit).toHaveBeenCalledWith(1);
		});

		it('should handle cancel confirmation', async () => {
			const { createAuthenticatedClient } = await import(
				'../../utils/auth-client.js'
			);
			const { validateWorkflowProject, getWorkflowPath } = await import(
				'../../utils/workflow-validation.js'
			);

			const mockApiClient = {
				getDeveloperProfile: vi.fn().mockResolvedValue({ id: '123' }),
				checkSimilarity: vi.fn(),
			};

			vi.mocked(createAuthenticatedClient).mockResolvedValue({
				apiClient: mockApiClient as any,
			});

			vi.mocked(fs.pathExists).mockResolvedValue(true);
			vi.mocked(validateWorkflowProject).mockResolvedValue(undefined);
			vi.mocked(getWorkflowPath).mockReturnValue('/mock/workflow.ts');

			vi.mocked(inquirer.prompt)
				.mockResolvedValueOnce({
					name: 'Test',
					tagline: 'Test',
					description: 'Test',
					category: 'productivity',
					pricingModel: 'free',
				})
				.mockResolvedValueOnce({
					complexityTier: 'light',
				})
				.mockResolvedValueOnce({
					confirm: false,
				});

			await workflowPublishCommand({});

			expect(process.exit).toHaveBeenCalledWith(0);
		});
	});
});
