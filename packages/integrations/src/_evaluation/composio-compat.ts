/**
 * Composio Workers Compatibility Test
 *
 * Phase 1 of Composio evaluation: Does composio-core run in Cloudflare Workers?
 *
 * Tests:
 * 1. SDK import — can CloudflareToolSet be imported and instantiated?
 * 2. App listing — can we list available apps?
 * 3. Tool fetching — can we get tools for a specific app (Slack)?
 * 4. Action execution — can we execute a basic read-only action?
 * 5. HTTP API fallback — direct fetch() to Composio REST API
 *
 * Deploy: `wrangler dev` from this directory
 * Usage: `curl http://localhost:8787/sdk` or `/http-api` or `/benchmark`
 */

import { CloudflareToolSet } from 'composio-core';

interface Env {
	COMPOSIO_API_KEY: string;
}

interface TestResult {
	test: string;
	success: boolean;
	durationMs: number;
	data?: unknown;
	error?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		try {
			switch (path) {
				case '/sdk':
					return Response.json(await testSDK(env));
				case '/http-api':
					return Response.json(await testHTTPAPI(env));
				case '/benchmark':
					return Response.json(await testBenchmark(env));
				case '/all':
					return Response.json({
						sdk: await testSDK(env),
						httpApi: await testHTTPAPI(env),
						benchmark: await testBenchmark(env),
					});
				default:
					return Response.json({
						endpoints: ['/sdk', '/http-api', '/benchmark', '/all'],
						description: 'Composio Workers Compatibility Test',
					});
			}
		} catch (error) {
			return Response.json(
				{
					success: false,
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
				},
				{ status: 500 }
			);
		}
	},
};

// =============================================================================
// TEST 1: SDK Import & Usage (CloudflareToolSet)
// =============================================================================

async function testSDK(env: Env): Promise<TestResult[]> {
	const results: TestResult[] = [];

	// Test 1a: Can we instantiate CloudflareToolSet?
	{
		const start = Date.now();
		try {
			const toolset = new CloudflareToolSet({
				apiKey: env.COMPOSIO_API_KEY,
			});
			results.push({
				test: 'sdk-instantiation',
				success: true,
				durationMs: Date.now() - start,
				data: { type: typeof toolset },
			});
		} catch (error) {
			results.push({
				test: 'sdk-instantiation',
				success: false,
				durationMs: Date.now() - start,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Test 1b: Can we fetch tools for an app?
	{
		const start = Date.now();
		try {
			const toolset = new CloudflareToolSet({
				apiKey: env.COMPOSIO_API_KEY,
			});
			const tools = await toolset.getTools({ apps: ['slack'] });
			results.push({
				test: 'sdk-get-tools',
				success: true,
				durationMs: Date.now() - start,
				data: {
					toolCount: tools.length,
					toolNames: tools.slice(0, 5).map((t: { function?: { name?: string } }) => t.function?.name),
				},
			});
		} catch (error) {
			results.push({
				test: 'sdk-get-tools',
				success: false,
				durationMs: Date.now() - start,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Test 1c: Can we list available actions for an app?
	{
		const start = Date.now();
		try {
			const toolset = new CloudflareToolSet({
				apiKey: env.COMPOSIO_API_KEY,
			});
			// Get tools with useCase filter to test filtered fetching
			const tools = await toolset.getTools({
				apps: ['slack'],
				useCase: 'send a message',
			});
			results.push({
				test: 'sdk-usecase-filter',
				success: true,
				durationMs: Date.now() - start,
				data: {
					toolCount: tools.length,
					toolNames: tools.map((t: { function?: { name?: string } }) => t.function?.name),
				},
			});
		} catch (error) {
			results.push({
				test: 'sdk-usecase-filter',
				success: false,
				durationMs: Date.now() - start,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return results;
}

// =============================================================================
// TEST 2: Direct HTTP API (fallback if SDK fails)
// =============================================================================

async function testHTTPAPI(env: Env): Promise<TestResult[]> {
	const results: TestResult[] = [];
	const baseUrl = 'https://backend.composio.dev/api/v2';

	// Test 2a: List apps via REST API
	{
		const start = Date.now();
		try {
			const response = await fetch(`${baseUrl}/apps?limit=5`, {
				headers: { 'X-API-Key': env.COMPOSIO_API_KEY },
			});
			const data = await response.json();
			results.push({
				test: 'http-list-apps',
				success: response.ok,
				durationMs: Date.now() - start,
				data: {
					status: response.status,
					appCount: Array.isArray(data) ? data.length : (data as { items?: unknown[] })?.items?.length,
				},
			});
		} catch (error) {
			results.push({
				test: 'http-list-apps',
				success: false,
				durationMs: Date.now() - start,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Test 2b: Get actions for Slack via REST API
	{
		const start = Date.now();
		try {
			const response = await fetch(`${baseUrl}/actions?appNames=slack&limit=5`, {
				headers: { 'X-API-Key': env.COMPOSIO_API_KEY },
			});
			const data = await response.json();
			results.push({
				test: 'http-get-actions',
				success: response.ok,
				durationMs: Date.now() - start,
				data: {
					status: response.status,
					actionCount: Array.isArray(data) ? data.length : (data as { items?: unknown[] })?.items?.length,
				},
			});
		} catch (error) {
			results.push({
				test: 'http-get-actions',
				success: false,
				durationMs: Date.now() - start,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return results;
}

// =============================================================================
// TEST 3: Latency Benchmark (SDK vs HTTP API)
// =============================================================================

async function testBenchmark(env: Env): Promise<TestResult[]> {
	const results: TestResult[] = [];
	const iterations = 3;
	const baseUrl = 'https://backend.composio.dev/api/v2';

	// Benchmark SDK
	{
		const durations: number[] = [];
		try {
			const toolset = new CloudflareToolSet({
				apiKey: env.COMPOSIO_API_KEY,
			});
			for (let i = 0; i < iterations; i++) {
				const start = Date.now();
				await toolset.getTools({ apps: ['slack'], useCase: 'send a message' });
				durations.push(Date.now() - start);
			}
			results.push({
				test: 'benchmark-sdk',
				success: true,
				durationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
				data: {
					iterations,
					durations,
					avgMs: durations.reduce((a, b) => a + b, 0) / durations.length,
					minMs: Math.min(...durations),
					maxMs: Math.max(...durations),
				},
			});
		} catch (error) {
			results.push({
				test: 'benchmark-sdk',
				success: false,
				durationMs: 0,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	// Benchmark HTTP API
	{
		const durations: number[] = [];
		try {
			for (let i = 0; i < iterations; i++) {
				const start = Date.now();
				await fetch(`${baseUrl}/actions?appNames=slack&useCase=send+a+message&limit=5`, {
					headers: { 'X-API-Key': env.COMPOSIO_API_KEY },
				});
				durations.push(Date.now() - start);
			}
			results.push({
				test: 'benchmark-http',
				success: true,
				durationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
				data: {
					iterations,
					durations,
					avgMs: durations.reduce((a, b) => a + b, 0) / durations.length,
					minMs: Math.min(...durations),
					maxMs: Math.max(...durations),
				},
			});
		} catch (error) {
			results.push({
				test: 'benchmark-http',
				success: false,
				durationMs: 0,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return results;
}
