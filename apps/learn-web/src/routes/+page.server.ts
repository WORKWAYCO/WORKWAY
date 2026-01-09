import type { PageServerLoad } from './$types';
import { paths } from '$lib/content/paths';

interface ProgressResponse {
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
		pathId: string;
		status: string;
		lessonsCompleted: number;
		lessonsTotal: number;
		startedAt?: string;
		completedAt?: string;
	}>;
	lessons: Array<{
		lessonId: string;
		pathId: string;
		status: string;
		visits: number;
		timeSpentSeconds: number;
		startedAt: string;
		completedAt: string | null;
	}>;
	recentActivity: Array<{
		lessonId: string;
		lessonTitle: string;
		pathId: string;
		completedAt: string;
	}>;
	streak: {
		currentStreak: number;
		longestStreak: number;
		lastActivityDate: string | null;
	};
}

export const load: PageServerLoad = async ({ fetch, locals }) => {
	// Not logged in - show marketing page
	if (!locals.user) {
		return { user: null, progress: null };
	}

	// Logged in - load dashboard data
	try {
		const response = await fetch('/api/progress');
		if (!response.ok) {
			console.error('Failed to fetch progress:', response.status);
			return {
				user: locals.user,
				progress: null,
				error: 'Failed to load progress'
			};
		}

		const progress: ProgressResponse = await response.json();

		// Find next incomplete lesson across all paths
		let nextLesson: { pathId: string; lessonId: string; lessonTitle: string; pathTitle: string } | null = null;

		for (const path of paths) {
			const pathProgress = progress.paths.find((p) => p.pathId === path.id);
			if (!pathProgress || pathProgress.status === 'completed') continue;

			// Find first incomplete lesson in this path
			for (const lesson of path.lessons) {
				const lessonProgress = progress.lessons.find(
					(l) => l.pathId === path.id && l.lessonId === lesson.id
				);

				if (!lessonProgress || lessonProgress.status !== 'completed') {
					nextLesson = {
						pathId: path.id,
						lessonId: lesson.id,
						lessonTitle: lesson.title,
						pathTitle: path.title
					};
					break;
				}
			}

			if (nextLesson) break;
		}

		// Calculate path progress percentages
		const pathsWithProgress = paths.map((path) => {
			const pathProgress = progress.paths.find((p) => p.pathId === path.id);
			const completedLessons =
				progress.lessons.filter(
					(l) => l.pathId === path.id && l.status === 'completed'
				).length || 0;

			return {
				...path,
				completedLessons,
				totalLessons: path.lessons.length,
				progressPercent: path.lessons.length > 0
					? Math.round((completedLessons / path.lessons.length) * 100)
					: 0,
				status: pathProgress?.status || 'not_started'
			};
		});

		return {
			user: locals.user,
			progress: {
				...progress,
				nextLesson,
				pathsWithProgress
			}
		};
	} catch (err) {
		console.error('Error fetching progress:', err);
		return {
			user: locals.user,
			progress: null,
			error: 'Failed to load progress'
		};
	}
};
