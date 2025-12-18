/**
 * Lesson Loader
 * Dynamically loads markdown lesson content using Vite's ?raw import
 */

export interface Heading {
	level: number;
	text: string;
	id: string;
}

export interface LessonContent {
	markdown: string;
	headings: Heading[];
	excerpt: string;
}

/**
 * Load a lesson's markdown content
 */
export async function loadLesson(pathId: string, lessonId: string): Promise<string> {
	const lessons: Record<string, Record<string, () => Promise<{ default: string }>>> = {
		'getting-started': {
			'wezterm-setup': () => import('./getting-started/wezterm-setup.md?raw'),
			'claude-code-setup': () => import('./getting-started/claude-code-setup.md?raw'),
			'neomutt-setup': () => import('./getting-started/neomutt-setup.md?raw'),
			'workway-cli': () => import('./getting-started/workway-cli.md?raw'),
			'essential-commands': () => import('./getting-started/essential-commands.md?raw')
		},
		'workflow-foundations': {
			'what-is-workflow': () => import('./workflow-foundations/what-is-workflow.md?raw'),
			'define-workflow-pattern': () =>
				import('./workflow-foundations/define-workflow-pattern.md?raw'),
			'integrations-oauth': () => import('./workflow-foundations/integrations-oauth.md?raw'),
			'config-schemas': () => import('./workflow-foundations/config-schemas.md?raw'),
			triggers: () => import('./workflow-foundations/triggers.md?raw')
		},
		'building-workflows': {
			'first-workflow': () => import('./building-workflows/first-workflow.md?raw'),
			'working-with-integrations': () =>
				import('./building-workflows/working-with-integrations.md?raw'),
			'workers-ai': () => import('./building-workflows/workers-ai.md?raw'),
			'error-handling': () => import('./building-workflows/error-handling.md?raw'),
			'local-testing': () => import('./building-workflows/local-testing.md?raw')
		},
		'systems-thinking': {
			'compound-workflows': () => import('./systems-thinking/compound-workflows.md?raw'),
			'private-workflows': () => import('./systems-thinking/private-workflows.md?raw'),
			'agency-patterns': () => import('./systems-thinking/agency-patterns.md?raw'),
			'performance-rate-limiting': () =>
				import('./systems-thinking/performance-rate-limiting.md?raw'),
			'monitoring-debugging': () => import('./systems-thinking/monitoring-debugging.md?raw')
		}
	};

	const pathLessons = lessons[pathId];
	if (!pathLessons) {
		throw new Error(`Path not found: ${pathId}`);
	}

	const lessonLoader = pathLessons[lessonId];
	if (!lessonLoader) {
		throw new Error(`Lesson not found: ${pathId}/${lessonId}`);
	}

	const module = await lessonLoader();
	return module.default;
}

/**
 * Extract first paragraph as excerpt for meta descriptions
 * Skips the title (# heading) and returns first non-empty paragraph
 */
export function extractExcerpt(markdown: string, maxLength: number = 160): string {
	// Split by double newlines to get blocks
	const blocks = markdown.split(/\n\n+/);

	// Find first paragraph (skip headings, empty lines, code blocks)
	for (const block of blocks) {
		const trimmed = block.trim();
		// Skip headings, code blocks, and tables
		if (
			trimmed.startsWith('#') ||
			trimmed.startsWith('```') ||
			trimmed.startsWith('|') ||
			trimmed === ''
		) {
			continue;
		}
		// Found a paragraph - clean and truncate
		const cleaned = trimmed.replace(/\s+/g, ' ');
		if (cleaned.length <= maxLength) {
			return cleaned;
		}
		// Truncate at word boundary
		const truncated = cleaned.slice(0, maxLength);
		const lastSpace = truncated.lastIndexOf(' ');
		return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '…';
	}

	return '';
}

/**
 * Extract headings from markdown for table of contents
 */
export function extractHeadings(markdown: string): Heading[] {
	const headingRegex = /^(#{1,6})\s+(.+)$/gm;
	const headings: Heading[] = [];
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

/**
 * Load lesson with extracted headings and excerpt
 */
export async function loadLessonContent(pathId: string, lessonId: string): Promise<LessonContent> {
	const markdown = await loadLesson(pathId, lessonId);
	const headings = extractHeadings(markdown);
	const excerpt = extractExcerpt(markdown);
	return { markdown, headings, excerpt };
}
