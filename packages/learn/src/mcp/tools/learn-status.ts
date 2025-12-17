/**
 * learn_status Tool
 *
 * Get comprehensive learning progress overview.
 */

import { isAuthenticated, getCurrentUser } from '../../api/auth.js';
import { getClient } from '../../api/client.js';
import { getCacheStats } from '../../cache/lesson-cache.js';
import { getPendingCount } from '../../cache/progress-cache.js';
import { loadEthos } from '../../ethos/defaults.js';
import type { LearnerProgress, PathProgress } from '../../types/index.js';

export const definition = {
	name: 'learn_status',
	description: 'Get learning progress overview including paths, lessons, and recommendations',
	inputSchema: {
		type: 'object' as const,
		properties: {
			includeDetails: {
				type: 'boolean',
				description: 'Include lesson-level details'
			},
			pathFilter: {
				type: 'string',
				description: 'Filter to a specific path (e.g., "getting-started")'
			}
		}
	}
};

export interface LearnStatusInput {
	includeDetails?: boolean;
	pathFilter?: string;
}

export interface LearnStatusOutput {
	authenticated: boolean;
	learner?: {
		email: string;
		tier: string;
	};
	overall: {
		pathsCompleted: number;
		pathsTotal: number;
		lessonsCompleted: number;
		lessonsTotal: number;
		progressPercent: number;
		totalTimeHours: number;
		praxisCompleted: number;
	};
	paths: Array<{
		id: string;
		status: string;
		lessonsCompleted: number;
		lessonsTotal: number;
		nextLesson?: string;
	}>;
	recentActivity: Array<{
		lessonId: string;
		lessonTitle: string;
		completedAt: string;
	}>;
	ethos?: {
		principlesSet: number;
		lastUpdated: string;
	};
	cache: {
		lessonsCount: number;
		pendingSync: number;
	};
	recommendations: string[];
}

export async function handler(input: LearnStatusInput): Promise<LearnStatusOutput> {
	const authenticated = isAuthenticated();
	const user = getCurrentUser();

	// Default response for unauthenticated users
	const defaultOutput: LearnStatusOutput = {
		authenticated: false,
		overall: {
			pathsCompleted: 0,
			pathsTotal: 4,
			lessonsCompleted: 0,
			lessonsTotal: 18,
			progressPercent: 0,
			totalTimeHours: 0,
			praxisCompleted: 0
		},
		paths: [],
		recentActivity: [],
		cache: {
			lessonsCount: getCacheStats().count,
			pendingSync: getPendingCount()
		},
		recommendations: ['Authenticate to track your progress']
	};

	if (!authenticated || !user) {
		return defaultOutput;
	}

	// Try to fetch progress from API
	let progress: LearnerProgress | null = null;

	try {
		const client = getClient();
		progress = await client.getProgress();
	} catch {
		// API unavailable, use local data
	}

	// Get ethos
	const ethos = loadEthos();

	// Build output
	const output: LearnStatusOutput = {
		authenticated: true,
		learner: {
			email: user.email,
			tier: user.tier
		},
		overall: progress?.overall || defaultOutput.overall,
		paths: [],
		recentActivity: progress?.recentActivity || [],
		ethos: {
			principlesSet: ethos.principles.length,
			lastUpdated: ethos.lastUpdated
		},
		cache: {
			lessonsCount: getCacheStats().count,
			pendingSync: getPendingCount()
		},
		recommendations: []
	};

	// Build paths list
	if (progress?.paths) {
		output.paths = progress.paths
			.filter((p) => !input.pathFilter || p.pathId === input.pathFilter)
			.map((p) => ({
				id: p.pathId,
				status: p.status,
				lessonsCompleted: p.lessonsCompleted,
				lessonsTotal: p.lessonsTotal,
				nextLesson: getNextLesson(p)
			}));
	}

	// Generate recommendations
	output.recommendations = generateRecommendations(progress, output.cache.pendingSync);

	return output;
}

/**
 * Get next lesson for a path
 */
function getNextLesson(path: PathProgress): string | undefined {
	if (path.status === 'completed') {
		return undefined;
	}

	// Map path IDs to lesson IDs
	const pathLessons: Record<string, string[]> = {
		'getting-started': [
			'claude-code-setup',
			'workway-cli',
			'essential-commands',
			'wezterm-setup',
			'neomutt-setup'
		],
		'workflow-foundations': [
			'what-is-workflow',
			'define-workflow-pattern',
			'integrations-oauth',
			'config-schemas',
			'triggers'
		],
		'building-workflows': [
			'first-workflow',
			'working-with-integrations',
			'workers-ai',
			'error-handling',
			'local-testing'
		],
		'systems-thinking': [
			'compound-workflows',
			'private-workflows',
			'agency-patterns',
			'performance-rate-limiting',
			'monitoring-debugging'
		]
	};

	const lessons = pathLessons[path.pathId];
	if (lessons && path.lessonsCompleted < lessons.length) {
		return lessons[path.lessonsCompleted];
	}

	return undefined;
}

/**
 * Generate recommendations based on progress
 */
function generateRecommendations(progress: LearnerProgress | null, pendingSync: number): string[] {
	const recommendations: string[] = [];

	if (pendingSync > 0) {
		recommendations.push(`Sync ${pendingSync} pending completion(s) when online`);
	}

	if (!progress) {
		recommendations.push('Start with "getting-started" path');
		return recommendations;
	}

	// Find in-progress or next path
	const inProgress = progress.paths.find((p) => p.status === 'in_progress');
	const notStarted = progress.paths.find((p) => p.status === 'not_started');

	if (inProgress) {
		recommendations.push(`Continue "${inProgress.pathId}" (${inProgress.lessonsCompleted}/${inProgress.lessonsTotal})`);
	} else if (notStarted) {
		recommendations.push(`Start "${notStarted.pathId}" path`);
	}

	// Check overall progress
	if (progress.overall.progressPercent === 100) {
		recommendations.push('All paths completed! Review your ethos principles.');
	} else if (progress.overall.progressPercent > 50) {
		recommendations.push("You're more than halfway! Keep going.");
	}

	return recommendations;
}
