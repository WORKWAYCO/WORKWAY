# Payments Tracked - Agent Understanding

> This file enables AI agents to understand and modify this workflow.

## Purpose

Automatic payment tracking from Stripe to Notion. Webhook-triggered to:
1. Receive Stripe payment/refund webhooks
2. Extract payment details and customer info
3. Check for duplicates (idempotency)
4. Create Notion database entry with full context

## Outcome Frame

**"Payments that track themselves"**

- Real-time webhook trigger (no polling)
- Full customer details (name, email)
- Refund tracking (optional)

## Workflow Phases

```
┌─────────────────┐
│  1. WEBHOOK     │ Stripe: payment_intent.succeeded OR charge.refunded
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. EXTRACT     │ Amount, currency, customer ID from event
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. CUSTOMER    │ Fetch customer details from Stripe API
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. IDEMPOTENCY │ Query Notion for existing payment (by Payment ID)
└────────┬────────┘
         │
    ┌────┴────┐
    │ EXISTS? │
    └────┬────┘
    YES  │   NO
    ▼    │    ▼
┌───────┐│┌──────────┐
│ SKIP  ││ │ CREATE   │
│       ││ │ PAGE     │
└───────┘│ └────┬─────┘
         │      │
         └──────┴──────┐
                       ▼
                 ┌──────────┐
                 │ RETURN   │
                 └──────────┘
```

## Key Integration Points

### Stripe Webhook

```
Events:
- payment_intent.succeeded  # Successful payment
- charge.refunded           # Refund processed

Scopes: read_payments, webhooks
```

### Stripe Customer API

```
Endpoint: GET /v1/customers/:customerId

Used to enrich payment with:
- Customer email
- Customer name
```

### Notion API

```
Scopes: write_pages, read_databases

Operations:
- Query database (idempotency check by Payment ID)
- Create page with payment properties
```

## Configuration

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `notion_database_id` | text | Yes | Database for payment logs |
| `include_refunds` | boolean | No | Track refunds (default: true) |
| `currency_format` | select | No | `symbol`, `code`, or `both` |

## Notion Page Schema

```typescript
interface PaymentNotionPage {
  properties: {
    Name: { title: string };           // "💰 Payment: $99.00" or "🔄 Refund: $99.00"
    Amount: { number: number };        // Positive for payments, negative for refunds
    Currency: { select: string };      // "USD", "EUR", etc.
    Status: { select: string };        // "Completed" or "Refunded"
    Customer: { email: string };       // Customer email
    'Customer Name': { rich_text: string };
    'Payment ID': { rich_text: string }; // Stripe payment ID (for idempotency)
    Date: { date: string };            // Payment timestamp
    Source: { select: string };        // "Stripe"
  };
}
```

## Currency Formatting

Supports multiple display formats:

| Format | Example |
|--------|---------|
| `symbol` | $99.00 |
| `code` | 99.00 USD |
| `both` | $99.00 USD |

Supported currency symbols: USD ($), EUR (€), GBP (£), JPY (¥)
Others fallback to currency code.

## Idempotency

**Critical for webhook reliability.** Stripe may retry webhook delivery.

The workflow:
1. Queries Notion for existing page with matching `Payment ID`
2. If found, returns early with `skipped: true`
3. If not found, creates new page

This prevents duplicate entries when:
- Stripe retries failed webhook delivery
- Network issues cause duplicate events
- Workflow is re-triggered manually

## Error Handling

- **Customer fetch fails**: Uses "Unknown" for name/email
- **Notion create fails**: Throws error (webhook will retry)
- **Refund with refunds disabled**: Returns `skipped: true`
- **Duplicate payment**: Returns `skipped: true` with existing page ID

## Modification Guidelines

When modifying this workflow:

1. **Add fields**: Update `properties` object in `integrations.notion.pages.create()`
2. **New webhooks**: Add events to `trigger.events` array
3. **Currency support**: Add symbol to `currencySymbols` map
4. **Additional APIs**: Fetch invoice, subscription, or product data from Stripe
5. **Notifications**: Add Slack integration for payment alerts

## Dependencies

- `@workwayco/sdk`: Workflow definition, webhook triggers
- Stripe OAuth: Payment and customer data
- Notion OAuth: Page creation

## Testing

Manual test:
1. Connect Stripe and Notion OAuth
2. Configure Notion database with required properties
3. Create test payment in Stripe (use test mode)
4. Verify Notion page created with correct data

Webhook test:
1. Use Stripe CLI: `stripe trigger payment_intent.succeeded`
2. Verify workflow execution in WORKWAY dashboard
3. Confirm Notion page created

Idempotency test:
1. Trigger same webhook twice
2. Verify only one Notion page exists
3. Check second execution returns `skipped: true`

## Related Files

- `Cloudflare/UNDERSTANDING.md` - Complete workflow map
- `packages/integrations/src/stripe/` - Stripe integration client
- `packages/integrations/src/notion/` - Notion integration client
- `revenue-radar/` - Related workflow (Stripe → Slack alerts)
