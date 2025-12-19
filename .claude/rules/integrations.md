# Integration Patterns

## BaseAPIClient Pattern

All integrations MUST use the BaseAPIClient pattern:
- Centralized error handling
- Automatic token refresh
- Rate limiting
- Consistent response types

## Integration Structure

```
packages/integrations/src/{service}/
├── index.ts           # Main export
├── {service}.types.ts # TypeScript interfaces
├── {service}.ts       # API client (extends BaseAPIClient)
└── {service}.test.ts  # Tests
```

## Canonical Tokens

- `BRAND_RADIUS` - Border radius values
- `BRAND_OPACITY` - Opacity scale for text hierarchy
- Never hardcode values; import from `brand-design-system.ts`

## Positioning Context

### WORKWAY fills Notion's integration gaps:
- **Gmail → Notion**: AI Connector is search-only, doesn't create database entries
- **Slack → Notion**: Native integration is one-way (Notion → Slack only)
- **Zoom → Notion**: No official integration for meeting transcripts
- **CRM → Notion**: Wide open territory

### Compound Workflow Differentiation

WORKWAY doesn't just move data A → B. We orchestrate the **full workflow**:
```
Meeting ends → Notion page + Slack summary + Email draft + CRM update
```
This is what competitors (Transkriptor, Zapier) don't do.

## Exception Patterns: Integration Gap Workarounds

Sometimes OAuth APIs don't provide the data you need. When building workarounds:

**When to use a workaround pattern:**
- OAuth genuinely doesn't provide required data (e.g., Zoom transcripts)
- No canonical alternative exists
- The outcome justifies the complexity

**Requirements for workaround workflows:**
1. Mark with `experimental: true` and `requiresCustomInfrastructure: true`
2. Document trade-offs prominently in the file header
3. Use honest naming (e.g., `meeting-intelligence-private`, not `meeting-intelligence-quick-start`)
4. Set `zuhandenheit.worksOutOfBox: false` - don't pretend it's seamless
5. Provide upgrade path to canonical workflow when API improves

**What workaround workflows should NOT do:**
- Claim to be "quick" or "easy" when they require custom infrastructure
- Hide mechanism complexity from developers
- Be featured or recommended over canonical alternatives

Workarounds are exceptions, not templates.
