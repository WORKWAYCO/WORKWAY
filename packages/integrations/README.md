# @workwayco/integrations

[![npm version](https://img.shields.io/npm/v/@workwayco/integrations.svg)](https://www.npmjs.com/package/@workwayco/integrations)
[![License](https://img.shields.io/npm/l/@workwayco/integrations.svg)](https://github.com/workwayco/workway/blob/main/LICENSE)

Official WORKWAY integrations - concrete implementations built on `BaseAPIClient`.

> **Zuhandenheit**: The tool recedes; the outcome remains.

## Installation

```bash
npm install @workwayco/integrations
```

## Available Integrations (21+)

| Category | Integrations |
|----------|--------------|
| **Productivity** | Notion, Airtable, Google Sheets, Todoist, Linear |
| **Communication** | Slack, Discord |
| **CRM & Sales** | HubSpot, Follow Up Boss |
| **Payments** | Stripe, QuickBooks |
| **Scheduling** | Zoom, Calendly |
| **Developer** | GitHub |
| **Forms** | Typeform |
| **Design** | Dribbble |
| **Documents** | DocuSign |
| **Video** | YouTube |
| **Healthcare** | NexHealth, Weave, Sikka |
| **Construction** | Procore |

### Import Paths

```typescript
import { Slack } from '@workwayco/integrations/slack';
import { Notion } from '@workwayco/integrations/notion';
import { Stripe } from '@workwayco/integrations/stripe';
import { GitHub } from '@workwayco/integrations/github';
// ... etc
```

## Usage

### Gmail

```typescript
import { Gmail } from '@workwayco/integrations/gmail';

const gmail = new Gmail({ accessToken: tokens.access_token });

// List emails
const emails = await gmail.listEmails({ maxResults: 10 });
if (emails.success) {
  for (const email of emails.data) {
    console.log(email.snippet);
  }
}

// Send email
const sent = await gmail.sendEmail({
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Message content',
});
```

### Notion

```typescript
import { Notion } from '@workwayco/integrations/notion';

const notion = new Notion({ accessToken: tokens.access_token });

// Search pages
const results = await notion.search({ query: 'Project' });

// Create page in database
const page = await notion.createPage({
  parent: { database_id: 'abc123' },
  properties: {
    Name: { title: [{ text: { content: 'New Task' } }] },
    Status: { select: { name: 'In Progress' } },
  },
});
```

### Slack

```typescript
import { Slack } from '@workwayco/integrations/slack';

const slack = new Slack({ accessToken: tokens.access_token });

// Send message
await slack.sendMessage({
  channel: '#general',
  text: 'Hello from WORKWAY!',
});

// List channels
const channels = await slack.listChannels({ limit: 100 });
```

### Stripe

```typescript
import { Stripe } from '@workwayco/integrations/stripe';

const stripe = new Stripe({ apiKey: process.env.STRIPE_SECRET_KEY });

// List payments
const payments = await stripe.listPayments({ limit: 10 });

// Create customer
const customer = await stripe.createCustomer({
  email: 'user@example.com',
  name: 'John Doe',
});
```

### Google Sheets

```typescript
import { GoogleSheets } from '@workwayco/integrations/google-sheets';

const sheets = new GoogleSheets({ accessToken: tokens.access_token });

// Read values
const values = await sheets.getValues({
  spreadsheetId: 'abc123',
  range: 'Sheet1!A1:D10',
});

// Append row
await sheets.appendValues({
  spreadsheetId: 'abc123',
  range: 'Sheet1!A:D',
  values: [['New', 'Row', 'Data', 'Here']],
});
```

## ActionResult Pattern

All integrations return `ActionResult<T>` for consistent error handling:

```typescript
const result = await gmail.listEmails({ maxResults: 10 });

if (result.success) {
  // TypeScript knows result.data exists
  console.log(result.data);
} else {
  // Handle error
  console.error(result.error.code, result.error.message);
}
```

## Development

### Running Tests

```bash
pnpm test
```

### Building

```bash
pnpm build
```

## Building Custom Integrations

All integrations extend `BaseAPIClient` from `@workwayco/sdk`:

```typescript
import { BaseAPIClient } from '@workwayco/integrations';

export class MyService extends BaseAPIClient {
  constructor(config: { accessToken: string }) {
    super({
      accessToken: config.accessToken,
      apiUrl: 'https://api.myservice.com/v1',
      errorContext: { integration: 'myservice' },
    });
  }

  async getItems(): Promise<ActionResult<Item[]>> {
    return this.getJson('/items');
  }

  async createItem(data: CreateItemInput): Promise<ActionResult<Item>> {
    return this.postJson('/items', data);
  }
}
```

This gives you:
- Automatic token refresh
- Consistent error handling
- Rate limiting
- Timeout management
- Type-safe responses

## Links

- **SDK**: [@workwayco/sdk](https://www.npmjs.com/package/@workwayco/sdk)
- **Platform**: [workway.co](https://workway.co)
- **GitHub**: [github.com/workwayco/workway](https://github.com/workwayco/workway)

## License

Apache-2.0
