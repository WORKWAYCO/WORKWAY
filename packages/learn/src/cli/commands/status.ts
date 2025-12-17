/**
 * Status Command
 *
 * Display learning progress in the terminal.
 */

import chalk from 'chalk';
import ora from 'ora';
import { isAuthenticated, getCurrentUser } from '../../api/auth.js';
import { getClient } from '../../api/client.js';
import { getCacheStats } from '../../cache/lesson-cache.js';
import { getPendingCount } from '../../cache/progress-cache.js';
import { loadEthos } from '../../ethos/defaults.js';
import type { LearnerProgress } from '../../types/index.js';

/**
 * Render a progress bar
 */
function progressBar(completed: number, total: number, width = 20): string {
	const percent = total > 0 ? completed / total : 0;
	const filled = Math.round(percent * width);
	const empty = width - filled;
	return `[${chalk.green('='.repeat(filled))}${chalk.dim('-'.repeat(empty))}]`;
}

/**
 * Format time
 */
function formatTime(hours: number): string {
	if (hours < 1) {
		return `${Math.round(hours * 60)}m`;
	}
	return `${hours.toFixed(1)}h`;
}

export async function statusCommand(): Promise<void> {
	const spinner = ora('Loading progress...').start();

	try {
		// Check authentication
		const authenticated = isAuthenticated();
		const user = getCurrentUser();

		console.log('');
		console.log(chalk.bold('WORKWAY Learn Status'));
		console.log(chalk.dim('─'.repeat(50)));
		console.log('');

		// Authentication status
		if (authenticated && user) {
			console.log(chalk.green('●'), 'Authenticated as', chalk.cyan(user.email));
			console.log(chalk.dim(`  Tier: ${user.tier}`));
		} else {
			console.log(chalk.yellow('○'), 'Not authenticated');
			console.log(chalk.dim('  Use learn_authenticate in Claude Code to sign in'));
			spinner.stop();
			return;
		}

		console.log('');

		// Fetch progress from API
		let progress: LearnerProgress | null = null;
		try {
			const client = getClient();
			progress = await client.getProgress();
			spinner.stop();
		} catch (error) {
			spinner.warn('Could not fetch progress from server');
			console.log(chalk.dim('  Showing local data only'));
		}

		if (progress) {
			// Overall stats
			console.log(chalk.bold('Overall Progress'));
			console.log(
				progressBar(progress.overall.lessonsCompleted, progress.overall.lessonsTotal),
				chalk.cyan(`${progress.overall.progressPercent}%`),
				chalk.dim(`(${progress.overall.lessonsCompleted}/${progress.overall.lessonsTotal} lessons)`)
			);
			console.log(chalk.dim(`  Time spent: ${formatTime(progress.overall.totalTimeHours)}`));
			console.log(chalk.dim(`  Praxis completed: ${progress.overall.praxisCompleted}`));
			console.log('');

			// Paths
			console.log(chalk.bold('Learning Paths'));
			for (const path of progress.paths) {
				const statusIcon =
					path.status === 'completed'
						? chalk.green('✓')
						: path.status === 'in_progress'
							? chalk.yellow('◐')
							: chalk.dim('○');

				const percent = path.lessonsTotal > 0 ? Math.round((path.lessonsCompleted / path.lessonsTotal) * 100) : 0;

				console.log(
					` ${statusIcon}`,
					path.pathId.padEnd(20),
					progressBar(path.lessonsCompleted, path.lessonsTotal, 15),
					chalk.dim(`${percent}%`)
				);
			}
			console.log('');

			// Recent activity
			if (progress.recentActivity.length > 0) {
				console.log(chalk.bold('Recent Activity'));
				for (const activity of progress.recentActivity.slice(0, 3)) {
					const date = new Date(activity.completedAt);
					const timeAgo = getTimeAgo(date);
					console.log(chalk.green('  ✓'), activity.lessonTitle, chalk.dim(`(${timeAgo})`));
				}
				console.log('');
			}
		}

		// Local cache stats
		const cacheStats = getCacheStats();
		const pendingCount = getPendingCount();

		if (cacheStats.count > 0 || pendingCount > 0) {
			console.log(chalk.bold('Local Data'));
			if (cacheStats.count > 0) {
				console.log(chalk.dim(`  Cached lessons: ${cacheStats.count}`));
			}
			if (pendingCount > 0) {
				console.log(chalk.yellow(`  Pending sync: ${pendingCount} completions`));
			}
			console.log('');
		}

		// Ethos summary
		const ethos = loadEthos();
		console.log(chalk.bold('Workflow Principles'));
		console.log(chalk.dim(`  ${ethos.principles.length} principles defined`));
		console.log(chalk.dim(`  Last updated: ${new Date(ethos.lastUpdated).toLocaleDateString()}`));
		console.log('');

		// Next steps
		if (progress) {
			const inProgress = progress.paths.find((p) => p.status === 'in_progress');
			const notStarted = progress.paths.find((p) => p.status === 'not_started');

			console.log(chalk.bold('Recommended'));
			if (inProgress) {
				console.log(chalk.cyan(`  Continue: ${inProgress.pathId}`));
			} else if (notStarted) {
				console.log(chalk.cyan(`  Start: ${notStarted.pathId}`));
			} else {
				console.log(chalk.green('  All paths completed!'));
			}
		}

		console.log('');
	} catch (error) {
		spinner.fail('Failed to load status');
		console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
	const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

	if (seconds < 60) return 'just now';
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

	return date.toLocaleDateString();
}
