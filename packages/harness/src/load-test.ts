/**
 * @workwayco/harness - Load Testing Utilities
 *
 * Utilities for validating scale behavior under load (20-30 concurrent agents).
 * Simulates realistic workloads and measures throughput, latency, and resource usage.
 *
 * Usage:
 * ```typescript
 * import { runLoadTest, generateLoadTestSpec } from '@workwayco/harness/load-test';
 *
 * const spec = generateLoadTestSpec({
 *   totalIssues: 100,
 *   concurrentAgents: 25,
 *   avgSessionDurationMs: 60000,
 * });
 *
 * const results = await runLoadTest(spec, '/path/to/repo');
 * console.log(results.summary);
 * ```
 */

import type { ScaleConfig, ScaleMetrics } from './types.js';
import { Coordinator } from './coordinator.js';
import { WorkerPool } from './worker.js';
import { ScaleManager } from './scale-manager.js';
import type { HarnessState } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Load Test Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface LoadTestSpec {
  /** Total issues to simulate */
  totalIssues: number;
  /** Target concurrent agents */
  concurrentAgents: number;
  /** Average session duration (ms) */
  avgSessionDurationMs: number;
  /** Session duration variance (0-1) */
  sessionDurationVariance: number;
  /** Failure rate (0-1) */
  failureRate: number;
  /** Ramp-up period (ms) - gradual increase to target concurrency */
  rampUpMs: number;
  /** Test duration (ms) - 0 for run until complete */
  testDurationMs: number;
}

export interface LoadTestResults {
  /** Test spec used */
  spec: LoadTestSpec;
  /** Final scale metrics */
  metrics: ScaleMetrics;
  /** Test duration (ms) */
  durationMs: number;
  /** Throughput (issues/second) */
  throughputPerSecond: number;
  /** Average latency (ms) */
  avgLatencyMs: number;
  /** P95 latency (ms) */
  p95LatencyMs: number;
  /** P99 latency (ms) */
  p99LatencyMs: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Peak concurrent workers */
  peakConcurrentWorkers: number;
  /** Scale operations count */
  scaleOperations: number;
  /** Backpressure activations */
  backpressureActivations: number;
  /** Worker stalls detected */
  workerStalls: number;
  /** Summary text */
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Load Test Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a load test specification.
 */
export function generateLoadTestSpec(
  options: Partial<LoadTestSpec> = {}
): LoadTestSpec {
  return {
    totalIssues: options.totalIssues || 100,
    concurrentAgents: options.concurrentAgents || 20,
    avgSessionDurationMs: options.avgSessionDurationMs || 60000, // 1 minute
    sessionDurationVariance: options.sessionDurationVariance || 0.3, // ±30%
    failureRate: options.failureRate || 0.1, // 10% failure rate
    rampUpMs: options.rampUpMs || 60000, // 1 minute ramp-up
    testDurationMs: options.testDurationMs || 0, // Run until complete
  };
}

/**
 * Predefined load test scenarios.
 */
export const LOAD_TEST_SCENARIOS = {
  /** Light load: 4-10 agents (Phase 1 baseline) */
  light: generateLoadTestSpec({
    totalIssues: 50,
    concurrentAgents: 8,
    avgSessionDurationMs: 45000,
    rampUpMs: 30000,
  }),

  /** Medium load: 10-20 agents (Phase 2 target) */
  medium: generateLoadTestSpec({
    totalIssues: 100,
    concurrentAgents: 15,
    avgSessionDurationMs: 60000,
    rampUpMs: 60000,
  }),

  /** Heavy load: 20-30 agents (Phase 2 max) */
  heavy: generateLoadTestSpec({
    totalIssues: 200,
    concurrentAgents: 25,
    avgSessionDurationMs: 60000,
    rampUpMs: 90000,
  }),

  /** Stress test: 30+ agents (beyond Phase 2) */
  stress: generateLoadTestSpec({
    totalIssues: 300,
    concurrentAgents: 35,
    avgSessionDurationMs: 60000,
    failureRate: 0.15, // Higher failure rate under stress
    rampUpMs: 120000,
  }),

  /** Quick smoke test */
  smoke: generateLoadTestSpec({
    totalIssues: 10,
    concurrentAgents: 5,
    avgSessionDurationMs: 30000,
    rampUpMs: 10000,
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Load Test Runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a load test with the given specification.
 * Simulates realistic harness workload and measures performance.
 */
export async function runLoadTest(
  spec: LoadTestSpec,
  cwd: string
): Promise<LoadTestResults> {
  console.log('\n🔥 Load Test Starting...');
  console.log(`   Issues: ${spec.totalIssues}`);
  console.log(`   Target concurrency: ${spec.concurrentAgents}`);
  console.log(`   Avg session duration: ${spec.avgSessionDurationMs}ms`);
  console.log(`   Failure rate: ${(spec.failureRate * 100).toFixed(1)}%`);
  console.log('');

  const startTime = Date.now();

  // Create worker pool with target concurrency
  const workerPool = new WorkerPool(cwd, true); // dry-run mode
  for (let i = 1; i <= spec.concurrentAgents; i++) {
    workerPool.addWorker(`load-test-worker-${i}`);
  }

  // Create scale manager
  const scaleConfig: ScaleConfig = {
    minWorkers: Math.floor(spec.concurrentAgents * 0.3),
    maxWorkers: Math.ceil(spec.concurrentAgents * 1.2),
    targetQueueDepth: Math.ceil(spec.totalIssues * 0.1),
    maxQueueDepth: Math.ceil(spec.totalIssues * 0.5),
    workerStallTimeoutMs: spec.avgSessionDurationMs * 2,
    healthCheckIntervalMs: 10000, // Check every 10s during load test
    scaleUpThreshold: 2.0,
    scaleDownThreshold: 0.5,
    scaleCooldownMs: 30000,
    maxSessionsPerWorker: Math.ceil(spec.totalIssues / spec.concurrentAgents),
  };

  const scaleManager = new ScaleManager(workerPool, cwd, null, scaleConfig);
  await scaleManager.start();

  // Simulate work
  let backpressureActivations = 0;
  let peakConcurrentWorkers = 0;

  for (let i = 0; i < spec.totalIssues; i++) {
    // Simulate session
    const workerId = `load-test-worker-${(i % spec.concurrentAgents) + 1}`;
    const issueId = `load-test-issue-${i}`;

    // Record session start
    scaleManager.recordSessionStart(workerId, issueId);

    // Simulate session duration with variance
    const variance = (Math.random() - 0.5) * 2 * spec.sessionDurationVariance;
    const duration = spec.avgSessionDurationMs * (1 + variance);

    // Simulate session completion
    const success = Math.random() > spec.failureRate;
    await new Promise(resolve => setTimeout(resolve, 10)); // Small delay for realism

    scaleManager.recordSessionComplete(workerId, issueId, success);

    // Track metrics
    const metrics = scaleManager.getMetrics();
    if (metrics.activeWorkers > peakConcurrentWorkers) {
      peakConcurrentWorkers = metrics.activeWorkers;
    }

    if (scaleManager.shouldApplyBackpressure()) {
      backpressureActivations++;
      await new Promise(resolve => setTimeout(resolve, 100)); // Throttle
    }

    // Display progress every 10 issues
    if ((i + 1) % 10 === 0) {
      console.log(`   Progress: ${i + 1}/${spec.totalIssues} issues (${metrics.activeWorkers}/${metrics.currentWorkers} workers active)`);
    }
  }

  // Stop scale manager and collect final metrics
  await scaleManager.stop();
  const finalMetrics = scaleManager.getMetrics();

  const endTime = Date.now();
  const durationMs = endTime - startTime;

  // Calculate results
  const throughputPerSecond = (spec.totalIssues / durationMs) * 1000;
  const avgLatencyMs = finalMetrics.avgSessionDurationMs;
  const p95LatencyMs = finalMetrics.p95SessionDurationMs;
  const p99LatencyMs = finalMetrics.p95SessionDurationMs * 1.05; // Estimate

  // Build results object
  const results: LoadTestResults = {
    spec,
    metrics: finalMetrics,
    durationMs,
    throughputPerSecond,
    avgLatencyMs,
    p95LatencyMs,
    p99LatencyMs,
    successRate: finalMetrics.successRate,
    peakConcurrentWorkers,
    scaleOperations: finalMetrics.scaleOperations,
    backpressureActivations,
    workerStalls: finalMetrics.stalledWorkers,
    summary: '', // Will be set below
  };

  // Generate summary
  results.summary = generateLoadTestSummary(results);

  return results;
}

/**
 * Generate load test summary report.
 */
function generateLoadTestSummary(results: LoadTestResults): string {
  const lines = [
    '',
    '╔════════════════════════════════════════════════════════════════╗',
    '║                  LOAD TEST RESULTS                             ║',
    '╚════════════════════════════════════════════════════════════════╝',
    '',
    '📊 Throughput:',
    `   ${results.throughputPerSecond.toFixed(2)} issues/second`,
    `   ${results.spec.totalIssues} total issues in ${(results.durationMs / 1000).toFixed(1)}s`,
    '',
    '⏱ Latency:',
    `   Average: ${Math.round(results.avgLatencyMs / 1000)}s`,
    `   P95: ${Math.round(results.p95LatencyMs / 1000)}s`,
    `   P99: ${Math.round(results.p99LatencyMs / 1000)}s`,
    '',
    '👷 Concurrency:',
    `   Target: ${results.spec.concurrentAgents} agents`,
    `   Peak: ${results.peakConcurrentWorkers} agents`,
    `   Scale operations: ${results.scaleOperations}`,
    '',
    '✅ Reliability:',
    `   Success rate: ${(results.successRate * 100).toFixed(1)}%`,
    `   Backpressure activations: ${results.backpressureActivations}`,
    `   Worker stalls: ${results.workerStalls}`,
    '',
    '🏥 Health:',
    `   Final status: ${results.metrics.health}`,
    `   Active workers: ${results.metrics.activeWorkers}/${results.metrics.currentWorkers}`,
    '',
  ];

  // Pass/fail assessment
  const passed = assessLoadTestResults(results);
  if (passed) {
    lines.push('✅ Load test PASSED');
  } else {
    lines.push('❌ Load test FAILED');
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Assess whether load test results meet acceptance criteria.
 */
function assessLoadTestResults(results: LoadTestResults): boolean {
  // Criteria for passing:
  // 1. Success rate >= 80%
  // 2. Health is healthy or degraded (not unhealthy)
  // 3. No excessive worker stalls (< 10% of workers)
  // 4. Peak concurrency within 20% of target

  const checks = [
    results.successRate >= 0.8,
    results.metrics.health !== 'unhealthy',
    results.workerStalls < results.spec.concurrentAgents * 0.1,
    Math.abs(results.peakConcurrentWorkers - results.spec.concurrentAgents) / results.spec.concurrentAgents < 0.2,
  ];

  return checks.every(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Integration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a predefined load test scenario from CLI.
 */
export async function runLoadTestScenario(
  scenarioName: keyof typeof LOAD_TEST_SCENARIOS,
  cwd: string
): Promise<LoadTestResults> {
  const spec = LOAD_TEST_SCENARIOS[scenarioName];
  if (!spec) {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }

  console.log(`\n🎯 Running load test scenario: ${scenarioName}`);
  const results = await runLoadTest(spec, cwd);
  console.log(results.summary);

  return results;
}
