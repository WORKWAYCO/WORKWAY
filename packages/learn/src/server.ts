#!/usr/bin/env node

/**
 * WORKWAY Learn MCP Server
 *
 * Model Context Protocol server for WORKWAY learning.
 * Provides tools for authentication, progress tracking, lessons, and coaching.
 *
 * Usage:
 *   npx @workway/learn --server
 *
 * Or in .mcp.json:
 *   {
 *     "mcpServers": {
 *       "workway-learn": {
 *         "command": "npx",
 *         "args": ["@workway/learn", "--server"]
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
	ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { TOOLS, handleToolCall } from './mcp/tools/index.js';
import { RESOURCES, handleResourceRead } from './mcp/resources/index.js';

/**
 * Start the MCP server
 */
export async function startServer(): Promise<void> {
	const server = new Server(
		{
			name: 'workway-learn',
			version: '1.0.0'
		},
		{
			capabilities: {
				tools: {},
				resources: {}
			}
		}
	);

	// List available tools
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: TOOLS
	}));

	// Handle tool calls
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		try {
			const result = await handleToolCall(name, args as Record<string, unknown>);
			return {
				content: [{ type: 'text', text: result }]
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({
							error: error instanceof Error ? error.message : 'Unknown error'
						})
					}
				],
				isError: true
			};
		}
	});

	// List resources
	server.setRequestHandler(ListResourcesRequestSchema, async () => ({
		resources: RESOURCES
	}));

	// Read resources
	server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
		const { uri } = request.params;

		const content = await handleResourceRead(uri);

		return {
			contents: [
				{
					uri,
					mimeType: 'application/json',
					text: content
				}
			]
		};
	});

	// Connect to stdio transport
	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error('WORKWAY Learn MCP server running on stdio');
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
	startServer().catch((error) => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
}
