/**
 * AI Cost Estimate Command
 *
 * Honest cost estimation for AI workflows.
 * "Metrics must be accurate. Claims must be verifiable." - CREATE Something Standards
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { padRight } from '../../lib/format.js';
import { AI_MODELS } from './models.js';

interface EstimateOptions {
	executions?: number;
	tokensPerExecution?: number;
	model?: string;
}

export async function aiEstimateCommand(options: EstimateOptions = {}): Promise<void> {
	Logger.header('AI Cost Estimator');
	Logger.info('Honest cost projections for your AI workflow');
	Logger.blank();

	// Get parameters
	let executions = options.executions;
	let tokensPerExecution = options.tokensPerExecution;
	let model = options.model;

	if (!executions || !tokensPerExecution || !model) {
		const answers = await inquirer.prompt([
			{
				type: 'number',
				name: 'executions',
				message: 'Expected monthly executions:',
				default: 1000,
				when: () => !executions,
				validate: (input: number) => input > 0 || 'Must be greater than 0',
			},
			{
				type: 'number',
				name: 'tokensPerExecution',
				message: 'Average tokens per execution (input + output):',
				default: 500,
				when: () => !tokensPerExecution,
				validate: (input: number) => input > 0 || 'Must be greater than 0',
			},
			{
				type: 'list',
				name: 'model',
				message: 'AI model:',
				when: () => !model,
				choices: [
					{ name: 'Llama 2 7B (fast) - $0.005/1M tokens', value: 'LLAMA_2_7B' },
					{ name: 'Llama 3 8B (balanced) - $0.01/1M tokens', value: 'LLAMA_3_8B' },
					{ name: 'Mistral 7B (quality) - $0.02/1M tokens', value: 'MISTRAL_7B' },
				],
				default: 'LLAMA_3_8B',
			},
		]);

		executions = executions || answers.executions;
		tokensPerExecution = tokensPerExecution || answers.tokensPerExecution;
		model = model || answers.model;
	}

	// Find model info
	const modelInfo = AI_MODELS.text.find((m) => m.alias === model || m.id === model);
	if (!modelInfo) {
		Logger.error(`Unknown model: ${model}`);
		process.exit(1);
	}

	// Calculate costs
	const totalTokens = executions! * tokensPerExecution!;
	const aiCost = (totalTokens / 1_000_000) * modelInfo.cost;

	// Cloudflare Workers compute cost (rough estimate)
	// Workers: $0.50 per million requests (first 10M free)
	// CPU time: $0.02 per million ms
	const workerRequestCost = (executions! / 1_000_000) * 0.5;
	const cpuTimeMs = executions! * 50; // ~50ms per AI call
	const cpuCost = (cpuTimeMs / 1_000_000) * 0.02;

	const totalCost = aiCost + workerRequestCost + cpuCost;

	// Display results
	Logger.section('Input Parameters');
	console.log(chalk.gray('─'.repeat(50)));
	console.log(`Monthly executions:     ${chalk.cyan(executions!.toLocaleString())}`);
	console.log(`Tokens per execution:   ${chalk.cyan(tokensPerExecution!.toLocaleString())}`);
	console.log(`Total monthly tokens:   ${chalk.cyan(totalTokens.toLocaleString())}`);
	console.log(`Model:                  ${chalk.cyan(modelInfo.name)}`);
	console.log(chalk.gray('─'.repeat(50)));

	Logger.blank();
	Logger.section('Cost Breakdown');
	console.log(chalk.gray('─'.repeat(50)));
	console.log(`AI inference:           ${chalk.green('$' + aiCost.toFixed(4))}`);
	console.log(`Workers requests:       ${chalk.green('$' + workerRequestCost.toFixed(4))}`);
	console.log(`CPU time:               ${chalk.green('$' + cpuCost.toFixed(4))}`);
	console.log(chalk.gray('─'.repeat(50)));
	console.log(chalk.bold(`Total monthly cost:     ${chalk.green('$' + totalCost.toFixed(4))}`));
	console.log(chalk.gray('─'.repeat(50)));

	// Per-execution cost
	const costPerExecution = totalCost / executions!;
	Logger.blank();
	console.log(`Cost per execution:     ${chalk.green('$' + costPerExecution.toFixed(6))}`);

	// Profitability analysis
	Logger.blank();
	Logger.section('Profitability Analysis');

	const pricePoints = [3, 5, 8, 10, 15];
	console.log(chalk.gray('─'.repeat(60)));
	console.log(
		chalk.gray(
			padRight('Price/mo', 12) +
				padRight('Revenue', 12) +
				padRight('Cost', 10) +
				padRight('Profit', 10) +
				'Margin'
		)
	);
	console.log(chalk.gray('─'.repeat(60)));

	for (const price of pricePoints) {
		const revenue = price;
		const profit = revenue - totalCost;
		const margin = ((profit / revenue) * 100).toFixed(0);
		const marginColor = profit > 0 ? (parseInt(margin) > 50 ? chalk.green : chalk.yellow) : chalk.red;

		console.log(
			padRight(`$${price}`, 12) +
				chalk.cyan(padRight(`$${revenue.toFixed(2)}`, 12)) +
				chalk.yellow(padRight(`$${totalCost.toFixed(2)}`, 10)) +
				(profit > 0 ? chalk.green : chalk.red)(padRight(`$${profit.toFixed(2)}`, 10)) +
				marginColor(`${margin}%`)
		);
	}
	console.log(chalk.gray('─'.repeat(60)));

	// Comparison with external APIs
	Logger.blank();
	Logger.section('vs External APIs');

	const openAICost = (totalTokens / 1_000_000) * 0.15; // GPT-4o-mini input
	const anthropicCost = (totalTokens / 1_000_000) * 0.25; // Claude Haiku input

	console.log(chalk.gray('─'.repeat(50)));
	console.log(`Workers AI (${modelInfo.name}):  ${chalk.green('$' + aiCost.toFixed(4))}`);
	console.log(`OpenAI (GPT-4o-mini):      ${chalk.red('$' + openAICost.toFixed(4))} (${(openAICost / aiCost).toFixed(0)}x more)`);
	console.log(`Anthropic (Claude Haiku): ${chalk.red('$' + anthropicCost.toFixed(4))} (${(anthropicCost / aiCost).toFixed(0)}x more)`);
	console.log(chalk.gray('─'.repeat(50)));

	Logger.blank();
	Logger.info('Estimates based on Cloudflare Workers AI pricing. Actual costs may vary.');
	Logger.log('Learn more: https://developers.cloudflare.com/workers-ai/platform/pricing/');
}

