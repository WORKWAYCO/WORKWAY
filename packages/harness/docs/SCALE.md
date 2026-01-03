# Harness Scale Management (Phase 2)

> **Scaling from 4-10 to 20-30 concurrent agents**

The harness ScaleManager enables autonomous scaling of agent pools from the Phase 1 baseline (4-10 agents) to Phase 2 capacity (20-30 agents), with resource quotas, backpressure, health checks, and comprehensive metrics.

## Quick Start

### Enable Scale Management

```typescript
import { Coordinator, createScaleManager } from '@workwayco/harness';

// Create coordinator with scale management enabled
const coordinator = new Coordinator(harnessState, {
  cwd: process.cwd(),
  maxWorkers: 25, // Target concurrent workers
  enableScaleManager: true,
  scaleConfig: {
    minWorkers: 4,
    maxWorkers: 30,
    targetQueueDepth: 10,
    maxQueueDepth: 100,
  },
});

await coordinator.initialize();
await coordinator.run();
```

### Standalone Scale Manager

```typescript
import { ScaleManager, WorkerPool } from '@workwayco/harness';

const workerPool = new WorkerPool(cwd);
const scaleManager = new ScaleManager(workerPool, cwd, null, {
  minWorkers: 4,
  maxWorkers: 30,
});

await scaleManager.start();

// ... do work ...

const metrics = scaleManager.getMetrics();
console.log(`Workers: ${metrics.activeWorkers}/${metrics.currentWorkers}`);
console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
console.log(`Health: ${metrics.health}`);

await scaleManager.stop();
```

## Core Features

### 1. Dynamic Scaling

Automatically adjusts worker pool size based on queue depth and system health.

**Scale Up Trigger:**
- Queue depth / workers > 2.0 (configurable via `scaleUpThreshold`)
- Example: 40 pending issues with 10 workers → scale up

**Scale Down Trigger:**
- Queue depth / workers < 0.5 (configurable via `scaleDownThreshold`)
- Example: 5 pending issues with 20 workers → scale down

**Bounds:**
- Minimum workers: 4 (Phase 1 baseline)
- Maximum workers: 30 (Phase 2 target)

### 2. Resource Quotas

Prevent individual workers from monopolizing resources.

```typescript
const scaleConfig = {
  maxSessionsPerWorker: 50, // Max sessions before worker is deprioritized
};

// Check if worker has exceeded quota
if (scaleManager.hasExceededQuota('worker-1')) {
  // Deprioritize or restart worker
}
```

### 3. Backpressure

Throttle new work when queue depth exceeds capacity.

```typescript
if (scaleManager.shouldApplyBackpressure()) {
  console.log('Queue full - applying backpressure');
  await sleep(1000); // Throttle
}
```

**Configuration:**
```typescript
{
  maxQueueDepth: 100, // Apply backpressure if queue > 100
}
```

### 4. Health Checks

Automatically detect and restart stalled workers.

**Stall Detection:**
- Worker has been "working" for > `workerStallTimeoutMs` (default: 10 minutes)
- No progress reported during timeout period

**Auto-Recovery:**
- Stalled worker is automatically reset
- Work is released back to queue for retry

```typescript
const config = {
  workerStallTimeoutMs: 10 * 60 * 1000, // 10 minutes
  healthCheckIntervalMs: 30 * 1000, // Check every 30 seconds
};
```

### 5. Metrics

Comprehensive observability for capacity planning.

```typescript
const metrics = scaleManager.getMetrics();

// Worker metrics
console.log(`Workers: ${metrics.currentWorkers}`);
console.log(`Active: ${metrics.activeWorkers}`);
console.log(`Idle: ${metrics.idleWorkers}`);
console.log(`Stalled: ${metrics.stalledWorkers}`);

// Queue metrics
console.log(`Queue depth: ${metrics.queueDepth}`);
console.log(`Merge queue: ${metrics.mergeQueueDepth}`);

// Performance metrics
console.log(`Throughput: ${metrics.throughputPerMinute} sessions/min`);
console.log(`Avg latency: ${metrics.avgSessionDurationMs}ms`);
console.log(`P95 latency: ${metrics.p95SessionDurationMs}ms`);

// Success metrics
console.log(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
console.log(`Completed: ${metrics.totalSessionsCompleted}`);
console.log(`Failed: ${metrics.totalSessionsFailed}`);

// System health
console.log(`Health: ${metrics.health}`); // healthy | degraded | unhealthy
console.log(`Backpressure: ${metrics.backpressureActive}`);
console.log(`Scale ops: ${metrics.scaleOperations}`);
```

## Configuration

### ScaleConfig

```typescript
interface ScaleConfig {
  /** Minimum workers in pool */
  minWorkers: number;
  /** Maximum workers in pool */
  maxWorkers: number;
  /** Target queue depth to maintain */
  targetQueueDepth: number;
  /** Maximum queue depth before applying backpressure */
  maxQueueDepth: number;
  /** Worker stall timeout (ms) */
  workerStallTimeoutMs: number;
  /** Health check interval (ms) */
  healthCheckIntervalMs: number;
  /** Scale up threshold (queue/workers ratio) */
  scaleUpThreshold: number;
  /** Scale down threshold (queue/workers ratio) */
  scaleDownThreshold: number;
  /** Cooldown period (ms) between scale operations */
  scaleCooldownMs: number;
  /** Maximum sessions per worker (resource quota) */
  maxSessionsPerWorker: number;
}
```

### Default Configuration (Phase 2)

```typescript
{
  minWorkers: 4,
  maxWorkers: 30,
  targetQueueDepth: 10,
  maxQueueDepth: 100,
  workerStallTimeoutMs: 10 * 60 * 1000, // 10 minutes
  healthCheckIntervalMs: 30 * 1000, // 30 seconds
  scaleUpThreshold: 2.0,
  scaleDownThreshold: 0.5,
  scaleCooldownMs: 60 * 1000, // 1 minute
  maxSessionsPerWorker: 50,
}
```

## Load Testing

Validate scale behavior under load with built-in load testing utilities.

### Predefined Scenarios

```typescript
import { runLoadTestScenario, LOAD_TEST_SCENARIOS } from '@workwayco/harness/load-test';

// Light load: 4-10 agents (Phase 1)
await runLoadTestScenario('light', cwd);

// Medium load: 10-20 agents
await runLoadTestScenario('medium', cwd);

// Heavy load: 20-30 agents (Phase 2 target)
await runLoadTestScenario('heavy', cwd);

// Stress test: 30+ agents (beyond Phase 2)
await runLoadTestScenario('stress', cwd);

// Quick smoke test
await runLoadTestScenario('smoke', cwd);
```

### Custom Load Test

```typescript
import { runLoadTest, generateLoadTestSpec } from '@workwayco/harness/load-test';

const spec = generateLoadTestSpec({
  totalIssues: 200,
  concurrentAgents: 25,
  avgSessionDurationMs: 60000, // 1 minute
  sessionDurationVariance: 0.3, // ±30%
  failureRate: 0.1, // 10% failure rate
  rampUpMs: 90000, // 90 second ramp-up
});

const results = await runLoadTest(spec, cwd);
console.log(results.summary);
```

### Load Test Results

```typescript
interface LoadTestResults {
  throughputPerSecond: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
  peakConcurrentWorkers: number;
  scaleOperations: number;
  backpressureActivations: number;
  workerStalls: number;
  summary: string; // Human-readable report
}
```

### Acceptance Criteria

Load tests pass if:
1. Success rate >= 80%
2. Health is `healthy` or `degraded` (not `unhealthy`)
3. Worker stalls < 10% of total workers
4. Peak concurrency within 20% of target

## Health Status

The ScaleManager tracks system health based on success rate and stalled workers:

| Status | Success Rate | Stalled Workers | Meaning |
|--------|--------------|-----------------|---------|
| `healthy` | >= 80% | 0 | System operating normally |
| `degraded` | 50-80% | 1-2 | Performance degraded but functional |
| `unhealthy` | < 50% | > 2 | System struggling, intervention needed |

## Best Practices

### 1. Start Conservative

Begin with lower concurrency and gradually increase:

```typescript
// Phase 1: Validate with 4-10 agents
{ minWorkers: 4, maxWorkers: 10 }

// Phase 2: Scale to 20-30 agents
{ minWorkers: 10, maxWorkers: 30 }
```

### 2. Monitor Metrics

Display metrics periodically to track system health:

```typescript
// Coordinator automatically displays every 5 sessions
if (this.scaleManager && this.sessionsCompleted % 5 === 0) {
  this.scaleManager.displayMetrics();
}
```

### 3. Tune Thresholds

Adjust scale thresholds based on workload characteristics:

- CPU-bound work: Lower concurrency, longer cooldown
- I/O-bound work: Higher concurrency, shorter cooldown
- Bursty workload: Higher `maxQueueDepth`, aggressive `scaleUpThreshold`
- Steady workload: Lower `maxQueueDepth`, conservative thresholds

### 4. Load Test First

Always run load tests before production deployment:

```bash
# Validate light load
pnpm harness load-test --scenario light

# Validate target load
pnpm harness load-test --scenario heavy
```

## Integration with Coordinator

The Coordinator automatically integrates ScaleManager when enabled:

```typescript
const coordinator = new Coordinator(harnessState, {
  cwd: process.cwd(),
  enableScaleManager: true,
  scaleConfig: {
    maxWorkers: 25,
  },
});

await coordinator.initialize(); // Starts scale manager
await coordinator.run(); // Uses scale manager for backpressure and health
// Scale manager automatically stops at end
```

**Automatic behaviors:**
- Session tracking (start/complete)
- Backpressure application
- Metrics display (every 5 sessions)
- Cleanup on completion

## Phase Comparison

| Metric | Phase 1 (4-10) | Phase 2 (20-30) | Improvement |
|--------|----------------|-----------------|-------------|
| Concurrent agents | 4-10 | 20-30 | 3-5x |
| Throughput | ~10 issues/hour | ~40-60 issues/hour | 4-6x |
| Scale management | Manual | Automatic | Enabled |
| Health checks | None | Automated | Enabled |
| Backpressure | None | Automated | Enabled |
| Resource quotas | None | Per-worker | Enabled |

## Troubleshooting

### Workers Not Scaling Up

**Symptoms:** Pool stays at `minWorkers` despite high queue depth.

**Causes:**
- Queue depth below `scaleUpThreshold * currentWorkers`
- Still in cooldown period (`scaleCooldownMs`)
- Already at `maxWorkers`

**Solutions:**
- Lower `scaleUpThreshold` (e.g., 1.5 instead of 2.0)
- Reduce `scaleCooldownMs`
- Increase `maxWorkers`

### Frequent Worker Stalls

**Symptoms:** Many workers detected as stalled.

**Causes:**
- `workerStallTimeoutMs` too aggressive
- Sessions legitimately take longer than timeout
- Resource contention

**Solutions:**
- Increase `workerStallTimeoutMs`
- Reduce concurrent workers (`maxWorkers`)
- Optimize session work

### Backpressure Always Active

**Symptoms:** `backpressureActive` always `true`.

**Causes:**
- `maxQueueDepth` too low for workload
- Workers not scaling fast enough
- Sessions taking too long

**Solutions:**
- Increase `maxQueueDepth`
- Lower `scaleUpThreshold` for faster scaling
- Increase `maxWorkers`

## Zuhandenheit

The ScaleManager recedes into transparent operation. You see:
- Work getting done
- Metrics improving
- System adapting to load

You don't see:
- Scale decisions being made
- Health checks running
- Backpressure being applied

The tool becomes invisible during successful operation. It only becomes visible when something breaks (Vorhandenheit).
