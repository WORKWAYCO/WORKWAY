/**
 * @workwayco/harness - Molecular Workflow System
 *
 * Step-level state tracking for crash-resilient workflow execution.
 * Inspired by GAS TOWN's molecular formulas.
 *
 * Key features:
 * - Step-level state tracking (finer granularity than session-level)
 * - Crash-resilient step execution
 * - Auto-resume from last successful step
 * - Integration with Beads molecules
 */

import {
  Molecule,
  MoleculeStep,
  MoleculeStepState,
  MoleculeState,
  MoleculeStepCheckpoint,
  MoleculeAdvanceResult,
  MoleculeExecutionConfig,
  DEFAULT_MOLECULE_CONFIG,
} from './types.js';
import { getIssue, createIssue, updateIssueStatus } from './beads.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * Execute a bd command.
 */
async function bd(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`bd ${args.join(' ')}`, {
      cwd,
      env: { ...process.env },
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    throw new Error(`bd command failed: ${err.stderr || err.message}`);
  }
}

/**
 * MoleculeManager handles step-level workflow execution with crash recovery.
 */
export class MoleculeManager {
  private cwd: string;
  private config: MoleculeExecutionConfig;

  constructor(cwd: string, config: Partial<MoleculeExecutionConfig> = {}) {
    this.cwd = cwd;
    this.config = { ...DEFAULT_MOLECULE_CONFIG, ...config };
  }

  /**
   * Create a new molecule from a list of steps.
   */
  async createMolecule(
    parentIssueId: string,
    title: string,
    steps: Array<{
      id: string;
      title: string;
      description?: string;
      dependsOn?: string[];
      maxRetries?: number;
    }>,
    metadata: {
      templateId?: string;
      variables?: Record<string, string>;
      createdBy: string;
      labels?: string[];
    }
  ): Promise<Molecule> {
    const now = new Date().toISOString();

    const moleculeSteps: MoleculeStep[] = steps.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      state: 'pending' as MoleculeStepState,
      dependsOn: step.dependsOn || [],
      retryCount: 0,
      maxRetries: step.maxRetries ?? this.config.defaultMaxRetries,
    }));

    const molecule: Molecule = {
      id: `mol-${Date.now()}`,
      title,
      parentIssueId,
      steps: moleculeSteps,
      state: 'pending',
      createdAt: now,
      updatedAt: now,
      metadata: {
        templateId: metadata.templateId,
        variables: metadata.variables,
        createdBy: metadata.createdBy,
        labels: metadata.labels || [],
      },
    };

    // Optionally create Beads issues for each step
    if (this.config.createStepIssues) {
      for (const step of molecule.steps) {
        const issueId = await this.createStepIssue(molecule, step);
        step.issueId = issueId;
      }
    }

    // Store molecule state in parent issue description
    await this.saveMoleculeState(molecule);

    return molecule;
  }

  /**
   * Load a molecule from its parent issue.
   */
  async loadMolecule(parentIssueId: string): Promise<Molecule | null> {
    try {
      const issue = await getIssue(parentIssueId, this.cwd);

      if (!issue || !issue.description) {
        return null;
      }

      // Extract molecule state from HTML comment in description
      const match = issue.description.match(/<!-- MOLECULE_STATE\n([\s\S]*?)\n-->/);
      if (!match) {
        return null;
      }

      const molecule = JSON.parse(match[1]) as Molecule;
      return molecule;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save molecule state to parent issue description.
   */
  private async saveMoleculeState(molecule: Molecule): Promise<void> {
    molecule.updatedAt = new Date().toISOString();

    // Load current issue description
    const issue = await getIssue(molecule.parentIssueId, this.cwd);
    if (!issue) {
      throw new Error(`Parent issue ${molecule.parentIssueId} not found`);
    }

    let description = issue.description || '';

    // Remove old molecule state
    description = description.replace(/<!-- MOLECULE_STATE\n[\s\S]*?\n-->\n*/g, '');

    // Add new molecule state
    const moleculeState = `<!-- MOLECULE_STATE\n${JSON.stringify(molecule, null, 2)}\n-->`;
    description = `${description}\n\n${moleculeState}`.trim();

    // Update issue description
    await bd(['update', molecule.parentIssueId, '--description', description], this.cwd);
  }

  /**
   * Get the next executable step (pending with satisfied dependencies).
   */
  getNextStep(molecule: Molecule): MoleculeStep | null {
    for (const step of molecule.steps) {
      // Skip non-pending steps
      if (step.state !== 'pending') {
        continue;
      }

      // Check if dependencies are satisfied
      const dependenciesSatisfied = step.dependsOn.every((depId) => {
        const depStep = molecule.steps.find((s) => s.id === depId);
        return depStep && depStep.state === 'complete';
      });

      if (dependenciesSatisfied) {
        return step;
      }
    }

    return null;
  }

  /**
   * Start execution of a step.
   */
  async startStep(molecule: Molecule, stepId: string): Promise<Molecule> {
    const step = molecule.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in molecule ${molecule.id}`);
    }

    if (step.state !== 'pending') {
      throw new Error(`Step ${stepId} is not in pending state (current: ${step.state})`);
    }

    step.state = 'in_progress';
    step.startedAt = new Date().toISOString();

    // Update Beads issue status
    if (step.issueId) {
      await updateIssueStatus(step.issueId, 'in_progress', this.cwd);
    }

    // Update molecule state
    molecule.state = 'in_progress';
    await this.saveMoleculeState(molecule);

    return molecule;
  }

  /**
   * Complete a step with checkpoint data.
   */
  async completeStep(
    molecule: Molecule,
    stepId: string,
    checkpoint: MoleculeStepCheckpoint
  ): Promise<Molecule> {
    const step = molecule.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in molecule ${molecule.id}`);
    }

    if (step.state !== 'in_progress') {
      throw new Error(`Step ${stepId} is not in progress (current: ${step.state})`);
    }

    step.state = 'complete';
    step.completedAt = new Date().toISOString();
    step.checkpoint = checkpoint;

    // Update Beads issue status
    if (step.issueId) {
      await bd(['close', step.issueId], this.cwd);
    }

    // Check if all steps are complete
    const allComplete = molecule.steps.every((s) => s.state === 'complete' || s.state === 'skipped');
    if (allComplete) {
      molecule.state = 'complete';
    }

    await this.saveMoleculeState(molecule);

    return molecule;
  }

  /**
   * Fail a step with a reason.
   */
  async failStep(molecule: Molecule, stepId: string, reason: string): Promise<Molecule> {
    const step = molecule.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in molecule ${molecule.id}`);
    }

    step.retryCount++;

    if (step.retryCount >= step.maxRetries) {
      // Max retries exceeded - mark as failed
      step.state = 'failed';
      step.failureReason = reason;
      molecule.state = 'failed';

      // Update Beads issue
      if (step.issueId) {
        await bd(['label', 'add', step.issueId, 'failed'], this.cwd);
      }
    } else {
      // Reset to pending for retry
      step.state = 'pending';
      step.startedAt = undefined;
    }

    await this.saveMoleculeState(molecule);

    return molecule;
  }

  /**
   * Skip a step (dependencies failed or step not needed).
   */
  async skipStep(molecule: Molecule, stepId: string, reason: string): Promise<Molecule> {
    const step = molecule.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in molecule ${molecule.id}`);
    }

    step.state = 'skipped';
    step.failureReason = reason;

    // Update Beads issue
    if (step.issueId) {
      await bd(['label', 'add', step.issueId, 'skipped'], this.cwd);
    }

    await this.saveMoleculeState(molecule);

    return molecule;
  }

  /**
   * Advance molecule to next step (auto-resume pattern).
   */
  async advanceMolecule(molecule: Molecule): Promise<MoleculeAdvanceResult> {
    const nextStep = this.getNextStep(molecule);

    if (!nextStep) {
      // Check if molecule is complete
      const allComplete = molecule.steps.every(
        (s) => s.state === 'complete' || s.state === 'skipped'
      );

      if (allComplete) {
        return {
          success: false,
          reason: 'Molecule complete',
        };
      }

      // Check if molecule is blocked
      const hasPending = molecule.steps.some((s) => s.state === 'pending');
      const hasInProgress = molecule.steps.some((s) => s.state === 'in_progress');

      if (hasPending && !hasInProgress) {
        return {
          success: false,
          reason: 'Molecule blocked (dependencies not satisfied)',
        };
      }

      return {
        success: false,
        reason: 'No executable steps available',
      };
    }

    return {
      success: true,
      nextStep,
    };
  }

  /**
   * Resume molecule from crash (find last in-progress or next pending step).
   */
  async resumeMolecule(molecule: Molecule): Promise<MoleculeAdvanceResult> {
    // Check for in-progress steps (crashed during execution)
    const inProgressSteps = molecule.steps.filter((s) => s.state === 'in_progress');

    if (inProgressSteps.length > 0) {
      // Resume from first in-progress step
      const step = inProgressSteps[0];
      return {
        success: true,
        nextStep: step,
        reason: 'Resuming from crashed step',
      };
    }

    // Otherwise, advance to next pending step
    return this.advanceMolecule(molecule);
  }

  /**
   * Get molecule progress summary.
   */
  getMoleculeProgress(molecule: Molecule): {
    total: number;
    complete: number;
    inProgress: number;
    failed: number;
    pending: number;
    skipped: number;
    percentComplete: number;
  } {
    const total = molecule.steps.length;
    const complete = molecule.steps.filter((s) => s.state === 'complete').length;
    const inProgress = molecule.steps.filter((s) => s.state === 'in_progress').length;
    const failed = molecule.steps.filter((s) => s.state === 'failed').length;
    const pending = molecule.steps.filter((s) => s.state === 'pending').length;
    const skipped = molecule.steps.filter((s) => s.state === 'skipped').length;

    const percentComplete = total > 0 ? Math.round((complete / total) * 100) : 0;

    return {
      total,
      complete,
      inProgress,
      failed,
      pending,
      skipped,
      percentComplete,
    };
  }

  /**
   * Create a Beads issue for a molecule step.
   */
  private async createStepIssue(molecule: Molecule, step: MoleculeStep): Promise<string> {
    const title = `${molecule.title} - ${step.title}`;
    const description = step.description || '';

    const labels = ['molecule-step', `mol:${molecule.id}`, ...molecule.metadata.labels];

    const args = [
      'create',
      '--title',
      title,
      '--description',
      description,
      '--type',
      'task',
      '--label',
      labels.join(','),
    ];

    // Add dependency on parent issue
    args.push('--parent', molecule.parentIssueId);

    const output = await bd(args, this.cwd);

    // Extract issue ID from output
    const match = output.match(/Created issue: ([\w-]+)/);
    if (!match) {
      throw new Error(`Failed to extract issue ID from: ${output}`);
    }

    return match[1];
  }
}

/**
 * Create a new molecule manager instance.
 */
export function createMoleculeManager(
  cwd: string,
  config?: Partial<MoleculeExecutionConfig>
): MoleculeManager {
  return new MoleculeManager(cwd, config);
}
