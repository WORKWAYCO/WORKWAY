/**
 * learn_recommend Tool
 *
 * Get personalized lesson recommendations.
 */

import { isAuthenticated } from '../../api/auth.js';
import { getClient } from '../../api/client.js';
import type { Recommendation, SkillGap, LearnerProgress } from '../../types/index.js';

export const definition = {
	name: 'learn_recommend',
	description: 'Get personalized lesson recommendations based on your progress and skill gaps',
	inputSchema: {
		type: 'object' as const,
		properties: {
			context: {
				type: 'string',
				enum: ['current_project', 'skill_gaps', 'next_milestone'],
				description: 'Context for recommendations'
			},
			focusArea: {
				type: 'string',
				enum: ['integrations', 'workflows', 'patterns', 'advanced'],
				description: 'Focus area for recommendations'
			}
		}
	}
};

export interface LearnRecommendInput {
	context?: 'current_project' | 'skill_gaps' | 'next_milestone';
	focusArea?: 'integrations' | 'workflows' | 'patterns' | 'advanced';
}

export interface LearnRecommendOutput {
	recommendations: Recommendation[];
	skillGaps: SkillGap[];
	nextMilestone: {
		name: string;
		lessonsRemaining: number;
		estimatedTime: string;
	};
}

// Learning path structure
const PATHS = {
	'getting-started': {
		lessons: ['claude-code-setup', 'workway-cli', 'essential-commands', 'wezterm-setup', 'neomutt-setup'],
		skills: ['terminal', 'claude-code', 'cli']
	},
	'workflow-foundations': {
		lessons: ['what-is-workflow', 'define-workflow-pattern', 'integrations-oauth', 'config-schemas', 'triggers'],
		skills: ['patterns', 'integrations', 'configuration']
	},
	'building-workflows': {
		lessons: ['first-workflow', 'working-with-integrations', 'workers-ai', 'error-handling', 'local-testing'],
		skills: ['implementation', 'integrations', 'testing', 'ai']
	},
	'systems-thinking': {
		lessons: ['compound-workflows', 'private-workflows', 'agency-patterns', 'performance-rate-limiting', 'monitoring-debugging'],
		skills: ['architecture', 'scaling', 'monitoring', 'advanced']
	}
};

const LESSON_DETAILS: Record<string, { title: string; time: string; skills: string[] }> = {
	'claude-code-setup': { title: 'Claude Code Setup', time: '15 min', skills: ['terminal', 'claude-code'] },
	'workway-cli': { title: 'WORKWAY CLI', time: '10 min', skills: ['cli'] },
	'essential-commands': { title: 'Essential Commands', time: '10 min', skills: ['terminal'] },
	'what-is-workflow': { title: 'What is a Workflow?', time: '15 min', skills: ['patterns'] },
	'define-workflow-pattern': { title: 'defineWorkflow() Pattern', time: '20 min', skills: ['patterns'] },
	'integrations-oauth': { title: 'Integrations & OAuth', time: '20 min', skills: ['integrations'] },
	'config-schemas': { title: 'Configuration Schemas', time: '20 min', skills: ['configuration'] },
	'triggers': { title: 'Triggers', time: '15 min', skills: ['patterns'] },
	'first-workflow': { title: 'Your First Workflow', time: '30 min', skills: ['implementation'] },
	'working-with-integrations': { title: 'Working with Integrations', time: '30 min', skills: ['integrations'] },
	'workers-ai': { title: 'Workers AI', time: '25 min', skills: ['ai'] },
	'error-handling': { title: 'Error Handling', time: '20 min', skills: ['implementation'] },
	'local-testing': { title: 'Local Testing', time: '20 min', skills: ['testing'] },
	'compound-workflows': { title: 'Compound Workflows', time: '35 min', skills: ['architecture'] },
	'private-workflows': { title: 'Private Workflows', time: '30 min', skills: ['advanced'] },
	'agency-patterns': { title: 'Agency Patterns', time: '35 min', skills: ['advanced'] },
	'performance-rate-limiting': { title: 'Performance', time: '25 min', skills: ['scaling'] },
	'monitoring-debugging': { title: 'Monitoring', time: '20 min', skills: ['monitoring'] }
};

export async function handler(input: LearnRecommendInput): Promise<LearnRecommendOutput> {
	const { context = 'next_milestone', focusArea } = input;

	// Get progress
	let progress: LearnerProgress | null = null;
	if (isAuthenticated()) {
		try {
			const client = getClient();
			progress = await client.getProgress();
		} catch {
			// Continue with default recommendations
		}
	}

	// Build recommendations
	const recommendations = generateRecommendations(progress, context, focusArea);
	const skillGaps = analyzeSkillGaps(progress, focusArea);
	const nextMilestone = getNextMilestone(progress);

	return {
		recommendations,
		skillGaps,
		nextMilestone
	};
}

function generateRecommendations(
	progress: LearnerProgress | null,
	context: string,
	focusArea?: string
): Recommendation[] {
	const recommendations: Recommendation[] = [];
	const completedLessons = new Set(
		progress?.lessons.filter((l) => l.status === 'completed').map((l) => l.lessonId) || []
	);

	// Find incomplete lessons
	for (const [pathId, pathData] of Object.entries(PATHS)) {
		// Filter by focus area if specified
		if (focusArea) {
			const pathSkills = pathData.skills;
			if (!pathSkills.some((s) => s.includes(focusArea) || focusArea.includes(s))) {
				continue;
			}
		}

		for (const lessonId of pathData.lessons) {
			if (completedLessons.has(lessonId)) continue;

			const details = LESSON_DETAILS[lessonId];
			if (!details) continue;

			// Determine priority
			let priority: 'immediate' | 'soon' | 'when_ready' = 'when_ready';
			let rationale = '';

			if (pathId === 'getting-started' && !completedLessons.has('claude-code-setup')) {
				priority = 'immediate';
				rationale = 'Essential first step for all learning';
			} else if (pathId === 'workflow-foundations' && completedLessons.size < 5) {
				priority = completedLessons.size < 3 ? 'immediate' : 'soon';
				rationale = 'Foundation knowledge for building workflows';
			} else if (context === 'current_project' && pathId === 'building-workflows') {
				priority = 'soon';
				rationale = 'Directly applicable to your current work';
			}

			recommendations.push({
				pathId,
				lessonId,
				title: details.title,
				rationale: rationale || `Continue ${pathId} path`,
				estimatedTime: details.time,
				priority
			});
		}
	}

	// Sort by priority and limit
	const priorityOrder = { immediate: 0, soon: 1, when_ready: 2 };
	recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

	return recommendations.slice(0, 5);
}

function analyzeSkillGaps(progress: LearnerProgress | null, focusArea?: string): SkillGap[] {
	const gaps: SkillGap[] = [];
	const completedLessons = new Set(
		progress?.lessons.filter((l) => l.status === 'completed').map((l) => l.lessonId) || []
	);

	// Calculate skill coverage
	const skillCoverage: Record<string, { completed: number; total: number; lessons: string[] }> = {};

	for (const [, pathData] of Object.entries(PATHS)) {
		for (const skill of pathData.skills) {
			if (!skillCoverage[skill]) {
				skillCoverage[skill] = { completed: 0, total: 0, lessons: [] };
			}
		}

		for (const lessonId of pathData.lessons) {
			const details = LESSON_DETAILS[lessonId];
			if (!details) continue;

			for (const skill of details.skills) {
				if (!skillCoverage[skill]) {
					skillCoverage[skill] = { completed: 0, total: 0, lessons: [] };
				}
				skillCoverage[skill].total++;
				skillCoverage[skill].lessons.push(lessonId);

				if (completedLessons.has(lessonId)) {
					skillCoverage[skill].completed++;
				}
			}
		}
	}

	// Generate gaps
	for (const [skill, coverage] of Object.entries(skillCoverage)) {
		if (focusArea && !skill.includes(focusArea) && !focusArea.includes(skill)) {
			continue;
		}

		const percent = coverage.total > 0 ? coverage.completed / coverage.total : 0;

		let currentLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner';
		let targetLevel: 'intermediate' | 'advanced' | 'expert' = 'intermediate';

		if (percent >= 0.8) {
			currentLevel = 'advanced';
			targetLevel = 'expert';
		} else if (percent >= 0.5) {
			currentLevel = 'intermediate';
			targetLevel = 'advanced';
		}

		if (percent < 1) {
			gaps.push({
				skill,
				currentLevel,
				targetLevel,
				lessons: coverage.lessons.filter((l) => !completedLessons.has(l))
			});
		}
	}

	return gaps.slice(0, 5);
}

function getNextMilestone(progress: LearnerProgress | null): {
	name: string;
	lessonsRemaining: number;
	estimatedTime: string;
} {
	const completedLessons = progress?.lessons.filter((l) => l.status === 'completed').length || 0;

	// Define milestones
	const milestones = [
		{ name: 'Complete Getting Started', threshold: 5, time: '1 hour' },
		{ name: 'Finish Workflow Foundations', threshold: 10, time: '2 hours' },
		{ name: 'Build Your First Workflow', threshold: 11, time: '30 min' },
		{ name: 'Complete Building Workflows', threshold: 15, time: '2 hours' },
		{ name: 'Master Systems Thinking', threshold: 20, time: '2.5 hours' }
	];

	for (const milestone of milestones) {
		if (completedLessons < milestone.threshold) {
			return {
				name: milestone.name,
				lessonsRemaining: milestone.threshold - completedLessons,
				estimatedTime: milestone.time
			};
		}
	}

	return {
		name: 'All paths completed!',
		lessonsRemaining: 0,
		estimatedTime: '0 min'
	};
}
