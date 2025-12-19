/**
 * Praxis Exercise API
 *
 * POST /api/praxis/:id
 * Submit and validate praxis exercise completions.
 *
 * Praxis exercises are real workflow building tasks, not quizzes.
 * Validation is based on evidence of completion, not perfect answers.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPath, paths } from '$lib/content/paths';

interface PraxisSubmission {
	evidence: string;
	reflection?: string;
	timeSpentMinutes?: number;
}

interface PraxisResult {
	success: boolean;
	feedback: string;
	nextSteps?: string[];
	badges?: string[];
}

// Praxis validators - each lesson can have specific validation logic
const praxisValidators: Record<string, (submission: PraxisSubmission) => PraxisResult> = {
	// Getting Started path
	'wezterm-setup': (submission) => {
		const hasSetup =
			submission.evidence.toLowerCase().includes('wezterm') ||
			submission.evidence.toLowerCase().includes('config') ||
			submission.evidence.toLowerCase().includes('terminal');

		return {
			success: true,
			feedback: hasSetup
				? 'WezTerm is configured. A good terminal recedes during development.'
				: 'Install WezTerm and create the config file at ~/.config/wezterm/wezterm.lua',
			nextSteps: ['Practice splitting panes and keyboard navigation']
		};
	},

	'claude-code-setup': (submission) => {
		const hasExploration =
			submission.evidence.toLowerCase().includes('pattern') ||
			submission.evidence.toLowerCase().includes('workflow') ||
			submission.evidence.toLowerCase().includes('found');

		return {
			success: true,
			feedback: hasExploration
				? "Good exploration! You're using Claude Code effectively."
				: 'Try asking Claude Code about specific patterns in the codebase.',
			nextSteps: hasExploration
				? ['Continue to WORKWAY CLI Installation']
				: ['Ask Claude Code: "What patterns are used in the workflows folder?"']
		};
	},

	'neomutt-setup': (submission) => {
		const hasSetup =
			submission.evidence.toLowerCase().includes('neomutt') ||
			submission.evidence.toLowerCase().includes('email') ||
			submission.evidence.toLowerCase().includes('gmail');

		return {
			success: true,
			feedback: hasSetup
				? 'Neomutt is ready. Terminal email integrates into your workflow.'
				: "This is optional. If you prefer your current email client, that's fine.",
			nextSteps: ['Explore email-triggered automations']
		};
	},

	'workway-cli': (submission) => {
		const hasInstalled =
			submission.evidence.toLowerCase().includes('install') ||
			submission.evidence.toLowerCase().includes('configured') ||
			submission.evidence.toLowerCase().includes('workway');

		return {
			success: true,
			feedback: hasInstalled
				? 'WORKWAY CLI is ready. You can now build workflows.'
				: 'Run through the installation steps with Claude Code.',
			nextSteps: ['Explore available WORKWAY commands']
		};
	},

	'essential-commands': (submission) => {
		const hasAliases =
			submission.evidence.toLowerCase().includes('alias') ||
			submission.evidence.toLowerCase().includes('shortcut') ||
			submission.evidence.toLowerCase().includes('command');

		return {
			success: true,
			feedback: hasAliases
				? 'Aliases set up! Muscle memory makes the tools recede.'
				: 'Add the development aliases to your shell config.',
			nextSteps: ['Practice until the commands feel automatic']
		};
	},

	// Workflow Foundations path
	'what-is-workflow': (submission) => {
		const hasOutcome =
			submission.evidence.toLowerCase().includes('outcome') ||
			submission.evidence.toLowerCase().includes('disappear') ||
			submission.evidence.toLowerCase().includes('automatic');

		return {
			success: true,
			feedback: hasOutcome
				? "You're thinking in outcomes, not mechanisms. That's the Zuhandenheit mindset."
				: 'Reframe your tasks: what disappears from your to-do list?',
			nextSteps: ['Save your outcome statements for later lessons']
		};
	},

	'define-workflow-pattern': (submission) => {
		const hasExamples =
			submission.evidence.toLowerCase().includes('defineworkflow') ||
			submission.evidence.toLowerCase().includes('example') ||
			submission.evidence.toLowerCase().includes('found');

		return {
			success: true,
			feedback: hasExamples
				? "You've seen the pattern. Notice how each workflow follows the same structure."
				: 'Ask Claude Code to show you defineWorkflow() examples.',
			nextSteps: ['Look for common patterns across different workflows']
		};
	},

	'integrations-oauth': (submission) => {
		const hasIntegrations =
			submission.evidence.toLowerCase().includes('baseapiclient') ||
			submission.evidence.toLowerCase().includes('integration') ||
			submission.evidence.toLowerCase().includes('oauth');

		return {
			success: true,
			feedback: hasIntegrations
				? 'The BaseAPIClient pattern centralizes OAuth complexity. Tool recedes.'
				: 'Explore how integrations handle token refresh automatically.',
			nextSteps: ['Map which integrations your workflows will need']
		};
	},

	'config-schemas': (submission) => {
		const hasSchema =
			submission.evidence.toLowerCase().includes('configschema') ||
			submission.evidence.toLowerCase().includes('config') ||
			submission.evidence.toLowerCase().includes('default');

		return {
			success: true,
			feedback: hasSchema
				? 'Good config design minimizes required fields with sensible defaults.'
				: 'Design schemas that work out of the box.',
			nextSteps: ['Count required fields - can any become optional?']
		};
	},

	triggers: (submission) => {
		const hasTriggers =
			submission.evidence.toLowerCase().includes('webhook') ||
			submission.evidence.toLowerCase().includes('cron') ||
			submission.evidence.toLowerCase().includes('schedule');

		return {
			success: true,
			feedback: hasTriggers
				? 'Triggers define when workflows spring to life. Choose based on your use case.'
				: 'Practice cron expressions: daily at 9 AM is "0 9 * * *".',
			nextSteps: ['Consider which events in your work could trigger automations']
		};
	},

	// Building Workflows path
	'first-workflow': (submission) => {
		const hasWorkflow =
			submission.evidence.toLowerCase().includes('gmail') ||
			submission.evidence.toLowerCase().includes('notion') ||
			submission.evidence.toLowerCase().includes('workflow');

		return {
			success: true,
			feedback: hasWorkflow
				? 'Your first workflow is taking shape! The pattern becomes natural with practice.'
				: 'Start with a simple trigger and add complexity gradually.',
			nextSteps: ['Test locally with wrangler dev', 'Add error handling'],
			badges: hasWorkflow ? ['first-workflow'] : undefined
		};
	},

	'working-with-integrations': (submission) => {
		const hasChaining =
			submission.evidence.toLowerCase().includes('zoom') ||
			submission.evidence.toLowerCase().includes('slack') ||
			submission.evidence.toLowerCase().includes('chain');

		return {
			success: true,
			feedback: hasChaining
				? 'Service chaining creates compound outcomes. More than the sum of parts.'
				: 'Test each integration call individually before chaining.',
			nextSteps: ["Add error isolation so one failure doesn't break everything"]
		};
	},

	'workers-ai': (submission) => {
		const hasAI =
			submission.evidence.toLowerCase().includes('ai') ||
			submission.evidence.toLowerCase().includes('summar') ||
			submission.evidence.toLowerCase().includes('generate');

		return {
			success: true,
			feedback: hasAI
				? 'Workers AI integration looks good. Edge AI keeps everything fast.'
				: 'Try adding a summarization step to your workflow.',
			nextSteps: ['Experiment with different AI models and temperature settings']
		};
	},

	'error-handling': (submission) => {
		const hasHandling =
			submission.evidence.toLowerCase().includes('try') ||
			submission.evidence.toLowerCase().includes('catch') ||
			submission.evidence.toLowerCase().includes('retry');

		return {
			success: true,
			feedback: hasHandling
				? 'Resilient error handling makes workflows production-ready.'
				: 'Add granular try/catch for each integration call.',
			nextSteps: ['Distinguish critical vs optional steps']
		};
	},

	'local-testing': (submission) => {
		const hasTesting =
			submission.evidence.toLowerCase().includes('test') ||
			submission.evidence.toLowerCase().includes('mock') ||
			submission.evidence.toLowerCase().includes('dev');

		return {
			success: true,
			feedback: hasTesting
				? 'Local testing catches bugs before production. Find bugs locally, not live.'
				: 'Set up workway dev and create test fixtures.',
			nextSteps: ['Run the pre-deploy checklist before workway deploy']
		};
	},

	// Systems Thinking path
	'compound-workflows': (submission) => {
		const hasCompound =
			submission.evidence.toLowerCase().includes('slack') ||
			submission.evidence.toLowerCase().includes('notion') ||
			submission.evidence.toLowerCase().includes('multiple') ||
			submission.evidence.toLowerCase().includes('parallel');

		return {
			success: true,
			feedback: hasCompound
				? 'Compound workflows are where WORKWAY really shines.'
				: 'Think about what happens after a meeting ends - all the follow-ups.',
			nextSteps: ['Consider error handling for each step'],
			badges: hasCompound ? ['compound-architect'] : undefined
		};
	},

	'private-workflows': (submission) => {
		const hasPrivate =
			submission.evidence.toLowerCase().includes('private') ||
			submission.evidence.toLowerCase().includes('access') ||
			submission.evidence.toLowerCase().includes('byoo');

		return {
			success: true,
			feedback: hasPrivate
				? 'Private workflows serve specific organizations while leveraging the full platform.'
				: 'Define accessGrants for who can install your workflow.',
			nextSteps: ['Consider audit logging for compliance requirements']
		};
	},

	'agency-patterns': (submission) => {
		const hasAgency =
			submission.evidence.toLowerCase().includes('template') ||
			submission.evidence.toLowerCase().includes('client') ||
			submission.evidence.toLowerCase().includes('parameterized');

		return {
			success: true,
			feedback: hasAgency
				? 'Build once, deploy many. Client patterns become platform assets.'
				: 'Create a template factory that parameterizes per client.',
			nextSteps: ['Track which patterns emerge across client requests'],
			badges: hasAgency ? ['agency-builder'] : undefined
		};
	},

	'performance-rate-limiting': (submission) => {
		const hasPerformance =
			submission.evidence.toLowerCase().includes('cache') ||
			submission.evidence.toLowerCase().includes('rate') ||
			submission.evidence.toLowerCase().includes('chunk');

		return {
			success: true,
			feedback: hasPerformance
				? 'Performance optimization makes workflows production-ready at scale.'
				: 'Add caching for repeated lookups and rate-limited chunking.',
			nextSteps: ['Measure performance before and after optimization']
		};
	},

	'monitoring-debugging': (submission) => {
		const hasMonitoring =
			submission.evidence.toLowerCase().includes('log') ||
			submission.evidence.toLowerCase().includes('alert') ||
			submission.evidence.toLowerCase().includes('metric');

		return {
			success: true,
			feedback: hasMonitoring
				? 'Observability makes production issues visible and fixable.'
				: 'Add structured logging at key points with context.',
			nextSteps: ['Configure alerts for error rate and latency'],
			badges: hasMonitoring ? ['production-ready'] : undefined
		};
	}
};

// Default validator for lessons without specific logic
const defaultValidator = (submission: PraxisSubmission): PraxisResult => ({
	success: true,
	feedback: 'Praxis completed. The goal is doing, not perfection.',
	nextSteps: ['Continue to the next lesson']
});

export const POST: RequestHandler = async ({ params, request, locals, platform }) => {
	const { id: lessonId } = params;

	if (!lessonId) {
		throw error(400, 'Lesson ID is required');
	}

	// Parse submission
	let submission: PraxisSubmission;
	try {
		submission = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	if (!submission.evidence) {
		throw error(400, 'Evidence of completion is required');
	}

	// Find which path this lesson belongs to
	let pathId: string | null = null;
	for (const path of paths) {
		if (path.lessons.some((l) => l.id === lessonId)) {
			pathId = path.id;
			break;
		}
	}

	if (!pathId) {
		throw error(404, `Lesson not found: ${lessonId}`);
	}

	// Validate the praxis submission
	const validator = praxisValidators[lessonId] || defaultValidator;
	const result = validator(submission);

	// If user is authenticated, save the praxis completion
	if (locals.user && platform?.env?.DB) {
		try {
			const db = platform.env.DB;

			// Get or create learner
			let learner = await db
				.prepare('SELECT * FROM learners WHERE user_id = ?')
				.bind(locals.user.id)
				.first();

			if (!learner) {
				const learnerId = crypto.randomUUID();
				await db
					.prepare(
						'INSERT INTO learners (id, user_id, email, display_name) VALUES (?, ?, ?, ?)'
					)
					.bind(learnerId, locals.user.id, locals.user.email, null)
					.run();
				learner = { id: learnerId };
			}

			// Save praxis completion
			await db
				.prepare(`
					INSERT INTO praxis_completions (id, learner_id, path_id, lesson_id, evidence, reflection, time_spent_minutes, completed_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
					ON CONFLICT (learner_id, lesson_id) DO UPDATE SET
						evidence = excluded.evidence,
						reflection = excluded.reflection,
						time_spent_minutes = excluded.time_spent_minutes,
						completed_at = datetime('now')
				`)
				.bind(
					crypto.randomUUID(),
					learner.id,
					pathId,
					lessonId,
					submission.evidence,
					submission.reflection || null,
					submission.timeSpentMinutes || null
				)
				.run();

			// Also update lesson progress to completed
			const existingProgress = await db
				.prepare(
					'SELECT * FROM lesson_progress WHERE learner_id = ? AND path_id = ? AND lesson_id = ?'
				)
				.bind(learner.id, pathId, lessonId)
				.first();

			if (existingProgress) {
				await db
					.prepare(`
						UPDATE lesson_progress
						SET status = 'completed',
							completed_at = datetime('now')
						WHERE id = ?
					`)
					.bind(existingProgress.id)
					.run();
			} else {
				await db
					.prepare(`
						INSERT INTO lesson_progress (id, learner_id, path_id, lesson_id, status, visits, time_spent_seconds, started_at, completed_at)
						VALUES (?, ?, ?, ?, 'completed', 1, ?, datetime('now'), datetime('now'))
					`)
					.bind(
						crypto.randomUUID(),
						learner.id,
						pathId,
						lessonId,
						(submission.timeSpentMinutes || 0) * 60
					)
					.run();
			}
		} catch (err) {
			console.error('Error saving praxis completion:', err);
			// Don't fail the request - still return validation result
		}
	}

	return json({
		...result,
		lessonId,
		pathId,
		submittedAt: new Date().toISOString()
	});
};
