/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * WORKWAY SDK
 *
 * Two-layer architecture for building the marketplace:
 *
 * LAYER 1: Integration SDK
 * - Build connectors to external services (Gmail, Slack, Notion, etc.)
 * - Provide actions and triggers
 * - Handle OAuth and API calls
 * - Used by: Platform team and integration developers
 *
 * LAYER 2: Workflow SDK
 * - Build marketplace products that compose integrations
 * - Create sellable automation workflows
 * - Configure user settings
 * - Used by: Marketplace developers (the ecosystem)
 *
 * @example Integration Developer
 * ```typescript
 * import { defineIntegration, defineAction } from '@workway/sdk/integration'
 *
 * const sendEmail = defineAction({
 *   id: 'gmail.send-email',
 *   // ... implementation
 * })
 *
 * export default defineIntegration({
 *   id: 'gmail',
 *   actions: [sendEmail]
 * })
 * ```
 *
 * @example Workflow Developer
 * ```typescript
 * import { defineWorkflow } from '@workway/sdk/workflow'
 *
 * export default defineWorkflow({
 *   metadata: {
 *     name: 'Stripe to Notion',
 *     category: 'finance'
 *   },
 *   pricing: { price: 5 },
 *   async execute({ trigger, actions }) {
 *     await actions.notion.createPage({
 *       // ... workflow logic
 *     })
 *   }
 * })
 * ```
 */

// ============================================================================
// INTEGRATION SDK EXPORTS (Layer 1)
// ============================================================================

export type {
	// Core types
	ActionContext,
	OAuthManager,
	OAuthTokens,
	// Action definition
	ActionDefinition,
	ActionInput,
	ActionOutput,
	// Trigger definition
	TriggerDefinition,
	// Integration definition
	IntegrationDefinition,
} from './integration-sdk';

export { ActionRegistry } from './integration-sdk';

// ============================================================================
// WORKFLOW SDK EXPORTS (Layer 2)
// ============================================================================

export type {
	// Workflow definition
	WorkflowDefinition,
	WorkflowMetadata,
	WorkflowPricing,
	WorkflowConfigField,
	WorkflowContext,
	WorkflowResult,
	WorkflowStorage,
	ActionHelpers,
	// Marketplace types
	WorkflowListing,
	WorkflowInstallation,
	WorkflowEarnings,
} from './workflow-sdk';

export { WorkflowRegistry, defineWorkflow, defineConfigField } from './workflow-sdk';

// ============================================================================
// TRIGGER HELPERS
// ============================================================================

export type {
	TriggerConfig,
	WebhookTriggerConfig,
	ScheduleTriggerConfig,
	ManualTriggerConfig,
	PollTriggerConfig,
	Trigger,
} from './triggers';

export {
	webhook,
	schedule,
	manual,
	poll,
	isWebhookTrigger,
	isScheduleTrigger,
	isManualTrigger,
	isPollTrigger,
	describeTrigger,
} from './triggers';

// ============================================================================
// TESTING SDK EXPORTS
// ============================================================================

export type {
	MockOAuthConfig,
	MockContextOptions,
	MockFetchResponse,
} from './testing';

export {
	MockOAuthManager,
	MockStorage,
	createMockContext,
	createMockFetch,
	createMockTokens,
	createExpiredTokens,
	waitFor,
	expectError,
	createTestWorkflow,
	createMockTrigger,
	setupIntegrationTests,
} from './testing';

// ============================================================================
// UTILITY MODULE EXPORTS
// ============================================================================

// HTTP client
export { http, HttpError, type HttpOptions, type HttpRequestOptions, type HttpResponse } from './http';

// Retry utilities
export {
	withRetry,
	fetchWithRetry,
	defaultShouldRetry,
	shouldRetryResponse,
	parseRetryAfter,
	createRateLimitAwareRetry,
	type RetryOptions,
	type RetryContext,
} from './retry';

// Cache utilities
export { Cache, createCache, type CacheOptions, type CacheEntry } from './cache';

// Storage utilities
export {
	KVStorage,
	ObjectStorage,
	createKVStorage,
	createObjectStorage,
	storage,
	type StorageOptions,
	type ListOptions,
	type ListResult,
	type FileMetadata,
} from './storage';

// Transform utilities
export {
	transform,
	filter,
	map,
	reduce,
	find,
	groupBy,
	unique,
	chunk,
	flatten,
	sortBy,
	parseJSON,
	parseCSV,
	toCSV,
	formatDate,
	relativeTime,
	slugify,
	truncate,
	capitalize,
	titleCase,
	template,
} from './transform';

// ============================================================================
// VECTORIZE SDK (Semantic Search & RAG)
// ============================================================================

export type { VectorMetadata, VectorSearchOptions, VectorMatch } from './vectorize';
export { Vectorize, createVectorClient } from './vectorize';

// ============================================================================
// AI SDK (Cloudflare Workers AI)
// ============================================================================

export type { AIModelOptions } from './workers-ai';
export { WorkersAI, AIModels, createAIClient } from './workers-ai';

// ============================================================================
// ACTION RESULT (Shared utilities)
// ============================================================================

export type { ActionCapabilities, StandardData } from './action-result';
export {
	ActionResult,
	createActionResult,
	isActionResult,
	unwrapResult,
	// DX helpers for error handling
	getErrorMessage,
	getErrorCode,
	hasErrorCode,
	isFailure,
	isSuccess,
} from './action-result';

// ============================================================================
// ERROR HANDLING
// ============================================================================

export {
	IntegrationError,
	ErrorCode,
	ErrorCategory,
	createErrorFromResponse,
	isIntegrationError,
	toIntegrationError,
	type ErrorContext,
} from './integration-error';

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-export commonly used third-party types
export { z, type ZodSchema } from 'zod';
