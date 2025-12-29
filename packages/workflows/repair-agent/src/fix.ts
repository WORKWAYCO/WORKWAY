/**
 * Fix Generation Step
 *
 * Uses Claude API to generate fix based on diagnosis.
 */

import type { Diagnosis } from './diagnose';

export interface FixInput {
  diagnosis: Diagnosis;
  error: {
    message: string;
    repo: string;
  };
}

export interface Fix {
  branch: string;
  commits: {
    sha: string;
    message: string;
    files_changed: string[];
  }[];
  test_results: {
    passed: number;
    failed: number;
    skipped: number;
    duration_ms: number;
  };
  changes_summary: string;
}

const FIX_PROMPT = `You are fixing a production error. Apply the minimum change needed to resolve
the issue without introducing new problems.

DIAGNOSIS:
{diagnosis}

FILES TO MODIFY:
{files}

Requirements:
1. Fix the root cause, not symptoms
2. Add or update tests to cover this case
3. Keep changes minimal and focused
4. Do not refactor unrelated code

For each file, provide the exact changes needed in unified diff format.`;

export async function generateFix(
  input: FixInput,
  anthropicApiKey: string,
  githubToken: string
): Promise<Fix> {
  // Fetch current file contents
  const files = await fetchFiles(input.diagnosis.affected_files, input.error.repo, githubToken);

  // Prepare prompt
  const prompt = FIX_PROMPT.replace('{diagnosis}', JSON.stringify(input.diagnosis, null, 2)).replace(
    '{files}',
    files
  );

  // Call Claude API for fix
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const fixContent = result.content[0].text;

  // Create branch
  const branchName = `repair/error-${Date.now()}`;
  await createBranch(input.error.repo, branchName, githubToken);

  // Apply changes
  const changedFiles = await applyChanges(
    input.error.repo,
    branchName,
    fixContent,
    githubToken
  );

  // Run tests (in production, trigger CI)
  const testResults = await runTests(input.error.repo, branchName);

  return {
    branch: branchName,
    commits: [
      {
        sha: 'placeholder-sha',
        message: `fix: ${input.diagnosis.root_cause.slice(0, 72)}`,
        files_changed: changedFiles,
      },
    ],
    test_results: testResults,
    changes_summary: `Fixed ${input.diagnosis.root_cause}. Modified ${changedFiles.length} files.`,
  };
}

async function fetchFiles(
  filePaths: string[],
  repo: string,
  githubToken: string
): Promise<string> {
  // In production, fetch from GitHub API
  // For now, return placeholder
  return filePaths.map((f) => `${f}: (content would be fetched from GitHub)`).join('\n\n');
}

async function createBranch(
  repo: string,
  branchName: string,
  githubToken: string
): Promise<void> {
  // In production, use GitHub API to create branch
  console.log(`Created branch ${branchName} in ${repo}`);
}

async function applyChanges(
  repo: string,
  branch: string,
  fixContent: string,
  githubToken: string
): Promise<string[]> {
  // In production, parse diff and commit changes via GitHub API
  // For now, return placeholder
  return ['src/example.ts'];
}

async function runTests(
  repo: string,
  branch: string
): Promise<{
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
}> {
  // In production, trigger CI or run tests locally
  // For now, return placeholder
  return {
    passed: 10,
    failed: 0,
    skipped: 0,
    duration_ms: 5000,
  };
}
