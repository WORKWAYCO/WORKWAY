# Newsletter Autopilot - Agent Understanding

> This file enables AI agents to understand and modify this workflow.

## Purpose

Automated newsletter generation for WORKWAY. Runs bi-weekly to:
1. Discover content from platform data and external sources
2. Generate structured newsletter with AI
3. Validate against taste guidelines
4. Refine until quality passes (or escalate)
5. Render and send to subscribers

## Outcome Frame

**"Newsletter that writes itself"**

- Bi-weekly delivery (1st and 15th of month)
- 3-minute read time target
- Developer-focused, outcome-oriented content

## Workflow Phases

```
┌─────────────────┐
│  1. DISCOVER    │ Query marketplace, git history, Perplexity
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. GENERATE    │ AI creates structured JSON content
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. VALIDATE    │ Taste review (6 dimensions, min 7/10 each)
└────────┬────────┘
         │
    ┌────┴────┐
    │  PASS?  │
    └────┬────┘
    NO   │   YES
    ▼    │    ▼
┌───────┐│┌──────────┐
│REFINE ││ │ RENDER   │
│(max 3)││ │ & SEND   │
└───┬───┘│ └────┬─────┘
    │    │      │
    └────┘      ▼
         ┌──────────┐
FAIL ──► │ ESCALATE │
         └──────────┘
```

## Key Integration Points

### WORKWAY API

```
Base URL: inputs.apiBaseUrl (default: https://workway-api.half-dozen.workers.dev)
Auth: Bearer token (inputs.apiToken)

Endpoints used:
- GET  /newsletter/sources/workflows    # Content discovery
- GET  /newsletter/sources/last-issue   # Avoid repetition
- GET  /newsletter/sources/analytics    # Performance feedback
- POST /newsletter/admin/issues         # Create draft
- PUT  /newsletter/admin/issues/:id     # Update content
- POST /newsletter/admin/issues/:id/validate  # Taste review
- POST /newsletter/admin/issues/:id/render    # HTML generation
- POST /newsletter/admin/issues/:id/send      # Batch send
```

### AI Generation

Uses Workers AI (LLAMA_3_8B) with custom system prompt enforcing:
- Developer-focused language
- Outcome-first framing
- Forbidden marketing phrases
- Structured JSON output

### Slack Notifications

Webhook for:
- Success: "Newsletter sent to X subscribers"
- Escalation: "Human review needed after Y cycles"
- Error: "Newsletter Autopilot failed: error message"

## Configuration

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `api_token` | secret | Yes | WORKWAY admin API token |
| `api_base_url` | string | No | API base URL |
| `perplexity_api_key` | secret | No | For industry insights |
| `slack_webhook` | string | Yes | Notification webhook |
| `notify_on_escalation` | boolean | No | Send Slack on escalation |
| `max_refinement_cycles` | number | No | Default: 3 |

## Content Schema

```typescript
interface NewsletterContent {
  title: string;      // Subject line, max 60 chars
  preheader: string;  // Preview, max 100 chars
  sections: [
    { type: 'hero', title, subtitle },
    { type: 'workflow_showcase', workflowName, outcomeFrame, integrations, story },
    { type: 'automation_idea', problem, solution, outcome },
    { type: 'product_update', title, description, isNew },
    { type: 'industry_insight', title, content, source },
    { type: 'cta', text, buttonText, buttonUrl }
  ]
}
```

## Taste Dimensions

| Dimension | Target | What It Measures |
|-----------|--------|------------------|
| brandVoice | >= 7 | No marketing fluff, developer-focused |
| valueDensity | >= 7 | Actionable content per section |
| technicalAccuracy | >= 7 | Claims sourced, code works |
| outcomeFocus | >= 7 | Lead with outcomes, not features |
| lengthBalance | >= 7 | 3-5 min read, scannable |
| ctaClarity | >= 7 | Single clear action |

**Overall must be >= 7.5 to pass.**

## Error Handling

- API errors: Retry once, then fail
- AI generation errors: Fall back to minimal template
- Send errors: Mark issue as 'failed', notify via Slack
- All errors trigger `onError` handler with Slack notification

## Modification Guidelines

When modifying this workflow:

1. **Content changes**: Update `CONTENT_GENERATION_PROMPT` constant
2. **New sections**: Add to section types and update email templates in API
3. **Quality thresholds**: Modify in `newsletter-taste.ts`
4. **Schedule**: Change cron in trigger config
5. **New integrations**: Add to `integrations` array and use in execute()

## Dependencies

- `@workwayco/sdk`: Workflow definition, scheduling, AI
- WORKWAY API: Newsletter endpoints (must be deployed)
- Resend: Email delivery (via API)
- Perplexity (optional): External research

## Testing

Manual trigger:
1. Create test subscriber: `POST /newsletter/subscribe`
2. Verify email: `GET /newsletter/verify/:token`
3. Run workflow manually via WORKWAY dashboard
4. Check Slack for notifications
5. Verify email received

## Related Files

- `/workway-platform/NEWSLETTER.md` - Full agent documentation
- `/workway-platform/apps/api/src/lib/newsletter-taste.ts` - Taste guidelines
- `/workway-platform/apps/api/src/routes/newsletter.ts` - API routes
