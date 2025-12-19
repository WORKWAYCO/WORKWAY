# Performance & Rate Limiting

Workflows run in the real world of API limits, execution timeouts, and finite resources. Understanding these constraints leads to robust, efficient workflows.

## Cloudflare Workers Constraints

WORKWAY runs on Cloudflare Workers. Know the limits:

| Resource | Limit |
|----------|-------|
| CPU time | 30 seconds |
| Memory | 128 MB |
| Subrequests | 1,000 per request |
| Outbound connections | 6 concurrent |
| Request size | 100 MB |

### CPU Time vs. Wall Time

```typescript
// CPU time: actual computation
const result = heavyComputation();  // Uses CPU time

// Wall time: waiting for external services
await fetch('https://api.external.com');  // Doesn't use CPU time
```

You have 30 seconds of CPU time, but network requests don't count against this.

## API Rate Limits

Every external API has limits:

| Service | Typical Limit |
|---------|---------------|
| Zoom | 100 requests/second |
| Notion | 3 requests/second |
| Slack | 1 request/second (per method) |
| Gmail | 250 quota units/second |
| Stripe | 100 requests/second |

### Detecting Rate Limits

```typescript
async execute({ integrations, context }) {
  try {
    await integrations.notion.createPage(/* ... */);
  } catch (error) {
    if (error.code === 'RATE_LIMITED') {
      // Automatic retry with backoff
      throw error;  // WORKWAY handles retry
    }
  }
}
```

### Manual Rate Limit Handling

```typescript
async function withRateLimit<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay: number }
): Promise<T> {
  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.headers?.['retry-after'] || options.baseDelay;
        await sleep(retryAfter * 1000 * Math.pow(2, attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Batching Strategies

### Batch API Calls

Instead of:
```typescript
// Bad: 100 separate API calls
for (const item of items) {
  await notion.createPage({ /* item data */ });
}
```

Use batch endpoints:
```typescript
// Good: Single batch call (where supported)
await notion.batchCreatePages(items.map(item => ({ /* item data */ })));
```

### Chunked Processing

When batch APIs aren't available:

```typescript
async function processInChunks<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  chunkSize: number,
  delayBetweenChunks: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);

    // Process chunk in parallel
    const chunkResults = await Promise.all(chunk.map(processFn));
    results.push(...chunkResults);

    // Delay before next chunk
    if (i + chunkSize < items.length) {
      await sleep(delayBetweenChunks);
    }
  }

  return results;
}

// Usage
const pages = await processInChunks(
  items,
  item => notion.createPage({ /* item data */ }),
  3,    // 3 items per chunk
  1000  // 1 second between chunks
);
```

### Parallel with Concurrency Limit

```typescript
async function parallelLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = fn(item).then(result => {
      results.push(result);
    });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(e => e === p), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

// Max 3 concurrent Notion API calls
const pages = await parallelLimit(items, createNotionPage, 3);
```

## Caching

### In-Memory Caching

For data used multiple times in one execution:

```typescript
async execute({ integrations }) {
  const cache = new Map();

  async function getCachedUser(userId: string) {
    if (!cache.has(userId)) {
      const user = await integrations.slack.getUserInfo(userId);
      cache.set(userId, user);
    }
    return cache.get(userId);
  }

  // Multiple lookups hit cache
  const user1 = await getCachedUser('U123');
  const user2 = await getCachedUser('U123');  // Cached
}
```

### Persistent Caching

For data that persists across executions:

```typescript
async execute({ context, integrations }) {
  const cacheKey = 'notion-databases';
  const cacheTTL = 60 * 60 * 1000;  // 1 hour

  let databases = await context.storage.get(cacheKey);

  if (!databases || databases.expiry < Date.now()) {
    databases = {
      data: await integrations.notion.getDatabases(),
      expiry: Date.now() + cacheTTL,
    };
    await context.storage.put(cacheKey, databases);
  }

  return databases.data;
}
```

### Cache Invalidation

```typescript
// Clear cache on config change
metadata: {
  onConfigChange: async (context) => {
    await context.storage.delete('notion-databases');
  },
},
```

## Pagination

### Handling Paginated APIs

```typescript
async function getAllMeetings(zoom: ZoomClient): Promise<Meeting[]> {
  const allMeetings: Meeting[] = [];
  let nextPageToken: string | undefined;

  do {
    const response = await zoom.getMeetings({
      page_size: 100,
      next_page_token: nextPageToken,
    });

    allMeetings.push(...response.meetings);
    nextPageToken = response.next_page_token;
  } while (nextPageToken);

  return allMeetings;
}
```

### Paginated Processing

Process pages as they arrive to avoid memory issues:

```typescript
async function processAllPages(
  fetchPage: (token?: string) => Promise<{ items: any[]; nextToken?: string }>,
  processItem: (item: any) => Promise<void>
) {
  let nextToken: string | undefined;
  let totalProcessed = 0;

  do {
    const { items, nextToken: next } = await fetchPage(nextToken);

    for (const item of items) {
      await processItem(item);
      totalProcessed++;
    }

    nextToken = next;
  } while (nextToken);

  return totalProcessed;
}
```

## Timeouts

### Setting Timeouts

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });

  return Promise.race([promise, timeout]);
}

// Usage
const meeting = await withTimeout(
  zoom.getMeeting(meetingId),
  5000,  // 5 second timeout
  'Zoom API timeout'
);
```

### Handling Long Operations

For operations that might exceed limits, use checkpointing:

```typescript
async execute({ trigger, context }) {
  // Resume from checkpoint if exists
  const checkpoint = await context.storage.get('checkpoint');
  const startIndex = checkpoint?.lastProcessed || 0;

  const items = trigger.payload.items.slice(startIndex);

  for (let i = 0; i < items.length; i++) {
    await processItem(items[i]);

    // Checkpoint every 10 items
    if (i % 10 === 0) {
      await context.storage.put('checkpoint', {
        lastProcessed: startIndex + i,
        timestamp: Date.now(),
      });
    }
  }

  // Clear checkpoint on success
  await context.storage.delete('checkpoint');
  return { success: true };
}
```

## Memory Management

### Streaming Large Data

Don't load everything into memory:

```typescript
// Bad: Loading entire transcript
const fullTranscript = await zoom.getFullTranscript(meetingId);
const summary = summarize(fullTranscript);  // May exceed memory

// Good: Stream processing
async function* transcriptChunks(meetingId: string) {
  let offset = 0;
  const chunkSize = 1000;

  while (true) {
    const chunk = await zoom.getTranscriptChunk(meetingId, offset, chunkSize);
    if (!chunk.text) break;
    yield chunk;
    offset += chunkSize;
  }
}

for await (const chunk of transcriptChunks(meetingId)) {
  await processChunk(chunk);
}
```

### Avoiding Memory Leaks

```typescript
// Bad: Accumulating data in array
const allResults = [];
for (const item of items) {
  allResults.push(await process(item));
}

// Good: Process and discard
let successCount = 0;
for (const item of items) {
  const result = await process(item);
  if (result.success) successCount++;
  // result is garbage collected after iteration
}
```

## Monitoring Performance

### Execution Timing

```typescript
async execute({ context }) {
  const start = Date.now();

  const zoomStart = Date.now();
  const meeting = await zoom.getMeeting(meetingId);
  context.log.info('Zoom API', { duration: Date.now() - zoomStart });

  const aiStart = Date.now();
  const summary = await ai.summarize(transcript);
  context.log.info('AI processing', { duration: Date.now() - aiStart });

  const notionStart = Date.now();
  await notion.createPage(/* ... */);
  context.log.info('Notion API', { duration: Date.now() - notionStart });

  context.log.info('Total execution', { duration: Date.now() - start });
}
```

### Identifying Bottlenecks

```typescript
const metrics = {
  apiCalls: 0,
  apiTime: 0,
  processingTime: 0,
};

// Wrap API calls
async function trackedApiCall(fn: () => Promise<any>) {
  const start = Date.now();
  const result = await fn();
  metrics.apiCalls++;
  metrics.apiTime += Date.now() - start;
  return result;
}

// At end of execution
context.log.info('Performance metrics', metrics);
```

## Best Practices Summary

| Practice | Why |
|----------|-----|
| Batch API calls | Reduce request count |
| Limit concurrency | Respect rate limits |
| Cache repeated lookups | Avoid redundant calls |
| Paginate large datasets | Control memory usage |
| Checkpoint long operations | Handle timeouts gracefully |
| Log performance metrics | Identify bottlenecks |

## Praxis

Optimize your workflow for performance:

> **Praxis**: Ask Claude Code: "Help me add performance optimizations to my workflow including batching, caching, and rate limit handling"

Implement these patterns:

```typescript
async execute({ integrations, context }) {
  // 1. Cache repeated lookups
  const cache = new Map();
  async function getCachedUser(userId: string) {
    if (!cache.has(userId)) {
      cache.set(userId, await slack.getUserInfo(userId));
    }
    return cache.get(userId);
  }

  // 2. Process in rate-limited chunks
  const chunks = chunkArray(items, 3);  // 3 items per chunk
  for (const chunk of chunks) {
    await Promise.all(chunk.map(processItem));
    await sleep(1000);  // 1 second between chunks
  }

  // 3. Log performance metrics
  context.log.info('Performance', {
    apiCalls: metrics.apiCalls,
    avgLatency: metrics.totalTime / metrics.apiCalls,
    cacheHitRate: cache.size / totalLookups,
  });
}
```

Measure before and after:
- Count API calls
- Measure total execution time
- Track error rates

## Reflection

- Where are the bottlenecks in your workflow?
- Which API has the strictest rate limits you work with?
- How would you handle processing 10,000 items?
