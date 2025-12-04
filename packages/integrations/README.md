# @workwayco/integrations

Official WORKWAY integrations - concrete implementations of the SDK patterns.

## Installation

```bash
pnpm add @workwayco/integrations
```

## Available Integrations

| Integration | Status | OAuth Required |
|-------------|--------|----------------|
| Gmail | Stable | Yes |
| Slack | Stable | Yes |
| Notion | Stable | Yes |
| Stripe | Stable | Yes |
| Google Sheets | Stable | Yes |
| Workers AI | Beta | No |

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

## License

Apache-2.0
