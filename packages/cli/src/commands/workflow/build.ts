/**
 * Workflow Build Command
 *
 * Builds workflow for production deployment
 * Bundles TypeScript, validates configuration, and prepares for publishing
 */

import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { Logger } from '../../utils/logger.js';
import { loadProjectConfig } from '../../lib/config.js';

interface BuildOptions {
	outDir?: string;
	minify?: boolean;
	sourcemap?: boolean;
}

export async function workflowBuildCommand(options: BuildOptions): Promise<void> {
	try {
		Logger.header('Build Workflow');

		// Check if we're in a workflow project
		const workflowPath = path.join(process.cwd(), 'workflow.ts');
		if (!(await fs.pathExists(workflowPath))) {
			Logger.error('No workflow.ts found in current directory');
			Logger.log('');
			Logger.log('💡 Run this command from a workflow project directory');
			Logger.log('💡 Or create a new workflow with: workway workflow init');
			process.exit(1);
		}

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

		// Step 1: Validate workflow structure
		const spinner1 = Logger.spinner('Validating workflow...');
		try {
			await validateWorkflow(workflowPath);
			spinner1.succeed('Workflow validated');
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
		const spinner3 = Logger.spinner('Bundling workflow...');
		try {
			await bundleWorkflow(workflowPath, absoluteOutDir, minify, sourcemap);
			spinner3.succeed('Workflow bundled');
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

		// Step 5: Generate manifest
		const spinner5 = Logger.spinner('Generating manifest...');
		try {
			await generateManifest(process.cwd(), absoluteOutDir, hasConfig ? configPath : null);
			spinner5.succeed('Manifest generated');
		} catch (error: any) {
			spinner5.fail('Manifest generation failed');
			Logger.warn(error.message);
		}

		Logger.blank();
		Logger.success('Build complete! 🎉');
		Logger.blank();
		Logger.section('Output');
		Logger.listItem(`${outDir}/workflow.js - Main workflow bundle`);
		if (sourcemap) {
			Logger.listItem(`${outDir}/workflow.js.map - Source map`);
		}
		Logger.listItem(`${outDir}/manifest.json - Workflow manifest`);
		Logger.blank();
		Logger.log('📦 Ready for publishing with: workway workflow publish');

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}

/**
 * Validate workflow structure
 */
async function validateWorkflow(workflowPath: string): Promise<void> {
	const content = await fs.readFile(workflowPath, 'utf-8');

	// Check for required exports
	const hasWorkflowExport = /export\s+(default\s+)?.*workflow/i.test(content) ||
		/defineWorkflow|createWorkflow/.test(content);

	if (!hasWorkflowExport) {
		throw new Error('Workflow must export a workflow definition (use defineWorkflow or export default)');
	}

	// Check for basic structure
	if (!content.includes('trigger') && !content.includes('steps') && !content.includes('run')) {
		throw new Error('Workflow must define a trigger, steps, or run function');
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
 * Generate manifest file
 */
async function generateManifest(
	srcDir: string,
	outDir: string,
	configPath: string | null
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

	const manifest = {
		name: packageJson.name || path.basename(srcDir),
		version: packageJson.version || '1.0.0',
		description: packageJson.description || config.description || '',
		main: 'workflow.js',
		workway: {
			sdk: packageJson.dependencies?.['@workway/sdk'] || '*',
			trigger: config.trigger || 'manual',
			integrations: config.integrations || [],
			category: config.category || 'other',
		},
		buildTime: new Date().toISOString(),
	};

	await fs.writeJson(path.join(outDir, 'manifest.json'), manifest, { spaces: 2 });
}
