/**
 * @workwayco/harness - Performance Profiler
 *
 * Profiles the TypeScript coordinator to identify bottlenecks at scale.
 * Used to determine if Rust port is necessary.
 *
 * Key metrics tracked:
 * - Coordinator loop overhead
 * - Worker assignment latency
 * - Beads (SQLite) operation timing
 * - Memory usage trends
 * - Event loop lag
 *
 * Usage:
 * ```typescript
 * import { Profiler, runProfileSession } from '@workwayco/harness/profiler';
 *
 * // Quick profile
 * const results = await runProfileSession({
 *   targetAgents: 25,
 *   targetIssues: 100,
 *   durationMs: 60000,
 * });
 *
 * console.log(results.report);
 * ```
 */

import { performance, PerformanceObserver, PerformanceEntry } from 'perf_hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileConfig {
	/** Target number of concurrent agents */
	targetAgents: number;
	/** Target number of issues to process */
	targetIssues: number;
	/** Profile duration in ms (0 for run until complete) */
	durationMs: number;
	/** Sample interval for memory/event loop (ms) */
	sampleIntervalMs: number;
	/** Enable verbose logging */
	verbose: boolean;
}

export const DEFAULT_PROFILE_CONFIG: ProfileConfig = {
	targetAgents: 20,
	targetIssues: 100,
	durationMs: 0,
	sampleIntervalMs: 1000,
	verbose: false,
};

export interface ProfileMetrics {
	// Timing metrics
	coordinatorLoopMs: number[];
	workerAssignmentMs: number[];
	beadsReadMs: number[];
	beadsWriteMs: number[];
	checkpointMs: number[];

	// Memory metrics
	heapUsedMB: number[];
	heapTotalMB: number[];
	externalMB: number[];
	rss: number[];

	// Event loop metrics
	eventLoopLagMs: number[];

	// Operation counts
	loopIterations: number;
	workerAssignments: number;
	beadsReads: number;
	beadsWrites: number;
	checkpoints: number;
}

export interface ProfileReport {
	config: ProfileConfig;
	durationMs: number;
	metrics: ProfileMetrics;
	summary: ProfileSummary;
	bottlenecks: Bottleneck[];
	rustRecommendation: RustRecommendation;
	report: string;
}

export interface ProfileSummary {
	// Coordinator overhead
	avgLoopMs: number;
	p95LoopMs: number;
	p99LoopMs: number;
	loopsPerSecond: number;

	// Worker management
	avgAssignmentMs: number;
	p95AssignmentMs: number;
	assignmentsPerSecond: number;

	// Beads (SQLite) performance
	avgBeadsReadMs: number;
	avgBeadsWriteMs: number;
	beadsOpsPerSecond: number;

	// Memory
	peakHeapMB: number;
	avgHeapMB: number;
	memoryGrowthMB: number;

	// Event loop
	avgEventLoopLagMs: number;
	maxEventLoopLagMs: number;
}

export interface Bottleneck {
	area: 'coordinator' | 'beads' | 'memory' | 'event-loop' | 'worker-management';
	severity: 'low' | 'medium' | 'high' | 'critical';
	description: string;
	recommendation: string;
}

export interface RustRecommendation {
	recommended: boolean;
	confidence: number;
	reasons: string[];
	estimatedImprovement: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Profiler Class
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performance profiler for Gastown coordinator.
 */
export class Profiler {
	private config: ProfileConfig;
	private metrics: ProfileMetrics;
	private startTime: number;
	private sampleTimer: NodeJS.Timeout | null;
	private perfObserver: PerformanceObserver | null;

	constructor(config: Partial<ProfileConfig> = {}) {
		this.config = { ...DEFAULT_PROFILE_CONFIG, ...config };
		this.metrics = this.createEmptyMetrics();
		this.startTime = 0;
		this.sampleTimer = null;
		this.perfObserver = null;
	}

	/**
	 * Start profiling session.
	 */
	start(): void {
		this.startTime = performance.now();
		this.metrics = this.createEmptyMetrics();

		// Start memory/event loop sampling
		this.sampleTimer = setInterval(
			() => this.takeSample(),
			this.config.sampleIntervalMs
		);

		// Set up performance observer for custom marks
		this.perfObserver = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				this.handlePerfEntry(entry);
			}
		});
		this.perfObserver.observe({ entryTypes: ['measure'] });

		if (this.config.verbose) {
			console.log('\n📊 Profiler started');
		}
	}

	/**
	 * Stop profiling and generate report.
	 */
	stop(): ProfileReport {
		const endTime = performance.now();
		const durationMs = endTime - this.startTime;

		// Stop sampling
		if (this.sampleTimer) {
			clearInterval(this.sampleTimer);
			this.sampleTimer = null;
		}

		// Stop observer
		if (this.perfObserver) {
			this.perfObserver.disconnect();
			this.perfObserver = null;
		}

		// Generate report
		const summary = this.calculateSummary(durationMs);
		const bottlenecks = this.identifyBottlenecks(summary);
		const rustRecommendation = this.generateRustRecommendation(summary, bottlenecks);

		const report: ProfileReport = {
			config: this.config,
			durationMs,
			metrics: this.metrics,
			summary,
			bottlenecks,
			rustRecommendation,
			report: '', // Will be set below
		};

		report.report = this.formatReport(report);

		return report;
	}

	/**
	 * Mark the start of a coordinator loop iteration.
	 */
	markLoopStart(): void {
		performance.mark('loop-start');
	}

	/**
	 * Mark the end of a coordinator loop iteration.
	 */
	markLoopEnd(): void {
		performance.mark('loop-end');
		performance.measure('coordinator-loop', 'loop-start', 'loop-end');
		this.metrics.loopIterations++;
	}

	/**
	 * Mark the start of a worker assignment.
	 */
	markAssignmentStart(): void {
		performance.mark('assignment-start');
	}

	/**
	 * Mark the end of a worker assignment.
	 */
	markAssignmentEnd(): void {
		performance.mark('assignment-end');
		performance.measure('worker-assignment', 'assignment-start', 'assignment-end');
		this.metrics.workerAssignments++;
	}

	/**
	 * Mark the start of a beads read operation.
	 */
	markBeadsReadStart(): void {
		performance.mark('beads-read-start');
	}

	/**
	 * Mark the end of a beads read operation.
	 */
	markBeadsReadEnd(): void {
		performance.mark('beads-read-end');
		performance.measure('beads-read', 'beads-read-start', 'beads-read-end');
		this.metrics.beadsReads++;
	}

	/**
	 * Mark the start of a beads write operation.
	 */
	markBeadsWriteStart(): void {
		performance.mark('beads-write-start');
	}

	/**
	 * Mark the end of a beads write operation.
	 */
	markBeadsWriteEnd(): void {
		performance.mark('beads-write-end');
		performance.measure('beads-write', 'beads-write-start', 'beads-write-end');
		this.metrics.beadsWrites++;
	}

	/**
	 * Mark the start of a checkpoint operation.
	 */
	markCheckpointStart(): void {
		performance.mark('checkpoint-start');
	}

	/**
	 * Mark the end of a checkpoint operation.
	 */
	markCheckpointEnd(): void {
		performance.mark('checkpoint-end');
		performance.measure('checkpoint', 'checkpoint-start', 'checkpoint-end');
		this.metrics.checkpoints++;
	}

	/**
	 * Manually record a timing measurement.
	 */
	recordTiming(category: keyof Pick<ProfileMetrics, 'coordinatorLoopMs' | 'workerAssignmentMs' | 'beadsReadMs' | 'beadsWriteMs' | 'checkpointMs'>, durationMs: number): void {
		this.metrics[category].push(durationMs);
	}

	/**
	 * Take a sample of memory and event loop metrics.
	 */
	private takeSample(): void {
		// Memory metrics
		const memUsage = process.memoryUsage();
		this.metrics.heapUsedMB.push(memUsage.heapUsed / 1024 / 1024);
		this.metrics.heapTotalMB.push(memUsage.heapTotal / 1024 / 1024);
		this.metrics.externalMB.push(memUsage.external / 1024 / 1024);
		this.metrics.rss.push(memUsage.rss / 1024 / 1024);

		// Event loop lag (approximate)
		const start = performance.now();
		setImmediate(() => {
			const lag = performance.now() - start;
			this.metrics.eventLoopLagMs.push(lag);
		});
	}

	/**
	 * Handle performance entry from observer.
	 */
	private handlePerfEntry(entry: PerformanceEntry): void {
		switch (entry.name) {
			case 'coordinator-loop':
				this.metrics.coordinatorLoopMs.push(entry.duration);
				break;
			case 'worker-assignment':
				this.metrics.workerAssignmentMs.push(entry.duration);
				break;
			case 'beads-read':
				this.metrics.beadsReadMs.push(entry.duration);
				break;
			case 'beads-write':
				this.metrics.beadsWriteMs.push(entry.duration);
				break;
			case 'checkpoint':
				this.metrics.checkpointMs.push(entry.duration);
				break;
		}

		// Clear the entry to prevent memory growth
		performance.clearMeasures(entry.name);
	}

	/**
	 * Create empty metrics object.
	 */
	private createEmptyMetrics(): ProfileMetrics {
		return {
			coordinatorLoopMs: [],
			workerAssignmentMs: [],
			beadsReadMs: [],
			beadsWriteMs: [],
			checkpointMs: [],
			heapUsedMB: [],
			heapTotalMB: [],
			externalMB: [],
			rss: [],
			eventLoopLagMs: [],
			loopIterations: 0,
			workerAssignments: 0,
			beadsReads: 0,
			beadsWrites: 0,
			checkpoints: 0,
		};
	}

	/**
	 * Calculate summary statistics.
	 */
	private calculateSummary(durationMs: number): ProfileSummary {
		const durationSec = durationMs / 1000;

		return {
			// Coordinator
			avgLoopMs: this.avg(this.metrics.coordinatorLoopMs),
			p95LoopMs: this.percentile(this.metrics.coordinatorLoopMs, 0.95),
			p99LoopMs: this.percentile(this.metrics.coordinatorLoopMs, 0.99),
			loopsPerSecond: this.metrics.loopIterations / durationSec,

			// Worker management
			avgAssignmentMs: this.avg(this.metrics.workerAssignmentMs),
			p95AssignmentMs: this.percentile(this.metrics.workerAssignmentMs, 0.95),
			assignmentsPerSecond: this.metrics.workerAssignments / durationSec,

			// Beads
			avgBeadsReadMs: this.avg(this.metrics.beadsReadMs),
			avgBeadsWriteMs: this.avg(this.metrics.beadsWriteMs),
			beadsOpsPerSecond: (this.metrics.beadsReads + this.metrics.beadsWrites) / durationSec,

			// Memory
			peakHeapMB: Math.max(...this.metrics.heapUsedMB, 0),
			avgHeapMB: this.avg(this.metrics.heapUsedMB),
			memoryGrowthMB: this.metrics.heapUsedMB.length > 1
				? this.metrics.heapUsedMB[this.metrics.heapUsedMB.length - 1] - this.metrics.heapUsedMB[0]
				: 0,

			// Event loop
			avgEventLoopLagMs: this.avg(this.metrics.eventLoopLagMs),
			maxEventLoopLagMs: Math.max(...this.metrics.eventLoopLagMs, 0),
		};
	}

	/**
	 * Identify bottlenecks based on summary.
	 */
	private identifyBottlenecks(summary: ProfileSummary): Bottleneck[] {
		const bottlenecks: Bottleneck[] = [];

		// Coordinator loop bottleneck
		if (summary.p95LoopMs > 100) {
			bottlenecks.push({
				area: 'coordinator',
				severity: summary.p95LoopMs > 500 ? 'critical' : summary.p95LoopMs > 200 ? 'high' : 'medium',
				description: `Coordinator loop P95 latency is ${summary.p95LoopMs.toFixed(1)}ms`,
				recommendation: 'Consider async optimization or Rust port for coordinator logic',
			});
		}

		// Beads (SQLite) bottleneck
		if (summary.avgBeadsReadMs > 50 || summary.avgBeadsWriteMs > 100) {
			bottlenecks.push({
				area: 'beads',
				severity: summary.avgBeadsWriteMs > 200 ? 'high' : 'medium',
				description: `Beads operations slow: read ${summary.avgBeadsReadMs.toFixed(1)}ms, write ${summary.avgBeadsWriteMs.toFixed(1)}ms`,
				recommendation: 'Enable WAL mode, add connection pooling, or use Rust SQLite bindings',
			});
		}

		// Memory bottleneck
		if (summary.memoryGrowthMB > 100) {
			bottlenecks.push({
				area: 'memory',
				severity: summary.memoryGrowthMB > 500 ? 'critical' : summary.memoryGrowthMB > 200 ? 'high' : 'medium',
				description: `Memory grew by ${summary.memoryGrowthMB.toFixed(1)}MB during profile`,
				recommendation: 'Check for memory leaks, reduce object allocation, or use Rust for memory-intensive operations',
			});
		}

		// Event loop bottleneck
		if (summary.maxEventLoopLagMs > 100) {
			bottlenecks.push({
				area: 'event-loop',
				severity: summary.maxEventLoopLagMs > 500 ? 'high' : 'medium',
				description: `Event loop lag peaked at ${summary.maxEventLoopLagMs.toFixed(1)}ms`,
				recommendation: 'Offload CPU-intensive work to worker threads or Rust WASM',
			});
		}

		// Worker assignment bottleneck
		if (summary.p95AssignmentMs > 50) {
			bottlenecks.push({
				area: 'worker-management',
				severity: summary.p95AssignmentMs > 100 ? 'high' : 'medium',
				description: `Worker assignment P95 latency is ${summary.p95AssignmentMs.toFixed(1)}ms`,
				recommendation: 'Optimize worker pool or use Rust for work distribution',
			});
		}

		return bottlenecks;
	}

	/**
	 * Generate Rust port recommendation.
	 */
	private generateRustRecommendation(summary: ProfileSummary, bottlenecks: Bottleneck[]): RustRecommendation {
		const reasons: string[] = [];
		let score = 0;

		// Check critical bottlenecks
		const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length;
		const highCount = bottlenecks.filter(b => b.severity === 'high').length;

		if (criticalCount > 0) {
			score += 40;
			reasons.push(`${criticalCount} critical bottleneck(s) detected`);
		}

		if (highCount > 0) {
			score += highCount * 15;
			reasons.push(`${highCount} high-severity bottleneck(s) detected`);
		}

		// Check coordinator overhead
		if (summary.p95LoopMs > 100) {
			score += 20;
			reasons.push(`Coordinator loop overhead is significant (P95: ${summary.p95LoopMs.toFixed(1)}ms)`);
		}

		// Check Beads performance
		if (summary.avgBeadsWriteMs > 50) {
			score += 15;
			reasons.push(`SQLite write operations are slow (avg: ${summary.avgBeadsWriteMs.toFixed(1)}ms)`);
		}

		// Check event loop
		if (summary.maxEventLoopLagMs > 100) {
			score += 10;
			reasons.push(`Event loop blocking detected (max: ${summary.maxEventLoopLagMs.toFixed(1)}ms)`);
		}

		// Check scale
		if (this.config.targetAgents >= 20) {
			score += 10;
			reasons.push(`Target scale is ${this.config.targetAgents} agents (approaching TypeScript ceiling)`);
		}

		const confidence = Math.min(score, 100) / 100;
		const recommended = confidence >= 0.5;

		let estimatedImprovement = 'Minimal (<2x)';
		if (confidence >= 0.8) {
			estimatedImprovement = 'Significant (5-10x for coordinator, 2-5x for SQLite)';
		} else if (confidence >= 0.6) {
			estimatedImprovement = 'Moderate (2-5x for hot paths)';
		} else if (confidence >= 0.4) {
			estimatedImprovement = 'Incremental (1.5-2x for specific operations)';
		}

		return {
			recommended,
			confidence,
			reasons,
			estimatedImprovement,
		};
	}

	/**
	 * Format human-readable report.
	 */
	private formatReport(report: ProfileReport): string {
		const lines: string[] = [];

		lines.push('');
		lines.push('╔════════════════════════════════════════════════════════════════╗');
		lines.push('║             GASTOWN COORDINATOR PROFILE REPORT                 ║');
		lines.push('╚════════════════════════════════════════════════════════════════╝');
		lines.push('');

		// Config
		lines.push('📋 Configuration:');
		lines.push(`   Target agents: ${report.config.targetAgents}`);
		lines.push(`   Target issues: ${report.config.targetIssues}`);
		lines.push(`   Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
		lines.push('');

		// Coordinator metrics
		lines.push('🔄 Coordinator Performance:');
		lines.push(`   Loop iterations: ${report.metrics.loopIterations}`);
		lines.push(`   Loops/second: ${report.summary.loopsPerSecond.toFixed(2)}`);
		lines.push(`   Avg loop time: ${report.summary.avgLoopMs.toFixed(2)}ms`);
		lines.push(`   P95 loop time: ${report.summary.p95LoopMs.toFixed(2)}ms`);
		lines.push(`   P99 loop time: ${report.summary.p99LoopMs.toFixed(2)}ms`);
		lines.push('');

		// Worker management
		lines.push('👷 Worker Management:');
		lines.push(`   Assignments: ${report.metrics.workerAssignments}`);
		lines.push(`   Assignments/second: ${report.summary.assignmentsPerSecond.toFixed(2)}`);
		lines.push(`   Avg assignment time: ${report.summary.avgAssignmentMs.toFixed(2)}ms`);
		lines.push(`   P95 assignment time: ${report.summary.p95AssignmentMs.toFixed(2)}ms`);
		lines.push('');

		// Beads (SQLite) metrics
		lines.push('💾 Beads (SQLite) Performance:');
		lines.push(`   Read operations: ${report.metrics.beadsReads}`);
		lines.push(`   Write operations: ${report.metrics.beadsWrites}`);
		lines.push(`   Avg read time: ${report.summary.avgBeadsReadMs.toFixed(2)}ms`);
		lines.push(`   Avg write time: ${report.summary.avgBeadsWriteMs.toFixed(2)}ms`);
		lines.push(`   Ops/second: ${report.summary.beadsOpsPerSecond.toFixed(2)}`);
		lines.push('');

		// Memory metrics
		lines.push('🧠 Memory:');
		lines.push(`   Peak heap: ${report.summary.peakHeapMB.toFixed(1)}MB`);
		lines.push(`   Avg heap: ${report.summary.avgHeapMB.toFixed(1)}MB`);
		lines.push(`   Growth: ${report.summary.memoryGrowthMB >= 0 ? '+' : ''}${report.summary.memoryGrowthMB.toFixed(1)}MB`);
		lines.push('');

		// Event loop
		lines.push('⚡ Event Loop:');
		lines.push(`   Avg lag: ${report.summary.avgEventLoopLagMs.toFixed(2)}ms`);
		lines.push(`   Max lag: ${report.summary.maxEventLoopLagMs.toFixed(2)}ms`);
		lines.push('');

		// Bottlenecks
		if (report.bottlenecks.length > 0) {
			lines.push('⚠️ Bottlenecks Identified:');
			for (const bottleneck of report.bottlenecks) {
				const icon = bottleneck.severity === 'critical' ? '🔴' :
					bottleneck.severity === 'high' ? '🟠' :
						bottleneck.severity === 'medium' ? '🟡' : '🟢';
				lines.push(`   ${icon} [${bottleneck.area}] ${bottleneck.description}`);
				lines.push(`      → ${bottleneck.recommendation}`);
			}
			lines.push('');
		}

		// Rust recommendation
		lines.push('🦀 Rust Port Recommendation:');
		const recIcon = report.rustRecommendation.recommended ? '✅' : '❌';
		lines.push(`   ${recIcon} ${report.rustRecommendation.recommended ? 'RECOMMENDED' : 'NOT RECOMMENDED'} (confidence: ${(report.rustRecommendation.confidence * 100).toFixed(0)}%)`);
		lines.push(`   Expected improvement: ${report.rustRecommendation.estimatedImprovement}`);
		if (report.rustRecommendation.reasons.length > 0) {
			lines.push('   Reasons:');
			for (const reason of report.rustRecommendation.reasons) {
				lines.push(`     • ${reason}`);
			}
		}
		lines.push('');

		return lines.join('\n');
	}

	/**
	 * Calculate average of array.
	 */
	private avg(arr: number[]): number {
		if (arr.length === 0) return 0;
		return arr.reduce((sum, x) => sum + x, 0) / arr.length;
	}

	/**
	 * Calculate percentile of array.
	 */
	private percentile(arr: number[], p: number): number {
		if (arr.length === 0) return 0;
		const sorted = [...arr].sort((a, b) => a - b);
		const index = Math.floor(sorted.length * p);
		return sorted[Math.min(index, sorted.length - 1)];
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a quick profile session with simulated load.
 */
export async function runProfileSession(
	config: Partial<ProfileConfig> = {}
): Promise<ProfileReport> {
	const fullConfig = { ...DEFAULT_PROFILE_CONFIG, ...config };
	const profiler = new Profiler(fullConfig);

	console.log('\n🔬 Starting profile session...');
	console.log(`   Simulating ${fullConfig.targetAgents} agents processing ${fullConfig.targetIssues} issues`);

	profiler.start();

	// Simulate coordinator work
	for (let i = 0; i < fullConfig.targetIssues; i++) {
		// Simulate loop iteration
		profiler.markLoopStart();

		// Simulate beads read (get next issue)
		profiler.markBeadsReadStart();
		await simulateWork(5 + Math.random() * 10); // 5-15ms
		profiler.markBeadsReadEnd();

		// Simulate worker assignment
		profiler.markAssignmentStart();
		await simulateWork(10 + Math.random() * 20); // 10-30ms
		profiler.markAssignmentEnd();

		// Simulate beads write (update status)
		profiler.markBeadsWriteStart();
		await simulateWork(10 + Math.random() * 30); // 10-40ms
		profiler.markBeadsWriteEnd();

		profiler.markLoopEnd();

		// Occasional checkpoint
		if (i > 0 && i % 10 === 0) {
			profiler.markCheckpointStart();
			await simulateWork(50 + Math.random() * 100); // 50-150ms
			profiler.markCheckpointEnd();
		}

		// Simulate varying load based on agent count
		await simulateWork(1000 / fullConfig.targetAgents);
	}

	const report = profiler.stop();
	console.log(report.report);

	return report;
}

/**
 * Simulate async work.
 */
async function simulateWork(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Profiler class is already exported at declaration
