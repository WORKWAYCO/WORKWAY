/**
 * Test Execution via Cloudflare Sandbox
 *
 * Runs real tests in isolated Cloudflare Sandbox environment.
 *
 * Reference: https://developers.cloudflare.com/sandbox/
 */

import { getRepoConfig, inferPackageConfig } from './sandbox-config';

export interface TestResult {
  /**
   * Number of tests that passed
   */
  passed: number;

  /**
   * Number of tests that failed
   */
  failed: number;

  /**
   * Number of tests that were skipped
   */
  skipped: number;

  /**
   * Total test execution duration in milliseconds
   */
  duration_ms: number;

  /**
   * Raw test output (stdout + stderr)
   */
  output?: string;

  /**
   * List of failing test names (if available)
   */
  failing_tests?: string[];

  /**
   * Whether tests timed out
   */
  timed_out?: boolean;
}

/**
 * Cloudflare Sandbox binding interface
 *
 * This matches the Cloudflare Sandbox API structure.
 */
export interface CloudflareSandbox {
  /**
   * Execute a command in the sandbox
   */
  execute(options: {
    /**
     * Command to run (e.g., "npm install")
     */
    command: string;

    /**
     * Environment variables
     */
    env?: Record<string, string>;

    /**
     * Working directory
     */
    cwd?: string;

    /**
     * Timeout in milliseconds
     */
    timeout?: number;
  }): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;

  /**
   * Clone a git repository
   */
  clone(options: {
    /**
     * Git repository URL
     */
    url: string;

    /**
     * Branch to checkout
     */
    branch?: string;

    /**
     * Target directory
     */
    directory?: string;
  }): Promise<void>;
}

/**
 * Run tests in Cloudflare Sandbox
 *
 * @param sandbox - Cloudflare Sandbox binding
 * @param repoUrl - GitHub repository URL (e.g., "https://github.com/WORKWAYCO/workway-platform")
 * @param branch - Branch to test
 * @param repo - Repository name (for config lookup)
 * @param affectedFiles - List of files modified (for package inference)
 * @returns Test results
 */
export async function runTestsInSandbox(
  sandbox: CloudflareSandbox,
  repoUrl: string,
  branch: string,
  repo: string,
  affectedFiles: string[] = []
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Get repository configuration
    const config = affectedFiles.length > 0
      ? inferPackageConfig(repo, affectedFiles)
      : getRepoConfig(repo);

    console.log(`Running tests for ${repo} on branch ${branch} with config:`, {
      packageManager: config.packageManager,
      testCommand: config.testCommand,
      workingDirectory: config.workingDirectory,
    });

    // Step 1: Clone repository
    await sandbox.clone({
      url: repoUrl,
      branch,
      directory: '/workspace',
    });

    const cwd = config.workingDirectory
      ? `/workspace/${config.workingDirectory}`
      : '/workspace';

    // Step 2: Install dependencies
    console.log(`Installing dependencies: ${config.installCommand}`);
    const installResult = await sandbox.execute({
      command: config.installCommand,
      cwd,
      timeout: 180000, // 3 minutes for install
    });

    if (installResult.exitCode !== 0) {
      console.error('Dependency installation failed:', installResult.stderr);
      return {
        passed: 0,
        failed: 1,
        skipped: 0,
        duration_ms: Date.now() - startTime,
        output: `Dependency installation failed:\n${installResult.stderr}`,
      };
    }

    // Step 3: Build if needed
    if (config.buildCommand) {
      console.log(`Building: ${config.buildCommand}`);
      const buildResult = await sandbox.execute({
        command: config.buildCommand,
        cwd,
        timeout: 300000, // 5 minutes for build
      });

      if (buildResult.exitCode !== 0) {
        console.error('Build failed:', buildResult.stderr);
        return {
          passed: 0,
          failed: 1,
          skipped: 0,
          duration_ms: Date.now() - startTime,
          output: `Build failed:\n${buildResult.stderr}`,
        };
      }
    }

    // Step 4: Run tests
    console.log(`Running tests: ${config.testCommand}`);
    const testResult = await sandbox.execute({
      command: config.testCommand,
      cwd,
      env: config.envVars,
      timeout: config.timeoutMs,
    });

    const duration_ms = Date.now() - startTime;

    // Step 5: Parse test output
    const parsed = parseTestOutput(
      testResult.stdout,
      testResult.stderr,
      testResult.exitCode
    );

    return {
      ...parsed,
      duration_ms,
      output: `${testResult.stdout}\n${testResult.stderr}`,
    };
  } catch (err) {
    console.error('Test execution error:', err);

    // Check if timeout
    const isTimeout = err instanceof Error && err.message.includes('timeout');

    return {
      passed: 0,
      failed: 1,
      skipped: 0,
      duration_ms: Date.now() - startTime,
      output: `Test execution error: ${err}`,
      timed_out: isTimeout,
    };
  }
}

/**
 * Parse test output to extract results
 *
 * Supports common test runners: Vitest, Jest, Mocha, Playwright
 *
 * @param stdout - Standard output
 * @param stderr - Standard error
 * @param exitCode - Process exit code
 * @returns Parsed test results
 */
function parseTestOutput(
  stdout: string,
  stderr: string,
  exitCode: number
): Omit<TestResult, 'duration_ms' | 'output'> {
  const output = `${stdout}\n${stderr}`;

  // Try Vitest format first (e.g., "Test Files  2 passed (2)")
  const vitestMatch = output.match(/Test Files\s+(\d+)\s+passed.*?Tests\s+(\d+)\s+passed/i);
  if (vitestMatch) {
    const passed = parseInt(vitestMatch[2], 10);
    return {
      passed,
      failed: exitCode !== 0 ? 1 : 0,
      skipped: 0,
      failing_tests: exitCode !== 0 ? extractFailingTests(output) : [],
    };
  }

  // Try Jest format (e.g., "Tests: 5 failed, 10 passed, 15 total")
  const jestMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,\s*)?(\d+)\s+passed/i);
  if (jestMatch) {
    const failed = jestMatch[1] ? parseInt(jestMatch[1], 10) : 0;
    const passed = parseInt(jestMatch[2], 10);
    return {
      passed,
      failed,
      skipped: 0,
      failing_tests: failed > 0 ? extractFailingTests(output) : [],
    };
  }

  // Try Mocha format (e.g., "5 passing", "2 failing")
  const mochaPassMatch = output.match(/(\d+)\s+passing/i);
  const mochaFailMatch = output.match(/(\d+)\s+failing/i);
  if (mochaPassMatch || mochaFailMatch) {
    const passed = mochaPassMatch ? parseInt(mochaPassMatch[1], 10) : 0;
    const failed = mochaFailMatch ? parseInt(mochaFailMatch[1], 10) : 0;
    return {
      passed,
      failed,
      skipped: 0,
      failing_tests: failed > 0 ? extractFailingTests(output) : [],
    };
  }

  // Fallback: Use exit code
  if (exitCode === 0) {
    return {
      passed: 1,
      failed: 0,
      skipped: 0,
    };
  }

  return {
    passed: 0,
    failed: 1,
    skipped: 0,
    failing_tests: extractFailingTests(output),
  };
}

/**
 * Extract failing test names from output
 *
 * @param output - Test output
 * @returns List of failing test names
 */
function extractFailingTests(output: string): string[] {
  const failingTests: string[] = [];

  // Vitest/Jest: "FAIL src/foo.test.ts > should do something"
  const vitestMatches = output.matchAll(/FAIL\s+(.+?)\s+>\s+(.+)/gi);
  for (const match of vitestMatches) {
    failingTests.push(`${match[1]}: ${match[2]}`);
  }

  // Mocha: "1) should do something"
  const mochaMatches = output.matchAll(/\d+\)\s+(.+)/g);
  for (const match of mochaMatches) {
    failingTests.push(match[1].trim());
  }

  // Generic: Lines containing "Error:" or "AssertionError:"
  if (failingTests.length === 0) {
    const errorMatches = output.matchAll(/(?:Error|AssertionError):\s+(.+)/gi);
    for (const match of errorMatches) {
      failingTests.push(match[1].trim());
    }
  }

  return failingTests.slice(0, 10); // Limit to 10 failures
}

/**
 * Format test results as human-readable summary
 *
 * @param result - Test results
 * @returns Formatted summary
 */
export function formatTestSummary(result: TestResult): string {
  const lines: string[] = [
    `Test Results (${result.duration_ms}ms):`,
    `  ✅ Passed: ${result.passed}`,
    `  ❌ Failed: ${result.failed}`,
    `  ⏭️  Skipped: ${result.skipped}`,
  ];

  if (result.timed_out) {
    lines.push('  ⏱️  TIMED OUT');
  }

  if (result.failing_tests && result.failing_tests.length > 0) {
    lines.push('');
    lines.push('Failing Tests:');
    result.failing_tests.forEach((test) => {
      lines.push(`  - ${test}`);
    });
  }

  return lines.join('\n');
}
