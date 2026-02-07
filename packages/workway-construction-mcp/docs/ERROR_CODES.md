# WORKWAY Construction MCP - Error Codes

Complete reference for all error codes returned by the MCP server.

## Standard Error Response Format

All errors follow this consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "additional": "context"
    },
    "retryAfter": 60,
    "httpStatus": 429
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `false` for errors |
| `error.code` | `string` | Machine-readable error code (see categories below) |
| `error.message` | `string` | Human-readable error message |
| `error.details` | `object` | Optional additional context |
| `error.retryAfter` | `number` | Seconds to wait before retry (rate limits only) |
| `error.httpStatus` | `number` | HTTP status code for REST API responses |

---

## Error Code Categories

### Authentication Errors (AUTH_*)

| Code | HTTP | Description | Solution |
|------|------|-------------|----------|
| `AUTH_REQUIRED` | 401 | No OAuth token found | Call `workway_connect_procore` |
| `AUTH_EXPIRED` | 401 | OAuth token has expired | Reconnect using `workway_connect_procore` |
| `AUTH_INVALID` | 401 | Invalid or corrupted token | Reconnect using `workway_connect_procore` |
| `AUTH_INSUFFICIENT_SCOPES` | 403 | Token missing required scopes | Reconnect with correct scopes |
| `AUTH_REFRESH_FAILED` | 401 | Automatic token refresh failed | Reconnect manually |

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Procore not connected. Use \"Connect my Procore account\" to authorize.",
    "details": {
      "userId": "default",
      "tool": "workway_get_procore_rfis"
    },
    "httpStatus": 401
  }
}
```

---

### Procore Integration Errors (PROCORE_*)

| Code | HTTP | Description | Solution |
|------|------|-------------|----------|
| `PROCORE_NOT_CONNECTED` | 401 | No Procore connection | Call `workway_connect_procore` |
| `PROCORE_AUTH_FAILED` | 401 | Procore rejected authentication | Reconnect using `workway_connect_procore` |
| `PROCORE_RATE_LIMITED` | 429 | Too many API requests | Wait for `retryAfter` seconds |
| `PROCORE_NOT_FOUND` | 404 | Resource not found in Procore | Check resource ID exists |
| `PROCORE_FORBIDDEN` | 403 | Insufficient Procore permissions | Check Procore user permissions |
| `PROCORE_API_ERROR` | 502 | Generic Procore API failure | Check Procore API status |
| `PROCORE_SANDBOX_NOT_CONFIGURED` | 500 | Sandbox credentials not set | Configure sandbox environment variables |
| `PROCORE_COMPANY_NOT_SET` | 400 | Company ID not set | Reconnect and select a company |

**Example (Rate Limit):**
```json
{
  "success": false,
  "error": {
    "code": "PROCORE_RATE_LIMITED",
    "message": "Procore rate limit exceeded. Retry after 60 seconds.",
    "retryAfter": 60,
    "details": {
      "remaining": 0,
      "httpStatus": 429
    },
    "httpStatus": 429
  }
}
```

---

### Workflow Errors (WORKFLOW_*)

| Code | HTTP | Description | Solution |
|------|------|-------------|----------|
| `WORKFLOW_NOT_FOUND` | 404 | Workflow ID doesn't exist | Check workflow ID or list workflows |
| `WORKFLOW_INVALID` | 400 | Workflow configuration invalid | Review validation errors |
| `WORKFLOW_NO_ACTIONS` | 400 | Cannot deploy empty workflow | Add actions with `workway_add_workflow_action` |
| `WORKFLOW_NO_TRIGGER` | 400 | Workflow has no trigger | Use `workway_configure_workflow_trigger` |
| `WORKFLOW_INVALID_TRIGGER` | 400 | Trigger config incomplete | Check trigger configuration |
| `WORKFLOW_EXECUTION_FAILED` | 500 | Workflow failed during execution | Check execution logs |
| `WORKFLOW_ALREADY_ACTIVE` | 409 | Workflow already deployed | Use `workway_rollback_workflow` first if needed |

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "WORKFLOW_INVALID",
    "message": "Workflow validation failed: Workflow must have at least one action; Webhook trigger requires source and event_types configuration",
    "details": {
      "workflowId": "550e8400-e29b-41d4-a716-446655440000",
      "validationErrors": [
        "Workflow must have at least one action",
        "Webhook trigger requires source and event_types configuration"
      ]
    },
    "httpStatus": 400
  }
}
```

---

### Validation Errors (VALIDATION_*)

| Code | HTTP | Description | Solution |
|------|------|-------------|----------|
| `VALIDATION_FAILED` | 400 | Input validation failed | Check parameter format |
| `INVALID_INPUT` | 400 | Parameter value invalid | Review input requirements |
| `MISSING_REQUIRED_FIELD` | 400 | Required parameter not provided | Provide all required parameters |
| `INVALID_CRON_EXPRESSION` | 400 | Cron schedule format invalid | Use valid cron syntax |
| `INVALID_DATE_FORMAT` | 400 | Date format incorrect | Use YYYY-MM-DD format |
| `INVALID_ID_FORMAT` | 400 | ID format invalid | Use correct ID format |

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid input: project_id is required",
    "details": {
      "issues": [
        { "path": "project_id", "message": "Required" }
      ]
    },
    "httpStatus": 400
  }
}
```

---

### System Errors (SYSTEM_*)

| Code | HTTP | Description | Solution |
|------|------|-------------|----------|
| `INTERNAL_ERROR` | 500 | Unexpected server error | Contact support |
| `SERVICE_UNAVAILABLE` | 503 | MCP server temporarily unavailable | Retry after delay |
| `DATABASE_ERROR` | 500 | Database operation failed | Retry or contact support |
| `TIMEOUT` | 504 | Operation timed out | Retry with smaller scope |
| `CONFIGURATION_ERROR` | 500 | Server configuration invalid | Contact support |

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred. Please try again.",
    "httpStatus": 500
  }
}
```

---

### Webhook Errors (WEBHOOK_*)

| Code | HTTP | Description | Solution |
|------|------|-------------|----------|
| `WEBHOOK_NOT_FOUND` | 404 | Webhook subscription not found | Check webhook ID |
| `WEBHOOK_CREATION_FAILED` | 500 | Failed to create webhook | Check permissions |

---

### Execution Errors (EXECUTION_*)

| Code | HTTP | Description | Solution |
|------|------|-------------|----------|
| `EXECUTION_NOT_FOUND` | 404 | Execution ID doesn't exist | Check execution ID |
| `EXECUTION_TIMEOUT` | 504 | Execution exceeded time limit | Optimize workflow |
| `ACTION_EXECUTION_FAILED` | 500 | Individual action failed | Use `workway_diagnose_workflow` |

---

## HTTP Status Code Mapping

| Status | Meaning | Common Error Codes |
|--------|---------|-------------------|
| `200` | Success | N/A |
| `400` | Bad Request | `VALIDATION_*`, `WORKFLOW_INVALID`, `PROCORE_COMPANY_NOT_SET` |
| `401` | Unauthorized | `AUTH_*`, `PROCORE_NOT_CONNECTED`, `PROCORE_AUTH_FAILED` |
| `403` | Forbidden | `AUTH_INSUFFICIENT_SCOPES`, `PROCORE_FORBIDDEN` |
| `404` | Not Found | `WORKFLOW_NOT_FOUND`, `PROCORE_NOT_FOUND`, `WEBHOOK_NOT_FOUND` |
| `409` | Conflict | `WORKFLOW_ALREADY_ACTIVE` |
| `429` | Too Many Requests | `PROCORE_RATE_LIMITED` |
| `500` | Internal Server Error | `INTERNAL_ERROR`, `DATABASE_ERROR`, `CONFIGURATION_ERROR` |
| `502` | Bad Gateway | `PROCORE_API_ERROR` |
| `503` | Service Unavailable | `SERVICE_UNAVAILABLE` |
| `504` | Gateway Timeout | `TIMEOUT`, `EXECUTION_TIMEOUT` |

---

## Error Handling Best Practices

### 1. Always Check the `success` Field

```typescript
const result = await callTool('workway_create_workflow', params);

if (!result.success) {
  // Handle error using error.code for programmatic handling
  console.error(`Error ${result.error.code}: ${result.error.message}`);
}
```

### 2. Use Error Codes for Programmatic Handling

```typescript
switch (result.error.code) {
  case 'AUTH_REQUIRED':
  case 'AUTH_EXPIRED':
  case 'PROCORE_NOT_CONNECTED':
    // Redirect to OAuth flow
    await connectProcore();
    break;

  case 'PROCORE_RATE_LIMITED':
    // Implement exponential backoff
    const retryAfter = result.error.retryAfter || 60;
    await sleep(retryAfter * 1000);
    break;

  case 'VALIDATION_FAILED':
    // Show user-friendly validation message
    showValidationErrors(result.error.details?.issues);
    break;

  case 'WORKFLOW_NOT_FOUND':
    // List available workflows
    await listWorkflows();
    break;
}
```

### 3. Use `workway_diagnose_workflow` for Complex Issues

```typescript
if (result.error.code?.startsWith('WORKFLOW_') || 
    result.error.code?.startsWith('EXECUTION_')) {
  const diagnosis = await callTool('workway_diagnose_workflow', {
    workflow_id: workflowId,
    symptom: 'execution_failed',
    execution_id: executionId
  });
  // Follow suggested_fix from diagnosis
}
```

### 4. Retry with Exponential Backoff

```typescript
async function callWithRetry(tool: string, params: any, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await callTool(tool, params);
    
    if (result.success) return result;
    
    // Don't retry on validation errors
    if (result.error.code?.startsWith('VALIDATION_')) {
      throw new Error(result.error.message);
    }
    
    // Retry on rate limits and system errors
    if (result.error.code === 'PROCORE_RATE_LIMITED') {
      const delay = result.error.retryAfter || Math.pow(2, attempt) * 1000;
      await sleep(delay * 1000);
      continue;
    }
    
    if (result.error.code?.startsWith('SYSTEM_')) {
      const delay = Math.pow(2, attempt) * 1000;
      await sleep(delay);
      continue;
    }
    
    throw new Error(result.error.message);
  }
}
```

### 5. Log Errors with Full Context

```typescript
logger.error('Tool execution failed', {
  tool: 'workway_deploy_workflow',
  errorCode: result.error.code,
  errorMessage: result.error.message,
  errorDetails: result.error.details,
  workflowId: workflowId,
  httpStatus: result.error.httpStatus,
});
```

---

## Common Error Scenarios

### Scenario 1: OAuth Token Expired

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_EXPIRED",
    "message": "Procore token expired. Please reconnect using workway_connect_procore.",
    "details": { "userId": "ww_abc123" },
    "httpStatus": 401
  }
}
```

**Solution:**
1. Call `workway_connect_procore` to get new authorization URL
2. Complete OAuth flow
3. Retry original operation

---

### Scenario 2: Procore Rate Limit

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "PROCORE_RATE_LIMITED",
    "message": "Procore rate limit exceeded. Retry after 60 seconds.",
    "retryAfter": 60,
    "details": { "remaining": 0 },
    "httpStatus": 429
  }
}
```

**Solution:**
1. Wait for `retryAfter` seconds
2. Implement exponential backoff for subsequent requests
3. Consider batching requests
4. See [RATE_LIMITS.md](./RATE_LIMITS.md) for limits

---

### Scenario 3: Workflow Deployment Failed

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "WORKFLOW_INVALID",
    "message": "Workflow validation failed: Workflow must have at least one action",
    "details": {
      "workflowId": "550e8400-e29b-41d4-a716-446655440000",
      "validationErrors": ["Workflow must have at least one action"]
    },
    "httpStatus": 400
  }
}
```

**Solution:**
1. Use `workway_add_workflow_action` to add actions
2. Use `workway_configure_workflow_trigger` to configure trigger
3. Retry `workway_deploy_workflow` with `dry_run: true` first

---

## TypeScript Error Classes

The MCP server provides typed error classes for programmatic use:

```typescript
import {
  WorkwayError,
  AuthError,
  ProcoreError,
  WorkflowError,
  ValidationError,
  SystemError,
  ExecutionError,
  ErrorCode,
} from '@workway/construction-mcp/lib/errors';

// Create typed errors
throw new ProcoreError(
  ErrorCode.PROCORE_NOT_CONNECTED,
  'Procore not connected.',
  { details: { userId: 'default' } }
);

// Convert to response format
const response = error.toResponse();
```

---

## Getting Help

If you encounter an error not listed here:

1. Use `workway_diagnose_workflow` to get detailed diagnosis
2. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
3. Review execution logs with `workway_observe_workflow_execution`
4. Contact support with:
   - Error code and full error response
   - Workflow ID (if applicable)
   - Execution ID (if applicable)
   - Connection ID (if applicable)