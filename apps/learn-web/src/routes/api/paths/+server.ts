/**
 * Learning Paths API
 *
 * GET /api/paths - Get all learning paths with lesson metadata
 *
 * Returns structured learning paths without full content (use /api/lessons for content).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { paths } from '$lib/content/paths';

export const GET: RequestHandler = async () => {
	// Transform paths for API response (exclude any internal data)
	const apiPaths = paths.map((path) => ({
		id: path.id,
		title: path.title,
		description: path.description,
		icon: path.icon,
		difficulty: path.difficulty,
		estimatedHours: path.estimatedHours,
		lessonCount: path.lessons.length,
		lessons: path.lessons.map((lesson) => ({
			id: lesson.id,
			title: lesson.title,
			description: lesson.description,
			duration: lesson.duration,
			hasPraxis: !!lesson.praxis,
			hasTemplateWorkflow: !!lesson.templateWorkflow
		}))
	}));

	return json({
		paths: apiPaths,
		totalLessons: apiPaths.reduce((sum, p) => sum + p.lessonCount, 0),
		totalHours: apiPaths.reduce((sum, p) => sum + p.estimatedHours, 0)
	});
};
