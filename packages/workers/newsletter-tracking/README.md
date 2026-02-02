# Newsletter Tracking Worker

Cross-property click tracking for WORKWAY newsletter campaigns, enabling user journey analytics between WORKWAY and CREATE SOMETHING properties.

## Overview

This worker handles:

- **Click Tracking**: Wraps newsletter links to capture clicks before redirecting
- **Open Tracking**: 1x1 pixel for email open detection
- **Identity Resolution**: Uses secure tokens for deterministic user identification
- **Cross-Property Analytics**: Tracks when users navigate from newsletter to any property

## Properties Tracked

| Domain | Property ID |
|--------|-------------|
| workway.co | `workway` |
| learn.createsomething.space | `createsomething` |
| createsomething.* | `createsomething` |
| Other domains | `external` |

## Endpoints

### Click Tracking
```
GET /click?t={token}&l={linkId}&d={destination}
GET /c?t={token}&l={linkId}&d={destination}
```

Logs click event, appends UTM parameters, redirects to destination.

### Open Tracking
```
GET /open?t={token}
GET /o?t={token}
```

Returns 1x1 transparent GIF, logs open event.

### Token Creation (Internal)
```
POST /api/token
Authorization: Bearer {internal-key}

{
  "subscriberId": "nsub_xxx",
  "email": "user@example.com",
  "issueId": "niss_xxx",
  "issueSlug": "january-2026-newsletter"
}
```

Creates secure tracking token for a subscriber/issue pair.

### Stats Query
```
GET /api/stats?issue_id={issueId}
```

Returns click counts by property and link.

## UTM Parameters

All tracked links receive:

| Parameter | Value |
|-----------|-------|
| `utm_source` | `workway_newsletter` |
| `utm_medium` | `email` |
| `utm_campaign` | Issue slug |
| `utm_content` | Link ID (position) |

## Privacy

- Tokens expire after 30 days
- Tokens are revoked on unsubscribe
- Email addresses are hashed (SHA-256) for analytics
- Excludes privacy-sensitive links (unsubscribe, privacy policy)

## Deployment

```bash
cd packages/workers/newsletter-tracking
pnpm install
pnpm run deploy
```

### Required Configuration

1. Create KV namespace: `newsletter-tracking-tokens`
2. Create Analytics Engine dataset: `newsletter_tracking`
3. Configure D1 binding to workway-platform database
4. Set up custom domain: `track.workway.co`

## Integration with workway-platform

The newsletter send endpoint (`/newsletter/admin/issues/:id/send`) automatically:

1. Generates tracking tokens per subscriber
2. Wraps links with tracking URLs
3. Adds open tracking pixel
4. Stores tokens in D1 for resolution

## Example Flow

1. Newsletter sent with links wrapped: `track.workway.co/c?t=abc123&l=hero_cta&d=https://learn.createsomething.space/seeing`
2. User clicks link
3. Worker logs click to Analytics Engine
4. Worker records cross-property event in D1
5. User redirected to destination with UTM params
6. Dashboard shows: "Newsletter → CREATE SOMETHING (Seeing course)"

## Analytics Queries

View cross-property analytics in the workway-platform admin:

- `/newsletter/analytics/cross-property/:issueId` - Property breakdown
- `/newsletter/analytics/journey/:issueId` - User journey analysis
- `/newsletter/analytics/overview` - Aggregate performance
