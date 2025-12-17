/**
 * Lesson Content API
 *
 * GET /api/lessons/:pathId/:lessonId
 * Returns lesson content and metadata for the MCP package.
 *
 * Zuhandenheit: Claude Code gets content seamlessly.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { paths, getPath, getLesson, getNextLesson, getPreviousLesson } from '$lib/content/paths';

// Lesson content loaded at build time via Vite
// For API, we load from the static content files
const lessonContent: Record<string, Record<string, string>> = {};

// Load lessons dynamically
async function loadLessonMarkdown(pathId: string, lessonId: string): Promise<string | null> {
	const lessons: Record<string, Record<string, () => Promise<{ default: string }>>> = {
		'getting-started': {
			'wezterm-setup': () => import('$lib/content/lessons/getting-started/wezterm-setup.md?raw'),
			'claude-code-setup': () =>
				import('$lib/content/lessons/getting-started/claude-code-setup.md?raw'),
			'neomutt-setup': () => import('$lib/content/lessons/getting-started/neomutt-setup.md?raw'),
			'workway-cli': () => import('$lib/content/lessons/getting-started/workway-cli.md?raw'),
			'essential-commands': () =>
				import('$lib/content/lessons/getting-started/essential-commands.md?raw')
		},
		'workflow-foundations': {
			'what-is-workflow': () =>
				import('$lib/content/lessons/workflow-foundations/what-is-workflow.md?raw'),
			'define-workflow-pattern': () =>
				import('$lib/content/lessons/workflow-foundations/define-workflow-pattern.md?raw'),
			'integrations-oauth': () =>
				import('$lib/content/lessons/workflow-foundations/integrations-oauth.md?raw'),
			'config-schemas': () =>
				import('$lib/content/lessons/workflow-foundations/config-schemas.md?raw'),
			triggers: () => import('$lib/content/lessons/workflow-foundations/triggers.md?raw')
		},
		'building-workflows': {
			'first-workflow': () =>
				import('$lib/content/lessons/building-workflows/first-workflow.md?raw'),
			'working-with-integrations': () =>
				import('$lib/content/lessons/building-workflows/working-with-integrations.md?raw'),
			'workers-ai': () => import('$lib/content/lessons/building-workflows/workers-ai.md?raw'),
			'error-handling': () =>
				import('$lib/content/lessons/building-workflows/error-handling.md?raw'),
			'local-testing': () => import('$lib/content/lessons/building-workflows/local-testing.md?raw')
		},
		'systems-thinking': {
			'compound-workflows': () =>
				import('$lib/content/lessons/systems-thinking/compound-workflows.md?raw'),
			'private-workflows': () =>
				import('$lib/content/lessons/systems-thinking/private-workflows.md?raw'),
			'agency-patterns': () =>
				import('$lib/content/lessons/systems-thinking/agency-patterns.md?raw'),
			'performance-rate-limiting': () =>
				import('$lib/content/lessons/systems-thinking/performance-rate-limiting.md?raw'),
			'monitoring-debugging': () =>
				import('$lib/content/lessons/systems-thinking/monitoring-debugging.md?raw')
		}
	};

	try {
		const pathLessons = lessons[pathId];
		if (!pathLessons) return null;

		const lessonLoader = pathLessons[lessonId];
		if (!lessonLoader) return null;

		const module = await lessonLoader();
		return module.default;
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async ({ params }) => {
	const { pathId, lessonId } = params;

	if (!pathId || !lessonId) {
		throw error(400, 'pathId and lessonId are required');
	}

	// Get path and lesson metadata
	const path = getPath(pathId);
	if (!path) {
		throw error(404, `Path not found: ${pathId}`);
	}

	const lesson = getLesson(pathId, lessonId);
	if (!lesson) {
		throw error(404, `Lesson not found: ${pathId}/${lessonId}`);
	}

	// Load markdown content
	const markdown = await loadLessonMarkdown(pathId, lessonId);
	if (!markdown) {
		throw error(404, `Lesson content not found: ${pathId}/${lessonId}`);
	}

	// Get navigation
	const nextLesson = getNextLesson(pathId, lessonId);
	const previousLesson = getPreviousLesson(pathId, lessonId);

	// Find lesson position
	const lessonIndex = path.lessons.findIndex((l) => l.id === lessonId);

	// Extract headings from markdown for table of contents
	const headings = extractHeadings(markdown);

	// Format response to match LessonWithContent type expected by MCP package
	return json({
		id: lesson.id,
		title: lesson.title,
		description: lesson.description,
		duration: lesson.duration,
		pathId: path.id,
		pathTitle: path.title,
		content: markdown,
		headings,
		praxis: lesson.praxis
			? {
					prompt: lesson.praxis,
					templateWorkflow: lesson.templateWorkflow
				}
			: undefined,
		// Additional navigation info
		navigation: {
			next: nextLesson
				? {
						id: nextLesson.id,
						title: nextLesson.title
					}
				: null,
			previous: previousLesson
				? {
						id: previousLesson.id,
						title: previousLesson.title
					}
				: null
		},
		position: lessonIndex + 1,
		totalInPath: path.lessons.length
	});
};

/**
 * Extract headings from markdown for table of contents
 */
function extractHeadings(markdown: string): Array<{ level: number; text: string; id: string }> {
	const headingRegex = /^(#{1,6})\s+(.+)$/gm;
	const headings: Array<{ level: number; text: string; id: string }> = [];
	let match;

	while ((match = headingRegex.exec(markdown)) !== null) {
		headings.push({
			level: match[1].length,
			text: match[2],
			id: match[2]
				.toLowerCase()
				.replace(/\s+/g, '-')
				.replace(/[^\w-]/g, '')
		});
	}

	return headings;
}
