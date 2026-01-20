#!/usr/bin/env node
/**
 * @workwayco/beads
 *
 * CLI for agent-native task management.
 * bd - Beads Data (mutations)
 *
 * Commands:
 *   bd init                 Initialize .beads directory
 *   bd create "Title"       Create a new issue
 *   bd list                 List open issues
 *   bd show <id>            Show issue details
 *   bd update <id>          Update an issue
 *   bd close <id>           Close an issue
 *   bd dep add <id> <dep>   Add a dependency
 *   bd label add <id> <l>   Add a label
 *   bd ready                Show ready issues
 *   bd blocked              Show blocked issues
 *   bd progress             Show progress summary
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { BeadsStore } from './store.js';
import type { IssueType, Priority, DependencyType, Issue } from './types.js';
import { priorityColor, statusColor, formatIssue, ensureInitialized as ensureInit } from './format-utils.js';

const program = new Command();
const store = new BeadsStore();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureInitialized(): Promise<void> {
  return ensureInit(store);
}

function parsePriority(value: string): Priority {
  const match = value.match(/P?(\d)/i);
  if (!match) {
    console.error(chalk.red(`Invalid priority: ${value}. Use P0-P4 or 0-4.`));
    process.exit(1);
  }
  const num = parseInt(match[1], 10);
  if (num < 0 || num > 4) {
    console.error(chalk.red(`Priority must be 0-4 (P0-P4).`));
    process.exit(1);
  }
  return num as Priority;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

program
  .name('bd')
  .description('Agent-native task management. The tool recedes; the work remains.')
  .version('0.1.0');

// ── init ─────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize .beads directory')
  .option('-p, --project <name>', 'Project name for ID prefixes')
  .action(async (options) => {
    const initialized = await store.isInitialized();
    if (initialized) {
      console.log(chalk.yellow('.beads already initialized.'));
      return;
    }

    await store.init({ project: options.project });
    console.log(chalk.green('Initialized .beads directory.'));
    console.log(chalk.gray('  - issues.jsonl (source of truth)'));
    console.log(chalk.gray('  - deps.jsonl (dependencies)'));
    console.log(chalk.gray('  - config.json (configuration)'));
  });

// ── create ───────────────────────────────────────────────────────────────────

program
  .command('create <title>')
  .description('Create a new issue')
  .option('-d, --description <text>', 'Issue description')
  .option('-t, --type <type>', 'Issue type (bug|feature|task|epic|chore)', 'task')
  .option('-p, --priority <priority>', 'Priority (P0-P4)', 'P2')
  .option('-l, --labels <labels>', 'Comma-separated labels')
  .action(async (title, options) => {
    await ensureInitialized();

    const issue = await store.createIssue({
      title,
      description: options.description,
      type: options.type as IssueType,
      priority: parsePriority(options.priority),
      labels: options.labels ? options.labels.split(',').map((l: string) => l.trim()) : [],
    });

    console.log(chalk.green(`Created issue: ${issue.id}`));
    console.log(formatIssue(issue));
  });

// ── list ─────────────────────────────────────────────────────────────────────

program
  .command('list')
  .description('List open issues')
  .option('-a, --all', 'Include closed issues')
  .option('-l, --label <label>', 'Filter by label')
  .option('-s, --status <status>', 'Filter by status')
  .option('-v, --verbose', 'Show more details')
  .action(async (options) => {
    await ensureInitialized();

    let issues = options.all
      ? await store.getAllIssues()
      : await store.getOpenIssues();

    if (options.label) {
      issues = issues.filter((i) => i.labels.includes(options.label));
    }

    if (options.status) {
      issues = issues.filter((i) => i.status === options.status);
    }

    // Sort by priority
    issues.sort((a, b) => a.priority - b.priority);

    if (issues.length === 0) {
      console.log(chalk.gray('No issues found.'));
      return;
    }

    for (const issue of issues) {
      console.log(formatIssue(issue, options.verbose));
    }
  });

// ── show ─────────────────────────────────────────────────────────────────────

program
  .command('show <id>')
  .description('Show issue details')
  .action(async (id) => {
    await ensureInitialized();

    const issue = await store.getIssue(id);
    if (!issue) {
      console.error(chalk.red(`Issue not found: ${id}`));
      process.exit(1);
    }

    console.log(formatIssue(issue, true));

    // Show dependencies
    const deps = await store.getDependencies(id);
    if (deps.length > 0) {
      console.log(chalk.gray('\nDependencies:'));
      for (const dep of deps) {
        console.log(chalk.gray(`  ${dep.type}: ${dep.depends_on_id}`));
      }
    }

    // Show dependents
    const dependents = await store.getDependents(id);
    if (dependents.length > 0) {
      console.log(chalk.gray('\nBlocking:'));
      for (const dep of dependents) {
        console.log(chalk.gray(`  ${dep.issue_id}`));
      }
    }
  });

// ── update ───────────────────────────────────────────────────────────────────

program
  .command('update <id>')
  .description('Update an issue')
  .option('-t, --title <title>', 'New title')
  .option('-d, --description <text>', 'New description')
  .option('-s, --status <status>', 'New status (open|in_progress|closed)')
  .option('-p, --priority <priority>', 'New priority (P0-P4)')
  .option('--type <type>', 'New type (bug|feature|task|epic|chore)')
  .action(async (id, options) => {
    await ensureInitialized();

    const updates: Record<string, unknown> = {};
    if (options.title) updates.title = options.title;
    if (options.description) updates.description = options.description;
    if (options.status) updates.status = options.status;
    if (options.priority) updates.priority = parsePriority(options.priority);
    if (options.type) updates.issue_type = options.type;

    if (Object.keys(updates).length === 0) {
      console.error(chalk.yellow('No updates specified.'));
      return;
    }

    const issue = await store.updateIssue(id, updates);
    if (!issue) {
      console.error(chalk.red(`Issue not found: ${id}`));
      process.exit(1);
    }

    console.log(chalk.green(`Updated: ${issue.id}`));
    console.log(formatIssue(issue));
  });

// ── close ────────────────────────────────────────────────────────────────────

program
  .command('close <id>')
  .description('Close an issue')
  .action(async (id) => {
    await ensureInitialized();

    const issue = await store.closeIssue(id);
    if (!issue) {
      console.error(chalk.red(`Issue not found: ${id}`));
      process.exit(1);
    }

    console.log(chalk.green(`Closed: ${issue.id}`));
  });

// ── dep ──────────────────────────────────────────────────────────────────────

const dep = program
  .command('dep')
  .description('Manage dependencies');

dep
  .command('add <issue-id> <depends-on-id>')
  .description('Add a dependency')
  .option('-t, --type <type>', 'Dependency type (blocks|parent-child|related|discovered-from)', 'blocks')
  .action(async (issueId, dependsOnId, options) => {
    await ensureInitialized();

    await store.addDependency(issueId, dependsOnId, options.type as DependencyType);
    console.log(chalk.green(`Added dependency: ${issueId} ${options.type} ${dependsOnId}`));
  });

dep
  .command('remove <issue-id> <depends-on-id>')
  .description('Remove a dependency')
  .action(async (issueId, dependsOnId) => {
    await ensureInitialized();

    const removed = await store.removeDependency(issueId, dependsOnId);
    if (!removed) {
      console.error(chalk.yellow('Dependency not found.'));
      return;
    }

    console.log(chalk.green(`Removed dependency: ${issueId} -> ${dependsOnId}`));
  });

dep
  .command('list <issue-id>')
  .description('List dependencies for an issue')
  .action(async (issueId) => {
    await ensureInitialized();

    const deps = await store.getDependencies(issueId);
    if (deps.length === 0) {
      console.log(chalk.gray('No dependencies.'));
      return;
    }

    for (const d of deps) {
      console.log(`${d.type}: ${d.depends_on_id}`);
    }
  });

// ── label ────────────────────────────────────────────────────────────────────

const label = program
  .command('label')
  .description('Manage labels');

label
  .command('add <issue-id> <label>')
  .description('Add a label to an issue')
  .action(async (issueId, labelName) => {
    await ensureInitialized();

    const issue = await store.addLabel(issueId, labelName);
    if (!issue) {
      console.error(chalk.red(`Issue not found: ${issueId}`));
      process.exit(1);
    }

    console.log(chalk.green(`Added label '${labelName}' to ${issueId}`));
  });

label
  .command('remove <issue-id> <label>')
  .description('Remove a label from an issue')
  .action(async (issueId, labelName) => {
    await ensureInitialized();

    const issue = await store.removeLabel(issueId, labelName);
    if (!issue) {
      console.error(chalk.red(`Issue not found: ${issueId}`));
      process.exit(1);
    }

    console.log(chalk.green(`Removed label '${labelName}' from ${issueId}`));
  });

// ── ready ────────────────────────────────────────────────────────────────────

program
  .command('ready')
  .description('Show ready issues (open, not blocked)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await ensureInitialized();

    const issues = await store.getReadyIssues();

    if (options.json) {
      console.log(JSON.stringify(issues, null, 2));
      return;
    }

    if (issues.length === 0) {
      console.log(chalk.gray('No ready issues.'));
      return;
    }

    console.log(chalk.bold('Ready issues:'));
    for (const issue of issues) {
      console.log(formatIssue(issue));
    }
  });

// ── blocked ──────────────────────────────────────────────────────────────────

program
  .command('blocked')
  .description('Show blocked issues with their blockers')
  .action(async () => {
    await ensureInitialized();

    const blocked = await store.getBlockedIssues();

    if (blocked.length === 0) {
      console.log(chalk.gray('No blocked issues.'));
      return;
    }

    console.log(chalk.bold('Blocked issues:'));
    for (const { issue, blockedBy } of blocked) {
      console.log(formatIssue(issue));
      for (const blocker of blockedBy) {
        console.log(chalk.gray(`  ← blocked by: ${blocker.id} (${blocker.title})`));
      }
    }
  });

// ── progress ─────────────────────────────────────────────────────────────────

program
  .command('progress')
  .description('Show progress summary')
  .action(async () => {
    await ensureInitialized();

    const progress = await store.getProgress();

    console.log(chalk.bold('Progress:'));
    console.log(`  Total:       ${progress.total}`);
    console.log(`  Open:        ${chalk.green(progress.open)}`);
    console.log(`  In Progress: ${chalk.yellow(progress.in_progress)}`);
    console.log(`  Closed:      ${chalk.gray(progress.closed)}`);
    console.log(`  Blocked:     ${chalk.red(progress.blocked)}`);

    if (progress.total > 0) {
      const completion = ((progress.closed / progress.total) * 100).toFixed(1);
      console.log(`\n  Completion: ${completion}%`);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

program.parse();
