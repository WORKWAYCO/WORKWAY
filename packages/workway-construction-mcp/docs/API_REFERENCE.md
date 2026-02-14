# WORKWAY Construction MCP - API Reference

Complete reference for all MCP tools with examples and parameter documentation.

## Table of Contents

- [Workflow Lifecycle Tools](#workflow-lifecycle-tools)
- [Procore Integration Tools](#procore-integration-tools)
- [Debugging & Observability Tools](#debugging--observability-tools)
- [Common Patterns](#common-patterns)
- [Observability API](#observability-api)

---

## Workflow Lifecycle Tools

### `workway_create_workflow`

Create a new construction workflow. This is the first step in building any automation.

**Request:**
```json
{
  "name": "RFI Auto-Response",
  "description": "Automatically draft responses to RFIs based on historical patterns",
  "project_id": "12345",
  "trigger_type": "webhook"
}
```

**Parameters:**
- `name` (string, required) - Human-readable workflow name (e.g., "RFI Auto-Response")
- `description` (string, optional) - What this workflow accomplishes
- `project_id` (string, optional) - Procore project ID to scope this workflow to
- `trigger_type` (enum: `webhook` | `cron` | `manual`, optional) - How the workflow is triggered

**Response:**
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "draft",
  "webhook_url": "https://workway-construction-mcp.workers.dev/webhooks/550e8400-e29b-41d4-a716-446655440000",
  "next_step": "Call workway_configure_workflow_trigger to set up the webhook source and events"
}
```

**Example Use Case:**
```bash
# Create workflow for RFI automation
curl -X POST https://workway-construction-mcp.workers.dev/mcp/tools/workway_create_workflow \
  -H "Content-Type: application/json" \
  -d '{
    "name": "RFI Auto-Response",
    "description": "Draft responses to RFIs using AI",
    "trigger_type": "webhook"
  }'
```

---

### `workway_configure_workflow_trigger`

Configure the trigger for a workflow. For webhooks, specify the source and event types. For cron, specify the schedule.

**Request:**
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "source": "procore",
  "event_types": ["rfi.created", "rfi.answered"],
  "cron_schedule": "0 9 * * 1-5",
  "timezone": "America/Chicago"
}
```

**Parameters:**
- `workflow_id` (string, required) - The workflow to configure
- `source` (enum: `procore` | `slack` | `email` | `custom`, optional) - Service that will trigger this workflow (for webhooks)
- `event_types` (array of strings, optional) - Which events to listen for (e.g., `["rfi.created", "rfi.answered"]`)
- `cron_schedule` (string, optional) - Cron expression (e.g., `"0 9 * * 1-5"` for weekdays at 9am)
- `timezone` (string, optional, default: `"America/Chicago"`) - Timezone for cron schedule

**Cron Schedule Examples:**
- `"0 9 * * 1-5"` - Weekdays at 9:00 AM
- `"0 17 * * *"` - Every day at 5:00 PM
- `"0 */2 * * *"` - Every 2 hours
- `"0 0 1 * *"` - First day of every month at midnight

**Response:**
```json
{
  "success": true,
  "trigger_config": {
    "source": "procore",
    "event_types": ["rfi.created"],
    "webhook_url": "https://workway-construction-mcp.workers.dev/webhooks/550e8400-e29b-41d4-a716-446655440000"
  },
  "next_step": "Call workway_add_workflow_action to add workflow steps"
}
```

---

### `workway_add_workflow_action`

Add an action step to the workflow. Actions execute in sequence.

**Request:**
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "action_type": "procore.rfi.respond",
  "config": {
    "status": "draft",
    "notify_assignee": true
  },
  "condition": "{{trigger.rfi.status}} == 'open'"
}
```

**Parameters:**
- `workflow_id` (string, required) - The workflow to add action to
- `action_type` (string, required) - Type of action (see [Action Types](#action-types))
- `config` (object, required) - Action-specific configuration
- `condition` (string, optional) - Optional condition expression (e.g., `"{{trigger.rfi.status}} == 'open'"`)

**Action Types:**

| Action Type | Description | Config Parameters |
|------------|-------------|-------------------|
| `procore.rfi.respond` | Add response to RFI | `status`, `notify_assignee` |
| `procore.daily_log.create` | Create daily log | `log_date`, `weather_conditions`, `notes` |
| `procore.submittal.verify` | Verify submittal compliance | `spec_section`, `strict_mode` |
| `ai.search_similar_rfis` | Find similar RFIs | `similarity_threshold`, `max_results` |
| `ai.generate_rfi_response` | Generate RFI response | `include_sources`, `confidence_threshold` |
| `ai.extract_from_photos` | Extract data from photos | `extract_fields` |
| `slack.message.send` | Send Slack notification | `channel`, `message` |
| `email.send` | Send email | `to`, `subject`, `body` |

**Response:**
```json
{
  "success": true,
  "action_id": "660e8400-e29b-41d4-a716-446655440001",
  "sequence": 1,
  "next_step": "Add more actions with workway_add_workflow_action, or call workway_deploy_workflow to activate the workflow"
}
```

---

### `workway_deploy_workflow`

Deploy the workflow to production. Validates configuration before deploying.

**Request:**
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "dry_run": false
}
```

**Parameters:**
- `workflow_id` (string, required) - The workflow to deploy
- `dry_run` (boolean, optional, default: `false`) - If true, validates without deploying

**Response (Success):**
```json
{
  "success": true,
  "deployment_id": "770e8400-e29b-41d4-a716-446655440002",
  "webhook_url": "https://workway-construction-mcp.workers.dev/webhooks/550e8400-e29b-41d4-a716-446655440000",
  "validation_errors": [],
  "status": "deployed"
}
```

**Response (Validation Failed):**
```json
{
  "success": false,
  "validation_errors": [
    "Workflow must have at least one action",
    "Webhook trigger requires source and event_types configuration"
  ],
  "status": "failed"
}
```

---

### `workway_test_workflow`

Send a test event through the workflow and verify end-to-end execution.

**Request:**
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "test_payload": {
    "rfi": {
      "id": 12345,
      "subject": "Test RFI",
      "question_body": "What is the concrete mix design?"
    }
  }
}
```

**Parameters:**
- `workflow_id` (string, required) - The workflow to test
- `test_payload` (object, optional) - Mock event payload to simulate trigger

**Response:**
```json
{
  "success": true,
  "execution_id": "880e8400-e29b-41d4-a716-446655440003",
  "steps_completed": 3,
  "steps_total": 3,
  "output": {
    "procore.rfi.respond": {
      "status": "simulated",
      "actionId": "660e8400-e29b-41d4-a716-446655440001"
    }
  },
  "errors": [],
  "duration_ms": 1250
}
```

---

### `workway_list_workflows`

List all workflows for this account. Filter by status if needed.

**Request:**
```json
{
  "status": "active",
  "project_id": "12345"
}
```

**Parameters:**
- `status` (enum: `all` | `draft` | `active` | `paused` | `error`, optional, default: `all`) - Filter by workflow status
- `project_id` (string, optional) - Filter by Procore project ID

**Response:**
```json
{
  "workflows": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "RFI Auto-Response",
      "status": "active",
      "trigger_type": "webhook",
      "project_id": "12345",
      "created_at": "2026-02-01T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### `workway_rollback_workflow`

Rollback to a previous working version of the workflow, or pause the workflow if having issues.

**Request:**
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "action": "pause"
}
```

**Parameters:**
- `workflow_id` (string, required) - The workflow to rollback
- `action` (enum: `pause` | `rollback`, default: `pause`) - Whether to pause or rollback to previous version

**Response:**
```json
{
  "success": true,
  "new_status": "paused",
  "message": "Workflow paused. No new executions will run until reactivated."
}
```

---

## Procore Integration Tools

### `workway_connect_procore`

Initiate OAuth connection to Procore. Returns an authorization URL that the user needs to visit to grant access.

**Request:**
```json
{
  "company_id": "12345"
}
```

**Parameters:**
- `company_id` (string, optional) - Procore company ID (if known)

**Response:**
```json
{
  "authorization_url": "https://login.procore.com/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&state=...",
  "instructions": "Visit the authorization URL to connect your Procore account. After authorizing, you'll be redirected back and the connection will be complete.",
  "status": "pending"
}
```

**Next Steps:**
1. Visit the `authorization_url` in your browser
2. Log in to Procore and authorize the application
3. You'll be redirected back to the callback URL
4. Use `workway_check_procore_connection` to verify the connection

---

### `workway_check_procore_connection`

Check if Procore is connected and the token is valid.

**Request:**
```json
{}
```

**Response (Connected):**
```json
{
  "connected": true,
  "token_expires_at": "2026-02-10T10:00:00Z",
  "scopes": ["read:rfis", "write:rfis", "read:projects"],
  "company_name": "Acme Construction",
  "last_used": "2026-02-03T09:00:00Z"
}
```

**Response (Not Connected):**
```json
{
  "connected": false
}
```

---

### `workway_list_procore_projects`

List all projects the user has access to in Procore.

**Request:**
```json
{
  "company_id": "12345",
  "active_only": true
}
```

**Parameters:**
- `company_id` (string, optional) - Filter by Procore company ID
- `active_only` (boolean, optional, default: `true`) - Only return active projects

**Response:**
```json
{
  "projects": [
    {
      "id": 12345,
      "name": "Downtown Office Building",
      "display_name": "Downtown Office Building - Phase 1",
      "project_number": "2024-001",
      "address": "123 Main St",
      "city": "Chicago",
      "state_code": "IL",
      "active": true
    }
  ],
  "total": 1
}
```

---

### `workway_get_procore_rfis`

Get RFIs (Requests for Information) from a Procore project.

**Request:**
```json
{
  "project_id": 12345,
  "status": "open",
  "limit": 50
}
```

**Parameters:**
- `project_id` (number, required) - Procore project ID
- `status` (enum: `open` | `closed` | `all`, optional, default: `open`) - Filter by RFI status
- `limit` (number, optional, default: `50`) - Maximum number of RFIs to return

**Response:**
```json
{
  "rfis": [
    {
      "id": 67890,
      "number": 1,
      "subject": "Concrete Mix Design",
      "status": "open",
      "question_body": "What is the specified concrete mix design for the foundation?",
      "answer_body": null,
      "due_date": "2026-02-10",
      "created_at": "2026-02-01T10:00:00Z",
      "response_time_days": null
    }
  ],
  "total": 1,
  "stats": {
    "open_count": 1,
    "avg_response_time_days": null
  }
}
```

---

### `workway_get_procore_daily_logs`

Get daily logs from a Procore project.

**Request:**
```json
{
  "project_id": 12345,
  "start_date": "2026-02-01",
  "end_date": "2026-02-28",
  "limit": 30
}
```

**Parameters:**
- `project_id` (number, required) - Procore project ID
- `start_date` (string, optional) - Start date (YYYY-MM-DD)
- `end_date` (string, optional) - End date (YYYY-MM-DD)
- `limit` (number, optional, default: `30`) - Maximum number of logs to return

**Response:**
```json
{
  "date_range": {
    "start_date": "2026-02-01",
    "end_date": "2026-02-28"
  },
  "weather_logs": [],
  "manpower_logs": [],
  "notes_logs": [],
  "equipment_logs": [],
  "safety_violation_logs": [],
  "accident_logs": [],
  "work_logs": [],
  "delay_logs": [],
  "pagination": {
    "limit": 30,
    "offset": 0,
    "total_days_in_range": 28,
    "hasMore": false
  }
}
```

---

### `workway_get_procore_submittals`

Get submittals from a Procore project.

**Request:**
```json
{
  "project_id": 12345,
  "status": "pending",
  "limit": 50
}
```

**Parameters:**
- `project_id` (number, required) - Procore project ID
- `status` (enum: `pending` | `approved` | `rejected` | `all`, optional, default: `all`) - Filter by submittal status
- `limit` (number, optional, default: `50`) - Maximum number of submittals to return

**Response:**
```json
{
  "submittals": [
    {
      "id": 22222,
      "number": 1,
      "title": "Structural Steel Shop Drawings",
      "status": "pending",
      "spec_section": "05 12 00",
      "due_date": "2026-02-15",
      "ball_in_court": "Contractor",
      "created_at": "2026-02-01T10:00:00Z"
    }
  ],
  "total": 1,
  "stats": {
    "pending_count": 1,
    "overdue_count": 0
  }
}
```

---

## Debugging & Observability Tools

### `workway_diagnose_workflow`

Diagnose why a workflow isn't working.

**Request:**
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "symptom": "webhook_not_firing",
  "execution_id": "880e8400-e29b-41d4-a716-446655440003",
  "context": "Webhook URL registered but no events received"
}
```

**Parameters:**
- `workflow_id` (string, required) - The workflow to diagnose
- `symptom` (enum, required) - What symptom are you seeing:
  - `deployment_failed` - Workflow deployment failed
  - `webhook_not_firing` - Webhook events not being received
  - `oauth_error` - OAuth authentication failed
  - `action_failed` - Action execution failed
  - `ai_output_wrong` - AI-generated output incorrect
  - `timeout` - Workflow or action timed out
  - `permission_denied` - Permission denied error
  - `rate_limited` - Rate limit exceeded
  - `unknown` - Unknown issue
- `execution_id` (string, optional) - Specific execution to diagnose
- `context` (string, optional) - Additional context about what you observed

**Response:**
```json
{
  "diagnosis": "Webhook events not being received",
  "root_cause": "Procore webhook may not be registered or project access missing",
  "affected_component": "oauth",
  "severity": "high",
  "suggested_fix": "Verify Procore connection and webhook subscription. Check that the project has webhook access enabled.",
  "fix_tool": "workway_check_procore_connection",
  "fix_params": {},
  "confidence": 0.7,
  "logs": [
    {
      "timestamp": "2026-02-03T10:00:00Z",
      "level": "warn",
      "message": "Procore webhooks require project-level configuration",
      "context": {
        "webhook_url": "https://workway-construction-mcp.workers.dev/webhooks/550e8400-e29b-41d4-a716-446655440000",
        "event_types": ["rfi.created"]
      }
    }
  ],
  "atlas_analysis": {
    "ai_tasks_involved": ["generate", "classify"],
    "human_tasks_required": ["review", "validate"],
    "failure_point": "oauth"
  }
}
```

---

### `workway_get_workflow_guidance`

Get guidance when you don't know how to proceed with workflow configuration.

**Request:**
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "goal": "Automate RFI responses",
  "what_tried": "Created workflow and configured trigger",
  "what_failed": "Not sure how to add AI actions"
}
```

**Parameters:**
- `workflow_id` (string, optional) - Workflow you're working on (if any)
- `goal` (string, required) - What are you trying to accomplish?
- `what_tried` (string, optional) - What have you already tried?
- `what_failed` (string, optional) - What went wrong?

**Response:**
```json
{
  "guidance": "To automate RFI responses, you need a workflow that:\n1. Triggers when a new RFI is created in Procore\n2. Uses AI to search historical RFIs for similar questions\n3. Generates a draft response based on past resolutions\n4. Optionally routes to a human for review before sending\n\nThis follows the Atlas pattern: ai.classify → ai.generate → human.review → system.execute",
  "next_steps": [
    {
      "step": 1,
      "tool": "workway_create_workflow",
      "params": {
        "name": "RFI Auto-Response",
        "trigger_type": "webhook",
        "description": "Automatically draft responses to new RFIs based on historical patterns"
      },
      "explanation": "Create the workflow container"
    },
    {
      "step": 2,
      "tool": "workway_configure_workflow_trigger",
      "params": {
        "source": "procore",
        "event_types": ["rfi.created"]
      },
      "explanation": "Listen for new RFIs in Procore"
    }
  ],
  "example": "A mid-size GC using this pattern reduced RFI response time from 9.7 days to 2.3 days.",
  "documentation_url": "https://docs.workway.co/construction",
  "atlas_context": {
    "ai_tasks": ["classify", "generate"],
    "human_tasks": ["review", "approve"],
    "recommended_pattern": "ai.classify → ai.generate → human.review → system.execute"
  }
}
```

---

### `workway_observe_workflow_execution`

Get detailed observability data for a workflow execution.

**Request:**
```json
{
  "execution_id": "880e8400-e29b-41d4-a716-446655440003",
  "include_ai_reasoning": true
}
```

**Parameters:**
- `execution_id` (string, required) - The execution to observe
- `include_ai_reasoning` (boolean, optional, default: `true`) - Include AI reasoning traces

**Response:**
```json
{
  "execution_id": "880e8400-e29b-41d4-a716-446655440003",
  "workflow_name": "RFI Auto-Response",
  "status": "completed",
  "started_at": "2026-02-03T10:00:00Z",
  "completed_at": "2026-02-03T10:00:05Z",
  "duration_ms": 5000,
  "trace": [
    {
      "step_id": "step-1",
      "timestamp": "2026-02-03T10:00:01Z",
      "task_type": "ai",
      "ai_task": "classify",
      "input": { "rfi_id": 12345 },
      "output": { "category": "technical", "confidence": 0.92 },
      "duration_ms": 1200,
      "token_usage": { "input": 150, "output": 50 },
      "confidence": 0.92
    }
  ],
  "summary": {
    "total_steps": 3,
    "ai_tasks": 2,
    "human_tasks": 0,
    "system_tasks": 1,
    "total_tokens": 500,
    "human_overrides": 0,
    "avg_ai_confidence": 0.88
  },
  "atlas_breakdown": {
    "ai_tasks_used": ["classify", "generate"],
    "human_tasks_used": [],
    "constraints_hit": []
  }
}
```

---

## Common Patterns

### RFI Auto-Response Workflow

```json
// 1. Create workflow
{
  "tool": "workway_create_workflow",
  "params": {
    "name": "RFI Auto-Response",
    "trigger_type": "webhook"
  }
}

// 2. Configure trigger
{
  "tool": "workway_configure_workflow_trigger",
  "params": {
    "workflow_id": "<workflow_id>",
    "source": "procore",
    "event_types": ["rfi.created"]
  }
}

// 3. Add AI search action
{
  "tool": "workway_add_workflow_action",
  "params": {
    "workflow_id": "<workflow_id>",
    "action_type": "ai.search_similar_rfis",
    "config": {
      "similarity_threshold": 0.7,
      "max_results": 5
    }
  }
}

// 4. Add AI generation action
{
  "tool": "workway_add_workflow_action",
  "params": {
    "workflow_id": "<workflow_id>",
    "action_type": "ai.generate_rfi_response",
    "config": {
      "include_sources": true,
      "confidence_threshold": 0.8
    }
  }
}

// 5. Deploy
{
  "tool": "workway_deploy_workflow",
  "params": {
    "workflow_id": "<workflow_id>",
    "dry_run": false
  }
}
```

---

## Observability API

The observability API provides endpoints for monitoring agent health, metrics, and audit logs. These endpoints are protected by admin API key authentication.

**Authentication:**
All observability endpoints require a valid API key in the Authorization header:
```
Authorization: Bearer <OBSERVABILITY_API_KEY>
```

---

### `GET /observability/health`

System health check that verifies connectivity to all dependencies.

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy", "latencyMs": 5 },
    "procore": { "status": "healthy", "connections": 3 },
    "aiGateway": { "status": "healthy" }
  },
  "timestamp": "2026-02-04T10:00:00Z"
}
```

**Status Codes:**
- `200 OK` - All systems healthy
- `503 Service Unavailable` - One or more systems degraded

---

### `GET /observability/metrics/tools`

Tool execution metrics including success rates and error breakdown.

**Query Parameters:**
- `range` (string, optional, default: `"1h"`) - Time range: `5m`, `15m`, `1h`, `6h`, `24h`, `7d`, `30d`
- `tenant` (string, optional) - Filter by tenant/connection ID

**Response:**
```json
{
  "timeRange": "1h",
  "metrics": {
    "totalCalls": 150,
    "successRate": 95.3,
    "errorRate": 4.7,
    "byTool": [
      {
        "name": "workway_list_procore_projects",
        "calls": 45,
        "successRate": 100,
        "errorCount": 0,
        "rateLimitedCount": 0
      },
      {
        "name": "workway_get_procore_rfis",
        "calls": 38,
        "successRate": 92.1,
        "errorCount": 3,
        "rateLimitedCount": 0
      }
    ]
  }
}
```

---

### `GET /observability/metrics/latency`

Latency percentiles (p50, p95, p99) for tool executions.

**Query Parameters:**
- `range` (string, optional, default: `"1h"`) - Time range
- `tool` (string, optional) - Filter by specific tool name

**Response:**
```json
{
  "timeRange": "1h",
  "percentiles": {
    "p50": 120,
    "p95": 450,
    "p99": 890
  },
  "byTool": [
    {
      "name": "workway_skill_draft_rfi",
      "p50": 1200,
      "p95": 2500,
      "p99": 3800,
      "avgLatency": 1450,
      "maxLatency": 4200,
      "sampleCount": 25
    }
  ]
}
```

---

### `GET /observability/metrics/ai`

AI/Token usage metrics including cost attribution by model and tenant.

**Query Parameters:**
- `range` (string, optional, default: `"24h"`) - Time range
- `tenant` (string, optional) - Filter by tenant/connection ID

**Response:**
```json
{
  "timeRange": "24h",
  "usage": {
    "totalTokens": 125000,
    "promptTokens": 75000,
    "completionTokens": 50000,
    "totalCostUsd": 0.125,
    "avgTokensPerRequest": 500,
    "byModel": [
      {
        "model": "llama-3.1-8b-instant",
        "tokens": 100000,
        "promptTokens": 60000,
        "completionTokens": 40000,
        "cost": 0.10,
        "requestCount": 200
      }
    ],
    "byTenant": [
      {
        "tenantId": "ww_tenant_123",
        "tokens": 50000,
        "cost": 0.05,
        "requestCount": 100
      }
    ]
  }
}
```

---

### `GET /observability/metrics/errors`

Error breakdown by tool and error type.

**Query Parameters:**
- `range` (string, optional, default: `"1h"`) - Time range

**Response:**
```json
{
  "timeRange": "1h",
  "errors": {
    "totalErrors": 12,
    "rateLimitCount": 2,
    "byTool": [
      {
        "name": "workway_get_procore_rfis",
        "errors": 5,
        "errorCodes": [
          { "code": "PROCORE_AUTH_EXPIRED", "count": 3 },
          { "code": "PROCORE_NOT_FOUND", "count": 2 }
        ]
      }
    ],
    "byErrorType": [
      { "type": "PROCORE_AUTH_EXPIRED", "count": 3 },
      { "type": "PROCORE_RATE_LIMITED", "count": 2 }
    ]
  }
}
```

---

### `GET /observability/audit-logs`

Query audit logs with optional filters.

**Query Parameters:**
- `limit` (number, optional, default: `100`) - Max logs to return
- `offset` (number, optional, default: `0`) - Pagination offset
- `event_type` (string, optional) - Filter by event type: `tool_execution`, `oauth_callback`, `data_access`, etc.
- `user_id` (string, optional) - Filter by user ID
- `tool_name` (string, optional) - Filter by tool name

**Response:**
```json
{
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "eventType": "tool_execution",
      "userId": "ww_user_123",
      "connectionId": "ww_conn_456",
      "toolName": "workway_list_procore_projects",
      "resourceType": "project",
      "responseStatus": 200,
      "durationMs": 145,
      "createdAt": "2026-02-04T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 1250,
    "hasMore": true
  }
}
```

---

### `GET /observability/status`

Real-time status endpoint for dashboard polling.

**Response:**
```json
{
  "timestamp": "2026-02-04T10:00:00Z",
  "status": "healthy",
  "recentErrors": {
    "count": 3,
    "errors": [
      {
        "toolName": "workway_get_procore_rfis",
        "errorCode": "PROCORE_AUTH_EXPIRED",
        "lastOccurrence": "2026-02-04T09:55:00Z",
        "count": 2
      }
    ]
  },
  "activeWorkflows": {
    "count": 5,
    "workflows": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "RFI Auto-Response",
        "status": "active",
        "lastExecution": "2026-02-04T09:30:00Z"
      }
    ]
  },
  "rateLimitStatus": {
    "isLimited": false,
    "remaining": 3450
  }
}
```

**Status Values:**
- `healthy` - All systems normal, less than 10 errors in the last hour
- `warning` - Elevated error rate (10-50 errors in the last hour)
- `critical` - High error rate (50+ errors in the last hour)

---

## Error Responses

All tools return errors in this format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "error_code": "ERROR_CODE",
  "details": {
    "field": "Additional error context"
  }
}
```

See [ERROR_CODES.md](./ERROR_CODES.md) for complete error code reference.
