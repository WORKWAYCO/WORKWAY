/**
 * AI Models Command
 *
 * Lists available Cloudflare Workers AI models with honest cost data.
 * "Good design is honest" - Dieter Rams
 */

import chalk from 'chalk';
import { Logger } from '../../utils/logger.js';

/**
 * Cloudflare Workers AI Model Catalog
 *
 * Costs are per 1 million tokens (or per image for image models).
 * Data from: https://developers.cloudflare.com/workers-ai/models/
 */
const AI_MODELS = {
	text: [
		{
			id: '@cf/meta/llama-2-7b-chat-int8',
			name: 'Llama 2 7B',
			alias: 'LLAMA_2_7B',
			cost: 0.005,
			speed: 'fast',
			quality: 'good',
			context: 4096,
			description: 'Fast, efficient. Best for simple tasks.',
		},
		{
			id: '@cf/meta/llama-3-8b-instruct',
			name: 'Llama 3 8B',
			alias: 'LLAMA_3_8B',
			cost: 0.01,
			speed: 'balanced',
			quality: 'better',
			context: 8192,
			description: 'Balanced speed/quality. Recommended default.',
		},
		{
			id: '@cf/mistral/mistral-7b-instruct-v0.1',
			name: 'Mistral 7B',
			alias: 'MISTRAL_7B',
			cost: 0.02,
			speed: 'moderate',
			quality: 'best',
			context: 8192,
			description: 'Highest quality reasoning. Complex tasks.',
		},
		{
			id: '@cf/microsoft/phi-2',
			name: 'Phi-2',
			alias: 'PHI_2',
			cost: 0.005,
			speed: 'fast',
			quality: 'good',
			context: 2048,
			description: 'Microsoft compact model. Quick responses.',
		},
		{
			id: '@cf/deepseek-ai/deepseek-coder-6.7b-instruct-awq',
			name: 'DeepSeek Coder',
			alias: 'DEEPSEEK_CODER',
			cost: 0.01,
			speed: 'balanced',
			quality: 'best',
			context: 4096,
			description: 'Optimized for code generation.',
		},
	],
	embeddings: [
		{
			id: '@cf/baai/bge-small-en-v1.5',
			name: 'BGE Small',
			alias: 'BGE_SMALL',
			cost: 0.001,
			dimensions: 384,
			description: 'Fast embeddings. Good for large datasets.',
		},
		{
			id: '@cf/baai/bge-base-en-v1.5',
			name: 'BGE Base',
			alias: 'BGE_BASE',
			cost: 0.002,
			dimensions: 768,
			description: 'Balanced. Recommended default.',
		},
		{
			id: '@cf/baai/bge-large-en-v1.5',
			name: 'BGE Large',
			alias: 'BGE_LARGE',
			cost: 0.004,
			dimensions: 1024,
			description: 'Highest quality. Best accuracy.',
		},
	],
	image: [
		{
			id: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
			name: 'Stable Diffusion XL',
			alias: 'STABLE_DIFFUSION_XL',
			cost: 0.02,
			resolution: '1024x1024',
			description: 'High quality image generation.',
		},
		{
			id: '@cf/lykon/dreamshaper-8-lcm',
			name: 'DreamShaper',
			alias: 'DREAMSHAPER',
			cost: 0.01,
			resolution: '512x512',
			description: 'Fast artistic images.',
		},
	],
	audio: [
		{
			id: '@cf/openai/whisper',
			name: 'Whisper',
			alias: 'WHISPER',
			cost: 0.006,
			languages: '99+',
			description: 'Speech-to-text. Multi-language.',
		},
		{
			id: '@cf/openai/whisper-tiny-en-v1',
			name: 'Whisper Tiny',
			alias: 'WHISPER_TINY',
			cost: 0.002,
			languages: 'English',
			description: 'Fast English-only transcription.',
		},
	],
	translation: [
		{
			id: '@cf/meta/m2m100-1.2b',
			name: 'M2M100',
			alias: 'M2M100',
			cost: 0.005,
			languages: '100+',
			description: 'Multi-language translation.',
		},
	],
	classification: [
		{
			id: '@cf/huggingface/distilbert-sst-2-int8',
			name: 'DistilBERT SST-2',
			alias: 'DISTILBERT_SST2',
			cost: 0.001,
			description: 'Sentiment analysis (positive/negative).',
		},
		{
			id: '@cf/microsoft/resnet-50',
			name: 'ResNet-50',
			alias: 'RESNET_50',
			cost: 0.002,
			description: 'Image classification (1000 categories).',
		},
	],
};

interface ModelsOptions {
	type?: 'text' | 'embeddings' | 'image' | 'audio' | 'translation' | 'classification' | 'all';
	json?: boolean;
}

export async function aiModelsCommand(options: ModelsOptions = {}): Promise<void> {
	const filterType = options.type || 'all';

	if (options.json) {
		// JSON output for programmatic use
		const output = filterType === 'all' ? AI_MODELS : { [filterType]: AI_MODELS[filterType as keyof typeof AI_MODELS] };
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	Logger.header('Cloudflare Workers AI Models');
	Logger.info('Costs shown per 1M tokens (text/embeddings) or per generation (image/audio)');
	Logger.blank();

	// Text Models
	if (filterType === 'all' || filterType === 'text') {
		console.log(chalk.bold.cyan('TEXT GENERATION'));
		console.log(chalk.gray('─'.repeat(80)));
		console.log(
			chalk.gray(
				padRight('Model', 20) +
					padRight('Alias', 16) +
					padRight('Cost/1M', 10) +
					padRight('Context', 10) +
					'Description'
			)
		);
		console.log(chalk.gray('─'.repeat(80)));

		for (const model of AI_MODELS.text) {
			const costColor = model.cost <= 0.005 ? chalk.green : model.cost <= 0.01 ? chalk.yellow : chalk.red;
			console.log(
				padRight(model.name, 20) +
					chalk.cyan(padRight(model.alias, 16)) +
					costColor(padRight(`$${model.cost.toFixed(3)}`, 10)) +
					padRight(`${model.context}`, 10) +
					chalk.gray(model.description)
			);
		}
		console.log();
	}

	// Embeddings
	if (filterType === 'all' || filterType === 'embeddings') {
		console.log(chalk.bold.cyan('EMBEDDINGS'));
		console.log(chalk.gray('─'.repeat(80)));
		console.log(
			chalk.gray(
				padRight('Model', 20) +
					padRight('Alias', 16) +
					padRight('Cost/1M', 10) +
					padRight('Dims', 10) +
					'Description'
			)
		);
		console.log(chalk.gray('─'.repeat(80)));

		for (const model of AI_MODELS.embeddings) {
			console.log(
				padRight(model.name, 20) +
					chalk.cyan(padRight(model.alias, 16)) +
					chalk.green(padRight(`$${model.cost.toFixed(3)}`, 10)) +
					padRight(`${model.dimensions}`, 10) +
					chalk.gray(model.description)
			);
		}
		console.log();
	}

	// Image Generation
	if (filterType === 'all' || filterType === 'image') {
		console.log(chalk.bold.cyan('IMAGE GENERATION'));
		console.log(chalk.gray('─'.repeat(80)));
		console.log(
			chalk.gray(
				padRight('Model', 24) +
					padRight('Alias', 20) +
					padRight('Cost/img', 10) +
					padRight('Resolution', 12) +
					'Description'
			)
		);
		console.log(chalk.gray('─'.repeat(80)));

		for (const model of AI_MODELS.image) {
			console.log(
				padRight(model.name, 24) +
					chalk.cyan(padRight(model.alias, 20)) +
					chalk.yellow(padRight(`$${model.cost.toFixed(2)}`, 10)) +
					padRight(model.resolution, 12) +
					chalk.gray(model.description)
			);
		}
		console.log();
	}

	// Audio
	if (filterType === 'all' || filterType === 'audio') {
		console.log(chalk.bold.cyan('AUDIO (Speech-to-Text)'));
		console.log(chalk.gray('─'.repeat(80)));
		console.log(
			chalk.gray(
				padRight('Model', 20) +
					padRight('Alias', 16) +
					padRight('Cost/min', 10) +
					padRight('Languages', 12) +
					'Description'
			)
		);
		console.log(chalk.gray('─'.repeat(80)));

		for (const model of AI_MODELS.audio) {
			console.log(
				padRight(model.name, 20) +
					chalk.cyan(padRight(model.alias, 16)) +
					chalk.green(padRight(`$${model.cost.toFixed(3)}`, 10)) +
					padRight(model.languages, 12) +
					chalk.gray(model.description)
			);
		}
		console.log();
	}

	// Translation
	if (filterType === 'all' || filterType === 'translation') {
		console.log(chalk.bold.cyan('TRANSLATION'));
		console.log(chalk.gray('─'.repeat(80)));

		for (const model of AI_MODELS.translation) {
			console.log(
				padRight(model.name, 20) +
					chalk.cyan(padRight(model.alias, 16)) +
					chalk.green(padRight(`$${model.cost.toFixed(3)}/1M`, 14)) +
					chalk.gray(model.description)
			);
		}
		console.log();
	}

	// Classification
	if (filterType === 'all' || filterType === 'classification') {
		console.log(chalk.bold.cyan('CLASSIFICATION'));
		console.log(chalk.gray('─'.repeat(80)));

		for (const model of AI_MODELS.classification) {
			console.log(
				padRight(model.name, 20) +
					chalk.cyan(padRight(model.alias, 16)) +
					chalk.green(padRight(`$${model.cost.toFixed(3)}/1M`, 14)) +
					chalk.gray(model.description)
			);
		}
		console.log();
	}

	// Cost comparison
	Logger.section('Cost Comparison vs External APIs');
	console.log(chalk.gray('─'.repeat(60)));
	console.log(
		padRight('Provider', 20) +
			padRight('Model', 20) +
			'Cost/1M tokens'
	);
	console.log(chalk.gray('─'.repeat(60)));
	console.log(
		chalk.green(padRight('Workers AI', 20)) +
			padRight('Llama 3 8B', 20) +
			chalk.green('$0.01')
	);
	console.log(
		chalk.red(padRight('OpenAI', 20)) +
			padRight('GPT-4o-mini', 20) +
			chalk.red('$0.15 (input) / $0.60 (output)')
	);
	console.log(
		chalk.red(padRight('Anthropic', 20)) +
			padRight('Claude Haiku', 20) +
			chalk.red('$0.25 (input) / $1.25 (output)')
	);
	console.log();

	Logger.info('Workers AI runs on Cloudflare edge. No API keys. Zero egress.');
	Logger.blank();
	Logger.log('Usage in workflow:');
	Logger.code(`import { AIModels } from '@workway/sdk/workers-ai';
const result = await ai.generateText({ model: AIModels.LLAMA_3_8B, prompt });`);
}

function padRight(str: string, length: number): string {
	return str.padEnd(length);
}

export { AI_MODELS };
