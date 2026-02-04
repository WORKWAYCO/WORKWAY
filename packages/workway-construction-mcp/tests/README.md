# WORKWAY Construction MCP - Test Suite

## Overview

This test suite provides comprehensive coverage for the WORKWAY Construction MCP server, including:
- **Unit Tests**: Individual tool functions and utilities
- **Integration Tests**: API endpoints and external integrations
- **E2E Tests**: Complete workflow lifecycles

## Test Structure

```
tests/
├── setup.ts                    # Test environment setup
├── mocks/
│   └── env.ts                  # Mock environment factory
├── unit/
│   └── tools/
│       ├── workflow.test.ts    # Workflow tool tests
│       └── procore.test.ts     # Procore tool tests
├── integration/
│   ├── mcp-server.test.ts     # MCP API endpoint tests
│   └── procore-client.test.ts  # Procore client tests
└── e2e/
    └── workflow-lifecycle.test.ts  # End-to-end workflow tests
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage

# Run specific test file
pnpm test tests/unit/tools/workflow.test.ts

# Run tests matching pattern
pnpm test --grep "workflow"
```

## Test Coverage Goals

| Component | Target Coverage |
|-----------|----------------|
| MCP Endpoints | 90% |
| Workflow Tools | 85% |
| Procore Tools | 80% |
| Database Layer | 90% |
| Procore Client | 85% |
| **Overall** | **80%** |

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { workflowTools } from '../../src/tools/workflow';
import { createMockEnv } from '../mocks/env';

describe('myTool', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should handle success case', async () => {
    const result = await workflowTools.myTool.execute({ ... }, env);
    expect(result.success).toBe(true);
  });
});
```

### Integration Test Example

```typescript
import app from '../../src/index';
import { createMockEnv } from '../mocks/env';

describe('POST /mcp/tools/:name', () => {
  it('should execute tool', async () => {
    const req = new Request('http://localhost/mcp/tools/my_tool', {
      method: 'POST',
      body: JSON.stringify({ arguments: { ... } }),
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
  });
});
```

## Mocking Guidelines

### Database (D1)
Use `createMockEnv()` which provides a mock D1 database. Override `env.DB.prepare` for specific test scenarios.

### KV Namespace
Mock KV operations via `env.KV` in `createMockEnv()`. State persists within test scope.

### External APIs (Procore)
Mock `global.fetch` to simulate API responses:

```typescript
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'test' }),
});
```

### Durable Objects
Mocked via `env.WORKFLOW_STATE` in `createMockEnv()`. Override `fetch` method for custom behavior.

## Test Best Practices

1. **Isolation**: Each test should be independent
2. **Clear Names**: Test names should describe what they test
3. **Arrange-Act-Assert**: Structure tests clearly
4. **Mock External Dependencies**: Don't make real API calls
5. **Test Edge Cases**: Include error scenarios
6. **Coverage**: Aim for 80%+ coverage on critical paths

## Debugging Tests

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/vitest

# Run single test file with verbose output
pnpm test tests/unit/tools/workflow.test.ts --reporter=verbose

# Run tests matching pattern with coverage
pnpm test --grep "workflow" --coverage
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-deployment checks

Coverage reports are generated and uploaded to coverage service.
