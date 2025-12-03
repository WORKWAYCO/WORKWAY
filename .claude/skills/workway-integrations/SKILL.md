---
name: workway-integrations
description: Build WORKWAY integrations following the BaseAPIClient pattern. Use when creating or modifying service integrations (Zoom, Notion, Slack, Gmail, etc.).
allowed-tools: Read, Write, Edit, Grep, Glob
---

# WORKWAY Integration Patterns

## Directory Structure

Every integration follows this canonical structure:

```
packages/integrations/src/{service}/
├── index.ts           # Main export
├── {service}.types.ts # TypeScript interfaces
├── {service}.ts       # API client (extends BaseAPIClient)
└── {service}.test.ts  # Tests
```

## BaseAPIClient Pattern

All API clients MUST extend `BaseAPIClient`:

```typescript
import { BaseAPIClient, APIConfig, APIResponse } from '../core/base-client';
import { ServiceConfig, ServiceResponse } from './{service}.types';

export class ServiceClient extends BaseAPIClient {
  constructor(config: ServiceConfig) {
    super({
      baseUrl: 'https://api.service.com',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      ...config,
    });
  }

  async getResource(id: string): Promise<APIResponse<ResourceResponse>> {
    return this.request<ResourceResponse>({
      method: 'GET',
      path: `/resources/${id}`,
    });
  }

  async createResource(data: CreateResourceInput): Promise<APIResponse<ResourceResponse>> {
    return this.request<ResourceResponse>({
      method: 'POST',
      path: '/resources',
      body: data,
    });
  }
}
```

## Type Definitions

Define comprehensive types in `{service}.types.ts`:

```typescript
// Configuration
export interface ServiceConfig {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

// API Responses
export interface ResourceResponse {
  id: string;
  name: string;
  created_at: string;
  // ... other fields
}

// API Inputs
export interface CreateResourceInput {
  name: string;
  // ... other fields
}

// Error types
export interface ServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

## OAuth Pattern

For OAuth-based services:

```typescript
// Token refresh is handled automatically by BaseAPIClient
// Store tokens encrypted in database
// Use 5-minute expiration buffer for proactive refresh

export class OAuthServiceClient extends BaseAPIClient {
  private tokenRefreshCallback?: (tokens: TokenPair) => Promise<void>;

  constructor(config: OAuthServiceConfig) {
    super({
      baseUrl: 'https://api.service.com',
      onTokenRefresh: config.onTokenRefresh,
      tokenExpirationBuffer: 5 * 60 * 1000, // 5 minutes
      ...config,
    });
  }
}
```

## Error Handling

Errors should be caught and transformed into user-friendly messages:

```typescript
try {
  const result = await client.getResource(id);
  return result;
} catch (error) {
  if (error.code === 'TOKEN_EXPIRED') {
    throw new UserFacingError('Your connection needs refreshing', 'RECONNECT_REQUIRED');
  }
  if (error.code === 'RATE_LIMITED') {
    throw new UserFacingError('Please try again in a moment', 'RATE_LIMITED');
  }
  throw new UserFacingError('Something went wrong', 'UNKNOWN_ERROR');
}
```

## Testing Requirements

Every integration needs tests:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ServiceClient } from './{service}';

describe('ServiceClient', () => {
  it('should fetch resource by id', async () => {
    const client = new ServiceClient({ accessToken: 'test-token' });

    // Mock the fetch
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: '123', name: 'Test' }),
    });

    const result = await client.getResource('123');

    expect(result.data.id).toBe('123');
  });

  it('should handle token refresh', async () => {
    // Test token refresh flow
  });

  it('should handle errors gracefully', async () => {
    // Test error handling
  });
});
```

## Reference Implementations

Study these for patterns:

- `packages/integrations/src/notion/` - Notion API with complex types
- `packages/integrations/src/slack/` - Slack with webhooks
- `packages/integrations/src/google-sheets/` - Google OAuth flow
- `packages/integrations/src/airtable/` - Airtable with pagination

## Canonical Design Tokens

Import from brand design system:

```typescript
import { BRAND_RADIUS, BRAND_OPACITY } from '../lib/brand-design-system';
```

Never hardcode:
- Border radius values
- Opacity values
- Color values
- Spacing values
