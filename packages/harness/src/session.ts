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
// DRY Context Discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discover existing patterns and files relevant to an issue.
 * This helps the agent avoid duplicating existing work.
 */
export async function discoverDryContext(
  issueTitle: string,
  cwd: string
): Promise<{ existingPatterns: string[]; relevantFiles: string[] }> {
  const existingPatterns: string[] = [];
  const relevantFiles: string[] = [];

  // Extract keywords from issue title
  const keywords = extractKeywords(issueTitle);

  // Always include CLAUDE.md if it exists
  try {
    await execAsync('test -f CLAUDE.md', { cwd });
    relevantFiles.push('CLAUDE.md');
  } catch {
    // CLAUDE.md doesn't exist
  }

  // Always include .claude/rules if they exist
  try {
    const { stdout } = await execAsync('ls .claude/rules/*.md 2>/dev/null || true', { cwd });
    const rules = stdout.trim().split('\n').filter(Boolean);
    if (rules.length > 0) {
      relevantFiles.push(...rules.slice(0, 3)); // Max 3 rule files
      existingPatterns.push('Project rules exist in .claude/rules/ - read before implementing');
    }
  } catch {
    // No rules
  }

  // Search for relevant files based on keywords (exclude archive, node_modules, dist)
  for (const keyword of keywords.slice(0, 3)) { // Limit to 3 keywords
    try {
      // Search for files containing the keyword, excluding non-source directories
      const { stdout } = await execAsync(
        `find . -type f \\( -name "*.ts" -o -name "*.svelte" -o -name "*.css" \\) -not -path "*/node_modules/*" -not -path "*/.archive/*" -not -path "*/dist/*" -not -path "*/.git/*" 2>/dev/null | xargs grep -l -i "${keyword}" 2>/dev/null | head -5`,
        { cwd }
      );
      const files = stdout.trim().split('\n').filter(Boolean);
      for (const file of files) {
        if (!relevantFiles.includes(file) && relevantFiles.length < 10) {
          relevantFiles.push(file);
        }
      }
    } catch {
      // No matches
    }
  }

  // Detect existing patterns based on issue content
  const lowerTitle = issueTitle.toLowerCase();

  if (lowerTitle.includes('component') || lowerTitle.includes('ui')) {
    existingPatterns.push('Check existing components in src/lib/components/ or similar directories');
  }

  if (lowerTitle.includes('style') || lowerTitle.includes('css') || lowerTitle.includes('design')) {
    existingPatterns.push('Use design tokens from CDN: https://cdn.workway.co/tokens.css');
    existingPatterns.push('Check app.css or tailwind.config.js for existing styles');
  }

  if (lowerTitle.includes('seo') || lowerTitle.includes('meta')) {
    existingPatterns.push('Check +page.svelte files for existing meta tag patterns');
    existingPatterns.push('Use svelte:head for meta tags');
  }

  if (lowerTitle.includes('api') || lowerTitle.includes('fetch')) {
    existingPatterns.push('Check packages/integrations/src/ for BaseAPIClient patterns');
  }

  if (lowerTitle.includes('workflow')) {
    existingPatterns.push('Use defineWorkflow() from @workwayco/sdk');
    existingPatterns.push('Check packages/workflows/src/ for existing workflow patterns');
  }

  if (lowerTitle.includes('schema') || lowerTitle.includes('structured data')) {
    existingPatterns.push('Add JSON-LD in svelte:head with type="application/ld+json"');
  }

  return { existingPatterns, relevantFiles };
}

/**
 * Extract meaningful keywords from an issue title.
 */
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'add', 'update', 'create', 'implement', 'fix', 'use', 'make', 'get',
  ]);

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .slice(0, 5);
}

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
 * Uses timestamp suffix to ensure uniqueness and prevent reusing old branches.
 */
export async function createHarnessBranch(slugTitle: string, cwd: string): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const baseBranchName = `harness/${slugTitle}-${date}`;

  // First, try to create the base branch name
  try {
    await execAsync(`git checkout -b ${baseBranchName}`, { cwd });
    return baseBranchName;
  } catch {
    // Branch exists - create a unique one with timestamp suffix
    const timestamp = Date.now().toString(36); // Short unique suffix
    const uniqueBranchName = `${baseBranchName}-${timestamp}`;

    try {
      await execAsync(`git checkout -b ${uniqueBranchName}`, { cwd });
      return uniqueBranchName;
    } catch {
      // If we still can't create, just stay on current branch
      const { stdout } = await execAsync('git branch --show-current', { cwd });
      console.log(`Warning: Could not create harness branch, staying on: ${stdout.trim()}`);
      return stdout.trim();
    }
  }
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

  // DRY Principles - Critical for agent behavior
  lines.push('## DRY Principles (CRITICAL)');
  lines.push('');
  lines.push('Before writing ANY code:');
  lines.push('1. **Read first** - ALWAYS read existing files before modifying or creating new ones');
  lines.push('2. **Search for patterns** - Use Grep/Glob to find existing implementations of similar functionality');
  lines.push('3. **Reuse, don\'t recreate** - If a pattern, component, or utility exists, USE it');
  lines.push('4. **Edit over create** - Prefer editing existing files over creating new ones');
  lines.push('5. **Check CLAUDE.md** - Read project rules and conventions first');
  lines.push('');
  lines.push('**Anti-patterns to AVOID:**');
  lines.push('- Creating a new file without checking if similar exists');
  lines.push('- Duplicating utility functions that exist elsewhere');
  lines.push('- Hardcoding values that are defined as design tokens');
  lines.push('- Ignoring existing component patterns in the codebase');
  lines.push('- Writing code before understanding the existing architecture');
  lines.push('');

  // Existing patterns context
  if (context.existingPatterns && context.existingPatterns.length > 0) {
    lines.push('## Existing Patterns to Reuse');
    for (const pattern of context.existingPatterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push('');
  }

  // Relevant files to reference
  if (context.relevantFiles && context.relevantFiles.length > 0) {
    lines.push('## Relevant Files to Reference');
    for (const file of context.relevantFiles) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

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

    // Log session output for debugging
    const sessionLog = join(promptDir, `session-${issue.id}-${Date.now()}.log`);
    await writeFile(sessionLog, `Exit Code: ${result.exitCode}\n\n--- OUTPUT ---\n${result.output}`);
    console.log(`   Session log: ${sessionLog}`);

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
 * Uses stdin pipe for prompt delivery (more reliable for long prompts).
 */
async function runClaudeCode(
  prompt: string,
  cwd: string
): Promise<{ output: string; exitCode: number; contextUsed: number }> {
  return new Promise((resolve) => {
    const args = [
      '-p',
      '--dangerously-skip-permissions',
      '--output-format', 'json',
    ];

    const child = spawn('claude', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    // Write prompt to stdin and close it (like CREATE SOMETHING does)
    if (child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    } else {
      resolve({
        output: '',
        exitCode: -1,
        contextUsed: 0,
      });
      return;
    }

    console.log(`   [Session] Prompt sent (${prompt.length} chars), waiting for response...`);

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Set a timeout (30 minutes max per session)
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        output: output + '\n[TIMEOUT]',
        exitCode: 124,
        contextUsed: 0,
      });
    }, 30 * 60 * 1000);

    child.on('close', (code) => {
      clearTimeout(timeoutId);
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
      clearTimeout(timeoutId);
      resolve({
        output: `Error: ${error.message}`,
        exitCode: -1,
        contextUsed: 0,
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Outcome Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect session outcome from output.
 * Aligned with CREATE SOMETHING's simpler, more reliable approach.
 */
function detectOutcome(output: string, exitCode: number): SessionOutcome {
  const lower = output.toLowerCase();

  // Context overflow indicators (check first)
  if (
    lower.includes('context limit') ||
    lower.includes('context overflow') ||
    lower.includes('token limit') ||
    lower.includes('ran out of context')
  ) {
    return 'context_overflow';
  }

  // Non-zero exit code is a clear failure
  if (exitCode !== 0) {
    return 'failure';
  }

  // Partial progress indicators (blocked, needs help)
  if (
    lower.includes('blocked') ||
    lower.includes('unable to complete') ||
    lower.includes('need clarification') ||
    lower.includes('need human input')
  ) {
    return 'partial';
  }

  // If exit code is 0, assume success (trust Claude's judgment)
  return 'success';
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
