# WORKWAY Construction MCP - Troubleshooting Guide

Common issues and solutions for the WORKWAY Construction MCP server.

## Quick Diagnosis

**Start here:** Use `workway_diagnose_workflow` tool with your symptom:

```json
{
  "workflow_id": "your-workflow-id",
  "symptom": "webhook_not_firing",
  "context": "Additional details about what you're seeing"
}
```

---

## Common Issues

### 1. Procore Connection Issues

#### Problem: "Not connected to Procore" error

**Symptoms:**
- `AUTH_001` error when calling Procore tools
- `workway_check_procore_connection` returns `connected: false`

**Solutions:**

1. **Check if you've connected:**
   ```json
   {
     "tool": "workway_check_procore_connection",
     "params": {}
   }
   ```

2. **If not connected, initiate OAuth:**
   ```json
   {
     "tool": "workway_connect_procore",
     "params": {}
   }
   ```
   Then visit the `authorization_url` returned.

3. **If connection exists but expired:**
   - Token expiration is automatic, but if refresh fails:
   - Reconnect using `workway_connect_procore`
   - See [PROCORE_OAUTH_SETUP.md](./PROCORE_OAUTH_SETUP.md) for detailed steps

**Prevention:**
- Tokens auto-refresh, but monitor connection status periodically
- Set up alerts for token expiration

---

#### Problem: OAuth callback fails

**Symptoms:**
- Redirected to callback URL but connection fails
- `AUTH_003` error: "Invalid OAuth state"

**Solutions:**

1. **State mismatch:**
   - OAuth state expires after 10 minutes
   - Complete OAuth flow within 10 minutes
   - Don't refresh the authorization URL page

2. **Callback URL mismatch:**
   - Ensure Procore OAuth app callback URL matches exactly:
     `https://construction.mcp.workway.co/oauth/callback`
   - Check for trailing slashes or protocol mismatches

3. **Retry OAuth flow:**
   - Get new authorization URL
   - Complete flow in single session

**Prevention:**
- Bookmark the authorization URL if needed
- Complete OAuth flow immediately after getting URL

---

### 2. Workflow Deployment Issues

#### Problem: Deployment validation fails

**Symptoms:**
- `workway_deploy_workflow` returns validation errors
- `WORKFLOW_002` or `WORKFLOW_003` errors

**Solutions:**

1. **Check workflow configuration:**
   ```json
   {
     "tool": "workway_list_workflows",
     "params": { "status": "all" }
   }
   ```

2. **Common validation failures:**

   **Missing actions:**
   ```json
   {
     "validation_errors": ["Workflow must have at least one action"]
   }
   ```
   **Fix:** Add actions with `workway_add_workflow_action`

   **Missing trigger config:**
   ```json
   {
     "validation_errors": ["Webhook trigger requires source and event_types configuration"]
   }
   ```
   **Fix:** Configure trigger with `workway_configure_workflow_trigger`

3. **Use dry run first:**
   ```json
   {
     "tool": "workway_deploy_workflow",
     "params": {
       "workflow_id": "your-workflow-id",
       "dry_run": true
     }
   }
   ```
   This validates without deploying.

**Prevention:**
- Always use `dry_run: true` before deploying
- Follow workflow creation checklist:
  1. Create workflow
  2. Configure trigger
  3. Add actions
  4. Test with `workway_test_workflow`
  5. Deploy with `dry_run: true`
  6. Deploy for real

---

#### Problem: Webhook not receiving events

**Symptoms:**
- Workflow deployed but no executions
- `workway_diagnose_workflow` with `symptom: "webhook_not_firing"`

**Solutions:**

1. **Verify webhook URL:**
   ```json
   {
     "tool": "workway_diagnose_workflow",
     "params": {
       "workflow_id": "your-workflow-id",
       "symptom": "webhook_not_firing"
     }
   }
   ```
   Check the `webhook_url` in response.

2. **Procore webhook setup:**
   - Procore webhooks require project-level configuration
   - Ensure webhook is registered in Procore project settings
   - Verify event types match Procore's available events

3. **Test webhook manually:**
   ```bash
   curl -X POST https://workway-construction-mcp.workers.dev/webhooks/your-workflow-id \
     -H "Content-Type: application/json" \
     -d '{"test": "event"}'
   ```

4. **Check workflow status:**
   - Ensure workflow status is `active`
   - Use `workway_list_workflows` to verify

**Prevention:**
- Test webhook endpoint before deploying workflow
- Verify Procore project has webhook access enabled
- Monitor execution logs for webhook receipts

---

### 3. Execution Failures

#### Problem: Workflow execution fails

**Symptoms:**
- Executions show `status: "failed"`
- `EXECUTION_003` or `EXECUTION_004` errors

**Solutions:**

1. **Get execution details:**
   ```json
   {
     "tool": "workway_observe_workflow_execution",
     "params": {
       "execution_id": "your-execution-id"
     }
   }
   ```

2. **Diagnose specific failure:**
   ```json
   {
     "tool": "workway_diagnose_workflow",
     "params": {
       "workflow_id": "your-workflow-id",
       "symptom": "action_failed",
       "execution_id": "your-execution-id"
     }
   }
   ```

3. **Common failure causes:**

   **Procore API errors:**
   - Check Procore API status
   - Verify project access permissions
   - Check rate limits

   **Action configuration errors:**
   - Review action config parameters
   - Check required fields for action type
   - Verify data format matches expectations

   **Timeout errors:**
   - Break workflow into smaller steps
   - Check external API response times
   - Consider async action execution

**Prevention:**
- Test workflows with `workway_test_workflow` before deploying
- Monitor execution logs regularly
- Set up alerts for failed executions

---

#### Problem: AI output incorrect

**Symptoms:**
- AI-generated content doesn't match expectations
- `workway_diagnose_workflow` with `symptom: "ai_output_wrong"`

**Solutions:**

1. **Add human review step:**
   - AI outputs benefit from human validation
   - Add `human.review` or `human.approve` task after AI generation
   - See AI Interaction Atlas patterns

2. **Improve AI context:**
   - Provide more context in action config
   - Include historical examples
   - Specify output format requirements

3. **Adjust confidence thresholds:**
   ```json
   {
     "action_type": "ai.generate_rfi_response",
     "config": {
       "confidence_threshold": 0.8  // Increase for higher quality
     }
   }
   ```

4. **Use similar RFI search:**
   - Search historical RFIs first
   - Use similar responses as context
   - Improve prompt with examples

**Prevention:**
- Always include human review for critical outputs
- Start with lower confidence thresholds and adjust
- Monitor AI output quality over time

---

### 4. Rate Limiting

#### Problem: Rate limit exceeded

**Symptoms:**
- `PROCORE_004` error: "Rate limit exceeded"
- Requests fail with 429 status

**Solutions:**

1. **Check rate limit details:**
   ```json
   {
     "error_code": "PROCORE_004",
     "details": {
       "retry_after": 60,
       "limit": 100,
       "remaining": 0
     }
   }
   ```

2. **Implement exponential backoff:**
   ```javascript
   async function callWithRetry(tool, params) {
     for (let attempt = 0; attempt < 3; attempt++) {
       const result = await callTool(tool, params);
       if (result.success) return result;
       
       if (result.error_code === 'PROCORE_004') {
         const delay = Math.pow(2, attempt) * 1000;
         await sleep(delay);
         continue;
       }
     }
   }
   ```

3. **Reduce request frequency:**
   - Batch requests where possible
   - Cache frequently accessed data
   - Use webhooks instead of polling

4. **Monitor usage:**
   - Track API call counts
   - Set up alerts before hitting limits
   - See [RATE_LIMITS.md](./RATE_LIMITS.md) for limits

**Prevention:**
- Implement request queuing
- Use caching for read operations
- Monitor rate limit headers in responses

---

### 5. Configuration Issues

#### Problem: Invalid cron expression

**Symptoms:**
- `VALIDATION_003` error: "Invalid cron expression"
- Cron schedule not working

**Solutions:**

1. **Verify cron format:**
   ```
   minute hour day month weekday
   0     9    *   *    1-5
   ```

2. **Common valid expressions:**
   - `"0 9 * * 1-5"` - Weekdays at 9 AM
   - `"0 17 * * *"` - Every day at 5 PM
   - `"0 */2 * * *"` - Every 2 hours
   - `"0 0 1 * *"` - First day of month at midnight

3. **Test cron expression:**
   - Use online cron validators
   - Test with `dry_run: true` first

**Prevention:**
- Use cron expression validators
- Test schedules before deploying
- Document cron expressions in workflow descriptions

---

#### Problem: Invalid project ID

**Symptoms:**
- `PROCORE_002` error: "Project not found"
- `VALIDATION_005` error: "Invalid project ID format"

**Solutions:**

1. **List available projects:**
   ```json
   {
     "tool": "workway_list_procore_projects",
     "params": {}
   }
   ```

2. **Verify project ID format:**
   - Procore project IDs are numeric (e.g., `12345`)
   - Not UUIDs or strings
   - Check project exists in your account

3. **Check project access:**
   - Ensure you have access to the project
   - Verify Procore user permissions
   - Check company/project association

**Prevention:**
- Always list projects first
- Store project IDs in configuration
- Validate project IDs before use

---

## Diagnostic Workflow

When troubleshooting, follow this workflow:

1. **Identify symptom:**
   - What exactly is failing?
   - What error code/message?
   - When does it happen?

2. **Use diagnose tool:**
   ```json
   {
     "tool": "workway_diagnose_workflow",
     "params": {
       "workflow_id": "...",
       "symptom": "...",
       "context": "What you observed"
     }
   }
   ```

3. **Follow suggested fix:**
   - Check `suggested_fix` in diagnosis
   - Use `fix_tool` and `fix_params` if provided
   - Review logs for additional context

4. **Verify solution:**
   - Test with `workway_test_workflow` if applicable
   - Check execution logs
   - Monitor for recurrence

5. **If still stuck:**
   - Use `workway_get_workflow_guidance` for guidance
   - Review execution traces with `workway_observe_workflow_execution`
   - Check error codes in [ERROR_CODES.md](./ERROR_CODES.md)

---

## Getting Additional Help

If issues persist:

1. **Collect diagnostic information:**
   - Workflow ID
   - Execution ID (if applicable)
   - Error code and message
   - Full error response
   - Steps to reproduce

2. **Review documentation:**
   - [API_REFERENCE.md](./API_REFERENCE.md) - Tool documentation
   - [ERROR_CODES.md](./ERROR_CODES.md) - Error code reference
   - [PROCORE_OAUTH_SETUP.md](./PROCORE_OAUTH_SETUP.md) - OAuth setup

3. **Contact support:**
   - Include all diagnostic information
   - Provide workflow configuration (if possible)
   - Share execution logs

---

## Prevention Checklist

To avoid common issues:

- [ ] Always test workflows with `workway_test_workflow` before deploying
- [ ] Use `dry_run: true` for deployment validation
- [ ] Monitor Procore connection status regularly
- [ ] Implement error handling and retries
- [ ] Set up alerts for failed executions
- [ ] Review execution logs periodically
- [ ] Keep workflows simple and focused
- [ ] Document workflow configurations
- [ ] Test OAuth flow after setup
- [ ] Verify webhook URLs before deploying
