/**
 * @workway/learn
 *
 * WORKWAY learning MCP server and CLI for workflow development mastery.
 *
 * @example
 * ```bash
 * # CLI usage
 * npx @workway/learn init          # Initialize learning environment
 * npx @workway/learn init --full   # Full scaffolding with CLAUDE.md
 * npx @workway/learn status        # Show learning progress
 * npx @workway/learn --server      # Start MCP server
 * ```
 *
 * @example
 * ```json
 * // .mcp.json configuration
 * {
 *   "mcpServers": {
 *     "workway-learn": {
 *       "command": "npx",
 *       "args": ["@workway/learn", "--server"]
 *     }
 *   }
 * }
 * ```
 */

// Types
export * from './types/index.js';

// Ethos
export {
	type EthosCategory,
	type WorkflowPrinciple,
	type WorkflowEthos,
	ETHOS_DEFAULTS,
	REFLECTION_PROMPTS,
	getEthosCategories,
	getRandomPrompt,
	createDefaultEthos
} from './ethos/schema.js';

export {
	loadEthos,
	saveEthos,
	updatePrinciple,
	getPrinciple,
	resetEthos,
	formatEthosForDisplay
} from './ethos/defaults.js';

// Auth
export {
	isAuthenticated,
	getCurrentUser,
	requestMagicLink,
	loginWithPassword,
	validateMagicLinkToken,
	refreshAccessToken,
	clearCredentials,
	getAuthHeader
} from './api/auth.js';

// API Client
export { LearnAPIClient, LearnAPIError, getClient } from './api/client.js';

// Cache
export {
	getCachedLesson,
	cacheLesson,
	getAllCachedLessons,
	clearLessonCache,
	getCacheStats
} from './cache/lesson-cache.js';

export {
	loadPendingCompletions,
	queueCompletion,
	syncPendingCompletions,
	clearPendingCompletions,
	getPendingCount
} from './cache/progress-cache.js';

// MCP Tools (for programmatic use)
export { TOOLS, handleToolCall } from './mcp/tools/index.js';
export { RESOURCES, handleResourceRead } from './mcp/resources/index.js';

// Server
export { startServer } from './server.js';
