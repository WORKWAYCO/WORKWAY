# WORKWAY Construction MCP - Error Codes

Complete reference for all error codes returned by the MCP server.

## Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "error_code": "ERROR_CODE",
  "details": {
    "additional": "context"
  }
}
```

---

## Error Code Categories

### Authentication & Authorization (1xxx)

| Code | Message | Description | Solution |
|------|---------|-------------|----------|
| `AUTH_001` | Not connected to Procore | No OAuth token found | Call `workway_connect_procore` |
| `AUTH_002` | Procore token expired | OAuth token has expired | Reconnect using `workway_connect_procore` |
| `AUTH_003` | Invalid OAuth state | OAuth callback state mismatch | Retry OAuth flow |
| `AUTH_004` | Insufficient scopes | Token missing required scopes | Reconnect with correct scopes |
| `AUTH_005` | Token refresh failed | Automatic token refresh failed | Reconnect manually |

**Example:**
```json
{
  "success": false,
  "error": "Not connected to Procore. Use workway_connect_procore first.",
  "error_code": "AUTH_001"
}
```

---

### Workflow Errors (2xxx)

| Code | Message | Description | Solution |
|------|---------|-------------|----------|
| `WORKFLOW_001` | Workflow not found | Workflow ID doesn't exist | Check workflow ID or list workflows |
| `WORKFLOW_002` | Workflow has no actions | Cannot deploy empty workflow | Add actions with `workway_add_action` |
| `WORKFLOW_003` | Invalid trigger configuration | Trigger config missing required fields | Use `workway_configure_trigger` |
| `WORKFLOW_004` | Workflow already deployed | Attempting to deploy active workflow | Use `workway_rollback` first if needed |
| `WORKFLOW_005` | Invalid action type | Action type not recognized | Check supported action types |
| `WORKFLOW_006` | Action configuration invalid | Action config missing required fields | Review action type documentation |

**Example:**
```json
{
  "success": false,
  "error": "Workflow must have at least one action",
  "error_code": "WORKFLOW_002",
  "details": {
    "workflow_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### Procore API Errors (3xxx)

| Code | Message | Description | Solution |
|------|---------|-------------|----------|
| `PROCORE_001` | Procore API error | Generic Procore API failure | Check Procore API status |
| `PROCORE_002` | Project not found | Procore project ID invalid | Verify project ID with `workway_list_procore_projects` |
| `PROCORE_003` | Permission denied | Insufficient Procore permissions | Check Procore user permissions |
| `PROCORE_004` | Rate limit exceeded | Too many Procore API requests | See [RATE_LIMITS.md](./RATE_LIMITS.md) |
| `PROCORE_005` | Invalid project ID | Project ID format invalid | Use numeric project ID |

**Example:**
```json
{
  "success": false,
  "error": "Procore API error: 404 - Project not found",
  "error_code": "PROCORE_002",
  "details": {
    "project_id": 99999,
    "procore_status": 404
  }
}
```

---

### Validation Errors (4xxx)

| Code | Message | Description | Solution |
|------|---------|-------------|----------|
| `VALIDATION_001` | Invalid parameter | Parameter validation failed | Check parameter format |
| `VALIDATION_002` | Missing required parameter | Required parameter not provided | Provide all required parameters |
| `VALIDATION_003` | Invalid cron expression | Cron schedule format invalid | Use valid cron syntax |
| `VALIDATION_004` | Invalid date format | Date format incorrect | Use YYYY-MM-DD format |
| `VALIDATION_005` | Invalid workflow ID format | Workflow ID format invalid | Use UUID format |

**Example:**
```json
{
  "success": false,
  "error": "Invalid cron expression: '0 9 * *'",
  "error_code": "VALIDATION_003",
  "details": {
    "field": "cron_schedule",
    "provided": "0 9 * *",
    "expected_format": "minute hour day month weekday"
  }
}
```

---

### Execution Errors (5xxx)

| Code | Message | Description | Solution |
|------|---------|-------------|----------|
| `EXECUTION_001` | Execution not found | Execution ID doesn't exist | Check execution ID |
| `EXECUTION_002` | Execution timeout | Workflow execution exceeded time limit | Optimize workflow or break into steps |
| `EXECUTION_003` | Action execution failed | Individual action failed | Use `workway_diagnose` for details |
| `EXECUTION_004` | Workflow execution failed | Workflow failed during execution | Check execution logs |

**Example:**
```json
{
  "success": false,
  "error": "Action execution failed: procore.rfi.respond",
  "error_code": "EXECUTION_003",
  "details": {
    "execution_id": "880e8400-e29b-41d4-a716-446655440003",
    "action_id": "660e8400-e29b-41d4-a716-446655440001",
    "action_type": "procore.rfi.respond",
    "underlying_error": "RFI not found"
  }
}
```

---

### System Errors (9xxx)

| Code | Message | Description | Solution |
|------|---------|-------------|----------|
| `SYSTEM_001` | Internal server error | Unexpected server error | Contact support |
| `SYSTEM_002` | Database error | Database operation failed | Retry or contact support |
| `SYSTEM_003` | Service unavailable | MCP server temporarily unavailable | Retry after delay |
| `SYSTEM_004` | Configuration error | Server configuration invalid | Contact support |

**Example:**
```json
{
  "success": false,
  "error": "Internal server error",
  "error_code": "SYSTEM_001",
  "details": {
    "request_id": "req-12345",
    "timestamp": "2026-02-03T10:00:00Z"
  }
}
```

---

## HTTP Status Codes

The MCP server uses standard HTTP status codes:

| Status | Meaning | Common Error Codes |
|--------|---------|-------------------|
| `200` | Success | N/A |
| `400` | Bad Request | `VALIDATION_*`, `WORKFLOW_*` |
| `401` | Unauthorized | `AUTH_001`, `AUTH_002` |
| `403` | Forbidden | `AUTH_004`, `PROCORE_003` |
| `404` | Not Found | `WORKFLOW_001`, `PROCORE_002`, `EXECUTION_001` |
| `429` | Too Many Requests | `PROCORE_004` |
| `500` | Internal Server Error | `SYSTEM_*` |
| `503` | Service Unavailable | `SYSTEM_003` |

---

## Error Handling Best Practices

### 1. Always Check `success` Field

```javascript
const result = await callTool('workway_create_workflow', params);

if (!result.success) {
  // Handle error
  console.error(`Error ${result.error_code}: ${result.error}`);
  // Use error_code to determine recovery strategy
}
```

### 2. Use Error Codes for Programmatic Handling

```javascript
switch (result.error_code) {
  case 'AUTH_001':
    // Redirect to OAuth flow
    await connectProcore();
    break;
  case 'PROCORE_004':
    // Implement exponential backoff
    await sleep(calculateBackoff(retryCount));
    break;
  case 'VALIDATION_002':
    // Show user-friendly validation message
    showValidationError(result.details.field);
    break;
}
```

### 3. Use `workway_diagnose` for Complex Issues

```javascript
if (result.error_code?.startsWith('EXECUTION_')) {
  const diagnosis = await callTool('workway_diagnose', {
    workflow_id: workflowId,
    symptom: 'action_failed',
    execution_id: executionId
  });
  // Follow suggested_fix from diagnosis
}
```

### 4. Log Errors with Context

```javascript
logger.error('Tool execution failed', {
  tool: 'workway_deploy',
  error_code: result.error_code,
  error: result.error,
  details: result.details,
  workflow_id: workflowId
});
```

---

## Common Error Scenarios

### Scenario 1: OAuth Token Expired

**Error:**
```json
{
  "error_code": "AUTH_002",
  "error": "Procore token expired. Please reconnect."
}
```

**Solution:**
1. Call `workway_connect_procore` to get new authorization URL
2. Complete OAuth flow
3. Retry original operation

---

### Scenario 2: Workflow Deployment Failed

**Error:**
```json
{
  "error_code": "WORKFLOW_002",
  "error": "Workflow must have at least one action",
  "validation_errors": [
    "Workflow must have at least one action",
    "Webhook trigger requires source and event_types configuration"
  ]
}
```

**Solution:**
1. Use `workway_add_action` to add actions
2. Use `workway_configure_trigger` to configure trigger
3. Retry `workway_deploy` with `dry_run: true` first

---

### Scenario 3: Procore Rate Limit

**Error:**
```json
{
  "error_code": "PROCORE_004",
  "error": "Rate limit exceeded",
  "details": {
    "retry_after": 60,
    "limit": 100,
    "remaining": 0
  }
}
```

**Solution:**
1. Wait for `retry_after` seconds
2. Implement exponential backoff
3. Consider batching requests
4. See [RATE_LIMITS.md](./RATE_LIMITS.md) for limits

---

## Error Recovery Patterns

### Retry with Exponential Backoff

```javascript
async function callWithRetry(tool, params, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await callTool(tool, params);
    
    if (result.success) return result;
    
    // Don't retry on validation errors
    if (result.error_code?.startsWith('VALIDATION_')) {
      throw new Error(result.error);
    }
    
    // Retry on rate limits and system errors
    if (result.error_code === 'PROCORE_004' || result.error_code?.startsWith('SYSTEM_')) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await sleep(delay);
      continue;
    }
    
    throw new Error(result.error);
  }
}
```

---

## Getting Help

If you encounter an error not listed here:

1. Use `workway_diagnose` to get detailed diagnosis
2. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
3. Review execution logs with `workway_observe_execution`
4. Contact support with:
   - Error code
   - Full error response
   - Workflow ID (if applicable)
   - Execution ID (if applicable)
