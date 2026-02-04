# WORKWAY Construction MCP

> **The Automation Layer.**
> 
> AI-native workflow automation for construction, powered by Cloudflare.

This MCP (Model Context Protocol) server enables AI agents like Claude Code and OpenAI Codex to create and manage construction workflows that integrate with Procore.

## Quick Start

```bash
# Install dependencies
pnpm install

# Create D1 database
wrangler d1 create workway-construction

# Update wrangler.toml with the database ID

# Run migrations
pnpm migrate:local

# Start development server
pnpm dev
```

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
│   ├─ workway_create_workflow ├─ workflow://status               │
│   ├─ workway_deploy          ├─ procore://projects              │
│   ├─ workway_diagnose        └─ construction://best-practices   │
│   └─ workway_get_unstuck                                        │
│                                                                  │
│   Backend: D1 + KV + Durable Objects                             │
└─────────────────────────────────────────────────────────────────┘
```

## Available Tools

### Workflow Lifecycle

| Tool | Description |
|------|-------------|
| `workway_create_workflow` | Create a new construction workflow |
| `workway_configure_trigger` | Set up webhook or cron triggers |
| `workway_add_action` | Add action steps to workflow |
| `workway_deploy` | Deploy workflow to production |
| `workway_test` | Test workflow end-to-end |
| `workway_list_workflows` | List all workflows |
| `workway_rollback` | Pause or rollback workflow |

### Procore Integration

| Tool | Description |
|------|-------------|
| `workway_connect_procore` | Initiate OAuth connection |
| `workway_check_procore_connection` | Check connection status |
| `workway_list_procore_projects` | List accessible projects |
| `workway_get_procore_rfis` | Fetch RFIs from project |
| `workway_get_procore_daily_logs` | Fetch daily logs |
| `workway_get_procore_submittals` | Fetch submittals |

### Debugging & Observability

| Tool | Description |
|------|-------------|
| `workway_diagnose` | Diagnose workflow issues |
| `workway_get_unstuck` | Get guidance when stuck |
| `workway_observe_execution` | Detailed execution trace |

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

The `workway_diagnose` and `workway_observe_execution` tools use Atlas terminology to explain what happened during workflow execution.

## Configuration

### Environment Variables

```bash
# Set via wrangler secret
wrangler secret put PROCORE_CLIENT_ID
wrangler secret put PROCORE_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY
```

### OAuth Setup

1. Create a Procore OAuth app at [developers.procore.com](https://developers.procore.com)
2. Set callback URL to: `https://workway-construction-mcp.workers.dev/oauth/callback`
3. Add client credentials as secrets

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

2. workway_configure_trigger({
     source: "procore",
     event_types: ["rfi.created"]
   })

3. workway_add_action({
     action_type: "ai.search_similar_rfis",
     config: { similarity_threshold: 0.7 }
   })

4. workway_add_action({
     action_type: "ai.generate_rfi_response",
     config: { include_sources: true }
   })

5. workway_deploy({ workflow_id: "..." })

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
