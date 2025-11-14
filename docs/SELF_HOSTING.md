# Self-Hosting WORKWAY

This guide will help you deploy WORKWAY on your own Cloudflare account. The entire platform can run on Cloudflare's free tier for small-scale usage.

## Prerequisites

### Required Cloudflare Services

- **Cloudflare Account**: Free tier is sufficient to start
- **Workers**: For API and workflow execution
- **D1 Database**: For data storage (5GB free)
- **KV Namespaces**: For session storage
- **Durable Objects**: For workflow state management
- **Pages** (optional): For hosting the web UI

### Required Tools

- Node.js 18+ and npm 10+
- Wrangler CLI (Cloudflare's deployment tool)
- Git

## Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/workway/workway.git
cd workway

# Install dependencies
npm install

# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

## Step 2: Create Cloudflare Resources

### Create D1 Database

```bash
# Create the database
wrangler d1 create workway-db

# Note the database_id returned, you'll need it for configuration
```

### Create KV Namespaces

```bash
# Create sessions namespace
wrangler kv:namespace create sessions

# Create cache namespace
wrangler kv:namespace create cache

# Note the namespace IDs returned
```

### Enable Durable Objects

Durable Objects are automatically created when you deploy, but ensure they're enabled in your Cloudflare account.

## Step 3: Configuration

### Create Configuration File

Create `apps/api/wrangler.toml` from the template:

```toml
name = "workway-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

# Replace with your account ID (find it in Cloudflare dashboard)
account_id = "YOUR_ACCOUNT_ID"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "workway-db"
database_id = "YOUR_DATABASE_ID"  # From step 2

# KV Namespace bindings
[[kv_namespaces]]
binding = "SESSIONS"
id = "YOUR_SESSIONS_NAMESPACE_ID"  # From step 2

[[kv_namespaces]]
binding = "CACHE"
id = "YOUR_CACHE_NAMESPACE_ID"  # From step 2

# Durable Objects
[durable_objects]
bindings = [
  { name = "OAUTH", class_name = "OAuth" },
  { name = "WORKFLOW_EXECUTOR", class_name = "WorkflowExecutor" }
]

# Migrations for Durable Objects
[[migrations]]
tag = "v1"
new_classes = ["OAuth", "WorkflowExecutor"]
```

### Set Environment Variables

Create `apps/api/.dev.vars` for local development:

```env
# Stripe (optional - for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OAuth Credentials (add as needed)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NOTION_CLIENT_ID=your_client_id
NOTION_CLIENT_SECRET=your_client_secret

# Security
JWT_SECRET=your-secret-key-here

# API Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.com
```

For production, set these as secrets:

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put JWT_SECRET
# ... repeat for each secret
```

## Step 4: Database Setup

### Run Migrations

```bash
cd apps/api

# Apply migrations to create database schema
wrangler d1 migrations apply workway-db
```

### Verify Database

```bash
# Test the database connection
wrangler d1 execute workway-db --command "SELECT name FROM sqlite_master WHERE type='table'"
```

## Step 5: Deploy the API

```bash
cd apps/api

# Deploy to Cloudflare Workers
wrangler deploy

# Your API will be available at:
# https://workway-api.YOUR-SUBDOMAIN.workers.dev
```

## Step 6: Deploy the Web UI (Optional)

If you want to self-host the web interface:

```bash
cd apps/web

# Build the application
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name workway-web

# Your web app will be available at:
# https://workway-web.pages.dev
```

## Step 7: Configure OAuth Providers

For each OAuth provider you want to use:

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `https://your-api-domain.workers.dev/api/oauth/callback/google`

### Notion OAuth

1. Go to [Notion Developers](https://www.notion.com/my-integrations)
2. Create a new integration
3. Set redirect URI: `https://your-api-domain.workers.dev/api/oauth/callback/notion`

## Step 8: Verify Installation

### Test the API

```bash
# Check API health
curl https://your-api-domain.workers.dev/health

# Expected response:
# {"status":"healthy","version":"1.0.0"}
```

### Create a Test User

```bash
curl -X POST https://your-api-domain.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure-password"}'
```

## Configuration Options

### Performance Tuning

Edit `wrangler.toml` for performance settings:

```toml
# Increase CPU milliseconds for complex workflows
[limits]
cpu_ms = 50

# Set usage model for pricing optimization
[usage_model]
default = "unbound"  # or "bundled" for predictable pricing
```

### Custom Domain

To use a custom domain:

1. Add domain to Cloudflare
2. Configure Workers route:

```bash
wrangler route add "api.yourdomain.com/*" workway-api
```

### CORS Configuration

Update `ALLOWED_ORIGINS` in environment variables:

```env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## Monitoring & Maintenance

### Logs

View real-time logs:

```bash
wrangler tail workway-api
```

### Analytics

Enable Cloudflare Analytics in your dashboard to monitor:
- Request volumes
- Error rates
- Performance metrics
- Cost tracking

### Database Backups

Create regular D1 backups:

```bash
# Export database
wrangler d1 execute workway-db --command ".dump" > backup.sql

# Restore from backup
wrangler d1 execute workway-db --file backup.sql
```

## Cost Estimation

### Free Tier Limits

- **Workers**: 100,000 requests/day
- **D1**: 5GB storage, 5M reads/day, 100K writes/day
- **KV**: 100,000 reads/day, 1,000 writes/day
- **Durable Objects**: 1M requests/month

### Estimated Costs After Free Tier

For ~10,000 daily active users:

| Service | Usage | Cost |
|---------|-------|------|
| Workers | 1M requests | $0.50 |
| D1 Database | 10M operations | $2.50 |
| KV Storage | 1M operations | $0.50 |
| Durable Objects | 1M requests | $0.15 |
| **Total** | | **~$3.65/month** |

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Verify database binding
wrangler d1 list

# Check migrations
wrangler d1 migrations list workway-db
```

#### Authentication Failures

- Verify JWT_SECRET is set
- Check CORS configuration
- Ensure OAuth redirect URIs are correct

#### Workflow Execution Issues

```bash
# Check Durable Object status
wrangler tail --format json | grep "WorkflowExecutor"
```

### Debug Mode

Enable debug logging:

```typescript
// In apps/api/src/index.ts
const DEBUG = true;
```

## Security Considerations

### Production Checklist

- [ ] Strong JWT_SECRET (min 32 characters)
- [ ] HTTPS only (automatic with Cloudflare)
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Secrets stored securely (not in code)
- [ ] Regular security updates
- [ ] Database backups configured
- [ ] Monitoring alerts setup

### Rate Limiting

Add rate limiting in `wrangler.toml`:

```toml
[[rate_limiting]]
threshold = 50
period = 60  # 50 requests per minute per IP
```

## Scaling

### Horizontal Scaling

Cloudflare Workers automatically scale globally. No action needed.

### Database Scaling

When D1 limits are reached:

1. Optimize queries with indexes
2. Implement caching strategy
3. Consider data archival
4. Upgrade to D1 paid tier

### Performance Optimization

```toml
# Enable Smart Placement for optimal performance
[placement]
mode = "smart"
```

## Support

### Community Support

- GitHub Issues: [github.com/workway/workway/issues](https://github.com/workway/workway/issues)
- Discord: [discord.gg/workway](https://discord.gg/workway)
- Discussions: [github.com/workway/workway/discussions](https://github.com/workway/workway/discussions)

### Commercial Support

For enterprise support: enterprise@workway.com

## Updating

To update your self-hosted instance:

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run migrations if needed
cd apps/api
wrangler d1 migrations apply workway-db

# Redeploy
wrangler deploy
```

## Migration from Managed Platform

If migrating from the managed WORKWAY platform:

1. Export your workflows using the CLI
2. Update OAuth credentials
3. Migrate user data (contact support)
4. Update webhook URLs
5. Test thoroughly before switching

## License

Self-hosted WORKWAY is provided under the Apache 2.0 license. Some features may require a commercial license. See [LICENSE](LICENSE) for details.