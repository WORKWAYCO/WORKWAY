/**
 * WORKWAY RLM TypeScript Types
 *
 * Type definitions for RLM (Recursive Language Model) integration.
 */

/**
 * Configuration for an RLM session
 */
export interface RLMConfig {
	/** Model for root reasoning (default: "sonnet") */
	rootModel?: string;
	/** Model for sub-LM calls (default: "haiku") */
	subModel?: string;
	/** Maximum REPL iterations (default: 20) */
	maxIterations?: number;
	/** Maximum sub-LM calls (default: 100) */
	maxSubCalls?: number;
	/** Max output per execution (default: 50000) */
	maxOutputChars?: number;
	/** Enable cost tracking (default: true) */
	trackCosts?: boolean;
}

/**
 * Result from an RLM session
 */
export interface RLMResult {
	/** Whether the session succeeded */
	success: boolean;
	/** The final answer (if successful) */
	answer: string | null;
	/** Number of REPL iterations performed */
	iterations: number;
	/** Number of sub-LM calls made */
	subCalls: number;
	/** Total input tokens used */
	totalInputTokens: number;
	/** Total output tokens generated */
	totalOutputTokens: number;
	/** Estimated cost in USD */
	costUsd: number;
	/** Execution trajectory (for debugging) */
	trajectory?: Array<{
		iteration: number;
		type: string;
		[key: string]: any;
	}>;
	/** Error message (if failed) */
	error: string | null;
}

/**
 * Options for running RLM assessment
 */
export interface RLMAssessmentOptions {
	/** Context to analyze (string or array of strings) */
	context: string | string[];
	/** Query to answer about the context */
	query: string;
	/** RLM configuration */
	config?: RLMConfig;
}

/**
 * Result from an RLM assessment
 */
export interface RLMAssessmentResult extends RLMResult {
	/** Assessment-specific findings */
	findings?: {
		qualityScores?: Record<string, number>;
		issues?: Array<{
			severity: 'critical' | 'high' | 'medium' | 'low';
			message: string;
			location?: string;
		}>;
		summary?: string;
	};
}
