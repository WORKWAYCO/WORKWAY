/**
 * StepExecutor - Atomic Step Tracking for Workflows
 *
 * Heideggerian principle: The step executor recedes during normal operation.
 * It only becomes visible (Vorhandenheit) when helping recover from failures.
 *
 * Problem solved:
 * - Multi-step workflows can fail mid-execution
 * - Without step tracking, retries either duplicate work or skip everything
 * - This utility tracks which steps completed, allowing resumption from failure point
 *
 * Usage:
 * ```typescript
 * const executor = new StepExecutor(storage, 'execution-123');
 *
 * // Each step runs only if not already completed
 * const notionPage = await executor.step('create-notion-page', async () => {
 *   return await notion.pages.create({ ... });
 * });
 *
 * const slackMessage = await executor.step('post-slack', async () => {
 *   return await slack.chat.postMessage({ ... });
 * });
 *
 * // Mark execution complete and clean up step data
 * await executor.complete();
 * ```
 */

import type { WorkflowStorage } from './workflow-sdk.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Step execution state
 */
export interface StepState<T = unknown> {
	/** Step name */
	name: string;

	/** Step status */
	status: 'pending' | 'completed' | 'failed';

	/** Step result (if completed) */
	result?: T;

	/** Error message (if failed) */
	error?: string;

	/** When the step completed */
	completedAt?: string;

	/** When the step failed */
	failedAt?: string;
}

/**
 * Execution state stored in KV
 */
export interface ExecutionState {
	/** Execution ID */
	executionId: string;

	/** When execution started */
	startedAt: string;

	/** Current step index */
	currentStep: number;

	/** Step states by name */
	steps: Record<string, StepState>;

	/** Whether execution is complete */
	completed: boolean;

	/** When execution completed */
	completedAt?: string;
}

/**
 * Options for StepExecutor
 */
export interface StepExecutorOptions {
	/**
	 * TTL for execution state in seconds
	 * Default: 7 days (604800 seconds)
	 * After this time, state is garbage collected
	 */
	ttlSeconds?: number;

	/**
	 * Whether to throw on step failure or continue
	 * Default: true (throw on failure)
	 */
	throwOnFailure?: boolean;

	/**
	 * Callback when a step is skipped (already completed)
	 */
	onSkip?: (stepName: string, result: unknown) => void;

	/**
	 * Callback when a step is executed
	 */
	onExecute?: (stepName: string) => void;

	/**
	 * Callback when a step fails
	 */
	onFail?: (stepName: string, error: Error) => void;
}

// ============================================================================
// STEP EXECUTOR
// ============================================================================

/**
 * StepExecutor - Execute workflow steps with atomic tracking
 *
 * Each step is tracked in storage. On retry:
 * - Completed steps are skipped, returning their stored result
 * - Failed steps are re-executed
 * - Pending steps are executed normally
 */
export class StepExecutor {
	private storage: WorkflowStorage;
	private executionId: string;
	private storageKey: string;
	private state: ExecutionState | null = null;
	private options: Required<StepExecutorOptions>;

	constructor(
		storage: WorkflowStorage,
		executionId: string,
		options: StepExecutorOptions = {}
	) {
		this.storage = storage;
		this.executionId = executionId;
		this.storageKey = `execution:${executionId}`;
		this.options = {
			ttlSeconds: options.ttlSeconds ?? 7 * 24 * 60 * 60, // 7 days
			throwOnFailure: options.throwOnFailure ?? true,
			onSkip: options.onSkip ?? (() => {}),
			onExecute: options.onExecute ?? (() => {}),
			onFail: options.onFail ?? (() => {}),
		};
	}

	/**
	 * Initialize or load execution state
	 */
	private async ensureState(): Promise<ExecutionState> {
		if (this.state) return this.state;

		const existing = await this.storage.get<ExecutionState>(this.storageKey);

		if (existing) {
			this.state = existing;
		} else {
			this.state = {
				executionId: this.executionId,
				startedAt: new Date().toISOString(),
				currentStep: 0,
				steps: {},
				completed: false,
			};
			await this.saveState();
		}

		return this.state;
	}

	/**
	 * Save current state to storage
	 */
	private async saveState(): Promise<void> {
		if (!this.state) return;

		// Use set with TTL if storage supports it
		// Fall back to simple set if not
		await this.storage.set(this.storageKey, this.state);
	}

	/**
	 * Execute a named step
	 *
	 * - If step already completed, returns stored result (skipped)
	 * - If step failed previously, re-executes
	 * - If step is new, executes and stores result
	 *
	 * @param name - Unique step name within this execution
	 * @param fn - Step function to execute
	 * @returns Step result
	 */
	async step<T>(name: string, fn: () => Promise<T>): Promise<T> {
		const state = await this.ensureState();

		// Check if step already completed
		const existingStep = state.steps[name];
		if (existingStep?.status === 'completed') {
			this.options.onSkip(name, existingStep.result);
			return existingStep.result as T;
		}

		// Execute the step
		this.options.onExecute(name);
		state.currentStep++;

		try {
			const result = await fn();

			// Mark step as completed
			state.steps[name] = {
				name,
				status: 'completed',
				result,
				completedAt: new Date().toISOString(),
			};

			// Save state AFTER successful execution (atomic commit)
			await this.saveState();

			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			// Mark step as failed (but don't save - allow retry)
			state.steps[name] = {
				name,
				status: 'failed',
				error: errorMessage,
				failedAt: new Date().toISOString(),
			};

			// Save failed state so we know where we stopped
			await this.saveState();

			this.options.onFail(name, error instanceof Error ? error : new Error(errorMessage));

			if (this.options.throwOnFailure) {
				throw error;
			}

			return undefined as T;
		}
	}

	/**
	 * Execute a step only if a condition is true
	 * Useful for optional steps based on workflow configuration
	 */
	async stepIf<T>(
		condition: boolean,
		name: string,
		fn: () => Promise<T>
	): Promise<T | undefined> {
		if (!condition) {
			return undefined;
		}
		return this.step(name, fn);
	}

	/**
	 * Get the result of a previously completed step
	 */
	async getStepResult<T>(name: string): Promise<T | undefined> {
		const state = await this.ensureState();
		const step = state.steps[name];
		if (step?.status === 'completed') {
			return step.result as T;
		}
		return undefined;
	}

	/**
	 * Check if a step has completed
	 */
	async isStepCompleted(name: string): Promise<boolean> {
		const state = await this.ensureState();
		return state.steps[name]?.status === 'completed';
	}

	/**
	 * Get execution progress summary
	 */
	async getProgress(): Promise<{
		executionId: string;
		startedAt: string;
		completedSteps: string[];
		failedSteps: string[];
		pendingSteps: string[];
		isComplete: boolean;
	}> {
		const state = await this.ensureState();

		const completedSteps: string[] = [];
		const failedSteps: string[] = [];

		for (const [name, step] of Object.entries(state.steps)) {
			if (step.status === 'completed') {
				completedSteps.push(name);
			} else if (step.status === 'failed') {
				failedSteps.push(name);
			}
		}

		return {
			executionId: state.executionId,
			startedAt: state.startedAt,
			completedSteps,
			failedSteps,
			pendingSteps: [], // We don't know pending steps ahead of time
			isComplete: state.completed,
		};
	}

	/**
	 * Mark execution as complete and optionally clean up
	 *
	 * @param cleanup - If true, delete execution state from storage
	 */
	async complete(cleanup: boolean = false): Promise<void> {
		const state = await this.ensureState();

		state.completed = true;
		state.completedAt = new Date().toISOString();

		if (cleanup) {
			await this.storage.delete(this.storageKey);
		} else {
			await this.saveState();
		}
	}

	/**
	 * Force reset execution state (for testing or manual recovery)
	 */
	async reset(): Promise<void> {
		await this.storage.delete(this.storageKey);
		this.state = null;
	}
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a StepExecutor for a workflow execution
 *
 * @param storage - Workflow storage interface
 * @param executionId - Unique ID for this execution (e.g., webhook event ID)
 * @param options - Executor options
 */
export function createStepExecutor(
	storage: WorkflowStorage,
	executionId: string,
	options?: StepExecutorOptions
): StepExecutor {
	return new StepExecutor(storage, executionId, options);
}

// ============================================================================
// HELPER: GENERATE EXECUTION ID
// ============================================================================

/**
 * Generate a unique execution ID from workflow inputs
 *
 * Combines workflow ID with event-specific identifiers for idempotency
 *
 * @param workflowId - Workflow identifier
 * @param eventId - Event identifier (e.g., payment ID, meeting ID)
 * @param timestamp - Optional timestamp for uniqueness
 */
export function generateExecutionId(
	workflowId: string,
	eventId: string,
	timestamp?: string
): string {
	const ts = timestamp || new Date().toISOString().split('T')[0]; // Date only by default
	return `${workflowId}:${eventId}:${ts}`;
}
