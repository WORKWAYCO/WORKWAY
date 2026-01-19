# fn-cron

Cloudflare Worker with scheduled cron trigger for fn.workway.co auto-sync.

## Purpose

The fn.workway.co app is a Cloudflare Pages project, which doesn't support native cron triggers. This worker provides the scheduled trigger to call the auto-sync endpoint hourly.

## Schedule

Runs every hour at minute 0 (`0 * * * *`).

## Endpoints

- `GET /` - Status check
- `POST /` - Manually trigger auto-sync (for testing)

## Deployment

```bash
# Install dependencies
npm install

# Deploy to Cloudflare
npm run deploy

# View logs
npm run tail
```

## Configuration

Environment variables in `wrangler.toml`:

- `FN_URL` - Base URL for fn.workway.co
- `CRON_SECRET` - Shared secret for authentication

## Logs

View real-time logs:

```bash
wrangler tail fn-cron
```
