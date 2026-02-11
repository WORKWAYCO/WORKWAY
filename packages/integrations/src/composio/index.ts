/**
 * Composio Integration Adapters
 *
 * Invisible plumbing: Composio-backed integrations that implement the same
 * BaseAPIClient + ActionResult contract as custom integrations.
 *
 * Use these for commodity CRUD operations where building a custom integration
 * doesn't earn its existence (Rams principle #10: as little design as possible).
 *
 * Deep integrations (QuickBooks, Notion substrate, scheduling) stay custom.
 *
 * @example
 * ```typescript
 * import { ComposioSlack, ComposioHubSpot, ComposioJira } from '@workwayco/integrations/composio';
 *
 * // Same ActionResult<T> contract as custom integrations
 * const slack = new ComposioSlack({ composioApiKey: env.COMPOSIO_API_KEY });
 * const result = await slack.sendMessage('#general', 'Hello');
 * console.log(result.success); // true
 * console.log(result.metadata.source.integration); // 'composio:slack'
 * ```
 */

// Core adapter
export { ComposioAdapter } from './adapter.js';
export type {
	ComposioAdapterConfig,
	ComposioAction,
	ComposioActionParam,
	ComposioExecutionResult,
	ComposioApp,
} from './adapter.js';

// Typed wrappers
export { ComposioSlack } from './slack.js';
export type {
	ComposioSlackConfig,
	ComposioSlackMessage,
	ComposioSlackChannel,
} from './slack.js';

export { ComposioHubSpot } from './hubspot.js';
export type {
	ComposioHubSpotConfig,
	ComposioHubSpotContact,
	ComposioHubSpotDeal,
} from './hubspot.js';

export { ComposioJira } from './jira.js';
export type {
	ComposioJiraConfig,
	ComposioJiraIssue,
	ComposioJiraProject,
	CreateJiraIssueOptions,
} from './jira.js';
