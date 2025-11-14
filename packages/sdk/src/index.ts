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
// TESTING SDK EXPORTS
// ============================================================================

export type {
	// Mock types
	MockOAuthConfig,
	MockContextOptions,
	MockFetchResponse,
} from './testing';

export {
	// Mock classes
	MockOAuthManager,
	MockStorage,
	// Mock creation helpers
	createMockContext,
	createMockFetch,
	createMockTokens,
	createExpiredTokens,
	// Test utilities
	waitFor,
	expectError,
	createTestWorkflow,
	createMockTrigger,
	setupIntegrationTests,
} from './testing';

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-export commonly used third-party types
export { z, type ZodSchema } from 'zod';
