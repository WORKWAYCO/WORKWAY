/**
 * AI Test Command
 *
 * Test Workers AI models directly from the CLI.
 * Functional transparency: see exactly what happens.
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import { AI_MODELS } from './models.js';

interface TestOptions {
	model?: string;
	mock?: boolean;
	json?: boolean;
}

/**
 * Mock AI response for testing without API calls
 */
function mockAIResponse(prompt: string, model: string): { text: string; tokens: number; latency: number } {
	const words = prompt.split(' ').length;
	const outputTokens = Math.min(words * 3, 200);

	// Simulate different model behaviors
	const responses: Record<string, string> = {
		'@cf/meta/llama-2-7b-chat-int8': `[Llama 2 Mock] Processing: "${prompt.slice(0, 50)}..." - This is a simulated response demonstrating the Llama 2 model's output style.`,
		'@cf/meta/llama-3-8b-instruct': `[Llama 3 Mock] Analyzing your request: "${prompt.slice(0, 50)}..." - This simulated response shows how Llama 3 would handle this prompt with improved reasoning.`,
		'@cf/mistral/mistral-7b-instruct-v0.1': `[Mistral Mock] Comprehensive analysis of: "${prompt.slice(0, 50)}..." - Mistral provides detailed, nuanced responses with strong reasoning capabilities.`,
	};

	return {
		text: responses[model] || `[Mock Response] Your prompt was: "${prompt.slice(0, 100)}..."`,
		tokens: outputTokens,
		latency: Math.floor(Math.random() * 500) + 200,
	};
}

export async function aiTestCommand(prompt?: string, options: TestOptions = {}): Promise<void> {
	Logger.header('Test Workers AI');

	// Get prompt if not provided
	let testPrompt = prompt;
	if (!testPrompt) {
		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'prompt',
				message: 'Enter prompt to test:',
				default: 'Explain the concept of serverless computing in two sentences.',
				validate: (input: string) => {
					if (!input || input.trim().length === 0) {
						return 'Prompt is required';
					}
					return true;
				},
			},
		]);
		testPrompt = answers.prompt;
	}

	// Select model
	let selectedModel = options.model;
	if (!selectedModel) {
		const modelChoices = AI_MODELS.text.map((m) => ({
			name: `${m.name} - $${m.cost.toFixed(3)}/1M tokens (${m.description})`,
			value: m.id,
		}));

		const modelAnswer = await inquirer.prompt([
			{
				type: 'list',
				name: 'model',
				message: 'Select model:',
				choices: modelChoices,
				default: '@cf/meta/llama-3-8b-instruct',
			},
		]);
		selectedModel = modelAnswer.model;
	}

	// Find model info
	const modelInfo = AI_MODELS.text.find((m) => m.id === selectedModel || m.alias === selectedModel);
	if (!modelInfo) {
		Logger.error(`Unknown model: ${selectedModel}`);
		Logger.log('Run `workway ai models` to see available models');
		process.exit(1);
	}

	Logger.blank();
	Logger.section('Request');
	Logger.listItem(`Model: ${modelInfo.name} (${modelInfo.alias})`);
	Logger.listItem(`Prompt: "${testPrompt!.slice(0, 80)}${testPrompt!.length > 80 ? '...' : ''}"`);
	Logger.listItem(`Mode: ${options.mock ? 'Mock (no API call)' : 'Live'}`);

	const spinner = Logger.spinner('Generating response...');
	const startTime = Date.now();

	try {
		let result: { text: string; tokens: number; latency: number };

		if (options.mock) {
			// Mock mode - no actual API call
			await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate latency
			result = mockAIResponse(testPrompt!, selectedModel!);
		} else {
			// Live mode - would call actual API
			// For now, show instructions since we don't have auth context
			spinner.stop();
			Logger.blank();
			Logger.warn('Live mode requires authentication and Workers AI binding.');
			Logger.blank();
			Logger.log('To test with live AI:');
			Logger.log('1. Create a workflow project: `workway workflow init --ai`');
			Logger.log('2. Run `workway workflow test --live` in the project directory');
			Logger.blank();
			Logger.log('For now, use mock mode to see the flow:');
			Logger.code('workway ai test --mock');
			return;
		}

		const endTime = Date.now();
		const actualLatency = endTime - startTime;

		spinner.succeed('Response generated');

		// Calculate costs
		const inputTokens = Math.ceil(testPrompt!.split(' ').length * 1.3); // Rough estimate
		const totalTokens = inputTokens + result.tokens;
		const cost = (totalTokens / 1_000_000) * modelInfo.cost;

		Logger.blank();
		Logger.section('Response');
		console.log(chalk.white(result.text));

		Logger.blank();
		Logger.section('Metrics');
		console.log(chalk.gray('─'.repeat(40)));
		console.log(`Model:          ${chalk.cyan(modelInfo.name)}`);
		console.log(`Input tokens:   ${chalk.yellow(inputTokens.toString())}`);
		console.log(`Output tokens:  ${chalk.yellow(result.tokens.toString())}`);
		console.log(`Total tokens:   ${chalk.yellow(totalTokens.toString())}`);
		console.log(`Latency:        ${chalk.yellow(actualLatency + 'ms')}`);
		console.log(`Cost:           ${chalk.green('$' + cost.toFixed(6))}`);
		console.log(chalk.gray('─'.repeat(40)));

		// Cost projection
		Logger.blank();
		Logger.section('Cost Projection');
		const costPer1000 = cost * 1000;
		const costPer10000 = cost * 10000;
		console.log(`1,000 executions:   ${chalk.green('$' + costPer1000.toFixed(4))}`);
		console.log(`10,000 executions:  ${chalk.green('$' + costPer10000.toFixed(4))}`);

		if (options.json) {
			Logger.blank();
			console.log(
				JSON.stringify(
					{
						model: modelInfo.id,
						prompt: testPrompt,
						response: result.text,
						metrics: {
							inputTokens,
							outputTokens: result.tokens,
							totalTokens,
							latencyMs: actualLatency,
							costUsd: cost,
						},
					},
					null,
					2
				)
			);
		}

		Logger.blank();
		Logger.info('This was a mock response. Use in a workflow for live AI.');
	} catch (error: any) {
		spinner.fail('Failed to generate response');
		Logger.error(error.message);
		process.exit(1);
	}
}
