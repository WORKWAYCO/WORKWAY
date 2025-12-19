# Monitoring & Debugging

Workflows in production need visibility. When something goes wrong—and it will—you need the tools to understand what happened and fix it fast.

## The Observability Stack

| Layer | What It Shows |
|-------|---------------|
| Metrics | Aggregate health (success rates, latency) |
| Logs | Individual execution details |
| Traces | Request flow through steps |
| Alerts | Proactive problem notification |

## WORKWAY Dashboard

### Workflow Overview

Access at `workway.co/workflows/{workflow-id}/analytics`:

- **Executions**: Total runs over time
- **Success Rate**: Percentage of successful completions
- **Avg Duration**: Mean execution time
- **Errors**: Breakdown by error type

### Execution History

View individual runs:

```
workway.co/workflows/{workflow-id}/executions

| ID | Trigger | Status | Duration | Time |
|----|---------|--------|----------|------|
| ex_001 | webhook | success | 2.3s | 10:00 |
| ex_002 | webhook | failed | 0.8s | 10:15 |
| ex_003 | cron | success | 4.1s | 11:00 |
```

Click any execution to see:
- Full request/response
- Step-by-step execution
- Logs generated
- Error details (if failed)

## Structured Logging

### Log Levels

```typescript
async execute({ context }) {
  context.log.debug('Detailed info for debugging');
  context.log.info('Standard operational info');
  context.log.warn('Something unexpected but not fatal');
  context.log.error('Something failed');
}
```

### Contextual Logging

Always include relevant context:

```typescript
// Bad: No context
context.log.info('Processing meeting');

// Good: Includes identifiers
context.log.info('Processing meeting', {
  meetingId: meeting.id,
  topic: meeting.topic,
  participants: meeting.participants.length,
});
```

### Log at Key Points

```typescript
async execute({ trigger, config, integrations, context }) {
  // Start
  context.log.info('Workflow started', {
    triggerId: trigger.id,
    triggerType: trigger.type,
  });

  // Before external calls
  context.log.debug('Fetching meeting from Zoom', { meetingId });
  const meeting = await integrations.zoom.getMeeting(meetingId);
  context.log.info('Meeting fetched', {
    meetingId: meeting.id,
    duration: meeting.duration,
  });

  // After processing
  context.log.info('AI summary generated', {
    inputLength: transcript.length,
    outputLength: summary.length,
  });

  // End
  context.log.info('Workflow completed', {
    pageId: page.id,
    totalDuration: Date.now() - start,
  });

  return { success: true, pageId: page.id };
}
```

### Error Logging

Capture full error context:

```typescript
try {
  await notion.createPage(pageData);
} catch (error) {
  context.log.error('Failed to create Notion page', {
    error: error.message,
    errorCode: error.code,
    stack: error.stack,
    pageData: JSON.stringify(pageData).slice(0, 500), // Truncate for logs
    meetingId: meeting.id,
  });
  throw error;
}
```

## Real-Time Log Streaming

### CLI Log Tail

```bash
workway logs --tail

# Filter by workflow
workway logs --workflow meeting-notes --tail

# Filter by level
workway logs --level error --tail
```

### Output Example

```
[10:00:01] INFO  Workflow started { triggerId: "wh_123", triggerType: "webhook" }
[10:00:01] DEBUG Fetching meeting from Zoom { meetingId: "123" }
[10:00:02] INFO  Meeting fetched { meetingId: "123", duration: 45 }
[10:00:03] INFO  AI summary generated { inputLength: 5000, outputLength: 200 }
[10:00:04] ERROR Failed to create Notion page { error: "Rate limited", errorCode: 429 }
[10:00:05] INFO  Retrying Notion API call { attempt: 2 }
[10:00:06] INFO  Workflow completed { pageId: "page_456", totalDuration: 5000 }
```

## Alerting

### Built-in Alerts

Configure at `workway.co/workflows/{workflow-id}/alerts`:

| Alert Type | Trigger |
|------------|---------|
| Error spike | >10% error rate in 5 minutes |
| Execution failure | Any execution fails |
| Latency | Avg duration >10s |
| No executions | No runs in 24 hours |

### Custom Alert Conditions

```typescript
metadata: {
  alerts: [
    {
      name: 'High failure rate',
      condition: 'error_rate > 0.05',
      window: '5m',
      channels: ['slack:alerts', 'email:oncall@company.com'],
    },
    {
      name: 'Stale workflow',
      condition: 'last_execution > 24h',
      channels: ['slack:alerts'],
    },
  ],
},
```

### Alert Destinations

```typescript
metadata: {
  alertChannels: {
    slack: {
      webhook: 'https://hooks.slack.com/services/xxx',
      channel: '#workflow-alerts',
    },
    email: {
      to: ['team@company.com'],
    },
    pagerduty: {
      serviceKey: 'xxx',
    },
  },
},
```

## Debugging Failed Executions

### Step 1: Find the Failure

```bash
workway executions --status failed --limit 10
```

### Step 2: Get Execution Details

```bash
workway execution ex_abc123

# Output:
# Execution: ex_abc123
# Status: failed
# Duration: 2.3s
# Trigger: webhook (meeting.ended)
#
# Steps:
# 1. ✓ zoom.getMeeting (0.8s)
# 2. ✓ ai.summarize (1.2s)
# 3. ✗ notion.createPage (0.3s)
#    Error: API rate limited (429)
#
# Logs:
# [10:00:01] INFO Starting workflow...
# [10:00:03] ERROR Rate limited by Notion API
```

### Step 3: Reproduce Locally

```bash
# Copy the trigger payload
workway execution ex_abc123 --output-payload > payload.json

# Test locally
workway dev
curl localhost:8787/execute -d @payload.json
```

### Step 4: Fix and Redeploy

```typescript
// Add retry logic
const page = await withRetry(
  () => notion.createPage(pageData),
  { maxAttempts: 3, delayMs: 2000 }
);
```

```bash
workway deploy
```

### Step 5: Verify

```bash
workway logs --tail --workflow meeting-notes
```

## Debugging Techniques

### Replay Failed Executions

```bash
# Retry a specific execution
workway retry ex_abc123
```

### Inspect Integration State

```typescript
async execute({ integrations, context }) {
  // Log integration health
  const zoomHealth = await integrations.zoom.healthCheck();
  context.log.debug('Zoom integration health', { status: zoomHealth });

  // Log token expiry
  const tokenInfo = await integrations.zoom.getTokenInfo();
  context.log.debug('Zoom token', {
    expiresIn: tokenInfo.expires_in,
    scopes: tokenInfo.scopes,
  });
}
```

### Debug Mode

Enable verbose logging:

```typescript
async execute({ context }) {
  const debug = context.env.DEBUG_MODE === 'true';

  if (debug) {
    context.log.debug('Full trigger payload', {
      payload: JSON.stringify(trigger.payload, null, 2),
    });
  }
}
```

Set via environment:
```bash
workway env set DEBUG_MODE true
```

### Step-Through Execution

For complex workflows, log each step:

```typescript
async execute({ context }) {
  const steps = [
    { name: 'fetch_meeting', fn: () => zoom.getMeeting(id) },
    { name: 'get_transcript', fn: () => zoom.getTranscript(id) },
    { name: 'summarize', fn: () => ai.summarize(transcript) },
    { name: 'create_page', fn: () => notion.createPage(data) },
  ];

  const results = {};

  for (const step of steps) {
    const start = Date.now();
    try {
      results[step.name] = await step.fn();
      context.log.info(`Step ${step.name} completed`, {
        duration: Date.now() - start,
      });
    } catch (error) {
      context.log.error(`Step ${step.name} failed`, {
        duration: Date.now() - start,
        error: error.message,
      });
      throw error;
    }
  }

  return { success: true, results };
}
```

## Health Checks

### Workflow Health Endpoint

```typescript
// src/health.ts
export async function healthCheck(integrations: Integrations) {
  const checks = {
    zoom: false,
    notion: false,
    slack: false,
  };

  try {
    await integrations.zoom.getUser();
    checks.zoom = true;
  } catch {}

  try {
    await integrations.notion.getDatabases();
    checks.notion = true;
  } catch {}

  try {
    await integrations.slack.getChannels();
    checks.slack = true;
  } catch {}

  const healthy = Object.values(checks).every(Boolean);

  return {
    healthy,
    checks,
    timestamp: new Date().toISOString(),
  };
}
```

### Scheduled Health Checks

```typescript
metadata: {
  healthCheck: {
    enabled: true,
    schedule: '*/15 * * * *',  // Every 15 minutes
    alertOnFailure: true,
  },
},
```

## Metrics Export

### Custom Metrics

```typescript
async execute({ context }) {
  // Track custom metric
  context.metrics.increment('meetings_processed');
  context.metrics.gauge('transcript_length', transcript.length);
  context.metrics.histogram('processing_time', Date.now() - start);
}
```

### Metrics Dashboard

View at `workway.co/workflows/{workflow-id}/metrics`:

- Execution count by status
- Duration percentiles (p50, p95, p99)
- Custom metrics over time
- Error rate trends

## Post-Incident Analysis

### Incident Timeline

```markdown
## Incident: Meeting notes workflow failure
**Duration**: 10:00 - 10:45 (45 min)
**Impact**: ~30 meetings not processed

### Timeline
- 10:00 - Notion API rate limit changes deployed by Notion
- 10:05 - Workflow error rate spikes to 80%
- 10:10 - Alert fires to Slack
- 10:15 - On-call acknowledges
- 10:25 - Root cause identified (rate limit)
- 10:35 - Fix deployed (added backoff)
- 10:45 - Error rate returns to 0%

### Action Items
- [ ] Add rate limit monitoring for all integrations
- [ ] Implement automatic backoff on 429 responses
- [ ] Create runbook for integration rate limits
```

## Praxis

Set up comprehensive monitoring for your workflow:

> **Praxis**: Ask Claude Code: "Help me add structured logging and alerting to my workflow"

Implement the observability stack:

```typescript
async execute({ context }) {
  const start = Date.now();

  // 1. Log at key points with context
  context.log.info('Workflow started', {
    triggerId: trigger.id,
    triggerType: trigger.type,
  });

  // 2. Track step durations
  const stepStart = Date.now();
  const meeting = await zoom.getMeeting(meetingId);
  context.log.info('Step: Fetch meeting', {
    duration: Date.now() - stepStart,
    meetingId: meeting.id,
  });

  // 3. Log errors with full context
  try {
    await notion.createPage(pageData);
  } catch (error) {
    context.log.error('Step: Create page failed', {
      error: error.message,
      errorCode: error.code,
      meetingId: meeting.id,
    });
    throw error;
  }

  // 4. Final summary
  context.log.info('Workflow complete', {
    duration: Date.now() - start,
    success: true,
  });
}
```

Configure alerts at `workway.co/workflows/{id}/alerts` for:
- Error rate > 5%
- Latency > 10 seconds
- No executions in 24 hours

## Reflection

- How quickly can you identify a failing workflow today?
- What alerts would have caught past incidents sooner?
- How do you balance logging detail vs. noise?
