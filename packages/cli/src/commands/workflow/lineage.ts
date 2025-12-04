/**
 * Workflow Lineage Command
 *
 * View the fork lineage and ancestry of a workflow.
 * Zuhandenheit: Understanding flows through generations.
 *
 * @example
 * ```bash
 * workway workflow lineage
 * workway workflow lineage sales-analyzer
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger.js';

interface LineageNode {
	id: string;
	name: string;
	developer: string;
	depth: number;
	forkCount: number;
	isActive: boolean;
}

interface WorkwayRC {
	name: string;
	forkedFrom?: string;
	visibility?: string;
	attribution?: { name: string; percent: number }[];
}

/**
 * Draw lineage tree
 */
function drawLineageTree(ancestors: LineageNode[], current: LineageNode, forks: LineageNode[]): void {
	// Draw ancestors (oldest first)
	for (let i = 0; i < ancestors.length; i++) {
		const ancestor = ancestors[i];
		const prefix = i === 0 ? '  ' : '  │ '.repeat(i);
		const connector = i === 0 ? '◉' : '├─';

		Logger.log(`${prefix}${connector} ${ancestor.name}`);
		Logger.log(`${prefix}${i === 0 ? ' ' : '│ '} by ${ancestor.developer}`);
		if (i < ancestors.length - 1) {
			Logger.log(`${prefix}│`);
		}
	}

	// Draw current (highlighted)
	const currentPrefix = ancestors.length > 0 ? '  │ '.repeat(ancestors.length) : '  ';
	const currentConnector = ancestors.length > 0 ? '└─' : '◉';

	Logger.log(`${currentPrefix}${currentConnector} ${current.name} ← YOU`);
	Logger.log(`${currentPrefix}   by ${current.developer}`);

	// Draw forks
	if (forks.length > 0) {
		Logger.log(`${currentPrefix}   │`);
		for (let i = 0; i < forks.length; i++) {
			const fork = forks[i];
			const isLast = i === forks.length - 1;
			const forkConnector = isLast ? '└─' : '├─';
			const forkStatus = fork.isActive ? '●' : '○';

			Logger.log(`${currentPrefix}   ${forkConnector} ${forkStatus} ${fork.name}`);
			Logger.log(`${currentPrefix}   ${isLast ? '  ' : '│ '}  by ${fork.developer} (${fork.forkCount} forks)`);
		}
	}
}

/**
 * Lineage command
 */
export async function workflowLineageCommand(workflowIdentifier?: string): Promise<void> {
	Logger.header('Workflow Lineage');
	Logger.blank();

	// Try to read local .workwayrc
	let localConfig: WorkwayRC | null = null;
	try {
		const rcPath = path.resolve('.workwayrc');
		const rcContent = await fs.readFile(rcPath, 'utf-8');
		localConfig = JSON.parse(rcContent);
	} catch {
		// No local config
	}

	// Determine which workflow to show
	const targetId = workflowIdentifier || localConfig?.forkedFrom;

	if (!targetId && !localConfig) {
		Logger.info('No workflow specified and no local fork found.');
		Logger.log('');
		Logger.log('Usage:');
		Logger.log('  workway workflow lineage <workflow-name>');
		Logger.log('  workway workflow lineage              (in a forked project)');
		Logger.blank();
		return;
	}

	// Show local fork info if available
	if (localConfig) {
		Logger.info('Current Workflow:');
		Logger.log(`  Name: ${localConfig.name}`);

		if (localConfig.forkedFrom) {
			Logger.log(`  Forked from: ${localConfig.forkedFrom}`);
		} else {
			Logger.log(`  Type: Original (not a fork)`);
		}

		if (localConfig.visibility) {
			Logger.log(`  Visibility: ${localConfig.visibility}`);
		}

		Logger.blank();

		// Show attribution if exists
		if (localConfig.attribution && localConfig.attribution.length > 0) {
			Logger.info('Revenue Attribution:');
			for (const attr of localConfig.attribution) {
				Logger.log(`  ${attr.name}: ${attr.percent}%`);
			}
			Logger.blank();
		}
	}

	// Show lineage tree (mock data - would come from API)
	if (localConfig?.forkedFrom || targetId) {
		const spinner = Logger.spinner('Fetching lineage...');

		// Simulate API delay
		await new Promise((resolve) => setTimeout(resolve, 600));

		spinner.succeed('Lineage loaded');
		Logger.blank();

		// Mock lineage data
		const ancestors: LineageNode[] = localConfig?.forkedFrom
			? [
					{
						id: 'wf_original',
						name: 'meeting-intelligence',
						developer: 'Alex Chen',
						depth: 0,
						forkCount: 23,
						isActive: true,
					},
				]
			: [];

		const current: LineageNode = {
			id: 'wf_current',
			name: localConfig?.name || targetId || 'Unknown',
			developer: 'You',
			depth: ancestors.length,
			forkCount: 0,
			isActive: true,
		};

		const forks: LineageNode[] = [];

		// Draw tree
		Logger.info('Lineage Tree:');
		Logger.blank();
		drawLineageTree(ancestors, current, forks);
		Logger.blank();

		// Show stats
		if (ancestors.length > 0) {
			const original = ancestors[0];
			Logger.info('Original Workflow Stats:');
			Logger.log(`  Total forks: ${original.forkCount}`);
			Logger.log(`  Your depth: ${current.depth} (${current.depth === 1 ? 'direct fork' : `${current.depth} generations`})`);
			Logger.blank();
		}
	}

	// Show help
	Logger.info('Commands:');
	Logger.log('  workway workflow forks     - See all public forks of a workflow');
	Logger.log('  workway workflow fork      - Create a new fork');
}

export default workflowLineageCommand;
