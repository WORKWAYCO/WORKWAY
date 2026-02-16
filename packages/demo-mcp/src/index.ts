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
import { generateAgentMessage, selectToolWithLLM, streamAgentMessage, type GenerateAgentMessageEnv } from './agent-llm';

export interface DemoMCPEnv {
	KV: KVNamespace;
	DB: D1Database;
	/** When set, the demo uses OpenAI for tool selection + reply generation. */
	OPENAI_API_KEY?: string;
	/** OpenAI model id for the demo (defaults in code). */
	OPENAI_MODEL?: string;
	/** Optional OpenAI base URL override (defaults to https://api.openai.com/v1). */
	OPENAI_BASE_URL?: string;
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

function hasOpenAI(env: GenerateAgentMessageEnv): boolean {
	return typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.trim().length > 0;
}

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
		// Use OpenAI for tool selection when configured (reasoning required for Claude Desktop, Codex, etc.)
		let agentOutput: AgentOutput;
		if (hasOpenAI(envWithAI)) {
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
		// Use OpenAI for the reply when configured (reasoning over tool result)
		if (hasOpenAI(envWithAI) && sandbox.agentMessage) {
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

const SSE_HEADERS = {
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache',
	'Connection': 'keep-alive',
} as const;

/**
 * POST /demo/query/stream
 * Same as /demo/query but streams the agent message as SSE: start → content chunks → done.
 * Body: { message: string }
 */
app.post('/demo/query/stream', async (c) => {
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
		let agentOutput: AgentOutput;
		if (hasOpenAI(envWithAI)) {
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
				{ error: 'unknown_tool', tool: agentOutput.tool },
				400
			);
		}

		const parsed = tool.inputSchema.safeParse(agentOutput.arguments);
		const input = parsed.success ? parsed.data : agentOutput.arguments as Record<string, unknown>;
		const toolResult = await tool.execute(input as never, c.env as never);
		const sandbox = buildSandboxResponse(agentOutput, toolResult, message);

		const encoder = new TextEncoder();
		const toSSE = (event: object) => `data: ${JSON.stringify(event)}\n\n`;

		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				// 1. Send start event (toolCall, response, summary, responseStyle)
				controller.enqueue(encoder.encode(toSSE({
					type: 'start',
					toolCall: { name: sandbox.toolCall.name, params: sandbox.toolCall.params },
					response: sandbox.response,
					summary: sandbox.summary,
					responseStyle: sandbox.responseStyle ?? 'cards',
				})));

				// 2. Stream agent message when AI is available
				if (hasOpenAI(envWithAI) && sandbox.agentMessage) {
					const agentStream = streamAgentMessage(envWithAI, message, agentOutput.tool, toolResult);
					if (agentStream) {
						const reader = agentStream.getReader();
						try {
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								controller.enqueue(value);
							}
						} finally {
							reader.releaseLock();
						}
					} else {
						// Fallback: send template as single content event
						controller.enqueue(encoder.encode(toSSE({ type: 'content', content: sandbox.agentMessage })));
					}
				} else {
					controller.enqueue(encoder.encode(toSSE({ type: 'content', content: sandbox.agentMessage ?? sandbox.summary ?? '' })));
				}

				// 3. Send done event
				controller.enqueue(encoder.encode(toSSE({
					type: 'done',
					timeSaved: sandbox.response.timeSaved,
				})));
				controller.close();
			},
		});

		return new Response(stream, { headers: SSE_HEADERS });
	} catch (err) {
		console.error('[demo/query/stream]', err);
		return c.json(
			{ error: 'server_error', message: err instanceof Error ? err.message : 'Internal error' },
			500
		);
	}
});

export default app;
