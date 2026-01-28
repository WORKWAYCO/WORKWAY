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
} from './types.js';
import { DEFAULT_CHECKPOINT_POLICY } from './types.js';
import { parseSpec, formatSpecSummary, validateSpec } from './spec-parser.js';
import {
  createHarnessBranch,
} from './session.js';
import {
  createIssue,
  createHarnessIssue,
  createIssuesFromFeatures,
  readAllIssues,
  getOpenIssues,
  getIssue,
  getHarnessCheckpoints,
} from './beads.js';
import { parseIssueList } from './lib/utils/parseIssueList.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (defined first for use by other sections)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sleep for a given duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    gitBranch,
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
 * Uses Coordinator (Mayor pattern) to delegate work to workers.
 */
export async function runHarness(
  harnessState: HarnessState,
  options: { cwd: string; dryRun?: boolean; maxWorkers?: number }
): Promise<void> {
  // Use Coordinator pattern (GAS TOWN Mayor)
  const { Coordinator } = await import('./coordinator.js');

  const coordinator = new Coordinator(harnessState, {
    cwd: options.cwd,
    maxWorkers: options.maxWorkers || 1,
    dryRun: options.dryRun,
  });

  await coordinator.initialize();
  await coordinator.run();

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
 * Load harness state from a Beads issue.
 * Parses the issue description to extract state markers.
 */
async function loadHarnessState(issueId: string, cwd: string): Promise<HarnessState> {
  // Get harness issue
  const harnessIssue = await getIssue(issueId, cwd);
  if (!harnessIssue) {
    throw new Error(`Harness issue not found: ${issueId}`);
  }

  // Parse description for metadata
  const description = harnessIssue.description || '';

  // Extract spec file
  const specMatch = description.match(/Harness run for:\s*(.+)/);
  const specFile = specMatch ? specMatch[1].trim() : '';

  // Extract git branch from description or reconstruct
  const branchMatch = description.match(/Branch:\s*([\w\/-]+)/);
  const gitBranch = branchMatch ? branchMatch[1] : `harness/resumed-${issueId}`;

  // Get all associated issues to count completed/failed
  const allIssues = await readAllIssues(cwd);
  const associatedIssues = allIssues.filter((i) =>
    i.labels?.includes(`harness:${issueId}`) &&
    !i.labels?.includes('checkpoint') &&
    i.issue_type !== 'epic'
  );

  const completed = associatedIssues.filter((i) => i.status === 'closed').length;
  const failed = associatedIssues.filter((i) => i.labels?.includes('failed')).length;
  const total = associatedIssues.length;

  // Extract mode from description or labels
  let mode: 'workflow' | 'platform' = 'platform';
  if (description.includes('workflow') || harnessIssue.labels?.includes('workflow')) {
    mode = 'workflow';
  }

  // Get last checkpoint to restore policy
  const checkpoints = await getHarnessCheckpoints(issueId, cwd);
  const lastCheckpointId = checkpoints.length > 0 ? checkpoints[0].id : null;

  return {
    id: issueId,
    status: 'running',
    mode,
    specFile,
    gitBranch,
    startedAt: harnessIssue.created_at,
    currentSession: completed + failed,
    sessionsCompleted: completed + failed,
    featuresTotal: total,
    featuresCompleted: completed,
    featuresFailed: failed,
    lastCheckpoint: lastCheckpointId,
    checkpointPolicy: DEFAULT_CHECKPOINT_POLICY,
    pauseReason: null,
  };
}

/**
 * Load checkpoint context from the most recent checkpoint.
 * Returns AgentContext for session priming.
 */
async function loadCheckpointContext(harnessId: string, cwd: string): Promise<Checkpoint | null> {
  const checkpoints = await getHarnessCheckpoints(harnessId, cwd);

  if (checkpoints.length === 0) {
    return null;
  }

  // Get the most recent checkpoint issue
  const checkpointIssue = checkpoints[0];
  const description = checkpointIssue.description || '';

  // Parse checkpoint data from description
  const summaryMatch = description.match(/## Summary\n(.+)/);
  const completedMatch = description.match(/## Completed\n((?:- .+\n?)+)/);
  const inProgressMatch = description.match(/## In Progress\n((?:- .+\n?)+)/);
  const failedMatch = description.match(/## Failed\n((?:- .+\n?)+)/);
  const confidenceMatch = description.match(/## Confidence:\s*(\d+(?:\.\d+)?)%?/);
  const sessionMatch = checkpointIssue.title.match(/Checkpoint #(\d+)/);
  const gitCommitMatch = description.match(/Git Commit:\s*(\S+)/);
  const redirectMatch = description.match(/## Redirect Notes\n(.+?)(?:\n##|$)/s);

  return {
    id: checkpointIssue.id,
    harnessId,
    sessionNumber: sessionMatch ? parseInt(sessionMatch[1], 10) : 0,
    timestamp: checkpointIssue.created_at,
    summary: summaryMatch ? summaryMatch[1].trim() : 'No summary',
    issuesCompleted: parseIssueList(completedMatch?.[1]),
    issuesInProgress: parseIssueList(inProgressMatch?.[1]),
    issuesFailed: parseIssueList(failedMatch?.[1]),
    gitCommit: gitCommitMatch ? gitCommitMatch[1] : 'unknown',
    confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) / 100 : 0.5,
    redirectNotes: redirectMatch ? redirectMatch[1].trim() : null,
  };
}

/**
 * Resume a paused harness.
 * If harnessId is not provided or is 'current', finds the most recent harness.
 */
export async function resumeHarness(
  harnessId: string | undefined,
  cwd: string
): Promise<void> {
  // If no ID provided, find the most recent harness
  let targetHarnessId = harnessId;
  if (!targetHarnessId || targetHarnessId === 'current') {
    const issues = await getOpenIssues({}, cwd);
    const harnessIssues = issues
      .filter((i) => i.labels?.includes('harness') && i.issue_type === 'epic')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (harnessIssues.length === 0) {
      throw new Error('No harness found to resume. Use --id to specify a harness ID.');
    }

    targetHarnessId = harnessIssues[0].id;
    console.log(`\n📍 No harness ID provided, using most recent: ${targetHarnessId}\n`);
  }

  console.log(`\n🔄 Resuming harness: ${targetHarnessId}\n`);

  // Stop daemon
  console.log('   Stopping bd daemon...');
  await stopBdDaemon();

  // Load harness state
  console.log('   Loading harness state...');
  const harnessState = await loadHarnessState(targetHarnessId, cwd);

  console.log(`   Spec: ${harnessState.specFile}`);
  console.log(`   Branch: ${harnessState.gitBranch}`);
  console.log(`   Progress: ${harnessState.featuresCompleted}/${harnessState.featuresTotal} completed`);
  console.log(`   Failed: ${harnessState.featuresFailed}`);

  // Load last checkpoint context
  const lastCheckpoint = await loadCheckpointContext(targetHarnessId, cwd);
  if (lastCheckpoint) {
    console.log(`   Last checkpoint: #${lastCheckpoint.sessionNumber} (${(lastCheckpoint.confidence * 100).toFixed(0)}% confidence)`);
  }

  // Check out the git branch if it exists
  try {
    await execAsync(`git rev-parse --verify ${harnessState.gitBranch}`, { cwd });
    await execAsync(`git checkout ${harnessState.gitBranch}`, { cwd });
    console.log(`   Checked out branch: ${harnessState.gitBranch}`);
  } catch {
    console.log(`   Warning: Branch ${harnessState.gitBranch} not found, staying on current branch`);
  }

  // Resume the harness loop
  console.log('\n   Resuming harness loop...\n');
  await runHarness(harnessState, { cwd });
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

