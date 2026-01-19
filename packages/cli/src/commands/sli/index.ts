/**
 * SLI Command
 *
 * Query Service Level Indicators from Analytics Engine.
 * Displays platform health metrics: latency, availability, error rate.
 *
 * @example
 * ```bash
 * # View all SLIs
 * workway sli
 *
 * # View specific SLI
 * workway sli --metric latency
 * workway sli --metric availability
 * workway sli --metric errors
 *
 * # Custom time range
 * workway sli --start "2024-01-01" --end "2024-01-07"
 * ```
 */

import { Command } from 'commander';
import { SLI_QUERIES } from '@workwayco/sdk';
import chalk from 'chalk';

// =============================================================================
// TYPES
// =============================================================================

interface SLIOptions {
	metric?: 'latency' | 'availability' | 'errors' | 'all';
	start?: string;
	end?: string;
	tenant?: string;
}

interface CloudflareGraphQLResponse {
	data?: {
		viewer?: {
			accounts?: Array<{
				workway_metrics?: unknown[];
				success?: Array<{ count: number }>;
				total?: Array<{ count: number }>;
				errors?: Array<{ count: number }>;
			}>;
		};
	};
	errors?: Array<{ message: string }>;
}

// =============================================================================
// CLOUDFLARE API CLIENT
// =============================================================================

async function queryAnalyticsEngine(
	query: string,
	variables: Record<string, unknown>
): Promise<CloudflareGraphQLResponse> {
	const apiToken = process.env.CLOUDFLARE_API_TOKEN;
	const accountTag = process.env.CLOUDFLARE_ACCOUNT_ID;

	if (!apiToken || !accountTag) {
		throw new Error(
			'Missing environment variables: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID required'
		);
	}

	const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query,
			variables: { ...variables, accountTag },
		}),
	});

	if (!response.ok) {
		throw new Error(`GraphQL request failed: ${response.statusText}`);
	}

	return (await response.json()) as CloudflareGraphQLResponse;
}

// =============================================================================
// TIME RANGE HELPERS
// =============================================================================

function parseTimeRange(start?: string, end?: string) {
	const endTime = end ? new Date(end) : new Date();
	const startTime = start ? new Date(start) : new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24h ago

	return {
		start: startTime.toISOString(),
		end: endTime.toISOString(),
	};
}

// =============================================================================
// SLI DISPLAY FUNCTIONS
// =============================================================================

function displayLatency(data: {
	p50?: number[];
	p95?: number[];
	p99?: number[];
}) {
	console.log(chalk.bold('\n📊 Latency'));
	console.log('─'.repeat(50));

	const p50 = data.p50?.[0] ?? 0;
	const p95 = data.p95?.[0] ?? 0;
	const p99 = data.p99?.[0] ?? 0;

	console.log(
		`P50: ${p50 < 100 ? chalk.green(p50.toFixed(0)) : chalk.yellow(p50.toFixed(0))}ms ${p50 < 100 ? '✓' : '⚠'}`
	);
	console.log(
		`P95: ${p95 < 300 ? chalk.green(p95.toFixed(0)) : chalk.yellow(p95.toFixed(0))}ms ${p95 < 300 ? '✓' : '⚠'}`
	);
	console.log(
		`P99: ${p99 < 500 ? chalk.green(p99.toFixed(0)) : chalk.red(p99.toFixed(0))}ms ${p99 < 500 ? '✓' : '✗'}`
	);
}

function displayAvailability(successCount: number, totalCount: number) {
	console.log(chalk.bold('\n🟢 Availability'));
	console.log('─'.repeat(50));

	const availability = (successCount / totalCount) * 100;
	const status = availability >= 99.9 ? '✓' : '✗';
	const color = availability >= 99.9 ? chalk.green : chalk.red;

	console.log(`Availability: ${color(availability.toFixed(2))}% ${status}`);
	console.log(`Successful: ${successCount.toLocaleString()}`);
	console.log(`Total: ${totalCount.toLocaleString()}`);
}

function displayErrorRate(errorCount: number, totalCount: number) {
	console.log(chalk.bold('\n🔴 Error Rate'));
	console.log('─'.repeat(50));

	const errorRate = (errorCount / totalCount) * 100;
	const status = errorRate < 0.1 ? '✓' : '✗';
	const color = errorRate < 0.1 ? chalk.green : chalk.red;

	console.log(`Error Rate: ${color(errorRate.toFixed(3))}% ${status}`);
	console.log(`Errors: ${errorCount.toLocaleString()}`);
	console.log(`Total: ${totalCount.toLocaleString()}`);
}

// =============================================================================
// SLI QUERY FUNCTIONS
// =============================================================================

async function checkLatency(timeRange: { start: string; end: string }) {
	const result = await queryAnalyticsEngine(SLI_QUERIES.latencyPercentiles, timeRange);

	const metrics = result.data?.viewer?.accounts?.[0]?.workway_metrics?.[0] as
		| { p50: number[]; p95: number[]; p99: number[] }
		| undefined;

	if (!metrics) {
		console.log(chalk.yellow('No latency data available for this time range'));
		return;
	}

	displayLatency(metrics);
}

async function checkAvailability(timeRange: { start: string; end: string }) {
	const result = await queryAnalyticsEngine(SLI_QUERIES.availability, timeRange);

	const account = result.data?.viewer?.accounts?.[0];
	const successCount = account?.success?.[0]?.count ?? 0;
	const totalCount = account?.total?.[0]?.count ?? 0;

	if (totalCount === 0) {
		console.log(chalk.yellow('No availability data for this time range'));
		return;
	}

	displayAvailability(successCount, totalCount);
}

async function checkErrors(timeRange: { start: string; end: string }) {
	const result = await queryAnalyticsEngine(SLI_QUERIES.errorRate, timeRange);

	const account = result.data?.viewer?.accounts?.[0];
	const errorCount = account?.errors?.[0]?.count ?? 0;
	const totalCount = account?.total?.[0]?.count ?? 0;

	if (totalCount === 0) {
		console.log(chalk.yellow('No error data for this time range'));
		return;
	}

	displayErrorRate(errorCount, totalCount);
}

async function checkAllSLIs(timeRange: { start: string; end: string }) {
	console.log(chalk.bold('\n🎯 WORKWAY Service Level Indicators'));
	console.log(chalk.dim(`Time range: ${timeRange.start} to ${timeRange.end}`));

	await checkLatency(timeRange);
	await checkAvailability(timeRange);
	await checkErrors(timeRange);

	console.log('\n');
}

// =============================================================================
// COMMAND HANDLER
// =============================================================================

async function sliCommand(options: SLIOptions) {
	try {
		const timeRange = parseTimeRange(options.start, options.end);
		const metric = options.metric ?? 'all';

		switch (metric) {
			case 'latency':
				await checkLatency(timeRange);
				break;
			case 'availability':
				await checkAvailability(timeRange);
				break;
			case 'errors':
				await checkErrors(timeRange);
				break;
			case 'all':
			default:
				await checkAllSLIs(timeRange);
				break;
		}
	} catch (error) {
		console.error(
			chalk.red('Error querying SLI data:'),
			error instanceof Error ? error.message : String(error)
		);
		process.exit(1);
	}
}

// =============================================================================
// COMMAND EXPORT
// =============================================================================

export function registerSLICommand(program: Command) {
	program
		.command('sli')
		.description('Check Service Level Indicators (SLIs) from Analytics Engine')
		.option('-m, --metric <type>', 'Specific metric: latency, availability, errors, all', 'all')
		.option('-s, --start <date>', 'Start time (ISO 8601 or human-readable)', '')
		.option('-e, --end <date>', 'End time (ISO 8601 or human-readable)', '')
		.option('-t, --tenant <id>', 'Filter by tenant ID (for multi-tenant view)', '')
		.action(sliCommand);
}

export default sliCommand;
