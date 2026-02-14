# hd-zoom-sync-cron

Cloudflare Worker with scheduled cron trigger to run Half Dozen's **Zoom → Notion** Meeting Intelligence sync every morning at **8:00 AM CT** (America/Chicago) and email on failure via Resend.

## Purpose

`meetings.workway.co` holds the current Zoom session cookies server-side. This worker is only responsible for the *daily trigger* and *failure notification*.

When Zoom cookies expire, refresh them manually (see **Cookie refresh**).

## Schedule (DST-safe)

Cloudflare cron triggers are UTC-based. This worker runs twice daily (`13:00 UTC` and `14:00 UTC`) and only executes the sync when the current time in `America/Chicago` is exactly `08:00`.

This avoids DST drift without needing an always-on hourly cron.

## Endpoints

- `GET /` - Status + configuration snapshot
- `POST /trigger` - Manually trigger sync (requires `Authorization: Bearer <ADMIN_TOKEN>`)

## Configuration

Set in `wrangler.toml`:

- `MEETINGS_BASE_URL` (default: `https://meetings.workway.co`)
- `USER_ID` (default: `dm-halfdozen-co`)
- `RESEND_TO` (default: `micah@createsomething.io`)
- `RESEND_FROM` (default: `WORKWAY <newsletter@workway.co>`)

Set as secrets:

- `RESEND_API_KEY` - Resend API key
- `ADMIN_TOKEN` - Token required for `POST /trigger`

## Cookie refresh (manual)

When the daily sync fails due to expired Zoom session cookies, refresh cookies and re-upload:

From the WORKWAY repo root:

```bash
pnpm zoom-sync dm-halfdozen-co
```

## Deployment

```bash
npm install

# secrets
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ADMIN_TOKEN

# deploy
npm run deploy

# logs
npm run tail
```

