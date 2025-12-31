/**
 * Beads Notion Sync Command
 *
 * Sync Beads issues from both repos to Notion database.
 * Zuhandenheit: Issues appear in Notion. The mechanism recedes.
 */

import chalk from 'chalk';
import { Logger } from '../../utils/logger.js';
import { loadConfig, getOAuthToken } from '../../lib/config.js';
import { syncAllRepos, readAllBeadsIssues, BEADS_REPO_PATHS } from '../../lib/beads-sync.js';
import type { BeadsSyncResult } from '../../types/index.js';

interface NotionSyncOptions {
	dryRun?: boolean;
	force?: boolean;
}

export async function beadsNotionSyncCommand(options: NotionSyncOptions = {}): Promise<void> {
	try {
		const { dryRun = false, force = false } = options;

		Logger.header('Beads → Notion Sync');

		if (dryRun) {
			Logger.log(chalk.yellow('  [DRY RUN] No changes will be made'));
		}
		Logger.blank();

		// Check Notion OAuth connection
		const notionToken = await getOAuthToken('notion');
		if (!notionToken?.accessToken) {
			Logger.error('Notion is not connected.');
			Logger.blank();
			Logger.log('Connect Notion first:');
			Logger.code('workway oauth connect notion');
			process.exit(1);
		}

		// Check for database configuration
		const config = await loadConfig();
		const databaseId = (config as any).beads?.notion?.databaseId;

		if (!databaseId) {
			Logger.error('Beads Notion database not initialized.');
			Logger.blank();
			Logger.log('Initialize first:');
			Logger.code('workway beads notion init --parent-page-id <page-id>');
			process.exit(1);
		}

		// Show repo status
		Logger.section('Source Repositories');
		for (const [name, path] of Object.entries(BEADS_REPO_PATHS)) {
			Logger.listItem(`${name}: ${chalk.dim(path)}`);
		}
		Logger.blank();

		// Read issues first to show stats
		const spinner = Logger.spinner('Reading Beads issues...');
		const issues = await readAllBeadsIssues();
		spinner.succeed(`Found ${issues.length} issues`);
		Logger.blank();

		// Show breakdown by repo
		const cloudflareIssues = issues.filter(i => i.id.startsWith('ww-'));
		const platformIssues = issues.filter(i => i.id.startsWith('wwp-'));

		Logger.section('Issue Breakdown');
		Logger.listItem(`Cloudflare (ww-*): ${cloudflareIssues.length}`);
		Logger.listItem(`Platform (wwp-*): ${platformIssues.length}`);
		Logger.blank();

		if (issues.length === 0) {
			Logger.warn('No issues found to sync.');
			process.exit(0);
		}

		// Perform sync
		const syncSpinner = Logger.spinner(
			dryRun ? 'Analyzing changes...' : 'Syncing to Notion...'
		);

		let result: BeadsSyncResult;

		try {
			result = await syncAllRepos(
				{ accessToken: notionToken.accessToken },
				databaseId,
				{ dryRun, forceUpdate: force }
			);

			syncSpinner.succeed(dryRun ? 'Analysis complete' : 'Sync complete');
		} catch (error: any) {
			syncSpinner.fail('Sync failed');
			Logger.blank();
			Logger.error(error.message);

			if (error.message.includes('Could not find database')) {
				Logger.blank();
				Logger.log('The database may have been deleted. Re-initialize:');
				Logger.code('workway beads notion init --parent-page-id <page-id>');
			}

			process.exit(1);
		}

		// Show results
		Logger.blank();
		Logger.section('Sync Results');

		if (result.created > 0) {
			Logger.listItem(`${chalk.green('Created')}: ${result.created} pages`);
		}
		if (result.updated > 0) {
			Logger.listItem(`${chalk.blue('Updated')}: ${result.updated} pages`);
		}
		if (result.skipped > 0) {
			Logger.listItem(`${chalk.dim('Skipped')}: ${result.skipped} (unchanged)`);
		}
		if (result.errors.length > 0) {
			Logger.listItem(`${chalk.red('Errors')}: ${result.errors.length}`);
		}

		Logger.blank();

		// Show errors if any
		if (result.errors.length > 0) {
			Logger.section('Errors');
			for (const error of result.errors.slice(0, 5)) {
				Logger.error(`${error.issueId}: ${error.error}`);
			}
			if (result.errors.length > 5) {
				Logger.log(chalk.dim(`  ... and ${result.errors.length - 5} more errors`));
			}
			Logger.blank();
		}

		// Summary
		if (dryRun) {
			Logger.log(chalk.yellow('This was a dry run. No changes were made.'));
			Logger.blank();
			Logger.log('Run without --dry-run to apply changes:');
			Logger.code('workway beads notion sync');
		} else {
			const total = result.created + result.updated;
			if (total > 0) {
				Logger.success(`Synced ${total} issues to Notion`);
			} else {
				Logger.log(chalk.dim('Everything is up to date'));
			}
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}
