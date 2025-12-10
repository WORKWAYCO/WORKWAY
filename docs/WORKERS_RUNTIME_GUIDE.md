# Cloudflare Workers Runtime Guide

WORKWAY workflows run on Cloudflare Workers—a V8 isolate environment, not Node.js. This guide documents the runtime constraints and available APIs.

---

## The Runtime Model

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

---

## Available APIs

### Web Standard APIs (Always Available)

| API | Status | Notes |
|-----|--------|-------|
| `fetch()` | Full support | HTTP requests to any URL |
| `URL` / `URLSearchParams` | Full support | URL parsing and manipulation |
| `Headers` / `Request` / `Response` | Full support | Fetch-related objects |
| `TextEncoder` / `TextDecoder` | Full support | Text encoding |
| `crypto.subtle` | Full support | Web Crypto API |
| `atob()` / `btoa()` | Full support | Base64 encoding |
| `setTimeout` / `setInterval` | Limited | Cannot exceed execution time |
| `console.log/warn/error` | Full support | Logging |
| `JSON` | Full support | Parsing and serialization |
| `Date` | Full support | Time and date |
| `Math` | Full support | Mathematical operations |
| `RegExp` | Full support | Regular expressions |
| `Map` / `Set` / `WeakMap` / `WeakSet` | Full support | Collections |
| `Promise` / `async/await` | Full support | Async programming |
| `ArrayBuffer` / `TypedArrays` | Full support | Binary data |
| `Blob` / `File` | Full support | Binary objects |
| `FormData` | Full support | Multipart form data |
| `ReadableStream` / `WritableStream` | Full support | Streaming |

### Cloudflare-Specific APIs (via WORKWAY)

| API | Access | Description |
|-----|--------|-------------|
| Workers AI | `integrations.ai.generateText()` | LLM text generation |
| Workers AI | `integrations.ai.embeddings()` | Vector embeddings |
| KV Storage | `context.storage.get/put()` | Key-value persistence |
| Environment | `config.*` | Workflow configuration |

---

## What Doesn't Work

### Node.js Standard Library

These will throw errors at runtime:

```typescript
// ALL OF THESE FAIL
import fs from 'fs';                    // No filesystem
import path from 'path';                // No path module
import child_process from 'child_process';  // No subprocesses
import os from 'os';                    // No OS access
import net from 'net';                  // No raw sockets
import http from 'http';                // Use fetch() instead
import https from 'https';              // Use fetch() instead
import crypto from 'crypto';            // Use crypto.subtle instead
import stream from 'stream';            // Use Web Streams instead
import buffer from 'buffer';            // Use ArrayBuffer instead
```

**Why**: Workers are V8 isolates with no system access. They're designed for security and fast startup.

### npm Packages That Assume Node.js

Many popular packages won't work:

| Package | Problem | Alternative |
|---------|---------|-------------|
| `axios` | Uses Node.js http | Use `fetch()` |
| `request` | Uses Node.js http | Use `fetch()` |
| `node-fetch` | Unnecessary | Native `fetch()` available |
| `express` | HTTP server model | Not applicable (event-driven) |
| `moment` | Works but heavy | Use native `Date` or `date-fns` |
| `lodash` | Mostly works | Prefer native methods or `lodash-es` |
| `uuid` | Uses Node.js crypto | Use `crypto.randomUUID()` |
| `bcrypt` | Native bindings | Use `bcryptjs` (pure JS) |
| `sharp` | Native bindings | Use Cloudflare Images |
| `puppeteer` | Needs Chrome | Use external service |

---

## Package Compatibility

### Packages That Work

Packages that are "isomorphic" or specifically support Workers:

- `date-fns` - Date manipulation
- `lodash-es` - Utility functions (ESM version)
- `zod` - Schema validation
- `superjson` - JSON with type preservation
- `nanoid` - ID generation
- `jose` - JWT handling
- `hono` - Lightweight web framework (if building custom endpoints)
- `itty-router` - Tiny router

### Checking Compatibility

1. **Check for Node.js imports**: If the package imports `fs`, `path`, `http`, it won't work
2. **Check for native bindings**: If it has a `binding.gyp` or uses `node-gyp`, it won't work
3. **Look for "browser" field**: In `package.json`, this often indicates isomorphic support
4. **Test in Wrangler**: The definitive test is running in Wrangler dev mode

---

## Execution Limits

| Limit | Value | Notes |
|-------|-------|-------|
| CPU time | 30s (Paid) | Per invocation |
| Wall clock time | 30s | Real time limit |
| Memory | 128 MB | Per isolate |
| Subrequests | 50 | External fetch() calls per invocation |
| Script size | 10 MB | After compression |

**Implications for workflows:**
- Break long operations into multiple workflow executions
- Use triggers (cron, webhook) for polling instead of `while` loops
- Batch API calls within the 50-subrequest limit

---

## Common Patterns

### Generating UUIDs

```typescript
// DON'T: Node.js crypto
import { v4 as uuidv4 } from 'uuid';  // May not work

// DO: Web Crypto API
const id = crypto.randomUUID();
```

### Making HTTP Requests

```typescript
// DON'T: Node.js http or axios
import axios from 'axios';  // Won't work
const res = await axios.get(url);

// DO: Native fetch
const res = await fetch(url, {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await res.json();
```

### Handling Binary Data

```typescript
// DON'T: Node.js Buffer
import { Buffer } from 'buffer';
const buf = Buffer.from(data);

// DO: ArrayBuffer / Uint8Array
const encoder = new TextEncoder();
const bytes = encoder.encode(data);
```

### Hashing

```typescript
// DON'T: Node.js crypto
import crypto from 'crypto';
const hash = crypto.createHash('sha256').update(data).digest('hex');

// DO: Web Crypto API
const encoder = new TextEncoder();
const data = encoder.encode('hello');
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
```

### Environment Variables

```typescript
// DON'T: Node.js process.env
const apiKey = process.env.API_KEY;  // Undefined in Workers

// DO: Use config parameter
export default defineWorkflow({
  async execute({ config }) {
    const apiKey = config.apiKey;  // Passed via workflow configuration
  }
});
```

---

## Debugging

### Console Logging

```typescript
export default defineWorkflow({
  async execute({ trigger }) {
    console.log('Trigger data:', trigger.data);
    console.warn('Warning message');
    console.error('Error occurred');

    // Objects are serialized automatically
    console.log({ nested: { data: trigger.data } });
  }
});
```

### Error Handling

```typescript
export default defineWorkflow({
  async execute({ integrations }) {
    try {
      const response = await fetch('https://api.example.com/data');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API call failed:', error.message);
      // Re-throw or handle gracefully
      throw error;
    }
  }
});
```

---

## Resources

- [Cloudflare Workers Runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/)
- [Workers Compatibility Flags](https://developers.cloudflare.com/workers/configuration/compatibility-dates/)
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Web APIs Available in Workers](https://developers.cloudflare.com/workers/runtime-apis/web-standards/)

---

## Quick Reference

| Need | Don't Use | Use Instead |
|------|-----------|-------------|
| HTTP requests | `axios`, `node-fetch` | `fetch()` |
| UUID generation | `uuid` package | `crypto.randomUUID()` |
| Hashing | `crypto.createHash()` | `crypto.subtle.digest()` |
| Base64 | `Buffer.from().toString('base64')` | `btoa()` / `atob()` |
| Binary data | `Buffer` | `ArrayBuffer` / `Uint8Array` |
| Environment vars | `process.env` | `config` parameter |
| Date formatting | `moment` | `Date` / `date-fns` |
| JSON parsing | (same) | `JSON.parse()` / `JSON.stringify()` |
