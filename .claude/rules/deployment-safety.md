# Deployment Safety

Safe deployment patterns for WORKWAY infrastructure.

## Project Names

| Service | Project Name | Domain |
|---------|--------------|--------|
| Design Tokens CDN | `design-tokens` | `cdn.workway.co` |
| F→N Web | `f-n-web` | `fireflies-notion.workway.co` |
| Workway Web | `workway-web` | `workway.co` |
| Workway API | `workway-api` | `api.workway.co` |

## Deployment Commands

### Workers (Cloudflare repo)

```bash
# Deploy specific worker
cd packages/workers/design-tokens
pnpm deploy

# Deploy all workers
pnpm deploy:all

# Preview before deploy
pnpm deploy --dry-run
```

### Platform (workway-platform repo)

```bash
# Deploy API
cd apps/api
pnpm deploy

# Deploy Web
cd apps/web
pnpm deploy
```

## Safety Checks

### Before ANY deployment:

1. **Tests pass**: `pnpm test`
2. **Lint clean**: `pnpm lint`
3. **Build succeeds**: `pnpm build`
4. **Git clean**: No uncommitted changes

### Before production deployment:

1. **Preview first**: Deploy to preview environment
2. **Smoke test**: Verify critical paths work
3. **Check dependencies**: `bd blocked` for dependency issues
4. **Announce**: Inform team in Slack if significant change

## Rollback

### Workway API (workway-platform/apps/api)

```bash
# Navigate to API directory
cd /path/to/workway-platform/apps/api

# List recent deployments with version IDs
wrangler deployments list --name workway-api

# Rollback to specific deployment (copy version ID from list above)
wrangler rollback --name workway-api --version <version-id>

# Example:
# wrangler rollback --name workway-api --version e64e3619-fa71-4d60-b5bb-4089a0e230e8

# Verify rollback
wrangler deployments list --name workway-api | head -5
```

**Post-rollback verification:**
1. Test auth endpoints: `curl https://api.workway.co/auth/session`
2. Check D1 database connectivity: `wrangler d1 execute marketplace-production --remote --command "SELECT 1"`
3. Verify cron triggers are running: Check Cloudflare dashboard → Workers & Pages → workway-api → Triggers
4. Test critical integrations (OAuth flows, workflow execution)

### Workway Web (workway-platform/apps/web)

```bash
# Navigate to Web directory
cd /path/to/workway-platform/apps/web

# List recent deployments with version IDs
wrangler deployments list --name workway-web

# Rollback to specific deployment (copy version ID from list above)
wrangler rollback --name workway-web --version <version-id>

# Example:
# wrangler rollback --name workway-web --version c77e12d1-d0af-48c9-845f-ff3cdfa717d6

# Verify rollback
wrangler deployments list --name workway-web | head -5
```

**Post-rollback verification:**
1. Visit `https://workway.co` in browser
2. Test user login flow
3. Check static assets load (CSS, JS)
4. Verify API connectivity (dashboard loads data)
5. Test critical user paths (workflow creation, integration setup)

### Workers (Cloudflare repo)

```bash
# Example: Design Tokens CDN
cd packages/workers/design-tokens

# List recent deployments
wrangler deployments list --name design-tokens

# Rollback to previous version
wrangler rollback --name design-tokens --version <version-id>
```

### Database migrations

Migrations are **irreversible by default**. For reversible changes:

1. Create down migration
2. Test rollback in preview
3. Deploy with confidence

**Critical**: Never rollback a Worker if the database schema changed. You must:
1. Deploy a new migration that reverts the schema
2. Then rollback the Worker code

## Environment Variables

Never commit secrets. Use:

```bash
# Set secret
wrangler secret put SECRET_NAME

# List secrets
wrangler secret list
```

## Incident Response: Emergency Rollback

When production is broken and users are affected:

### 1. Immediate Rollback (< 2 minutes)

```bash
# API is down - rollback immediately
cd /path/to/workway-platform/apps/api
wrangler deployments list --name workway-api | head -10
wrangler rollback --name workway-api --version <previous-version-id>

# Web is broken - rollback immediately
cd /path/to/workway-platform/apps/web
wrangler deployments list --name workway-web | head -10
wrangler rollback --name workway-web --version <previous-version-id>
```

### 2. Quick Verification (< 1 minute)

```bash
# API health check
curl https://api.workway.co/health

# Web health check
curl -I https://workway.co

# Check error rates in Cloudflare dashboard
# Navigate to: Workers & Pages → workway-api → Metrics
```

### 3. Post-Incident Review (after stability restored)

1. **Identify root cause**: What broke? Code? Config? Schema?
2. **Document timeline**: When deployed? When noticed? When rolled back?
3. **Create issue**: `bd create "Fix: [incident summary]" --label P0 --label bug`
4. **Update runbook**: Add failure mode to this document

### 4. Rollback Decision Matrix

| Scenario | Action | Timeline |
|----------|--------|----------|
| API 5xx errors spiked | Rollback immediately | < 2 min |
| Web UI not loading | Rollback immediately | < 2 min |
| Authentication broken | Rollback immediately | < 2 min |
| Slow performance (no errors) | Monitor first, rollback if worsens | 5-10 min |
| Minor UI bug | Fix forward, don't rollback | N/A |
| Schema migration failed | **Do NOT rollback Worker** - see Database section | Depends |

### 5. Communication Protocol

During incident:
1. **Internal**: Post in #engineering Slack immediately
2. **Status page**: Update if user-facing impact > 5 minutes
3. **Post-mortem**: Document in `docs/incidents/YYYY-MM-DD-summary.md`

## Dangerous Operations

| Operation | Risk | Mitigation |
|-----------|------|------------|
| `DROP TABLE` | Data loss | Backup first, soft-delete preferred |
| `wrangler delete` | Service outage | Double-check project name |
| Force push | History loss | Never to main/master |
| Schema migration | Breaking change | Test in preview first |
| Rollback after schema change | Data corruption | Revert schema first, then rollback code |

## Deployment Health Monitoring

### Real-time Metrics

**Cloudflare Dashboard locations:**
- API metrics: `Workers & Pages → workway-api → Metrics`
- Web metrics: `Workers & Pages → workway-web → Metrics`
- Database: `D1 → marketplace-production → Metrics`

**Key metrics to watch post-deployment:**
1. **Request rate**: Should remain stable, no sudden drops
2. **Error rate**: Should be < 1%, ideally < 0.1%
3. **P50/P95 latency**: API < 200ms, Web < 500ms
4. **CPU time**: Should not spike > 50ms consistently

### Automated Health Checks

Create a deployment verification script:

```bash
#!/bin/bash
# scripts/verify-deployment.sh
# Run after every production deployment

echo "🔍 Verifying deployment health..."

# API health
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.workway.co/health)
if [ "$API_STATUS" = "200" ]; then
  echo "✅ API: Healthy ($API_STATUS)"
else
  echo "❌ API: Unhealthy ($API_STATUS)"
  exit 1
fi

# Web health
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://workway.co)
if [ "$WEB_STATUS" = "200" ]; then
  echo "✅ Web: Healthy ($WEB_STATUS)"
else
  echo "❌ Web: Unhealthy ($WEB_STATUS)"
  exit 1
fi

# Database connectivity
DB_CHECK=$(wrangler d1 execute marketplace-production --remote --command "SELECT 1" 2>&1)
if echo "$DB_CHECK" | grep -q "1"; then
  echo "✅ Database: Connected"
else
  echo "❌ Database: Connection failed"
  exit 1
fi

echo "✅ All systems healthy"
```

### Quick Rollback Script

For emergency situations, use this one-liner:

```bash
# Rollback API to previous deployment
cd /path/to/workway-platform/apps/api && \
  wrangler rollback --name workway-api --version $(wrangler deployments list --name workway-api --json | jq -r '.[1].versions[0].id')

# Rollback Web to previous deployment
cd /path/to/workway-platform/apps/web && \
  wrangler rollback --name workway-web --version $(wrangler deployments list --name workway-web --json | jq -r '.[1].versions[0].id')
```

## Zuhandenheit

Deployment should recede:
- CI/CD handles routine deploys
- Manual deploys only for hotfixes
- Rollback is one command away
- Health checks are automated
- Secrets never touch git
