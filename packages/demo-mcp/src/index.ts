/**
 * WORKWAY Demo MCP Server
 *
 * - Exposes 8 tools via MCP (list_projects, list_rfis, get_rfi, list_submittals,
 *   get_submittal, get_project_summary, list_daily_logs, create_daily_log).
 * - POST /demo/query: sandbox endpoint — body { message }, returns { toolCall, response, summary?, timeSaved }.
 * No Procore OAuth; all data from in-memory mock.
 */

import { Hono } from 'hono';
import { createMCPServer } from '@workway/mcp-core';
import { demoTools } from './tools';
import { resolveToolCall, type AgentOutput } from './agent';
import { buildSandboxResponse } from './sandbox-response';
import { generateAgentMessage, selectToolWithLLM, type GenerateAgentMessageEnv } from './agent-llm';

export interface DemoMCPEnv {
	KV: KVNamespace;
	DB: D1Database;
}

const mcpServer = createMCPServer<DemoMCPEnv>({
	name: 'workway-demo-mcp',
	version: '0.1.0',
	description: 'WORKWAY Demo MCP - construction data (RFIs, submittals, daily logs) with no Procore account',
	baseUrl: '',
	allowedOrigins: [
		'https://workway.co',
		'https://www.workway.co',
		'http://localhost:3000',
		'http://localhost:5173',
	],
	capabilities: {
		tools: { listChanged: true },
		resources: { subscribe: false, listChanged: false },
		prompts: { listChanged: false },
	},
	tools: demoTools,
	tierLimits: {
		anonymous: 500,
		free: 1000,
		pro: 5000,
		enterprise: -1,
	},
});

const app = new Hono<{ Bindings: DemoMCPEnv }>();

// Mount MCP server at root (/, /sse, /mcp, etc.)
app.route('/', mcpServer);

// Sandbox endpoint: message -> agent -> tool execute -> sandbox-shaped response
app.post('/demo/query', async (c) => {
	try {
		const body = (await c.req.json()) as { message?: string };
		const message = typeof body?.message === 'string' ? body.message.trim() : '';
		if (!message) {
			return c.json(
				{ error: 'missing_message', message: 'Request body must include { message: string }' },
				400
			);
		}

		const envWithAI = c.env as unknown as GenerateAgentMessageEnv;
		// Always use LLM for tool selection when AI binding is present (reasoning required for Claude Desktop, Codex, etc.)
		let agentOutput: AgentOutput;
		if ('AI' in c.env) {
			const llmChoice = await selectToolWithLLM(envWithAI, message);
			agentOutput = llmChoice
				? { tool: llmChoice.tool as AgentOutput['tool'], arguments: llmChoice.arguments }
				: resolveToolCall(message);
		} else {
			agentOutput = resolveToolCall(message);
		}
		const tool = demoTools[agentOutput.tool as keyof typeof demoTools];
		if (!tool) {
			return c.json(
				{ toolCall: { name: agentOutput.tool, params: agentOutput.arguments }, response: { type: 'list' as const, data: [], timeSaved: '~0 min' }, summary: 'Unknown tool.' },
				200
			);
		}

		const parsed = tool.inputSchema.safeParse(agentOutput.arguments);
		const input = parsed.success ? parsed.data : agentOutput.arguments as Record<string, unknown>;
		const toolResult = await tool.execute(input as never, c.env as never);

		const sandbox = buildSandboxResponse(agentOutput, toolResult, message);
		// Always use LLM for the reply when AI is present (reasoning over tool result)
		if ('AI' in c.env && sandbox.agentMessage) {
			const llmMessage = await generateAgentMessage(
				envWithAI,
				message,
				agentOutput.tool,
				toolResult,
				sandbox.agentMessage
			);
			if (llmMessage) {
				sandbox.agentMessage = llmMessage;
				sandbox.responseStyle = 'answer_with_details';
			}
		}
		return c.json(sandbox, 200);
	} catch (err) {
		console.error('[demo/query]', err);
		return c.json(
			{ error: 'server_error', message: err instanceof Error ? err.message : 'Internal error' },
			500
		);
	}
});

export default app;
