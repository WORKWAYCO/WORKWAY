# Critical Test Scenarios - Quick Reference

## 🔴 Security-Critical Tests (Must Have)

### OAuth Flow Security

```typescript
// tests/integration/oauth-security.test.ts

describe('OAuth Security', () => {
  it('should reject OAuth callback with invalid state', async () => {
    // Prevents CSRF attacks
  });

  it('should expire OAuth state after 10 minutes', async () => {
    // Prevents replay attacks
  });

  it('should validate authorization code before token exchange', async () => {
    // Prevents code injection
  });

  it('should securely store tokens (encrypted)', async () => {
    // Prevents token theft
  });

  it('should handle token refresh securely', async () => {
    // Prevents token leakage
  });
});
```

### Webhook Security

```typescript
// tests/integration/webhook-security.test.ts

describe('Webhook Security', () => {
  it('should validate webhook signature', async () => {
    // Prevents unauthorized webhook calls
  });

  it('should reject webhooks for inactive workflows', async () => {
    // Prevents execution of disabled workflows
  });

  it('should rate limit webhook endpoints', async () => {
    // Prevents DoS attacks
  });

  it('should sanitize webhook payload', async () => {
    // Prevents injection attacks
  });
});
```

### Database Security

```typescript
// tests/unit/db-security.test.ts

describe('Database Security', () => {
  it('should prevent SQL injection in user inputs', async () => {
    // Test with malicious input: "'; DROP TABLE workflows; --"
  });

  it('should validate input types before queries', async () => {
    // Prevents type confusion attacks
  });

  it('should use parameterized queries', async () => {
    // Verify all queries use .bind()
  });
});
```

## 🟡 Data Integrity Tests (High Priority)

### Workflow State Consistency

```typescript
// tests/integration/workflow-state.test.ts

describe('Workflow State Consistency', () => {
  it('should maintain referential integrity on workflow delete', async () => {
    // Deleting workflow should cascade delete actions
  });

  it('should prevent orphaned execution records', async () => {
    // Executions should always reference valid workflows
  });

  it('should handle concurrent workflow updates', async () => {
    // Test race conditions
  });

  it('should rollback on partial deployment failure', async () => {
    // Atomic operations
  });
});
```

### Token Management

```typescript
// tests/integration/token-management.test.ts

describe('Token Management', () => {
  it('should refresh token before expiration (5 min buffer)', async () => {
    // Prevents expired token usage
  });

  it('should handle refresh token rotation', async () => {
    // OAuth best practice
  });

  it('should invalidate old tokens on refresh', async () => {
    // Security best practice
  });

  it('should handle refresh failures gracefully', async () => {
    // Error recovery
  });
});
```

## 🟢 Error Handling Tests (Medium Priority)

### Procore API Error Scenarios

```typescript
// tests/integration/procore-errors.test.ts

describe('Procore API Error Handling', () => {
  it('should retry on 429 rate limit with exponential backoff', async () => {
    // Resilience
  });

  it('should handle 401 with token refresh retry', async () => {
    // Auto-recovery
  });

  it('should timeout after 30 seconds', async () => {
    // Prevents hanging requests
  });

  it('should handle network failures gracefully', async () => {
    // Resilience
  });

  it('should validate API response schema', async () => {
    // Prevents runtime errors
  });
});
```

### Workflow Execution Errors

```typescript
// tests/integration/workflow-errors.test.ts

describe('Workflow Execution Errors', () => {
  it('should handle action failures without stopping workflow', async () => {
    // Partial failure handling
  });

  it('should log errors with full context', async () => {
    // Debuggability
  });

  it('should retry transient failures', async () => {
    // Resilience
  });

  it('should mark workflow as error after repeated failures', async () => {
    // Circuit breaker pattern
  });
});
```

## 🔵 Edge Case Tests (Nice to Have)

### Boundary Conditions

```typescript
// tests/unit/boundaries.test.ts

describe('Boundary Conditions', () => {
  it('should handle empty workflow lists', async () => {
    // No workflows scenario
  });

  it('should handle workflows with 100+ actions', async () => {
    // Large workflows
  });

  it('should handle very long workflow names', async () => {
    // Input validation
  });

  it('should handle special characters in workflow names', async () => {
    // Input sanitization
  });

  it('should handle concurrent executions of same workflow', async () => {
    // Concurrency
  });
});
```

### Resource Edge Cases

```typescript
// tests/integration/resources-edge-cases.test.ts

describe('Resource Edge Cases', () => {
  it('should handle invalid workflow URIs gracefully', async () => {
    // Error handling
  });

  it('should return empty logs for workflow with no executions', async () => {
    // Empty state handling
  });

  it('should handle expired tokens in resource fetching', async () => {
    // Token expiration
  });
});
```

## Test Implementation Checklist

### Phase 1: Security (Week 1)
- [ ] OAuth state validation
- [ ] OAuth token security
- [ ] Webhook signature validation
- [ ] SQL injection prevention
- [ ] Input sanitization

### Phase 2: Data Integrity (Week 1-2)
- [ ] Referential integrity
- [ ] Transaction handling
- [ ] Concurrent updates
- [ ] Token refresh logic
- [ ] State consistency

### Phase 3: Error Handling (Week 2)
- [ ] API error scenarios
- [ ] Network failures
- [ ] Timeout handling
- [ ] Retry logic
- [ ] Circuit breakers

### Phase 4: Edge Cases (Week 2-3)
- [ ] Boundary conditions
- [ ] Empty states
- [ ] Large datasets
- [ ] Special characters
- [ ] Concurrency

## Running Critical Tests

```bash
# Run only security tests
pnpm test --grep "Security"

# Run only error handling tests
pnpm test --grep "Error"

# Run critical path tests
pnpm test tests/integration/oauth-security.test.ts tests/integration/webhook-security.test.ts
```

## Test Coverage Targets

| Category | Target Coverage |
|----------|----------------|
| Security Tests | 100% |
| Data Integrity | 95% |
| Error Handling | 90% |
| Edge Cases | 80% |

## Notes

- **Security tests** should never be skipped
- **Data integrity tests** should run before deployment
- **Error handling tests** ensure graceful degradation
- **Edge case tests** prevent production surprises
