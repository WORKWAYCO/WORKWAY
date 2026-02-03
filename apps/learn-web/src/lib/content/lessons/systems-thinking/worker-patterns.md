# Master Workers patterns

Use Web APIs instead of Node.js and handle runtime constraints.

## What you'll do

- Understand the V8 isolate runtime
- Use Web APIs: `fetch()`, `crypto.subtle`, `TextEncoder`
- Identify Workers-compatible npm packages
- Apply patterns for HTTP, UUID, hashing
- Handle limits: 30s CPU, 50 subrequests

## The Workers Runtime Model

Workers run in **V8 isolates**—the same JavaScript engine as Chrome, but without a browser or Node.js environment.

```
┌─────────────────────────────────────────────────┐
│                 What You Have                   │
├─────────────────────────────────────────────────┤
│  V8 JavaScript Engine                           │
│  Web Standard APIs (fetch, URL, crypto, etc.)   │
│  Cloudflare-specific APIs (KV, R2, AI, etc.)    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              What You DON'T Have                │
├─────────────────────────────────────────────────┤
│  Node.js stdlib (fs, path, child_process)       │
│  Browser APIs (DOM, window, document)           │
│  Unlimited execution time                        │
└─────────────────────────────────────────────────┘
```

**Key insight**: Workers are designed for security and fast startup. The constraint is the runtime, not the language—you still write TypeScript, but with Web APIs instead of Node.js APIs.

## Step-by-Step: Convert Node.js Patterns to Workers

### Step 1: Identify Node.js Dependencies

Check your code for Node.js imports that won't work:

```typescript
// These will FAIL in Workers
import fs from "fs"; // No filesystem
import path from "path"; // No path module
import child_process from "child_process"; // No subprocesses
import os from "os"; // No OS access
import crypto from "crypto"; // Use crypto.subtle instead
import http from "http"; // Use fetch() instead
```

### Step 2: Replace HTTP Libraries with fetch()

Workers have native `fetch()` support—no libraries needed:

```typescript
// DON'T: axios or node-fetch
import axios from "axios";
const res = await axios.get(url);

// DO: Native fetch (always available)
const res = await fetch(url, {
  method: "GET",
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
```

### Step 3: Use Web Crypto API for Hashing

Replace Node.js crypto with the Web Crypto API:

```typescript
// DON'T: Node.js crypto
import crypto from "crypto";
const hash = crypto.createHash("sha256").update(data).digest("hex");

// DO: Web Crypto API
const encoder = new TextEncoder();
const dataBytes = encoder.encode(data);
const hashBuffer = await crypto.subtle.digest("SHA-256", dataBytes);
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
```

### Step 4: Generate UUIDs with Web Crypto

```typescript
// DON'T: uuid package (may not work)
import { v4 as uuidv4 } from "uuid";
const id = uuidv4();

// DO: Web Crypto API (always available)
const id = crypto.randomUUID();
```

### Step 5: Handle Binary Data with ArrayBuffer

```typescript
// DON'T: Node.js Buffer
import { Buffer } from "buffer";
const buf = Buffer.from(data);

// DO: ArrayBuffer / Uint8Array
const encoder = new TextEncoder();
const bytes = encoder.encode(data);
```

### Step 6: Access Environment Variables via Config

```typescript
// DON'T: process.env (undefined in Workers)
const apiKey = process.env.API_KEY;

// DO: Use config parameter
export default defineWorkflow({
  async execute({ config }) {
    const apiKey = config.apiKey; // Passed via workflow configuration
  },
});
```

---

## Available Web Standard APIs

These APIs work in every workflow:

| API                                 | Status       | Notes                        |
| ----------------------------------- | ------------ | ---------------------------- |
| `fetch()`                           | Full support | HTTP requests to any URL     |
| `URL` / `URLSearchParams`           | Full support | URL parsing and manipulation |
| `Headers` / `Request` / `Response`  | Full support | Fetch-related objects        |
| `TextEncoder` / `TextDecoder`       | Full support | Text encoding                |
| `crypto.subtle`                     | Full support | Web Crypto API               |
| `atob()` / `btoa()`                 | Full support | Base64 encoding              |
| `console.log/warn/error`            | Full support | Logging                      |
| `JSON`                              | Full support | Parsing and serialization    |
| `Date`                              | Full support | Time and date                |
| `Math`                              | Full support | Mathematical operations      |
| `RegExp`                            | Full support | Regular expressions          |
| `Map` / `Set`                       | Full support | Collections                  |
| `Promise` / `async/await`           | Full support | Async programming            |
| `ArrayBuffer` / `TypedArrays`       | Full support | Binary data                  |
| `ReadableStream` / `WritableStream` | Full support | Streaming                    |

## Cloudflare-Specific APIs

WORKWAY exposes these through the SDK:

| API         | Access                           | Description            |
| ----------- | -------------------------------- | ---------------------- |
| Workers AI  | `integrations.ai.generateText()` | LLM text generation    |
| Workers AI  | `integrations.ai.embeddings()`   | Vector embeddings      |
| KV Storage  | `context.storage.get/put()`      | Key-value persistence  |
| Environment | `config.*`                       | Workflow configuration |

## Package Compatibility

### Packages That Work

Packages that are "isomorphic" or specifically support Workers:

- `date-fns` - Date manipulation
- `lodash-es` - Utility functions (ESM version)
- `zod` - Schema validation
- `superjson` - JSON with type preservation
- `nanoid` - ID generation
- `jose` - JWT handling
- `hono` - Lightweight web framework
- `itty-router` - Tiny router

### Packages That Don't Work

| Package      | Problem             | Alternative                     |
| ------------ | ------------------- | ------------------------------- |
| `axios`      | Uses Node.js http   | Use `fetch()`                   |
| `request`    | Uses Node.js http   | Use `fetch()`                   |
| `node-fetch` | Unnecessary         | Native `fetch()` available      |
| `express`    | HTTP server model   | Not applicable                  |
| `moment`     | Works but heavy     | Use native `Date` or `date-fns` |
| `uuid`       | Uses Node.js crypto | Use `crypto.randomUUID()`       |
| `bcrypt`     | Native bindings     | Use `bcryptjs` (pure JS)        |
| `sharp`      | Native bindings     | Use Cloudflare Images           |
| `puppeteer`  | Needs Chrome        | Use external service            |

### Checking Compatibility

1. **Check for Node.js imports**: If the package imports `fs`, `path`, `http`, it won't work
2. **Check for native bindings**: If it has a `binding.gyp` or uses `node-gyp`, it won't work
3. **Look for "browser" field**: In `package.json`, this often indicates isomorphic support
4. **Test in Wrangler**: The definitive test is running in Wrangler dev mode

## Execution Limits

| Limit           | Value      | Notes                                   |
| --------------- | ---------- | --------------------------------------- |
| CPU time        | 30s (Paid) | Per invocation                          |
| Wall clock time | 30s        | Real time limit                         |
| Memory          | 128 MB     | Per isolate                             |
| Subrequests     | 50         | External `fetch()` calls per invocation |
| Script size     | 10 MB      | After compression                       |

**Implications for workflows:**

- Break long operations into multiple workflow executions
- Use triggers (cron, webhook) for polling instead of `while` loops
- Batch API calls within the 50-subrequest limit

## Common Patterns

### Pattern 1: HTTP Request with Error Handling

```typescript
async execute({ config }) {
  const response = await fetch('https://api.example.com/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ query: 'test' }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}
```

### Pattern 2: Generate Content Hash

```typescript
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Usage in workflow
async execute({ trigger }) {
  const contentHash = await hashContent(trigger.data.body);
  const dedupeKey = `processed:${contentHash}`;

  // Check if already processed
  const exists = await storage.get(dedupeKey);
  if (exists) {
    return { success: true, skipped: true, reason: 'Duplicate content' };
  }

  // Process and mark as done
  await storage.put(dedupeKey, Date.now());
  return { success: true };
}
```

### Pattern 3: Base64 Encode/Decode

```typescript
// Encode string to base64
const encoded = btoa("Hello, World!");

// Decode base64 to string
const decoded = atob(encoded);

// For binary data, use ArrayBuffer
const encoder = new TextEncoder();
const bytes = encoder.encode("Hello");
const base64 = btoa(String.fromCharCode(...bytes));
```

### Pattern 4: Parse URL Parameters

```typescript
async execute({ trigger }) {
  const url = new URL(trigger.data.callbackUrl);

  // Get query parameters
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Build new URL
  url.searchParams.set('processed', 'true');

  return { redirectUrl: url.toString() };
}
```

### Pattern 5: Batch API Calls Within Limits

```typescript
async execute({ trigger, integrations }) {
  const items = trigger.data.items;
  const BATCH_SIZE = 10;  // Stay well under 50 subrequest limit
  const results = [];

  // Process in batches
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map((item) =>
        integrations.notion.pages.create({
          parent: { database_id: config.databaseId },
          properties: { Name: { title: [{ text: { content: item.name } }] } },
        })
      )
    );

    results.push(...batchResults);
  }

  return { success: true, created: results.length };
}
```

### Pattern 6: Long-Running Work with Triggers

```typescript
// DON'T: Long-running loop (will timeout)
async execute() {
  while (true) {
    await checkForUpdates();
    await sleep(60000);  // Workers will timeout
  }
}

// DO: Use scheduled triggers
export default defineWorkflow({
  trigger: schedule({ cron: '* * * * *' }),  // Every minute
  async execute() {
    await checkForUpdates();
    return { success: true };
  },
});
```

## Debugging

### Console Logging

```typescript
async execute({ trigger }) {
  console.log('Trigger data:', trigger.data);
  console.warn('Warning message');
  console.error('Error occurred');

  // Objects are serialized automatically
  console.log({ nested: { data: trigger.data } });
}
```

View logs with:

```bash
workway logs --tail
```

### Error Handling Pattern

```typescript
async execute({ integrations }) {
  try {
    const response = await fetch('https://api.example.com/data');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { success: true, data: await response.json() };
  } catch (error) {
    console.error('API call failed:', (error as Error).message);

    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
```

## Quick Reference

| Need             | Don't Use                          | Use Instead                  |
| ---------------- | ---------------------------------- | ---------------------------- |
| HTTP requests    | `axios`, `node-fetch`              | `fetch()`                    |
| UUID generation  | `uuid` package                     | `crypto.randomUUID()`        |
| Hashing          | `crypto.createHash()`              | `crypto.subtle.digest()`     |
| Base64           | `Buffer.from().toString('base64')` | `btoa()` / `atob()`          |
| Binary data      | `Buffer`                           | `ArrayBuffer` / `Uint8Array` |
| Environment vars | `process.env`                      | `config` parameter           |
| Date formatting  | `moment`                           | `Date` / `date-fns`          |

## Praxis

Apply Workers patterns to a real workflow:

> **Praxis**: Ask Claude Code: "Show me how fetch() and crypto.subtle are used in packages/workflows/"

1. Find a workflow that uses direct `fetch()` calls
2. Identify any patterns for error handling
3. Create a helper function that hashes content:

```typescript
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

4. Add deduplication to your workflow using the hash:

```typescript
async execute({ trigger, storage }) {
  const contentHash = await hashContent(JSON.stringify(trigger.data));
  const processedKey = `processed:${contentHash}`;

  if (await storage.get(processedKey)) {
    return { success: true, skipped: true, reason: 'Already processed' };
  }

  // Your workflow logic here

  await storage.put(processedKey, Date.now());
  return { success: true };
}
```

## Reflection

- How do V8 isolate constraints affect the way you structure workflows?
- When is it appropriate to call external services vs. using built-in APIs?
- How can the 50-subrequest limit inform your workflow's batch processing strategy?
