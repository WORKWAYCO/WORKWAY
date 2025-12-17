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
	'claude-code-setup': (submission) => {
		// Check for evidence of exploring the codebase
		const hasExploration = submission.evidence.toLowerCase().includes('pattern') ||
			submission.evidence.toLowerCase().includes('workflow') ||
			submission.evidence.toLowerCase().includes('found');

		return {
			success: true, // Praxis is about doing, not perfection
			feedback: hasExploration
				? 'Good exploration! You\'re using Claude Code effectively.'
				: 'Try asking Claude Code about specific patterns in the codebase.',
			nextSteps: hasExploration
				? ['Continue to WORKWAY CLI Installation']
				: ['Ask Claude Code: "What patterns are used in the workflows folder?"']
		};
	},

	'workway-cli': (submission) => {
		const hasInstalled = submission.evidence.toLowerCase().includes('install') ||
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

	'define-workflow-pattern': (submission) => {
		const hasExamples = submission.evidence.toLowerCase().includes('defineworkflow') ||
			submission.evidence.toLowerCase().includes('example') ||
			submission.evidence.toLowerCase().includes('found');

		return {
			success: true,
			feedback: hasExamples
				? 'You\'ve seen the pattern. Notice how each workflow follows the same structure.'
				: 'Ask Claude Code to show you defineWorkflow() examples.',
			nextSteps: ['Look for common patterns across different workflows']
		};
	},

	'first-workflow': (submission) => {
		const hasWorkflow = submission.evidence.toLowerCase().includes('gmail') ||
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
		return {
			success: true,
			feedback: 'Integration patterns follow consistent structure across services.',
			nextSteps: ['Explore more integrations in packages/integrations/']
		};
	},

	'workers-ai': (submission) => {
		const hasAI = submission.evidence.toLowerCase().includes('ai') ||
			submission.evidence.toLowerCase().includes('summar') ||
			submission.evidence.toLowerCase().includes('generate');

		return {
			success: true,
			feedback: hasAI
				? 'Workers AI integration looks good. Edge AI keeps everything fast.'
				: 'Try adding a summarization step to your workflow.',
			nextSteps: ['Experiment with different AI models']
		};
	},

	'compound-workflows': (submission) => {
		const hasCompound = submission.evidence.toLowerCase().includes('slack') ||
			submission.evidence.toLowerCase().includes('notion') ||
			submission.evidence.toLowerCase().includes('multiple');

		return {
			success: true,
			feedback: hasCompound
				? 'Compound workflows are where WORKWAY really shines.'
				: 'Think about what happens after a meeting ends - all the follow-ups.',
			nextSteps: ['Consider error handling for each step'],
			badges: hasCompound ? ['compound-architect'] : undefined
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
