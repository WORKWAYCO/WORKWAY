#!/usr/bin/env node
/**
 * @workwayco/beads
 *
 * CLI for agent-native task management.
 * bd - Beads Data (mutations)
 *
 * Commands:
 *   bd init                 Initialize .beads directory
 *   bd onboard              Get started with beads
 *   bd prime                Load context for new session
 *   bd work "Title"         Create and start working on an issue
 *   bd work --id <id>       Start working on existing issue
 *   bd create "Title"       Create a new issue
 *   bd list                 List open issues (--json for JSON output)
 *   bd show <id>            Show issue details (--json for JSON output)
 *   bd update <id>          Update an issue
 *   bd close <id>           Close an issue (--reason "why")
 *   bd ready                Show ready issues (--json, --label)
 *   bd blocked              Show blocked issues
 *   bd progress             Show progress summary
 *   bd sync                 Sync .beads/ with git
 *   bd dep add <id> <dep>   Add a dependency
 *   bd label add <id> <l>   Add a label
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

/**
 * Agent-friendly error output with actionable suggestions.
 * Returns JSON when --json flag is set, otherwise human-readable.
 */
function agentError(message: string, suggestions: string[], exitCode = 1): never {
  const output = {
    error: true,
    message,
    suggestions,
    hint: suggestions[0],
  };
  
  // Check if --json flag was passed (from process.argv)
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.error(chalk.red(`Error: ${message}`));
    if (suggestions.length > 0) {
      console.error(chalk.gray('Suggestions:'));
      for (const s of suggestions) {
        console.error(chalk.gray(`  → ${s}`));
      }
    }
  }
  process.exit(exitCode);
}

/**
 * Issue not found error with helpful suggestions.
 */
async function issueNotFoundError(id: string): Promise<never> {
  const allIssues = await store.getAllIssues();
  const suggestions: string[] = [];
  
  // Find similar IDs
  const similar = allIssues
    .filter(i => i.id.includes(id.slice(-4)) || i.title.toLowerCase().includes(id.toLowerCase()))
    .slice(0, 3);
  
  if (similar.length > 0) {
    suggestions.push(`Did you mean: ${similar.map(i => i.id).join(', ')}?`);
  }
  
  suggestions.push('List all issues: bd list --all');
  suggestions.push('Create new issue: bd create "Title"');
  
  return agentError(`Issue not found: ${id}`, suggestions);
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
  .command('create [title]')
  .description('Create a new issue')
  .option('--title <text>', 'Issue title (alternative to positional arg)')
  .option('-d, --description <text>', 'Issue description')
  .option('-t, --type <type>', 'Issue type (bug|feature|task|epic|chore)', 'task')
  .option('-p, --priority <priority>', 'Priority (P0-P4)', 'P2')
  .option('-l, --labels <labels>', 'Comma-separated labels')
  .option('--json', 'Output created issue as JSON')
  .action(async (titleArg, options) => {
    await ensureInitialized();

    // Support both positional and --title flag
    const title = titleArg || options.title;
    if (!title) {
      console.error(chalk.red('Title is required. Use: bd create "Title" or bd create --title "Title"'));
      process.exit(1);
    }

    const issue = await store.createIssue({
      title,
      description: options.description,
      type: options.type as IssueType,
      priority: parsePriority(options.priority),
      labels: options.labels ? options.labels.split(',').map((l: string) => l.trim()) : [],
    });

    if (options.json) {
      console.log(JSON.stringify(issue, null, 2));
      return;
    }

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
  .option('--json', 'Output as JSON')
  .option('--limit <n>', 'Limit number of results')
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

    // Apply limit
    if (options.limit) {
      issues = issues.slice(0, parseInt(options.limit, 10));
    }

    if (options.json) {
      console.log(JSON.stringify(issues, null, 2));
      return;
    }

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
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await ensureInitialized();

    const issue = await store.getIssue(id);
    if (!issue) {
      await issueNotFoundError(id);
    }

    // Get dependencies
    const deps = await store.getDependencies(id);
    const dependents = await store.getDependents(id);

    if (options.json) {
      console.log(JSON.stringify({
        ...issue,
        dependencies: deps,
        blocking: dependents.map(d => d.issue_id),
      }, null, 2));
      return;
    }

    console.log(formatIssue(issue, true));

    // Show dependencies
    if (deps.length > 0) {
      console.log(chalk.gray('\nDependencies:'));
      for (const dep of deps) {
        console.log(chalk.gray(`  ${dep.type}: ${dep.depends_on_id}`));
      }
    }

    // Show dependents
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
      await issueNotFoundError(id);
    }

    console.log(chalk.green(`Updated: ${issue.id}`));
    console.log(formatIssue(issue));
  });

// ── close ────────────────────────────────────────────────────────────────────

program
  .command('close <id>')
  .description('Close an issue')
  .option('-r, --reason <text>', 'Reason for closing')
  .option('-c, --comment <text>', 'Comment when closing (alias for --reason)')
  .action(async (id, options) => {
    await ensureInitialized();

    const reason = options.reason || options.comment;

    // If reason provided, update description to include it
    if (reason) {
      const issue = await store.getIssue(id);
      if (issue) {
        const closingNote = `\n\n---\n**Closed**: ${reason}`;
        await store.updateIssue(id, {
          description: (issue.description || '') + closingNote,
        });
      }
    }

    const issue = await store.closeIssue(id);
    if (!issue) {
      await issueNotFoundError(id);
    }

    console.log(chalk.green(`Closed: ${issue.id}`));
    if (reason) {
      console.log(chalk.gray(`  Reason: ${reason}`));
    }
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
  .option('-l, --label <label>', 'Filter by label')
  .option('--limit <n>', 'Limit number of results')
  .action(async (options) => {
    await ensureInitialized();

    let issues = await store.getReadyIssues();

    if (options.label) {
      issues = issues.filter((i) => i.labels.includes(options.label));
    }

    if (options.limit) {
      issues = issues.slice(0, parseInt(options.limit, 10));
    }

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
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await ensureInitialized();

    const blocked = await store.getBlockedIssues();

    if (options.json) {
      console.log(JSON.stringify(blocked.map(({ issue, blockedBy }) => ({
        ...issue,
        blockedBy: blockedBy.map(b => ({ id: b.id, title: b.title })),
      })), null, 2));
      return;
    }

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
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await ensureInitialized();

    const progress = await store.getProgress();

    if (options.json) {
      const completion = progress.total > 0 
        ? ((progress.closed / progress.total) * 100).toFixed(1)
        : '0.0';
      console.log(JSON.stringify({ ...progress, completion: parseFloat(completion) }, null, 2));
      return;
    }

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

// ── sync ────────────────────────────────────────────────────────────────────

program
  .command('sync')
  .description('Sync beads with git (add .beads/ to staging)')
  .action(async () => {
    await ensureInitialized();

    const { execSync } = await import('node:child_process');

    try {
      // Add .beads/ directory to git staging
      execSync('git add .beads/', { stdio: 'pipe' });
      console.log(chalk.green('Synced: .beads/ added to git staging'));

      // Show what was added
      const status = execSync('git status --porcelain .beads/', { encoding: 'utf-8' });
      if (status.trim()) {
        console.log(chalk.gray('Changes staged:'));
        console.log(chalk.gray(status));
      } else {
        console.log(chalk.gray('No changes to sync.'));
      }
    } catch (error: any) {
      if (error.message?.includes('not a git repository')) {
        console.error(chalk.red('Not a git repository. Run from a git repo root.'));
      } else {
        console.error(chalk.red(`Sync failed: ${error.message}`));
      }
      process.exit(1);
    }
  });

// ── work ────────────────────────────────────────────────────────────────────

program
  .command('work [title]')
  .description('Start working on something (creates and claims issue atomically)')
  .option('-i, --id <id>', 'Work on existing issue by ID')
  .option('-t, --type <type>', 'Issue type (bug|feature|task|epic|chore)', 'task')
  .option('-p, --priority <priority>', 'Priority (P0-P4)', 'P2')
  .option('-l, --labels <labels>', 'Comma-separated labels')
  .action(async (title, options) => {
    await ensureInitialized();

    let issue: Issue | null = null;

    if (options.id) {
      // Work on existing issue
      issue = await store.getIssue(options.id);
      if (!issue) {
        console.error(chalk.red(`Issue not found: ${options.id}`));
        process.exit(1);
      }
    } else if (title) {
      // Create new issue
      issue = await store.createIssue({
        title,
        type: options.type as IssueType,
        priority: parsePriority(options.priority),
        labels: options.labels ? options.labels.split(',').map((l: string) => l.trim()) : [],
      });
      console.log(chalk.green(`Created: ${issue.id}`));
    } else {
      // No title or id - show ready issues and pick first one
      const ready = await store.getReadyIssues();
      if (ready.length === 0) {
        console.log(chalk.yellow('No ready issues. Create one with: bd work "Title"'));
        return;
      }
      issue = ready[0];
      console.log(chalk.gray(`Auto-selected highest priority ready issue:`));
    }

    // Mark as in_progress
    issue = await store.updateIssue(issue.id, { status: 'in_progress' });
    if (!issue) {
      console.error(chalk.red('Failed to update issue status'));
      process.exit(1);
    }

    console.log(chalk.green(`Working on: ${issue.id}`));
    console.log(formatIssue(issue, true));
  });

// ── onboard ─────────────────────────────────────────────────────────────────

program
  .command('onboard')
  .description('Get started with beads in this project')
  .action(async () => {
    const initialized = await store.isInitialized();

    if (!initialized) {
      console.log(chalk.yellow('Beads not initialized. Initializing now...'));
      await store.init();
      console.log(chalk.green('Initialized .beads directory.'));
    }

    // Show quick start guide
    console.log(chalk.bold('\n📋 Beads Quick Start\n'));
    console.log('Available commands:');
    console.log(chalk.cyan('  bd ready') + '              Show issues ready to work on');
    console.log(chalk.cyan('  bd work "Title"') + '       Create and start working on an issue');
    console.log(chalk.cyan('  bd work --id <id>') + '     Start working on existing issue');
    console.log(chalk.cyan('  bd close <id>') + '         Close an issue');
    console.log(chalk.cyan('  bd sync') + '               Sync .beads/ with git');
    console.log(chalk.cyan('  bd list') + '               List all open issues');
    console.log(chalk.cyan('  bd progress') + '           Show progress summary');
    console.log('');
    console.log(chalk.gray('Tip: Use --json flag for machine-readable output'));
  });

// ── prime ───────────────────────────────────────────────────────────────────

program
  .command('prime')
  .description('Load beads context for a new session')
  .action(async () => {
    await ensureInitialized();

    const progress = await store.getProgress();
    const ready = await store.getReadyIssues();
    const blocked = await store.getBlockedIssues();
    const inProgress = await store.getIssuesByStatus('in_progress');

    console.log(chalk.bold('📋 Beads Session Context\n'));

    // Summary
    console.log(chalk.gray('Progress:'));
    console.log(`  Total: ${progress.total} | Open: ${progress.open} | In Progress: ${progress.in_progress} | Closed: ${progress.closed}`);
    console.log('');

    // In progress (continue these)
    if (inProgress.length > 0) {
      console.log(chalk.yellow('⏳ In Progress (continue these):'));
      for (const issue of inProgress) {
        console.log(`  ${issue.id}: ${issue.title}`);
      }
      console.log('');
    }

    // Ready (start these)
    if (ready.length > 0) {
      console.log(chalk.green('✅ Ready to work on:'));
      for (const issue of ready.slice(0, 5)) {
        console.log(`  ${issue.id}: ${issue.title} (P${issue.priority})`);
      }
      if (ready.length > 5) {
        console.log(chalk.gray(`  ... and ${ready.length - 5} more`));
      }
      console.log('');
    }

    // Blocked (awareness)
    if (blocked.length > 0) {
      console.log(chalk.red('🚫 Blocked:'));
      for (const { issue, blockedBy } of blocked.slice(0, 3)) {
        console.log(`  ${issue.id}: ${issue.title}`);
        console.log(chalk.gray(`    ← blocked by: ${blockedBy.map(b => b.id).join(', ')}`));
      }
      console.log('');
    }

    // Next action suggestion
    if (inProgress.length > 0) {
      console.log(chalk.bold(`💡 Suggested: Continue ${inProgress[0].id}`));
    } else if (ready.length > 0) {
      console.log(chalk.bold(`💡 Suggested: bd work --id ${ready[0].id}`));
    } else {
      console.log(chalk.bold('💡 Suggested: bd create "New issue title"'));
    }
  });

// ── mol (molecules) ─────────────────────────────────────────────────────────

const mol = program
  .command('mol')
  .description('Molecule commands for multi-step workflows');

mol
  .command('current')
  .description('Show current molecule context (which workflow you are in)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await ensureInitialized();

    // Find issues with molecule labels or in_progress status that might be part of a workflow
    const inProgress = await store.getIssuesByStatus('in_progress');
    const deps = await store.getAllDependencies();
    
    // Find any issues that are part of a molecule (have mol- prefix in labels)
    const molIssues = inProgress.filter(i => 
      i.labels.some(l => l.startsWith('mol-')) || 
      i.labels.includes('molecule')
    );

    if (options.json) {
      console.log(JSON.stringify({
        inProgress: inProgress.map(i => ({ id: i.id, title: i.title, labels: i.labels })),
        molecules: molIssues.map(i => ({ id: i.id, title: i.title, labels: i.labels })),
      }, null, 2));
      return;
    }

    if (inProgress.length === 0) {
      console.log(chalk.gray('No active work session. Use "bd work" to start.'));
      return;
    }

    console.log(chalk.bold('📍 Current Context:'));
    console.log('');
    
    for (const issue of inProgress) {
      const issueDeps = deps.filter(d => d.issue_id === issue.id);
      const molLabel = issue.labels.find(l => l.startsWith('mol-'));
      
      console.log(`  ${chalk.cyan(issue.id)}: ${issue.title}`);
      if (molLabel) {
        console.log(chalk.gray(`    Molecule: ${molLabel}`));
      }
      if (issueDeps.length > 0) {
        console.log(chalk.gray(`    Dependencies: ${issueDeps.length}`));
      }
    }
  });

mol
  .command('catalog')
  .alias('list')
  .description('List available workflow templates (protos)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await ensureInitialized();

    // Protos are issues with the 'template' label
    const allIssues = await store.getAllIssues();
    const protos = allIssues.filter(i => i.labels.includes('template'));

    if (options.json) {
      console.log(JSON.stringify(protos, null, 2));
      return;
    }

    if (protos.length === 0) {
      console.log(chalk.gray('No workflow templates found.'));
      console.log('');
      console.log('Create a template by adding the "template" label to an epic:');
      console.log(chalk.cyan('  bd label add <epic-id> template'));
      return;
    }

    console.log(chalk.bold('📚 Available Templates (Protos):'));
    console.log('');
    for (const proto of protos) {
      console.log(`  ${chalk.cyan(proto.id)}: ${proto.title}`);
      if (proto.description) {
        console.log(chalk.gray(`    ${proto.description.substring(0, 60)}...`));
      }
    }
  });

mol
  .command('show <id>')
  .description('Show molecule or proto structure')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    await ensureInitialized();

    const issue = await store.getIssue(id);
    if (!issue) {
      await issueNotFoundError(id);
    }

    // Get child issues (those that depend on this one)
    const allIssues = await store.getAllIssues();
    const deps = await store.getAllDependencies();
    
    // Find issues that have this issue as a parent (discovered-from or parent-child)
    const children = deps
      .filter(d => d.depends_on_id === id && (d.type === 'parent-child' || d.type === 'discovered-from'))
      .map(d => allIssues.find(i => i.id === d.issue_id))
      .filter(Boolean) as typeof allIssues;

    if (options.json) {
      console.log(JSON.stringify({ issue, children }, null, 2));
      return;
    }

    console.log(chalk.bold('🧬 Molecule Structure:'));
    console.log('');
    console.log(`  ${chalk.cyan(issue.id)}: ${issue.title}`);
    console.log(`  Type: ${issue.issue_type} | Status: ${issue.status} | Priority: P${issue.priority}`);
    if (issue.labels.length > 0) {
      console.log(`  Labels: ${issue.labels.join(', ')}`);
    }
    console.log('');

    if (children.length > 0) {
      console.log(chalk.bold('  Steps:'));
      for (const child of children) {
        const statusIcon = child.status === 'closed' ? '✓' : child.status === 'in_progress' ? '→' : '○';
        console.log(`    ${statusIcon} ${child.id}: ${child.title}`);
      }
    } else {
      console.log(chalk.gray('  No child steps. Add steps with:'));
      console.log(chalk.gray(`    bd create "Step 1" && bd dep add <step-id> parent-child ${id}`));
    }
  });

mol
  .command('spawn <proto-id>')
  .description('Create a new molecule instance from a template')
  .option('--var <vars...>', 'Variables in key=value format')
  .option('--name <name>', 'Name for the new molecule')
  .option('--wisp', 'Create as ephemeral wisp instead of persistent mol')
  .action(async (protoId, options) => {
    await ensureInitialized();

    const proto = await store.getIssue(protoId);
    if (!proto) {
      await issueNotFoundError(protoId);
    }

    if (!proto.labels.includes('template')) {
      agentError(
        `Issue ${protoId} is not a template`,
        [
          `Add template label: bd label add ${protoId} template`,
          'List available templates: bd mol catalog',
        ]
      );
    }

    // Parse variables
    const vars: Record<string, string> = {};
    if (options.var) {
      for (const v of options.var) {
        const [key, value] = v.split('=');
        if (key && value) vars[key] = value;
      }
    }

    // Create new molecule from proto
    const molName = options.name || proto.title;
    const mol = await store.createIssue({
      title: `[mol] ${molName}`,
      description: `Spawned from proto: ${protoId}\n\n${proto.description || ''}`,
      type: proto.issue_type,
      priority: proto.priority,
      labels: [
        ...proto.labels.filter(l => l !== 'template'),
        `mol-${protoId}`,
        options.wisp ? 'wisp' : 'molecule',
      ],
      metadata: { proto_id: protoId, vars },
    });

    // Add parent-child dependency
    await store.addDependency(mol.id, protoId, 'discovered-from');

    console.log(chalk.green(`Created molecule: ${mol.id}`));
    console.log(formatIssue(mol));
    console.log('');
    console.log(chalk.gray('Next: Start working with bd work --id ' + mol.id));
  });

// ── pour (alias for mol spawn) ──────────────────────────────────────────────

program
  .command('pour <proto-id>')
  .description('Create a persistent molecule from a template (alias for mol spawn)')
  .option('--var <vars...>', 'Variables in key=value format')
  .option('--name <name>', 'Name for the new molecule')
  .action(async (protoId, options) => {
    await ensureInitialized();

    // Delegate to mol spawn
    const proto = await store.getIssue(protoId);
    if (!proto) {
      await issueNotFoundError(protoId);
    }

    if (!proto.labels.includes('template')) {
      agentError(
        `Issue ${protoId} is not a template`,
        [
          `Add template label: bd label add ${protoId} template`,
          'List available templates: bd mol catalog',
        ]
      );
    }

    // Parse variables
    const vars: Record<string, string> = {};
    if (options.var) {
      for (const v of options.var) {
        const [key, value] = v.split('=');
        if (key && value) vars[key] = value;
      }
    }

    const molName = options.name || proto.title;
    const mol = await store.createIssue({
      title: `[mol] ${molName}`,
      description: `Poured from proto: ${protoId}\n\n${proto.description || ''}`,
      type: proto.issue_type,
      priority: proto.priority,
      labels: [
        ...proto.labels.filter(l => l !== 'template'),
        `mol-${protoId}`,
        'molecule',
      ],
      metadata: { proto_id: protoId, vars },
    });

    await store.addDependency(mol.id, protoId, 'discovered-from');

    console.log(chalk.green(`Poured molecule: ${mol.id}`));
    console.log(formatIssue(mol));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

program.parse();
