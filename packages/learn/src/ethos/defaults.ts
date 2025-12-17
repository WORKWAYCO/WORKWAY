/**
 * Ethos Storage
 *
 * Persistent storage of personal workflow principles in ~/.workway/learn-ethos.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createDefaultEthos, type WorkflowEthos, type WorkflowPrinciple } from './schema.js';

const CONFIG_DIR = join(homedir(), '.workway');
const ETHOS_FILE = join(CONFIG_DIR, 'learn-ethos.json');

/**
 * Ensure config directory exists
 */
function ensureConfigDir(): void {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
}

/**
 * Load ethos from disk
 */
export function loadEthos(): WorkflowEthos {
	ensureConfigDir();

	if (!existsSync(ETHOS_FILE)) {
		const defaultEthos = createDefaultEthos();
		saveEthos(defaultEthos);
		return defaultEthos;
	}

	try {
		const content = readFileSync(ETHOS_FILE, 'utf-8');
		return JSON.parse(content) as WorkflowEthos;
	} catch {
		const defaultEthos = createDefaultEthos();
		saveEthos(defaultEthos);
		return defaultEthos;
	}
}

/**
 * Save ethos to disk
 */
export function saveEthos(ethos: WorkflowEthos): void {
	ensureConfigDir();
	writeFileSync(ETHOS_FILE, JSON.stringify(ethos, null, 2), 'utf-8');
}

/**
 * Update a single principle
 */
export function updatePrinciple(principle: WorkflowPrinciple): WorkflowEthos {
	const ethos = loadEthos();
	const index = ethos.principles.findIndex((p) => p.category === principle.category);

	if (index >= 0) {
		ethos.principles[index] = principle;
	} else {
		ethos.principles.push(principle);
	}

	ethos.lastUpdated = new Date().toISOString();
	saveEthos(ethos);
	return ethos;
}

/**
 * Get a specific principle by category
 */
export function getPrinciple(category: string): WorkflowPrinciple | undefined {
	const ethos = loadEthos();
	return ethos.principles.find((p) => p.category === category);
}

/**
 * Reset ethos to defaults
 */
export function resetEthos(): WorkflowEthos {
	const defaultEthos = createDefaultEthos();
	saveEthos(defaultEthos);
	return defaultEthos;
}

/**
 * Format ethos for display
 */
export function formatEthosForDisplay(ethos: WorkflowEthos): string {
	const lines: string[] = ['WORKWAY Workflow Principles', '='.repeat(40), ''];

	for (const principle of ethos.principles) {
		lines.push(`[${principle.category.toUpperCase()}]`);
		lines.push(`  "${principle.content}"`);
		if (principle.context) {
			lines.push(`  Context: ${principle.context}`);
		}
		lines.push('');
	}

	lines.push(`Last updated: ${new Date(ethos.lastUpdated).toLocaleDateString()}`);
	return lines.join('\n');
}
