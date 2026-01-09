import type { PageServerLoad } from './$types';
import { getPath } from '$lib/content/paths';
import { error } from '@sveltejs/kit';

interface LessonProgress {
	lessonId: string;
	pathId: string;
	status: string;
	completedAt: string | null;
}

export const load: PageServerLoad = async ({ params, fetch, locals }) => {
	const { pathId, lessonId } = params;

	// Load lesson content (existing functionality)
	const path = getPath(pathId);
	if (!path) {
		throw error(404, 'Path not found');
	}

	const lesson = path.lessons.find((l) => l.id === lessonId);
	if (!lesson) {
		throw error(404, 'Lesson not found');
	}

	// Load markdown content
	let content = { html: '', excerpt: '' };
	try {
		const module = await import(
			`../../../../lib/content/lessons/${pathId}/${lessonId}.md?raw`
		);
		const raw = module.default;

		// Extract first paragraph as excerpt (simple implementation)
		const firstPara = raw.split('\n\n')[1] || '';
		const excerpt = firstPara.replace(/^#+\s/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 160);

		// For now, pass raw markdown (you can add markdown-to-html processing later)
		content = {
			html: raw,
			excerpt
		};
	} catch (err) {
		console.error(`Failed to load lesson content: ${pathId}/${lessonId}`, err);
	}

	// Load completion state for all lessons in this path (if authenticated)
	let lessonsProgress: LessonProgress[] = [];
	if (locals.user) {
		try {
			const response = await fetch('/api/progress');
			if (response.ok) {
				const progressData = await response.json();
				lessonsProgress = (progressData.lessons || []).filter(
					(l: LessonProgress) => l.pathId === pathId
				);
			}
		} catch (err) {
			console.error('Failed to fetch lesson progress:', err);
		}
	}

	// Build lesson completion map
	const lessonCompletion: Record<string, boolean> = {};
	for (const lessonProg of lessonsProgress) {
		lessonCompletion[lessonProg.lessonId] = lessonProg.status === 'completed';
	}

	return {
		content,
		lessonsProgress: lessonCompletion,
		isAuthenticated: !!locals.user
	};
};
