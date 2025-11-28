/**
 * @workwayco/integrations
 *
 * Official WORKWAY integrations - concrete implementations of the SDK patterns.
 *
 * These integrations demonstrate:
 * - ActionResult narrow waist pattern
 * - IntegrationError error handling
 * - StandardData normalization
 * - OAuth token usage
 *
 * @example
 * ```typescript
 * import { Gmail } from '@workwayco/integrations/gmail';
 *
 * const gmail = new Gmail({ accessToken: tokens.gmail.access_token });
 * const emails = await gmail.listEmails({ maxResults: 10 });
 *
 * if (emails.success) {
 *   for (const email of emails.data) {
 *     console.log(email.payload.headers);
 *   }
 * }
 * ```
 */

// Re-export all integrations
export { Gmail } from './gmail/index.js';
export type {
	GmailConfig,
	GmailMessage,
	ListEmailsOptions,
	GetEmailOptions,
	SendEmailOptions,
} from './gmail/index.js';

// Future integrations (placeholders)
// export { Slack } from './slack/index.js';
// export { Notion } from './notion/index.js';
// export { WorkersAI } from './workers-ai/index.js';
