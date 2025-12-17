/**
 * Clear Command
 *
 * Clear cached data and optionally credentials.
 */

import chalk from 'chalk';
import ora from 'ora';
import { clearCredentials } from '../../api/auth.js';
import { clearLessonCache, getCacheStats } from '../../cache/lesson-cache.js';
import { clearPendingCompletions, getPendingCount } from '../../cache/progress-cache.js';
import { resetEthos } from '../../ethos/defaults.js';

interface ClearOptions {
	cache?: boolean;
	all?: boolean;
	ethos?: boolean;
}

export async function clearCommand(options: ClearOptions): Promise<void> {
	const spinner = ora('Clearing data...').start();

	try {
		const cleared: string[] = [];

		// Clear cache (default behavior or with --cache)
		if (!options.all && !options.ethos) {
			options.cache = true;
		}

		if (options.cache || options.all) {
			const cacheStats = getCacheStats();
			clearLessonCache();
			if (cacheStats.count > 0) {
				cleared.push(`Lesson cache (${cacheStats.count} lessons)`);
			}

			const pendingCount = getPendingCount();
			clearPendingCompletions();
			if (pendingCount > 0) {
				cleared.push(`Pending completions (${pendingCount})`);
			}
		}

		if (options.ethos || options.all) {
			resetEthos();
			cleared.push('Ethos (reset to defaults)');
		}

		if (options.all) {
			clearCredentials();
			cleared.push('Credentials');
		}

		spinner.succeed('Data cleared');
		console.log('');

		if (cleared.length > 0) {
			console.log(chalk.bold('Cleared:'));
			for (const item of cleared) {
				console.log(chalk.green('  ✓'), item);
			}
		} else {
			console.log(chalk.dim('Nothing to clear'));
		}

		if (options.all) {
			console.log('');
			console.log(chalk.yellow('Note:'), 'You will need to re-authenticate');
		}

		console.log('');
	} catch (error) {
		spinner.fail('Failed to clear data');
		console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
