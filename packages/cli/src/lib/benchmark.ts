/**
 * Benchmark utilities for measuring CLI performance.
 *
 * Usage:
 *   const bench = createBenchmark();
 *   bench.start('phase1');
 *   // ... do work ...
 *   bench.end('phase1');
 *   bench.report();
 */

export interface BenchmarkResult {
	name: string;
	duration: number; // milliseconds
	startTime: number;
	endTime: number;
}

export interface BenchmarkReport {
	totalDuration: number;
	phases: BenchmarkResult[];
	summary: Record<string, number>;
}

/**
 * High-resolution timer using performance.now() when available,
 * falls back to Date.now() in environments without Performance API.
 */
function getTime(): number {
	if (typeof performance !== 'undefined' && performance.now) {
		return performance.now();
	}
	return Date.now();
}

/**
 * Create a benchmark instance for timing operations.
 *
 * @param enabled - Whether to actually record timings (can disable for production)
 */
export function createBenchmark(enabled = true): Benchmark {
	return new Benchmark(enabled);
}

export class Benchmark {
	private phases: Map<string, { start: number; end?: number }> = new Map();
	private completed: BenchmarkResult[] = [];
	private overallStart: number;
	private enabled: boolean;

	constructor(enabled = true) {
		this.enabled = enabled;
		this.overallStart = getTime();
	}

	/**
	 * Start timing a named phase
	 */
	start(name: string): void {
		if (!this.enabled) return;
		this.phases.set(name, { start: getTime() });
	}

	/**
	 * End timing a named phase
	 */
	end(name: string): number {
		if (!this.enabled) return 0;
		const phase = this.phases.get(name);
		if (!phase) {
			console.warn(`Benchmark: No start time for phase "${name}"`);
			return 0;
		}
		const endTime = getTime();
		const duration = endTime - phase.start;

		this.completed.push({
			name,
			duration,
			startTime: phase.start,
			endTime,
		});

		this.phases.delete(name);
		return duration;
	}

	/**
	 * Time a synchronous function
	 */
	time<T>(name: string, fn: () => T): T {
		this.start(name);
		try {
			return fn();
		} finally {
			this.end(name);
		}
	}

	/**
	 * Time an async function
	 */
	async timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
		this.start(name);
		try {
			return await fn();
		} finally {
			this.end(name);
		}
	}

	/**
	 * Get the total elapsed time since benchmark creation
	 */
	elapsed(): number {
		return getTime() - this.overallStart;
	}

	/**
	 * Get a summary of all completed phases
	 */
	getSummary(): Record<string, number> {
		const summary: Record<string, number> = {};
		for (const phase of this.completed) {
			summary[phase.name] = (summary[phase.name] || 0) + phase.duration;
		}
		return summary;
	}

	/**
	 * Get the full benchmark report
	 */
	getReport(): BenchmarkReport {
		return {
			totalDuration: this.elapsed(),
			phases: [...this.completed],
			summary: this.getSummary(),
		};
	}

	/**
	 * Format the report as a human-readable string
	 */
	formatReport(options: { threshold?: number } = {}): string {
		const { threshold = 0 } = options;
		const report = this.getReport();
		const lines: string[] = [];

		lines.push(`\n[Benchmark Report]`);
		lines.push(`Total: ${report.totalDuration.toFixed(2)}ms`);
		lines.push(`Phases:`);

		// Sort by duration descending
		const sorted = Object.entries(report.summary)
			.filter(([_, duration]) => duration >= threshold)
			.sort((a, b) => b[1] - a[1]);

		for (const [name, duration] of sorted) {
			const pct = ((duration / report.totalDuration) * 100).toFixed(1);
			lines.push(`  ${name}: ${duration.toFixed(2)}ms (${pct}%)`);
		}

		return lines.join('\n');
	}

	/**
	 * Print the report to console
	 */
	report(options: { threshold?: number } = {}): void {
		if (!this.enabled) return;
		console.log(this.formatReport(options));
	}

	/**
	 * Reset the benchmark
	 */
	reset(): void {
		this.phases.clear();
		this.completed = [];
		this.overallStart = getTime();
	}
}

/**
 * Check if benchmarking is enabled via environment variable
 */
export function isBenchmarkEnabled(): boolean {
	return process.env.WORKWAY_BENCHMARK === '1' || process.env.WORKWAY_BENCHMARK === 'true';
}

/**
 * Create a benchmark that's only enabled if WORKWAY_BENCHMARK env var is set
 */
export function createEnvBenchmark(): Benchmark {
	return createBenchmark(isBenchmarkEnabled());
}
