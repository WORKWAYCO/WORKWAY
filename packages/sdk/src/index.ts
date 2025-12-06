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
	// Extended context types (for workflow execute/hooks)
	IntegrationRequirement,
	ExtendedWorkflowContext,
	WorkflowErrorContext,
	// Marketplace types (legacy)
	WorkflowListing,
	WorkflowInstallation,
	WorkflowEarnings,
	// Pathway model types (Heideggerian discovery)
	OutcomeFrame,
	OutcomeStatement,
	DiscoveryMoment,
	WorkflowSuggestion,
	IntegrationPair,
	PathwayMetadata,
} from './workflow-sdk';

export {
	WorkflowRegistry,
	defineWorkflow,
	defineConfigField,
	// Workflow accessors (handle both patterns)
	getWorkflowId,
	getWorkflowName,
	getWorkflowDescription,
} from './workflow-sdk';

// ============================================================================
// DISCOVERY SERVICE (Pathway Model)
// ============================================================================

export type { DiscoveryContext } from './discovery-service';
export { DiscoveryService, createDiscoveryService } from './discovery-service';

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
	// New flexible option types
	WebhookOptions,
	ScheduleOptions,
} from './triggers';

export {
	webhook,
	schedule,
	cron, // Alias for schedule
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

export type {
	ActionCapabilities,
	StandardData,
	StandardList,
	StandardListItem,
	StandardMessage,
	StandardDocument,
	StandardTask,
	StandardEvent,
} from './action-result';
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
	BreakdownSeverity,
	createErrorFromResponse,
	isIntegrationError,
	toIntegrationError,
	getBreakdownSeverity,
	hasUnifiedErrorInterface,
	type ErrorContext,
} from './integration-error';

// ============================================================================
// BASE HTTP CLIENT (Unified HTTP Foundation)
// ============================================================================

export {
	BaseHTTPClient,
	AuthenticatedHTTPClient,
	createHTTPClient,
	createAuthenticatedHTTPClient,
	buildQueryString,
	type HTTPClientConfig,
	type AuthenticatedHTTPClientConfig,
	type RequestOptions,
	type RequestWithBodyOptions,
} from './base-http-client';

// ============================================================================
// RESPONSE UTILITIES (Weniger, aber besser)
// ============================================================================

export {
	buildStandardList,
	extractPaginationMetadata,
	extractRateLimitInfo,
	CommonCapabilities,
	safeGet,
	extractFirstString,
	toCamelCase,
	type StandardListOptions,
	type PaginationMetadata,
	type RateLimitInfo,
} from './response-utils';

// ============================================================================
// DATE UTILITIES
// ============================================================================

export {
	parseDurationMs,
	parseSinceToUnixSeconds,
	parseSinceToDate,
	formatDateYMD,
	formatDateISO,
	formatDateUnix,
	getRelativeDate,
	createDateRange,
	getUserTimezone,
	getTimezoneOffset,
	formatLocalDate,
	isValidDuration,
	isValidDate,
	type DurationUnit,
} from './date-utils';

// ============================================================================
// TEMPLATE REGISTRY (Marketplace Templates)
// ============================================================================

export type { MarketplaceTemplate, TemplateCategoryId, OutcomeFrameId } from './template-registry';

export {
	// Heideggerian pathway model (preferred)
	OUTCOME_FRAMES,
	// Legacy categories (deprecated)
	TEMPLATE_CATEGORIES,
	SEED_TEMPLATES,
	TemplateRegistry,
	templateRegistry,
} from './template-registry';

// ============================================================================
// D1 HELPERS (Drizzle + D1 Utilities)
// ============================================================================

export {
	jsonField,
	parseJsonField,
	isJsonObject,
	safeJsonStringify,
	D1SchemaChecker,
	createSchemaChecker,
	type TableColumnInfo,
	type SchemaDiff,
} from './d1-helpers';

// ============================================================================
// CONFIG UTILITIES (Installation Configuration)
// ============================================================================

export {
	parseConfig,
	getByPath,
	getConfigValue,
	extractResourceId,
	extractResourceName,
	extractResourceSelection,
	isStepConfigured,
	getConfiguredSteps,
	mergeConfigs,
	ConfigBuilder,
	createConfigBuilder,
	type ResourceSelection,
} from './config-utils';

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-export commonly used third-party types
export { z, type ZodSchema } from 'zod';
