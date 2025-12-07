# OpenAPI Type Generation

This directory contains OpenAPI specifications and generated TypeScript types for WORKWAY integrations.

## Usage

```bash
# Generate types for all integrations with OpenAPI specs
pnpm generate:types

# Generate types for a specific integration
pnpm generate:types stripe
```

## Integration OpenAPI Status

| Integration | OpenAPI Available | Source |
|-------------|-------------------|--------|
| **Stripe** | ✅ Official | [stripe/openapi](https://github.com/stripe/openapi) |
| **HubSpot** | ✅ Official | [HubSpot API Specs](https://github.com/HubSpot/HubSpot-public-api-spec-collection) |
| **Zoom** | ✅ Official | [Zoom API Reference](https://developers.zoom.us/docs/api/) |
| **Slack** | ⚠️ Partial | Web API has OpenAPI, Events API does not |
| **Notion** | ❌ Community | No official spec; use [community gist](https://gist.github.com/TakashiSasaki/ddbe95c3fd11ebf607c5ebe10464a8c3) |
| **Google Sheets** | ✅ Official | [Google Discovery API](https://sheets.googleapis.com/$discovery/rest?version=v4) |
| **Airtable** | ❌ None | REST API, no published spec |
| **Linear** | ❌ GraphQL | GraphQL schema, not OpenAPI |
| **Calendly** | ✅ Official | [Calendly API](https://developer.calendly.com/) |
| **Todoist** | ❌ None | REST API, no published spec |
| **Typeform** | ✅ Official | [Typeform Developer Portal](https://developer.typeform.com/) |
| **Dribbble** | ❌ None | REST API, no published spec |

## When to Use Generated Types vs Hand-Crafted

**Use Generated Types When:**
- Building a new integration from scratch
- Need complete API coverage
- API has complex nested types

**Use Hand-Crafted Types When:**
- Only using a subset of the API (WORKWAY's approach)
- Generated types are too verbose
- Need ActionResult-compatible types

## Architecture Decision

WORKWAY uses **hand-crafted types** for integrations because:
1. We use ~5% of most APIs
2. Our types are ActionResult-compatible
3. Generated types often have unnecessary complexity

Generated types in this directory serve as **reference documentation**, not runtime code.
