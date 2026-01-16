#!/usr/bin/env node
/**
 * WORKWAY MCP Server
 *
 * Model Context Protocol server for AI-native workflow development with Claude Code.
 * Provides tools for testing, debugging, validating, and understanding WORKWAY workflows.
 *
 * Philosophy: Progressive Disclosure
 * Agents discover capabilities by calling tools, not by loading all definitions upfront.
 * This reduces token consumption and allows filtering data in the execution environment.
 *
 * Usage:
 *   npx @workwayco/mcp --server
 *
 * Or in .mcp.json:
 *   {
 *     "mcpServers": {
 *       "workway": {
 *         "command": "npx",
 *         "args": ["@workwayco/mcp", "--server"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { getConfig } from './config.js';
import * as cloudflare from './servers/cloudflare/index.js';
import * as workway from './servers/workway/index.js';
import { debugWorkflow } from './skills/debug-workflow.js';

// ============================================================================
// TOOL DEFINITIONS - Organized by Category
// ============================================================================

const TOOLS = [
	// =========================================================================
	// WORKFLOW DEVELOPMENT - Core tools for building workflows with AI
	// =========================================================================
	{
		name: 'workflow_debug',
		description: 'Debug a workflow end-to-end: send test event, check execution, return diagnostics. Use this to test if a workflow works correctly.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				workflow: {
					type: 'string',
					description: 'Workflow ID to debug',
				},
				testEvent: {
					type: 'object',
					description: 'Test event with type (sentry|stripe|github|typeform|calendly|custom) and payload',
					properties: {
						type: { type: 'string', enum: ['sentry', 'stripe', 'github', 'typeform', 'calendly', 'custom'] },
						payload: { type: 'object' },
						endpoint: { type: 'string' },
					},
					required: ['type', 'payload'],
				},
				database: {
					type: 'string',
					description: 'Optional D1 database ID to check execution logs',
				},
				timeout: {
					type: 'number',
					description: 'Timeout in ms (default: 10000)',
				},
			},
			required: ['workflow', 'testEvent'],
		},
	},
	{
		name: 'workflow_diagnose',
		description: 'AI-powered diagnosis of workflow code. Analyzes code for common issues, anti-patterns, and suggests improvements based on WORKWAY best practices.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				code: {
					type: 'string',
					description: 'Workflow code to analyze (TypeScript)',
				},
				filePath: {
					type: 'string',
					description: 'Path to workflow file (alternative to code)',
				},
			},
		},
	},
	{
		name: 'workflow_validate',
		description: 'Validate workflow structure against WORKWAY SDK patterns. Returns errors and warnings.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				code: {
					type: 'string',
					description: 'Workflow code to validate',
				},
				filePath: {
					type: 'string',
					description: 'Path to workflow file (alternative to code)',
				},
				strict: {
					type: 'boolean',
					description: 'Treat warnings as errors (default: false)',
				},
			},
		},
	},
	{
		name: 'sdk_pattern',
		description: 'Get SDK code pattern for a specific use case. Use this to generate correct, idiomatic WORKWAY code.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				pattern: {
					type: 'string',
					enum: [
						'defineWorkflow',
						'ai-synthesis',
						'notion-document',
						'linear-task',
						'slack-message',
						'webhook-trigger',
						'cron-trigger',
						'error-handling',
						'config-schema',
						'oauth-integration',
					],
					description: 'Pattern name to retrieve',
				},
				integration: {
					type: 'string',
					description: 'Optional: specific integration (e.g., "zoom", "notion")',
				},
			},
			required: ['pattern'],
		},
	},
	// =========================================================================
	// WEBHOOK TESTING
	// =========================================================================
	{
		name: 'trigger_webhook',
		description: 'Trigger a webhook endpoint to test workflow execution.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				type: {
					type: 'string',
					enum: ['sentry', 'stripe', 'github', 'typeform', 'calendly', 'custom'],
					description: 'Webhook type',
				},
				payload: {
					type: 'object',
					description: 'JSON payload to send',
				},
				endpoint: {
					type: 'string',
					description: 'Custom endpoint path (for type: custom)',
				},
			},
			required: ['type', 'payload'],
		},
	},
	// =========================================================================
	// WORKFLOW DISCOVERY
	// =========================================================================
	{
		name: 'list_workflows',
		description: 'List available WORKWAY workflows with optional filtering.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				filter: {
					type: 'string',
					description: 'Filter by integration (e.g., "zoom", "slack")',
				},
				outcomeFrame: {
					type: 'string',
					description: 'Filter by outcome frame (e.g., "after_meetings")',
				},
			},
		},
	},
	{
		name: 'get_workflow',
		description: 'Get details about a specific workflow.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				workflowId: {
					type: 'string',
					description: 'The workflow ID',
				},
			},
			required: ['workflowId'],
		},
	},
	// =========================================================================
	// CLOUDFLARE INFRASTRUCTURE
	// =========================================================================
	{
		name: 'kv_list',
		description: 'List keys in a Cloudflare KV namespace.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				namespace: {
					type: 'string',
					description: 'KV namespace ID',
				},
				prefix: {
					type: 'string',
					description: 'Optional key prefix filter',
				},
				limit: {
					type: 'number',
					description: 'Maximum keys to return (default: 100)',
				},
			},
			required: ['namespace'],
		},
	},
	{
		name: 'kv_get',
		description: 'Get a value from KV by key.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				namespace: {
					type: 'string',
					description: 'KV namespace ID',
				},
				key: {
					type: 'string',
					description: 'The key to retrieve',
				},
			},
			required: ['namespace', 'key'],
		},
	},
	{
		name: 'd1_query',
		description: 'Execute a read-only SQL query against D1.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				database: {
					type: 'string',
					description: 'D1 database ID',
				},
				query: {
					type: 'string',
					description: 'SQL SELECT query',
				},
				params: {
					type: 'array',
					items: { type: 'string' },
					description: 'Query parameters',
				},
			},
			required: ['database', 'query'],
		},
	},
	{
		name: 'd1_tables',
		description: 'List tables in a D1 database.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				database: {
					type: 'string',
					description: 'D1 database ID',
				},
			},
			required: ['database'],
		},
	},
	{
		name: 'oauth_providers',
		description: 'List supported OAuth providers.',
		inputSchema: {
			type: 'object' as const,
			properties: {},
		},
	},
	{
		name: 'worker_analytics',
		description: 'Get analytics for a Worker.',
		inputSchema: {
			type: 'object' as const,
			properties: {
				workerName: {
					type: 'string',
					description: 'Name of the Worker',
				},
				since: {
					type: 'string',
					description: 'ISO timestamp to fetch from',
				},
			},
			required: ['workerName'],
		},
	},
];

// ============================================================================
// SDK PATTERNS - Canonical code examples for AI generation
// ============================================================================

const SDK_PATTERNS: Record<string, { description: string; code: string; notes?: string }> = {
	'defineWorkflow': {
		description: 'Basic workflow structure with all required fields',
		code: `import { defineWorkflow, webhook, cron } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'My Workflow',
  version: '1.0.0',
  description: 'What this workflow achieves (outcome, not mechanism)',

  // OAuth integrations - WORKWAY handles token refresh
  integrations: [
    { service: 'zoom', scopes: ['meeting:read'] },
    { service: 'notion', scopes: ['write'] },
  ],

  // User-facing configuration
  inputs: {
    notionDatabaseId: {
      type: 'notion_database_picker',
      label: 'Notion Database',
      required: true,
    },
  },

  // Trigger: webhook, cron, or manual
  trigger: webhook({ service: 'zoom', event: 'meeting.ended' }),

  // Main execution logic
  async execute({ trigger, inputs, integrations, env }) {
    // Your workflow logic here
    return { success: true };
  },

  // Optional error handler
  onError({ error, context }) {
    console.error('Workflow failed:', error.message);
    // Optionally: notify, retry, or cleanup
  },
});`,
		notes: 'Zuhandenheit: Name describes outcome, not mechanism. "Meeting notes that write themselves" not "Zoom-Notion sync".',
	},
	'ai-synthesis': {
		description: 'AI-powered content synthesis using Cloudflare Workers AI',
		code: `import { createAIClient, AIModels } from '@workwayco/sdk/workers-ai';

// Create client from Cloudflare binding (no API keys needed)
const ai = createAIClient(env);

// Text generation with structured output
const result = await ai.generateText({
  model: AIModels.LLAMA_3_8B, // $0.01/1M tokens
  system: 'Extract key information from meeting transcript.',
  prompt: transcript,
  max_tokens: 1000,
});

// Structured synthesis
const synthesis = await ai.synthesize(content, {
  type: 'meeting', // or 'email', 'support', 'feedback'
  output: {
    summary: 'string',
    actionItems: 'string[]',
    decisions: 'string[]',
    sentiment: 'string',
  },
});

// Sentiment analysis
const sentiment = await ai.analyzeSentiment({ text: feedback });
// Returns: { sentiment: 'POSITIVE' | 'NEGATIVE', confidence: 0.95 }`,
		notes: 'Workers AI runs on Cloudflare edge. No external API keys. 10-100x cheaper than OpenAI.',
	},
	'notion-document': {
		description: 'Create Notion pages and documents',
		code: `// Create a page in a database
await integrations.notion.pages.create({
  parent: { database_id: inputs.notionDatabaseId },
  properties: {
    'Title': { title: [{ text: { content: 'Meeting Summary' } }] },
    'Date': { date: { start: new Date().toISOString() } },
    'Status': { select: { name: 'New' } },
    'Tags': { multi_select: [{ name: 'meeting' }, { name: 'summary' }] },
  },
  children: [
    {
      type: 'heading_2',
      heading_2: { rich_text: [{ text: { content: 'Summary' } }] },
    },
    {
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: summary } }] },
    },
  ],
});

// Higher-level helper (if available)
await integrations.notion.createDocument({
  database: inputs.notionDatabaseId,
  template: 'meeting', // or 'report', 'summary'
  data: { title, summary, actionItems },
});`,
	},
	'linear-task': {
		description: 'Create Linear issues with Zuhandenheit patterns',
		code: `// Zuhandenheit: Use names, not IDs
await integrations.linear.issues.create({
  teamId: inputs.linearTeamId,
  title: 'Follow up: Customer feedback',
  description: \`
## Context
\${context}

## Action Required
\${actionRequired}
  \`,
  assigneeByName: 'john', // No ID lookup needed
  labels: ['follow-up', 'customer'], // Labels by name
  priority: 2, // 1=urgent, 2=high, 3=medium, 4=low
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
});`,
		notes: 'assigneeByName and labels by name are Zuhandenheit patterns - the tool recedes.',
	},
	'slack-message': {
		description: 'Send Slack messages and notifications',
		code: `// Simple message
await integrations.slack.chat.postMessage({
  channel: inputs.slackChannel,
  text: 'Meeting summary ready!',
});

// Rich message with blocks
await integrations.slack.chat.postMessage({
  channel: inputs.slackChannel,
  text: 'Fallback text for notifications',
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📋 Meeting Summary' },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: \`*\${meetingTitle}*\\n\${summary}\` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: \`*Duration:* \${duration} min\` },
        { type: 'mrkdwn', text: \`*Attendees:* \${attendees.length}\` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Notion' },
          url: notionPageUrl,
        },
      ],
    },
  ],
});`,
	},
	'webhook-trigger': {
		description: 'Configure webhook triggers for various services',
		code: `import { webhook } from '@workwayco/sdk';

// Zoom webhook
trigger: webhook({ service: 'zoom', event: 'meeting.ended' })

// GitHub webhook
trigger: webhook({ service: 'github', event: 'pull_request.opened' })

// Stripe webhook
trigger: webhook({ service: 'stripe', event: 'payment_intent.succeeded' })

// Sentry webhook
trigger: webhook({ service: 'sentry', event: 'issue.created' })

// Generic webhook (any HTTP POST)
trigger: webhook({ event: 'custom' })

// Trigger data is available in execute:
async execute({ trigger }) {
  const { event, data, timestamp } = trigger;
  // data contains the webhook payload
}`,
	},
	'cron-trigger': {
		description: 'Schedule workflows with cron expressions',
		code: `import { cron, schedule } from '@workwayco/sdk';

// Every weekday at 9am
trigger: cron('0 9 * * 1-5')

// Every hour
trigger: cron('0 * * * *')

// Every Monday at 8am
trigger: cron('0 8 * * 1')

// Human-readable alternative
trigger: schedule('every day at 9am')
trigger: schedule('every monday at 8:00')
trigger: schedule('every 15 minutes')

// Access trigger info:
async execute({ trigger }) {
  const { scheduledTime, cron } = trigger;
}`,
	},
	'error-handling': {
		description: 'Graceful error handling and recovery',
		code: `export default defineWorkflow({
  // ... other config

  async execute({ trigger, inputs, integrations, log }) {
    try {
      // Main logic
      const result = await riskyOperation();

      if (!result.success) {
        // Graceful degradation
        log.warn('Primary method failed, using fallback', { reason: result.error });
        return await fallbackOperation();
      }

      return { success: true, data: result };
    } catch (error) {
      // Let onError handle it
      throw error;
    }
  },

  onError({ error, trigger, context, log }) {
    // Log for debugging
    log.error('Workflow failed', {
      message: error.message,
      trigger: trigger.event,
      stack: error.stack,
    });

    // Optional: Notify on failure
    // await notifySlack(\`Workflow failed: \${error.message}\`);

    // Return graceful response
    return {
      success: false,
      error: error.message,
      retryable: error.code !== 'INVALID_INPUT',
    };
  },
});`,
		notes: 'Workflows should fail gracefully and explain themselves. Zuhandenheit: even errors should recede.',
	},
	'config-schema': {
		description: 'Define user-facing configuration inputs',
		code: `inputs: {
  // Service-specific pickers (Zuhandenheit - no ID copy/paste)
  notionDatabase: {
    type: 'notion_database_picker',
    label: 'Target Database',
    required: true,
  },
  slackChannel: {
    type: 'slack_channel_picker',
    label: 'Notification Channel',
    required: true,
  },

  // Basic types
  projectName: {
    type: 'text',
    label: 'Project Name',
    placeholder: 'My Project',
    default: 'Untitled',
  },
  maxItems: {
    type: 'number',
    label: 'Maximum Items',
    min: 1,
    max: 100,
    default: 10,
  },
  isEnabled: {
    type: 'boolean',
    label: 'Enable Notifications',
    default: true,
  },

  // Selection
  priority: {
    type: 'select',
    label: 'Priority',
    options: ['low', 'medium', 'high'],
    default: 'medium',
  },

  // Arrays
  tags: {
    type: 'array',
    itemType: 'text',
    label: 'Tags',
    default: [],
  },
}`,
		notes: 'Fewer inputs = better UX. Aim for 0-2 required fields. Sensible defaults over configuration.',
	},
	'oauth-integration': {
		description: 'Working with OAuth-connected services',
		code: `// Declare required integrations and scopes
integrations: [
  { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
  { service: 'notion', scopes: ['write'] },
  { service: 'slack', scopes: ['chat:write', 'channels:read'] },
  { service: 'linear', scopes: ['issues:write'] },
  { service: 'gmail', scopes: ['gmail.readonly', 'gmail.send'] },
],

// In execute, integrations are ready-to-use OAuth clients
async execute({ integrations }) {
  // WORKWAY handles:
  // - Token refresh
  // - Rate limiting
  // - Error wrapping
  // - Retries

  // Just use the API
  const meetings = await integrations.zoom.meetings.list();
  const pages = await integrations.notion.databases.query({ database_id: '...' });
  await integrations.slack.chat.postMessage({ channel: '...', text: '...' });
}`,
		notes: 'OAuth tokens are managed by WORKWAY. Never store tokens yourself.',
	},
};

// ============================================================================
// WORKFLOW ANALYSIS - For diagnose and validate tools
// ============================================================================

interface DiagnosisResult {
	issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string; line?: number }>;
	suggestions: string[];
	score: number; // 0-100
	patterns: { found: string[]; missing: string[] };
}

function diagnoseWorkflowCode(code: string): DiagnosisResult {
	const issues: DiagnosisResult['issues'] = [];
	const suggestions: string[] = [];
	const patternsFound: string[] = [];
	const patternsMissing: string[] = [];

	// Check for defineWorkflow
	if (!code.includes('defineWorkflow')) {
		issues.push({ severity: 'error', message: 'Missing defineWorkflow() call' });
	} else {
		patternsFound.push('defineWorkflow');
	}

	// Check for name
	if (!code.match(/name:\s*['"`]/)) {
		issues.push({ severity: 'error', message: 'Workflow missing name property' });
	}

	// Check for version
	if (!code.match(/version:\s*['"`]\d+\.\d+\.\d+['"`]/)) {
		issues.push({ severity: 'warning', message: 'Missing or invalid version (use semver: "1.0.0")' });
	}

	// Check for execute function
	if (!code.includes('async execute')) {
		issues.push({ severity: 'error', message: 'Missing execute function' });
	} else {
		patternsFound.push('execute');
	}

	// Check for error handling
	if (code.includes('onError')) {
		patternsFound.push('error-handling');
	} else {
		patternsMissing.push('error-handling');
		suggestions.push('Consider adding onError handler for graceful failure');
	}

	// Check for AI patterns
	if (code.includes('createAIClient') || code.includes('workers-ai')) {
		patternsFound.push('ai-synthesis');
	}

	// Check for hardcoded IDs (anti-pattern)
	const hardcodedIds = code.match(/['"](db|wf|user|team)_[a-zA-Z0-9]+['"]/g);
	if (hardcodedIds) {
		issues.push({
			severity: 'warning',
			message: `Found hardcoded IDs: ${hardcodedIds.join(', ')}. Use inputs for user-configurable values.`,
		});
	}

	// Check for console.log (should use context.log)
	if (code.includes('console.log')) {
		issues.push({
			severity: 'info',
			message: 'Using console.log - consider using context.log for structured logging',
		});
	}

	// Check naming pattern (Zuhandenheit)
	const nameMatch = code.match(/name:\s*['"`]([^'"`]+)['"`]/);
	if (nameMatch) {
		const name = nameMatch[1];
		// Check for tool-focused names (anti-pattern)
		const toolPatterns = ['sync', 'api', 'webhook', 'integration', 'connector'];
		const isToolFocused = toolPatterns.some(p => name.toLowerCase().includes(p));
		if (isToolFocused) {
			suggestions.push(
				`Workflow name "${name}" is tool-focused. Zuhandenheit: describe the outcome, not the mechanism.`
			);
		}
	}

	// Calculate score
	const errorCount = issues.filter(i => i.severity === 'error').length;
	const warningCount = issues.filter(i => i.severity === 'warning').length;
	const score = Math.max(0, 100 - errorCount * 25 - warningCount * 10);

	return {
		issues,
		suggestions,
		score,
		patterns: { found: patternsFound, missing: patternsMissing },
	};
}

// ============================================================================
// TOOL HANDLERS
// ============================================================================

async function handleToolCall(
	name: string,
	args: Record<string, unknown>
): Promise<string> {
	switch (name) {
		// =====================================================================
		// WORKFLOW DEVELOPMENT TOOLS
		// =====================================================================
		case 'workflow_debug': {
			const result = await debugWorkflow({
				workflow: args.workflow as string,
				testEvent: args.testEvent as { type: 'sentry' | 'stripe' | 'github' | 'typeform' | 'calendly' | 'custom'; payload: unknown; endpoint?: string },
				database: args.database as string | undefined,
				timeout: args.timeout as number | undefined,
			});
			return JSON.stringify(result, null, 2);
		}

		case 'workflow_diagnose': {
			let code = args.code as string | undefined;

			if (!code && args.filePath) {
				try {
					code = fs.readFileSync(args.filePath as string, 'utf-8');
				} catch (error) {
					return JSON.stringify({ error: `Could not read file: ${args.filePath}` });
				}
			}

			if (!code) {
				return JSON.stringify({ error: 'Provide either code or filePath' });
			}

			const diagnosis = diagnoseWorkflowCode(code);
			return JSON.stringify({
				...diagnosis,
				summary: diagnosis.score >= 80
					? '✅ Workflow follows WORKWAY patterns well'
					: diagnosis.score >= 50
						? '⚠️ Workflow has some issues to address'
						: '❌ Workflow needs significant improvements',
			}, null, 2);
		}

		case 'workflow_validate': {
			let code = args.code as string | undefined;

			if (!code && args.filePath) {
				try {
					code = fs.readFileSync(args.filePath as string, 'utf-8');
				} catch (error) {
					return JSON.stringify({ error: `Could not read file: ${args.filePath}` });
				}
			}

			if (!code) {
				return JSON.stringify({ error: 'Provide either code or filePath' });
			}

			const diagnosis = diagnoseWorkflowCode(code);
			const strict = args.strict as boolean;

			const errors = diagnosis.issues.filter(i => i.severity === 'error');
			const warnings = diagnosis.issues.filter(i => i.severity === 'warning');

			const isValid = strict
				? errors.length === 0 && warnings.length === 0
				: errors.length === 0;

			return JSON.stringify({
				valid: isValid,
				errors: errors.map(e => e.message),
				warnings: warnings.map(w => w.message),
			}, null, 2);
		}

		case 'sdk_pattern': {
			const pattern = args.pattern as string;
			const patternData = SDK_PATTERNS[pattern];

			if (!patternData) {
				return JSON.stringify({
					error: `Unknown pattern: ${pattern}`,
					available: Object.keys(SDK_PATTERNS),
				});
			}

			return JSON.stringify({
				pattern,
				description: patternData.description,
				code: patternData.code,
				notes: patternData.notes,
			}, null, 2);
		}

		// =====================================================================
		// WEBHOOK TESTING
		// =====================================================================
		case 'trigger_webhook': {
			const type = args.type as 'sentry' | 'stripe' | 'github' | 'typeform' | 'calendly' | 'custom';
			const payload = args.payload;
			let result: workway.webhooks.WebhookResult;

			switch (type) {
				case 'sentry':
					result = await workway.webhooks.sentry(payload as Parameters<typeof workway.webhooks.sentry>[0]);
					break;
				case 'stripe':
					result = await workway.webhooks.stripe(payload as Parameters<typeof workway.webhooks.stripe>[0]);
					break;
				case 'github':
					result = await workway.webhooks.github(payload as Parameters<typeof workway.webhooks.github>[0]);
					break;
				case 'typeform':
					result = await workway.webhooks.typeform(payload as Parameters<typeof workway.webhooks.typeform>[0]);
					break;
				case 'calendly':
					result = await workway.webhooks.calendly(payload as Parameters<typeof workway.webhooks.calendly>[0]);
					break;
				case 'custom':
					result = await workway.webhooks.send({
						endpoint: (args.endpoint as string) || '/webhooks/custom',
						payload,
					});
					break;
				default:
					return JSON.stringify({ error: `Unknown webhook type: ${type}` });
			}

			return JSON.stringify(result, null, 2);
		}

		case 'list_workflows': {
			const workflows = workway.workflows.list({
				filter: args.filter as string | undefined,
				outcomeFrame: args.outcomeFrame as string | undefined,
			});
			return JSON.stringify(workflows, null, 2);
		}

		case 'get_workflow': {
			const workflow = workway.workflows.get(args.workflowId as string);
			if (!workflow) {
				return JSON.stringify({ error: `Workflow not found: ${args.workflowId}` });
			}
			return JSON.stringify(workflow, null, 2);
		}

		case 'kv_list': {
			const result = await cloudflare.kv.list({
				namespace: args.namespace as string,
				prefix: args.prefix as string | undefined,
				limit: args.limit as number | undefined,
			});
			return JSON.stringify(result, null, 2);
		}

		case 'kv_get': {
			const value = await cloudflare.kv.get({
				namespace: args.namespace as string,
				key: args.key as string,
			});
			if (value === null) {
				return JSON.stringify({ error: 'Key not found' });
			}
			return value;
		}

		case 'd1_query': {
			const result = await cloudflare.d1.query({
				database: args.database as string,
				query: args.query as string,
				params: args.params as string[] | undefined,
			});
			return JSON.stringify(result, null, 2);
		}

		case 'd1_tables': {
			const result = await cloudflare.d1.tables({ database: args.database as string });
			return JSON.stringify(result, null, 2);
		}

		case 'oauth_providers': {
			const providers = workway.oauth.providers();
			return JSON.stringify(providers, null, 2);
		}

		case 'worker_analytics': {
			const result = await cloudflare.workers.analytics({
				name: args.workerName as string,
				since: args.since as string | undefined,
			});
			return JSON.stringify(result, null, 2);
		}

		default:
			return JSON.stringify({ error: `Unknown tool: ${name}` });
	}
}

// ============================================================================
// MCP SERVER
// ============================================================================

async function main() {
	const server = new Server(
		{
			name: 'workway-mcp',
			version: '1.0.0',
		},
		{
			capabilities: {
				tools: {},
				resources: {},
			},
		}
	);

	// List available tools
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: TOOLS,
	}));

	// Handle tool calls
	server.setRequestHandler(CallToolRequestSchema, async request => {
		const { name, arguments: args } = request.params;

		try {
			const result = await handleToolCall(name, args as Record<string, unknown>);
			return {
				content: [{ type: 'text', text: result }],
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							error: error instanceof Error ? error.message : 'Unknown error',
						}),
					},
				],
				isError: true,
			};
		}
	});

	// List resources
	server.setRequestHandler(ListResourcesRequestSchema, async () => ({
		resources: [
			{
				uri: 'workway://docs/workflows',
				name: 'WORKWAY Workflows',
				description: 'All available workflows and their integration pairs',
				mimeType: 'application/json',
			},
			{
				uri: 'workway://docs/oauth',
				name: 'OAuth Providers',
				description: 'Supported OAuth providers and their configuration',
				mimeType: 'application/json',
			},
			{
				uri: 'workway://sdk/patterns',
				name: 'SDK Patterns',
				description: 'All canonical SDK patterns for AI-native workflow development',
				mimeType: 'application/json',
			},
			{
				uri: 'workway://docs/philosophy',
				name: 'Development Philosophy',
				description: 'Zuhandenheit, Weniger aber besser, and other design principles',
				mimeType: 'text/markdown',
			},
			{
				uri: 'workway://docs/quickstart',
				name: 'Quick Start Guide',
				description: 'Get started building WORKWAY workflows',
				mimeType: 'text/markdown',
			},
		],
	}));

	// Read resources
	server.setRequestHandler(ReadResourceRequestSchema, async request => {
		const { uri } = request.params;

		let content: string;
		let mimeType = 'application/json';

		switch (uri) {
			case 'workway://docs/workflows':
				content = JSON.stringify(
					{
						workflows: workway.workflows.list(),
						outcomeFrames: workway.workflows.outcomeFrames(),
						integrations: workway.workflows.integrations(),
					},
					null,
					2
				);
				break;

			case 'workway://docs/oauth':
				content = JSON.stringify(
					{
						providers: workway.oauth.providers(),
						byType: workway.oauth.byType(),
					},
					null,
					2
				);
				break;

			case 'workway://sdk/patterns':
				content = JSON.stringify(
					{
						patterns: Object.entries(SDK_PATTERNS).map(([name, data]) => ({
							name,
							description: data.description,
							code: data.code,
							notes: data.notes,
						})),
						usage: 'Use sdk_pattern tool to get a specific pattern',
					},
					null,
					2
				);
				break;

			case 'workway://docs/philosophy':
				mimeType = 'text/markdown';
				content = `# WORKWAY Development Philosophy

## Zuhandenheit (Ready-to-hand)

> The tool should recede; the outcome should remain.

Your workflow should disappear during use. Users don't want "automation"—they want outcomes.
Meetings that summarize themselves. Payments that track themselves. The tool recedes; the outcome remains.

### The Outcome Test

Before building, ask:
> Can you describe what the workflow does without mentioning the workflow?

**Good**: "Meetings that document themselves"
**Bad**: "Meeting Intelligence workflow with AI transcription"

## Weniger, aber besser (Less, but better)

Dieter Rams' principle applied to workflow design.

### Configuration Guidance

| Fields | Quality |
|--------|---------|
| 0 | Excellent (works out of box) |
| 1-2 | Good (minimal setup) |
| 3 | Acceptable (slight friction) |
| 4+ | Reconsider (too much visibility) |

### Code Guidance

- Every line should earn its place
- Prefer composition over configuration
- Sensible defaults over explicit settings

## Error Philosophy

Workflows should:
1. **Fail gracefully** - Don't leave users hanging
2. **Explain themselves** - Errors should guide resolution
3. **Retry intelligently** - Transient failures should recover
4. **Notify appropriately** - Critical failures deserve attention

## Integration Philosophy

- **OAuth handled** - WORKWAY manages token refresh
- **Rate limits handled** - SDK includes backoff
- **Names over IDs** - \`assigneeByName: 'john'\` not \`assigneeId: 'usr_abc123'\`
`;
				break;

			case 'workway://docs/quickstart':
				mimeType = 'text/markdown';
				content = `# WORKWAY Quick Start

## 1. Create a Workflow

\`\`\`bash
# Basic workflow
workway workflow init my-workflow

# AI-powered workflow
workway workflow init --ai my-ai-workflow

# With Claude Code integration
workway workflow init --with-claude my-workflow
\`\`\`

## 2. Basic Structure

\`\`\`typescript
import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'My Workflow',
  version: '1.0.0',

  integrations: [
    { service: 'zoom', scopes: ['meeting:read'] },
    { service: 'notion', scopes: ['write'] },
  ],

  inputs: {
    notionDatabaseId: {
      type: 'notion_database_picker',
      required: true,
    },
  },

  trigger: webhook({ service: 'zoom', event: 'meeting.ended' }),

  async execute({ trigger, inputs, integrations, env }) {
    // Your logic here
    return { success: true };
  },
});
\`\`\`

## 3. Test Your Workflow

\`\`\`bash
# Test with mocked integrations
workway workflow test --mock

# Test with live OAuth
workway workflow test --live

# Test with custom data
workway workflow test --data test-payload.json
\`\`\`

## 4. Publish

\`\`\`bash
# Validate first
workway workflow validate

# Publish to marketplace
workway workflow publish
\`\`\`

## Common Commands

| Command | Description |
|---------|-------------|
| \`workway create "..."\` | Generate workflow from natural language |
| \`workway explain file.ts\` | Explain workflow in plain English |
| \`workway modify file.ts "..."\` | Modify workflow with AI |
| \`workway ai models\` | List available AI models |
| \`workway ai estimate\` | Estimate AI costs |
`;
				break;

			default:
				content = JSON.stringify({ error: `Resource not found: ${uri}` });
		}

		return {
			contents: [
				{
					uri,
					mimeType,
					text: content,
				},
			],
		};
	});

	// Connect to stdio transport
	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error('WORKWAY MCP server running on stdio');
}

main().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
