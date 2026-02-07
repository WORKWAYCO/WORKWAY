# WORKWAY Construction MCP - Deployment Guide

Complete guide for deploying the WORKWAY Construction MCP server to Cloudflare Workers.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [Health Checks](#health-checks)
- [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

Before deploying, ensure you have:

- [ ] Node.js 18+ installed
- [ ] Cloudflare account with Workers enabled
- [ ] Wrangler CLI installed (`npm install -g wrangler`)
- [ ] Procore Developer account (for OAuth setup)
- [ ] Access to Cloudflare dashboard

---

## Local Development

### 1. Install Dependencies

```bash
cd Cloudflare/packages/workway-construction-mcp
pnpm install
```

### 2. Create D1 Database

```bash
# Create database
wrangler d1 create workway-construction

# Note the database_id from output
# Update wrangler.toml with the database_id
```

### 3. Update wrangler.toml

```toml
[[d1_databases]]
binding = "DB"
database_name = "workway-construction"
database_id = "your-database-id-here"  # From step 2
```

### 4. Run Migrations Locally

```bash
# Apply migrations to local D1
pnpm migrate:local
```

### 5. Set Local Secrets

```bash
# Procore OAuth credentials
wrangler secret put PROCORE_CLIENT_ID
wrangler secret put PROCORE_CLIENT_SECRET

# Cookie encryption key (generate with: openssl rand -hex 32)
wrangler secret put COOKIE_ENCRYPTION_KEY
```

### 6. Start Development Server

```bash
pnpm dev
```

The server will start at `http://localhost:8787`

### 7. Test Locally

```bash
# Health check
curl http://localhost:8787/health

# List tools
curl http://localhost:8787/mcp/tools
```

---

## Production Deployment

### 1. Verify Configuration

Check `wrangler.toml`:

```toml
name = "workway-construction-mcp"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "workway-construction"
database_id = "your-production-database-id"

# KV Namespace
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

# Durable Objects
[[durable_objects.bindings]]
name = "WORKFLOW_STATE"
class_name = "WorkflowState"
```

### 2. Create Production Resources

```bash
# Create production D1 database
wrangler d1 create workway-construction --env production

# Create KV namespace
wrangler kv:namespace create "KV" --env production

# Update wrangler.toml with IDs
```

### 3. Run Production Migrations

```bash
# Apply migrations to production D1
pnpm migrate:remote
```

### 4. Set Production Secrets

```bash
# Set secrets for production
wrangler secret put PROCORE_CLIENT_ID --env production
wrangler secret put PROCORE_CLIENT_SECRET --env production
wrangler secret put COOKIE_ENCRYPTION_KEY --env production
```

### 5. Deploy to Cloudflare Workers

```bash
# Deploy
pnpm deploy

# Or with wrangler directly
wrangler deploy --env production
```

### 6. Verify Deployment

```bash
# Check deployment status
wrangler deployments list

# Test health endpoint
curl https://workway-construction-mcp.workers.dev/health

# Test MCP endpoint
curl https://workway-construction-mcp.workers.dev/mcp
```

---

## Configuration

### Environment Variables

Set via `wrangler secret put`:

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `PROCORE_CLIENT_ID` | Procore OAuth client ID | Yes | `abc123...` |
| `PROCORE_CLIENT_SECRET` | Procore OAuth client secret | Yes | `xyz789...` |
| `COOKIE_ENCRYPTION_KEY` | 32-byte hex key for cookie encryption | Yes | `a1b2c3...` |

### wrangler.toml Configuration

```toml
# Worker name
name = "workway-construction-mcp"

# Entry point
main = "src/index.ts"

# Compatibility date
compatibility_date = "2024-12-01"

# Node.js compatibility
compatibility_flags = ["nodejs_compat"]

# Account ID (from Cloudflare dashboard)
account_id = "your-account-id"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "workway-construction"
database_id = "your-database-id"

# KV Namespace
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

# Durable Objects
[[durable_objects.bindings]]
name = "WORKFLOW_STATE"
class_name = "WorkflowState"

# Migrations
[[migrations]]
tag = "v1"
new_classes = ["WorkflowState"]

# Environment variables
[vars]
ENVIRONMENT = "production"
```

### Database Schema

The initial schema is defined in `migrations/0001_initial.sql`:

- `workflows` - Workflow definitions
- `workflow_actions` - Workflow action steps
- `executions` - Execution history
- `execution_steps` - Detailed execution traces
- `oauth_tokens` - OAuth token storage
- `rfi_outcomes` - RFI outcome data for learning

Apply migrations:

```bash
# Local
pnpm migrate:local

# Production
pnpm migrate:remote
```

---

## Health Checks

### Health Endpoint

```bash
curl https://workway-construction-mcp.workers.dev/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "timestamp": "2026-02-03T10:00:00Z"
}
```

### MCP Server Info

```bash
curl https://workway-construction-mcp.workers.dev/mcp
```

**Response:**
```json
{
  "name": "workway-construction-mcp",
  "version": "0.1.0",
  "description": "The Automation Layer - AI-native workflow automation for construction",
  "capabilities": {
    "tools": { "listChanged": true },
    "resources": { "subscribe": false, "listChanged": true },
    "prompts": { "listChanged": false }
  }
}
```

### Monitoring Checklist

- [ ] Health endpoint returns 200
- [ ] MCP endpoint returns server info
- [ ] Database queries succeed
- [ ] OAuth flow works
- [ ] Webhook endpoints respond
- [ ] Tool execution works

---

## Rollback Procedures

### Rollback Deployment

```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback --message "Rollback to v0.0.9"
```

### Rollback Database Migrations

⚠️ **Warning:** Database rollbacks can cause data loss. Always backup first.

```bash
# Backup database
wrangler d1 export workway-construction --output backup.sql

# If rollback needed, restore from backup
wrangler d1 execute workway-construction --file=backup.sql
```

### Emergency Procedures

1. **Pause all workflows:**
   ```bash
   # Use workway_rollback_workflow tool for each workflow
   # Or update database directly if needed
   ```

2. **Disable webhooks:**
   - Update workflow statuses to `paused`
   - Or remove webhook subscriptions in Procore

3. **Contact support:**
   - Document issue
   - Collect logs
   - Provide deployment details

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Code reviewed
- [ ] Migrations tested locally
- [ ] Secrets configured
- [ ] Configuration verified
- [ ] Documentation updated

### Deployment

- [ ] Run migrations
- [ ] Deploy worker
- [ ] Verify health endpoint
- [ ] Test MCP endpoints
- [ ] Test OAuth flow
- [ ] Test workflow execution

### Post-Deployment

- [ ] Monitor error logs
- [ ] Check execution success rate
- [ ] Verify webhook deliveries
- [ ] Test critical workflows
- [ ] Update deployment log

---

## Troubleshooting

### Deployment Fails

**Issue:** `wrangler deploy` fails

**Solutions:**
1. Check `wrangler.toml` syntax
2. Verify account ID
3. Check Cloudflare API token
4. Review error messages
5. Check Worker limits

### Database Migration Fails

**Issue:** Migrations fail in production

**Solutions:**
1. Test migrations locally first
2. Check database permissions
3. Verify database ID in config
4. Review migration SQL syntax
5. Check for conflicting migrations

### Secrets Not Working

**Issue:** Secrets not accessible in production

**Solutions:**
1. Verify secrets set with correct environment
2. Check secret names match code
3. Re-set secrets if needed
4. Verify `wrangler secret list`

### Health Check Fails

**Issue:** Health endpoint returns error

**Solutions:**
1. Check worker logs in Cloudflare dashboard
2. Verify database connectivity
3. Check environment variables
4. Review recent code changes
5. Check Cloudflare status page

---

## Best Practices

1. **Always test locally first:**
   - Use `pnpm dev` for local testing
   - Test migrations locally
   - Verify configuration

2. **Use staging environment:**
   - Deploy to staging before production
   - Test workflows in staging
   - Verify OAuth in staging

3. **Monitor deployments:**
   - Check health endpoints after deploy
   - Monitor error rates
   - Review execution logs

4. **Backup before migrations:**
   - Export database before migrations
   - Keep migration backups
   - Test rollback procedures

5. **Document changes:**
   - Update CHANGELOG.md
   - Document breaking changes
   - Update API documentation

---

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database Guide](https://developers.cloudflare.com/d1/)
- [WORKWAY API Reference](./API_REFERENCE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
