# Pattern: Browser Automation Consolidation

**Pattern ID:** `browser-automation-consolidation`
**Category:** Infrastructure
**Status:** Production
**Date:** December 3, 2025

---

## Context

External APIs often provide incomplete data. Browser automation can fill gaps but introduces complexity:
- Session management
- Cookie persistence
- Multiple workers with overlapping functionality
- Debugging infrastructure

## Problem

The original `zoom-clips-nextjs` system had 3 workers totaling ~1,770 lines:
- `zoom-browser-scraper` (922 lines) - Cookie management + bookmarklet
- `zoom-transcript-scraper-browser` (465 lines) - Puppeteer transcript extraction
- `zoom-meeting-sync-worker` (383 lines) - Cloudflare Workflow orchestration

This created:
- Code duplication across workers
- Complex Durable Objects for simple cookie storage
- Tight coupling between scraping and sync logic
- Difficult debugging and maintenance

## Solution: Subtractive Triad Application

### 1. DRY Analysis (Have I built this before?)

| Duplication | Action |
|-------------|--------|
| Cookie management in 2 workers | Consolidated to single `/cookies` endpoint |
| WebVTT parsing in scraper + SDK | Reuse SDK's `Zoom.parseWebVTT()` |
| HTTP client patterns | Extend `BaseAPIClient` |

### 2. Rams Analysis (Does it earn existence?)

| Component | Verdict | Reason |
|-----------|---------|--------|
| Cookie bookmarklet | KEEP | User-facing auth flow |
| Browser scraping | KEEP | Required for speaker attribution |
| Durable Objects | REMOVE | KV is simpler for cookie storage |
| Notion sync | REMOVE | SDK has Notion integration |
| Debug endpoints | REMOVE | Minimal for production |

### 3. Heidegger Analysis (Does it serve the whole?)

The scraper must integrate with the SDK's existing `browserScraperUrl` pattern:

```typescript
const zoom = new Zoom({
  accessToken: tokens.access_token,
  browserScraperUrl: 'https://zoom-scraper.workers.dev'
});
```

Response format must match SDK expectations:
```typescript
interface TranscriptResponse {
  success: boolean;
  transcript?: string;
  speakers?: string[];
  source: 'browser_scraper';
}
```

## Implementation

### Single Worker Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    zoom-scraper                         │
│                   (~350 lines)                          │
├─────────────────────────────────────────────────────────┤
│  GET /sync          → Bookmarklet HTML page             │
│  POST /cookies      → Store cookies in KV (24h TTL)     │
│  POST /transcript   → Scrape single URL (SDK calls)     │
│  POST /transcripts  → Batch scrape from management page │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  KV: ZOOM_COOKIES                                       │
│  Key: cookies:{userEmail}                               │
│  TTL: 86400 (24 hours)                                  │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **KV over Durable Objects**
   - Cookies are ephemeral (24h TTL)
   - No need for transactional consistency
   - Simpler debugging and monitoring

2. **Bookmarklet for Auth**
   - User controls when to sync cookies
   - No stored credentials on server
   - Works with any Zoom authentication method

3. **SDK-Compatible Response**
   - Returns same format as OAuth API
   - SDK handles fallback logic transparently
   - Developer doesn't know which source was used

### Code Structure

```typescript
// Minimal endpoints
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/sync') return syncPage(env);
    if (url.pathname === '/cookies') return handleCookies(request, env);
    if (url.pathname === '/transcript') return scrapeTranscript(request, env);
    if (url.pathname === '/transcripts') return scrapeAll(request, env);

    return healthCheck();
  }
};
```

## Results

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Workers | 3 | 1 | -67% |
| Lines of code | 1,770 | 350 | -80% |
| Storage | Durable Objects | KV | Simpler |
| Endpoints | 12 | 4 | -67% |

## Pattern Applicability

Use this pattern when:
- External API lacks data that browser can access
- Multiple workers have overlapping browser automation
- Session/cookie management is needed
- SDK already has integration for the service

Don't use when:
- API provides all needed data
- Real-time streaming is required
- Complex state management is needed (use Durable Objects)

## Deployment

```bash
cd packages/workers/zoom-scraper

# Create KV namespace
wrangler kv:namespace create ZOOM_COOKIES

# Set auth secret
wrangler secret put UPLOAD_SECRET

# Deploy
wrangler deploy
```

## SDK Integration

```typescript
// In workflow
const zoom = new Zoom({
  accessToken: tokens.zoom.access_token,
  browserScraperUrl: env.BROWSER_SCRAPER_URL || 'https://zoom-scraper.half-dozen.workers.dev'
});

// SDK handles fallback automatically
const transcript = await zoom.getTranscript({
  meetingId: '123456789',
  fallbackToBrowser: true,
  shareUrl: recording.share_url
});

// Developer doesn't care about source
console.log(transcript.data?.speakers); // ['Alice', 'Bob']
```

## Related Patterns

- **API-First with Browser Fallback**: Try OAuth API, fall back to browser
- **Bookmarklet Authentication**: User-controlled cookie sync
- **SDK Abstraction**: Hide implementation details from developers

---

*Pattern documented as part of CREATE SOMETHING methodology.*
*Reference: createsomething.ltd/patterns*
