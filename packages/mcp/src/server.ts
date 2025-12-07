#!/usr/bin/env node
/**
 * WORKWAY MCP Server
 *
 * Model Context Protocol server for debugging Cloudflare Workers workflows.
 * This is an alternative to the code execution library for tools that prefer
 * direct MCP tool calls.
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

import { getConfig } from './config.js';
import * as cloudflare from './servers/cloudflare/index.js';
import * as workway from './servers/workway/index.js';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const TOOLS = [
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
// TOOL HANDLERS
// ============================================================================

async function handleToolCall(
	name: string,
	args: Record<string, unknown>
): Promise<string> {
	switch (name) {
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
		],
	}));

	// Read resources
	server.setRequestHandler(ReadResourceRequestSchema, async request => {
		const { uri } = request.params;

		let content: string;

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

			default:
				content = JSON.stringify({ error: `Resource not found: ${uri}` });
		}

		return {
			contents: [
				{
					uri,
					mimeType: 'application/json',
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
