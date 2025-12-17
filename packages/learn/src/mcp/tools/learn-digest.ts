/**
 * learn_digest Tool
 *
 * Generate weekly learning summary.
 */

import { isAuthenticated, getCurrentUser } from '../../api/auth.js';
import { getClient } from '../../api/client.js';
import { loadEthos } from '../../ethos/defaults.js';
import type { WeeklyDigest, LearnerProgress } from '../../types/index.js';

export const definition = {
	name: 'learn_digest',
	description: 'Generate a weekly or monthly learning summary with achievements and goals',
	inputSchema: {
		type: 'object' as const,
		properties: {
			period: {
				type: 'string',
				enum: ['week', 'month'],
				description: 'Time period for the digest'
			},
			format: {
				type: 'string',
				enum: ['summary', 'detailed'],
				description: 'Output format'
			}
		}
	}
};

export interface LearnDigestInput {
	period?: 'week' | 'month';
	format?: 'summary' | 'detailed';
}

export async function handler(input: LearnDigestInput): Promise<WeeklyDigest> {
	const { period = 'week', format = 'summary' } = input;

	// Calculate period dates
	const now = new Date();
	const periodDays = period === 'week' ? 7 : 30;
	const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

	// Try to get progress from API
	let progress: LearnerProgress | null = null;
	if (isAuthenticated()) {
		try {
			const client = getClient();
			progress = await client.getProgress();
		} catch {
			// Continue with default digest
		}
	}

	// Calculate stats
	const completedInPeriod = progress?.lessons.filter(
		(l) => l.status === 'completed' && l.completedAt && new Date(l.completedAt) >= startDate
	) || [];

	const totalTimeSeconds = completedInPeriod.reduce((sum, l) => sum + (l.timeSpentSeconds || 0), 0);

	// Generate digest
	const digest: WeeklyDigest = {
		period: {
			start: startDate.toISOString(),
			end: now.toISOString()
		},
		summary: {
			lessonsCompleted: completedInPeriod.length,
			praxisSubmitted: 0, // Would come from API
			totalTimeHours: Math.round((totalTimeSeconds / 3600) * 10) / 10,
			streakDays: calculateStreak(progress)
		},
		achievements: generateAchievements(progress, startDate),
		highlights: generateHighlights(completedInPeriod),
		weeklyGoals: generateGoals(progress)
	};

	// Add ethos reflection if detailed
	if (format === 'detailed') {
		const ethos = loadEthos();
		const randomPrinciple = ethos.principles[Math.floor(Math.random() * ethos.principles.length)];

		digest.ethosReflection = {
			principleInFocus: randomPrinciple.category,
			applicationNotes: `This ${period}, reflect on: "${randomPrinciple.content}"\n\nHow did your workflows embody this principle?`
		};
	}

	return digest;
}

/**
 * Calculate learning streak
 */
function calculateStreak(progress: LearnerProgress | null): number {
	if (!progress?.lessons) return 0;

	const completedDates = progress.lessons
		.filter((l) => l.completedAt)
		.map((l) => new Date(l.completedAt!).toDateString())
		.filter((v, i, a) => a.indexOf(v) === i)
		.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

	if (completedDates.length === 0) return 0;

	let streak = 0;
	const today = new Date().toDateString();
	const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

	// Check if streak includes today or yesterday
	if (completedDates[0] !== today && completedDates[0] !== yesterday) {
		return 0;
	}

	// Count consecutive days
	for (let i = 0; i < completedDates.length; i++) {
		const current = new Date(completedDates[i]);
		const expected = new Date(Date.now() - i * 24 * 60 * 60 * 1000);

		if (current.toDateString() === expected.toDateString() ||
		    (i > 0 && current.toDateString() === new Date(Date.now() - (i - 1) * 24 * 60 * 60 * 1000).toDateString())) {
			streak++;
		} else {
			break;
		}
	}

	return streak;
}

/**
 * Generate achievements earned in period
 */
function generateAchievements(
	progress: LearnerProgress | null,
	startDate: Date
): WeeklyDigest['achievements'] {
	const achievements: WeeklyDigest['achievements'] = [];

	if (!progress) return achievements;

	// Check for path completions
	for (const path of progress.paths) {
		if (path.status === 'completed' && path.completedAt) {
			const completedDate = new Date(path.completedAt);
			if (completedDate >= startDate) {
				achievements.push({
					type: 'path_completed',
					title: `Completed ${path.pathId}`,
					earnedAt: path.completedAt
				});
			}
		}
	}

	// Check for streak milestones
	const streak = calculateStreak(progress);
	if (streak >= 7) {
		achievements.push({
			type: 'streak',
			title: `${streak}-day learning streak`,
			earnedAt: new Date().toISOString()
		});
	}

	// Check for milestone completions
	const totalCompleted = progress.overall.lessonsCompleted;
	const milestones = [5, 10, 15, 20];

	for (const milestone of milestones) {
		if (totalCompleted >= milestone) {
			// Check if milestone was reached in this period
			const lessonsInPeriod = progress.lessons.filter(
				(l) => l.completedAt && new Date(l.completedAt) >= startDate
			).length;

			if (totalCompleted - lessonsInPeriod < milestone) {
				achievements.push({
					type: 'milestone',
					title: `${milestone} lessons completed`,
					earnedAt: new Date().toISOString()
				});
			}
		}
	}

	return achievements;
}

/**
 * Generate highlights from completed lessons
 */
function generateHighlights(
	completedLessons: Array<{ lessonId: string; reflection?: string }>
): WeeklyDigest['highlights'] {
	const highlights: WeeklyDigest['highlights'] = [];

	// Add lesson completions
	for (const lesson of completedLessons.slice(0, 3)) {
		highlights.push({
			type: 'lesson',
			title: formatLessonTitle(lesson.lessonId),
			summary: lesson.reflection || 'Completed successfully'
		});
	}

	return highlights;
}

/**
 * Generate weekly goals
 */
function generateGoals(progress: LearnerProgress | null): WeeklyDigest['weeklyGoals'] {
	const suggested: string[] = [];
	const carryOver: string[] = [];

	if (!progress) {
		suggested.push('Complete Claude Code Setup');
		suggested.push('Start Getting Started path');
		return { suggested, carryOver };
	}

	// Find in-progress paths
	const inProgress = progress.paths.find((p) => p.status === 'in_progress');
	if (inProgress) {
		const remaining = inProgress.lessonsTotal - inProgress.lessonsCompleted;
		suggested.push(`Complete ${remaining} more lesson(s) in ${inProgress.pathId}`);
	}

	// Find not-started paths
	const notStarted = progress.paths.find((p) => p.status === 'not_started');
	if (notStarted) {
		suggested.push(`Start the ${notStarted.pathId} path`);
	}

	// General suggestions
	if (progress.overall.progressPercent < 50) {
		suggested.push('Aim for 2-3 lessons this week');
	} else {
		suggested.push('Practice by building a real workflow');
	}

	return { suggested, carryOver };
}

/**
 * Format lesson ID to title
 */
function formatLessonTitle(lessonId: string): string {
	return lessonId
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
