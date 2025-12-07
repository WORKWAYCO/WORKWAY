/**
 * StepExecutor Tests
 *
 * Tests for atomic step tracking in multi-step workflows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	StepExecutor,
	createStepExecutor,
	generateExecutionId,
	type ExecutionState,
} from './step-executor.js';
import type { WorkflowStorage } from './workflow-sdk.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a mock storage for testing
 */
function createMockStorage(): WorkflowStorage & { data: Map<string, unknown> } {
	const data = new Map<string, unknown>();
	return {
		data,
		get: vi.fn(async <T>(key: string): Promise<T | null> => {
			return (data.get(key) as T) ?? null;
		}),
		set: vi.fn(async (key: string, value: unknown): Promise<void> => {
			data.set(key, value);
		}),
		put: vi.fn(async (key: string, value: unknown): Promise<void> => {
			data.set(key, value);
		}),
		delete: vi.fn(async (key: string): Promise<void> => {
			data.delete(key);
		}),
		keys: vi.fn(async (): Promise<string[]> => {
			return Array.from(data.keys());
		}),
	};
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('StepExecutor constructor', () => {
	it('should create executor with storage and execution ID', () => {
		const storage = createMockStorage();
		const executor = new StepExecutor(storage, 'test-execution-1');

		expect(executor).toBeInstanceOf(StepExecutor);
	});

	it('should create executor with options', () => {
		const storage = createMockStorage();
		const onSkip = vi.fn();
		const onExecute = vi.fn();
		const onFail = vi.fn();

		const executor = new StepExecutor(storage, 'test-execution-1', {
			ttlSeconds: 3600,
			throwOnFailure: false,
			onSkip,
			onExecute,
			onFail,
		});

		expect(executor).toBeInstanceOf(StepExecutor);
	});
});

// ============================================================================
// STEP EXECUTION TESTS
// ============================================================================

describe('StepExecutor.step', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let executor: StepExecutor;

	beforeEach(() => {
		storage = createMockStorage();
		executor = new StepExecutor(storage, 'test-execution');
	});

	it('should execute step and return result', async () => {
		const result = await executor.step('step-1', async () => {
			return { data: 'test-data' };
		});

		expect(result).toEqual({ data: 'test-data' });
	});

	it('should store step result in storage', async () => {
		await executor.step('step-1', async () => 'result-1');

		const state = storage.data.get('execution:test-execution') as ExecutionState;
		expect(state.steps['step-1']).toBeDefined();
		expect(state.steps['step-1'].status).toBe('completed');
		expect(state.steps['step-1'].result).toBe('result-1');
	});

	it('should skip already completed steps', async () => {
		// First execution
		const result1 = await executor.step('step-1', async () => 'first-result');
		expect(result1).toBe('first-result');

		// Second execution should skip and return stored result
		const stepFn = vi.fn(async () => 'second-result');
		const result2 = await executor.step('step-1', stepFn);

		expect(result2).toBe('first-result');
		expect(stepFn).not.toHaveBeenCalled();
	});

	it('should execute multiple steps in sequence', async () => {
		const result1 = await executor.step('step-1', async () => 'a');
		const result2 = await executor.step('step-2', async () => 'b');
		const result3 = await executor.step('step-3', async () => 'c');

		expect(result1).toBe('a');
		expect(result2).toBe('b');
		expect(result3).toBe('c');

		const state = storage.data.get('execution:test-execution') as ExecutionState;
		expect(Object.keys(state.steps)).toHaveLength(3);
	});

	it('should throw on step failure by default', async () => {
		await expect(
			executor.step('failing-step', async () => {
				throw new Error('Step failed');
			})
		).rejects.toThrow('Step failed');
	});

	it('should mark failed step in storage', async () => {
		try {
			await executor.step('failing-step', async () => {
				throw new Error('Step failed');
			});
		} catch {
			// Expected
		}

		const state = storage.data.get('execution:test-execution') as ExecutionState;
		expect(state.steps['failing-step'].status).toBe('failed');
		expect(state.steps['failing-step'].error).toBe('Step failed');
	});

	it('should retry failed steps on subsequent execution', async () => {
		// First attempt - fails
		try {
			await executor.step('flaky-step', async () => {
				throw new Error('First attempt failed');
			});
		} catch {
			// Expected
		}

		// Create new executor (simulating retry)
		const retryExecutor = new StepExecutor(storage, 'test-execution');

		// Second attempt - succeeds
		let attemptCount = 0;
		const result = await retryExecutor.step('flaky-step', async () => {
			attemptCount++;
			return 'success on retry';
		});

		// Step should have been re-executed (not skipped)
		expect(attemptCount).toBe(1);
		expect(result).toBe('success on retry');
	});

	it('should call onSkip callback when step is skipped', async () => {
		const onSkip = vi.fn();
		const executor = new StepExecutor(storage, 'test-exec', { onSkip });

		await executor.step('step-1', async () => 'result');
		await executor.step('step-1', async () => 'should-skip');

		expect(onSkip).toHaveBeenCalledWith('step-1', 'result');
	});

	it('should call onExecute callback when step executes', async () => {
		const onExecute = vi.fn();
		const executor = new StepExecutor(storage, 'test-exec', { onExecute });

		await executor.step('step-1', async () => 'result');

		expect(onExecute).toHaveBeenCalledWith('step-1');
	});

	it('should call onFail callback when step fails', async () => {
		const onFail = vi.fn();
		const executor = new StepExecutor(storage, 'test-exec', { onFail });

		try {
			await executor.step('failing-step', async () => {
				throw new Error('Oops');
			});
		} catch {
			// Expected
		}

		expect(onFail).toHaveBeenCalled();
		expect(onFail.mock.calls[0][0]).toBe('failing-step');
		expect(onFail.mock.calls[0][1]).toBeInstanceOf(Error);
	});

	it('should not throw when throwOnFailure is false', async () => {
		const executor = new StepExecutor(storage, 'test-exec', {
			throwOnFailure: false,
		});

		const result = await executor.step('failing-step', async () => {
			throw new Error('Oops');
		});

		expect(result).toBeUndefined();
	});
});

// ============================================================================
// STEP IF TESTS
// ============================================================================

describe('StepExecutor.stepIf', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let executor: StepExecutor;

	beforeEach(() => {
		storage = createMockStorage();
		executor = new StepExecutor(storage, 'test-execution');
	});

	it('should execute step when condition is true', async () => {
		const result = await executor.stepIf(true, 'conditional-step', async () => 'executed');

		expect(result).toBe('executed');
	});

	it('should skip step when condition is false', async () => {
		const stepFn = vi.fn(async () => 'should-not-run');
		const result = await executor.stepIf(false, 'conditional-step', stepFn);

		expect(result).toBeUndefined();
		expect(stepFn).not.toHaveBeenCalled();
	});

	it('should not store state for skipped conditional steps', async () => {
		// First run a real step to ensure state exists
		await executor.step('setup-step', async () => 'setup');

		// Now skip a conditional step
		await executor.stepIf(false, 'skipped-step', async () => 'value');

		const state = storage.data.get('execution:test-execution') as ExecutionState;
		expect(state.steps['skipped-step']).toBeUndefined();
		expect(state.steps['setup-step']).toBeDefined();
	});
});

// ============================================================================
// GET STEP RESULT TESTS
// ============================================================================

describe('StepExecutor.getStepResult', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let executor: StepExecutor;

	beforeEach(() => {
		storage = createMockStorage();
		executor = new StepExecutor(storage, 'test-execution');
	});

	it('should return result of completed step', async () => {
		await executor.step('step-1', async () => ({ id: '123', name: 'test' }));

		const result = await executor.getStepResult<{ id: string; name: string }>('step-1');

		expect(result).toEqual({ id: '123', name: 'test' });
	});

	it('should return undefined for non-existent step', async () => {
		const result = await executor.getStepResult('non-existent');

		expect(result).toBeUndefined();
	});

	it('should return undefined for failed step', async () => {
		try {
			await executor.step('failed-step', async () => {
				throw new Error('Fail');
			});
		} catch {
			// Expected
		}

		const result = await executor.getStepResult('failed-step');

		expect(result).toBeUndefined();
	});
});

// ============================================================================
// IS STEP COMPLETED TESTS
// ============================================================================

describe('StepExecutor.isStepCompleted', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let executor: StepExecutor;

	beforeEach(() => {
		storage = createMockStorage();
		executor = new StepExecutor(storage, 'test-execution');
	});

	it('should return true for completed step', async () => {
		await executor.step('step-1', async () => 'done');

		const isCompleted = await executor.isStepCompleted('step-1');

		expect(isCompleted).toBe(true);
	});

	it('should return false for non-existent step', async () => {
		const isCompleted = await executor.isStepCompleted('non-existent');

		expect(isCompleted).toBe(false);
	});

	it('should return false for failed step', async () => {
		try {
			await executor.step('failed-step', async () => {
				throw new Error('Fail');
			});
		} catch {
			// Expected
		}

		const isCompleted = await executor.isStepCompleted('failed-step');

		expect(isCompleted).toBe(false);
	});
});

// ============================================================================
// GET PROGRESS TESTS
// ============================================================================

describe('StepExecutor.getProgress', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let executor: StepExecutor;

	beforeEach(() => {
		storage = createMockStorage();
		executor = new StepExecutor(storage, 'test-execution');
	});

	it('should return execution progress', async () => {
		await executor.step('step-1', async () => 'a');
		await executor.step('step-2', async () => 'b');

		try {
			await executor.step('step-3', async () => {
				throw new Error('Fail');
			});
		} catch {
			// Expected
		}

		const progress = await executor.getProgress();

		expect(progress.executionId).toBe('test-execution');
		expect(progress.completedSteps).toContain('step-1');
		expect(progress.completedSteps).toContain('step-2');
		expect(progress.failedSteps).toContain('step-3');
		expect(progress.isComplete).toBe(false);
	});

	it('should include startedAt timestamp', async () => {
		const before = new Date().toISOString();
		await executor.step('step-1', async () => 'done');
		const after = new Date().toISOString();

		const progress = await executor.getProgress();

		expect(progress.startedAt >= before).toBe(true);
		expect(progress.startedAt <= after).toBe(true);
	});
});

// ============================================================================
// COMPLETE TESTS
// ============================================================================

describe('StepExecutor.complete', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let executor: StepExecutor;

	beforeEach(() => {
		storage = createMockStorage();
		executor = new StepExecutor(storage, 'test-execution');
	});

	it('should mark execution as complete', async () => {
		await executor.step('step-1', async () => 'done');
		await executor.complete();

		const state = storage.data.get('execution:test-execution') as ExecutionState;
		expect(state.completed).toBe(true);
		expect(state.completedAt).toBeDefined();
	});

	it('should delete state when cleanup is true', async () => {
		await executor.step('step-1', async () => 'done');
		await executor.complete(true);

		expect(storage.data.has('execution:test-execution')).toBe(false);
	});

	it('should keep state when cleanup is false', async () => {
		await executor.step('step-1', async () => 'done');
		await executor.complete(false);

		expect(storage.data.has('execution:test-execution')).toBe(true);
	});
});

// ============================================================================
// RESET TESTS
// ============================================================================

describe('StepExecutor.reset', () => {
	let storage: ReturnType<typeof createMockStorage>;
	let executor: StepExecutor;

	beforeEach(() => {
		storage = createMockStorage();
		executor = new StepExecutor(storage, 'test-execution');
	});

	it('should delete execution state', async () => {
		await executor.step('step-1', async () => 'done');
		await executor.reset();

		expect(storage.data.has('execution:test-execution')).toBe(false);
	});

	it('should allow fresh start after reset', async () => {
		await executor.step('step-1', async () => 'first');
		await executor.reset();

		// After reset, step should execute again
		const result = await executor.step('step-1', async () => 'second');

		expect(result).toBe('second');
	});
});

// ============================================================================
// PERSISTENCE TESTS
// ============================================================================

describe('StepExecutor persistence', () => {
	let storage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		storage = createMockStorage();
	});

	it('should resume from stored state', async () => {
		// First executor completes some steps
		const executor1 = new StepExecutor(storage, 'persistent-exec');
		await executor1.step('step-1', async () => 'result-1');
		await executor1.step('step-2', async () => 'result-2');

		// Simulate process restart - new executor with same ID
		const executor2 = new StepExecutor(storage, 'persistent-exec');

		// Steps should be skipped
		const skipFn = vi.fn(async () => 'should-not-run');
		const r1 = await executor2.step('step-1', skipFn);
		const r2 = await executor2.step('step-2', skipFn);

		expect(r1).toBe('result-1');
		expect(r2).toBe('result-2');
		expect(skipFn).not.toHaveBeenCalled();

		// New step should execute
		const r3 = await executor2.step('step-3', async () => 'result-3');
		expect(r3).toBe('result-3');
	});

	it('should handle partial failure and retry', async () => {
		// First attempt - step 2 fails
		const executor1 = new StepExecutor(storage, 'retry-exec');
		await executor1.step('step-1', async () => 'result-1');

		try {
			await executor1.step('step-2', async () => {
				throw new Error('Network error');
			});
		} catch {
			// Expected
		}

		// Retry - step 1 skipped, step 2 retried
		const executor2 = new StepExecutor(storage, 'retry-exec');

		const step1Fn = vi.fn(async () => 'retry-result-1');
		const r1 = await executor2.step('step-1', step1Fn);
		expect(r1).toBe('result-1');
		expect(step1Fn).not.toHaveBeenCalled();

		const r2 = await executor2.step('step-2', async () => 'retry-success');
		expect(r2).toBe('retry-success');
	});
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('createStepExecutor', () => {
	it('should create StepExecutor instance', () => {
		const storage = createMockStorage();
		const executor = createStepExecutor(storage, 'test-exec');

		expect(executor).toBeInstanceOf(StepExecutor);
	});

	it('should pass options to executor', async () => {
		const storage = createMockStorage();
		const onExecute = vi.fn();
		const executor = createStepExecutor(storage, 'test-exec', { onExecute });

		await executor.step('step-1', async () => 'done');

		expect(onExecute).toHaveBeenCalledWith('step-1');
	});
});

// ============================================================================
// GENERATE EXECUTION ID TESTS
// ============================================================================

describe('generateExecutionId', () => {
	it('should generate ID from workflow and event', () => {
		const id = generateExecutionId('meeting-sync', 'meeting-123');

		expect(id).toMatch(/^meeting-sync:meeting-123:\d{4}-\d{2}-\d{2}$/);
	});

	it('should include custom timestamp', () => {
		const id = generateExecutionId('workflow-1', 'event-1', '2025-01-15');

		expect(id).toBe('workflow-1:event-1:2025-01-15');
	});

	it('should generate unique IDs for different events', () => {
		const id1 = generateExecutionId('workflow', 'event-1', '2025-01-15');
		const id2 = generateExecutionId('workflow', 'event-2', '2025-01-15');

		expect(id1).not.toBe(id2);
	});
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge cases', () => {
	let storage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		storage = createMockStorage();
	});

	it('should handle null results', async () => {
		const executor = new StepExecutor(storage, 'null-test');

		const result = await executor.step('null-step', async () => null);
		expect(result).toBeNull();

		// On retry, should return stored null
		const executor2 = new StepExecutor(storage, 'null-test');
		const result2 = await executor2.step('null-step', async () => 'different');
		expect(result2).toBeNull();
	});

	it('should handle undefined results', async () => {
		const executor = new StepExecutor(storage, 'undefined-test');

		const result = await executor.step('undefined-step', async () => undefined);
		expect(result).toBeUndefined();
	});

	it('should handle complex object results', async () => {
		const executor = new StepExecutor(storage, 'complex-test');

		const complexData = {
			id: '123',
			nested: { a: 1, b: [1, 2, 3] },
			date: '2025-01-15T00:00:00Z',
		};

		await executor.step('complex-step', async () => complexData);

		const executor2 = new StepExecutor(storage, 'complex-test');
		const result = await executor2.step('complex-step', async () => ({}));

		expect(result).toEqual(complexData);
	});

	it('should handle concurrent step executions gracefully', async () => {
		const executor = new StepExecutor(storage, 'concurrent-test');

		// Start two steps "concurrently"
		const [r1, r2] = await Promise.all([
			executor.step('step-a', async () => {
				await new Promise((r) => setTimeout(r, 10));
				return 'a';
			}),
			executor.step('step-b', async () => {
				await new Promise((r) => setTimeout(r, 5));
				return 'b';
			}),
		]);

		expect(r1).toBe('a');
		expect(r2).toBe('b');
	});

	it('should handle non-Error throws', async () => {
		const executor = new StepExecutor(storage, 'non-error-test');

		await expect(
			executor.step('string-throw', async () => {
				throw 'string error';
			})
		).rejects.toBe('string error');

		const state = storage.data.get('execution:non-error-test') as ExecutionState;
		expect(state.steps['string-throw'].error).toBe('string error');
	});
});
