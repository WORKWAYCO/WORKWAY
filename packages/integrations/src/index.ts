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
 * import { Slack } from '@workwayco/integrations/slack';
 *
 * const slack = new Slack({ accessToken: tokens.slack.access_token });
 * const channels = await slack.listChannels({ limit: 10 });
 *
 * if (channels.success) {
 *   for (const channel of channels.data) {
 *     console.log(channel.name);
 *   }
 * }
 * ```
 */

// Re-export all integrations
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

export { Linear, toStandardTask } from './linear/index.js';
export type {
	LinearConfig,
	LinearIssue,
	LinearTeam,
	LinearUser,
	LinearProject,
	LinearComment,
} from './linear/index.js';

export { Airtable } from './airtable/index.js';
export type {
	AirtableConfig,
	AirtableRecord,
	AirtableTable,
	AirtableField,
	ListRecordsOptions,
	CreateRecordOptions,
	UpdateRecordOptions,
} from './airtable/index.js';

export { Zoom } from './zoom/index.js';
export type {
	ZoomConfig,
	ZoomMeeting,
	ZoomRecording,
	ZoomRecordingFile,
	ZoomClip,
	TranscriptResult,
	MeetingsResponse,
	ClipsResponse,
	GetMeetingsOptions,
	GetMeetingOptions,
	GetRecordingsOptions,
	GetTranscriptOptions,
	GetClipsOptions,
	GetClipTranscriptOptions,
} from './zoom/index.js';

export { HubSpot } from './hubspot/index.js';
export type {
	HubSpotConfig,
	HubSpotContact,
	HubSpotCompany,
	HubSpotDeal,
	HubSpotEngagement,
	SearchOptions as HubSpotSearchOptions,
	UpdateDealOptions,
	UpdateDealFromMeetingOptions,
	LogMeetingActivityOptions,
} from './hubspot/index.js';

export { Typeform } from './typeform/index.js';
export type {
	TypeformConfig,
	TypeformForm,
	TypeformField,
	TypeformFieldType,
	TypeformResponse,
	TypeformAnswer,
	TypeformAnswerType,
	TypeformWebhook,
	TypeformWebhookEvent,
	TypeformWorkspace,
	TypeformResponsesResult,
	ListFormsOptions,
	GetResponsesOptions,
	CreateWebhookOptions,
} from './typeform/index.js';

export { Calendly } from './calendly/index.js';
export type {
	CalendlyConfig,
	CalendlyUser,
	CalendlyEventType,
	CalendlyScheduledEvent,
	CalendlyInvitee,
	CalendlyWebhook,
	CalendlyWebhookEvent,
	CalendlyAvailableTime,
	ListEventTypesOptions,
	ListScheduledEventsOptions,
	ListInviteesOptions,
	GetAvailableTimesOptions,
	CreateWebhookOptions as CalendlyCreateWebhookOptions,
} from './calendly/index.js';

export { Todoist } from './todoist/index.js';
export type {
	TodoistConfig,
	TodoistTask,
	TodoistProject,
	TodoistSection,
	TodoistLabel,
	TodoistComment,
	TodoistDue,
	TodoistCompletedTask,
	CompletedTasksResponse,
	CreateTaskOptions,
	UpdateTaskOptions,
	ListTasksOptions,
	GetCompletedTasksOptions,
	CreateProjectOptions,
	UpdateProjectOptions,
	CreateSectionOptions,
	CreateLabelOptions,
	UpdateLabelOptions,
	CreateCommentOptions,
} from './todoist/index.js';

export { Dribbble } from './dribbble/index.js';
export type {
	DribbbleConfig,
	DribbbleUser,
	DribbbleShot,
	DribbbleTeam,
	DribbbleProject,
	DribbbleImages,
	DribbbleAttachment,
	DribbbleVideo,
	DribbbleLinks,
	CreateShotData,
	UpdateShotData,
	ListShotsOptions,
} from './dribbble/index.js';

// Future integrations
// export { WorkersAI } from './workers-ai/index.js';
