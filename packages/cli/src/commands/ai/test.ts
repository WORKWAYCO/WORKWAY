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
import { createAPIClient } from '../../lib/api-client.js';
import { loadCredentials } from '../../lib/auth.js';
import { loadConfig } from '../../lib/config.js';

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
			// Live mode - call actual Workers AI via WORKWAY API
			const credentials = await loadCredentials();
			if (!credentials) {
				spinner.stop();
				Logger.blank();
				Logger.warn('Live mode requires authentication.');
				Logger.blank();
				Logger.log('Please log in first:');
				Logger.code('workway login');
				Logger.blank();
				Logger.log('Or use mock mode to test without authentication:');
				Logger.code('workway ai test --mock');
				return;
			}

			const config = await loadConfig();
			const client = createAPIClient(config.apiUrl, credentials.token);

			// Map model alias to API model name
			const modelAlias = modelInfo.alias?.replace('LLAMA_3_8B', 'llama-3-8b')
				.replace('LLAMA_2_7B', 'llama-2-7b')
				.replace('MISTRAL_7B', 'mistral-7b')
				.replace('PHI_2', 'phi-2')
				.replace('GEMMA_7B', 'gemma-7b')
				.toLowerCase()
				.replace(/_/g, '-') || 'llama-3-8b';

			try {
				const response = await client.aiGenerate({
					prompt: testPrompt!,
					model: modelAlias,
					maxTokens: 256,
					temperature: 0.7,
				});

				result = {
					text: response.text,
					tokens: response.metrics.outputTokens,
					latency: response.metrics.latencyMs,
				};
			} catch (error: any) {
				spinner.fail('AI inference failed');
				Logger.blank();
				if (error.statusCode === 401) {
					Logger.error('Authentication expired. Please log in again:');
					Logger.code('workway login');
				} else {
					Logger.error(error.message);
				}
				process.exit(1);
			}
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
		if (options.mock) {
			Logger.info('This was a mock response. Run without --mock for live AI.');
		} else {
			Logger.success('Live Workers AI response via Cloudflare edge.');
		}
	} catch (error: any) {
		spinner.fail('Failed to generate response');
		Logger.error(error.message);
		process.exit(1);
	}
}
