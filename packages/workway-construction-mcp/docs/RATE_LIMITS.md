# WORKWAY Construction MCP - Rate Limits

Rate limits and quotas for the WORKWAY Construction MCP server and Procore API integration.

## Overview

Rate limits protect system resources and ensure fair usage. This document covers:

- Procore API rate limits
- WORKWAY MCP rate limits
- Quota information
- Best practices for handling limits

---

## Procore API Rate Limits

### Standard Limits

| Endpoint Type | Limit | Window | Notes |
|--------------|------|--------|-------|
| **General API** | 100 requests | Per minute | Per access token |
| **Bulk Operations** | 10 requests | Per minute | For batch operations |
| **Webhooks** | No limit | N/A | Webhook deliveries don't count |

### Rate Limit Headers

Procore API responses include rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641234567
Retry-After: 60
```

### Exceeding Limits

When rate limit is exceeded:

- **HTTP Status:** `429 Too Many Requests`
- **Error Code:** `PROCORE_004`
- **Response:**
  ```json
  {
    "error": "Rate limit exceeded",
    "error_code": "PROCORE_004",
    "details": {
      "retry_after": 60,
      "limit": 100,
      "remaining": 0
    }
  }
  ```

---

## WORKWAY MCP Rate Limits

### Tool Execution Limits

| Tool Category | Limit | Window | Notes |
|---------------|-------|--------|-------|
| **Workflow Tools** | 100 calls | Per minute | Per user |
| **Procore Tools** | 50 calls | Per minute | Per user |
| **Debugging Tools** | 20 calls | Per minute | Per user |

### Webhook Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| **Webhook Receipts** | 1000/hour | Per workflow |
| **Concurrent Executions** | 10 | Per workflow |

### Quota Information

| Resource | Limit | Notes |
|----------|-------|-------|
| **Workflows** | 100 | Per account |
| **Active Workflows** | 50 | Per account |
| **Executions** | 10,000/month | Per account |
| **Execution History** | 30 days | Retained |

---

## Handling Rate Limits

### Exponential Backoff

Implement exponential backoff when rate limited:

```javascript
async function callWithRetry(tool, params, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await callTool(tool, params);
    
    if (result.success) return result;
    
    // Check for rate limit error
    if (result.error_code === 'PROCORE_004') {
      const retryAfter = result.details?.retry_after || Math.pow(2, attempt) * 1000;
      await sleep(retryAfter);
      continue;
    }
    
    throw new Error(result.error);
  }
  
  throw new Error('Max retries exceeded');
}
```

### Request Queuing

Queue requests to avoid hitting limits:

```javascript
class RequestQueue {
  constructor(maxConcurrent = 10) {
    this.queue = [];
    this.running = 0;
    this.maxConcurrent = maxConcurrent;
  }
  
  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }
  
  async process() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const { fn, resolve, reject } = this.queue.shift();
    
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}
```

### Caching

Cache frequently accessed data:

```javascript
// Cache project list for 5 minutes
const projectCache = new Map();

async function getProjects() {
  const cacheKey = 'projects';
  const cached = projectCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.data;
  }
  
  const projects = await callTool('workway_list_procore_projects', {});
  projectCache.set(cacheKey, { data: projects, timestamp: Date.now() });
  return projects;
}
```

---

## Best Practices

### 1. Use Webhooks Instead of Polling

**Bad:**
```javascript
// Polling every minute
setInterval(async () => {
  const rfis = await getRFIs();
  // Process RFIs
}, 60000);
```

**Good:**
```javascript
// Webhook-based
// Configure workflow with webhook trigger
// Procore sends events automatically
```

### 2. Batch Requests When Possible

**Bad:**
```javascript
// Multiple individual requests
for (const rfiId of rfiIds) {
  await getRFI(rfiId);
}
```

**Good:**
```javascript
// Single batch request
const rfis = await getRFIs({ ids: rfiIds });
```

### 3. Implement Request Throttling

```javascript
class Throttler {
  constructor(requestsPerMinute) {
    this.requestsPerMinute = requestsPerMinute;
    this.requests = [];
  }
  
  async throttle(fn) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Remove old requests
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    
    // Wait if at limit
    if (this.requests.length >= this.requestsPerMinute) {
      const oldestRequest = this.requests[0];
      const waitTime = 60000 - (now - oldestRequest);
      await sleep(waitTime);
    }
    
    this.requests.push(Date.now());
    return fn();
  }
}
```

### 4. Monitor Rate Limit Usage

```javascript
// Track rate limit headers
function trackRateLimit(response) {
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  
  if (remaining / limit < 0.2) {
    console.warn('Rate limit approaching:', { limit, remaining });
  }
}
```

### 5. Use Appropriate Retry Strategies

```javascript
const retryStrategies = {
  rate_limit: (attempt) => {
    // Exponential backoff with jitter
    const baseDelay = Math.pow(2, attempt) * 1000;
    const jitter = Math.random() * 1000;
    return baseDelay + jitter;
  },
  
  server_error: (attempt) => {
    // Linear backoff for server errors
    return attempt * 2000;
  },
  
  network_error: (attempt) => {
    // Quick retry for network errors
    return attempt * 500;
  }
};
```

---

## Monitoring

### Track Rate Limit Usage

Monitor rate limit headers in responses:

```javascript
// Log rate limit usage
function logRateLimit(tool, response) {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const limit = response.headers.get('X-RateLimit-Limit');
  
  logger.info('Rate limit usage', {
    tool,
    remaining,
    limit,
    usage_percent: ((limit - remaining) / limit * 100).toFixed(2)
  });
}
```

### Set Up Alerts

Alert when approaching limits:

```javascript
if (remaining / limit < 0.2) {
  alert('Rate limit warning', {
    tool,
    remaining,
    limit
  });
}
```

---

## Quota Management

### Check Quota Usage

```javascript
// Check workflow count
const workflows = await callTool('workway_list_workflows', {});
if (workflows.total >= 100) {
  console.warn('Workflow quota approaching limit');
}

// Check execution count (from your analytics)
const executionsThisMonth = await getExecutionCount();
if (executionsThisMonth >= 10000) {
  console.warn('Execution quota approaching limit');
}
```

### Upgrade Quotas

If you need higher limits:

1. Contact support
2. Provide usage metrics
3. Justify increased limits
4. Review pricing options

---

## Error Handling

### Handle Rate Limit Errors

```javascript
try {
  const result = await callTool('workway_get_procore_rfis', params);
} catch (error) {
  if (error.error_code === 'PROCORE_004') {
    // Rate limited
    const retryAfter = error.details.retry_after;
    await sleep(retryAfter * 1000);
    // Retry request
  } else {
    throw error;
  }
}
```

### Graceful Degradation

```javascript
async function getRFIsWithFallback(projectId) {
  try {
    return await callTool('workway_get_procore_rfis', { project_id: projectId });
  } catch (error) {
    if (error.error_code === 'PROCORE_004') {
      // Return cached data if rate limited
      return getCachedRFIs(projectId);
    }
    throw error;
  }
}
```

---

## Additional Resources

- [Procore API Rate Limits](https://developers.procore.com/documentation/rate-limits)
- [WORKWAY API Reference](./API_REFERENCE.md)
- [Error Codes](./ERROR_CODES.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
