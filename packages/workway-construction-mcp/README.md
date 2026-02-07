# WORKWAY Construction MCP

> **The Automation Layer.**
> 
> AI-native workflow automation for construction, powered by Cloudflare.

This MCP (Model Context Protocol) server enables AI agents like Claude Code and OpenAI Codex to create and manage construction workflows that integrate with Procore.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy the example configuration
cp wrangler.toml.example wrangler.toml

# Create D1 database
wrangler d1 create workway-construction
# Copy the database_id from output to wrangler.toml

# Create KV namespace
wrangler kv:namespace create KV
# Copy the id from output to wrangler.toml

# Update wrangler.toml with your account_id (find at dash.cloudflare.com)

# Set required secrets
wrangler secret put PROCORE_CLIENT_ID
wrangler secret put PROCORE_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY  # 32+ random characters

# Run migrations
pnpm migrate:local

# Start development server
pnpm dev
```

### Configuration Files

| File | Purpose |
|------|---------|
| `wrangler.toml.example` | Template configuration (safe to commit) |
| `wrangler.toml` | Your actual configuration (do NOT commit with real IDs) |

**Security Note**: `wrangler.toml` may contain infrastructure IDs (account_id, database_id, KV namespace IDs). While these aren't secrets, they're better kept private. Use `wrangler.toml.example` as a template and keep your actual `wrangler.toml` local.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 CLIENT'S AI AGENT (Claude Code)                  │
│                                                                  │
│   "Automate RFI responses for my construction project"           │
│                              │                                   │
│                              ▼                                   │
│                    ┌─────────────────┐                           │
│                    │  WORKWAY MCP    │                           │
│                    │  (remote)       │                           │
│                    └────────┬────────┘                           │
└─────────────────────────────│────────────────────────────────────┘
                              │ MCP Protocol
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           WORKWAY CONSTRUCTION MCP (Cloudflare Worker)           │
│                                                                  │
│   Tools:                     Resources:                          │
│   ├─ workway_create_workflow        ├─ workflow://status            │
│   ├─ workway_deploy_workflow        ├─ procore://projects           │
│   ├─ workway_diagnose_workflow      └─ construction://best-practices│
│   └─ workway_get_workflow_guidance                                  │
│                                                                  │
│   Backend: D1 + KV + Durable Objects                             │
└─────────────────────────────────────────────────────────────────┘
```

## Tool Naming Convention

All tools follow the pattern: `workway_{action}_{provider}_{resource}`

**Actions** (verbs):
- `get` - Retrieve single item
- `list` - Retrieve multiple items
- `create` - Create new item
- `update` - Modify existing item
- `delete` - Remove item
- `connect` - Establish OAuth connection
- `check` - Verify status
- `test` - Test/validate
- `deploy` - Deploy workflow
- `send` - Send notifications
- `configure` - Configure settings

**Examples**:
- `workway_connect_procore` - Connects to Procore provider
- `workway_list_procore_projects` - Lists projects from Procore
- `workway_create_workflow` - Creates internal workflow (no provider)
- `workway_skill_draft_rfi` - Intelligence Layer skill

## Available Tools

### Workflow Lifecycle

| Tool | Description |
|------|-------------|
| `workway_create_workflow` | Create a new construction workflow |
| `workway_configure_workflow_trigger` | Set up webhook or cron triggers |
| `workway_add_workflow_action` | Add action steps to workflow |
| `workway_deploy_workflow` | Deploy workflow to production |
| `workway_test_workflow` | Test workflow end-to-end |
| `workway_list_workflows` | List all workflows |
| `workway_rollback_workflow` | Pause or rollback workflow |

### Procore Integration

| Tool | Description |
|------|-------------|
| `workway_connect_procore` | Initiate OAuth connection |
| `workway_check_procore_connection` | Check connection status |
| `workway_list_procore_companies` | List accessible companies |
| `workway_list_procore_projects` | List accessible projects |
| `workway_get_procore_rfis` | Fetch RFIs from project |
| `workway_get_procore_daily_logs` | Fetch daily logs |
| `workway_get_procore_submittals` | Fetch submittals |
| `workway_get_procore_photos` | Fetch photos |
| `workway_get_procore_documents` | Fetch documents |
| `workway_get_procore_schedule` | Fetch schedule tasks |
| `workway_create_procore_rfi` | Create new RFI |
| `workway_create_procore_webhook` | Register webhook |
| `workway_list_procore_webhooks` | List webhooks |
| `workway_delete_procore_webhook` | Delete webhook |

### Notifications

| Tool | Description |
|------|-------------|
| `workway_send_notification_email` | Send email notification |
| `workway_send_notification_slack` | Send Slack notification |
| `workway_send_notification` | Send via configured channels |
| `workway_configure_workflow_notifications` | Configure workflow notifications |

### Debugging & Observability

| Tool | Description |
|------|-------------|
| `workway_diagnose_workflow` | Diagnose workflow issues |
| `workway_get_workflow_guidance` | Get guidance when stuck |
| `workway_observe_workflow_execution` | Detailed execution trace |

### Intelligence Layer Skills (AI-Powered)

| Skill | Description | Atlas Task |
|-------|-------------|------------|
| `workway_skill_draft_rfi` | Draft professional RFIs from question intent | generate |
| `workway_skill_daily_log_summary` | Summarize logs into executive reports | summarize |
| `workway_skill_submittal_review` | Review submittals and flag compliance issues | classify |

**Skills vs Tools**: Tools connect and retrieve data (Automation Layer). Skills use AI to produce outcomes (Intelligence Layer). Skills always require human review before action.

## Pain Points Addressed

Based on industry research:

| Pain Point | Current State | With WORKWAY |
|------------|---------------|--------------|
| **RFI Response Time** | 9.7 days average | Target: 2-3 days |
| **Daily Log Creation** | 2.5 hours/day | Target: 30 minutes |
| **Submittal Tracking** | 14-21 day reviews | Proactive alerts |

## AI Interaction Atlas

This MCP incorporates the [AI Interaction Atlas](https://github.com/quietloudlab/ai-interaction-atlas) taxonomy for describing AI behaviors in workflows:

- **AI Tasks**: classify, generate, verify, transform, summarize
- **Human Tasks**: review, approve, edit, escalate
- **System Tasks**: routing, logging, state management

The `workway_diagnose_workflow` and `workway_observe_workflow_execution` tools use Atlas terminology to explain what happened during workflow execution.

## Configuration

### Environment Variables

```bash
# Set via wrangler secret
wrangler secret put PROCORE_CLIENT_ID
wrangler secret put PROCORE_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY  # 32+ random characters

# Optional: For Procore sandbox environment
wrangler secret put PROCORE_SANDBOX_CLIENT_ID
wrangler secret put PROCORE_SANDBOX_CLIENT_SECRET

# Optional: For AI Gateway (LLM observability)
wrangler secret put CLOUDFLARE_ACCOUNT_ID  # Find at dash.cloudflare.com
# AI_GATEWAY_ID is set in wrangler.toml (default: workway-mcp)
```

### OAuth Setup

1. Create a Procore OAuth app at [developers.procore.com](https://developers.procore.com)
2. Set callback URL to: `https://workway-construction-mcp.workers.dev/oauth/callback`
3. Add client credentials as secrets

## AI Gateway Integration

### Overview

WORKWAY Construction MCP integrates with [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) for automatic LLM observability:

- **Token Counting**: Automatic tracking of prompt and completion tokens
- **Cost Tracking**: Estimated cost per request based on model pricing
- **Caching**: Cache repeated queries to reduce costs and latency
- **Rate Limiting**: Protect against runaway AI costs
- **Analytics Dashboard**: View usage patterns in Cloudflare dashboard
- **OpenTelemetry Export**: Export metrics to your observability stack

### Setting Up AI Gateway

1. **Create an AI Gateway in Cloudflare Dashboard**:
   - Go to [AI Gateway](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway) in your Cloudflare dashboard
   - Click "Create Gateway"
   - Name it `workway-mcp` (or update `AI_GATEWAY_ID` in wrangler.toml)
   - Enable caching if desired (recommended for cost savings)

2. **Configure Environment Variables**:
   ```bash
   # Set your Cloudflare Account ID as a secret
   wrangler secret put CLOUDFLARE_ACCOUNT_ID
   ```

   The `AI_GATEWAY_ID` is already configured in `wrangler.toml` (default: `workway-mcp`).

3. **Apply the migration** (for AI usage tracking in audit logs):
   ```bash
   pnpm migrate:local   # For local development
   pnpm migrate:remote  # For production
   ```

### How It Works

When AI Gateway is configured, all LLM calls from Intelligence Layer Skills are automatically routed through the gateway:

```
Skill (draft_rfi) → AI Gateway → Workers AI → Response
                        ↓
               Token counting
               Cost estimation
               Cache check
               Analytics logging
```

If AI Gateway is not configured (missing `CLOUDFLARE_ACCOUNT_ID`), Skills fall back to direct Workers AI calls.

### Viewing Analytics

1. Go to [AI Gateway Analytics](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway) in Cloudflare dashboard
2. Select your gateway (`workway-mcp`)
3. View:
   - Total requests and tokens
   - Cache hit rate
   - Latency percentiles
   - Cost estimates by model
   - Request logs with metadata

### AI Usage in Audit Logs

AI usage is also logged to the `audit_logs` table for internal tracking:

```sql
-- Query AI usage by user
SELECT 
  user_id,
  SUM(total_tokens) as total_tokens,
  SUM(cost_usd) as total_cost,
  COUNT(*) as request_count,
  SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cache_hits
FROM audit_logs 
WHERE event_type = 'ai_usage'
GROUP BY user_id;

-- Query AI usage by skill
SELECT 
  tool_name,
  model,
  SUM(total_tokens) as total_tokens,
  AVG(duration_ms) as avg_latency
FROM audit_logs 
WHERE event_type = 'ai_usage'
GROUP BY tool_name, model;
```

### Skill Response Metadata

Skills now include AI usage metrics in their responses:

```json
{
  "success": true,
  "data": {
    "draft": { ... },
    "aiUsage": {
      "promptTokens": 523,
      "completionTokens": 412,
      "totalTokens": 935,
      "estimatedCost": 0.000234,
      "latencyMs": 1523,
      "cached": false
    }
  }
}
```

## Security Features

### Rate Limiting

Procore's API has a 3600 requests/minute limit. This MCP implements proactive rate limiting using a Durable Object with token bucket algorithm:

- **60 tokens/second** refill rate (3600/minute)
- **Per-connection tracking** - each user's connection gets its own rate limiter
- **Automatic retry guidance** - returns `retryAfter` seconds when limit exceeded
- **No wasted requests** - checks limit before calling Procore API

### Audit Logging

All sensitive operations are logged to the `audit_logs` table for security compliance:

| Event Type | Description |
|------------|-------------|
| `tool_execution` | Every tool call with duration, success/failure |
| `oauth_callback` | OAuth flow completions |
| `oauth_initiate` | OAuth flow starts |
| `token_refresh` | Token refresh operations |
| `rate_limit_exceeded` | Rate limit violations |
| `data_access` | Sensitive resource access |

Query audit logs via SQL:
```sql
SELECT * FROM audit_logs 
WHERE user_id = 'ww_abc123' 
ORDER BY created_at DESC 
LIMIT 100;
```

### Token Encryption

All OAuth tokens are encrypted at rest using AES-GCM encryption before storage in D1.

## Deployment

```bash
# Deploy to Cloudflare Workers
pnpm deploy

# Apply migrations to production
pnpm migrate:remote
```

## Example: Draft an RFI (Intelligence Layer)

```
User: "I need to ask about the concrete mix design for the foundation"

Claude (with WORKWAY MCP):

1. workway_skill_draft_rfi({
     project_id: 12345,
     question_intent: "Confirm concrete mix design for foundation meets 4000 PSI requirement",
     spec_section: "03 30 00 - Cast-in-Place Concrete",
     drawing_reference: "S-101",
     priority: "high"
   })

Response:
{
  "draft": {
    "subject": "RFI: Concrete Mix Design Confirmation - 03 30 00",
    "question_body": "Per specification section 03 30 00 and structural drawing S-101, 
     please confirm the concrete mix design for foundation pours meets the specified 
     4000 PSI minimum compressive strength requirement at 28 days...",
    "suggested_response_format": "Written confirmation with mix design submittal reference",
    "impact_statement": "Foundation pour scheduled for next week - expedited response requested",
    "references": ["03 30 00", "S-101"]
  },
  "confidence": 0.85,
  "review_notes": ["Ready for human review"],
  "ready_to_submit": false
}

→ User reviews draft, then: workway_create_procore_rfi({ ... draft fields ... })
```

## Example: Weekly Summary (Intelligence Layer)

```
User: "Give me a summary of this week's activity"

Claude (with WORKWAY MCP):

1. workway_skill_daily_log_summary({
     project_id: 12345,
     format: "executive",
     include_recommendations: true
   })

Response:
{
  "summary": {
    "period": "2026-01-27 to 2026-02-02",
    "executive_summary": "Strong progress on foundation work with 892 total manhours. 
     One weather delay on Tuesday impacted concrete pour schedule.",
    "key_metrics": { "total_manhours": 892, "average_crew_size": 24, "weather_days_lost": 0.5 },
    "notable_events": ["Foundation pour completed Phase 1", "Steel delivery confirmed for Monday"],
    "weather_impact": "Rain on Tuesday caused 4-hour delay",
    "delays": [{ "date": "2026-01-28", "description": "Rain delay", "impact": "4 hours" }],
    "recommendations": ["Schedule makeup pour for Saturday", "Confirm steel erection crew availability"]
  }
}
```

## Example: RFI Automation Workflow

```
User: "I want to automatically draft responses to RFIs"

Claude (with WORKWAY MCP):

1. workway_create_workflow({
     name: "RFI Auto-Response",
     trigger_type: "webhook"
   })

2. workway_configure_workflow_trigger({
     source: "procore",
     event_types: ["rfi.created"]
   })

3. workway_add_workflow_action({
     action_type: "ai.search_similar_rfis",
     config: { similarity_threshold: 0.7 }
   })

4. workway_add_workflow_action({
     action_type: "ai.generate_rfi_response",
     config: { include_sources: true }
   })

5. workway_deploy_workflow({ workflow_id: "..." })

→ Workflow deployed. RFIs will now receive AI-drafted responses.
```

## Market Context

- Construction software market: $11.6B (2025) → $24.7B (2034)
- 78% of contractors testing AI, only 10.6% deployed
- $177B annual waste from workflow inefficiency
- Procore: 17K+ customers, free API access

## Documentation

Complete documentation is available in the `docs/` directory:

### Getting Started
- **[API Reference](./docs/API_REFERENCE.md)** - Complete tool reference with examples
- **[Procore OAuth Setup](./docs/PROCORE_OAUTH_SETUP.md)** - Step-by-step OAuth configuration guide
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Local development and production deployment

### Troubleshooting & Support
- **[Error Codes](./docs/ERROR_CODES.md)** - Complete error code reference
- **[Troubleshooting Guide](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Advanced Topics
- **[Architecture](./docs/ARCHITECTURE.md)** - System architecture and design
- **[Rate Limits](./docs/RATE_LIMITS.md)** - Rate limits and quota information
- **[Security Best Practices](./docs/SECURITY.md)** - Security guidelines and best practices

### Reference
- **[Changelog](./CHANGELOG.md)** - Version history and changes
- **[Documentation Gaps Analysis](./DOCUMENTATION_GAPS_ANALYSIS.md)** - Analysis of documentation completeness

## License

MIT
