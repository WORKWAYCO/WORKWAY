/**
 * Workflow Install Command
 *
 * Installs a workflow from the WORKWAY marketplace.
 * Downloads source files, sets up project structure, and configures test data.
 *
 * Zuhandenheit: The marketplace recedes; your workflow appears ready-to-use.
 *
 * @example
 * ```bash
 * workway workflow install meeting-intelligence
 * workway workflow install alexchen/meeting-intelligence
 * workway workflow install wf_abc123
 * ```
 */

import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../../utils/logger.js';
import { createAuthenticatedClient } from '../../utils/auth-client.js';
import { gitignoreTemplate, workwayConfigTemplate } from '../../templates/workflow/basic.js';

interface InstallOptions {
	/** Directory name override */
	dir?: string;
	/** Skip confirmation prompt */
	force?: boolean;
}

interface WorkflowDetails {
	id: string;
	name: string;
	slug: string;
	description: string;
	developer: {
		id: string;
		name: string;
		verified: boolean;
	};
	category: string;
	version: string;
	price: {
		type: 'free' | 'paid' | 'usage';
		amount?: number;
		currency?: string;
	};
	integrations: string[];
	source?: string;
	installCount?: number;
	rating?: number;
}

/**
 * Format price display
 */
function formatPrice(price: WorkflowDetails['price']): string {
	switch (price.type) {
		case 'free':
			return 'Free';
		case 'paid':
			return `$${price.amount}/${price.currency === 'USD' ? 'mo' : price.currency}`;
		case 'usage':
			return 'Usage-based pricing';
		default:
			return 'Unknown';
	}
}

/**
 * Generate test data template based on integrations
 */
function generateTestDataTemplate(integrations: string[]): string {
	const testData: Record<string, unknown> = {
		// Add integration-specific test data hints
	};

	for (const integration of integrations) {
		switch (integration.toLowerCase()) {
			case 'zoom':
				testData.zoom = {
					meetingId: 'test-meeting-id',
					transcript: 'Sample transcript text...',
				};
				break;
			case 'notion':
				testData.notion = {
					databaseId: 'your-database-id',
					pageId: 'your-page-id',
				};
				break;
			case 'slack':
				testData.slack = {
					channelId: 'C123456',
					message: 'Test message',
				};
				break;
			case 'gmail':
			case 'google-mail':
				testData.email = {
					to: 'test@example.com',
					subject: 'Test Email',
					body: 'Test email body',
				};
				break;
			case 'github':
				testData.github = {
					repo: 'owner/repo',
					issueNumber: 1,
				};
				break;
			default:
				testData[integration] = {
					// Add your test data here
				};
		}
	}

	return JSON.stringify(testData, null, 2);
}

/**
 * Generate package.json for installed workflow
 */
function generatePackageJson(workflow: WorkflowDetails): string {
	const packageJson = {
		name: workflow.slug,
		version: workflow.version || '1.0.0',
		description: workflow.description,
		type: 'module',
		main: 'workflow.ts',
		scripts: {
			test: 'workway workflow test --mock',
			'test:live': 'workway workflow test --live',
			build: 'workway workflow build',
			dev: 'workway workflow dev',
		},
		dependencies: {
			'@workwayco/sdk': '^0.1.0',
		},
		devDependencies: {
			typescript: '^5.0.0',
		},
		keywords: ['workway', 'workflow', ...workflow.integrations],
		workway: {
			installedFrom: `${workflow.developer.name}/${workflow.name}`,
			installedVersion: workflow.version,
			installedAt: new Date().toISOString(),
		},
	};

	return JSON.stringify(packageJson, null, 2);
}

/**
 * Integration setup documentation URLs
 */
const INTEGRATION_DOCS: Record<string, { name: string; url: string }> = {
	zoom: { name: 'Zoom', url: 'https://workway.co/docs/integrations/zoom' },
	notion: { name: 'Notion', url: 'https://workway.co/docs/integrations/notion' },
	slack: { name: 'Slack', url: 'https://workway.co/docs/integrations/slack' },
	gmail: { name: 'Gmail', url: 'https://workway.co/docs/integrations/gmail' },
	stripe: { name: 'Stripe', url: 'https://workway.co/docs/integrations/stripe' },
	linear: { name: 'Linear', url: 'https://workway.co/docs/integrations/linear' },
	github: { name: 'GitHub', url: 'https://workway.co/docs/integrations/github' },
	google: { name: 'Google', url: 'https://workway.co/docs/integrations/google' },
	dropbox: { name: 'Dropbox', url: 'https://workway.co/docs/integrations/dropbox' },
	airtable: { name: 'Airtable', url: 'https://workway.co/docs/integrations/airtable' },
};

/**
 * Generate integration setup links for README
 */
function generateIntegrationLinks(integrations: string[]): string {
	if (integrations.length === 0) return '';

	const links = integrations.map((integration) => {
		const doc = INTEGRATION_DOCS[integration.toLowerCase()];
		if (doc) {
			return `- [${doc.name} OAuth Setup](${doc.url})`;
		}
		// Fallback for unknown integrations
		const name = integration.charAt(0).toUpperCase() + integration.slice(1);
		return `- [${name} OAuth Setup](https://workway.co/docs/integrations/${integration.toLowerCase()})`;
	});

	return `
## Integration Setup

Before running this workflow, you'll need to configure OAuth for each integration:

${links.join('\n')}

Each link provides step-by-step instructions for setting up the OAuth connection.
`;
}

/**
 * Generate README for installed workflow
 */
function generateReadme(workflow: WorkflowDetails): string {
	const integrationsList = workflow.integrations.map((i) => `- ${i}`).join('\n');
	const integrationLinks = generateIntegrationLinks(workflow.integrations);

	return `# ${workflow.name}

${workflow.description}

> Installed from [${workflow.developer.name}/${workflow.name}](https://workway.co/marketplace/${workflow.developer.name}/${workflow.name})

## Integrations

${integrationsList}
${integrationLinks}
## Getting Started

### 1. Configure OAuth Connections

Before running this workflow, connect the required OAuth accounts:

\`\`\`bash
${workflow.integrations.map((i) => `workway oauth connect ${i}`).join('\n')}
\`\`\`

### 2. Test the Workflow

\`\`\`bash
# Mock mode (no real API calls)
npm test

# Live mode (uses real OAuth connections)
npm run test:live
\`\`\`

### 3. Customize

Edit \`workflow.ts\` to customize the workflow behavior.
Edit \`test-data.json\` to add your test data.

## Development

\`\`\`bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build
\`\`\`

## Support

- Original developer: ${workflow.developer.name}${workflow.developer.verified ? ' (verified)' : ''}
- Category: ${workflow.category}
- Version: ${workflow.version}
`;
}

/**
 * Map WorkflowListing to WorkflowDetails
 */
function mapWorkflowToDetails(workflow: {
	id: string;
	name: string;
	description?: string | null;
	status?: string;
	pricing_model?: string;
	base_price?: number;
	install_count?: number;
	average_rating?: number;
	workflow_definition?: any;
	required_oauth_providers?: string[];
	tags?: string[];
}): WorkflowDetails {
	// Extract developer name from tags or use default
	const developerTag = workflow.tags?.find((t) => t.startsWith('developer:'));
	const developerName = developerTag ? developerTag.replace('developer:', '') : 'workway';

	return {
		id: workflow.id,
		name: workflow.name,
		slug: workflow.name.toLowerCase().replace(/\s+/g, '-'),
		description: workflow.description || '',
		developer: {
			id: 'unknown',
			name: developerName,
			verified: true, // Assume verified for marketplace listings
		},
		category: workflow.tags?.find((t) => !t.startsWith('developer:')) || 'productivity',
		version: '1.0.0',
		price: {
			type: (workflow.pricing_model as 'free' | 'paid' | 'usage') || 'usage',
			amount: workflow.base_price,
			currency: 'USD',
		},
		integrations: workflow.required_oauth_providers || [],
		source: workflow.workflow_definition?.source,
		installCount: workflow.install_count,
		rating: workflow.average_rating,
	};
}

/**
 * Validate that a directory name is safe (no path traversal, simple name only)
 */
function isValidDirectoryName(dir: string): boolean {
	// Must not start with / or \
	if (dir.startsWith('/') || dir.startsWith('\\')) return false;
	// Must not contain path traversal
	if (dir.includes('..')) return false;
	// Must not contain path separators (enforce single directory name)
	if (dir.includes('/') || dir.includes('\\')) return false;
	// Only allow alphanumeric, hyphens, underscores
	return /^[a-zA-Z0-9_-]+$/.test(dir);
}

/**
 * Check if an error is a network/connectivity error
 */
function isNetworkError(error: any): boolean {
	if (!error) return false;

	// Common network error codes and messages
	const networkErrorPatterns = [
		'ENOTFOUND',
		'ECONNREFUSED',
		'ECONNRESET',
		'ETIMEDOUT',
		'ENETUNREACH',
		'EAI_AGAIN',
		'fetch failed',
		'network error',
		'Failed to fetch',
		'Network request failed',
	];

	const errorMessage = (error.message || '').toLowerCase();
	const errorCode = error.code || '';

	return networkErrorPatterns.some(pattern =>
		errorMessage.includes(pattern.toLowerCase()) || errorCode === pattern
	);
}

/**
 * Check if an error is a "not found" error (404)
 */
function isNotFoundError(error: any): boolean {
	if (!error) return false;

	// Check for HTTP 404 status
	if (error.status === 404 || error.statusCode === 404) return true;

	// Check for "not found" in message
	const errorMessage = (error.message || '').toLowerCase();
	return errorMessage.includes('not found') || errorMessage.includes('404');
}

/**
 * Fetch workflow from marketplace API
 */
async function fetchWorkflowDetails(
	identifier: string,
	apiClient: { getWorkflow: (id: string) => Promise<any>; searchWorkflows: (query: string, filters?: any) => Promise<any[]> }
): Promise<WorkflowDetails | null> {
	let lastError: any = null;

	try {
		// Try to get workflow by ID first
		const workflow = await apiClient.getWorkflow(identifier);
		if (workflow) {
			return mapWorkflowToDetails(workflow);
		}
	} catch (error: any) {
		// If it's a network error, throw immediately with a clear message
		if (isNetworkError(error)) {
			throw new Error('Unable to connect to WORKWAY API. Please check your internet connection.');
		}
		// If it's not a "not found" error, it's an unexpected API error
		if (!isNotFoundError(error)) {
			lastError = error;
		}
		// Otherwise, it's a "not found" - try search
	}

	// Try searching by name
	try {
		const results = await apiClient.searchWorkflows(identifier);
		if (results && results.length > 0) {
			return mapWorkflowToDetails(results[0]);
		}
	} catch (error: any) {
		// If it's a network error, throw immediately with a clear message
		if (isNetworkError(error)) {
			throw new Error('Unable to connect to WORKWAY API. Please check your internet connection.');
		}
		// If it's not a "not found" error, it's an unexpected API error
		if (!isNotFoundError(error)) {
			lastError = error;
		}
		// Otherwise, it's a "not found" - return null below
	}

	// If we had an unexpected API error (not network, not 404), throw it
	if (lastError) {
		throw new Error(`WORKWAY API error: ${lastError.message || 'Unknown error'}`);
	}

	return null;
}

/**
 * Main install command
 */
export async function workflowInstallCommand(
	workflowIdentifier?: string,
	options: InstallOptions = {}
): Promise<void> {
	Logger.header('Install Workflow from Marketplace');
	Logger.blank();

	// Get workflow identifier if not provided
	let targetId = workflowIdentifier;
	if (!targetId) {
		Logger.info('Install a workflow from the WORKWAY marketplace.');
		Logger.blank();
		Logger.log('Enter a workflow identifier:');
		Logger.log('  - Name: meeting-intelligence');
		Logger.log('  - Developer/name: alexchen/meeting-intelligence');
		Logger.log('  - ID: wf_abc123');
		Logger.blank();

		const answer = await inquirer.prompt([
			{
				type: 'input',
				name: 'workflow',
				message: 'Workflow:',
				validate: (input: string) => input.length > 0 || 'Please enter a workflow name or ID',
			},
		]);
		targetId = answer.workflow;
	}

	// Get authenticated client (DRY: shared utility)
	const { apiClient } = await createAuthenticatedClient({
		errorMessage: 'You must be logged in to install workflows',
		hint: 'Run: workway login',
	});

	// Fetch workflow details
	const spinner = Logger.spinner('Fetching workflow from marketplace...');

	let workflow: WorkflowDetails | null;
	try {
		workflow = await fetchWorkflowDetails(targetId!, apiClient);
	} catch (error: any) {
		spinner.fail('Failed to fetch workflow');
		Logger.blank();
		Logger.error(error.message);
		process.exit(1);
	}

	if (!workflow) {
		spinner.fail('Workflow not found');
		Logger.blank();
		Logger.error(`Could not find: ${targetId}`);
		Logger.blank();
		Logger.log('Try searching the marketplace:');
		Logger.code('workway marketplace search <query>');
		process.exit(1);
	}

	spinner.succeed(`Found: ${workflow.developer.name}/${workflow.name}`);
	Logger.blank();

	// Display workflow details
	const verifiedBadge = workflow.developer.verified ? ' (verified)' : '';
	Logger.section('Workflow Details');
	Logger.listItem(`Name: ${workflow.name}`);
	Logger.listItem(`Developer: ${workflow.developer.name}${verifiedBadge}`);
	Logger.listItem(`Category: ${workflow.category}`);
	Logger.listItem(`Price: ${formatPrice(workflow.price)}`);
	Logger.listItem(`Version: ${workflow.version}`);
	if (workflow.installCount) {
		Logger.listItem(`Installs: ${workflow.installCount.toLocaleString()}`);
	}
	if (workflow.rating) {
		Logger.listItem(`Rating: ${workflow.rating.toFixed(1)}/5.0`);
	}
	Logger.blank();

	Logger.log(workflow.description);
	Logger.blank();

	// Show integrations
	if (workflow.integrations.length > 0) {
		Logger.section('Required Integrations');
		for (const integration of workflow.integrations) {
			Logger.listItem(integration);
		}
		Logger.blank();
	}

	// Confirm installation
	if (!options.force) {
		const confirm = await inquirer.prompt([
			{
				type: 'confirm',
				name: 'install',
				message: 'Install this workflow?',
				default: true,
			},
		]);

		if (!confirm.install) {
			Logger.warn('Installation cancelled');
			process.exit(0);
		}
	}

	// Validate --dir option if provided
	if (options.dir && !isValidDirectoryName(options.dir)) {
		Logger.error('Invalid directory name. Use a simple name like \'my-workflow\' (letters, numbers, hyphens, underscores only).');
		process.exit(1);
	}

	// Determine project directory
	const projectName = options.dir || workflow.slug;
	const projectPath = path.join(process.cwd(), projectName);

	// Check if directory exists
	if (await fs.pathExists(projectPath)) {
		Logger.error(`Directory "${projectName}" already exists`);
		Logger.blank();
		Logger.log('Choose a different name with --dir option or remove the existing directory');
		process.exit(1);
	}

	// Create project
	const installSpinner = Logger.spinner('Installing workflow...');

	try {
		// Create directory
		await fs.ensureDir(projectPath);

		// Write workflow source
		if (workflow.source) {
			await fs.writeFile(path.join(projectPath, 'workflow.ts'), workflow.source);
		} else {
			// Create placeholder if source not available
			const placeholder = `/**
 * ${workflow.name}
 *
 * Installed from: ${workflow.developer.name}/${workflow.name}
 *
 * The source code for this workflow is not publicly available.
 * Please use the web dashboard to configure and run this workflow.
 */

import { defineWorkflow } from '@workwayco/sdk';

export default defineWorkflow({
  name: '${workflow.name}',
  description: '${workflow.description}',

  async execute(context) {
    // Workflow implementation is managed by WORKWAY
    throw new Error('This workflow runs on WORKWAY servers. Use the dashboard to configure it.');
  }
});
`;
			await fs.writeFile(path.join(projectPath, 'workflow.ts'), placeholder);
		}

		// Write test data
		const testData = generateTestDataTemplate(workflow.integrations);
		await fs.writeFile(path.join(projectPath, 'test-data.json'), testData);

		// Write package.json
		const packageJson = generatePackageJson(workflow);
		await fs.writeFile(path.join(projectPath, 'package.json'), packageJson);

		// Write README
		const readme = generateReadme(workflow);
		await fs.writeFile(path.join(projectPath, 'README.md'), readme);

		// Write .gitignore
		const gitignore = gitignoreTemplate();
		await fs.writeFile(path.join(projectPath, '.gitignore'), gitignore);

		// Write workway.config.json
		const config = workwayConfigTemplate();
		await fs.writeFile(path.join(projectPath, 'workway.config.json'), config);

		installSpinner.succeed('Workflow installed successfully!');

		// Success message
		Logger.blank();
		Logger.success(`Installed "${workflow.name}" to ./${projectName}/`);
		Logger.blank();

		Logger.section('Next Steps');

		Logger.log('1. Navigate to your project:');
		Logger.code(`cd ${projectName}`);

		Logger.log('2. Install dependencies:');
		Logger.code('npm install');

		if (workflow.integrations.length > 0) {
			Logger.log('3. Connect required OAuth accounts:');
			for (const integration of workflow.integrations) {
				Logger.code(`workway oauth connect ${integration}`);
			}
		}

		Logger.log(`${workflow.integrations.length > 0 ? '4' : '3'}. Test your workflow:`);
		Logger.code('npm test');

		Logger.blank();
		Logger.info('Documentation: https://docs.workway.co/workflows');
	} catch (error: any) {
		installSpinner.fail('Installation failed');
		Logger.error(error.message);

		// Cleanup on failure
		try {
			await fs.remove(projectPath);
		} catch {}

		process.exit(1);
	}
}

export default workflowInstallCommand;
