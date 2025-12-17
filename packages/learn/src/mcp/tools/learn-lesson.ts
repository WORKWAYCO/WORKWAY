/**
 * learn_lesson Tool
 *
 * Fetch lesson content with caching.
 */

import { getClient } from '../../api/client.js';
import { getCachedLesson, cacheLesson } from '../../cache/lesson-cache.js';
import type { LessonWithContent, LessonHeading } from '../../types/index.js';

export const definition = {
	name: 'learn_lesson',
	description: 'Fetch lesson content from WORKWAY Learn with offline caching',
	inputSchema: {
		type: 'object' as const,
		properties: {
			pathId: {
				type: 'string',
				description: 'The learning path ID (e.g., "getting-started", "workflow-foundations")'
			},
			lessonId: {
				type: 'string',
				description: 'The lesson ID (e.g., "claude-code-setup", "first-workflow")'
			},
			forceRefresh: {
				type: 'boolean',
				description: 'Bypass cache and fetch fresh content'
			}
		},
		required: ['pathId', 'lessonId']
	}
};

export interface LearnLessonInput {
	pathId: string;
	lessonId: string;
	forceRefresh?: boolean;
}

export interface LearnLessonOutput {
	lesson: {
		id: string;
		title: string;
		description: string;
		duration: string;
		pathId: string;
		pathTitle: string;
		content: string;
		headings: LessonHeading[];
		praxis?: {
			prompt: string;
			templateWorkflow?: {
				id: string;
				name: string;
			};
		};
	};
	navigation: {
		previousLesson?: { id: string; title: string };
		nextLesson?: { id: string; title: string };
		pathProgress: {
			completed: number;
			total: number;
		};
	};
	cached: boolean;
	cachedAt?: string;
}

// Lesson metadata (matches paths.ts in learn-web)
const LESSON_METADATA: Record<string, Record<string, { title: string; description: string; duration: string }>> = {
	'getting-started': {
		'claude-code-setup': {
			title: 'Claude Code Setup',
			description: 'Install Claude Code and authenticate. This is your primary tool for everything that follows.',
			duration: '15 min'
		},
		'workway-cli': {
			title: 'WORKWAY CLI Installation',
			description: 'Use Claude Code to install and configure the WORKWAY CLI.',
			duration: '10 min'
		},
		'essential-commands': {
			title: 'Essential Commands & Shortcuts',
			description: 'Reference for terminal navigation, git, and Claude Code commands.',
			duration: '10 min'
		},
		'wezterm-setup': {
			title: 'WezTerm (Optional)',
			description: 'Modern terminal setup. Skip if you already have a terminal you like.',
			duration: '15 min'
		},
		'neomutt-setup': {
			title: 'Neomutt (Optional)',
			description: 'Terminal email for workflow-driven developers. Advanced setup.',
			duration: '20 min'
		}
	},
	'workflow-foundations': {
		'what-is-workflow': {
			title: 'What is a Workflow?',
			description: 'Zuhandenheit: the tool recedes, the outcome remains. Outcomes vs mechanisms.',
			duration: '15 min'
		},
		'define-workflow-pattern': {
			title: 'The defineWorkflow() Pattern',
			description: 'Anatomy of a WORKWAY workflow. Ask Claude Code to explain any part.',
			duration: '20 min'
		},
		'integrations-oauth': {
			title: 'Integrations & OAuth',
			description: "BaseAPIClient pattern. How WORKWAY handles authentication so you don't.",
			duration: '20 min'
		},
		'config-schemas': {
			title: 'Configuration Schemas',
			description: 'Inputs, pickers, validation. Sensible defaults that let users skip configuration.',
			duration: '20 min'
		},
		'triggers': {
			title: 'Triggers',
			description: 'Webhooks, cron, manual. When workflows run.',
			duration: '15 min'
		}
	},
	'building-workflows': {
		'first-workflow': {
			title: 'Your First Workflow',
			description: 'Build Gmail → Notion with Claude Code guiding you through each step.',
			duration: '30 min'
		},
		'working-with-integrations': {
			title: 'Working with Integrations',
			description: 'Slack, Zoom, Stripe patterns. Use Claude Code to explore integration methods.',
			duration: '30 min'
		},
		'workers-ai': {
			title: 'Workers AI',
			description: 'Add intelligence: summarization, classification, extraction. Edge AI.',
			duration: '25 min'
		},
		'error-handling': {
			title: 'Error Handling',
			description: 'Graceful degradation, retries, circuit breakers. Resilient workflows.',
			duration: '20 min'
		},
		'local-testing': {
			title: 'Local Testing',
			description: 'wrangler dev, mocking, debugging. Test before you deploy.',
			duration: '20 min'
		}
	},
	'systems-thinking': {
		'compound-workflows': {
			title: 'Compound Workflows',
			description: 'Meeting ends → Notion + Slack + Email + CRM. Orchestration patterns.',
			duration: '35 min'
		},
		'private-workflows': {
			title: 'Private Workflows',
			description: 'Organization-specific workflows. Access control, BYOO credentials.',
			duration: '30 min'
		},
		'agency-patterns': {
			title: 'Agency Patterns',
			description: 'Build once, deploy many. Client-specific workflows, marketplace graduation.',
			duration: '35 min'
		},
		'performance-rate-limiting': {
			title: 'Performance & Rate Limiting',
			description: 'Cloudflare Workers constraints. Batching, caching, pagination.',
			duration: '25 min'
		},
		'monitoring-debugging': {
			title: 'Monitoring & Debugging',
			description: 'Production observability. Logs, metrics, alerts.',
			duration: '20 min'
		}
	}
};

const PATH_TITLES: Record<string, string> = {
	'getting-started': 'Getting Started',
	'workflow-foundations': 'Workflow Foundations',
	'building-workflows': 'Building Workflows',
	'systems-thinking': 'Systems Thinking'
};

export async function handler(input: LearnLessonInput): Promise<LearnLessonOutput> {
	const { pathId, lessonId, forceRefresh } = input;

	// Check cache first (unless force refresh)
	if (!forceRefresh) {
		const cached = getCachedLesson(pathId, lessonId);
		if (cached) {
			return formatOutput(cached, true, cached.cachedAt);
		}
	}

	// Try to fetch from API
	try {
		const client = getClient();
		const lesson = await client.getLesson(pathId, lessonId);

		// Cache the lesson
		const cached = cacheLesson(lesson);

		return formatOutput(lesson, false);
	} catch (error) {
		// Try cache as fallback
		const cached = getCachedLesson(pathId, lessonId);
		if (cached) {
			return formatOutput(cached, true, cached.cachedAt);
		}

		// Generate placeholder from metadata
		const metadata = LESSON_METADATA[pathId]?.[lessonId];
		if (metadata) {
			return formatOutput(
				{
					id: lessonId,
					pathId,
					pathTitle: PATH_TITLES[pathId] || pathId,
					...metadata,
					content: `# ${metadata.title}\n\nLesson content unavailable offline. Please connect to the internet and try again.`,
					headings: [{ level: 1, text: metadata.title, id: metadata.title.toLowerCase().replace(/\s+/g, '-') }]
				},
				false
			);
		}

		throw new Error(`Lesson not found: ${pathId}/${lessonId}`);
	}
}

function formatOutput(lesson: LessonWithContent, cached: boolean, cachedAt?: string): LearnLessonOutput {
	const pathLessons = Object.keys(LESSON_METADATA[lesson.pathId] || {});
	const currentIndex = pathLessons.indexOf(lesson.id);

	const navigation = {
		previousLesson:
			currentIndex > 0
				? {
						id: pathLessons[currentIndex - 1],
						title: LESSON_METADATA[lesson.pathId]?.[pathLessons[currentIndex - 1]]?.title || ''
					}
				: undefined,
		nextLesson:
			currentIndex < pathLessons.length - 1
				? {
						id: pathLessons[currentIndex + 1],
						title: LESSON_METADATA[lesson.pathId]?.[pathLessons[currentIndex + 1]]?.title || ''
					}
				: undefined,
		pathProgress: {
			completed: currentIndex,
			total: pathLessons.length
		}
	};

	return {
		lesson: {
			id: lesson.id,
			title: lesson.title,
			description: lesson.description,
			duration: lesson.duration,
			pathId: lesson.pathId,
			pathTitle: lesson.pathTitle,
			content: lesson.content,
			headings: lesson.headings,
			praxis: lesson.praxis
		},
		navigation,
		cached,
		cachedAt
	};
}
