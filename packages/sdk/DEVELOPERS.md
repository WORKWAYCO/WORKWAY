# WORKWAY SDK - Developer Guide

This guide captures implementation knowledge that emerged through building integrations. It complements the README (which covers high-level usage) with the practical details developers need when building new integrations.

---

## The Narrow Waist Pattern

WORKWAY SDK uses two "narrow waists" to achieve O(M + N) complexity instead of O(M × N):

| Narrow Waist | Purpose | Key Insight |
|--------------|---------|-------------|
| `ActionResult<T>` | Output data format | All actions return this envelope |
| `IntegrationError` | Error handling | All errors use this taxonomy |

This pattern means:
- **M integrations + N consumers** instead of **M × N translations**
- Add a new integration → it works with all existing workflows
- Add a new workflow → it works with all existing integrations

---

## ActionResult - Critical Implementation Details

### The Error Structure Gotcha

**This is the most common mistake when writing tests or handling errors.**

```typescript
// WRONG - result.error is NOT a string
if (result.error === 'Something failed') { ... }
expect(result.error).toContain('error message');

// CORRECT - result.error is { message: string, code: string }
if (result.error?.message === 'Something failed') { ... }
expect(result.error?.message).toContain('error message');

// BEST - Use the DX helpers (recommended)
import { getErrorMessage, isFailure, hasErrorCode, ErrorCode } from '@workwayco/sdk';

if (isFailure(result)) {
  console.log(getErrorMessage(result)); // TypeScript knows error is defined
}
if (hasErrorCode(result, ErrorCode.RATE_LIMITED)) {
  // Handle rate limiting
}
```

The `ActionResult.error()` factory returns:
```typescript
{
  success: false,
  data: null,
  error: {
    message: string,  // Human-readable error message
    code: string,     // ErrorCode enum value
  },
  metadata: { ... },
  capabilities: {},
}
```

### Creating Success Results

```typescript
import { createActionResult, ActionResult } from '@workwayco/sdk';

// Method 1: Full control (recommended for integrations)
return createActionResult({
  data: response,
  integration: 'stripe',
  action: 'create-payment-intent',
  schema: 'stripe.payment-intent.v1',
  capabilities: {
    canHandleText: true,
    supportsMetadata: true,
    supportsPagination: true,
  },
});

// Method 2: Quick success
return ActionResult.success(data, {
  integration: 'stripe',
  action: 'create-payment-intent',
  schema: 'stripe.payment-intent.v1',
});
```

### Creating Error Results

```typescript
import { ActionResult, ErrorCode } from '@workwayco/sdk';

// Return error (don't throw)
return ActionResult.error(
  'Invalid webhook signature',
  ErrorCode.AUTH_INVALID,
  { integration: 'stripe', action: 'parse-webhook' }
);
```

### DX Helpers for Error Handling

The SDK provides helper functions that make error handling more intuitive:

```typescript
import {
  getErrorMessage,
  getErrorCode,
  hasErrorCode,
  isFailure,
  isSuccess,
  ErrorCode,
} from '@workwayco/sdk';

const result = await stripe.createPayment(options);

// Get just the error message (returns undefined if success)
const message = getErrorMessage(result); // "Invalid card number" or undefined

// Get just the error code
const code = getErrorCode(result); // "validation_error" or undefined

// Check for specific error code
if (hasErrorCode(result, ErrorCode.RATE_LIMITED)) {
  await sleep(1000);
  return retry();
}

// Type-safe success/failure checks
if (isFailure(result)) {
  // TypeScript knows: result.error is { message: string, code: string }
  console.error(result.error.message);
  return;
}

if (isSuccess(result)) {
  // TypeScript knows: result.data is the expected type
  console.log(result.data.id);
}
```

| Helper | Returns | Use Case |
|--------|---------|----------|
| `getErrorMessage(result)` | `string \| undefined` | Quick access to error message |
| `getErrorCode(result)` | `string \| undefined` | Quick access to error code |
| `hasErrorCode(result, code)` | `boolean` | Check for specific error |
| `isFailure(result)` | Type guard | Type-safe error handling |
| `isSuccess(result)` | Type guard | Type-safe success handling |

---

## IntegrationError - Error Taxonomy

### Error Codes

Use the appropriate error code so WorkflowExecutor can make smart decisions:

| Code | Category | Retryable | Action |
|------|----------|-----------|--------|
| `AUTH_EXPIRED` | Authentication | Yes (1x) | Auto-refresh OAuth token |
| `AUTH_INVALID` | Authentication | No | Notify user to reconnect |
| `AUTH_MISSING` | Authentication | No | Notify user to connect |
| `RATE_LIMITED` | Rate Limit | Yes (3x) | Exponential backoff |
| `QUOTA_EXCEEDED` | Rate Limit | No | Notify user |
| `NETWORK_ERROR` | Network | Yes (5x) | Retry with backoff |
| `PROVIDER_DOWN` | Network | Yes (5x) | Retry later |
| `NOT_FOUND` | API | No | Resource doesn't exist |
| `VALIDATION_ERROR` | Configuration | No | Invalid input |
| `TIMEOUT` | Workflow | Yes (2x) | Retry |

### Throwing vs Returning Errors

**In integration methods**: Return `ActionResult.error()` - don't throw.

```typescript
// CORRECT - Return error result
async createPayment(options): Promise<ActionResult<Payment>> {
  if (!options.amount) {
    return ActionResult.error(
      'Amount is required',
      ErrorCode.VALIDATION_ERROR,
      { integration: 'stripe', action: 'create-payment' }
    );
  }
  // ...
}
```

**In constructors**: Throw `IntegrationError` - constructor can't return.

```typescript
constructor(config: Config) {
  if (!config.secretKey) {
    throw new IntegrationError(
      ErrorCode.AUTH_MISSING,
      'Stripe secret key is required',
      { integration: 'stripe', retryable: false }
    );
  }
}
```

---

## Request Timeouts

All integrations must support configurable timeouts using `AbortController`:

```typescript
export interface IntegrationConfig {
  // ... other config
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export class MyIntegration {
  private timeout: number;

  constructor(config: IntegrationConfig) {
    this.timeout = config.timeout ?? 30000;
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(`${this.apiUrl}${endpoint}`, {
        ...options,
        headers: { /* ... */ },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

---

## Retry Logic

The SDK provides shared retry utilities. **Use them instead of implementing custom retry logic.**

### Basic Retry

```typescript
import { withRetry, fetchWithRetry } from '@workwayco/sdk';

// Wrap any async function
const result = await withRetry(
  async (context) => {
    console.log(`Attempt ${context.attempt} of ${context.maxAttempts}`);
    return await someAsyncOperation();
  },
  {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 30000,
    jitter: 0.1,
  }
);

// Or use fetchWithRetry for HTTP requests
const response = await fetchWithRetry(
  'https://api.example.com/data',
  {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(data),
  },
  { maxAttempts: 3, timeout: 10000 }
);
```

### Rate Limit Awareness

```typescript
import { createRateLimitAwareRetry, fetchWithRetry } from '@workwayco/sdk';

const shouldRetry = createRateLimitAwareRetry({
  maxWait: 60000, // Don't wait more than 60s
  onRateLimit: (waitMs) => console.log(`Rate limited, waiting ${waitMs}ms`),
});

const response = await fetchWithRetry(url, init, { shouldRetry });
```

### Retry Options

| Option | Default | Description |
|--------|---------|-------------|
| `maxAttempts` | 3 | Total attempts including initial |
| `backoff` | 'exponential' | `'exponential'` \| `'linear'` \| `'constant'` |
| `initialDelay` | 1000 | Initial delay in ms |
| `maxDelay` | 30000 | Cap on delay growth |
| `jitter` | 0.1 | Randomization factor (0-1) |
| `timeout` | 30000 | Request timeout in ms |

---

## ActionCapabilities - Be Honest

Capabilities describe what your integration can actually do. **Don't overstate.**

```typescript
// BAD - Overstating capabilities
capabilities: {
  canHandleAttachments: true,  // But Gmail API doesn't support this yet
  canHandleMetadata: true,     // Not a standard capability name
}

// GOOD - Honest declaration
capabilities: {
  canHandleText: true,
  canHandleRichText: true,
  canHandleHtml: true,
  canHandleAttachments: false,  // Not yet implemented
  supportsMetadata: true,       // Standard capability name
  supportsPagination: true,
}
```

Standard capabilities:
- `canHandleText`, `canHandleRichText`, `canHandleHtml`, `canHandleMarkdown`
- `canHandleAttachments`, `canHandleImages`
- `supportsSearch`, `supportsPagination`, `supportsBulkOperations`
- `supportsNesting`, `supportsRelations`, `supportsMetadata`

---

## Webhook Signature Verification

Webhook verification is **security-critical code**. Always verify signatures:

```typescript
async parseWebhookEvent(
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<ActionResult<WebhookEvent>> {
  try {
    // 1. Parse signature header
    const elements = signature.split(',');
    const signatureMap: Record<string, string> = {};
    for (const element of elements) {
      const [key, value] = element.split('=');
      signatureMap[key] = value;
    }

    const timestamp = signatureMap['t'];
    const expectedSignature = signatureMap['v1'];

    // 2. Validate format
    if (!timestamp || !expectedSignature) {
      return ActionResult.error(
        'Invalid signature format',
        ErrorCode.VALIDATION_ERROR,
        { integration: 'stripe', action: 'parse-webhook' }
      );
    }

    // 3. Check timestamp (prevent replay attacks)
    const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (timestampAge > 300) { // 5 minute tolerance
      return ActionResult.error(
        'Webhook timestamp too old',
        ErrorCode.VALIDATION_ERROR,
        { integration: 'stripe', action: 'parse-webhook' }
      );
    }

    // 4. Compute and compare signature (HMAC-SHA256)
    const signedPayload = `${timestamp}.${payload}`;
    const computedSignature = await computeHmacSha256(signedPayload, webhookSecret);

    if (computedSignature !== expectedSignature) {
      return ActionResult.error(
        'Invalid webhook signature',
        ErrorCode.AUTH_INVALID,
        { integration: 'stripe', action: 'parse-webhook' }
      );
    }

    // 5. Parse and return event
    const event = JSON.parse(payload);
    return createActionResult({ ... });
  } catch (error) {
    return this.handleError(error, 'parse-webhook');
  }
}
```

### Webhook Security Checklist

- [ ] Parse signature header correctly
- [ ] Validate all required fields present
- [ ] Check timestamp for replay attack protection (typically 5 min tolerance)
- [ ] Use constant-time comparison for signatures
- [ ] Return `ActionResult.error()` (don't throw) for invalid signatures

---

## Testing Integrations

### Test Setup

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

### Testing Webhook Verification

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyIntegration } from './index.js';

// Helper to generate valid signatures
async function generateSignature(
  payload: string,
  secret: string,
  timestamp?: number
): Promise<string> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${ts}.${payload}`;
  // ... HMAC-SHA256 computation
  return `t=${ts},v1=${signature}`;
}

describe('Webhook Verification', () => {
  it('should verify valid signature', async () => {
    const payload = JSON.stringify({ id: 'evt_123', type: 'event.created' });
    const signature = await generateSignature(payload, webhookSecret);

    const result = await integration.parseWebhookEvent(payload, signature, webhookSecret);

    expect(result.success).toBe(true);
    expect(result.data.id).toBe('evt_123');
  });

  it('should reject tampered payload', async () => {
    const originalPayload = JSON.stringify({ id: 'evt_original' });
    const signature = await generateSignature(originalPayload, webhookSecret);
    const tamperedPayload = JSON.stringify({ id: 'evt_tampered' });

    const result = await integration.parseWebhookEvent(tamperedPayload, signature, webhookSecret);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Invalid webhook signature');
  });

  it('should reject expired timestamps', async () => {
    const payload = JSON.stringify({ id: 'evt_123' });
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 min ago
    const signature = await generateSignature(payload, webhookSecret, oldTimestamp);

    const result = await integration.parseWebhookEvent(payload, signature, webhookSecret);

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('timestamp too old');
  });
});
```

---

## Rate Limit Headers

Integrations should capture rate limit information from API responses and include it in the ActionResult metadata. This enables WorkflowExecutor to make intelligent decisions about retries and backoff.

### Extracting Rate Limits

```typescript
/**
 * Extract rate limit information from response headers
 */
private extractRateLimit(response: Response): {
  remaining: number;
  limit: number;
  reset: number;
} | undefined {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const limit = response.headers.get('X-RateLimit-Limit');
  const reset = response.headers.get('X-RateLimit-Reset');

  if (remaining && limit && reset) {
    return {
      remaining: parseInt(remaining, 10),
      limit: parseInt(limit, 10),
      reset: parseInt(reset, 10), // Unix timestamp
    };
  }
  return undefined;
}
```

### Including in ActionResult

```typescript
const data = await response.json();
const rateLimit = this.extractRateLimit(response);

return createActionResult({
  data,
  integration: 'stripe',
  action: 'create-payment-intent',
  schema: 'stripe.payment-intent.v1',
  capabilities: this.getCapabilities(),
  rateLimit, // Included in metadata
});
```

### Common Header Names by Provider

| Provider | Remaining | Limit | Reset |
|----------|-----------|-------|-------|
| Stripe | `X-RateLimit-Remaining` | `X-RateLimit-Limit` | `X-RateLimit-Reset` |
| GitHub | `X-RateLimit-Remaining` | `X-RateLimit-Limit` | `X-RateLimit-Reset` |
| Slack | `X-RateLimit-Remaining` | `X-RateLimit-Limit` | `Retry-After` |
| Notion | Custom (in response body) | - | `Retry-After` |

---

## Integration Checklist

When building a new integration:

### Required
- [ ] Export a class with constructor accepting config
- [ ] All methods return `ActionResult<T>`
- [ ] Use `IntegrationError` with appropriate `ErrorCode`
- [ ] Implement configurable timeout via `AbortController`
- [ ] Declare honest `ActionCapabilities`
- [ ] Add webhook signature verification (if applicable)

### Recommended
- [ ] Use `fetchWithRetry` for HTTP requests
- [ ] Add comprehensive tests for webhook verification
- [ ] Extract and include rate limit headers in responses
- [ ] Handle pagination for list operations
- [ ] Support metadata on resources (if provider supports it)

### Schema Versioning

Use semantic schema names:
```
{integration}.{resource}.v{version}
```

Examples:
- `stripe.payment-intent.v1`
- `gmail.email.v1`
- `notion.page.v1`
- `slack.message.v1`

---

## File Structure

```
packages/integrations/src/
  gmail/
    index.ts          # Gmail class + types
    gmail.test.ts     # Tests
  stripe/
    index.ts          # Stripe class + types
    stripe.test.ts    # Webhook verification tests
  notion/
    index.ts
  slack/
    index.ts
  google-sheets/
    index.ts
```

Each integration exports:
- Main class (e.g., `Stripe`, `Gmail`, `Notion`)
- Config interface (e.g., `StripeConfig`)
- Resource types (e.g., `StripePaymentIntent`, `GmailEmail`)

---

## Common Patterns

### Private Request Method

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), this.timeout);

  try {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return this.handleApiError(response, endpoint);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Error Handling Method

```typescript
private handleError<T>(error: unknown, action: string): ActionResult<T> {
  if (error instanceof IntegrationError) {
    return ActionResult.error(error.message, error.code, {
      integration: 'myintegration',
      action,
    });
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return ActionResult.error(message, ErrorCode.UNKNOWN, {
    integration: 'myintegration',
    action,
  });
}
```

---

*This document emerges from the hermeneutic circle of building integrations. Each implementation revealed aspects of the whole that weren't visible from the initial understanding. The README describes what the SDK does; this guide describes how to build with it.*
