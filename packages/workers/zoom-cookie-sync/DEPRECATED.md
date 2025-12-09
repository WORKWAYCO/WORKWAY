# DEPRECATED

This package has been superseded by `apps/zoom-clips`.

## Why?

The original implementation attempted to build cookie sync from scratch within the WORKWAY infrastructure. However, a proven implementation already existed in the HalfDozen repository that:

1. Actually worked with Zoom's httpOnly cookies (via Chrome extension)
2. Had battle-tested Puppeteer scraping
3. Had multi-user session management via Durable Objects

Following the Heideggerian principle (tool should recede, outcome should remain), we moved the working implementation to `apps/zoom-clips` instead of rebuilding it.

## Migration

The `apps/zoom-clips` worker now handles:
- Cookie upload from Chrome extension
- Session management via Durable Objects
- Zoom meeting/clip scraping via Puppeteer
- Auto-refresh via cron triggers

## Removal

This package can be safely removed. The Cloudflare worker `zoom-cookie-sync` has already been deleted.

```bash
rm -rf packages/workers/zoom-cookie-sync
```
