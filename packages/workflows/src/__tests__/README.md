# Workflow Tests

This directory contains comprehensive test suites for workflow OAuth authentication and authorization.

## Files

### `oauth-flows.test.ts`

**Purpose**: Test OAuth integration handling for workflows that require external service authentication.

**Coverage**: 22 tests across 6 categories:
1. OAuth token validation (valid, expired, invalid, missing)
2. Scope enforcement (required, missing, extra scopes)
3. Token refresh flows (success, failure, expired refresh)
4. Multi-integration scenarios (single, multiple, isolation)
5. Error messaging (user-facing, security, error codes)
6. Integration with Notion client (mocking, validation)

**Run Tests**:
```bash
# From packages/workflows directory
pnpm test oauth-flows

# With coverage
pnpm test oauth-flows --coverage

# Watch mode (for development)
pnpm test oauth-flows --watch
```

## Adding New OAuth Integration Tests

### 1. Extend the Integration Context

In `oauth-flows.test.ts`, add your integration to `MockIntegrationContext`:

```typescript
interface MockIntegrationContext {
  notion?: { ... };
  slack?: {
    access_token: string;
    refresh_token?: string;
    expires_at?: number;
    scopes: string[];
  };
}
```

### 2. Add Integration-Specific Tests

Follow the existing pattern:

```typescript
describe('Slack OAuth', () => {
  it('should validate Slack token with required scopes', async () => {
    const slackToken = 'slack_access_token';
    oauthProvider.setToken(slackToken, {
      access_token: slackToken,
      expires_at: Date.now() + 3600 * 1000,
      scopes: ['chat:write', 'channels:read'],
    });

    const integrations: MockIntegrationContext = {
      slack: {
        access_token: slackToken,
        scopes: ['chat:write', 'channels:read'],
      },
    };

    const result = await executeWorkflowWithOAuth(
      integrations,
      ['chat:write', 'channels:read'],
      oauthProvider
    );

    expect(result.success).toBe(true);
  });
});
```

### 3. Test All Flow Patterns

Every OAuth integration should test:
- ✅ Valid token acceptance
- ✅ Expired token handling (with refresh)
- ✅ Invalid token rejection
- ✅ Scope enforcement
- ✅ Error messaging with reconnect URLs
- ✅ Token security (no exposure in errors)

## Test Utilities

### `MockOAuthProvider`

Simulates OAuth provider behavior:
- `setToken(accessToken, tokenData)` - Register a token
- `validateToken(accessToken)` - Check if token is valid/expired
- `refreshToken(refreshToken)` - Simulate token refresh

### `createMockNotion()`

From `lib/utils/createMockNotion.ts` - provides mocked Notion client for testing API calls.

## Philosophy: Zuhandenheit

OAuth should recede into the background:

- **Valid auth** → workflow executes transparently
- **Expired token** → automatic refresh (invisible to user)
- **Auth failure** → clear, actionable error

**Wrong**: "OAuth 2.0 authorization failed with HTTP 401"
**Right**: "Your Notion session expired. Please reconnect."

## Related Documentation

- **Full Coverage Report**: `../OAUTH_TEST_COVERAGE.md`
- **Notion Integration**: `packages/integrations/src/notion/index.ts`
- **Example Workflow**: `packages/workflows/src/youtube-playlist-sync/index.ts`

---

**Status**: ✅ 22/22 tests passing
**Last Updated**: Task #2 completion
