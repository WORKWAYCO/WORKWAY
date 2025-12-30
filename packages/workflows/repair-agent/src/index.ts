/**
 * Error Repair Agent Workflow
 *
 * Autonomous error diagnosis and fix with human-in-loop approval.
 *
 * Flow: Diagnose → Generate Fix → Create PR → Create Beads Issue
 *
 * Philosophy: Agent does the work, human makes the decision.
 */

import {
  WorkflowEntrypoint,
  WorkflowStep,
  WorkflowEvent,
} from 'cloudflare:workers';
import { diagnose, type DiagnosisInput, type Diagnosis } from './diagnose';
import { generateFix, type FixInput, type Fix } from './fix';
import { createPR, type PRInput, type PullRequest } from './pr';

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
        test_results: result.test_results,
      });

      return result;
    });

    // Check if tests failed
    if (fix.test_results.failed > 0) {
      console.log('Tests failed after fix, aborting');
      await this.updateStatus(orchestrator_url, 'failed', {
        failure_reason: `Tests failed: ${fix.test_results.failed} failures`,
      });
      return {
        status: 'failed',
        reason: 'tests_failed',
        diagnosis,
        fix,
      };
    }

    // Step 3: Create PR
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
      };

      const result = await createPR(input, this.env.GITHUB_TOKEN);

      console.log(`PR created: ${result.url}`);

      return result;
    });

    // Step 4: Create Beads Issue
    const beadsIssue = await step.do('create-beads-issue', async () => {
      console.log(`Creating Beads issue for ${error.fingerprint}`);

      // In production, use Beads CLI API
      const issueId = `repair-${error.fingerprint.slice(0, 8)}`;

      console.log(`Beads issue created: ${issueId}`);

      return issueId;
    });

    // Update orchestrator with final state
    await this.updateStatus(orchestrator_url, 'pr_created', {
      diagnosis,
      fix,
      pr_url: pr.url,
      beads_issue: beadsIssue,
    });

    return {
      status: 'success',
      repair_id,
      pr_url: pr.url,
      beads_issue: beadsIssue,
      diagnosis,
      fix,
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
