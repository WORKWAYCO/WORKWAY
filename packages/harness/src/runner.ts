/**
 * @workwayco/harness
 *
 * Runner: Main orchestration loop for the harness.
 * Zuhandenheit: The harness recedes into transparent operation.
 * Humans engage through progress reports—reactive steering rather than proactive management.
 *
 * CRITICAL: The bd daemon MUST be stopped during harness runs.
 * The daemon's git sync feature pulls stale JSONL from sync branches,
 * which overwrites SQLite and causes harness-created issues to vanish.
 * We stop the daemon at start and restart it at end.
 */

import { readFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';

const execAsync = promisify(exec);
import type {
  HarnessState,
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
import {
  createIssue,
  createHarnessIssue,
  createIssuesFromFeatures,
  getHarnessReadyIssues,
  updateIssueStatus,
  readAllIssues,
  getOpenIssues,
} from './beads.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (defined first for use by other sections)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format duration in human-readable form.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Display success feedback when harness completes successfully.
 */
function displaySuccessFeedback(state: HarnessState, startTime: Date): void {
  const duration = Date.now() - startTime.getTime();
  const successRate = state.featuresTotal > 0
    ? ((state.featuresCompleted / state.featuresTotal) * 100).toFixed(0)
    : '100';

  console.log('');
  console.log(chalk.green.bold('╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.green.bold('║                                                                ║'));
  console.log(chalk.green.bold('║                    🎉 HARNESS COMPLETE 🎉                      ║'));
  console.log(chalk.green.bold('║                                                                ║'));
  console.log(chalk.green.bold('╚════════════════════════════════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.green(`  ✅ All ${state.featuresCompleted} tasks completed successfully!`));
  console.log('');
  console.log(chalk.white('  Summary:'));
  console.log(chalk.white(`    • Features completed: ${state.featuresCompleted}/${state.featuresTotal}`));
  console.log(chalk.white(`    • Sessions run: ${state.sessionsCompleted}`));
  console.log(chalk.white(`    • Success rate: ${successRate}%`));
  console.log(chalk.white(`    • Duration: ${formatDuration(duration)}`));
  console.log(chalk.white(`    • Branch: ${state.gitBranch}`));
  console.log('');
  console.log(chalk.cyan('  Next steps:'));
  console.log(chalk.cyan('    1. Review changes: git diff main'));
  console.log(chalk.cyan('    2. Run tests: pnpm test'));
  console.log(chalk.cyan('    3. Merge to main: git checkout main && git merge ' + state.gitBranch));
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Daemon Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stop the bd daemon to prevent sync conflicts during harness runs.
 *
 * The daemon's git sync feature pulls JSONL from sync branches,
 * which can overwrite SQLite data and cause harness-created issues to vanish.
 */
async function stopBdDaemon(): Promise<void> {
  try {
    // Try graceful stop via CLI
    await execAsync('bd daemon --stop');
    console.log('   Stopped bd daemon via CLI');
  } catch {
    // CLI stop failed, try direct process kill
    try {
      const { stdout } = await execAsync('pgrep -f "bd daemon"');
      const pids = stdout.trim().split('\n').filter(Boolean);
      if (pids.length > 0) {
        for (const pid of pids) {
          await execAsync(`kill ${pid}`).catch(() => {});
        }
        console.log(`   Killed ${pids.length} bd daemon process(es)`);
      }
    } catch {
      // No daemon running, which is fine
      console.log('   No bd daemon running');
    }
  }

  // Wait a moment for cleanup
  await sleep(500);
}

/**
 * Restart the bd daemon after harness completion.
 * Uses fire-and-forget pattern since daemon runs in background.
 */
async function startBdDaemon(): Promise<void> {
  // Sync first to commit all harness changes to JSONL
  try {
    await execAsync('bd sync');
    console.log('   Synced harness changes to JSONL');
  } catch {
    console.log('   Warning: bd sync failed');
  }

  // Start daemon using fire-and-forget (don't await)
  exec('bd daemon --start', (err) => {
    if (err) {
      console.log('   Warning: Could not restart bd daemon - run manually: bd daemon --start');
    }
  });

  // Give daemon a moment to start
  await sleep(1000);

  // Verify daemon is running
  try {
    await execAsync('pgrep -f "bd daemon"');
    console.log('   Restarted bd daemon');
  } catch {
    console.log('   Warning: bd daemon may not have started - run manually: bd daemon --start');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize a new harness run.
 * IMPORTANT: Stops bd daemon to prevent sync conflicts.
 */
export async function initializeHarness(
  options: StartOptions,
  cwd: string
): Promise<{ harnessState: HarnessState; featureMap: Map<string, string> }> {
  console.log(`\n🚀 Initializing harness from spec: ${options.specFile}\n`);
  console.log(`   Mode: ${options.mode}`);

  // CRITICAL: Stop bd daemon to prevent sync overwrites
  console.log('   Stopping bd daemon...');
  await stopBdDaemon();

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

  // Create git branch FIRST, before any beads operations
  const slugTitle = spec.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30);
  const gitBranch = await createHarnessBranch(slugTitle, cwd);
  console.log(`Created git branch: ${gitBranch}`);

  // Create harness issue via bd CLI
  const harnessId = await createHarnessIssue(
    spec.title,
    options.specFile,
    spec.features.length,
    cwd
  );
  console.log(`Created harness issue: ${harnessId}`);

  // Create issues from features via bd CLI
  const featureMap = await createIssuesFromFeatures(
    spec.features,
    harnessId,
    cwd
  );
  console.log(`Created ${featureMap.size} issues in Beads.`);

  // Verify via bd CLI
  const verifyIssues = await readAllIssues(cwd);
  const harnessLabelIssues = verifyIssues.filter(i => i.labels?.includes(`harness:${harnessId}`));
  console.log(`DEBUG: Total issues: ${verifyIssues.length}, with harness label: ${harnessLabelIssues.length}\n`);

  const harnessState: HarnessState = {
    id: harnessId,
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

// ─────────────────────────────────────────────────────────────────────────────
// Main Loop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the harness loop.
 * Uses bd CLI for all beads operations - no daemon/sync conflicts.
 */
export async function runHarness(
  harnessState: HarnessState,
  options: { cwd: string; dryRun?: boolean }
): Promise<void> {
  const checkpointTracker = createCheckpointTracker();
  let beadsSnapshot = await takeSnapshot(options.cwd);
  let lastCheckpoint: Checkpoint | null = null;
  let redirectNotes: string[] = [];
  const startTime = new Date();

  console.log(`\n${'═'.repeat(63)}`);
  console.log(`  HARNESS RUNNING: ${harnessState.id}`);
  console.log(`  Mode: ${harnessState.mode}`);
  console.log(`  Branch: ${harnessState.gitBranch}`);
  console.log(`  Features: ${harnessState.featuresTotal}`);
  console.log(`${'═'.repeat(63)}\n`);

  while (harnessState.status === 'running') {
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

    // 2. Get next work item via bd CLI
    const harnessIssues = await getHarnessReadyIssues(harnessState.id, options.cwd);

    if (harnessIssues.length === 0) {
      // No more work - all tasks completed
      harnessState.status = 'completed';
      displaySuccessFeedback(harnessState, startTime);
      break;
    }

    const nextIssue = harnessIssues[0];
    console.log(`\n📋 Next task: ${nextIssue.id} - ${nextIssue.title}`);

    // Mark as in progress via bd CLI
    await updateIssueStatus(nextIssue.id, 'in_progress', options.cwd);

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

    const sessionResult = await runSession(nextIssue, primingContext, {
      cwd: options.cwd,
      dryRun: options.dryRun,
    });

    // 5. Handle session result (Two-Stage Verification)
    recordSession(checkpointTracker, sessionResult);

    if (sessionResult.outcome === 'success') {
      // Fully verified - close the issue
      await updateIssueStatus(nextIssue.id, 'closed', options.cwd);
      harnessState.featuresCompleted++;
      harnessState.sessionsCompleted++;
      console.log(chalk.green(`✅ Task verified and completed: ${nextIssue.id}`));
    } else if (sessionResult.outcome === 'code_complete') {
      // Code complete but not verified - keep in_progress, add label
      // Next session should verify this feature before moving on
      harnessState.sessionsCompleted++;
      console.log(chalk.cyan(`◑ Code complete (awaiting verification): ${nextIssue.id}`));
      console.log(chalk.cyan(`   Feature needs E2E verification before closing`));
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

  // Final summary (only for non-completed states - success already shown above)
  if (harnessState.status !== 'completed') {
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

  // CRITICAL: Restart bd daemon now that harness is done
  console.log('   Restarting bd daemon...');
  await startBdDaemon();
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
  const issues = await getOpenIssues({}, cwd);

  // Find harness issues that match this spec file
  const harnessIssues = issues.filter(
    (i) => i.labels?.includes('harness') && i.description?.includes(specFile)
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
    i.labels?.includes(`harness:${harnessIssue.id}`) && !i.labels?.includes('checkpoint')
  );

  // Count status
  const completed = associatedIssues.filter((i) => i.status === 'closed').length;
  const failed = associatedIssues.filter((i) => i.labels?.includes('failed')).length;
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
  // Create a pause request issue via bd CLI
  await createIssue(
    reason || 'Pause requested',
    {
      type: 'task',
      priority: 0,
      labels: ['pause', `harness:${harnessId}`],
      description: `Pause request for harness ${harnessId}`,
    },
    cwd
  );

  console.log(`Pause request created for harness: ${harnessId}`);
}

/**
 * Get status of a harness.
 */
export async function getHarnessStatus(
  harnessId: string | undefined,
  cwd: string
): Promise<void> {
  // Find harness issues via bd CLI
  const issues = await getOpenIssues({}, cwd);
  const harnessIssues = issues.filter((i) => i.labels?.includes('harness'));

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
      i.labels?.includes(`harness:${harness.id}`)
    );
    const completed = associatedIssues.filter((i) => i.status === 'closed').length;
    const total = associatedIssues.length;

    console.log(`  Progress: ${completed}/${total}`);
  }
}

