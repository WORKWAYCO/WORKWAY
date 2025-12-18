#!/usr/bin/env node
/**
 * @workwayco/harness
 *
 * CLI for the autonomous agent harness.
 *
 * Commands:
 *   workway-harness start <spec> --mode <mode>  Start a new harness run
 *   workway-harness pause [--reason]            Pause a running harness
 *   workway-harness resume                      Resume a paused harness
 *   workway-harness status                      Show harness status
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import type { HarnessMode } from './types.js';
import {
  initializeHarness,
  runHarness,
  pauseHarness,
  resumeHarness,
  getHarnessStatus,
  findAndResumeHarness,
} from './runner.js';

const program = new Command();

// ─────────────────────────────────────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log(chalk.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold('║                    WORKWAY AGENT HARNESS                       ║'));
  console.log(chalk.bold('║         Autonomous project execution with checkpoints          ║'));
  console.log(chalk.bold('╚════════════════════════════════════════════════════════════════╝\n'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

program
  .name('workway-harness')
  .description('Autonomous agent harness for WORKWAY. Multi-session project execution with checkpoints and human steering.')
  .version('0.1.0');

// ── start ────────────────────────────────────────────────────────────────────

program
  .command('start <spec-file>')
  .description('Start a new harness run from a spec file')
  .requiredOption('-m, --mode <mode>', 'Harness mode (workflow|platform)')
  .option('-c, --checkpoint-every <n>', 'Sessions between checkpoints', '3')
  .option('-h, --max-hours <n>', 'Max hours before auto-pause', '4')
  .option('-t, --confidence <threshold>', 'Confidence threshold for pause (0-1)', '0.7')
  .option('--dry-run', 'Parse spec and show plan without executing')
  .option('--resume', 'Resume existing harness for this spec instead of starting fresh')
  .action(async (specFile, options) => {
    printBanner();

    // Validate mode
    const mode = options.mode.toLowerCase();
    if (mode !== 'workflow' && mode !== 'platform') {
      console.error(chalk.red(`Invalid mode: ${options.mode}. Use 'workflow' or 'platform'.`));
      process.exit(1);
    }

    const cwd = process.cwd();

    try {
      // Check for resume flag
      if (options.resume) {
        const spinner = ora('Looking for existing harness...').start();
        const result = await findAndResumeHarness(specFile, cwd);

        if (!result) {
          spinner.fail('No existing harness found for this spec');
          console.log(chalk.yellow('Starting fresh instead...\n'));
        } else {
          spinner.succeed(`Resuming harness: ${result.harnessState.id}`);
          await runHarness(result.harnessState, { cwd, dryRun: false });
          return;
        }
      }

      const spinner = ora('Initializing harness...').start();

      const { harnessState } = await initializeHarness(
        {
          specFile,
          mode: mode as HarnessMode,
          checkpointEvery: parseInt(options.checkpointEvery, 10),
          maxHours: parseInt(options.maxHours, 10),
          confidenceThreshold: parseFloat(options.confidence),
          dryRun: options.dryRun,
        },
        cwd
      );

      spinner.succeed('Harness initialized');

      if (options.dryRun) {
        console.log(chalk.yellow('\n[DRY RUN] Would execute harness with the above configuration.\n'));
        return;
      }

      // Run the harness loop
      await runHarness(harnessState, { cwd, dryRun: false });

    } catch (error) {
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// ── pause ────────────────────────────────────────────────────────────────────

program
  .command('pause')
  .description('Pause a running harness')
  .option('-r, --reason <reason>', 'Reason for pausing')
  .option('-i, --id <harness-id>', 'Specific harness ID to pause')
  .action(async (options) => {
    const cwd = process.cwd();

    try {
      await pauseHarness(options.id || 'current', options.reason, cwd);
      console.log(chalk.green('\nPause request sent.'));
    } catch (error) {
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// ── resume ───────────────────────────────────────────────────────────────────

program
  .command('resume')
  .description('Resume a paused harness')
  .option('-i, --id <harness-id>', 'Specific harness ID to resume')
  .action(async (options) => {
    const cwd = process.cwd();

    try {
      await resumeHarness(options.id || 'current', cwd);
    } catch (error) {
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// ── status ───────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show harness status')
  .option('-i, --id <harness-id>', 'Specific harness ID to check')
  .action(async (options) => {
    const cwd = process.cwd();

    try {
      await getHarnessStatus(options.id, cwd);
    } catch (error) {
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

program.parse();
