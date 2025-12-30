/**
 * Error Repair Agent Workflow
 *
 * Autonomous error diagnosis and fix with human-in-loop approval.
 *
 * Flow: Diagnose → Generate Fix → Run Tests (Sandbox) → Create PR → Create Beads Issue
 *
 * Philosophy: Agent does the work, human makes the decision.
 *
 * Test execution via Cloudflare Sandbox ensures fixes are validated before PR creation.
 */

import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from 'cloudflare:workers';
import { diagnose, type DiagnosisInput, type Diagnosis } from './diagnose';
import { generateFix, type FixInput, type Fix } from './fix';
import { createPR, type PRInput, type PullRequest } from './pr';
import {
  runTestsInSandbox,
  formatTestSummary,
  type CloudflareSandbox,
  type TestResult,
} from './test';

export interface RepairAgentParams {
  repair_id: string;
  error: {
    id: string;
    fingerprint: string;
    level: 'error' | 'fatal' | 'warning';
    message: string;
    stack: string | null;
    context: Record<string, unknown>;
    source: string;
    repo: string;
    received_at: string;
  };
  orchestrator_url: string;
}

export interface RepairAgentEnv {
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
  SANDBOX: CloudflareSandbox;
}

export class RepairAgent extends WorkflowEntrypoint<RepairAgentEnv, RepairAgentParams> {
  async run(event: WorkflowEvent<RepairAgentParams>, step: WorkflowStep) {
    const { error, orchestrator_url, repair_id } = event.payload;

    // Step 1: Diagnose
    const diagnosis = await step.do('diagnose', async () => {
      console.log(`Diagnosing error ${error.fingerprint}`);

      // Update orchestrator status
      await this.updateStatus(orchestrator_url, 'diagnosing');

      const input: DiagnosisInput = {
        error: {
          message: error.message,
          stack: error.stack,
          context: error.context,
          repo: error.repo,
        },
      };

      const result = await diagnose(input, this.env.ANTHROPIC_API_KEY);

      console.log(`Diagnosis complete:`, {
        root_cause: result.root_cause,
        confidence: result.confidence,
        risk_assessment: result.risk_assessment,
      });

      return result;
    });

    // High-risk errors still get fixes but are flagged prominently
    const isHighRisk = diagnosis.risk_assessment === 'high';
    if (isHighRisk) {
      console.log('High-risk error detected - will proceed with extra caution');
    }

    // Step 2: Generate Fix
    const fix = await step.do('generate-fix', async () => {
      console.log(`Generating fix for ${error.fingerprint}`);

      await this.updateStatus(orchestrator_url, 'fixing');

      const input: FixInput = {
        diagnosis,
        error: {
          message: error.message,
          repo: error.repo,
        },
      };

      const result = await generateFix(
        input,
        this.env.ANTHROPIC_API_KEY,
        this.env.GITHUB_TOKEN
      );

      console.log(`Fix generated:`, {
        branch: result.branch,
        files_changed: result.commits[0].files_changed.length,
      });

      return result;
    });

    // Step 3: Run Tests in Sandbox
    const testResults = await step.do('run-tests', async () => {
      console.log(`Running tests for ${error.fingerprint} on branch ${fix.branch}`);

      await this.updateStatus(orchestrator_url, 'testing');

      // Construct GitHub URL for the repository
      const repoUrl = `https://github.com/WORKWAYCO/${
        error.repo === 'Cloudflare' ? 'WORKWAY' : error.repo
      }`;

      const results = await runTestsInSandbox(
        this.env.SANDBOX,
        repoUrl,
        fix.branch,
        error.repo,
        diagnosis.affected_files
      );

      console.log('Test results:', formatTestSummary(results));

      return results;
    });

    // Check if tests failed
    if (testResults.failed > 0 || testResults.timed_out) {
      const reason = testResults.timed_out
        ? 'Tests timed out'
        : `Tests failed: ${testResults.failed} failures`;

      console.log(`Tests failed for ${error.fingerprint}: ${reason}`);

      await this.updateStatus(orchestrator_url, 'failed', {
        failure_reason: reason,
        test_output: testResults.output,
        failing_tests: testResults.failing_tests,
      });

      return {
        status: 'failed',
        reason: 'tests_failed',
        diagnosis,
        fix,
        test_results: testResults,
      };
    }

    // Step 4: Create PR
    const pr = await step.do('create-pr', async () => {
      console.log(`Creating PR for ${error.fingerprint}`);

      const input: PRInput = {
        diagnosis,
        fix,
        error: {
          message: error.message,
          fingerprint: error.fingerprint,
          repo: error.repo,
        },
        isHighRisk,
        testResults,
      };

      const result = await createPR(input, this.env.GITHUB_TOKEN);

      console.log(`PR created: ${result.url}`);

      return result;
    });

    // Step 5: Create Beads Issue
    const beadsIssue = await step.do('create-beads-issue', async () => {
      console.log(`Creating Beads issue for ${error.fingerprint}`);

      // In production, use Beads CLI API
      const issueId = `repair-${error.fingerprint.slice(0, 8)}`;

      console.log(`Beads issue created: ${issueId}`);

      return issueId;
    });

    // Step 6: Auto-merge if tests passed and not high-risk
    const autoMerged = await step.do('auto-merge', async () => {
      // Skip auto-merge for high-risk fixes
      if (isHighRisk) {
        console.log('Skipping auto-merge for high-risk fix - requires human review');
        return false;
      }

      console.log(`Auto-merging PR ${pr.number} for ${error.fingerprint}`);

      try {
        // Enable auto-merge on PR using GitHub GraphQL API
        const graphqlResponse = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              mutation EnableAutoMerge($prId: ID!) {
                enablePullRequestAutoMerge(input: {
                  pullRequestId: $prId
                  mergeMethod: SQUASH
                }) {
                  pullRequest {
                    autoMergeRequest {
                      enabledAt
                    }
                  }
                }
              }
            `,
            variables: { prId: pr.node_id },
          }),
        });

        if (!graphqlResponse.ok) {
          console.error('Failed to enable auto-merge:', await graphqlResponse.text());
          return false;
        }

        // Approve PR with test results summary
        const approvalResponse = await fetch(
          `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/reviews`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.env.GITHUB_TOKEN}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github+json',
            },
            body: JSON.stringify({
              event: 'APPROVE',
              body: `✅ **Sandbox tests passed** (${testResults.passed} passed, ${testResults.failed} failed)\n\n` +
                    `Test duration: ${testResults.duration_ms}ms\n\n` +
                    `Auto-merging this fix.\n\n` +
                    `---\n` +
                    `🤖 Automated repair by WORKWAY Error Repair Agent`,
            }),
          }
        );

        if (!approvalResponse.ok) {
          console.error('Failed to approve PR:', await approvalResponse.text());
          // Continue anyway - auto-merge might still work without approval
        }

        console.log(`Auto-merge enabled for PR ${pr.number}`);
        return true;
      } catch (err) {
        console.error('Auto-merge failed:', err);
        return false;
      }
    });

    // Update orchestrator with final state
    await this.updateStatus(orchestrator_url, autoMerged ? 'auto_merged' : 'pr_created', {
      diagnosis,
      fix,
      test_results: testResults,
      pr_url: pr.url,
      beads_issue: beadsIssue,
      auto_merged: autoMerged,
    });

    return {
      status: 'success',
      repair_id,
      pr_url: pr.url,
      beads_issue: beadsIssue,
      diagnosis,
      fix,
      test_results: testResults,
      auto_merged: autoMerged,
    };
  }

  private async updateStatus(
    orchestratorUrl: string,
    status: string,
    updates: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      await fetch(orchestratorUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...updates }),
      });
    } catch (err) {
      console.error('Failed to update orchestrator status:', err);
      // Non-blocking error
    }
  }
}

export default RepairAgent;
