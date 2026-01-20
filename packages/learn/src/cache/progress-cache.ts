/**
 * Progress Cache
 *
 * Queues progress updates for offline sync.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { PendingCompletion } from '../types/index.js';
import { getClient } from '../api/client.js';
import { ensureConfigDir, getConfigPath } from '../lib/config.js';

const QUEUE_FILE = getConfigPath('learn-offline-queue.json');

/**
 * Load pending completions from disk
 */
export function loadPendingCompletions(): PendingCompletion[] {
	if (!existsSync(QUEUE_FILE)) {
		return [];
	}

	try {
		const content = readFileSync(QUEUE_FILE, 'utf-8');
		return JSON.parse(content) as PendingCompletion[];
	} catch {
		return [];
	}
}

/**
 * Save pending completions to disk
 */
function savePendingCompletions(completions: PendingCompletion[]): void {
	ensureConfigDir();
	writeFileSync(QUEUE_FILE, JSON.stringify(completions, null, 2), 'utf-8');
}

/**
 * Queue a completion for later sync
 */
export function queueCompletion(completion: Omit<PendingCompletion, 'queuedAt'>): void {
	const pending = loadPendingCompletions();

	// Check if already queued
	const exists = pending.some(
		(p) => p.pathId === completion.pathId && p.lessonId === completion.lessonId
	);

	if (!exists) {
		pending.push({
			...completion,
			queuedAt: new Date().toISOString()
		});
		savePendingCompletions(pending);
	}
}

/**
 * Sync pending completions to server
 */
export async function syncPendingCompletions(): Promise<{
	synced: number;
	failed: number;
	remaining: number;
}> {
	const pending = loadPendingCompletions();
	const results = { synced: 0, failed: 0, remaining: 0 };

	if (pending.length === 0) {
		return results;
	}

	const client = getClient();
	const stillPending: PendingCompletion[] = [];

	for (const completion of pending) {
		try {
			await client.completeLesson({
				pathId: completion.pathId,
				lessonId: completion.lessonId,
				reflection: completion.reflection,
				timeSpentSeconds: completion.timeSpentSeconds
			});
			results.synced++;
		} catch {
			results.failed++;
			stillPending.push(completion);
		}
	}

	savePendingCompletions(stillPending);
	results.remaining = stillPending.length;

	return results;
}

/**
 * Clear pending completions
 */
export function clearPendingCompletions(): void {
	savePendingCompletions([]);
}

/**
 * Get count of pending completions
 */
export function getPendingCount(): number {
	return loadPendingCompletions().length;
}
