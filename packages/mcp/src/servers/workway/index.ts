/**
 * WORKWAY Server APIs
 *
 * Tools for interacting with WORKWAY:
 * - Webhooks: Trigger test events (Sentry, Stripe, GitHub, etc.)
 * - Workflows: List and inspect workflow configurations
 * - OAuth: Check OAuth provider status
 *
 * @example
 * ```typescript
 * import * as workway from './servers/workway';
 *
 * // Send test webhook
 * const result = await workway.webhooks.sentry({
 *   action: 'created',
 *   issue: { id: 'test', title: 'Test Error', level: 'error' }
 * });
 *
 * // List workflows
 * const zoom = workway.workflows.list({ filter: 'zoom' });
 *
 * // Check OAuth providers
 * const providers = workway.oauth.providers();
 * ```
 */

export * as webhooks from './webhooks.js';
export * as workflows from './workflows.js';
export * as oauth from './oauth.js';
