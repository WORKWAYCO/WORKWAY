/**
 * Init Command
 *
 * Initialize learning environment with optional full scaffolding.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { loadEthos, formatEthosForDisplay } from '../../ethos/defaults.js';
import { isAuthenticated, getCurrentUser } from '../../api/auth.js';

interface InitOptions {
	full?: boolean;
}

/**
 * Generate CLAUDE.md content
 */
function generateClaudeMd(projectName: string): string {
	const ethos = loadEthos();

	return `# ${projectName}

## Overview

WORKWAY workflow project.

## Workflow Principles

${ethos.principles.map((p) => `### ${p.category.charAt(0).toUpperCase() + p.category.slice(1)}\n\n${p.content}\n\n> ${p.context || ''}`).join('\n\n')}

## Patterns

- Use \`defineWorkflow()\` for all workflows
- Follow BaseAPIClient pattern for integrations
- Sensible defaults over configuration
- Graceful degradation on errors

## Commands

\`\`\`bash
pnpm dev        # Start development
pnpm build      # Build workflow
pnpm deploy     # Deploy to Cloudflare
\`\`\`
`;
}

/**
 * Generate workflow patterns rules
 */
function generateWorkwayPatterns(): string {
	return `# WORKWAY Patterns

## Workflow Structure

\`\`\`typescript
import { defineWorkflow } from '@workwayco/sdk';

export default defineWorkflow({
  id: 'my-workflow',
  name: 'My Workflow',
  description: 'What this workflow achieves (outcome, not mechanism)',

  integrations: ['gmail', 'notion'],

  triggers: {
    type: 'webhook',
    events: ['email.received']
  },

  configSchema: {
    inputs: [
      {
        id: 'label',
        type: 'text',
        label: 'Gmail label to watch',
        default: 'INBOX'
      }
    ]
  },

  async execute({ config, integrations, context }) {
    // Implementation
  }
});
\`\`\`

## Zuhandenheit Checklist

Before committing, verify:
- [ ] Can you describe this workflow without mentioning technology?
- [ ] Does it have sensible defaults?
- [ ] Will users forget it exists when it works?
- [ ] Does it fail gracefully?

## Naming

- **Good**: "After Meeting Follow-up"
- **Bad**: "Zoom-to-Notion API Sync"

The name should describe the outcome, not the mechanism.
`;
}

export async function initCommand(options: InitOptions): Promise<void> {
	const spinner = ora('Initializing WORKWAY learning environment...').start();

	try {
		// Check authentication status
		const authenticated = isAuthenticated();
		const user = getCurrentUser();

		// Initialize ethos (creates defaults if not exists)
		const ethos = loadEthos();
		spinner.succeed('Learning environment initialized');

		console.log('');
		console.log(chalk.bold('WORKWAY Learn'));
		console.log(chalk.dim('─'.repeat(40)));
		console.log('');

		if (authenticated && user) {
			console.log(chalk.green('✓'), 'Authenticated as', chalk.cyan(user.email));
		} else {
			console.log(chalk.yellow('○'), 'Not authenticated');
			console.log(chalk.dim('  Run in Claude Code: use learn_authenticate tool'));
		}

		console.log(chalk.green('✓'), 'Ethos initialized with', ethos.principles.length, 'principles');

		if (options.full) {
			spinner.start('Creating project scaffolding...');

			const cwd = process.cwd();
			const projectName = cwd.split('/').pop() || 'my-workflow';

			// Create .claude directory
			const claudeDir = join(cwd, '.claude');
			const rulesDir = join(claudeDir, 'rules');

			if (!existsSync(rulesDir)) {
				mkdirSync(rulesDir, { recursive: true });
			}

			// Create CLAUDE.md
			const claudeMdPath = join(cwd, 'CLAUDE.md');
			if (!existsSync(claudeMdPath)) {
				writeFileSync(claudeMdPath, generateClaudeMd(projectName), 'utf-8');
				console.log(chalk.green('✓'), 'Created CLAUDE.md');
			} else {
				console.log(chalk.yellow('○'), 'CLAUDE.md already exists');
			}

			// Create rules
			const patternsPath = join(rulesDir, 'workway-patterns.md');
			if (!existsSync(patternsPath)) {
				writeFileSync(patternsPath, generateWorkwayPatterns(), 'utf-8');
				console.log(chalk.green('✓'), 'Created .claude/rules/workway-patterns.md');
			} else {
				console.log(chalk.yellow('○'), 'workway-patterns.md already exists');
			}

			spinner.succeed('Project scaffolding complete');
		}

		console.log('');
		console.log(chalk.bold('Next Steps'));
		console.log(chalk.dim('─'.repeat(40)));

		if (!authenticated) {
			console.log('1.', chalk.cyan('Authenticate'), '- Use learn_authenticate in Claude Code');
			console.log('2.', chalk.cyan('Start learning'), '- Use learn_lesson to begin');
		} else {
			console.log('1.', chalk.cyan('workway-learn status'), '- View your progress');
			console.log('2.', chalk.cyan('Start Claude Code'), '- Begin a learning session');
		}

		if (!options.full) {
			console.log('');
			console.log(chalk.dim('Tip: Run'), chalk.cyan('workway-learn init --full'), chalk.dim('for project scaffolding'));
		}

		console.log('');
	} catch (error) {
		spinner.fail('Initialization failed');
		console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
