/**
 * Workflow Init Command
 *
 * Creates a new workflow project with all necessary files.
 * Supports both integration workflows and AI-first workflows.
 */

import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { Logger } from '../../utils/logger.js';
import {
	basicWorkflowTemplate,
	testDataTemplate,
	readmeTemplate,
	packageJsonTemplate,
	gitignoreTemplate,
	workwayConfigTemplate,
} from '../../templates/workflow/basic.js';
import {
	aiWorkflowTemplate,
	aiTestDataTemplate,
	aiReadmeTemplate,
	aiPackageJsonTemplate,
} from '../../templates/workflow/ai.js';
import { WORKFLOW_CATEGORIES } from '../../constants.js';

interface InitOptions {
	ai?: boolean;
	name?: string;
	withClaude?: boolean;
}

/**
 * Generate CLAUDE.md for workflow-specific context
 * Comprehensive guide for AI-native workflow development with Claude Code
 */
function generateClaudeMd(workflowName: string, description: string, projectName: string): string {
	return `# ${workflowName}

> **Zuhandenheit**: The tool recedes; the outcome remains.

## Overview

${description || 'Describe the outcome this workflow achieves (not the mechanism).'}

## Philosophy

This workflow follows WORKWAY principles:

1. **Zuhandenheit** (Ready-to-hand): The tool should disappear during use
2. **Weniger, aber besser** (Less, but better): Every line earns its place
3. **Outcome Test**: Can you describe this without mentioning technology?

## Workflow Structure

\`\`\`typescript
import { defineWorkflow, webhook, cron, manual } from '@workwayco/sdk';
import { createAIClient, AIModels } from '@workwayco/sdk/workers-ai';

export default defineWorkflow({
  name: '${workflowName}',
  version: '1.0.0',
  description: 'What disappears from the user to-do list',

  // OAuth integrations - WORKWAY handles token refresh
  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
    { service: 'notion', scopes: ['write'] },
    { service: 'slack', scopes: ['chat:write'] },
  ],

  // User configuration - fewer is better (0-2 required fields ideal)
  inputs: {
    notionDatabaseId: {
      type: 'notion_database_picker',
      label: 'Target Database',
      required: true,
    },
    slackChannel: {
      type: 'slack_channel_picker',
      label: 'Notification Channel',
      required: false,
    },
  },

  // Trigger types: webhook, cron, manual
  trigger: webhook({ service: 'zoom', event: 'meeting.ended' }),
  // trigger: cron('0 9 * * 1-5'),  // Weekdays at 9am
  // trigger: manual(),  // User-initiated

  async execute({ trigger, inputs, integrations, env, log }) {
    // AI client - no API keys needed (Cloudflare Workers AI)
    const ai = createAIClient(env);

    // Your workflow logic here

    return { success: true };
  },

  // Optional: Graceful error handling
  onError({ error, trigger, log }) {
    log.error('Workflow failed', { message: error.message });
    return { success: false, error: error.message, retryable: true };
  },
});
\`\`\`

## SDK Patterns

### AI Synthesis (Cloudflare Workers AI)

\`\`\`typescript
const ai = createAIClient(env);

// Text generation
const result = await ai.generateText({
  model: AIModels.LLAMA_3_8B,  // $0.01/1M tokens
  system: 'You summarize meeting transcripts.',
  prompt: transcript,
  max_tokens: 1000,
});

// Structured synthesis
const analysis = await ai.synthesize(content, {
  type: 'meeting',  // or 'email', 'support', 'feedback'
  output: {
    summary: 'string',
    actionItems: 'string[]',
    decisions: 'string[]',
  },
});

// Sentiment
const sentiment = await ai.analyzeSentiment({ text });
// { sentiment: 'POSITIVE' | 'NEGATIVE', confidence: 0.95 }
\`\`\`

### Notion Integration

\`\`\`typescript
// Create a page in database
await integrations.notion.pages.create({
  parent: { database_id: inputs.notionDatabaseId },
  properties: {
    'Title': { title: [{ text: { content: 'Meeting Notes' } }] },
    'Date': { date: { start: new Date().toISOString() } },
    'Status': { select: { name: 'New' } },
  },
  children: [
    { type: 'heading_2', heading_2: { rich_text: [{ text: { content: 'Summary' } }] } },
    { type: 'paragraph', paragraph: { rich_text: [{ text: { content: summary } }] } },
  ],
});
\`\`\`

### Slack Integration

\`\`\`typescript
// Rich message with blocks
await integrations.slack.chat.postMessage({
  channel: inputs.slackChannel,
  text: 'Meeting summary ready',
  blocks: [
    { type: 'header', text: { type: 'plain_text', text: '📋 Meeting Summary' } },
    { type: 'section', text: { type: 'mrkdwn', text: \`*\${title}*\\n\${summary}\` } },
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'View' }, url: notionUrl },
      ],
    },
  ],
});
\`\`\`

### Linear Integration (Zuhandenheit style)

\`\`\`typescript
// Use names, not IDs
await integrations.linear.issues.create({
  teamId: inputs.linearTeamId,
  title: 'Follow up on customer feedback',
  assigneeByName: 'john',    // No ID lookup needed
  labels: ['follow-up'],      // Labels by name
  priority: 2,                // 1=urgent, 4=low
});
\`\`\`

### Error Handling Pattern

\`\`\`typescript
async execute({ trigger, inputs, integrations, log }) {
  try {
    const result = await riskyOperation();
    
    if (!result.success) {
      log.warn('Primary failed, using fallback');
      return await fallbackOperation();
    }
    
    return { success: true, data: result };
  } catch (error) {
    throw error;  // Let onError handle it
  }
},

onError({ error, log }) {
  log.error('Workflow failed', { error: error.message });
  // Optional: notify Slack
  return { success: false, error: error.message, retryable: error.code !== 'INVALID_INPUT' };
},
\`\`\`

## Development Commands

\`\`\`bash
# Test with mocked integrations
workway workflow test --mock

# Test with live OAuth
workway workflow test --live

# Validate workflow structure
workway workflow validate

# AI-powered diagnosis
workway diagnose workflow.ts

# Publish to marketplace
workway workflow publish
\`\`\`

## Agentic Commands (AI-Powered)

\`\`\`bash
# Create workflow from natural language
workway create "When a Zoom meeting ends, create Notion notes and Slack summary"

# Explain existing workflow
workway explain workflow.ts

# Modify workflow with AI
workway modify workflow.ts "add email fallback for users without Slack"
\`\`\`

## MCP Server Integration

Add to \`.mcp.json\` for Claude Code:

\`\`\`json
{
  "mcpServers": {
    "workway": {
      "command": "npx",
      "args": ["@workwayco/mcp", "--server"]
    }
  }
}
\`\`\`

Available MCP tools:
- \`workflow_debug\` - End-to-end workflow testing
- \`workflow_diagnose\` - AI-powered code analysis
- \`workflow_validate\` - Structure validation
- \`sdk_pattern\` - Get canonical SDK patterns
- \`trigger_webhook\` - Test webhook triggers

## Quality Checklist

Before publishing:

- [ ] **Outcome Test**: Can you describe this without mentioning technology?
- [ ] **Config Minimal**: 0-2 required fields?
- [ ] **Defaults Sensible**: Works out-of-box where possible?
- [ ] **Errors Graceful**: onError handler with clear messages?
- [ ] **Names Descriptive**: "Meeting notes that write themselves" not "Zoom-Notion Sync"

## Resources

- SDK: \`@workwayco/sdk\` README
- CLI: \`workway --help\`
- Learn: https://learn.workway.co
- Examples: packages/workflows/src/
`;
}

export async function workflowInitCommand(nameArg?: string, options?: InitOptions): Promise<void> {
	const isAI = options?.ai || false;
	const withClaude = options?.withClaude || false;

	Logger.header(isAI ? 'Create AI Workflow' : 'Create New Workflow');

	if (isAI) {
		Logger.info('Using Cloudflare Workers AI (no external API keys required)');
		Logger.blank();
	}

	if (withClaude) {
		Logger.info('Claude Code integration enabled - will generate .claude/ directory');
		Logger.blank();
	}

	try {
		// Different prompts for AI vs integration workflows
		const prompts = isAI
			? [
					{
						type: 'input',
						name: 'name',
						message: 'Workflow name:',
						default: nameArg || 'AI Assistant',
						validate: (input: string) => {
							if (!input || input.trim().length === 0) {
								return 'Workflow name is required';
							}
							if (input.length > 50) {
								return 'Workflow name must be 50 characters or less';
							}
							return true;
						},
					},
					{
						type: 'input',
						name: 'aiTask',
						message: 'What will this AI do?',
						default: 'Summarize and analyze text',
						validate: (input: string) => {
							if (!input || input.trim().length === 0) {
								return 'AI task description is required';
							}
							return true;
						},
					},
					{
						type: 'list',
						name: 'category',
						message: 'Category:',
						choices: [...WORKFLOW_CATEGORIES],
						default: 'productivity',
					},
					{
						type: 'number',
						name: 'price',
						message: 'Monthly price (USD):',
						default: 5,
						validate: (input: number) => {
							if (input < 0) return 'Price must be 0 or greater';
							if (input > 1000) return 'Price must be 1000 or less';
							return true;
						},
					},
				]
			: [
					{
						type: 'input',
						name: 'name',
						message: 'Workflow name:',
						default: nameArg || 'My Workflow',
						validate: (input: string) => {
							if (!input || input.trim().length === 0) {
								return 'Workflow name is required';
							}
							if (input.length > 50) {
								return 'Workflow name must be 50 characters or less';
							}
							return true;
						},
					},
					{
						type: 'list',
						name: 'category',
						message: 'Category:',
						choices: [...WORKFLOW_CATEGORIES],
						default: 'productivity',
					},
					{
						type: 'input',
						name: 'description',
						message: 'Description (optional):',
						default: '',
					},
					{
						type: 'number',
						name: 'price',
						message: 'Monthly price (USD):',
						default: 8,
						validate: (input: number) => {
							if (input < 0) return 'Price must be 0 or greater';
							if (input > 1000) return 'Price must be 1000 or less';
							return true;
						},
					},
					{
						type: 'number',
						name: 'trialDays',
						message: 'Free trial days:',
						default: 7,
						validate: (input: number) => {
							if (input < 0) return 'Trial days must be 0 or greater';
							if (input > 365) return 'Trial days must be 365 or less';
							return true;
						},
					},
				];

		const answers = await inquirer.prompt(prompts);

		// Create project directory
		const projectName = answers.name.toLowerCase().replace(/\s+/g, '-');
		const projectPath = path.join(process.cwd(), projectName);

		// Check if directory already exists
		if (await fs.pathExists(projectPath)) {
			Logger.error(`Directory "${projectName}" already exists`);
			Logger.blank();
			Logger.log('Choose a different name or remove the existing directory');
			process.exit(1);
		}

		const spinner = Logger.spinner(`Creating ${isAI ? 'AI ' : ''}workflow project "${projectName}"...`);

		try {
			// Create directory
			await fs.ensureDir(projectPath);

			if (isAI) {
				// AI workflow files
				const workflowContent = aiWorkflowTemplate(
					answers.name,
					answers.category,
					answers.price,
					answers.aiTask
				);
				await fs.writeFile(path.join(projectPath, 'workflow.ts'), workflowContent);

				const testDataContent = aiTestDataTemplate();
				await fs.writeFile(path.join(projectPath, 'test-data.json'), testDataContent);

				const readmeContent = aiReadmeTemplate(answers.name);
				await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);

				const packageJsonContent = aiPackageJsonTemplate(answers.name);
				await fs.writeFile(path.join(projectPath, 'package.json'), packageJsonContent);
			} else {
				// Standard integration workflow files
				const workflowContent = basicWorkflowTemplate(answers.name, answers.category, answers.price);
				await fs.writeFile(path.join(projectPath, 'workflow.ts'), workflowContent);

				const testDataContent = testDataTemplate();
				await fs.writeFile(path.join(projectPath, 'test-data.json'), testDataContent);

				const readmeContent = readmeTemplate(answers.name);
				await fs.writeFile(path.join(projectPath, 'README.md'), readmeContent);

				const packageJsonContent = packageJsonTemplate(answers.name);
				await fs.writeFile(path.join(projectPath, 'package.json'), packageJsonContent);
			}

			// Common files
			const gitignoreContent = gitignoreTemplate();
			await fs.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);

			const configContent = workwayConfigTemplate();
			await fs.writeFile(path.join(projectPath, 'workway.config.json'), configContent);

			// Claude Code integration
			if (withClaude) {
				const claudeDir = path.join(projectPath, '.claude');
				await fs.ensureDir(claudeDir);

				// Generate CLAUDE.md with workflow-specific context
				const claudeMdContent = generateClaudeMd(answers.name, answers.description || answers.aiTask || '', projectName);
				await fs.writeFile(path.join(claudeDir, 'CLAUDE.md'), claudeMdContent);

				// Generate context.json with integration metadata
				const contextContent = JSON.stringify({
					workflowId: projectName,
					name: answers.name,
					category: answers.category,
					isAI: isAI,
					createdAt: new Date().toISOString(),
					integrations: [],
					beadsIssue: null,
				}, null, 2);
				await fs.writeFile(path.join(claudeDir, 'context.json'), contextContent);

				// Generate workflow-meta.yaml for Beads integration
				const metaContent = `# Workflow Metadata for Beads Integration
workflow_id: ${projectName}
name: "${answers.name}"
status: draft
created: ${new Date().toISOString().split('T')[0]}

# Beads issue will be created on first publish
beads_issue: null

# Track key milestones
milestones:
  - name: workflow_created
    date: ${new Date().toISOString().split('T')[0]}
`;
				await fs.writeFile(path.join(claudeDir, 'workflow-meta.yaml'), metaContent);
			}

			spinner.succeed(`Project created: ${projectName}/`);

			// Show success message
			Logger.blank();
			Logger.section('Details');
			Logger.listItem(`Name: ${answers.name}`);
			if (isAI) {
				Logger.listItem(`AI Task: ${answers.aiTask}`);
			}
			Logger.listItem(`Category: ${answers.category}`);
			Logger.listItem(`Price: $${answers.price}/month`);
			if (!isAI) {
				Logger.listItem(`Trial: ${answers.trialDays} days`);
			}

			Logger.blank();
			Logger.section('Next steps');
			Logger.log(`  cd ${projectName}`);
			Logger.log('  npm install');
			Logger.log('  # Edit workflow.ts');

			if (isAI) {
				Logger.log('  workway ai models        # List AI models');
				Logger.log('  workway workflow test    # Test workflow');
				Logger.log('  workway workflow publish # Publish to marketplace');
			} else {
				Logger.log('  npm test                 # Run tests');
				Logger.log('  workway workflow publish # Publish to marketplace');
			}

			Logger.blank();
			Logger.log('Docs: https://docs.workway.dev/workflows');
		} catch (error: any) {
			spinner.fail('Failed to create project');
			Logger.error(error.message);

			// Clean up on failure
			try {
				await fs.remove(projectPath);
			} catch {}

			process.exit(1);
		}
	} catch (error: any) {
		if (error.isTtyError) {
			Logger.error('Prompt could not be rendered in the current environment');
		} else {
			Logger.error(error.message);
		}
		process.exit(1);
	}
}
