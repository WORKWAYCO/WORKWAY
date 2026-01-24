/**
 * Workflow Build Command
 *
 * Assembles workflow parts for production deployment.
 * The chassis (TypeScript) + engine (Workers) + integrations = ready to ship.
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../utils/logger.js';
import { loadProjectConfig } from '../../lib/config.js';
import { validateWorkflowProject, getWorkflowPath } from '../../utils/workflow-validation.js';
import { validateWorkflowFile, formatValidationResults, type ValidationResult } from '../../lib/workflow-validator.js';

interface BuildOptions {
	outDir?: string;
	minify?: boolean;
	sourcemap?: boolean;
}

export async function workflowBuildCommand(options: BuildOptions): Promise<void> {
	try {
		Logger.header('Assemble Workflow');

		// Validate workflow project (DRY: shared utility)
		await validateWorkflowProject();
		const workflowPath = getWorkflowPath();

		// Load project config
		const projectConfig = await loadProjectConfig();
		const outDir = options.outDir || projectConfig?.build?.outDir || './dist';
		const minify = options.minify ?? projectConfig?.build?.minify ?? true;
		const sourcemap = options.sourcemap ?? true;

		Logger.section('Build Configuration');
		Logger.listItem(`Source: workflow.ts`);
		Logger.listItem(`Output: ${outDir}`);
		Logger.listItem(`Minify: ${minify}`);
		Logger.listItem(`Sourcemap: ${sourcemap}`);
		Logger.blank();

		// Ensure output directory exists
		const absoluteOutDir = path.resolve(process.cwd(), outDir);
		await fs.ensureDir(absoluteOutDir);

		// Step 1: Validate workflow structure with comprehensive schema validation
		const spinner1 = Logger.spinner('Validating workflow...');
		let validationResult: ValidationResult;
		try {
			validationResult = await validateWorkflowFile(workflowPath);

			if (validationResult.errors.length > 0) {
				spinner1.fail(`Validation failed (${validationResult.errors.length} error${validationResult.errors.length > 1 ? 's' : ''})`);
				Logger.blank();
				for (const line of formatValidationResults(validationResult)) {
					if (line.startsWith('[ERROR]')) {
						Logger.error(line.replace('[ERROR] ', ''));
					} else if (line.startsWith('[WARN]')) {
						Logger.warn(line.replace('[WARN]  ', ''));
					} else {
						Logger.log(`        ${line.replace('        Suggestion: ', '💡 ')}`);
					}
				}
				process.exit(1);
			}

			if (validationResult.warnings.length > 0) {
				spinner1.warn(`Workflow validated (${validationResult.warnings.length} warning${validationResult.warnings.length > 1 ? 's' : ''})`);
				Logger.blank();
				for (const warning of validationResult.warnings) {
					Logger.warn(`${warning.code}: ${warning.message}`);
					if (warning.suggestion) {
						Logger.log(`        💡 ${warning.suggestion}`);
					}
				}
				Logger.blank();
			} else {
				spinner1.succeed('Workflow validated');
			}

			// Display extracted metadata
			if (validationResult.metadata?.name) {
				Logger.listItem(`Name: ${validationResult.metadata.name}`);
			}
			if (validationResult.metadata?.type) {
				Logger.listItem(`Type: ${validationResult.metadata.type}`);
			}
			if (validationResult.metadata?.integrations?.length) {
				Logger.listItem(`Integrations: ${validationResult.metadata.integrations.join(', ')}`);
			}
			if (validationResult.metadata?.trigger) {
				Logger.listItem(`Trigger: ${validationResult.metadata.trigger}`);
			}
		if (validationResult.metadata?.hasAI) {
			Logger.listItem(`Turbo: Workers AI enabled`);
		}
			Logger.blank();
		} catch (error: any) {
			spinner1.fail('Validation failed');
			Logger.error(error.message);
			process.exit(1);
		}

		// Step 2: Check for workway.config.json
		const spinner2 = Logger.spinner('Checking configuration...');
		const configPath = path.join(process.cwd(), 'workway.config.json');
		const hasConfig = await fs.pathExists(configPath);
		if (hasConfig) {
			spinner2.succeed('Configuration found');
		} else {
			spinner2.warn('No workway.config.json found (using defaults)');
		}

		// Step 3: Bundle with esbuild
		const spinner3 = Logger.spinner('Assembling parts...');
		try {
			await bundleWorkflow(workflowPath, absoluteOutDir, minify, sourcemap);
			spinner3.succeed('Parts assembled');
		} catch (error: any) {
			spinner3.fail('Bundle failed');
			Logger.error(error.message);
			process.exit(1);
		}

		// Step 4: Copy manifest files
		const spinner4 = Logger.spinner('Copying assets...');
		try {
			await copyAssets(process.cwd(), absoluteOutDir);
			spinner4.succeed('Assets copied');
		} catch (error: any) {
			spinner4.warn('Some assets could not be copied');
		}

		// Step 5: Generate manifest with validation metadata
		const spinner5 = Logger.spinner('Generating manifest...');
		try {
			await generateManifest(process.cwd(), absoluteOutDir, hasConfig ? configPath : null, validationResult.metadata);
			spinner5.succeed('Manifest generated');
		} catch (error: any) {
			spinner5.fail('Manifest generation failed');
			Logger.warn(error.message);
		}

		Logger.blank();
		Logger.success('Assembly complete! 🎉');
		Logger.blank();
		Logger.section('Output');
		Logger.listItem(`${outDir}/workflow.js - Engine bundle`);
		if (sourcemap) {
			Logger.listItem(`${outDir}/workflow.js.map - Diagnostic map`);
		}
		Logger.listItem(`${outDir}/manifest.json - Parts manifest`);
		Logger.blank();
		Logger.log('📦 Ready to ship with: workway workflow publish');

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}


/**
 * Bundle workflow with esbuild
 */
async function bundleWorkflow(
	workflowPath: string,
	outDir: string,
	minify: boolean,
	sourcemap: boolean
): Promise<void> {
	return new Promise((resolve, reject) => {
		const args = [
			'esbuild',
			workflowPath,
			'--bundle',
			`--outfile=${path.join(outDir, 'workflow.js')}`,
			'--format=esm',
			'--platform=node',
			'--target=es2022',
			'--external:@workway/*',
		];

		if (minify) {
			args.push('--minify');
		}

		if (sourcemap) {
			args.push('--sourcemap');
		}

		const proc = spawn('npx', args, {
			stdio: 'pipe',
			shell: true,
		});

		let stderr = '';

		proc.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(stderr || `esbuild exited with code ${code}`));
			}
		});

		proc.on('error', (error) => {
			reject(new Error(`Failed to run esbuild: ${error.message}`));
		});
	});
}

/**
 * Copy asset files to output directory
 */
async function copyAssets(srcDir: string, outDir: string): Promise<void> {
	const assetFiles = [
		'README.md',
		'LICENSE',
		'package.json',
		'workway.config.json',
		'test-data.json',
	];

	for (const file of assetFiles) {
		const srcPath = path.join(srcDir, file);
		if (await fs.pathExists(srcPath)) {
			await fs.copy(srcPath, path.join(outDir, file));
		}
	}
}

/**
 * Generate manifest file with validation metadata
 */
async function generateManifest(
	srcDir: string,
	outDir: string,
	configPath: string | null,
	validationMetadata?: import('../../lib/workflow-validator.js').WorkflowMetadata
): Promise<void> {
	let config: any = {};

	if (configPath) {
		config = await fs.readJson(configPath);
	}

	// Read package.json if exists
	const packagePath = path.join(srcDir, 'package.json');
	let packageJson: any = {};
	if (await fs.pathExists(packagePath)) {
		packageJson = await fs.readJson(packagePath);
	}

	// Use validation metadata to enrich manifest
	const manifest = {
		name: validationMetadata?.name || packageJson.name || path.basename(srcDir),
		version: packageJson.version || '1.0.0',
		description: packageJson.description || config.description || '',
		main: 'workflow.js',
		workway: {
			sdk: packageJson.dependencies?.['@workway/sdk'] || '*',
			type: validationMetadata?.type || config.type || 'integration',
			trigger: validationMetadata?.trigger || config.trigger || 'manual',
			integrations: validationMetadata?.integrations || config.integrations || [],
			category: config.category || 'other',
			ai: validationMetadata?.hasAI ? {
				enabled: true,
				provider: 'cloudflare-workers-ai',
			} : undefined,
			pricing: validationMetadata?.pricing || config.pricing,
		},
		buildTime: new Date().toISOString(),
	};

	await fs.writeJson(path.join(outDir, 'manifest.json'), manifest, { spaces: 2 });
}
