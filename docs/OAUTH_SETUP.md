# OAuth Provider Setup

This guide explains how to configure OAuth providers for WORKWAY integrations.

## Architecture Overview

WORKWAY uses a two-part OAuth architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CLI/Browser   │────▶│   WORKWAY API   │────▶│  Provider API   │
│                 │     │  (OAuth Proxy)  │     │ (Slack, Gmail)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │ Callback              │ Token Exchange
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Local Server   │     │  D1 Database    │
│  (port 3456)    │     │ oauth_credentials│
└─────────────────┘     └─────────────────┘
```

1. **Local Callback Server**: Receives OAuth redirects during `workway oauth connect`
2. **WORKWAY API**: Exchanges codes for tokens, stores encrypted credentials
3. **D1 Database**: Persists `oauth_credentials` per user/service

## Existing Infrastructure

The following is already built:

| Component | Location | Status |
|-----------|----------|--------|
| OAuth callback server | `cli/src/lib/oauth-flow.ts` | Ready |
| Token storage | `workway-production` D1 | Ready |
| CLI connect command | `cli/src/commands/oauth/connect.ts` | Ready |
| Token refresh | `sdk/src/integration-sdk.ts` OAuthManager | Ready |

## Provider Configuration

### Slack

1. **Create a Slack App**: https://api.slack.com/apps

2. **Configure OAuth**:
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/slack` (for production)

3. **Required Scopes** (Bot Token):
   ```
   channels:read
   channels:history
   chat:write
   users:read
   search:read
   ```

4. **Environment Variables** (in WORKWAY API Worker):
   ```toml
   [vars]
   SLACK_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put SLACK_CLIENT_SECRET)
   SLACK_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://slack.com/oauth/v2/authorize`
   - Token: `https://slack.com/api/oauth.v2.access`

### Gmail (Google)

1. **Create OAuth Credentials**: https://console.cloud.google.com/apis/credentials

2. **Configure OAuth**:
   - Application type: Web application
   - Redirect URI: `http://localhost:3456/callback` (for CLI)
   - Redirect URI: `https://api.workway.co/oauth/callback/gmail` (for production)

3. **Required Scopes**:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/gmail.modify
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   GMAIL_CLIENT_ID = "your-client-id.apps.googleusercontent.com"

   # In secrets
   GMAIL_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://accounts.google.com/o/oauth2/v2/auth`
   - Token: `https://oauth2.googleapis.com/token`

### Google Sheets

Uses the same Google OAuth as Gmail. You can request both scopes in a single OAuth flow.

1. **Create OAuth Credentials**: https://console.cloud.google.com/apis/credentials
   (Same credentials as Gmail if already configured)

2. **Enable the API**: https://console.cloud.google.com/apis/library/sheets.googleapis.com

3. **Configure OAuth**:
   - Application type: Web application
   - Redirect URI: `http://localhost:3456/callback` (for CLI)
   - Redirect URI: `https://api.workway.co/oauth/callback/google` (for production)

4. **Required Scopes**:
   ```
   https://www.googleapis.com/auth/spreadsheets
   https://www.googleapis.com/auth/spreadsheets.readonly
   https://www.googleapis.com/auth/drive.file
   ```

5. **Environment Variables**:
   ```toml
   [vars]
   GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com"

   # In secrets
   GOOGLE_CLIENT_SECRET = "your-client-secret"
   ```

6. **Usage in Workflows**:
   ```typescript
   import { GoogleSheets } from '@workwayco/integrations/google-sheets';

   const sheets = new GoogleSheets({ accessToken: tokens.google.access_token });

   // Read data
   const data = await sheets.getValues({
     spreadsheetId: 'abc123',
     range: 'Sheet1!A1:D10'
   });

   // Convert to objects (first row = headers)
   const rows = sheets.valuesToObjects(data.data.values);

   // Write AI results back
   await sheets.updateValues({
     spreadsheetId: 'abc123',
     range: 'Sheet1!E1',
     values: [['AI Analysis'], ['Result 1'], ['Result 2']]
   });

   // Append new rows
   await sheets.appendValues({
     spreadsheetId: 'abc123',
     range: 'Sheet1!A:D',
     values: [['New', 'Data', 'Row', new Date().toISOString()]]
   });
   ```

7. **Tip**: Use `valuesToObjects()` and `objectsToValues()` helpers for easy conversion between sheet data and JavaScript objects.

### Notion

1. **Create Integration**: https://www.notion.so/my-integrations

2. **Configure OAuth**:
   - Integration type: Public integration
   - Redirect URI: `http://localhost:3456/callback` (for CLI)
   - Redirect URI: `https://api.workway.co/oauth/callback/notion` (for production)

3. **Required Capabilities**:
   ```
   Read content
   Update content
   Insert content
   Read user information (optional)
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   NOTION_CLIENT_ID = "your-client-id"
   NOTION_REDIRECT_URI = "https://api.workway.co/oauth/callback/notion"

   # In secrets
   NOTION_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://api.notion.com/v1/oauth/authorize`
   - Token: `https://api.notion.com/v1/oauth/token`

### HubSpot

1. **Create a HubSpot App**: https://developers.hubspot.com/docs/api/creating-an-app

2. **Configure OAuth**:
   - App ID: `25481074`
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/hubspot` (for production)

3. **Required Scopes** (for Meeting Intelligence CRM features):
   ```
   crm.objects.contacts.read
   crm.objects.companies.read
   crm.objects.deals.read
   crm.objects.deals.write
   crm.schemas.deals.read
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   HUBSPOT_CLIENT_ID = "7c8aedcc-e363-4e0b-86cd-873e711f0172"
   HUBSPOT_APP_ID = "25481074"

   # In secrets (wrangler secret put HUBSPOT_CLIENT_SECRET)
   HUBSPOT_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://app.hubspot.com/oauth/authorize`
   - Token: `https://api.hubapi.com/oauth/v1/token`

6. **Usage in Workflows**:
   ```typescript
   import { HubSpot } from '@workwayco/integrations/hubspot';

   const hubspot = new HubSpot({ accessToken: tokens.hubspot.access_token });

   // Search for deals
   const deals = await hubspot.searchDeals({ query: 'Acme Corp' });

   // Update deal after meeting
   await hubspot.updateDealFromMeeting({
     dealId: '123',
     meetingTitle: 'Q4 Planning',
     summary: 'Discussed roadmap for next quarter',
     actionItems: [{ task: 'Send proposal', assignee: 'John' }],
     notionUrl: 'https://notion.so/meeting-notes'
   });

   // Log meeting activity
   await hubspot.logMeetingActivity({
     dealId: '123',
     meetingTitle: 'Demo Call',
     duration: 30,
     notes: 'Showed product features...',
     externalUrl: 'https://notion.so/meeting-notes'
   });
   ```

7. **Tip**: Use `updateDealFromMeeting()` for automatic note formatting and `logMeetingActivity()` to create engagement records visible in HubSpot timeline.

### Zoom

1. **Create a Zoom App**: https://marketplace.zoom.us/develop/create (OAuth App type)

2. **Configure OAuth**:
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/zoom` (for production)

3. **Required Scopes**:
   ```
   meeting:read
   recording:read
   clips:read
   user:read
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   ZOOM_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put ZOOM_CLIENT_SECRET)
   ZOOM_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://zoom.us/oauth/authorize`
   - Token: `https://zoom.us/oauth/token`

6. **Usage in Workflows**:
   ```typescript
   import { Zoom } from '@workwayco/integrations/zoom';

   const zoom = new Zoom({ accessToken: tokens.zoom.access_token });

   // Get recent meetings with transcripts
   const meetings = await zoom.getMeetingsWithTranscripts({
     days: 7,
     preferSpeakerAttribution: true
   });

   // Get a single meeting's recording
   const recording = await zoom.getRecordings({ meetingId: '123456789' });

   // Get transcript with speaker attribution fallback
   const transcript = await zoom.getTranscript({
     meetingId: '123456789',
     fallbackToBrowser: true,
     shareUrl: recording.data?.share_url
   });

   // Get Zoom Clips
   const clips = await zoom.getClips({ days: 30 });
   ```

7. **Transcript Options**:
   - `fallbackToBrowser: false` - OAuth API only (fast, may lack speaker names)
   - `fallbackToBrowser: true` - Falls back to browser scraper for speaker attribution

8. **Browser Scraper for Speaker Attribution**:

   The WORKWAY Zoom Scraper is deployed at: `https://zoom-scraper.half-dozen.workers.dev`

   To enable speaker-attributed transcripts:

   a. Visit `https://zoom-scraper.half-dozen.workers.dev/sync`
   b. Drag the "Sync Cookies" bookmarklet to your bookmarks bar
   c. Log into Zoom (us06web.zoom.us)
   d. Click the bookmark to sync your session cookies (expires 24h)

   Then configure your Zoom integration:
   ```typescript
   const zoom = new Zoom({
     accessToken: tokens.zoom.access_token,
     browserScraperUrl: 'https://zoom-scraper.half-dozen.workers.dev'
   });
   ```

### Typeform

1. **Create a Typeform App**: https://admin.typeform.com/account#/section/tokens (Developer Apps)

2. **Configure OAuth**:
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/typeform/callback` (for production)

3. **Required Scopes**:
   ```
   accounts:read
   forms:read
   responses:read
   webhooks:read
   webhooks:write
   workspaces:read
   offline
   ```
   Note: `offline` scope is required to receive refresh tokens.

4. **Environment Variables**:
   ```toml
   [vars]
   TYPEFORM_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put TYPEFORM_CLIENT_SECRET)
   TYPEFORM_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://api.typeform.com/oauth/authorize`
   - Token: `https://api.typeform.com/oauth/token`

6. **Usage in Workflows**:
   ```typescript
   import { Typeform } from '@workwayco/integrations/typeform';

   const typeform = new Typeform({ accessToken: tokens.typeform.access_token });

   // List forms
   const forms = await typeform.listForms();

   // Get responses
   const responses = await typeform.getResponses({
     formId: 'abc123',
     since: '2024-01-01T00:00:00Z',
   });

   // Extract answers as key-value object
   if (responses.success) {
     for (const item of responses.data.items) {
       const data = Typeform.extractAnswers(item);
       console.log(data.email, data.name, data._score);
     }
   }

   // Create webhook for real-time responses
   await typeform.createWebhook({
     formId: 'abc123',
     tag: 'workway-integration',
     url: 'https://api.workway.co/webhooks/typeform',
     secret: 'your-webhook-secret',
   });
   ```

7. **Webhook Verification**:
   ```typescript
   // In webhook handler
   const event = await typeform.verifyWebhook(
     rawBody,
     request.headers.get('Typeform-Signature'),
     env.TYPEFORM_WEBHOOK_SECRET
   );

   if (event.success) {
     const submission = Typeform.extractAnswers(event.data.form_response);
     // → Route to Notion, Slack, HubSpot, etc.
   }
   ```

8. **EU Data Center**: If your Typeform account uses the EU data center, configure:
   ```typescript
   const typeform = new Typeform({
     accessToken: tokens.typeform.access_token,
     apiUrl: 'https://api.eu.typeform.com',
   });
   ```

---

### Stripe (API Key Authentication)

Stripe uses API keys instead of OAuth. This is simpler but requires secure key management.

1. **Get API Keys**: https://dashboard.stripe.com/apikeys

2. **Key Types**:
   - **Secret Key** (`sk_live_xxx` or `sk_test_xxx`): Server-side only, never expose
   - **Publishable Key** (`pk_live_xxx` or `pk_test_xxx`): Client-side, for Stripe.js

3. **Required for WORKWAY**:
   - Secret Key (for server-side API calls)
   - Webhook Signing Secret (for verifying webhook events)

4. **Environment Variables**:
   ```toml
   # In secrets (wrangler secret put)
   STRIPE_SECRET_KEY = "sk_live_xxx"
   STRIPE_WEBHOOK_SECRET = "whsec_xxx"
   ```

5. **Webhook Setup** (for triggers):
   - Endpoint URL: `https://api.workway.co/webhooks/stripe`
   - Events to subscribe:
     ```
     payment_intent.succeeded
     payment_intent.payment_failed
     customer.created
     customer.subscription.created
     customer.subscription.updated
     customer.subscription.deleted
     invoice.paid
     invoice.payment_failed
     ```

6. **Usage in Workflows**:
   ```typescript
   import { Stripe } from '@workwayco/integrations/stripe';

   const stripe = new Stripe({ secretKey: env.STRIPE_SECRET_KEY });

   // Create a payment
   const payment = await stripe.createPaymentIntent({
     amount: 2000, // $20.00 in cents
     currency: 'usd',
     customer: 'cus_xxx'
   });

   // Create a subscription
   const subscription = await stripe.createSubscription({
     customer: 'cus_xxx',
     priceId: 'price_xxx'
   });

   // Parse webhook event
   const event = await stripe.parseWebhookEvent(
     payload,
     signature,
     env.STRIPE_WEBHOOK_SECRET
   );
   ```

7. **Testing**:
   - Use test keys (`sk_test_xxx`) during development
   - Use Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:8787/webhooks/stripe`

---

### Airtable

1. **Create an Airtable OAuth Integration**: https://airtable.com/create/oauth

2. **Configure OAuth**:
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/airtable` (for production)

3. **Required Scopes**:
   ```
   data.records:read
   data.records:write
   schema.bases:read
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   AIRTABLE_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put AIRTABLE_CLIENT_SECRET)
   AIRTABLE_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://airtable.com/oauth2/v1/authorize`
   - Token: `https://airtable.com/oauth2/v1/token`

6. **Note**: Airtable requires PKCE for OAuth. The SDK handles this automatically.

---

### Calendly

1. **Create a Calendly App**: https://developer.calendly.com/

2. **Configure OAuth**:
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/calendly` (for production)

3. **Required Scopes**:
   ```
   default
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   CALENDLY_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put CALENDLY_CLIENT_SECRET)
   CALENDLY_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://auth.calendly.com/oauth/authorize`
   - Token: `https://auth.calendly.com/oauth/token`

---

### Todoist

1. **Create a Todoist App**: https://developer.todoist.com/appconsole.html

2. **Configure OAuth**:
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/todoist` (for production)

3. **Required Scopes**:
   ```
   data:read_write
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   TODOIST_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put TODOIST_CLIENT_SECRET)
   TODOIST_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://todoist.com/oauth/authorize`
   - Token: `https://todoist.com/oauth/access_token`

---

### Linear

1. **Create a Linear OAuth App**: https://linear.app/settings/api (OAuth Applications)

2. **Configure OAuth**:
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/linear` (for production)

3. **Required Scopes**:
   ```
   read
   write
   issues:create
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   LINEAR_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put LINEAR_CLIENT_SECRET)
   LINEAR_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://linear.app/oauth/authorize`
   - Token: `https://api.linear.app/oauth/token`

---

### Discord

1. **Create a Discord Application**: https://discord.com/developers/applications

2. **Configure OAuth2**:
   - Add Bot to your application
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/discord` (for production)

3. **Required Scopes** (Bot):
   ```
   bot
   guilds
   messages.read
   ```

4. **Required Bot Permissions**:
   ```
   Send Messages
   Read Message History
   Add Reactions
   ```

5. **Environment Variables**:
   ```toml
   [vars]
   DISCORD_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put DISCORD_CLIENT_SECRET)
   DISCORD_CLIENT_SECRET = "your-client-secret"
   DISCORD_BOT_TOKEN = "your-bot-token"
   ```

6. **OAuth URLs**:
   - Authorize: `https://discord.com/api/oauth2/authorize`
   - Token: `https://discord.com/api/oauth2/token`

---

### GitHub

1. **Create a GitHub OAuth App**: https://github.com/settings/developers (OAuth Apps)

2. **Configure OAuth**:
   - Authorization callback URL: `http://localhost:3456/callback` (for CLI)
   - Authorization callback URL: `https://api.workway.co/oauth/callback/github` (for production)

3. **Required Scopes**:
   ```
   repo
   read:user
   read:org
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   GITHUB_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put GITHUB_CLIENT_SECRET)
   GITHUB_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://github.com/login/oauth/authorize`
   - Token: `https://github.com/login/oauth/access_token`

6. **Note**: GitHub returns tokens as form-urlencoded by default. Set `Accept: application/json` header for JSON response.

---

### Dribbble

1. **Create a Dribbble Application**: https://dribbble.com/account/applications/new

2. **Configure OAuth**:
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/dribbble` (for production)

3. **Required Scopes**:
   ```
   public
   upload
   ```

4. **Environment Variables**:
   ```toml
   [vars]
   DRIBBBLE_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put DRIBBBLE_CLIENT_SECRET)
   DRIBBBLE_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://dribbble.com/oauth/authorize`
   - Token: `https://dribbble.com/oauth/token`

---

### Procore (Construction Management)

1. **Create a Procore App**: https://developers.procore.com/documentation/building-apps-create-new-app

2. **Configure OAuth**:
   - Authorization Code Grant (for user-level access)
   - Redirect URL: `http://localhost:3456/callback` (for CLI)
   - Redirect URL: `https://api.workway.co/oauth/callback/procore` (for production)

3. **Required Scopes** (configured via Marketplace App Manifest):
   - Procore uses tool-level permissions in the app manifest rather than OAuth scopes
   - Required tools:
     ```
     Project Directory (read)
     RFIs (read)
     Submittals (read)
     Daily Logs (read)
     Budget (read)
     Change Orders (read)
     Drawings (read)
     ```

4. **Environment Variables**:
   ```toml
   [vars]
   PROCORE_CLIENT_ID = "your-client-id"

   # In secrets (wrangler secret put PROCORE_CLIENT_SECRET)
   PROCORE_CLIENT_SECRET = "your-client-secret"
   ```

5. **OAuth URLs**:
   - Authorize: `https://login.procore.com/oauth/authorize`
   - Token: `https://login.procore.com/oauth/token`

6. **Sandbox Environments**:
   - Development Sandbox: `https://sandbox.procore.com`
   - Monthly Sandbox: `https://sandbox-monthly.procore.com`
   - Production: `https://api.procore.com`

7. **Usage in Workflows**:
   ```typescript
   import { Procore } from '@workwayco/integrations/procore';

   const procore = new Procore({
     accessToken: tokens.procore.access_token,
     companyId: '12345',
   });

   // Get open RFIs
   const rfis = await procore.getOpenRFIs('project_123');

   // Get daily logs
   const logs = await procore.getDailyLogs({
     projectId: 'project_123',
     date: new Date(),
   });

   // Get project budget
   const budget = await procore.getBudget('project_123');
   ```

8. **App Listing**: After development, submit your app for listing in the Procore Marketplace at https://marketplace.procore.com

---

### Sentry (Webhook-based)

> **⚠️ App Review Required**: Sentry OAuth apps require review before public use.
> Currently using **webhook-only** integration (no OAuth required).
> See: https://sentry.io/settings/developer-settings/

Sentry integration uses webhooks rather than OAuth for most use cases.

1. **Create Internal Integration**: https://sentry.io/settings/{org}/developer-settings/

2. **Configure Webhooks**:
   - Webhook URL: `https://api.workway.co/webhooks/sentry`
   - Events to subscribe:
     ```
     issue (created, resolved, assigned, ignored)
     error (created)
     comment (created)
     ```

3. **Environment Variables**:
   ```toml
   # In secrets (wrangler secret put)
   SENTRY_WEBHOOK_SECRET = "your-webhook-secret"
   SENTRY_DSN = "your-sentry-dsn"  # For WORKWAY's own error tracking
   ```

4. **Usage in Workflows**:
   ```typescript
   // Webhook handler receives Sentry events
   // No client instantiation needed - events come via webhook

   // Example webhook payload:
   {
     action: 'created',
     data: {
       issue: {
         id: '123',
         title: 'TypeError: Cannot read property...',
         culprit: 'app/api/users.ts',
         level: 'error',
         firstSeen: '2024-01-01T00:00:00Z',
         permalink: 'https://sentry.io/issues/123/'
       }
     }
   }
   ```

5. **Future OAuth Support**: When Sentry app is approved for public use, OAuth scopes will include:
   ```
   project:read
   event:read
   org:read
   ```

---

## Adding a New Provider

1. **Add provider config** to API Worker environment
2. **Implement OAuth endpoints** in API Worker
3. **Create integration class** in `@workwayco/integrations`
4. **Document scopes** in this file

### Provider Config Template

```typescript
// In workway-api Worker
const OAUTH_PROVIDERS = {
  slack: {
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['channels:read', 'chat:write'],
  },
  gmail: {
    clientId: env.GMAIL_CLIENT_ID,
    clientSecret: env.GMAIL_CLIENT_SECRET,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['gmail.readonly', 'gmail.send'],
  },
  notion: {
    clientId: env.NOTION_CLIENT_ID,
    clientSecret: env.NOTION_CLIENT_SECRET,
    authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: ['read_content', 'update_content'],
  },
  hubspot: {
    clientId: env.HUBSPOT_CLIENT_ID,
    clientSecret: env.HUBSPOT_CLIENT_SECRET,
    authorizeUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read', 'crm.objects.deals.write'],
  },
  zoom: {
    clientId: env.ZOOM_CLIENT_ID,
    clientSecret: env.ZOOM_CLIENT_SECRET,
    authorizeUrl: 'https://zoom.us/oauth/authorize',
    tokenUrl: 'https://zoom.us/oauth/token',
    scopes: ['meeting:read', 'recording:read', 'clips:read'],
  },
  typeform: {
    clientId: env.TYPEFORM_CLIENT_ID,
    clientSecret: env.TYPEFORM_CLIENT_SECRET,
    authorizeUrl: 'https://api.typeform.com/oauth/authorize',
    tokenUrl: 'https://api.typeform.com/oauth/token',
    scopes: ['accounts:read', 'forms:read', 'responses:read', 'webhooks:read', 'webhooks:write', 'workspaces:read', 'offline'],
  },
  procore: {
    clientId: env.PROCORE_CLIENT_ID,
    clientSecret: env.PROCORE_CLIENT_SECRET,
    authorizeUrl: 'https://login.procore.com/oauth/authorize',
    tokenUrl: 'https://login.procore.com/oauth/token',
    scopes: [], // Procore uses tool-level permissions in app manifest
  },
};
```

## CLI Usage

Connect an integration:

```bash
# Meetings & Scheduling
workway oauth connect zoom
workway oauth connect calendly

# Productivity
workway oauth connect notion
workway oauth connect airtable
workway oauth connect todoist
workway oauth connect linear

# Communication
workway oauth connect slack
workway oauth connect discord

# Google
workway oauth connect google-sheets
workway oauth connect google-calendar
workway oauth connect google-drive

# Developer
workway oauth connect github

# Forms
workway oauth connect typeform

# CRM & Sales
workway oauth connect hubspot

# Design
workway oauth connect dribbble

# Construction
workway oauth connect procore

# List connected integrations
workway oauth list

# Disconnect
workway oauth disconnect slack
```

## Testing OAuth Locally

1. Set up a test Slack app with redirect to `http://localhost:3456/callback`
2. Run the connect command:
   ```bash
   workway oauth connect slack
   ```
3. Browser opens, authorize the app
4. Callback server receives the code
5. Token stored in local config (dev mode) or D1 (production)

## Security Notes

- **Never commit secrets** to version control
- Use `wrangler secret put` for production secrets
- Tokens are encrypted at rest in D1
- Refresh tokens are rotated automatically
- Access tokens expire after 1 hour (typically)

## Troubleshooting

### "Port 3456 already in use"
Another process is using the callback port. Close other terminals or use:
```bash
lsof -i :3456
kill -9 <PID>
```

### "Invalid redirect_uri"
Ensure the redirect URI in your OAuth app matches exactly:
- CLI: `http://localhost:3456/callback`
- Production: `https://api.workway.co/oauth/callback/{provider}`

### "Scope error"
Update your OAuth app with the required scopes listed above.
