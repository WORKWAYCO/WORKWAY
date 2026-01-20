/**
 * Shared formatting utilities for beads CLI tools.
 * Used by both bd (mutations) and bv (viewer) commands.
 */

import chalk from 'chalk';
import { BeadsStore } from './store.js';
import type { Priority, Issue } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Color Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format priority with appropriate color.
 * P0 (red bold) → P4 (gray)
 */
export function priorityColor(priority: Priority): string {
	const colors: Record<Priority, (s: string) => string> = {
		0: chalk.red.bold, // P0 - Drop everything
		1: chalk.red, // P1 - This week
		2: chalk.yellow, // P2 - This month
		3: chalk.blue, // P3 - Someday
		4: chalk.gray, // P4 - Maybe never
	};
	return colors[priority](`P${priority}`);
}

/**
 * Format status with appropriate color.
 * open (green), in_progress (yellow), closed (gray)
 */
export function statusColor(status: string): string {
	const colors: Record<string, (s: string) => string> = {
		open: chalk.green,
		in_progress: chalk.yellow,
		closed: chalk.gray,
	};
	return (colors[status] || chalk.white)(status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format an issue for display.
 * @param issue - The issue to format
 * @param verbose - Include description, labels, and created date
 */
export function formatIssue(issue: Issue, verbose = false): string {
	const lines: string[] = [];
	const p = priorityColor(issue.priority);
	const s = statusColor(issue.status);

	lines.push(`${chalk.cyan(issue.id)} ${p} ${s} ${issue.title}`);

	if (verbose) {
		if (issue.description) {
			lines.push(
				chalk.gray(`  ${issue.description.slice(0, 100)}${issue.description.length > 100 ? '...' : ''}`)
			);
		}
		if (issue.labels.length > 0) {
			lines.push(chalk.gray(`  Labels: ${issue.labels.join(', ')}`));
		}
		lines.push(chalk.gray(`  Created: ${issue.created_at}`));
	}

	return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization Check
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure .beads directory is initialized.
 * Exits process with error if not initialized.
 */
export async function ensureInitialized(store: BeadsStore): Promise<void> {
	const initialized = await store.isInitialized();
	if (!initialized) {
		console.error(chalk.red('Error: .beads not initialized. Run `bd init` first.'));
		process.exit(1);
	}
}
