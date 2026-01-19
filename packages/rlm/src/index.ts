/**
 * WORKWAY RLM (Recursive Language Model)
 *
 * Long-context processing for WORKWAY autonomous agents.
 * Based on MIT CSAIL's "Recursive Language Models" paper (arxiv:2512.24601).
 *
 * @packageDocumentation
 */

export { runRLM, checkPythonRLM } from './rlm-bridge';
export type {
	RLMConfig,
	RLMResult,
	RLMAssessmentOptions,
	RLMAssessmentResult,
} from './types';
