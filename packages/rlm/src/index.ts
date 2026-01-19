/**
 * WORKWAY RLM (Recursive Language Model)
 *
 * Long-context processing for WORKWAY autonomous agents.
 * Based on MIT CSAIL's "Recursive Language Models" paper (arxiv:2512.24601).
 *
 * @packageDocumentation
 */

// Python-based RLM (legacy)
export { runRLM, checkPythonRLM } from './rlm-bridge';

// Cloudflare-native RLM (recommended)
export { runCloudflareRLM, checkCloudflareRLM } from './cloudflare-bridge';
export type { CloudflareRLMConfig } from './cloudflare-bridge';

// Common types
export type {
	RLMConfig,
	RLMResult,
	RLMAssessmentOptions,
	RLMAssessmentResult,
} from './types';
