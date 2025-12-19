/**
 * @workwayco/harness
 *
 * Runner: Main orchestration loop for the harness.
 * Zuhandenheit: The harness recedes into transparent operation.
 * Humans engage through progress reports—reactive steering rather than proactive management.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { BeadsStore } from '@workwayco/beads';
import type { Issue } from '@workwayco/beads';
import type {
  HarnessState,
  HarnessMode,
  StartOptions,
  Checkpoint,
  CheckpointPolicy,
  PrimingContext,
} from './types.js';
import { DEFAULT_CHECKPOINT_POLICY } from './types.js';
import { parseSpec, formatSpecSummary, validateSpec } from './spec-parser.js';
import {
  runSession,
  getRecentCommits,
  createHarnessBranch,
  generatePrimingPrompt,
  discoverDryContext,
} from './session.js';
import {
  createCheckpointTracker,
  recordSession,
  shouldCreateCheckpoint,
  shouldPauseForConfidence,
  generateCheckpoint,
  resetTracker,
  formatCheckpointDisplay,
  calculateConfidence,
} from './checkpoint.js';
import {
  takeSnapshot,
  checkForRedirects,
  formatRedirectNotes,
  requiresImmediateAction,
  logRedirect,
} from './redirect.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Stop the bd daemon to prevent beads file conflicts.
 * The daemon auto-syncs SQLite to JSONL every 5 seconds, which can
 * overwrite harness-created issues.
 *
 * We use `bd daemon --stop` for a clean stop, with pkill as fallback.
 */
async function stopBdDaemon(): Promise<void> {
  try {
    // First try the clean stop
    await execAsync('bd daemon --stop 2>/dev/null || true');
    // Then force kill any remaining processes
    await execAsync('pkill -f "bd daemon" 2>/dev/null || true');
  } catch {
    // Ignore errors - daemon might not be running
  }
}

/**
 * Disable git hooks that run bd commands.
 * The pre-commit and post-merge hooks run `bd sync` and `bd import`
 * which export SQLite to JSONL, overwriting harness issues.
 *
 * Returns a function to restore the hooks.
 */
async function disableGitHooks(cwd: string): Promise<() => Promise<void>> {
  const hooksDir = `${cwd}/.git/hooks`;
  const disabledHooks: string[] = [];

  try {
    // Disable pre-commit hook
    try {
      await execAsync(`mv "${hooksDir}/pre-commit" "${hooksDir}/pre-commit.harness-disabled" 2>/dev/null`);
      disabledHooks.push('pre-commit');
    } catch {
      // Hook doesn't exist
    }

    // Disable post-merge hook
    try {
      await execAsync(`mv "${hooksDir}/post-merge" "${hooksDir}/post-merge.harness-disabled" 2>/dev/null`);
      disabledHooks.push('post-merge');
    } catch {
      // Hook doesn't exist
    }

    if (disabledHooks.length > 0) {
      console.log(`   Disabled git hooks: ${disabledHooks.join(', ')}`);
    }
  } catch {
    // Ignore errors
  }

  // Return restore function
  return async () => {
    for (const hook of disabledHooks) {
      try {
        await execAsync(`mv "${hooksDir}/${hook}.harness-disabled" "${hooksDir}/${hook}" 2>/dev/null`);
      } catch {
        // Ignore errors
      }
    }
    if (disabledHooks.length > 0) {
      console.log(`   Restored git hooks: ${disabledHooks.join(', ')}`);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize a new harness run.
 */
export async function initializeHarness(
  options: StartOptions,
  cwd: string
): Promise<{ harnessState: HarnessState; featureMap: Map<string, string> }> {
  // Stop bd daemon before initialization to prevent beads conflicts
  await stopBdDaemon();

  console.log(`\n🚀 Initializing harness from spec: ${options.specFile}\n`);
  console.log(`   Mode: ${options.mode}`);

  // Use harness-specific beads directory to avoid conflicts with global bd CLI
  // The global bd CLI uses SQLite with JSONL sync, which conflicts with
  // BeadsStore's direct JSONL writes. Using .harness/.beads avoids this.
  const harnessRoot = join(cwd, '.harness');
  const store = new BeadsStore(harnessRoot);

  // Ensure Beads is initialized
  const initialized = await store.isInitialized();
  if (!initialized) {
    await store.init();
    console.log('   Initialized .harness/.beads directory');
  }

  // Read and parse spec
  const specContent = await readFile(options.specFile, 'utf-8');
  const spec = parseSpec(specContent);

  // Validate spec
  const validation = validateSpec(spec);
  if (!validation.valid) {
    console.error(chalk.red('\nSpec validation failed:'));
    for (const error of validation.errors) {
      console.error(chalk.red(`  - ${error}`));
    }
    throw new Error('Invalid spec file');
  }

  console.log(formatSpecSummary(spec));
  console.log(`\nParsed ${spec.features.length} features from spec.\n`);

  // Create checkpoint policy
  const checkpointPolicy: CheckpointPolicy = {
    afterSessions: options.checkpointEvery || 3,
    afterHours: options.maxHours || 4,
    onError: true,
    onConfidenceBelow: options.confidenceThreshold || 0.7,
    onRedirect: true,
  };

  // IMPORTANT: Create git branch FIRST, before any beads operations
  // This prevents git checkout from resetting the beads file after we've appended issues
  const slugTitle = spec.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30);
  const gitBranch = await createHarnessBranch(slugTitle, cwd);
  console.log(`Created git branch: ${gitBranch}`);

  // Now create harness issue (after branch switch, so it won't be lost)
  const harnessIssue = await store.createIssue({
    title: `Harness: ${spec.title}`,
    description: `Harness run for: ${options.specFile}\nMode: ${options.mode}\nFeatures: ${spec.features.length}\nStarted: ${new Date().toISOString()}\nBranch: ${gitBranch}`,
    type: 'epic',
    priority: 0,
    labels: ['harness'],
  });

  console.log(`Created harness issue: ${harnessIssue.id}`);

  // Create issues from features
  const featureMap = await createIssuesFromFeatures(
    spec.features,
    harnessIssue.id,
    store
  );
  console.log(`Created ${featureMap.size} issues in Beads.`);

  // DEBUG: Verify issues were written to file
  const verifyIssues = await store.getAllIssues();
  const harnessLabelIssues = verifyIssues.filter(i => i.labels.includes(`harness:${harnessIssue.id}`));
  console.log(`DEBUG: Store root: ${harnessRoot}`);
  console.log(`DEBUG: Total issues in store: ${verifyIssues.length}, with harness label: ${harnessLabelIssues.length}`);

  // Double-check by reading file directly
  const directContent = await readFile(`${harnessRoot}/.beads/issues.jsonl`, 'utf-8');
  const directLines = directContent.trim().split('\n').filter(Boolean);
  console.log(`DEBUG: Direct file read: ${directLines.length} lines\n`);

  const harnessState: HarnessState = {
    id: harnessIssue.id,
    status: 'running',
    mode: options.mode,
    specFile: options.specFile,
    gitBranch,
    startedAt: new Date().toISOString(),
    currentSession: 0,
    sessionsCompleted: 0,
    featuresTotal: spec.features.length,
    featuresCompleted: 0,
    featuresFailed: 0,
    lastCheckpoint: null,
    checkpointPolicy,
    pauseReason: null,
  };

  return { harnessState, featureMap };
}

/**
 * Create Beads issues from parsed features.
 */
async function createIssuesFromFeatures(
  features: Array<{
    id: string;
    title: string;
    description: string;
    priority: number;
    dependsOn: string[];
    labels: string[];
  }>,
  harnessId: string,
  store: BeadsStore
): Promise<Map<string, string>> {
  const featureToIssue = new Map<string, string>();

  // Create issues
  for (const feature of features) {
    const issue = await store.createIssue({
      title: feature.title,
      description: feature.description,
      type: 'feature',
      priority: feature.priority as 0 | 1 | 2 | 3 | 4,
      labels: [...feature.labels, `harness:${harnessId}`],
    });

    featureToIssue.set(feature.id, issue.id);
  }

  // Add dependencies
  for (const feature of features) {
    const issueId = featureToIssue.get(feature.id);
    if (!issueId) continue;

    for (const depFeatureId of feature.dependsOn) {
      const depIssueId = featureToIssue.get(depFeatureId);
      if (depIssueId) {
        await store.addDependency(issueId, depIssueId, 'blocks');
      }
    }
  }

  return featureToIssue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Loop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the harness loop.
 */
export async function runHarness(
  harnessState: HarnessState,
  options: { cwd: string; dryRun?: boolean }
): Promise<void> {
  // Stop bd daemon at harness start to prevent beads conflicts
  await stopBdDaemon();

  // Disable git hooks that run bd commands (pre-commit, post-merge)
  // These hooks export SQLite to JSONL which overwrites harness issues
  const restoreGitHooks = await disableGitHooks(options.cwd);

  // Use harness-specific beads directory (same as in initializeHarness)
  const harnessRoot = join(options.cwd, '.harness');
  const store = new BeadsStore(harnessRoot);
  const checkpointTracker = createCheckpointTracker();
  let beadsSnapshot = await takeSnapshot(options.cwd);
  let lastCheckpoint: Checkpoint | null = null;
  let redirectNotes: string[] = [];

  console.log(`\n${'═'.repeat(63)}`);
  console.log(`  HARNESS RUNNING: ${harnessState.id}`);
  console.log(`  Mode: ${harnessState.mode}`);
  console.log(`  Branch: ${harnessState.gitBranch}`);
  console.log(`  Features: ${harnessState.featuresTotal}`);
  console.log(`${'═'.repeat(63)}\n`);

  while (harnessState.status === 'running') {
    // Stop bd daemon at every iteration to prevent beads corruption
    // The daemon can restart during sessions and corrupt the beads file
    await stopBdDaemon();

    // 1. Check for redirects
    const redirectCheck = await checkForRedirects(
      beadsSnapshot,
      harnessState.id,
      options.cwd
    );

    beadsSnapshot = redirectCheck.newSnapshot;

    if (redirectCheck.redirects.length > 0) {
      console.log('\n📢 Redirects detected:');
      for (const redirect of redirectCheck.redirects) {
        console.log('  ' + logRedirect(redirect));
      }
      redirectNotes.push(...redirectCheck.redirects.map((r) => r.description));
    }

    // Check for pause request
    if (redirectCheck.shouldPause) {
      harnessState.status = 'paused';
      harnessState.pauseReason = redirectCheck.pauseReason;
      console.log(`\n⏸ Harness paused: ${redirectCheck.pauseReason}`);
      break;
    }

    // Check if redirects require immediate action
    if (requiresImmediateAction(redirectCheck.redirects)) {
      // Create checkpoint before handling redirect
      if (checkpointTracker.sessionsResults.length > 0) {
        lastCheckpoint = await generateCheckpoint(
          checkpointTracker,
          harnessState,
          formatRedirectNotes(redirectCheck.redirects),
          options.cwd
        );
        console.log('\n' + formatCheckpointDisplay(lastCheckpoint));
        resetTracker(checkpointTracker);
        harnessState.lastCheckpoint = lastCheckpoint.id;
      }
    }

    // 2. Get next work item (exclude checkpoints - they're progress reports, not tasks)
    const readyIssues = await store.getReadyIssues();
    console.log(`DEBUG: Ready issues: ${readyIssues.length}`);
    const harnessIssues = readyIssues.filter((issue) =>
      issue.labels.includes(`harness:${harnessState.id}`) &&
      !issue.labels.includes('checkpoint')
    );
    console.log(`DEBUG: Harness issues (${harnessState.id}): ${harnessIssues.length}`);

    if (harnessIssues.length === 0) {
      // No more work - debug why
      const allIssues = await store.getAllIssues();
      const allWithLabel = allIssues.filter(i => i.labels.includes(`harness:${harnessState.id}`));
      console.log(`DEBUG: Total issues: ${allIssues.length}, with harness label: ${allWithLabel.length}`);
      console.log(`DEBUG: By status: open=${allWithLabel.filter(i => i.status === 'open').length}, closed=${allWithLabel.filter(i => i.status === 'closed').length}, in_progress=${allWithLabel.filter(i => i.status === 'in_progress').length}`);
      harnessState.status = 'completed';
      console.log('\n✅ All tasks completed!');
      break;
    }

    const nextIssue = harnessIssues[0];
    console.log(`\n📋 Next task: ${nextIssue.id} - ${nextIssue.title}`);

    // Mark as in progress
    await store.updateIssue(nextIssue.id, { status: 'in_progress' });

    // 3. Build priming context with DRY discovery
    const recentCommits = await getRecentCommits(options.cwd, 10);

    // Discover existing patterns and relevant files (DRY)
    const dryContext = await discoverDryContext(nextIssue.title, options.cwd);
    if (dryContext.existingPatterns.length > 0 || dryContext.relevantFiles.length > 0) {
      console.log(`   Found ${dryContext.existingPatterns.length} patterns, ${dryContext.relevantFiles.length} relevant files`);
    }

    const primingContext: PrimingContext = {
      currentIssue: nextIssue,
      recentCommits,
      lastCheckpoint,
      redirectNotes,
      sessionGoal: `Complete: ${nextIssue.title}\n\n${nextIssue.description || ''}`,
      mode: harnessState.mode,
      existingPatterns: dryContext.existingPatterns,
      relevantFiles: dryContext.relevantFiles,
    };

    // Clear redirect notes for next iteration
    redirectNotes = [];

    // 4. Run session
    harnessState.currentSession++;
    console.log(`\n🤖 Starting session #${harnessState.currentSession}...`);

    // DEBUG: Check file before session (using harness beads directory)
    const beforeSession = await readFile(`${harnessRoot}/.beads/issues.jsonl`, 'utf-8');
    const beforeLines = beforeSession.trim().split('\n').filter(Boolean);
    const beforeHarness = beforeLines.filter(l => l.includes(`harness:${harnessState.id}`));
    console.log(`   DEBUG BEFORE: ${beforeLines.length} issues, ${beforeHarness.length} with harness label`);

    const sessionResult = await runSession(nextIssue, primingContext, {
      cwd: options.cwd,
      dryRun: options.dryRun,
    });

    // DEBUG: Check file after session (using harness beads directory)
    const afterSession = await readFile(`${harnessRoot}/.beads/issues.jsonl`, 'utf-8');
    const afterLines = afterSession.trim().split('\n').filter(Boolean);
    const afterHarness = afterLines.filter(l => l.includes(`harness:${harnessState.id}`));
    console.log(`   DEBUG AFTER: ${afterLines.length} issues, ${afterHarness.length} with harness label`);

    // 5. Handle session result
    recordSession(checkpointTracker, sessionResult);

    // Stop bd daemon before BeadsStore operations to prevent race conditions
    await stopBdDaemon();

    if (sessionResult.outcome === 'success') {
      await store.closeIssue(nextIssue.id);
      harnessState.featuresCompleted++;
      harnessState.sessionsCompleted++;
      console.log(chalk.green(`✅ Task completed: ${nextIssue.id}`));
    } else if (sessionResult.outcome === 'failure') {
      // Keep as in_progress for retry, but track failure
      harnessState.featuresFailed++;
      harnessState.sessionsCompleted++;
      console.log(chalk.red(`❌ Task failed: ${nextIssue.id}`));
      if (sessionResult.error) {
        console.log(chalk.red(`   Error: ${sessionResult.error}`));
      }
    } else if (sessionResult.outcome === 'partial') {
      harnessState.sessionsCompleted++;
      console.log(chalk.yellow(`◐ Task partially completed: ${nextIssue.id}`));
    } else if (sessionResult.outcome === 'context_overflow') {
      harnessState.sessionsCompleted++;
      console.log(chalk.yellow(`⚠ Context overflow: ${nextIssue.id}`));
    }

    // 6. Check checkpoint policy
    const checkpointCheck = shouldCreateCheckpoint(
      checkpointTracker,
      harnessState.checkpointPolicy,
      sessionResult,
      redirectCheck.redirects.length > 0
    );

    if (checkpointCheck.create) {
      console.log(`\n📊 Creating checkpoint: ${checkpointCheck.reason}`);
      lastCheckpoint = await generateCheckpoint(
        checkpointTracker,
        harnessState,
        formatRedirectNotes(redirectCheck.redirects),
        options.cwd
      );
      console.log('\n' + formatCheckpointDisplay(lastCheckpoint));
      resetTracker(checkpointTracker);
      harnessState.lastCheckpoint = lastCheckpoint.id;
    }

    // 7. Check confidence threshold
    if (shouldPauseForConfidence(
      checkpointTracker.sessionsResults,
      harnessState.checkpointPolicy.onConfidenceBelow
    )) {
      const confidence = calculateConfidence(checkpointTracker.sessionsResults);
      harnessState.status = 'paused';
      harnessState.pauseReason = `Confidence dropped to ${(confidence * 100).toFixed(0)}%`;
      console.log(`\n⏸ Harness paused: ${harnessState.pauseReason}`);

      // Create final checkpoint before pausing
      if (checkpointTracker.sessionsResults.length > 0) {
        lastCheckpoint = await generateCheckpoint(
          checkpointTracker,
          harnessState,
          `Low confidence pause`,
          options.cwd
        );
        console.log('\n' + formatCheckpointDisplay(lastCheckpoint));
      }
      break;
    }

    // Small delay between sessions to avoid overwhelming resources
    if (!options.dryRun) {
      await sleep(2000);
    }
  }

  // Restore git hooks before exiting
  await restoreGitHooks();

  // Final summary
  console.log(`\n${'═'.repeat(63)}`);
  console.log(`  HARNESS ${harnessState.status.toUpperCase()}`);
  console.log(`  Sessions: ${harnessState.sessionsCompleted}`);
  console.log(`  Features: ${harnessState.featuresCompleted}/${harnessState.featuresTotal} completed`);
  console.log(`  Failed: ${harnessState.featuresFailed}`);
  if (harnessState.pauseReason) {
    console.log(`  Pause Reason: ${harnessState.pauseReason}`);
  }
  console.log(`${'═'.repeat(63)}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Control Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find and resume an existing harness for a spec file.
 */
export async function findAndResumeHarness(
  specFile: string,
  cwd: string
): Promise<{ harnessState: HarnessState; featureMap: Map<string, string> } | null> {
  const store = new BeadsStore(cwd);
  const issues = await store.getOpenIssues();

  // Find harness issues that match this spec file
  const harnessIssues = issues.filter(
    (i) => i.labels.includes('harness') && i.description?.includes(specFile)
  );

  if (harnessIssues.length === 0) {
    return null;
  }

  // Use the most recent harness (first in list)
  const harnessIssue = harnessIssues[0];
  console.log(`\n📂 Found existing harness: ${harnessIssue.id}`);
  console.log(`   Title: ${harnessIssue.title}`);

  // Find associated issues
  const associatedIssues = issues.filter((i) =>
    i.labels.includes(`harness:${harnessIssue.id}`) && !i.labels.includes('checkpoint')
  );

  // Count status
  const completed = associatedIssues.filter((i) => i.status === 'closed').length;
  const failed = associatedIssues.filter((i) => i.labels.includes('failed')).length;
  const total = associatedIssues.length;

  console.log(`   Progress: ${completed}/${total} completed, ${failed} failed`);

  // Extract git branch from description
  const branchMatch = harnessIssue.description?.match(/Branch: ([\w\/-]+)/);
  const gitBranch = branchMatch ? branchMatch[1] : `harness/resumed-${Date.now()}`;

  // Reconstruct harness state
  const harnessState: HarnessState = {
    id: harnessIssue.id,
    status: 'running',
    mode: harnessIssue.description?.includes('workflow') ? 'workflow' : 'platform',
    specFile,
    gitBranch,
    startedAt: new Date().toISOString(),
    currentSession: completed + failed,
    sessionsCompleted: completed + failed,
    featuresTotal: total,
    featuresCompleted: completed,
    featuresFailed: failed,
    lastCheckpoint: null,
    checkpointPolicy: DEFAULT_CHECKPOINT_POLICY,
    pauseReason: null,
  };

  // Build feature map (id -> issue id)
  const featureMap = new Map<string, string>();
  for (const issue of associatedIssues) {
    featureMap.set(issue.id, issue.id);
  }

  return { harnessState, featureMap };
}

/**
 * Resume a paused harness.
 */
export async function resumeHarness(
  harnessId: string,
  cwd: string
): Promise<void> {
  // TODO: Load harness state from Beads issue metadata
  console.log(`Resuming harness: ${harnessId}`);
  console.log('Resume functionality not yet implemented.');
}

/**
 * Pause a running harness.
 */
export async function pauseHarness(
  harnessId: string,
  reason: string | undefined,
  cwd: string
): Promise<void> {
  const store = new BeadsStore(cwd);

  // Create a pause request issue
  await store.createIssue({
    title: reason || 'Pause requested',
    description: `Pause request for harness ${harnessId}`,
    type: 'task',
    priority: 0,
    labels: ['pause', `harness:${harnessId}`],
  });

  console.log(`Pause request created for harness: ${harnessId}`);
}

/**
 * Get status of a harness.
 */
export async function getHarnessStatus(
  harnessId: string | undefined,
  cwd: string
): Promise<void> {
  const store = new BeadsStore(cwd);

  // Find harness issues
  const issues = await store.getOpenIssues();
  const harnessIssues = issues.filter((i) => i.labels.includes('harness'));

  if (harnessIssues.length === 0) {
    console.log('No active harness found.');
    return;
  }

  for (const harness of harnessIssues) {
    if (harnessId && harness.id !== harnessId) continue;

    console.log(`\nHarness: ${harness.id}`);
    console.log(`  Title: ${harness.title}`);
    console.log(`  Status: ${harness.status}`);

    // Count associated issues
    const associatedIssues = issues.filter((i) =>
      i.labels.includes(`harness:${harness.id}`)
    );
    const completed = associatedIssues.filter((i) => i.status === 'closed').length;
    const total = associatedIssues.length;

    console.log(`  Progress: ${completed}/${total}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
