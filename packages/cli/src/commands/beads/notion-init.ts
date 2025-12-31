/**
 * Beads Notion Init Command
 *
 * Initialize a Notion database for syncing Beads issues.
 * Zuhandenheit: Run once, then issues flow automatically.
 */

import chalk from 'chalk';
import { Logger } from '../../utils/logger.js';
import { loadConfig, saveConfig, getOAuthToken } from '../../lib/config.js';
import { createBeadsDatabase } from '../../lib/beads-sync.js';
import type { CLIConfig } from '../../types/index.js';

interface NotionInitOptions {
	parentPageId?: string;
	title?: string;
}

export async function beadsNotionInitCommand(options: NotionInitOptions = {}): Promise<void> {
	try {
		Logger.header('Initialize Beads → Notion Database');
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

		Logger.success('Notion connection verified');
		Logger.blank();

		// Check for existing database configuration
		const config = await loadConfig();
		const existingDatabaseId = (config as any).beads?.notion?.databaseId;

		if (existingDatabaseId) {
			Logger.warn('Beads Notion database already configured.');
			Logger.blank();
			Logger.log(`Database ID: ${chalk.cyan(existingDatabaseId)}`);
			Logger.blank();
			Logger.log('To re-initialize with a new database, run:');
			Logger.code('workway beads notion init --force');
			Logger.blank();
			Logger.log('Or sync existing issues:');
			Logger.code('workway beads notion sync');
			process.exit(0);
		}

		// Get parent page ID
		let parentPageId = options.parentPageId;

		if (!parentPageId) {
			Logger.section('Parent Page Required');
			Logger.blank();
			Logger.log('The database will be created inside a Notion page.');
			Logger.log('Find your page ID from the Notion URL:');
			Logger.blank();
			Logger.log(chalk.dim('  https://notion.so/Your-Page-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'));
			Logger.log(chalk.dim('                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^'));
			Logger.log(chalk.dim('                                This is the page ID (32 chars)'));
			Logger.blank();
			Logger.log('Provide it with:');
			Logger.code('workway beads notion init --parent-page-id <id>');
			process.exit(1);
		}

		// Clean up parent page ID (remove hyphens if present)
		parentPageId = parentPageId.replace(/-/g, '');

		const title = options.title || 'WORKWAY Issues';

		Logger.section('Creating Database');
		Logger.listItem(`Parent Page: ${parentPageId}`);
		Logger.listItem(`Title: ${title}`);
		Logger.blank();

		const spinner = Logger.spinner('Creating Notion database...');

		try {
			const result = await createBeadsDatabase(
				{ accessToken: notionToken.accessToken },
				parentPageId,
				title
			);

			spinner.succeed('Database created successfully!');
			Logger.blank();

			// Save database ID to config
			const updatedConfig: CLIConfig & { beads?: { notion?: { databaseId: string; lastSyncAt?: string } } } = {
				...config,
				beads: {
					...((config as any).beads || {}),
					notion: {
						databaseId: result.id,
					},
				},
			};

			await saveConfig(updatedConfig as CLIConfig);

			Logger.section('Database Details');
			Logger.listItem(`Database ID: ${chalk.cyan(result.id)}`);
			Logger.listItem(`URL: ${chalk.underline(result.url)}`);
			Logger.blank();

			Logger.success('Beads → Notion sync initialized!');
			Logger.blank();
			Logger.log('Next steps:');
			Logger.code('workway beads notion sync     # Sync all issues');
			Logger.code('workway beads notion sync --dry-run  # Preview changes');

		} catch (error: any) {
			spinner.fail('Failed to create database');
			Logger.blank();

			if (error.message.includes('Could not find page')) {
				Logger.error('Page not found. Check that:');
				Logger.listItem('The page ID is correct');
				Logger.listItem('Notion integration has access to the page');
				Logger.blank();
				Logger.log('Share the page with the WORKWAY integration in Notion.');
			} else if (error.message.includes('validation_error')) {
				Logger.error('Invalid page ID format.');
				Logger.blank();
				Logger.log('Page ID should be 32 characters (no hyphens).');
			} else {
				Logger.error(error.message);
			}

			process.exit(1);
		}

	} catch (error: any) {
		Logger.error(error.message);
		process.exit(1);
	}
}
