/**
 * @workwayco/harness
 *
 * Session: Spawn and manage Claude Code sessions.
 * Generates priming prompts and detects session outcomes.
 */

import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Issue } from '@workwayco/beads';
import type {
  PrimingContext,
  SessionResult,
  SessionOutcome,
  HarnessMode,
  Checkpoint,
} from './types.js';

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────────────────────
// Git Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get recent git commits.
 */
export async function getRecentCommits(cwd: string, count = 10): Promise<string[]> {
  try {
    const { stdout } = await execAsync(
      `git log --oneline -n ${count}`,
      { cwd }
    );
    return stdout.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get the current HEAD commit hash.
 */
export async function getHeadCommit(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Create a harness branch.
 */
export async function createHarnessBranch(slugTitle: string, cwd: string): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const branchName = `harness/${slugTitle}-${date}`;

  try {
    await execAsync(`git checkout -b ${branchName}`, { cwd });
  } catch {
    // Branch might already exist
    await execAsync(`git checkout ${branchName}`, { cwd });
  }

  return branchName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Priming Prompts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a priming prompt for a session.
 */
export function generatePrimingPrompt(context: PrimingContext): string {
  const lines: string[] = [];

  // Mode-specific header
  if (context.mode === 'workflow') {
    lines.push('You are implementing a WORKWAY workflow feature.');
    lines.push('');
    lines.push('## WORKWAY Patterns');
    lines.push('- Use `defineWorkflow()` for all workflows');
    lines.push('- Follow Zuhandenheit: the tool should recede');
    lines.push('- Test with `workway test` before marking complete');
  } else {
    lines.push('You are implementing a WORKWAY platform component.');
    lines.push('');
    lines.push('## WORKWAY Conventions');
    lines.push('- Packages in `packages/`');
    lines.push('- Workers in `packages/workers/`');
    lines.push('- Apps in `apps/`');
    lines.push('- Follow Zuhandenheit and Weniger, aber besser');
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Current issue
  lines.push('## Current Issue');
  lines.push(`**${context.currentIssue.title}** (${context.currentIssue.id})`);
  lines.push('');
  if (context.currentIssue.description) {
    lines.push(context.currentIssue.description);
    lines.push('');
  }

  // Session goal
  lines.push('## Session Goal');
  lines.push(context.sessionGoal);
  lines.push('');

  // Context from previous work
  if (context.recentCommits.length > 0) {
    lines.push('## Recent Commits');
    for (const commit of context.recentCommits.slice(0, 5)) {
      lines.push(`- ${commit}`);
    }
    lines.push('');
  }

  // Last checkpoint summary
  if (context.lastCheckpoint) {
    lines.push('## Last Checkpoint');
    lines.push(`Session #${context.lastCheckpoint.sessionNumber}: ${context.lastCheckpoint.summary}`);
    lines.push(`Confidence: ${(context.lastCheckpoint.confidence * 100).toFixed(0)}%`);
    lines.push('');
  }

  // Redirect notes
  if (context.redirectNotes.length > 0) {
    lines.push('## Human Redirect Notes');
    for (const note of context.redirectNotes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  // Completion criteria
  lines.push('## Completion Criteria');
  lines.push('1. All acceptance criteria met');
  if (context.mode === 'workflow') {
    lines.push('2. `workway test` passes');
  } else {
    lines.push('2. TypeScript compiles without errors');
    lines.push('3. Tests pass');
  }
  lines.push('3. Issue commented with implementation notes');
  lines.push('4. Status updated to Done');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('Begin working on this issue. When complete, close the issue with `bd close <id>`.');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a Claude Code session.
 */
export async function runSession(
  issue: Issue,
  context: PrimingContext,
  options: { cwd: string; dryRun?: boolean }
): Promise<SessionResult> {
  const startTime = Date.now();
  const startCommit = await getHeadCommit(options.cwd);

  // Generate priming prompt
  const prompt = generatePrimingPrompt(context);

  if (options.dryRun) {
    console.log('\n--- DRY RUN: Priming Prompt ---');
    console.log(prompt);
    console.log('--- END ---\n');

    return {
      issueId: issue.id,
      outcome: 'success',
      summary: '[DRY RUN] Would have executed session',
      gitCommit: null,
      contextUsed: 0,
      durationMs: Date.now() - startTime,
      error: null,
    };
  }

  try {
    // Write prompt to temp file
    const promptDir = join(options.cwd, '.harness');
    await mkdir(promptDir, { recursive: true });
    const promptFile = join(promptDir, 'current-prompt.md');
    await writeFile(promptFile, prompt);

    // Spawn Claude Code with the prompt
    // Using -p flag to pass prompt, --dangerously-skip-permissions for automation
    const result = await runClaudeCode(prompt, options.cwd);

    // Get end commit
    const endCommit = await getHeadCommit(options.cwd);
    const gitCommit = endCommit !== startCommit ? endCommit : null;

    // Detect outcome from output
    const outcome = detectOutcome(result.output, result.exitCode);

    return {
      issueId: issue.id,
      outcome,
      summary: extractSummary(result.output),
      gitCommit,
      contextUsed: result.contextUsed,
      durationMs: Date.now() - startTime,
      error: outcome === 'failure' ? extractError(result.output) : null,
    };
  } catch (error) {
    return {
      issueId: issue.id,
      outcome: 'failure',
      summary: 'Session failed with error',
      gitCommit: null,
      contextUsed: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run Claude Code CLI with a prompt.
 */
async function runClaudeCode(
  prompt: string,
  cwd: string
): Promise<{ output: string; exitCode: number; contextUsed: number }> {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--dangerously-skip-permissions',
      '--output-format', 'text',
    ];

    const child = spawn('claude', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      // Try to extract context usage from output
      const contextMatch = output.match(/context[:\s]+(\d+)/i);
      const contextUsed = contextMatch ? parseInt(contextMatch[1], 10) : 0;

      resolve({
        output: output + errorOutput,
        exitCode: code ?? 0,
        contextUsed,
      });
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Set a timeout (30 minutes max per session)
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        output: output + '\n[TIMEOUT]',
        exitCode: 124,
        contextUsed: 0,
      });
    }, 30 * 60 * 1000);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcome Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect session outcome from output.
 */
function detectOutcome(output: string, exitCode: number): SessionOutcome {
  const lower = output.toLowerCase();

  // Context overflow indicators
  if (
    lower.includes('context limit') ||
    lower.includes('context overflow') ||
    lower.includes('token limit') ||
    lower.includes('ran out of context')
  ) {
    return 'context_overflow';
  }

  // Success indicators
  if (
    lower.includes('completed') ||
    lower.includes('done') ||
    lower.includes('finished') ||
    lower.includes('closed issue') ||
    lower.includes('bd close')
  ) {
    return 'success';
  }

  // Partial progress indicators
  if (
    lower.includes('partial') ||
    lower.includes('in progress') ||
    lower.includes('continuing') ||
    lower.includes('blocked') ||
    lower.includes('need clarification')
  ) {
    return 'partial';
  }

  // Failure indicators
  if (
    exitCode !== 0 ||
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('unable to')
  ) {
    return 'failure';
  }

  // Default to partial (better safe than marking success prematurely)
  return 'partial';
}

/**
 * Extract a summary from session output.
 */
function extractSummary(output: string): string {
  // Look for a summary section
  const summaryMatch = output.match(/## summary\n([\s\S]*?)(?:\n##|$)/i);
  if (summaryMatch) {
    return summaryMatch[1].trim().slice(0, 500);
  }

  // Take the last few meaningful lines
  const lines = output.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const lastLines = lines.slice(-5).join('\n');
  return lastLines.slice(0, 500);
}

/**
 * Extract error message from output.
 */
function extractError(output: string): string {
  // Look for error patterns
  const errorMatch = output.match(/error[:\s]+(.+)/i);
  if (errorMatch) {
    return errorMatch[1].trim().slice(0, 200);
  }

  return 'Session ended with errors';
}
