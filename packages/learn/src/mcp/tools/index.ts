/**
 * MCP Tools Index
 *
 * Registry of all learning tools for the MCP server.
 */

import * as authenticate from './learn-authenticate.js';
import * as status from './learn-status.js';
import * as lesson from './learn-lesson.js';
import * as complete from './learn-complete.js';
import * as praxis from './learn-praxis.js';
import * as ethos from './learn-ethos.js';
import * as analyze from './learn-analyze.js';
import * as recommend from './learn-recommend.js';
import * as coach from './learn-coach.js';
import * as digest from './learn-digest.js';

/**
 * All tool definitions for MCP server registration
 */
export const TOOLS = [
	authenticate.definition,
	status.definition,
	lesson.definition,
	complete.definition,
	praxis.definition,
	ethos.definition,
	analyze.definition,
	recommend.definition,
	coach.definition,
	digest.definition
];

/**
 * Tool handlers mapped by name
 * Each handler accepts unknown args and casts internally
 */
type ToolHandler = (args: unknown) => Promise<unknown>;

const handlers: Record<string, ToolHandler> = {
	learn_authenticate: (args) => authenticate.handler(args as authenticate.LearnAuthenticateInput),
	learn_status: (args) => status.handler(args as status.LearnStatusInput),
	learn_lesson: (args) => lesson.handler(args as lesson.LearnLessonInput),
	learn_complete: (args) => complete.handler(args as complete.LearnCompleteInput),
	learn_praxis: (args) => praxis.handler(args as praxis.LearnPraxisInput),
	learn_ethos: (args) => ethos.handler(args as ethos.LearnEthosInput),
	learn_analyze: (args) => analyze.handler(args as analyze.LearnAnalyzeInput),
	learn_recommend: (args) => recommend.handler(args as recommend.LearnRecommendInput),
	learn_coach: (args) => coach.handler(args as coach.LearnCoachInput),
	learn_digest: (args) => digest.handler(args as digest.LearnDigestInput)
};

/**
 * Handle a tool call
 */
export async function handleToolCall(
	name: string,
	args: Record<string, unknown>
): Promise<string> {
	const handler = handlers[name];

	if (!handler) {
		return JSON.stringify({ error: `Unknown tool: ${name}` });
	}

	try {
		const result = await handler(args);
		return JSON.stringify(result, null, 2);
	} catch (error) {
		return JSON.stringify({
			error: error instanceof Error ? error.message : 'Unknown error'
		});
	}
}

// Re-export individual tools
export { authenticate, status, lesson, complete, praxis, ethos, analyze, recommend, coach, digest };
