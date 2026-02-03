# OAuth Authentication and Authorization Test Coverage

## Overview

Comprehensive test suite for OAuth integration handling in workflows, designed to be reusable across all OAuth-based integrations (Notion, Slack, Gmail, Zoom, etc.).

**Location**: `packages/workflows/src/__tests__/oauth-flows.test.ts`

**Current Focus**: Notion OAuth (used by YouTube to Notion workflow)

**Test Results**: ✅ 22/22 tests passing

---

## Test Coverage Summary

### 1. OAuth Token Validation (4 tests)

- ✅ Valid token → workflow executes successfully
- ✅ Expired token (no refresh) → clear error with re-auth instructions
- ✅ Invalid token → rejected with reconnect URL
- ✅ Missing integration → user-friendly error message

**Key Assertions**:
- Successful workflows return `success: true` with data
- Failed auth includes error code, message, and `reconnectUrl`
- Error messages are actionable ("Please connect your Notion account")

---

### 2. Scope Enforcement (4 tests)

- ✅ Exact required scopes → workflow proceeds
- ✅ Missing scopes → specific error listing what's missing
- ✅ Extra scopes → no issues (graceful handling)
- ✅ Validation happens **before** API calls (fail fast)

**Key Assertions**:
- Scope validation errors include: `NOTION_INSUFFICIENT_SCOPES` code
- Error messages list specific missing permissions (e.g., "Missing required Notion permissions: write_pages, read_databases")
- No API calls attempted when scopes are insufficient

**Example Error Message**:
```
"Missing required Notion permissions: write_pages, read_databases. Please reconnect with the correct permissions."
```

---

### 3. Token Refresh Flows (4 tests)

- ✅ Expired access token + valid refresh token → automatic refresh, workflow continues
- ✅ Expired refresh token → user re-auth required
- ✅ Successful refresh → workflow completes normally
- ✅ Failed refresh → graceful error with reconnect URL

**Key Assertions**:
- Automatic token refresh is transparent to workflow execution
- Refresh failures result in `NOTION_REAUTH_REQUIRED` error
- Updated access token persists in integration context after refresh
- Error messages distinguish between token refresh failures and other auth issues

**Token Refresh Sequence**:
1. Detect expired access token
2. Attempt refresh using refresh token
3. If successful: update context, continue workflow
4. If failed: return re-auth error with reconnect URL

---

### 4. Multi-Integration Scenarios (2 tests)

- ✅ Single integration (Notion only) → works correctly
- ✅ Integration isolation → one failure doesn't affect others

**Key Assertions**:
- Workflows can validate OAuth for multiple integrations independently
- One integration's auth failure doesn't cascade to others
- Designed for future compound workflows (e.g., Notion + Slack + Gmail)

**Example Use Case**: YouTube to Notion workflow only requires Notion OAuth (no YouTube OAuth since it uses public InnerTube API).

---

### 5. Error Messaging (5 tests)

- ✅ Missing auth → actionable error with reconnect URL
- ✅ Tokens never exposed in error messages (security)
- ✅ Specific error codes for debugging (`NOTION_NOT_CONNECTED`, `NOTION_INVALID_TOKEN`, etc.)
- ✅ Clear re-authorization instructions
- ✅ Proper 401 vs 403 handling (token issue vs insufficient scopes)

**Security Validation**:
- Test explicitly checks that token strings never appear in error messages
- Error messages are informative but never leak sensitive data

**Error Code Reference**:
| Code | Meaning | User Action |
|------|---------|-------------|
| `NOTION_NOT_CONNECTED` | Integration not connected | Connect Notion account |
| `NOTION_INVALID_TOKEN` | Token is invalid or malformed | Reconnect Notion account |
| `NOTION_REAUTH_REQUIRED` | Both access and refresh tokens expired | Re-authenticate with Notion |
| `NOTION_INSUFFICIENT_SCOPES` | Missing required permissions | Reconnect with correct scopes |

---

### 6. Integration with Notion Client (3 tests)

- ✅ Mock Notion API calls with valid OAuth
- ✅ Mock Notion OAuth errors (401, 403)
- ✅ Validate OAuth before API calls (fail fast pattern)

**Key Assertions**:
- Uses `createMockNotion()` utility from `lib/utils/createMockNotion.ts`
- Validates that OAuth checks occur before expensive API calls
- Ensures test mocks align with real Notion integration methods

---

## Implementation Patterns

### Mock OAuth Provider

The test suite includes a `MockOAuthProvider` class that simulates:
- Token validation (valid, expired, invalid)
- Token refresh flows (success, failure)
- Scope checking

This pattern is reusable for testing other OAuth integrations (Slack, Gmail, etc.).

### Workflow Execution Simulation

The `executeWorkflowWithOAuth()` function demonstrates the canonical OAuth flow:

```typescript
1. Check if integration is connected
2. Validate access token
3. If expired and refresh token exists:
   a. Attempt token refresh
   b. If successful: update context and continue
   c. If failed: return re-auth error
4. Validate required scopes
5. Execute workflow logic
```

This pattern should be used across all OAuth-requiring workflows.

---

## Future Extensions

### Adding New Integrations

To test OAuth for a new integration (e.g., Slack):

1. Extend `MockIntegrationContext` type:
```typescript
interface MockIntegrationContext {
  notion?: { ... };
  slack?: {
    access_token: string;
    scopes: string[];
    // ...
  };
}
```

2. Add integration-specific tests:
```typescript
describe('Slack OAuth', () => {
  it('should validate Slack token with chat:write scope', async () => {
    // Test implementation
  });
});
```

3. Reuse existing test patterns (token validation, scope enforcement, refresh flows)

### Compound Workflow Testing

For workflows requiring multiple OAuth integrations:

```typescript
it('should handle partial auth (Notion connected, Slack not)', async () => {
  const integrations = {
    notion: { access_token: 'valid_notion_token', scopes: [...] },
    // Slack not connected
  };

  // Test should gracefully handle missing Slack integration
  // while allowing Notion operations to proceed
});
```

---

## Success Criteria (Achieved)

✅ All tests passing (22/22)
✅ Coverage of auth success + all failure modes
✅ Clear, actionable error messages validated
✅ ~22 tests (exceeded minimum of 12-15)
✅ Reusable patterns for future OAuth integrations
✅ Security validation (tokens never exposed)
✅ Fail-fast pattern (OAuth validation before API calls)
✅ Token refresh automation tested

---

## Running Tests

```bash
# Run all OAuth tests
cd packages/workflows
pnpm test oauth-flows

# Run with coverage
pnpm test oauth-flows --coverage

# Watch mode
pnpm test oauth-flows --watch
```

---

## Related Files

| File | Purpose |
|------|---------|
| `packages/workflows/src/__tests__/oauth-flows.test.ts` | OAuth test suite (this file) |
| `packages/workflows/src/lib/utils/createMockNotion.ts` | Mock Notion client for testing |
| `packages/integrations/src/notion/index.ts` | Real Notion integration (OAuth client) |
| `packages/workflows/src/youtube-playlist-sync/index.ts` | Workflow using Notion OAuth |

---

## Design Philosophy: Zuhandenheit

OAuth authentication should **recede into the background**:

- ✅ Valid tokens → workflow executes without thinking about auth
- ✅ Expired tokens → automatic refresh (transparent to user)
- ✅ Auth failures → clear, actionable error messages
- ✅ No "OAuth" jargon in user-facing errors

**Wrong**: "OAuth 2.0 token validation failed with 401 Unauthorized error"
**Right**: "Your Notion session has expired. Please reconnect your account."

The tool recedes. The outcome remains.
