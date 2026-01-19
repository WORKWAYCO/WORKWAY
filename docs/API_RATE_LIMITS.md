# API Rate Limits

WORKWAY uses rate limiting to ensure fair usage and protect the API from abuse.

## Default Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/workflows/*/trigger` | 1,000 requests | 1 minute |
| `/auth/*` | 20 requests | 1 minute |

## Per-API-Key Limits

Each API key can have a custom rate limit configured. Tiers:

| Tier | Limit | Use Case |
|------|-------|----------|
| Free | 100/min | Development, testing |
| Pro | 1,000/min | Production applications |
| Enterprise | 10,000/min | High-volume integrations |

## Response Headers

All API responses include rate limit headers:

```
X-RateLimit-Limit: 1000        # Maximum requests in window
X-RateLimit-Remaining: 847     # Requests remaining in window
X-RateLimit-Reset: 1705600000  # Unix timestamp when window resets
```

## Rate Limit Exceeded (429)

When you exceed your rate limit, you'll receive:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

The `retryAfter` field indicates seconds until the limit resets.

## Best Practices

### 1. Implement Exponential Backoff

```typescript
async function callAPIWithBackoff(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url);
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      await sleep(retryAfter * 1000 * Math.pow(2, i));
      continue;
    }
    
    return response;
  }
  throw new Error('Max retries exceeded');
}
```

### 2. Use Idempotency Keys

For workflow triggers, include an `Idempotency-Key` header to prevent duplicate executions and reduce unnecessary API calls:

```typescript
const response = await fetch('/workflows/my-workflow/trigger', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Idempotency-Key': 'unique-request-id-123',
  },
  body: JSON.stringify({ event: 'trigger', data: {} }),
});
```

### 3. Cache API Responses

Cache responses where appropriate to reduce API calls. The WORKWAY SDK includes built-in caching utilities:

```typescript
import { createEdgeCache } from '@workwayco/sdk';

const cache = createEdgeCache('api-responses');
const data = await cache.getOrSet('workflow-list', fetchWorkflows, { ttlSeconds: 300 });
```

### 4. Batch Operations

Where possible, batch multiple operations into a single request rather than making many individual calls.

## Increasing Your Limit

To request a higher rate limit:

1. **Pro tier**: Upgrade your subscription at workway.co/billing
2. **Enterprise**: Contact sales@workway.co for custom limits

## Monitoring Usage

View your current usage in the WORKWAY dashboard under **Settings > API Usage**.

## Rate Limiting Implementation

WORKWAY uses a sliding window algorithm implemented in Cloudflare Workers:

1. **Per-API-Key tracking**: Each API key has its own rate limit counter
2. **Distributed state**: Counters are stored in Cloudflare KV for consistency across edge locations
3. **Window expiration**: Counters automatically reset after the window period

For the implementation details, see `packages/workers/api-gateway/src/index.ts`.
