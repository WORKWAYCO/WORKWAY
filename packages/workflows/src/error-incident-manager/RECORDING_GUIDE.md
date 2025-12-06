# Error Incident Manager - Recording Guide

This guide helps you record a demonstration of the Error Incident Manager workflow, showing WORKWAY's power to create self-healing systems.

## The Story to Tell

**"Errors that document themselves"**

This workflow embodies Heideggerian Zuhandenheit: the tool is invisible during normal operation. When a breakdown occurs (an error), the tool surfaces to help you understand and fix it. Then it recedes again.

---

## Pre-Recording Setup

### 1. Environment Setup

```bash
# Ensure migrations are applied
cd apps/api
wrangler d1 execute workway-db --file=migrations/0037_add_error_incident_manager.sql

# Verify workflow appears in marketplace
curl https://workway-api.half-dozen.workers.dev/marketplace/workflows/int_error_incident_manager
```

### 2. Notion Database

Create the Incident Tracker database using the template in `NOTION_TEMPLATE.md`:
- Make it public (Share → Share to web) for transparency
- Copy the database ID for configuration

### 3. Sentry Project

Ensure you have:
- A Sentry project with the WORKWAY API or a test app
- Webhook URL: `https://workway-api.half-dozen.workers.dev/webhooks/sentry`
- Sentry OAuth credentials configured (`SENTRY_CLIENT_ID`, `SENTRY_CLIENT_SECRET`)

### 4. Slack Channel

- Create or choose an `#engineering-alerts` channel
- Ensure WORKWAY's Slack app has access

---

## Recording Script

### Scene 1: The Marketplace (30 seconds)

1. **Open WORKWAY Marketplace** → Show the Error Incident Manager listing
2. **Highlight key points**:
   - "Errors that document themselves" tagline
   - Free pricing
   - Sentry + Notion + Slack integration
3. **Click "Enable"** → Start the installation flow

### Scene 2: OAuth Connection (1 minute)

1. **Connect Sentry** → OAuth popup, authorize
2. **Connect Notion** → OAuth popup, select workspace
3. **Connect Slack** → Already connected (show badge)
4. **Show the unified OAuth status**

### Scene 3: Configuration (30 seconds)

1. **Select Notion Database** → Choose "Incident Tracker"
2. **Select Slack Channel** → Choose "#engineering-alerts"
3. **Set Severity Filter** → "Error" (skip debug/info/warning)
4. **Click "Enable Workflow"**

### Scene 4: The Breakdown (2 minutes)

1. **Show the Notion database** → Empty, clean state
2. **Trigger an error** in the test app:
   ```javascript
   throw new Error("API rate limit exceeded for user xyz");
   ```
3. **Wait ~5 seconds** → Show Sentry capturing the error
4. **Switch to Notion** → Page created automatically!
   - Show the title: `[PROJ-123] API rate limit exceeded...`
   - Show properties: Status=Open, Severity=Error, etc.
   - Show the content: Error details callout, resolution checklist
5. **Switch to Slack** → Alert with context and action buttons
6. **Click "View in Sentry"** → Direct link works

### Scene 5: The Resolution (1 minute)

1. **In Sentry** → Click "Resolve" on the issue
2. **Wait ~5 seconds** → Webhook triggers
3. **Switch to Notion** → Status automatically updated to "Resolved"!
4. **Switch to Slack** → Resolution notification posted

### Scene 6: The Philosophy (30 seconds)

Close with the Heideggerian insight:

> "The tool was invisible until breakdown occurred. When the error happened, it surfaced with full context to help you fix it. Now that it's resolved, it recedes again.
>
> This is what we mean by 'errors that document themselves' — a self-healing system where documentation happens automatically."

---

## Key Talking Points

1. **Compound Workflows**: This isn't just A → B. It's Sentry → Notion + Slack, with bi-directional sync.

2. **The Complete Circle**:
   - Error → Incident page → Alert → Fix → Resolve → Update
   - No manual documentation required

3. **WORKWAY Dogfooding**: "We use this exact workflow for our own error tracking. The public incident page at workway.co/status is powered by this."

4. **Zuhandenheit**: The tool recedes during normal operation. It surfaces when needed, then recedes again.

---

## Technical Details for Q&A

### Webhook Flow
```
Sentry issue.created → /webhooks/sentry
         ↓
TriggerService.triggerWorkflow()
         ↓
WorkflowExecutor Durable Object
         ↓
Steps: extract_issue → check_severity → create_notion_incident → slack_alert
```

### Resolution Flow
```
Sentry issue.resolved → /webhooks/sentry
         ↓
Router: action=resolved → find_existing_incident
         ↓
notion_query_database (find by Sentry Link)
         ↓
notion_update_page (Status=Resolved, Resolved At=now)
         ↓
slack_post_message (resolution notification)
```

### OAuth Providers
- Sentry: `project:read org:read event:read event:write member:read project:releases`
- Notion: Full workspace access (database creation/update)
- Slack: `commands chat:write channels:read`

---

## Troubleshooting

### Webhook not triggering?
1. Check Sentry webhook configuration
2. Verify webhook URL: `https://workway-api.half-dozen.workers.dev/webhooks/sentry`
3. Check Sentry webhook delivery logs

### Notion page not created?
1. Verify database ID is correct
2. Check OAuth token is valid (not expired)
3. Review workflow execution logs

### Slack alert not posted?
1. Verify channel ID is correct
2. Check Slack app has channel access
3. Slack step is marked `optional: true` so workflow succeeds even if Slack fails

---

## Post-Recording

After recording, you can:
1. Export the Notion database as a PDF for the documentation
2. Screenshot the Slack thread showing the full conversation
3. Create a GIF of the Sentry → Notion transition

This becomes marketing material for WORKWAY's compound workflow capabilities.
