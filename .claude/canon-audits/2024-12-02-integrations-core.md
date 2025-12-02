# Canon Audit: Integrations Core Utilities

**Date**: 2024-12-02
**Reviewer**: Claude Code + Micah Johnson
**Scope**: `packages/integrations/src/core/` (BaseAPIClient, error-handler, utilities)
**Overall Score**: 47/50

## Summary

The integrations core utilities embody "Weniger, aber besser" at the code architecture level. By extracting shared HTTP and error handling patterns into a minimal set of composable utilities, we eliminated ~212 lines of duplicate code across Gmail and Notion integrations, with potential for ~400+ more across remaining integrations.

## Principle Scores

| Principle | Score | Evidence |
|-----------|-------|----------|
| 1. Innovative | 5/5 | Context-specific solution: `additionalHeaders` param elegantly handles API version headers (Notion-Version, Stripe-Version) without abstraction bloat |
| 2. Useful | 5/5 | Every line serves the developer: `get()`, `post()`, `patch()`, `delete()` eliminate boilerplate while `assertResponseOk()` reduces error handling to one line |
| 3. Aesthetic | 4/5 | Clean TypeScript with consistent patterns; JSDoc examples guide usage; minor: could align method signatures more consistently |
| 4. Understandable | 5/5 | Self-documenting: `extends BaseAPIClient` immediately communicates intent; `createErrorHandler('gmail')` reads as natural language |
| 5. Unobtrusive | 5/5 | Tool recedes completely (Zuhandenheit): developers write `await this.get('/path')` without thinking about auth, timeouts, or headers |
| 6. Honest | 5/5 | No magic: timeout is explicit (default 30000), auth is Bearer token, Content-Type is JSON. No hidden behaviors |
| 7. Long-lasting | 5/5 | Built on stable foundations: native fetch, AbortController, URLSearchParams. No dependencies beyond SDK types |
| 8. Thorough | 4/5 | Handles: timeouts, auth headers, custom headers, response validation, typed errors. Minor gap: no retry logic (intentional—kept simple) |
| 9. Environmentally friendly | 5/5 | Zero external dependencies. ~200 lines total. Tree-shakeable exports. Minimal bundle impact |
| 10. As little as possible | 4/5 | 143 lines (base-client) + 85 lines (error-handler) = 228 lines total to eliminate ~600+ lines across 6 integrations. Could potentially merge `buildQueryString` into base client |

## Critical Violations

None. All principles score 4 or above.

## Exemplary Elements

### 1. The `additionalHeaders` Pattern (Principle #1: Innovative)

```typescript
protected async request(
  path: string,
  options: RequestInit = {},
  additionalHeaders: Record<string, string> = {}  // ← Elegant extension point
): Promise<Response>
```

This single parameter eliminates the need for:
- Separate base classes per API versioning scheme
- Complex header merging logic
- Provider-specific HTTP clients

Usage in Notion:
```typescript
private get notionHeaders(): Record<string, string> {
  return { 'Notion-Version': this.notionVersion };
}

// Clean, readable calls
const response = await this.get(`/pages/${pageId}`, this.notionHeaders);
```

### 2. The Error Handler Factory (Principle #5: Unobtrusive)

```typescript
const handleError = createErrorHandler('gmail');

// In catch blocks—one line, full context
catch (error) {
  return handleError(error, 'send-email');
}
```

Before (repeated in every method):
```typescript
catch (error: unknown) {
  if (error instanceof IntegrationError) {
    const integrationErr = error as IntegrationError;
    return ActionResult.error(integrationErr.message, integrationErr.code, {
      integration: 'gmail',
      action: 'send-email',
    });
  }
  const errMessage = error instanceof Error ? error.message : String(error);
  return ActionResult.error(
    `Failed to send email: ${errMessage}`,
    ErrorCode.API_ERROR,
    { integration: 'gmail', action: 'send-email' }
  );
}
```

**Reduction**: 14 lines → 1 line per catch block. Across 6 integrations with ~8 methods each = ~624 lines eliminated.

### 3. Type Assertion for Auth (Principle #6: Honest)

```typescript
export function validateAccessToken(
  token: unknown,
  integrationName: string
): asserts token is string {  // ← TypeScript assertion narrows type
```

Honest about what it does: validates AND narrows type. No silent failures, no undefined behavior.

## Recommendations

### Priority 1: None Required
The implementation is canonically sound.

### Priority 2: Consider for Future
1. **Add `put()` method** if integrations need it (currently only GET/POST/PATCH/DELETE)
2. **Consider retry helper** as separate opt-in utility (not in base client—keep it minimal)

### Priority 3: Polish
1. Align JSDoc format across all methods
2. Consider moving `buildQueryString` into base client as protected method

## Metrics

| Metric | Value |
|--------|-------|
| Lines of code (core) | 228 |
| Lines eliminated (Gmail) | 99 |
| Lines eliminated (Notion) | 113 |
| Projected total elimination | ~400-600 |
| External dependencies | 0 |
| Files | 3 |

## Hermeneutic Validation

This pattern was validated through:
- **Practice (.space)**: Applied to real integrations (Gmail, Notion)
- **Research (.io)**: Analyzed 6 integrations to identify common patterns
- **Service (.agency)**: Reduces maintenance burden for production integrations

The canon is strengthened: "Weniger, aber besser" applies not just to UI, but to code architecture.

---

**Verdict**: Canonical. Ready for continued application to remaining integrations.
