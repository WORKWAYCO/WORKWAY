# Integration Tests - Complete Coverage

## Overview

Add missing tests for all 22 untested integrations following the established template pattern.

**Philosophy**: Tests should be invisible infrastructure—confidence without manual verification.

**Priority**: P1 - HIGH. 22 integrations have no tests, meaning no validation they work.

**Key Files**:
- `packages/integrations/src/_template/index.test.ts` (pattern to follow)
- `packages/integrations/src/*/index.ts` (implementations to test)

## Features

### Batch 1 - Core business integrations
Test the most commonly used integrations first.

**Files to create**:
- `packages/integrations/src/notion/index.test.ts`
- `packages/integrations/src/slack/index.test.ts`
- `packages/integrations/src/zoom/index.test.ts`
- `packages/integrations/src/stripe/index.test.ts`

**Test pattern** (from _template):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntegrationName } from './index';

describe('IntegrationName', () => {
  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const integration = new IntegrationName({ apiKey: 'test' });
      expect(integration).toBeDefined();
    });

    it('should throw on missing required config', () => {
      expect(() => new IntegrationName({})).toThrow();
    });
  });

  describe('actions', () => {
    // Test each action method
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock fetch to return error
      // Verify IntegrationError is thrown
    });
  });
});
```

**Verification**:
- All 4 test files created
- `pnpm --filter integrations test` passes

### Batch 2 - Secondary integrations
Add tests for developer and productivity integrations.

**Files to create**:
- `packages/integrations/src/github/index.test.ts`
- `packages/integrations/src/linear/index.test.ts`
- `packages/integrations/src/hubspot/index.test.ts`
- `packages/integrations/src/airtable/index.test.ts`

**Verification**:
- All 4 test files created
- Tests follow same pattern as Batch 1

### Batch 3 - Vertical integrations
Add tests for industry-specific integrations.

**Files to create**:
- `packages/integrations/src/docusign/index.test.ts`
- `packages/integrations/src/follow-up-boss/index.test.ts`
- `packages/integrations/src/nexhealth/index.test.ts`
- `packages/integrations/src/procore/index.test.ts`
- `packages/integrations/src/quickbooks/index.test.ts`
- `packages/integrations/src/sikka/index.test.ts`
- `packages/integrations/src/weave/index.test.ts`

**Verification**:
- All 7 test files created
- Tests follow same pattern

### Batch 4 - Remaining integrations
Complete coverage for all remaining integrations.

**Files to create**:
- `packages/integrations/src/calendly/index.test.ts`
- `packages/integrations/src/discord/index.test.ts`
- `packages/integrations/src/dribbble/index.test.ts`
- `packages/integrations/src/google-sheets/index.test.ts`
- `packages/integrations/src/todoist/index.test.ts`
- `packages/integrations/src/typeform/index.test.ts`
- `packages/integrations/src/workers-ai/index.test.ts`

**Verification**:
- All 7 test files created
- Total: 22 new test files

## Verification

Confirm integration test coverage is complete:
- All 22 test files exist
- `pnpm --filter integrations test` passes
- Coverage > 60% for integrations package
- Each test covers: constructor, actions, error handling
