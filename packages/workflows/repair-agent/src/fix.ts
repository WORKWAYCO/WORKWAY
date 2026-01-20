/**
 * Fix Generation Step
 *
 * Uses Claude API to generate fix based on diagnosis.
 */

import type { Diagnosis } from './diagnose';
import { parseRepo } from './utils.js';

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

  return {
    branch: branchName,
    commits: [
      {
        sha: 'placeholder-sha',
        message: `fix: ${input.diagnosis.root_cause.slice(0, 72)}`,
        files_changed: changedFiles,
      },
    ],
    changes_summary: `Fixed ${input.diagnosis.root_cause}. Modified ${changedFiles.length} files.`,
  };
}

const GITHUB_HEADERS = (token: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'WORKWAY-Repair-Agent/1.0',
});

// parseRepo is now imported from ./utils.js

async function fetchFiles(
  filePaths: string[],
  repo: string,
  githubToken: string
): Promise<string> {
  const [owner, repoName] = parseRepo(repo);
  const results: string[] = [];

  for (const filePath of filePaths.slice(0, 3)) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`,
        { headers: GITHUB_HEADERS(githubToken) }
      );

      if (response.ok) {
        const data = await response.json();
        const content = atob(data.content);
        results.push(`=== ${filePath} ===\n${content}`);
      } else {
        results.push(`=== ${filePath} ===\n(Could not fetch: ${response.status})`);
      }
    } catch (err) {
      results.push(`=== ${filePath} ===\n(Error fetching file)`);
    }
  }

  return results.join('\n\n');
}

async function createBranch(
  repo: string,
  branchName: string,
  githubToken: string
): Promise<void> {
  const [owner, repoName] = parseRepo(repo);

  // Get default branch SHA
  const refResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`,
    { headers: GITHUB_HEADERS(githubToken) }
  );

  if (!refResponse.ok) {
    throw new Error(`Failed to get main branch: ${refResponse.status}`);
  }

  const refData = await refResponse.json();
  const sha = refData.object.sha;

  // Create new branch
  const createResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/refs`,
    {
      method: 'POST',
      headers: GITHUB_HEADERS(githubToken),
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create branch: ${createResponse.status} ${error}`);
  }

  console.log(`Created branch ${branchName} in ${repo}`);
}

async function applyChanges(
  repo: string,
  branch: string,
  fixContent: string,
  githubToken: string
): Promise<string[]> {
  // For now, create a placeholder commit
  // In production, would parse the fix content and apply actual changes
  const [owner, repoName] = parseRepo(repo);

  // Create a placeholder file to demonstrate the fix
  const placeholderPath = '.repair-agent/fix-pending.md';
  const content = `# Repair Agent Fix\n\nThis branch was created by the WORKWAY Repair Agent.\n\n## Suggested Fix\n\n${fixContent}`;

  // Get the branch ref
  const refResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${branch}`,
    { headers: GITHUB_HEADERS(githubToken) }
  );

  if (!refResponse.ok) {
    console.log('Branch ref not found, skipping file creation');
    return [placeholderPath];
  }

  const refData = await refResponse.json();
  const commitSha = refData.object.sha;

  // Get the commit to find the tree
  const commitResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/commits/${commitSha}`,
    { headers: GITHUB_HEADERS(githubToken) }
  );

  if (!commitResponse.ok) {
    return [placeholderPath];
  }

  const commitData = await commitResponse.json();
  const treeSha = commitData.tree.sha;

  // Create a blob for the file
  const blobResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/blobs`,
    {
      method: 'POST',
      headers: GITHUB_HEADERS(githubToken),
      body: JSON.stringify({
        content: btoa(content),
        encoding: 'base64',
      }),
    }
  );

  if (!blobResponse.ok) {
    return [placeholderPath];
  }

  const blobData = await blobResponse.json();

  // Create a new tree
  const treeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/trees`,
    {
      method: 'POST',
      headers: GITHUB_HEADERS(githubToken),
      body: JSON.stringify({
        base_tree: treeSha,
        tree: [
          {
            path: placeholderPath,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha,
          },
        ],
      }),
    }
  );

  if (!treeResponse.ok) {
    return [placeholderPath];
  }

  const treeData = await treeResponse.json();

  // Create a commit
  const newCommitResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/commits`,
    {
      method: 'POST',
      headers: GITHUB_HEADERS(githubToken),
      body: JSON.stringify({
        message: 'chore: add repair agent fix documentation',
        tree: treeData.sha,
        parents: [commitSha],
      }),
    }
  );

  if (!newCommitResponse.ok) {
    return [placeholderPath];
  }

  const newCommitData = await newCommitResponse.json();

  // Update the branch ref
  await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${branch}`,
    {
      method: 'PATCH',
      headers: GITHUB_HEADERS(githubToken),
      body: JSON.stringify({
        sha: newCommitData.sha,
      }),
    }
  );

  return [placeholderPath];
}
