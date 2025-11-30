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

export { Slack } from './slack/index.js';
export type {
	SlackConfig,
	SlackChannel,
	SlackMessage,
	SlackUser,
	ListChannelsOptions,
	GetMessagesOptions,
	SendMessageOptions,
	GetUserOptions,
} from './slack/index.js';

export { Notion } from './notion/index.js';
export type {
	NotionConfig,
	NotionPage,
	NotionDatabase,
	NotionBlock,
	NotionProperty,
	NotionRichText,
	SearchOptions,
	GetPageOptions,
	CreatePageOptions,
	UpdatePageOptions,
	QueryDatabaseOptions,
	GetBlockChildrenOptions,
} from './notion/index.js';

export { Stripe } from './stripe/index.js';
export type {
	StripeConfig,
	StripePaymentIntent,
	StripeCustomer,
	StripeSubscription,
	StripeCharge,
	StripeWebhookEvent,
	StripeList,
	CreatePaymentIntentOptions,
	ListPaymentsOptions,
	CreateCustomerOptions,
	CreateSubscriptionOptions,
	ListSubscriptionsOptions,
} from './stripe/index.js';

export { GoogleSheets } from './google-sheets/index.js';
export type {
	GoogleSheetsConfig,
	Spreadsheet,
	Sheet,
	ValueRange,
	UpdateValuesResponse,
	AppendValuesResponse,
	BatchUpdateResponse,
	GetSpreadsheetOptions,
	GetValuesOptions,
	UpdateValuesOptions,
	AppendValuesOptions,
	ClearValuesOptions,
	CreateSpreadsheetOptions,
	BatchGetValuesOptions,
	AddSheetOptions,
} from './google-sheets/index.js';

// Future integrations
// export { WorkersAI } from './workers-ai/index.js';
